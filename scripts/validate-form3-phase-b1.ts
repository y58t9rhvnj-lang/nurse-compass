/**
 * Form3 Phase B1 — schemaVersion 2 型・移行・sanitize・validation・progress 検証。
 *
 * 実行: npx tsx scripts/validate-form3-phase-b1.ts
 */

import { createEmptyForm3 } from "../lib/form3/form3Types";
import {
  createEmptyForm3V2,
  createForm3CardId,
  migrationForm3AssessmentId,
  migrationForm3InformationId,
  migrationStableKeyAssess,
  migrationStableKeyInfo,
} from "../lib/form3/v2/form3V2Factory";
import { migrateForm3V1ToV2 } from "../lib/form3/v2/form3V2Migration";
import {
  getForm3AssessmentCardProgressV2,
  getForm3FinalPatternProgressV2,
  getForm3InformationCardProgressV2,
} from "../lib/form3/v2/form3V2Progress";
import { sanitizeForm3V2Payload } from "../lib/form3/v2/form3V2Sanitize";
import {
  FORM3_SCHEMA_VERSION_V2,
  isForm3DataV1,
  isForm3DataV2,
  type Form3AssessmentCardV2,
  type Form3DataV2,
  type Form3InformationCardV2,
} from "../lib/form3/v2/form3V2Types";
import {
  checkForm3AssessmentCardV2,
  checkForm3InformationCardV2,
  isForm3FinalPatternEmpty,
  meetsForm3AssessmentReviewedRequirements,
} from "../lib/form3/v2/form3V2Validation";

type Check = { name: string; ok: boolean; detail?: string };
const checks: Check[] = [];

function check(name: string, ok: boolean, detail?: string) {
  checks.push({ name, ok, detail });
}

const FIXED_NOW = "2026-08-16T12:00:00.000Z";
const PATIENT = "A";

function sampleInfo(
  patch: Partial<Form3InformationCardV2> & Pick<Form3InformationCardV2, "id">,
): Form3InformationCardV2 {
  return {
    content: "食欲低下",
    soType: "S",
    sourceType: "patient_conversation",
    patternKeys: ["nutritional_metabolic"],
    order: 0,
    status: "active",
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
    ...patch,
  };
}

function sampleAssess(
  patch: Partial<Form3AssessmentCardV2> & Pick<Form3AssessmentCardV2, "id">,
): Form3AssessmentCardV2 {
  return {
    interpretation: "低栄養状態が疑われる",
    classification: "problem",
    evidenceInformationIds: [],
    needMoreInformation: "",
    patternKey: "nutritional_metabolic",
    order: 0,
    status: "draft",
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
    ...patch,
  };
}

// ── Factory ──
const empty = createEmptyForm3V2(PATIENT);
check("schemaVersion は 2", empty.schemaVersion === FORM3_SCHEMA_VERSION_V2);
check("informationCards は空配列", empty.informationCards.length === 0);
check("assessmentCards は空配列", empty.assessmentCards.length === 0);
check(
  "Final は 11 パターン",
  Object.keys(empty.finalForm).length === 11,
);
const k1 = empty.finalForm.health_perception_management;
const k2 = empty.finalForm.nutritional_metabolic;
k1.informationSO = "x";
check("Final パターンは独立オブジェクト", k2.informationSO === "");
check(
  "Final は学校指定2欄のみ",
  Object.keys(k1).sort().join(",") ===
    "informationSO,interpretationAnalysisCareNeed",
);
check("updatedAt は未保存時空文字", empty.updatedAt === "");
check("createForm3CardId が文字列を返す", typeof createForm3CardId() === "string");
check(
  "移行 Info ID は payload スコープ接頭辞",
  migrationForm3InformationId("nutritional_metabolic").startsWith(
    "form3-payload:mig-info-v1:",
  ),
);
check(
  "移行 Assess ID は payload スコープ接頭辞",
  migrationForm3AssessmentId("nutritional_metabolic").startsWith(
    "form3-payload:mig-assess-v1:",
  ),
);

// ── Discriminators ──
const v1empty = createEmptyForm3(PATIENT);
check("isForm3DataV1(空v1)", isForm3DataV1(v1empty));
check("!isForm3DataV2(空v1)", !isForm3DataV2(v1empty));
check("isForm3DataV2(空v2)", isForm3DataV2(empty));
check("!isForm3DataV1(空v2)", !isForm3DataV1(empty));

