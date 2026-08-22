/**
 * Form3 Phase B2-2C2 — Autosave Activation 検証。
 *
 * 実行: npx tsx scripts/validate-form3-phase-b2-2c2.ts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createForm3V2AutosaveController,
  type Form3V2AutosaveSaveResult,
} from "../lib/form3/v2/form3V2AutosaveController";
import {
  FORM3_V2_AUTOSAVE_REASONS,
  FORM3_V2_INFORMATION_AUTOSAVE_REASONS,
  isForm3V2AutosaveReason,
} from "../lib/form3/v2/form3V2AutosaveReasons";
import type { CanPersistForm3V2Input } from "../lib/form3/v2/form3V2SaveGate";
import {
  applyForm3V2SaveConflict,
  applyForm3V2SaveError,
  applyForm3V2SaveSuccess,
  createInitialForm3V2WriteFlags,
  markForm3V2UserEdited,
} from "../lib/form3/v2/form3V2WritePath";
import { getForm3PhaseBPersistLabel } from "../components/v2/form3/form3PhaseBLabels";
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
  // ── Reasons ──
  {
    check(
      "Information AutosaveReason 5種",
      FORM3_V2_INFORMATION_AUTOSAVE_REASONS.length === 5 &&
        FORM3_V2_INFORMATION_AUTOSAVE_REASONS.every((r) =>
          isForm3V2AutosaveReason(r),
        ),
    );
    check(
      "AutosaveReason に Information を含む",
      FORM3_V2_INFORMATION_AUTOSAVE_REASONS.every((r) =>
        (FORM3_V2_AUTOSAVE_REASONS as readonly string[]).includes(r),
      ),
    );
  }

  // ── Information 追加 → Draft → Autosave → Saved ──
  {
    let saveCalls = 0;
    let flags = createInitialForm3V2WriteFlags({ hasPersistedV2: false });

    const controller = createForm3V2AutosaveController({
      getGateInput: () => gateFromFlags(flags),
      saveNowV2: async (): Promise<Form3V2AutosaveSaveResult> => {
        saveCalls++;
        flags = applyForm3V2SaveSuccess(flags);
        return { ok: true, kind: "saved" };
      },
      enableTimer: true,
      debounceMs: 20,
    });

    // markUserEdited → notifyDirty（Hook と同順）
    flags = markForm3V2UserEdited(flags).flags;
    const draftLabel = getForm3PhaseBPersistLabel({
      dirty: flags.dirty,
      saveStatus: flags.saveStatus,
      hydrated: true,
      hasPersistedV2: flags.hasPersistedV2,
    });
    check("追加直後 Draft", draftLabel.label === "Draft");

    controller.notifyDirty({
      dirty: flags.dirty,
      hasUserEdited: flags.hasUserEdited,
      reason: "information_added",
    });
    check("reason 記録", controller.getState().lastReason === "information_added");
    check("debounce 予約", controller.getState().pending === true);
    check("timerArmed", controller.getState().timerArmed === true);
    check("予約直後は未保存", saveCalls === 0);

    await new Promise((r) => setTimeout(r, 60));
    check("Autosave 後 save 1回", saveCalls === 1);
    check("Autosave 後 dirty false", flags.dirty === false);
    check("Autosave 後 hasPersistedV2", flags.hasPersistedV2 === true);

    const savedLabel = getForm3PhaseBPersistLabel({
      dirty: flags.dirty,
      saveStatus: flags.saveStatus,
      hydrated: true,
      hasPersistedV2: flags.hasPersistedV2,
    });
    check("Autosave 後 Saved", savedLabel.label === "Saved");
    controller.cancel();
  }

  // ── Information 編集 → Autosave → Saved ──
  {
    let saveCalls = 0;
    let flags = createInitialForm3V2WriteFlags({ hasPersistedV2: true });
    flags = { ...flags, saveStatus: "saved" };

    const controller = createForm3V2AutosaveController({
      getGateInput: () => gateFromFlags(flags),
      saveNowV2: async () => {
        saveCalls++;
        flags = applyForm3V2SaveSuccess(flags);
        return { ok: true, kind: "saved" };
      },
      enableTimer: true,
      debounceMs: 20,
    });

    flags = markForm3V2UserEdited(flags).flags;
    controller.notifyDirty({
      dirty: flags.dirty,
      hasUserEdited: flags.hasUserEdited,
      reason: "information_updated",
    });
    await new Promise((r) => setTimeout(r, 60));
    check("編集 Autosave", saveCalls === 1 && flags.dirty === false);
    check(
      "編集 reason",
      controller.getState().lastReason === "information_updated",
    );
    controller.cancel();
  }

  // ── Migration のみ → 保存されない ──
  {
    let saveCalls = 0;
    const flags = createInitialForm3V2WriteFlags({ hasPersistedV2: false });
    const controller = createForm3V2AutosaveController({
      getGateInput: () => gateFromFlags(flags),
      saveNowV2: async () => {
        saveCalls++;
        return { ok: true, kind: "saved" };
      },
      enableTimer: true,
      debounceMs: 20,
    });
    controller.notifyDirty({
      dirty: flags.dirty,
      hasUserEdited: flags.hasUserEdited,
    });
    await new Promise((r) => setTimeout(r, 60));
    check("Migration: pending なし", controller.getState().pending === false);
    check("Migration: save なし", saveCalls === 0);
    controller.cancel();
  }

  // ── Conflict → Draft 維持 ──
  {
    let flags = markForm3V2UserEdited(
      createInitialForm3V2WriteFlags({ hasPersistedV2: true }),
    ).flags;
    flags = applyForm3V2SaveConflict(flags);
    check("conflict で dirty 維持", flags.dirty === true);
    check("conflict status", flags.saveStatus === "conflict");
    const label = getForm3PhaseBPersistLabel({
      dirty: flags.dirty,
      saveStatus: flags.saveStatus,
      hydrated: true,
      hasPersistedV2: flags.hasPersistedV2,
    });
    check("conflict → Conflict 表示", label.label === "Conflict");

    let saveCalls = 0;
    const controller = createForm3V2AutosaveController({
      getGateInput: () => gateFromFlags(flags),
      saveNowV2: async () => {
        saveCalls++;
        return { ok: true, kind: "saved" };
      },
      enableTimer: true,
      debounceMs: 20,
    });
    controller.notifyDirty({
      dirty: flags.dirty,
      hasUserEdited: flags.hasUserEdited,
      reason: "information_updated",
    });
    await new Promise((r) => setTimeout(r, 60));
    check("conflict 中は schedule しない", controller.getState().pending === false);
    check("conflict 中 save なし", saveCalls === 0);
    controller.cancel();
  }

  // ── Save failed → dirty 維持 ──
  {
    let flags = markForm3V2UserEdited(
      createInitialForm3V2WriteFlags({ hasPersistedV2: true }),
    ).flags;
    flags = applyForm3V2SaveError(flags);
    check("error で dirty 維持", flags.dirty === true);
    const label = getForm3PhaseBPersistLabel({
      dirty: flags.dirty,
      saveStatus: flags.saveStatus,
      hydrated: true,
      hasPersistedV2: flags.hasPersistedV2,
    });
    check(
      "error ラベル Save failed",
      label.label === "Save failed",
    );
  }

  // ── 静的: Hook Activation / Workspace Reason / 禁止変更 ──
  {
    const root = process.cwd();
    const hookSrc = readFileSync(
      join(root, "hooks/v2/useForm3Supabase.ts"),
      "utf8",
    );
    const wsSrc = readFileSync(
      join(root, "components/v2/form3/Form3PhaseBWorkspace.tsx"),
      "utf8",
    );
    const actionSrc = readFileSync(
      join(root, "app/v2/actions/form3.ts"),
      "utf8",
    );
    const gateSrc = readFileSync(
      join(root, "lib/form3/v2/form3V2SaveGate.ts"),
      "utf8",
    );
    const repoSrc = readFileSync(
      join(root, "lib/v2/notebook/form3Repository.ts"),
      "utf8",
    );

    check(
      "Hook が createForm3V2AutosaveController を使う",
      hookSrc.includes("createForm3V2AutosaveController"),
    );
    check("Hook が enableTimer: true", hookSrc.includes("enableTimer: true"));
    check(
      "Hook markUserEditedV2 → notifyDirty",
      hookSrc.includes("notifyDirty") && hookSrc.includes("markUserEditedV2"),
    );
    check(
      "Workspace が saveNowV2 を呼ばない",
      !/\bsaveNowV2\s*\(/.test(wsSrc) &&
        !/\bsaveNowV2\s*,/.test(wsSrc) &&
        !/\bsaveNowV2\s*\}/.test(wsSrc),
    );
    for (const reason of FORM3_V2_INFORMATION_AUTOSAVE_REASONS) {
      check(`Workspace が ${reason} を渡す`, wsSrc.includes(`"${reason}"`));
    }
    check(
      "Action に Autosave 追加なし",
      !actionSrc.includes("AutosaveController") &&
        !actionSrc.includes("form3V2Autosave"),
    );
    check(
      "Save Gate ファイルに Autosave 依存なし",
      !gateSrc.includes("AutosaveController"),
    );
    check(
      "Repository に Autosave 依存なし",
      !repoSrc.includes("AutosaveController") &&
        !repoSrc.includes("form3V2Autosave"),
    );
    check(
      "FEATURE_FLAGS.form3PhaseB false（Flag OFF=旧Form3）",
      FEATURE_FLAGS.form3PhaseB === false,
    );
  }

  const failed = checks.filter((c) => !c.ok);
  for (const c of checks) {
    const mark = c.ok ? "OK  " : "FAIL";
    const detail = c.detail ? ` (${c.detail})` : "";
    console.log(`${mark} ${c.name}${detail}`);
  }
  console.log(
    `\n===== form3 Phase B2-2C2: ${checks.length - failed.length} OK / ${failed.length} FAIL / ${checks.length} total =====`,
  );
  process.exit(failed.length === 0 ? 0 : 1);
}

void main();
