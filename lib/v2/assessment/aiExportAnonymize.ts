// Compass Version 2.2 Sprint 5A — AI連携用匿名化エクスポート DTO
//
// 外部出力に organization_id / user_id / 氏名 / ログインID / メールを含めない。
// case / cycle / milestone / submission の実 ID は匿名 ID へ変換する。
// cycle_title / milestone_title は「課題N」「評価時点N」へ置換する。
// 自由記述は明確な PII パターンのみマスキング（臨床内容は過度に削除しない）。

import { createHmac } from "crypto";
import type { Form2Data } from "@/lib/form2/form2Types";
import type { Form3DataV2 } from "@/lib/form3/v2/form3V2Types";
import type { SnapshotReadModelOk } from "./snapshotReadModel";

export const AI_EXPORT_SCHEMA_VERSION = 1 as const;

/** 出力前確認ダイアログ用の定型警告（UI と共有） */
export const AI_EXPORT_FREE_TEXT_WARNING =
  "自由記述には個人情報が残る可能性があります。メール・電話・学籍番号など明確な表記はマスキングしますが、人名や文脈依存の個人情報は完全には除去できません。";

export type AiExportIdKind =
  | "case"
  | "cycle"
  | "milestone"
  | "submission"
  | "card"
  | "link"
  | "reflection";

export type AiAnonymousIdMapper = {
  map: (kind: AiExportIdKind, rawId: string) => string;
};

/** サーバー側シークレットから、組織内で安定した匿名 ID マッパーを作る。 */
export function createAiAnonymousIdMapper(
  secret: string,
  organizationScopeKey: string,
): AiAnonymousIdMapper {
  const cache = new Map<string, string>();
  return {
    map(kind, rawId) {
      const key = `${kind}:${rawId}`;
      const hit = cache.get(key);
      if (hit) return hit;
      const digest = createHmac("sha256", secret)
        .update(`${organizationScopeKey}|${kind}|${rawId}`)
        .digest("hex")
        .slice(0, 16);
      const prefix =
        kind === "case"
          ? "case"
          : kind === "cycle"
            ? "cyc"
            : kind === "milestone"
              ? "ms"
              : kind === "submission"
                ? "sub"
                : kind === "card"
                  ? "card"
                  : kind === "link"
                    ? "lnk"
                    : "ref";
      const anon = `${prefix}_${digest}`;
      cache.set(key, anon);
      return anon;
    },
  };
}

/** エクスポートバッチ内で安定した表示ラベル（課題N / 評価時点N） */
export type AiTitleLabelMapper = {
  cycleTitle: (cycleId: string) => string;
  milestoneTitle: (milestoneId: string) => string;
};

export function createAiTitleLabelMapper(): AiTitleLabelMapper {
  const cycles = new Map<string, number>();
  const milestones = new Map<string, number>();
  return {
    cycleTitle(cycleId) {
      let n = cycles.get(cycleId);
      if (n == null) {
        n = cycles.size + 1;
        cycles.set(cycleId, n);
      }
      return `課題${n}`;
    },
    milestoneTitle(milestoneId) {
      let n = milestones.get(milestoneId);
      if (n == null) {
        n = milestones.size + 1;
        milestones.set(milestoneId, n);
      }
      return `評価時点${n}`;
    },
  };
}

/**
 * 明確な PII パターンのみマスキング。
 * 人名の網羅的推定は誤変換リスクが高いため行わない。
 * ※ ID 文字列には適用しないこと（自由記述フィールド専用）。
 */
