/**
 * Form3 Phase B2-1 — Persistence Foundation 検証。
 *
 * 実行: npx tsx scripts/validate-form3-phase-b2.ts
 */

import { createEmptyForm3 } from "../lib/form3/form3Types";
import { createEmptyForm3V2 } from "../lib/form3/v2/form3V2Factory";
import {
  __resetForm3V2DraftCacheForTests,
  clearForm3V2Draft,
  FORM3_V2_DRAFT_PREFIX,
  parseForm3V2Draft,
  readForm3V2Draft,
  writeForm3V2Draft,
} from "../lib/form3/v2/form3V2Draft";
import {
  prepareForm3V2ForPersist,
  rowToForm3SnapshotV2,
  sanitizeForm3PayloadAsV2,
} from "../lib/form3/v2/form3V2Mapper";
import { migrateForm3V1ToV2 } from "../lib/form3/v2/form3V2Migration";
import {
  detectForm3PayloadSchema,
  deserializeForm3Payload,
  form3DataV2PersistenceFingerprint,
  loadForm3Payload,
  saveForm3Payload,
} from "../lib/form3/v2/form3V2Persistence";
import {
  serializeForm3DataV2,
  serializeForm3DataV2ToJson,
} from "../lib/form3/v2/form3V2Serialize";
import { validateForm3V2Persistence } from "../lib/form3/v2/form3V2Validation";
import type { Form3Row } from "../lib/v2/notebook/form3Mapper";

type Check = { name: string; ok: boolean; detail?: string };
const checks: Check[] = [];

function check(name: string, ok: boolean, detail?: string) {
  checks.push({ name, ok, detail });
}

const FIXED_NOW = "2026-08-16T15:00:00.000Z";
const PATIENT = "A";

// localStorage mock（Node）— Day3 と同方式
const store = new Map<string, string>();
(
  globalThis as unknown as {
    window: {
      localStorage: {
        getItem: (k: string) => string | null;
        setItem: (k: string, v: string) => void;
        removeItem: (k: string) => void;
      };
      addEventListener: () => void;
      removeEventListener: () => void;
    };
  }
).window = {
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k)! : null),
    setItem: (k, v) => {
      store.set(k, v);
    },
    removeItem: (k) => {
      store.delete(k);
    },
  },
  addEventListener: () => {},
  removeEventListener: () => {},
};

__resetForm3V2DraftCacheForTests();
store.clear();

// ── schema 判定 ──
{
  check(
    "detect v1 schemaVersion",
    detectForm3PayloadSchema({ schemaVersion: 1, patterns: {} })
      .schemaVersion === 1,
  );
  check(
    "detect v2 schemaVersion",
    detectForm3PayloadSchema({
      schemaVersion: 2,
      informationCards: [],
      assessmentCards: [],
      finalForm: {},
    }).schemaVersion === 2,
  );
  check(
    "detect v1 by patterns",
    detectForm3PayloadSchema({ patterns: {} }).schemaVersion === 1,
  );
  check(
    "detect null on empty",
    detectForm3PayloadSchema(null).schemaVersion === null,
  );
}

// ── Factory → save → load 一致 ──
{
  const empty = createEmptyForm3V2(PATIENT);
  check(
    "empty validate 通過",
    validateForm3V2Persistence(empty).ok,
  );
  const saved = saveForm3Payload(empty, PATIENT);
  check("empty save ok", saved.ok === true);
  if (saved.ok) {
    const loaded = loadForm3Payload(saved.payload, PATIENT);
    check(
      "empty save→load fingerprint 一致",
      form3DataV2PersistenceFingerprint(loaded.data) ===
        form3DataV2PersistenceFingerprint(saved.data),
    );
    check("empty load sourceSchemaVersion 2", loaded.sourceSchemaVersion === 2);
    check(
      "empty deserialize 後 validate",
      validateForm3V2Persistence(loaded.data).ok,
    );
  }
}

