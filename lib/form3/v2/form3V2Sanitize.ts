// Form3 Phase B — sanitizeForm3V2Payload（非破壊・正規化＋warnings）

import {
  FORM3_JUDGMENTS,
  FORM3_PATTERN_KEYS,
  isForm3Judgment,
  isForm3PatternKey,
  type Form3Judgment,
  type Form3PatternKey,
} from "../form3Types";
import { createEmptyForm3V2, createForm3CardId } from "./form3V2Factory";
import {
  FORM3_INFORMATION_SOURCE_TYPES,
  FORM3_SCHEMA_VERSION_V2,
  createEmptyForm3FinalForm,
  createEmptyForm3FinalPattern,
  isForm3InformationSourceType,
  isForm3SoType,
  type Form3AssessmentCardStatus,
  type Form3AssessmentCardV2,
  type Form3DataV2,
  type Form3FinalFormV2,
  type Form3FinalPatternV2,
  type Form3InformationCardStatus,
  type Form3InformationCardV2,
  type Form3InformationSourceType,
  type Form3MigrationMetadata,
  type Form3MigrationWarning,
  type Form3SoType,
  type Form3SourceReference,
  type Form3WorkspacePatternFlags,
} from "./form3V2Types";

export type SanitizeForm3V2Result = {
  data: Form3DataV2;
  warnings: Form3MigrationWarning[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asFiniteInt(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return Math.trunc(n);
  }
  return fallback;
}

function normalizeSoType(
  value: unknown,
  warnings: Form3MigrationWarning[],
  cardId?: string,
): Form3SoType | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    warnings.push({
      code: "invalid_so_type_normalized",
      message: "soType を null に正規化しました。",
      cardId,
    });
    return null;
  }
  if (isForm3SoType(value)) return value;
  const lower = value.toLowerCase();
  if (lower === "subjective" || lower === "s") return "S";
  if (lower === "objective" || lower === "o") return "O";
  warnings.push({
    code: "invalid_so_type_normalized",
    message: `不正な soType (${value}) を null にしました。`,
    cardId,
  });
  return null;
}

const SOURCE_ALIASES: Record<string, Form3InformationSourceType> = {
  lab: "laboratory",
  labs: "laboratory",
  conversation: "patient_conversation",
  family: "family_conversation",
  migration: "other",
};

function normalizeSourceType(
  value: unknown,
  warnings: Form3MigrationWarning[],
  cardId?: string,
): Form3InformationSourceType {
  if (typeof value === "string") {
    if (isForm3InformationSourceType(value)) return value;
    const alias = SOURCE_ALIASES[value.toLowerCase()];
    if (alias) {
      warnings.push({
        code: "invalid_source_type_normalized",
        message: `sourceType ${value} を ${alias} に正規化しました。`,
        cardId,
      });
      return alias;
    }
  }
  warnings.push({
    code: "invalid_source_type_normalized",
    message: "不正な sourceType を other にしました。",
    cardId,
  });
  return "other";
}

function normalizePatternKeys(
  value: unknown,
  warnings: Form3MigrationWarning[],
  cardId?: string,
): Form3PatternKey[] {
  if (!Array.isArray(value)) return [];
  const out: Form3PatternKey[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    if (!isForm3PatternKey(item)) {
      warnings.push({
        code: "invalid_pattern_removed",
        message: `不正な patternKey (${item}) を除去しました。`,
        cardId,
      });
      continue;
    }
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

function normalizePatternKey(
  value: unknown,
  warnings: Form3MigrationWarning[],
  cardId?: string,
): Form3PatternKey | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string" && isForm3PatternKey(value)) return value;
  warnings.push({
    code: "invalid_pattern_removed",
    message: `不正な patternKey を null にしました。`,
    cardId,
  });
  return null;
}

function normalizeClassification(
  value: unknown,
  warnings: Form3MigrationWarning[],
  cardId?: string,
): Form3Judgment | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string" && isForm3Judgment(value)) return value;
  warnings.push({
    code: "invalid_classification_cleared",
    message: `不正な classification を null にしました。`,
    cardId,
  });
  return null;
}

function normalizeInfoStatus(value: unknown): Form3InformationCardStatus {
  return value === "archived" ? "archived" : "active";
}