export function maskObviousPiiInText(text: string): string {
  if (!text) return text;
  let s = text;

  // メール
  s = s.replace(
    /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
    "[EMAIL]",
  );

  // 電話（日本の一般的書式）
  s = s.replace(
    /(?:\+?81[- ]?)?0\d{1,4}[-−–]?\d{1,4}[-−–]?\d{3,4}/g,
    "[PHONE]",
  );

  // 学籍番号・個人ID のラベル付き
  s = s.replace(
    /(?:学籍番号|学番|学生番号|個人ID|ログインID|login\s*id)[：:\s]*[A-Za-z0-9_\-]{2,32}/gi,
    "[STUDENT_ID]",
  );
  // S001 / s123456 等の短い学籍風トークン（単語境界）
  s = s.replace(/\b[Ss]\d{3,10}\b/g, "[STUDENT_ID]");

  // 氏名ラベル付き（ラベル直後のみ。本文中の一般語は触らない）
  s = s.replace(
    /(?:氏名|名前|学生名|フルネーム)[：:\s]*[^\s、。，,\n]{1,20}/g,
    "[NAME]",
  );

  // イニシャル（A.T. / A・T / A.T）
  s = s.replace(
    /\b[A-Za-z](?:\s*[.．・]\s*[A-Za-z])+\.?/g,
    "[INITIALS]",
  );

  return s;
}

/** マスキング禁止キー（値・配下をそのまま保持） */
const NEVER_MASK_KEYS = new Set([
  "anonymous_ids",
  "patientId",
  "case_ref",
  "case_id",
  "cycle_id",
  "milestone_id",
  "submission_id",
  "id",
  "evidenceInformationIds",
  "informationCardId",
  "information_card_id",
  "patternKey",
  "patternKeys",
  "sourceType",
  "soType",
  "schemaVersion",
  "schema_version",
  "version",
  "createdAt",
  "created_at",
  "updatedAt",
  "updated_at",
  "submitted_at",
  "submittedAt",
  "timing_status",
  "evaluation_type",
  "milestone_type",
  "submission_number",
  "export_kind",
  "source_versions",
  "included_artifacts",
  "form2FieldKey",
  "form2_field_key",
  "fieldKey",
  "age",
  "sex",
]);

/** 自由記述としてマスキングするキー（これ以外の文字列は触らない） */
const FREE_TEXT_KEYS = new Set([
  "content",
  "overview_text",
  "overviewText",
  "reflection_text",
  "reflectionText",
  "diagnosis",
  "pastHistory",
  "chiefComplaint",
  "admissionType",
  "developmentalHistory",
  "familyBackground",
  "schoolHistory",
  "employmentHistory",
  "beforeOnset",
  "subsequentCourse",
  "currentAdmissionCourse",
  "currentCondition",
  "currentLife",
  "firstAdmission",
  "insight",
  "medicationRecognition",
  "dischargeThoughts",
  "policy",
  "goal",
  "medication",
  "program",
  "policyAndContent",
  "interpretation",
  "classification",
  "needMoreInformation",
  "informationSO",
  "interpretationAnalysisCareNeed",
  "sourceLabel",
  "sourceReference",
  "patientName",
  "note",
  "notes",
  "comment",
  "text",
  "body",
  "message",
  "description",
  "title",
]);

/**
 * 自由記述フィールドの値だけを再帰マスキングする。
 * JSON 全体の文字列化置換は行わない。ID 系キーは絶対に触らない。
 */
export function maskFreeTextFieldsDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    // 配列要素は親キー文脈なしでオブジェクトならキー判定、文字列なら触らない
    return value.map((item) => {
      if (typeof item === "string") return item;
      return maskFreeTextFieldsDeep(item);
    });
  }
  if (!isRecord(value)) return value;

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (NEVER_MASK_KEYS.has(k)) {
      out[k] = v;
      continue;
    }
    if (typeof v === "string") {
      out[k] = FREE_TEXT_KEYS.has(k) ? maskObviousPiiInText(v) : v;
      continue;
    }
    out[k] = maskFreeTextFieldsDeep(v);
  }
  return out;
}

/** @deprecated 全文字列マスキングは ID を壊すため使用禁止。互換のため free-text 版へ委譲 */
export function maskObviousPiiDeep(value: unknown): unknown {
  return maskFreeTextFieldsDeep(value);
}