// ── v1 → load → v2 → serialize → deserialize → sanitize 一致 ──
{
  const v1 = createEmptyForm3("OLD");
  v1.patterns.nutritional_metabolic = {
    relatedInformation: "食欲低下",
    interpretation: "低栄養疑い",
    crossPatternRelations: "",
    judgment: "problem",
    judgmentRationale: "摂取減少",
    additionalInformationNeeded: "",
    isReviewed: true,
  };

  const loaded1 = loadForm3Payload(v1, PATIENT, { now: FIXED_NOW });
  check("v1 load → schema 2", loaded1.data.schemaVersion === 2);
  check("v1 load sourceSchemaVersion 1", loaded1.sourceSchemaVersion === 1);
  check("v1 load Info 1", loaded1.data.informationCards.length === 1);
  check("v1 load Assess 1", loaded1.data.assessmentCards.length === 1);
  check(
    "v1 load Final 空（自動転記なし）",
    loaded1.data.finalForm.nutritional_metabolic.informationSO === "" &&
      loaded1.data.finalForm.nutritional_metabolic
        .interpretationAnalysisCareNeed === "",
  );
  check(
    "v1 load unresolved warning",
    loaded1.warnings.some((w) => w.code === "v1_final_mapping_unresolved"),
  );
  check(
    "serialize 前 validate",
    validateForm3V2Persistence(loaded1.data).ok,
  );

  const saved = saveForm3Payload(loaded1.data, PATIENT);
  check("migrated save ok", saved.ok === true);
  if (saved.ok) {
    const json = saved.json;
    const viaJson = deserializeForm3Payload(json, PATIENT, { now: FIXED_NOW });
    const viaObj = loadForm3Payload(saved.payload, PATIENT, {
      now: FIXED_NOW,
    });
    check(
      "serialize→deserialize fingerprint 一致",
      form3DataV2PersistenceFingerprint(viaJson.data) ===
        form3DataV2PersistenceFingerprint(saved.data),
    );
    check(
      "serialize→object load fingerprint 一致",
      form3DataV2PersistenceFingerprint(viaObj.data) ===
        form3DataV2PersistenceFingerprint(saved.data),
    );
    check(
      "deserialize 後 validate",
      validateForm3V2Persistence(viaJson.data).ok,
    );
    check("往復後 sourceSchemaVersion 2", viaJson.sourceSchemaVersion === 2);
    check(
      "往復後カード枚数維持",
      viaJson.data.informationCards.length === 1 &&
        viaJson.data.assessmentCards.length === 1,
    );
    check(
      "往復後 patientId サーバ値",
      viaJson.data.patientId === PATIENT,
    );
  }
}

// ── Migration 二回読み込みでカード増殖なし ──
{
  const v1 = createEmptyForm3(PATIENT);
  v1.patterns.activity_exercise = {
    relatedInformation: "歩行時息切れ",
    interpretation: "活動耐性低下",
    crossPatternRelations: "",
    judgment: "risk",
    judgmentRationale: "SpO2低下",
    additionalInformationNeeded: "6分間歩行",
    isReviewed: false,
  };
  const a = loadForm3Payload(v1, PATIENT, { now: FIXED_NOW });
  const serialized = serializeForm3DataV2(a.data);
  const b = loadForm3Payload(serialized, PATIENT, { now: FIXED_NOW });
  const c = loadForm3Payload(b.data, PATIENT, { now: FIXED_NOW });
  check(
    "二回 load で Info 増殖なし",
    a.data.informationCards.length === b.data.informationCards.length &&
      b.data.informationCards.length === c.data.informationCards.length &&
      a.data.informationCards.length === 1,
  );
  check(
    "二回 load で Assess 増殖なし",
    a.data.assessmentCards.length === b.data.assessmentCards.length &&
      b.data.assessmentCards.length === c.data.assessmentCards.length &&
      a.data.assessmentCards.length === 1,
  );
  check(
    "二回 load で ID 同一",
    a.data.informationCards[0]?.id === b.data.informationCards[0]?.id &&
      a.data.assessmentCards[0]?.id === b.data.assessmentCards[0]?.id,
  );
  check(
    "migrate 関数二回でも増殖なし（比較）",
    migrateForm3V1ToV2(v1, PATIENT, { now: FIXED_NOW }).informationCards
      .length ===
      migrateForm3V1ToV2(v1, PATIENT, { now: FIXED_NOW }).informationCards
        .length,
  );
}

