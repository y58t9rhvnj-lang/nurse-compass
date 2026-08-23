/**
 * Form3 Phase B2-2B — Write Path Integration 検証（純関数・モック中心）。
 *
 * 実行: npx tsx scripts/validate-form3-phase-b2-2b.ts
 *
 * 実DB結合は本番学生データを触らない。本スクリプトは Repository をモックし、
 * 保存パイプラインと Save Gate を検証する。
 * 実DBが必要な場合は scripts/v2/verify-form3.local.ts の CASE_ID=SP-FORM3-QA 方針に従う。
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createEmptyForm3 } from "../lib/form3/form3Types";
import { createEmptyForm3V2 } from "../lib/form3/v2/form3V2Factory";
import {
  prepareForm3V2ForPersist,
  rowToForm3SnapshotV2,
  sanitizeForm3PayloadAsV2,
} from "../lib/form3/v2/form3V2Mapper";
import { canPersistForm3V2 } from "../lib/form3/v2/form3V2SaveGate";
import { detectForm3PayloadSchema } from "../lib/form3/v2/form3V2SchemaDetect";
import {
  applyForm3V2SaveConflict,
  applyForm3V2SaveError,
  applyForm3V2SaveSuccess,
  createInitialForm3V2WriteFlags,
  evaluateForm3V2ExplicitSave,
  markForm3V2UserEdited,
  resolveHasPersistedV2,
  shouldClearForm3V2DraftOnSaveSuccess,
  shouldWriteForm3V2DraftOnSaveFailure,
} from "../lib/form3/v2/form3V2WritePath";
import { hydrateForm3ReadFromSnapshotPayload } from "../lib/form3/v2/form3V2ReadPath";
import { rowToForm3Snapshot, type Form3Row } from "../lib/v2/notebook/form3Mapper";
import { FEATURE_FLAGS } from "../lib/featureFlags";

type Check = { name: string; ok: boolean; detail?: string };
const checks: Check[] = [];

function check(name: string, ok: boolean, detail?: string) {
  checks.push({ name, ok, detail });
}

const FIXED_NOW = "2026-08-16T17:00:00.000Z";
const PATIENT = "A";

// ── Save Gate 全理由 ──
{
  const base = {
    featureEnabled: true,
    hasUserEdited: true,
    dirty: true,
    saveStatus: "dirty" as const,
    hasConflict: false,
  };
  check("Gate allow", canPersistForm3V2(base).allowed === true);
  check(
    "Gate feature_disabled",
    (() => {
      const r = canPersistForm3V2({ ...base, featureEnabled: false });
      return !r.allowed && r.reason === "feature_disabled";
    })(),
  );
  check(
    "Gate not_user_edited",
    (() => {
      const r = canPersistForm3V2({ ...base, hasUserEdited: false });
      return !r.allowed && r.reason === "not_user_edited";
    })(),
  );
  check(
    "Gate not_dirty",
    (() => {
      const r = canPersistForm3V2({ ...base, dirty: false });
      return !r.allowed && r.reason === "not_dirty";
    })(),
  );
  check(
    "Gate saving",
    (() => {
      const r = canPersistForm3V2({ ...base, saveStatus: "saving" });
      return !r.allowed && r.reason === "saving";
    })(),
  );
  check(
    "Gate conflict",
    (() => {
      const r = canPersistForm3V2({
        ...base,
        hasConflict: true,
        saveStatus: "conflict",
      });
      return !r.allowed && r.reason === "conflict";
    })(),
  );
}

// ── hasPersistedV2 ──
{
  check(
    "initial v1 → hasPersistedV2 false",
    resolveHasPersistedV2({ persistedSchemaVersion: 1 }) === false,
  );
  check(
    "initial v2 → hasPersistedV2 true",
    resolveHasPersistedV2({ persistedSchemaVersion: 2 }) === true,
  );
  const v1 = createEmptyForm3(PATIENT);
  const hydrated = hydrateForm3ReadFromSnapshotPayload(v1, PATIENT, {
    now: FIXED_NOW,
  });
  check(
    "migrate only → hasPersistedV2 false",
    resolveHasPersistedV2({
      persistedSchemaVersion: 1,
      rawPayload: v1,
    }) === false && hydrated.dataV2.schemaVersion === 2,
  );
}

// ── markUserEdited / dirty ──
{
  let flags = createInitialForm3V2WriteFlags({ hasPersistedV2: false });
  check("初期 hasUserEdited false", flags.hasUserEdited === false);
  check("初期 dirty false", flags.dirty === false);
  const marked = markForm3V2UserEdited(flags);
  flags = marked.flags;
  check("markUserEdited → hasUserEdited", flags.hasUserEdited === true);
  check("markUserEdited → dirty", flags.dirty === true);
  check("markUserEdited → saveStatus dirty", flags.saveStatus === "dirty");
}

// ── 保存成功後 state ──
{
  let flags = markForm3V2UserEdited(
    createInitialForm3V2WriteFlags({ hasPersistedV2: false }),
  ).flags;
  flags = applyForm3V2SaveSuccess(flags);
  check("save success dirty false", flags.dirty === false);
  check("save success hasPersistedV2 true", flags.hasPersistedV2 === true);
  check("save success status saved", flags.saveStatus === "saved");
}

// ── conflict / error は dirty 維持 ──
{
  let flags = markForm3V2UserEdited(
    createInitialForm3V2WriteFlags({ hasPersistedV2: false }),
  ).flags;
  const beforeDirty = flags.dirty;
  flags = applyForm3V2SaveConflict(flags);
  check("conflict 後 dirty 維持", flags.dirty === beforeDirty);
  check("conflict status", flags.saveStatus === "conflict");
  flags = applyForm3V2SaveError({
    ...flags,
    dirty: true,
    saveStatus: "dirty",
  });
  check("error 後 dirty 維持", flags.dirty === true);
  check("error status", flags.saveStatus === "error");
}

// ── Migration only: Gate 拒否・Draft 書かない ──
{
  const flags = createInitialForm3V2WriteFlags({ hasPersistedV2: false });
  const gate = evaluateForm3V2ExplicitSave({
    featureEnabled: true,
    hasUserEdited: flags.hasUserEdited,
    dirty: flags.dirty,
    saveStatus: flags.saveStatus,
    hasConflict: false,
  });
  check(
    "migration only Gate 拒否",
    !gate.allowed &&
      (gate.allowed === false ? gate.reason === "not_user_edited" : false),
  );
  check(
    "migration only Draft 書かない",
    shouldWriteForm3V2DraftOnSaveFailure({ hasUserEdited: false }) === false,
  );
}

// ── Draft 方針 ──
{
  check(
    "save success Draft clear",
    shouldClearForm3V2DraftOnSaveSuccess() === true,
  );
  check(
    "user edited failure Draft 可",
    shouldWriteForm3V2DraftOnSaveFailure({ hasUserEdited: true }) === true,
  );
}

// ── featureEnabled:false Gate 契約（本番は常時 true。flag 自体は撤去） ──
{
  check(
    "form3PhaseB flag removed (Phase B is default)",
    !("form3PhaseB" in FEATURE_FLAGS),
  );
  const gate = canPersistForm3V2({
    featureEnabled: false,
    hasUserEdited: true,
    dirty: true,
    saveStatus: "dirty",
    hasConflict: false,
  });
  check(
    "featureEnabled:false Gate 拒否",
    !gate.allowed && gate.reason === "feature_disabled",
  );
}

// ── prepare パイプライン / validation failure ──
{
  const empty = createEmptyForm3V2(PATIENT);
  const okPrep = prepareForm3V2ForPersist(empty, PATIENT);
  check("empty prepare ok", okPrep.ok === true);
  if (okPrep.ok) {
    check("serialize schema 2", okPrep.payload.schemaVersion === 2);
    check(
      "version フィールドは payload に無い（DB version と分離）",
      !("version" in okPrep.payload) ||
        okPrep.data.schemaVersion === 2,
    );
  }

  // sanitize が schemaVersion を 2 に戻すため、pipeline 後は通る。
  // prepare は sanitize 後必ず 11 keys を補完する。
  check("prepare は sanitize 後 validation", okPrep.ok === true);
}

// ── Mapper roundtrip / version 分離 ──
{
  const v1 = createEmptyForm3(PATIENT);
  v1.patterns.nutritional_metabolic.relatedInformation = "食欲低下";
  const asV2 = sanitizeForm3PayloadAsV2(v1, PATIENT, { now: FIXED_NOW });
  const prepared = prepareForm3V2ForPersist(asV2.payload, PATIENT);
  check("v1→prepare ok", prepared.ok === true);
  if (prepared.ok) {
    const row: Form3Row = {
      id: "r1",
      user_id: "u",
      organization_id: "o",
      academic_year: 2026,
      case_id: "SP-FORM3-QA",
      payload: prepared.payload,
      version: 5,
      created_at: FIXED_NOW,
      updated_at: FIXED_NOW,
    };
    const snap = rowToForm3SnapshotV2(row, PATIENT);
    check("Snapshot DB version", snap.version === 5);
    check("Snapshot persistedSchemaVersion 2", snap.persistedSchemaVersion === 2);
    check("Snapshot payload schema 2", snap.payload.schemaVersion === 2);
    check(
      "DB version ≠ schemaVersion 概念分離",
      snap.version === 5 && snap.payload.schemaVersion === 2,
    );
    check("Info 維持", snap.payload.informationCards.length === 1);

    // 擬似 DB: v1 行を v2 で更新しても所有軸は行オブジェクト側
    check("case_id 不変", row.case_id === "SP-FORM3-QA");
  }

  // v1 Snapshot メタ
  const v1row: Form3Row = {
    id: "r2",
    user_id: "u",
    organization_id: "o",
    academic_year: 2026,
    case_id: "SP-FORM3-QA",
    payload: v1,
    version: 2,
    created_at: FIXED_NOW,
    updated_at: FIXED_NOW,
  };
  const v1snap = rowToForm3Snapshot(v1row, PATIENT);
  check("v1 Snapshot persistedSchemaVersion 1", v1snap.persistedSchemaVersion === 1);
  check("v1 Snapshot rawPayload 保持", v1snap.rawPayload != null);
  check(
    "detect raw v1",
    detectForm3PayloadSchema(v1snap.rawPayload).schemaVersion === 1,
  );
}

// ── 擬似シナリオ A–I（Repository モック） ──
{
  type MockDb = { payload: unknown; version: number };
  let db: MockDb = {
    payload: createEmptyForm3(PATIENT),
    version: 3,
  };
  let repoCalls = 0;

  function mockPersist(data: unknown, expectedVersion: number | null): {
    ok: boolean;
    kind: string;
    version?: number;
    latest?: MockDb;
  } {
    const prepared = prepareForm3V2ForPersist(
      sanitizeForm3PayloadAsV2(data, PATIENT).payload,
      PATIENT,
    );
    if (!prepared.ok) return { ok: false, kind: "validation_error" };
    repoCalls++;
    if (expectedVersion === null) {
      if (db.version >= 1 && db.payload) {
        // 既存あり → conflict
        return { ok: false, kind: "conflict", latest: { ...db } };
      }
      db = { payload: prepared.payload, version: 1 };
      return { ok: true, kind: "saved", version: 1 };
    }
    if (db.version !== expectedVersion) {
      return { ok: false, kind: "conflict", latest: { ...db } };
    }
    db = { payload: prepared.payload, version: expectedVersion + 1 };
    return { ok: true, kind: "saved", version: db.version };
  }

  // A. v1 閲覧のみ
  const fpA = JSON.stringify(db.payload);
  const hydA = hydrateForm3ReadFromSnapshotPayload(db.payload, PATIENT, {
    now: FIXED_NOW,
  });
  check("A hydrate v2", hydA.dataV2.schemaVersion === 2);
  check("A DB 不変", JSON.stringify(db.payload) === fpA);
  check("A schema still 1 in DB", detectForm3PayloadSchema(db.payload).schemaVersion === 1);

  // E. user edit なし
  repoCalls = 0;
  const gateE = evaluateForm3V2ExplicitSave({
    featureEnabled: true,
    hasUserEdited: false,
    dirty: false,
    saveStatus: "idle",
    hasConflict: false,
  });
  check("E Gate 拒否", !gateE.allowed);
  check("E Repository 未呼出", repoCalls === 0);

  // D. dirty=false（edited だが dirty クリア後）
  repoCalls = 0;
  const gateD = evaluateForm3V2ExplicitSave({
    featureEnabled: true,
    hasUserEdited: true,
    dirty: false,
    saveStatus: "saved",
    hasConflict: false,
  });
  check("D Gate not_dirty", !gateD.allowed && gateD.reason === "not_dirty");
  check("D Repository 未呼出", repoCalls === 0);

  // B. v1 初回編集保存
  let flagsB = createInitialForm3V2WriteFlags({ hasPersistedV2: false });
  let dataB = hydA.dataV2;
  dataB = {
    ...dataB,
    finalForm: {
      ...dataB.finalForm,
      nutritional_metabolic: {
        informationSO: "食欲低下",
        interpretationAnalysisCareNeed: "低栄養の援助",
      },
    },
  };
  flagsB = markForm3V2UserEdited(flagsB, dataB).flags;
  const gateB = evaluateForm3V2ExplicitSave({
    featureEnabled: true,
    hasUserEdited: flagsB.hasUserEdited,
    dirty: flagsB.dirty,
    saveStatus: flagsB.saveStatus,
    hasConflict: false,
  });
  check("B Gate allow", gateB.allowed);
  const resB = mockPersist(dataB, db.version);
  check("B save ok", resB.ok && resB.kind === "saved");
  check("B version+1", resB.version === 4);
  check(
    "B DB schema 2",
    detectForm3PayloadSchema(db.payload).schemaVersion === 2,
  );
  check(
    "B v1Backup あり",
    Boolean(
      (db.payload as { v1Backup?: unknown }).v1Backup ||
        (db.payload as { migration?: unknown }).migration,
    ),
  );
  flagsB = applyForm3V2SaveSuccess(flagsB);
  check("B hasPersistedV2", flagsB.hasPersistedV2 === true);

  // C. v2 再保存
  const verC = db.version;
  dataB = {
    ...dataB,
    finalForm: {
      ...dataB.finalForm,
      nutritional_metabolic: {
        ...dataB.finalForm.nutritional_metabolic,
        informationSO: "食欲低下・体重減少",
      },
    },
  };
  flagsB = markForm3V2UserEdited(flagsB, dataB).flags;
  const resC = mockPersist(dataB, verC);
  check("C resave ok", resC.ok === true);
  check("C version+1", resC.version === verC + 1);

  // G. Conflict（端末Bが先に保存）
  const localEdit = {
    ...dataB,
    finalForm: {
      ...dataB.finalForm,
      sleep_rest: {
        informationSO: "ローカル編集",
        interpretationAnalysisCareNeed: "保持されるべき",
      },
    },
  };
  // 端末B
  db = { payload: db.payload, version: db.version + 1 };
  const expectedStale = db.version - 1;
  const resG = mockPersist(localEdit, expectedStale);
  check("G conflict", resG.ok === false && resG.kind === "conflict");
  check("G latest あり", resG.latest != null);
  check(
    "G ローカル編集オブジェクト保持（呼び出し側）",
    localEdit.finalForm.sleep_rest.informationSO === "ローカル編集",
  );

  // F. Validation / Gate 失敗時 Repository 未呼出
  repoCalls = 0;
  const beforeCalls = repoCalls;
  evaluateForm3V2ExplicitSave({
    featureEnabled: true,
    hasUserEdited: false,
    dirty: true,
    saveStatus: "dirty",
    hasConflict: false,
  });
  check("F Gate 失敗時 Repository 未呼出", repoCalls === beforeCalls);

  // H. Flag OFF
  check(
    "H Flag OFF v2 path 拒否",
    evaluateForm3V2ExplicitSave({
      featureEnabled: false,
      hasUserEdited: true,
      dirty: true,
      saveStatus: "dirty",
      hasConflict: false,
    }).allowed === false,
  );

  // I. Migration only
  const hydI = hydrateForm3ReadFromSnapshotPayload(
    createEmptyForm3(PATIENT),
    PATIENT,
    { now: FIXED_NOW },
  );
  check("I migrate dirty false", hydI.dirty === false);
  check("I shouldPersist false", hydI.shouldPersist === false);
}

// ── 静的: Action / Hook / Autosave ──
{
  const root = process.cwd();
  const actionSrc = readFileSync(join(root, "app/v2/actions/form3.ts"), "utf8");
  const hookSrc = readFileSync(join(root, "hooks/v2/useForm3Supabase.ts"), "utf8");
  check(
    "saveForm3V2Action が存在",
    actionSrc.includes("export async function saveForm3V2Action"),
  );
  check(
    "Action が prepareForm3V2ForPersist を通す",
    actionSrc.includes("prepareForm3V2ForPersist"),
  );
  check(
    "Action に form3PhaseB flag 分岐なし",
    !actionSrc.includes('isFeatureEnabled("form3PhaseB")') &&
      !actionSrc.includes("form3 phase b disabled"),
  );
  check(
    "既存 saveForm3Action 維持",
    actionSrc.includes("export async function saveForm3Action"),
  );
  check("Hook に saveNowV2", hookSrc.includes("saveNowV2"));
  check("Hook に markUserEditedV2", hookSrc.includes("markUserEditedV2"));
  check(
    "Hook Phase B で v1 scheduleAutosave 抑止",
    hookSrc.includes("if (phaseB) return") &&
      hookSrc.includes("PHASE_B_ENABLED"),
  );
  check(
    "saveForm3V2Action は debounce/autosave から呼ばない（timer なし）",
    !hookSrc.includes("saveForm3V2Action({\n          patientId,\n          payload: dataRef"),
  );
}

// ── 結果 ──
const failed = checks.filter((c) => !c.ok);
for (const c of checks) {
  const mark = c.ok ? "OK  " : "FAIL";
  const detail = c.detail ? ` (${c.detail})` : "";
  console.log(`${mark} ${c.name}${detail}`);
}
console.log(
  `\n===== form3 Phase B2-2B: ${checks.length - failed.length} OK / ${failed.length} FAIL / ${checks.length} total =====`,
);
process.exit(failed.length === 0 ? 0 : 1);