const FORBIDDEN_KEY =
  /^(organization_id|organizationId|user_id|userId|student_user_id|studentUserId|student_ref|studentRef|created_by|createdBy|updated_by|updatedBy|login_id|loginId|email|display_name|displayName|student_number|studentNumber|student_name|studentName|password|token|cookie)$/i;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** オブジェクトから禁止キーを再帰除去。配列はそのまま走査。 */
export function stripForbiddenKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripForbiddenKeys);
  }
  if (!isRecord(value)) return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (FORBIDDEN_KEY.test(k)) continue;
    out[k] = stripForbiddenKeys(v);
  }
  return out;
}

function anonymizeForm2(
  form2: Form2Data,
  anonCaseId: string,
): Record<string, unknown> {
  const base = {
    version: form2.version,
    patientId: anonCaseId,
    student: {},
    period: {
      start: form2.period?.start ?? "",
      end: form2.period?.end ?? "",
    },
    basicInformation: {
      patientName: "",
      age: form2.basicInformation?.age ?? "",
      sex: form2.basicInformation?.sex ?? "",
      diagnosis: form2.basicInformation?.diagnosis ?? "",
      pastHistory: form2.basicInformation?.pastHistory ?? "",
      admissionType: form2.basicInformation?.admissionType ?? "",
      chiefComplaint: form2.basicInformation?.chiefComplaint ?? "",
    },
    history: form2.history ?? {},
    treatment: form2.treatment ?? {},
    updatedAt: form2.updatedAt ?? "",
  };
  return maskFreeTextFieldsDeep(base) as Record<string, unknown>;
}

function anonymizeForm3(
  form3: Form3DataV2,
  anonCaseId: string,
  ids: AiAnonymousIdMapper,
): Record<string, unknown> {
  const informationCards = (form3.informationCards ?? []).map((card) => {
    const raw = stripForbiddenKeys(card) as Record<string, unknown>;
    if (typeof raw.id === "string" && raw.id) {
      raw.id = ids.map("card", raw.id);
    }
    return raw;
  });
  const assessmentCards = (form3.assessmentCards ?? []).map((card) => {
    const raw = stripForbiddenKeys(card) as Record<string, unknown>;
    if (typeof raw.id === "string" && raw.id) {
      raw.id = ids.map("card", raw.id);
    }
    if (Array.isArray(raw.evidenceInformationIds)) {
      raw.evidenceInformationIds = raw.evidenceInformationIds.map((id) =>
        typeof id === "string" ? ids.map("card", id) : id,
      );
    }
    return raw;
  });
  return maskFreeTextFieldsDeep(
    stripForbiddenKeys({
      schemaVersion: form3.schemaVersion,
      patientId: anonCaseId,
      updatedAt: form3.updatedAt,
      informationCards,
      assessmentCards,
      finalForm: form3.finalForm,
      workspacePatternFlags: form3.workspacePatternFlags,
    }),
  ) as Record<string, unknown>;
}

function anonymizeInformationCards(
  cards: Array<Record<string, unknown>>,
  ids: AiAnonymousIdMapper,
): Array<Record<string, unknown>> {
  return cards.map((card) => {
    const raw = stripForbiddenKeys(card) as Record<string, unknown>;
    const id =
      typeof raw.id === "string"
        ? raw.id
        : typeof raw.information_card_id === "string"
          ? raw.information_card_id
          : null;
    if (id) {
      raw.id = ids.map("card", id);
      delete raw.information_card_id;
    }
    return maskFreeTextFieldsDeep(raw) as Record<string, unknown>;
  });
}