// ── Draft schemaVersion 2 ──
{
  __resetForm3V2DraftCacheForTests();
  store.clear();
  const data = createEmptyForm3V2(PATIENT);
  data.finalForm.sleep_rest.informationSO = "夜間中途覚醒";
  data.finalForm.sleep_rest.interpretationAnalysisCareNeed =
    "休息確保の援助が必要";

  writeForm3V2Draft("user-b2", "SP-001", { payload: data, version: 3 });
  const read = readForm3V2Draft("user-b2", "SP-001", PATIENT);
  check(
    "Draft v2 保存→復元 一致",
    !!read &&
      read.version === 3 &&
      read.payload.schemaVersion === 2 &&
      read.payload.finalForm.sleep_rest.informationSO === "夜間中途覚醒" &&
      read.payload.finalForm.sleep_rest.interpretationAnalysisCareNeed ===
        "休息確保の援助が必要",
  );
  check(
    "Draft キー接頭辞が v2",
    [...store.keys()].some((k) => k.startsWith(FORM3_V2_DRAFT_PREFIX)),
  );

  clearForm3V2Draft("user-b2", "SP-001");
  __resetForm3V2DraftCacheForTests();
  check(
    "Draft clear 後 null",
    readForm3V2Draft("user-b2", "SP-001", PATIENT) === null,
  );

  // v1 形 payload を Draft 封筒に入れても migrate して受理
  const v1payload = createEmptyForm3(PATIENT);
  v1payload.patterns.elimination.relatedInformation = "便秘傾向";
  const migratedDraft = parseForm3V2Draft(
    {
      payload: v1payload,
      version: 1,
      stashedAt: FIXED_NOW,
    },
    PATIENT,
  );
  check(
    "Draft が v1 payload を migrate して受理",
    !!migratedDraft &&
      migratedDraft.payload.schemaVersion === 2 &&
      migratedDraft.payload.informationCards.length === 1 &&
      migratedDraft.payload.informationCards[0]?.content === "便秘傾向",
  );
  check(
    "patientId 不一致 Draft 無視",
    parseForm3V2Draft(
      {
        payload: createEmptyForm3V2("B"),
        version: 1,
        stashedAt: FIXED_NOW,
      },
      PATIENT,
    ) === null,
  );
  check("不正 Draft 無視", parseForm3V2Draft("not-json", PATIENT) === null);
}

// ── Mapper 直前（Repository 非接続） ──
{
  const v1 = createEmptyForm3(PATIENT);
  v1.patterns.value_belief.relatedInformation = "信仰上の食事制限";
  const asV2 = sanitizeForm3PayloadAsV2(v1, PATIENT, { now: FIXED_NOW });
  check("Mapper sanitizeAsV2 → v2", asV2.payload.schemaVersion === 2);
  check("Mapper sourceSchemaVersion 1", asV2.sourceSchemaVersion === 1);

  const row: Form3Row = {
    id: "row-1",
    user_id: "u",
    organization_id: "o",
    academic_year: 2026,
    case_id: "SP-001",
    payload: serializeForm3DataV2(asV2.payload),
    version: 7,
    created_at: FIXED_NOW,
    updated_at: FIXED_NOW,
  };
  const snap = rowToForm3SnapshotV2(row, PATIENT);
  check("rowToSnapshotV2 version", snap.version === 7);
  check("rowToSnapshotV2 schema 2", snap.payload.schemaVersion === 2);
  check(
    "rowToSnapshotV2 カード維持",
    snap.payload.informationCards.length === 1,
  );

  const prepared = prepareForm3V2ForPersist(snap.payload, PATIENT);
  check("prepareForPersist ok", prepared.ok === true);
  if (prepared.ok) {
    check(
      "prepareForPersist JSON 再読込一致",
      form3DataV2PersistenceFingerprint(
        loadForm3Payload(prepared.json, PATIENT).data,
      ) === form3DataV2PersistenceFingerprint(prepared.data),
    );
  }
}

// ── serialize 構成スモーク ──
{
  const data = createEmptyForm3V2(PATIENT);
  data.informationCards.push({
    id: "i1",
    content: "x",
    soType: "S",
    sourceType: "other",
    patternKeys: ["sleep_rest"],
    order: 0,
    status: "active",
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
  });
  const obj = serializeForm3DataV2(data);
  check("serialize は plain object", obj.schemaVersion === 2);
  check(
    "serializeToJson は parse 可能",
    JSON.parse(serializeForm3DataV2ToJson(data)).informationCards.length === 1,
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
  `\n===== form3 Phase B2-1: ${checks.length - failed.length} OK / ${failed.length} FAIL / ${checks.length} total =====`,
);
process.exit(failed.length === 0 ? 0 : 1);
