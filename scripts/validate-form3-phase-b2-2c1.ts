/**
 * Form3 Phase B2-2C1 — Autosave Engine 検証。
 *
 * 実行: npx tsx scripts/validate-form3-phase-b2-2c1.ts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createForm3V2AutosaveController,
  FORM3_V2_AUTOSAVE_DEBOUNCE_MS_DEFAULT,
  type Form3V2AutosaveSaveResult,
} from "../lib/form3/v2/form3V2AutosaveController";
import type { CanPersistForm3V2Input } from "../lib/form3/v2/form3V2SaveGate";
import {
  createInitialForm3V2WriteFlags,
  markForm3V2UserEdited,
} from "../lib/form3/v2/form3V2WritePath";
import { FEATURE_FLAGS } from "../lib/featureFlags";

type Check = { name: string; ok: boolean; detail?: string };
const checks: Check[] = [];

function check(name: string, ok: boolean, detail?: string) {
  checks.push({ name, ok, detail });
}

function gateFromFlags(
  flags: ReturnType<typeof createInitialForm3V2WriteFlags>,
  featureEnabled = true,
): CanPersistForm3V2Input {
  return {
    featureEnabled,
    hasUserEdited: flags.hasUserEdited,
    dirty: flags.dirty,
    saveStatus: flags.saveStatus,
    hasConflict: flags.saveStatus === "conflict",
  };
}

async function main() {
  // ── dirty → schedule → 未保存 → flush → save ──
  {
    let saveCalls = 0;
    let flags = createInitialForm3V2WriteFlags({ hasPersistedV2: false });
    flags = markForm3V2UserEdited(flags).flags;

    const controller = createForm3V2AutosaveController({
      getGateInput: () => gateFromFlags(flags),
      saveNowV2: async (): Promise<Form3V2AutosaveSaveResult> => {
        saveCalls++;
        flags = {
          ...flags,
          dirty: false,
          hasPersistedV2: true,
          saveStatus: "saved",
        };
        return { ok: true, kind: "saved" };
      },
      enableTimer: false,
    });

    check("初期 pending false", controller.getState().pending === false);
    check(
      "timerEnabled false（C1）",
      controller.getState().timerEnabled === false,
    );

    controller.notifyDirty({
      dirty: flags.dirty,
      hasUserEdited: flags.hasUserEdited,
    });
    check("dirty=true → debounce 予約", controller.getState().pending === true);
    check(
      "予約後も timerArmed false",
      controller.getState().timerArmed === false,
    );
    check("予約だけでは save しない", saveCalls === 0);

    const flushed = await controller.flush();
    check("flush → saved", flushed.ok === true && flushed.kind === "saved");
    check("flush で saveNowV2 1回", saveCalls === 1);
    check("flush 後 pending false", controller.getState().pending === false);
  }

  // ── Migration だけ → 予約されない ──
  {
    let saveCalls = 0;
    const flags = createInitialForm3V2WriteFlags({ hasPersistedV2: false });
    const controller = createForm3V2AutosaveController({
      getGateInput: () => gateFromFlags(flags),
      saveNowV2: async () => {
        saveCalls++;
        return { ok: true, kind: "saved" };
      },
    });

    controller.notifyDirty({
      dirty: flags.dirty,
      hasUserEdited: flags.hasUserEdited,
    });
    check(
      "Migration: pending にならない",
      controller.getState().pending === false,
    );
    controller.schedule();
    check(
      "Migration: schedule も no-op",
      controller.getState().pending === false,
    );
    check("Migration: save されない", saveCalls === 0);
  }

  // ── cancel ──
  {
    let saveCalls = 0;
    const flags = markForm3V2UserEdited(
      createInitialForm3V2WriteFlags({ hasPersistedV2: false }),
    ).flags;
    const controller = createForm3V2AutosaveController({
      getGateInput: () => gateFromFlags(flags),
      saveNowV2: async () => {
        saveCalls++;
        return { ok: true, kind: "saved" };
      },
    });
    controller.schedule();
    check("cancel 前 pending", controller.getState().pending === true);
    controller.cancel();
    check("cancel 後 pending false", controller.getState().pending === false);
    const skipped = await controller.flush({ requirePending: true });
    check(
      "cancel 後 requirePending flush は skip",
      skipped.ok === false &&
        skipped.kind === "skipped" &&
        skipped.reason === "not_pending",
    );
    check("cancel 後 save なし", saveCalls === 0);
  }

  // ── Save Gate 接続（flush 時） ──
  {
    let saveCalls = 0;
    const flags = createInitialForm3V2WriteFlags({ hasPersistedV2: false });
    const controller = createForm3V2AutosaveController({
      getGateInput: () => gateFromFlags(flags, true),
      saveNowV2: async () => {
        saveCalls++;
        return { ok: true, kind: "saved" };
      },
    });
    const rejected = await controller.flush();
    check(
      "未編集 flush は Gate 拒否",
      rejected.ok === false &&
        rejected.kind === "gate_rejected" &&
        rejected.gate.allowed === false &&
        (rejected.gate.allowed === false
          ? rejected.gate.reason === "not_user_edited"
          : false),
    );
    check("Gate 拒否時 saveNowV2 未呼出", saveCalls === 0);
  }

  // ── Gate featureEnabled:false（純関数 Gate 契約。本番は常時 true） ──
  {
    let saveCalls = 0;
    const flags = markForm3V2UserEdited(
      createInitialForm3V2WriteFlags({ hasPersistedV2: false }),
    ).flags;
    const controller = createForm3V2AutosaveController({
      getGateInput: () => gateFromFlags(flags, false),
      saveNowV2: async () => {
        saveCalls++;
        return { ok: true, kind: "saved" };
      },
    });
    controller.schedule();
    check(
      "featureEnabled:false でも予約は可能（Controller）",
      controller.getState().pending === true,
    );
    const r = await controller.flush();
    check(
      "featureEnabled:false flush は Gate feature_disabled",
      r.ok === false &&
        r.kind === "gate_rejected" &&
        r.gate.allowed === false &&
        (r.gate.allowed === false
          ? r.gate.reason === "feature_disabled"
          : false),
    );
    check("featureEnabled:false で save なし", saveCalls === 0);
  }

  // ── 保存キュー（saving 中の再 schedule） ──
  {
    let saveCalls = 0;
    let resolveSave: ((v: Form3V2AutosaveSaveResult) => void) | undefined;
    let flags = markForm3V2UserEdited(
      createInitialForm3V2WriteFlags({ hasPersistedV2: false }),
    ).flags;

    const controller = createForm3V2AutosaveController({
      getGateInput: () => gateFromFlags(flags),
      saveNowV2: () =>
        new Promise<Form3V2AutosaveSaveResult>((resolve) => {
          saveCalls++;
          resolveSave = resolve;
        }),
    });

    controller.schedule();
    const p1 = controller.flush();
    check("flush 中 saving", controller.getState().saving === true);
    flags = markForm3V2UserEdited(flags).flags;
    controller.schedule();
    check("saving 中 queued", controller.getState().queued === true);

    resolveSave?.({ ok: true, kind: "saved" });
    await p1;
    check("1回目 save 完了", saveCalls === 1);
    check(
      "完了後 pending 再予約（キュー消化・タイマーなし）",
      controller.getState().pending === true &&
        controller.getState().timerArmed === false,
    );
  }

  // ── enableTimer 明示時のみ arm（C1 では使わないが API 確認） ──
  {
    let armed = false;
    const flags = markForm3V2UserEdited(
      createInitialForm3V2WriteFlags({ hasPersistedV2: false }),
    ).flags;
    const controller = createForm3V2AutosaveController({
      getGateInput: () => gateFromFlags(flags),
      saveNowV2: async () => ({ ok: true, kind: "saved" }),
      enableTimer: true,
      debounceMs: 50,
      setTimeoutFn: (fn, ms) => {
        armed = true;
        check("debounceMs 伝播", ms === 50);
        return setTimeout(fn, 10_000);
      },
      clearTimeoutFn: (id) => clearTimeout(id),
    });
    controller.schedule();
    check(
      "enableTimer true なら timerArmed",
      armed && controller.getState().timerArmed,
    );
    controller.cancel();
    check("cancel で timer 解除", controller.getState().timerArmed === false);
  }

  // ── 静的: Hook 未接続・Action/Repo 未変更 ──
  {
    const root = process.cwd();
    const hookSrc = readFileSync(
      join(root, "hooks/v2/useForm3Supabase.ts"),
      "utf8",
    );
    const actionSrc = readFileSync(
      join(root, "app/v2/actions/form3.ts"),
      "utf8",
    );
    const ctrlSrc = readFileSync(
      join(root, "lib/form3/v2/form3V2AutosaveController.ts"),
      "utf8",
    );
    check(
      "Controller が canPersistForm3V2 を使う",
      ctrlSrc.includes("canPersistForm3V2"),
    );
    check(
      "Controller 既定 debounce Ms",
      FORM3_V2_AUTOSAVE_DEBOUNCE_MS_DEFAULT === 1000,
    );
    check(
      "Controller コメント: 既定 timer 非起動（C1 契約）",
      ctrlSrc.includes("enableTimer: false") ||
        ctrlSrc.includes("タイマー既定は起動しない"),
    );
    check(
      "Action に Autosave 変更なし",
      !actionSrc.includes("AutosaveController") &&
        !actionSrc.includes("form3V2Autosave"),
    );
    check(
      "form3PhaseB flag removed (Phase B is default)",
      !("form3PhaseB" in FEATURE_FLAGS),
    );
    // Hook 接続は B2-2C2。C1 では Controller 単体契約のみ確認。
    void hookSrc;
  }

  const failed = checks.filter((c) => !c.ok);
  for (const c of checks) {
    const mark = c.ok ? "OK  " : "FAIL";
    const detail = c.detail ? ` (${c.detail})` : "";
    console.log(`${mark} ${c.name}${detail}`);
  }
  console.log(
    `\n===== form3 Phase B2-2C1: ${checks.length - failed.length} OK / ${failed.length} FAIL / ${checks.length} total =====`,
  );
  process.exit(failed.length === 0 ? 0 : 1);
}

void main();