function anonymizeEvidenceLinks(
  links: Array<Record<string, unknown>>,
  ids: AiAnonymousIdMapper,
): Array<Record<string, unknown>> {
  return links.map((link) => {
    const raw = stripForbiddenKeys(link) as Record<string, unknown>;
    const linkId =
      typeof raw.id === "string"
        ? raw.id
        : typeof raw.evidence_id === "string"
          ? raw.evidence_id
          : null;
    if (linkId) {
      raw.id = ids.map("link", linkId);
      delete raw.evidence_id;
    }
    const cardId =
      typeof raw.information_card_id === "string"
        ? raw.information_card_id
        : typeof raw.informationCardId === "string"
          ? raw.informationCardId
          : null;
    if (cardId) {
      raw.informationCardId = ids.map("card", cardId);
      delete raw.information_card_id;
    }
    return maskFreeTextFieldsDeep(raw) as Record<string, unknown>;
  });
}

function anonymizeFieldReflections(
  rows: Array<Record<string, unknown>>,
  ids: AiAnonymousIdMapper,
): Array<Record<string, unknown>> {
  return rows.map((row) => {
    const raw = stripForbiddenKeys(row) as Record<string, unknown>;
    if (typeof raw.id === "string" && raw.id) {
      raw.id = ids.map("reflection", raw.id);
    }
    return maskFreeTextFieldsDeep(raw) as Record<string, unknown>;
  });
}

/**
 * form3 内のカード id と evidenceInformationIds の参照が一致するか検証。
 */
export function assertCardIdReferencesIntact(
  form3: Record<string, unknown> | null,
): { ok: true } | { ok: false; missing: string[] } {
  if (!form3) return { ok: true };
  const info = Array.isArray(form3.informationCards)
    ? form3.informationCards
    : [];
  const assessments = Array.isArray(form3.assessmentCards)
    ? form3.assessmentCards
    : [];
  const idSet = new Set<string>();
  for (const card of info) {
    if (isRecord(card) && typeof card.id === "string") idSet.add(card.id);
  }
  for (const card of assessments) {
    if (isRecord(card) && typeof card.id === "string") idSet.add(card.id);
  }
  const missing: string[] = [];
  for (const card of assessments) {
    if (!isRecord(card) || !Array.isArray(card.evidenceInformationIds)) continue;
    for (const ref of card.evidenceInformationIds) {
      if (typeof ref !== "string") continue;
      if (ref.includes("[PHONE]") || ref.includes("[EMAIL]")) {
        missing.push(ref);
        continue;
      }
      if (!idSet.has(ref)) missing.push(ref);
    }
  }
  if (missing.length > 0) return { ok: false, missing };
  return { ok: true };
}

export type AiExportSourceIds = {
  caseId: string;
  cycleId: string;
  milestoneId: string;
  submissionId: string;
};

export type AiAnonymizedAssessmentRecord = {
  schema_version: typeof AI_EXPORT_SCHEMA_VERSION;
  export_kind: "assessment_submission";
  anonymous_ids: {
    case_id: string;
    cycle_id: string;
    milestone_id: string;
    submission_id: string;
  };
  meta: {
    timing_status: string | null;
    submission_number: number | null;
    submitted_at: string | null;
    evaluation_type: string | null;
    milestone_type: string | null;
    /** 外部出力用匿名ラベル（例: 課題1） */
    cycle_title: string | null;
    /** 外部出力用匿名ラベル（例: 評価時点1） */
    milestone_title: string | null;
  };
  included_artifacts: string[];
  form2: Record<string, unknown> | null;
  form3: Record<string, unknown> | null;
  information_cards: Array<Record<string, unknown>>;
  evidence_links: Array<Record<string, unknown>>;
  field_reflections: Array<Record<string, unknown>>;
  patient_understanding: {
    case_ref: string;
    overview_text: string;
    updated_at: string | null;
  } | null;
  source_versions: {
    form2: number | null;
    form3: number | null;
    patient_understanding: string | null;
  };
};