function normalizeAssessStatus(value: unknown): Form3AssessmentCardStatus {
  if (value === "reviewed" || value === "archived" || value === "draft") {
    return value;
  }
  if (value === "active") return "draft";
  return "draft";
}

function normalizeSourceReference(
  value: unknown,
): Form3SourceReference | undefined {
  const rec = asRecord(value);
  if (!rec) return undefined;
  const kind = asString(rec.kind, "manual");
  if (
    kind !== "fixture" &&
    kind !== "manual" &&
    kind !== "db" &&
    kind !== "migration"
  ) {
    return undefined;
  }
  const out: Form3SourceReference = { kind };
  if (typeof rec.sourceType === "string" && isForm3InformationSourceType(rec.sourceType)) {
    out.sourceType = rec.sourceType;
  }
  if (typeof rec.sourceRecordId === "string") out.sourceRecordId = rec.sourceRecordId;
  if (typeof rec.path === "string") out.path = rec.path;
  if (typeof rec.note === "string") out.note = rec.note;
  return out;
}

function sanitizeFinalPattern(raw: unknown): Form3FinalPatternV2 {
  const empty = createEmptyForm3FinalPattern();
  const rec = asRecord(raw);
  if (!rec) return empty;
  // 学校指定2欄のみ。v1 の relatedInformation / judgment 等は読まない。
  return {
    informationSO: asString(rec.informationSO),
    interpretationAnalysisCareNeed: asString(
      rec.interpretationAnalysisCareNeed,
    ),
  };
}