// ── Information sanitize / progress ──
{
  const { data, warnings } = sanitizeForm3V2Payload(
    {
      schemaVersion: 2,
      patientId: "wrong",
      informationCards: [
        {
          id: "i1",
          content: "SpO2 91%",
          soType: "objective",
          sourceType: "lab",
          patternKeys: ["activity_exercise", "activity_exercise", "nope"],
          order: "3",
          status: "active",
        },
        {
          id: "i1",
          content: "dup",
          soType: "S",
          sourceType: "other",
          patternKeys: [],
          order: 1,
          status: "archived",
        },
      ],
      assessmentCards: [],
      finalForm: {},
    },
    PATIENT,
  );
  check("sanitize が patientId を上書き", data.patientId === PATIENT);
  check("soType objective→O", data.informationCards[0]?.soType === "O");
  check("sourceType lab→laboratory", data.informationCards[0]?.sourceType === "laboratory");
  check(
    "patternKeys 重複・不正除去",
    data.informationCards[0]?.patternKeys.length === 1 &&
      data.informationCards[0]?.patternKeys[0] === "activity_exercise",
  );
  check("order を整数化", data.informationCards[0]?.order === 3);
  check("重複 ID を振り直し", data.informationCards[1]?.id !== "i1");
  check(
    "不明 pattern 警告あり",
    warnings.some((w) => w.code === "invalid_pattern_removed"),
  );
  check(
    "Final 11 補完",
    Object.keys(data.finalForm).length === 11,
  );
  const p0 = getForm3InformationCardProgressV2(data.informationCards[0]!);
  check("Info progress ready or in_progress", p0 === "ready" || p0 === "in_progress");
  check(
    "Archived info progress",
    getForm3InformationCardProgressV2(data.informationCards[1]!) === "archived",
  );
}

// ── Assessment 併存・根拠・reviewed ──
{
  const infoA = sampleInfo({ id: "ia", content: "食欲低下" });
  const infoB = sampleInfo({
    id: "ib",
    content: "体重減少",
    soType: "O",
    sourceType: "observation",
  });
  const base: Form3DataV2 = {
    ...createEmptyForm3V2(PATIENT),
    informationCards: [infoA, infoB],
    assessmentCards: [
      sampleAssess({
        id: "a1",
        interpretation: "低栄養",
        classification: "problem",
        evidenceInformationIds: ["ia", "ib"],
        status: "reviewed",
      }),
      sampleAssess({
        id: "a2",
        interpretation: "食欲はある場面も",
        classification: "strength",
        evidenceInformationIds: ["ia"],
        status: "reviewed",
      }),
      sampleAssess({
        id: "a3",
        interpretation: "転倒リスク",
        classification: "risk",
        evidenceInformationIds: ["ib"],
        status: "draft",
      }),
    ],
  };
  check(
    "同一 patternKey に複数 Assessment",
    base.assessmentCards.filter((c) => c.patternKey === "nutritional_metabolic")
      .length === 3,
  );
  check(
    "problem/strength/risk 併存",
    new Set(base.assessmentCards.map((c) => c.classification)).size === 3,
  );
  check(
    "根拠複数参照 OK",
    meetsForm3AssessmentReviewedRequirements(base.assessmentCards[0]!, base),
  );
  check(
    "draft は空条件でも ok",
    checkForm3AssessmentCardV2(base.assessmentCards[2]!, base).ok,
  );
  const insuf = sampleAssess({
    id: "a4",
    interpretation: "判断保留",
    classification: "insufficient_information",
    evidenceInformationIds: ["ia"],
    needMoreInformation: "",
    status: "reviewed",
  });
  const withInsuf: Form3DataV2 = {
    ...base,
    assessmentCards: [...base.assessmentCards, insuf],
  };
  check(
    "情報不足 reviewed は追加情報必須",
    !meetsForm3AssessmentReviewedRequirements(insuf, withInsuf) &&
      checkForm3AssessmentCardV2(insuf, withInsuf).issues.includes(
        "additional_information_required",
      ),
  );
  insuf.needMoreInformation = "体重推移を確認したい";
  check(
    "追加情報ありなら reviewed OK",
    meetsForm3AssessmentReviewedRequirements(insuf, withInsuf),
  );
  check(
    "progress reviewed_insufficient",
    getForm3AssessmentCardProgressV2(insuf, withInsuf) ===
      "reviewed_insufficient",
  );
  check(
    "active info content 必須",
    !checkForm3InformationCardV2(
      sampleInfo({ id: "empty", content: "  " }),
    ).ok,
  );
}