export type BuildAiRecordInput = {
  ids: AiAnonymousIdMapper;
  titles: AiTitleLabelMapper;
  sourceIds: AiExportSourceIds;
  readModel: SnapshotReadModelOk;
  timingStatus?: string | null;
  submissionNumber?: number | null;
};

export function buildAiAnonymizedAssessmentRecord(
  input: BuildAiRecordInput,
): AiAnonymizedAssessmentRecord {
  const { ids, titles, sourceIds, readModel } = input;
  const anonCase = ids.map("case", sourceIds.caseId);
  const anonCycle = ids.map("cycle", sourceIds.cycleId);
  const anonMilestone = ids.map("milestone", sourceIds.milestoneId);
  const anonSubmission = ids.map("submission", sourceIds.submissionId);

  const overview = readModel.patientUnderstanding?.overviewText ?? "";
  return {
    schema_version: AI_EXPORT_SCHEMA_VERSION,
    export_kind: "assessment_submission",
    anonymous_ids: {
      case_id: anonCase,
      cycle_id: anonCycle,
      milestone_id: anonMilestone,
      submission_id: anonSubmission,
    },
    meta: {
      timing_status: input.timingStatus ?? null,
      submission_number: input.submissionNumber ?? null,
      submitted_at: readModel.submittedAt || null,
      evaluation_type: readModel.evaluationType,
      milestone_type: readModel.milestoneType,
      cycle_title: titles.cycleTitle(sourceIds.cycleId),
      milestone_title: titles.milestoneTitle(sourceIds.milestoneId),
    },
    included_artifacts: [...readModel.includedArtifacts],
    form2: readModel.form2
      ? anonymizeForm2(readModel.form2, anonCase)
      : null,
    form3: readModel.form3
      ? anonymizeForm3(readModel.form3, anonCase, ids)
      : null,
    information_cards: anonymizeInformationCards(
      readModel.informationCards,
      ids,
    ),
    evidence_links: anonymizeEvidenceLinks(
      readModel.form2EvidenceLinks,
      ids,
    ),
    field_reflections: anonymizeFieldReflections(
      readModel.fieldReflections,
      ids,
    ),
    patient_understanding: readModel.patientUnderstanding
      ? {
          case_ref: anonCase,
          overview_text: maskObviousPiiInText(overview),
          updated_at: readModel.patientUnderstanding.updatedAt,
        }
      : null,
    source_versions: {
      form2: readModel.sourceVersions.form2,
      form3: readModel.sourceVersions.form3,
      patient_understanding: readModel.sourceVersions.patientUnderstanding,
    },
  };
}

export type AiExportEnvelope = {
  schema_version: typeof AI_EXPORT_SCHEMA_VERSION;
  format: "json" | "jsonl";
  exported_at: string;
  record_count: number;
  included_artifacts: string[];
  records?: AiAnonymizedAssessmentRecord[];
};

export function buildJsonExportDocument(
  records: AiAnonymizedAssessmentRecord[],
  exportedAt: string,
): AiExportEnvelope {
  const included = new Set<string>();
  for (const r of records) {
    for (const a of r.included_artifacts) included.add(a);
  }
  return {
    schema_version: AI_EXPORT_SCHEMA_VERSION,
    format: "json",
    exported_at: exportedAt,
    record_count: records.length,
    included_artifacts: [...included].sort((a, b) => a.localeCompare(b, "ja")),
    records,
  };
}

export function buildJsonlExportText(
  records: AiAnonymizedAssessmentRecord[],
): string {
  return (
    records.map((r) => JSON.stringify(r)).join("\n") +
    (records.length ? "\n" : "")
  );
}

export function summarizeIncludedArtifacts(
  records: AiAnonymizedAssessmentRecord[],
): string[] {
  const included = new Set<string>();
  for (const r of records) {
    for (const a of r.included_artifacts) included.add(a);
  }
  return [...included].sort((a, b) => a.localeCompare(b, "ja"));
}