function sanitizeWorkspacePatternFlags(
  raw: unknown,
): Form3DataV2["workspacePatternFlags"] {
  const rec = asRecord(raw);
  if (!rec) return undefined;
  const out: Partial<Record<Form3PatternKey, Form3WorkspacePatternFlags>> = {};
  for (const key of FORM3_PATTERN_KEYS) {
    const p = asRecord(rec[key]);
    if (!p) continue;
    if (p.isOrganized === true) {
      out[key] = { isOrganized: true };
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function sanitizeFinalForm(raw: unknown): Form3FinalFormV2 {
  const base = createEmptyForm3FinalForm();
  const rec = asRecord(raw);
  if (!rec) return base;
  for (const key of Object.keys(base) as Form3PatternKey[]) {
    if (key in rec) {
      base[key] = sanitizeFinalPattern(rec[key]);
    }
  }
  return base;
}

function uniqueId(
  preferred: string,
  used: Set<string>,
  warnings: Form3MigrationWarning[],
  code: Form3MigrationWarning["code"],
): string {
  const preferredId = preferred.trim() || createForm3CardId();
  if (!used.has(preferredId)) {
    used.add(preferredId);
    return preferredId;
  }
  const renamed = createForm3CardId();
  warnings.push({
    code,
    message: `重複 ID (${preferred}) を ${renamed} に振り直しました。`,
    cardId: renamed,
  });
  used.add(renamed);
  return renamed;
}

/**
 * v2 payload を正規化。元オブジェクトは破壊しない。
 * patientId は検証済み値で上書き。
 */
export function sanitizeForm3V2Payload(
  raw: unknown,
  patientId: string,
): SanitizeForm3V2Result {
  const warnings: Form3MigrationWarning[] = [];
  const empty = createEmptyForm3V2(patientId);
  const root = asRecord(raw);

  if (!root) {
    return { data: empty, warnings };
  }

  const infoUsed = new Set<string>();
  const informationCards: Form3InformationCardV2[] = [];
  const rawInfos = Array.isArray(root.informationCards) ? root.informationCards : [];

  rawInfos.forEach((item, index) => {
    const rec = asRecord(item);
    if (!rec) return;
    const id = uniqueId(
      asString(rec.id),
      infoUsed,
      warnings,
      "duplicate_information_id_renamed",
    );
    informationCards.push({
      id,
      content: asString(rec.content),
      soType: normalizeSoType(rec.soType, warnings, id),
      sourceType: normalizeSourceType(rec.sourceType, warnings, id),
      sourceReference: normalizeSourceReference(rec.sourceReference),
      sourceLabel:
        typeof rec.sourceLabel === "string" ? rec.sourceLabel : undefined,
      observedAt:
        typeof rec.observedAt === "string" ? rec.observedAt : undefined,
      patternKeys: normalizePatternKeys(rec.patternKeys, warnings, id),
      order: asFiniteInt(rec.order, index),
      status: normalizeInfoStatus(rec.status),
      createdAt: asString(rec.createdAt),
      updatedAt: asString(rec.updatedAt),
      migratedFromV1: rec.migratedFromV1 === true ? true : undefined,
      stableMigrationKey:
        typeof rec.stableMigrationKey === "string" &&
        rec.stableMigrationKey.trim() !== ""
          ? rec.stableMigrationKey
          : undefined,
    });
  });

  const infoById = new Map(informationCards.map((c) => [c.id, c]));
  const assessUsed = new Set<string>();
  const assessmentCards: Form3AssessmentCardV2[] = [];
  const rawAssess = Array.isArray(root.assessmentCards) ? root.assessmentCards : [];

  rawAssess.forEach((item, index) => {
    const rec = asRecord(item);
    if (!rec) return;
    const id = uniqueId(
      asString(rec.id),
      assessUsed,
      warnings,
      "duplicate_assessment_id_renamed",
    );
    const evidenceRaw = Array.isArray(rec.evidenceInformationIds)
      ? rec.evidenceInformationIds
      : [];
    const evidenceInformationIds: string[] = [];
    const seenEv = new Set<string>();
    for (const ev of evidenceRaw) {
      if (typeof ev !== "string" || ev.trim() === "") continue;
      if (seenEv.has(ev)) continue;
      seenEv.add(ev);
      const target = infoById.get(ev);
      if (!target) {
        warnings.push({
          code: "invalid_reference_removed",
          message: `存在しない Information ID (${ev}) の参照を除去しました。`,
          cardId: id,
        });
        continue;
      }
      if (target.status === "archived") {
        warnings.push({
          code: "archived_evidence_reference",
          message: `Archive 済み Information (${ev}) を根拠参照しています。`,
          cardId: id,
        });
        // 消さず残す
      }
      evidenceInformationIds.push(ev);
    }

    assessmentCards.push({
      id,
      interpretation: asString(rec.interpretation),
      classification: normalizeClassification(rec.classification, warnings, id),
      evidenceInformationIds,
      needMoreInformation: asString(rec.needMoreInformation),
      patternKey: normalizePatternKey(rec.patternKey, warnings, id),
      order: asFiniteInt(rec.order, index),
      status: normalizeAssessStatus(rec.status),
      createdAt: asString(rec.createdAt),
      updatedAt: asString(rec.updatedAt),
      migratedFromV1: rec.migratedFromV1 === true ? true : undefined,
      stableMigrationKey:
        typeof rec.stableMigrationKey === "string" &&
        rec.stableMigrationKey.trim() !== ""
          ? rec.stableMigrationKey
          : undefined,
    });
  });

  let migration: Form3MigrationMetadata | undefined;
  const migRec = asRecord(root.migration);
  if (migRec) {
    migration = {
      migratedFromSchemaVersion: 1,
      migratedAt: asString(migRec.migratedAt),
      warnings: Array.isArray(migRec.warnings)
        ? (migRec.warnings as Form3MigrationWarning[])
        : [],
    };
  }

  const workspacePatternFlags = sanitizeWorkspacePatternFlags(
    root.workspacePatternFlags,
  );

  const data: Form3DataV2 = {
    schemaVersion: FORM3_SCHEMA_VERSION_V2,
    patientId,
    informationCards,
    assessmentCards,
    finalForm: sanitizeFinalForm(root.finalForm),
    workspacePatternFlags,
    migration,
    v1Backup:
      root.v1Backup && typeof root.v1Backup === "object"
        ? (structuredClone(root.v1Backup) as Form3DataV2["v1Backup"])
        : undefined,
    updatedAt: asString(root.updatedAt),
  };

  return { data, warnings };
}

/** テスト・デバッグ用に公開 */
export const FORM3_V2_SOURCE_TYPE_COUNT = FORM3_INFORMATION_SOURCE_TYPES.length;
export const FORM3_V2_JUDGMENT_COUNT = FORM3_JUDGMENTS.length;