// ── Migration ──
{
  const emptyMig = migrateForm3V1ToV2(createEmptyForm3(PATIENT), PATIENT, {
    now: FIXED_NOW,
  });
  check("空 v1→v2 schema 2", emptyMig.schemaVersion === 2);
  check("空 v1→カード0", emptyMig.informationCards.length === 0);
  check("空 v1→v1Backup あり", !!emptyMig.v1Backup);
  check("空 v1→patientId", emptyMig.patientId === PATIENT);
  check(
    "空 v1→Final 空（転記なし）",
    isForm3FinalPatternEmpty(emptyMig.finalForm.nutritional_metabolic),
  );
  check(
    "空 v1→unresolved warning なし",
    emptyMig.migration?.warnings.every(
      (w) => w.code !== "v1_final_mapping_unresolved",
    ) === true,
  );

  const filled = createEmptyForm3("OLD");
  filled.patterns.nutritional_metabolic = {
    relatedInformation: "食欲低下と体重減少",
    interpretation: "低栄養が疑われる",
    crossPatternRelations: "活動パターンと関連",
    judgment: "problem",
    judgmentRationale: "摂取量減少",
    additionalInformationNeeded: "体重推移",
    isReviewed: true,
  };
  const once = migrateForm3V1ToV2(filled, PATIENT, { now: FIXED_NOW });
  const twice = migrateForm3V1ToV2(filled, PATIENT, { now: FIXED_NOW });
  check("入力済み→Info 1（未分割）", once.informationCards.length === 1);
  check(
    "Info 内容が原文のまま",
    once.informationCards[0]?.content === "食欲低下と体重減少",
  );
  check("入力済み→Assess 1", once.assessmentCards.length === 1);
  check("Assess は draft（自動 reviewed しない）", once.assessmentCards[0]?.status === "draft");
  check(
    "決定的 Info ID（payload スコープ）",
    once.informationCards[0]?.id ===
      migrationForm3InformationId("nutritional_metabolic"),
  );
  check(
    "決定的 Assess ID（payload スコープ）",
    once.assessmentCards[0]?.id ===
      migrationForm3AssessmentId("nutritional_metabolic"),
  );
  check(
    "stableMigrationKey Info",
    once.informationCards[0]?.stableMigrationKey ===
      migrationStableKeyInfo("nutritional_metabolic"),
  );
  check(
    "stableMigrationKey Assess",
    once.assessmentCards[0]?.stableMigrationKey ===
      migrationStableKeyAssess("nutritional_metabolic"),
  );
  check(
    "2回実行で ID 同一",
    once.informationCards[0]?.id === twice.informationCards[0]?.id &&
      once.assessmentCards[0]?.id === twice.assessmentCards[0]?.id,
  );
  check(
    "カード枚数も同一（重複なし）",
    once.informationCards.length === twice.informationCards.length &&
      once.assessmentCards.length === twice.assessmentCards.length,
  );
  check("v1Backup.patientId は元のまま", once.v1Backup?.patientId === "OLD");
  check("上書き patientId", once.patientId === PATIENT);
  check(
    "Final へ v1 を自動転記しない",
    once.finalForm.nutritional_metabolic.informationSO === "" &&
      once.finalForm.nutritional_metabolic.interpretationAnalysisCareNeed ===
        "" &&
      !("relatedInformation" in once.finalForm.nutritional_metabolic) &&
      !("judgment" in once.finalForm.nutritional_metabolic) &&
      !("isReviewed" in once.finalForm.nutritional_metabolic),
  );
  check(
    "v1_final_mapping_unresolved warning",
    once.migration?.warnings.some(
      (w) =>
        w.code === "v1_final_mapping_unresolved" &&
        w.patternKey === "nutritional_metabolic",
    ) === true,
  );
  check(
    "isReviewed → workspacePatternFlags.isOrganized",
    once.workspacePatternFlags?.nutritional_metabolic?.isOrganized === true,
  );
  check(
    "isReviewed 移動 warning",
    once.migration?.warnings.some(
      (w) => w.code === "v1_is_reviewed_moved_to_workspace_flags",
    ) === true,
  );
  check(
    "single card warning",
    once.migration?.warnings.some(
      (w) => w.code === "v1_information_preserved_as_single_card",
    ) === true,
  );
  check(
    "Assess に judgment/根拠/他関連/追加情報が退避",
    once.assessmentCards[0]?.classification === "problem" &&
      once.assessmentCards[0]?.needMoreInformation === "体重推移" &&
      (once.assessmentCards[0]?.interpretation.includes("低栄養が疑われる") ??
        false) &&
      (once.assessmentCards[0]?.interpretation.includes("摂取量減少") ??
        false) &&
      (once.assessmentCards[0]?.interpretation.includes("活動パターンと関連") ??
        false),
  );
  // 元 v1 非破壊
  check(
    "元 v1 非破壊",
    filled.patterns.nutritional_metabolic.relatedInformation ===
      "食欲低下と体重減少" &&
      filled.patterns.nutritional_metabolic.isReviewed === true,
  );

  const again = migrateForm3V1ToV2(once, PATIENT, {
    now: "2099-01-01T00:00:00.000Z",
  });
  check(
    "既 v2 再 migrate でカード増えない",
    again.informationCards.length === once.informationCards.length,
  );
  check(
    "既 v2 再 migrate で migratedAt を書き換えない",
    again.migration?.migratedAt === once.migration?.migratedAt,
  );
}

// ── Sanitize: 不明根拠・Archive 根拠・Final 旧キー無視 ──
{
  const { data, warnings } = sanitizeForm3V2Payload(
    {
      schemaVersion: 2,
      patientId: PATIENT,
      informationCards: [
        sampleInfo({ id: "alive", status: "active" }),
        sampleInfo({ id: "dead", status: "archived", content: "旧" }),
      ],
      assessmentCards: [
        {
          id: "ax",
          interpretation: "低栄養状態が疑われる",
          classification: "not_a_real_judgment",
          evidenceInformationIds: ["alive", "dead", "ghost"],
          needMoreInformation: "",
          patternKey: "nutritional_metabolic",
          order: 0,
          status: "draft",
          createdAt: FIXED_NOW,
          updatedAt: FIXED_NOW,
        },
      ],
      finalForm: {
        nutritional_metabolic: {
          relatedInformation: "旧v1欄は無視",
          interpretation: "旧解釈は無視",
          judgment: "problem",
          isReviewed: true,
          informationSO: "学校欄のみ",
          interpretationAnalysisCareNeed: "",
        },
      },
      workspacePatternFlags: {
        nutritional_metabolic: { isOrganized: true },
      },
    },
    PATIENT,
  );
  check(
    "ghost 根拠除去",
    data.assessmentCards[0]?.evidenceInformationIds.includes("ghost") === false,
  );
  check(
    "archive 根拠は残す",
    data.assessmentCards[0]?.evidenceInformationIds.includes("dead") === true,
  );
  check(
    "archived_evidence_reference warning",
    warnings.some((w) => w.code === "archived_evidence_reference"),
  );
  check(
    "invalid_reference_removed warning",
    warnings.some((w) => w.code === "invalid_reference_removed"),
  );
  check(
    "不正 classification→null",
    data.assessmentCards[0]?.classification === null,
  );
  check(
    "Final は学校欄のみ採用（旧キー無視）",
    data.finalForm.nutritional_metabolic.informationSO === "学校欄のみ" &&
      data.finalForm.nutritional_metabolic.interpretationAnalysisCareNeed ===
        "" &&
      !("isReviewed" in data.finalForm.nutritional_metabolic) &&
      !("judgment" in data.finalForm.nutritional_metabolic),
  );
  check(
    "Final progress in_progress（1欄のみ）",
    getForm3FinalPatternProgressV2(data.finalForm.nutritional_metabolic) ===
      "in_progress",
  );
  check(
    "workspacePatternFlags 保持",
    data.workspacePatternFlags?.nutritional_metabolic?.isOrganized === true,
  );
}

// ── Final progress completed ──
{
  check(
    "Final empty",
    getForm3FinalPatternProgressV2({
      informationSO: "",
      interpretationAnalysisCareNeed: "",
    }) === "empty",
  );
  check(
    "Final completed（両欄）",
    getForm3FinalPatternProgressV2({
      informationSO: "S/O",
      interpretationAnalysisCareNeed: "解釈と援助",
    }) === "completed",
  );
}

// ── careNeed 非保持 ──
{
  const { data } = sanitizeForm3V2Payload(
    {
      schemaVersion: 2,
      patientId: PATIENT,
      informationCards: [],
      assessmentCards: [
        {
          id: "c1",
          interpretation: "x",
          classification: null,
          evidenceInformationIds: [],
          needMoreInformation: "",
          patternKey: "sleep_rest",
          order: 0,
          status: "draft",
          careNeed: "援助が必要",
        },
      ],
      finalForm: {},
    },
    PATIENT,
  );
  check(
    "Assessment に careNeed を持たない",
    !("careNeed" in (data.assessmentCards[0] as object)),
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
  `\n===== form3 Phase B1: ${checks.length - failed.length} OK / ${failed.length} FAIL / ${checks.length} total =====`,
);
process.exit(failed.length === 0 ? 0 : 1);
