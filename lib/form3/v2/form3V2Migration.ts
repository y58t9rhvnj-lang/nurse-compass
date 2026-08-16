// Form3 Phase B — v1 → v2 移行純関数（非破壊・冪等）
//
// Final Artifact には、学校様式として資料確認済みの項目以外を自動転記しない。
// v1 の7フィールドは Card / v1Backup / workspacePatternFlags へ退避する。

import {
  FORM3_PATTERN_KEYS,
  type Form3Data,
  type Form3PatternData,
  type Form3PatternKey,
} from "../form3Types";
import {
  createEmptyForm3V2,
  migrationForm3AssessmentId,
  migrationForm3InformationId,
  migrationStableKeyAssess,
  migrationStableKeyInfo,
} from "./form3V2Factory";
import {
  FORM3_SCHEMA_VERSION_V2,
  isForm3DataV2,
  type Form3AssessmentCardV2,
  type Form3DataV2,
  type Form3InformationCardV2,
  type Form3MigrationMetadata,
  type Form3MigrationWarning,
  type Form3WorkspacePatternFlags,
} from "./form3V2Types";

export type MigrateForm3V1ToV2Options = {
  /** 固定時刻注入（テスト用）。省略時は new Date().toISOString() */
  now?: string;
};

function cloneV1(data: Form3Data): Form3Data {
  return structuredClone(data);
}

function patternHasAnyV1Content(p: Form3PatternData): boolean {
  return (
    p.relatedInformation.trim() !== "" ||
    p.interpretation.trim() !== "" ||
    p.crossPatternRelations.trim() !== "" ||
    p.judgmentRationale.trim() !== "" ||
    p.additionalInformationNeeded.trim() !== "" ||
    p.judgment !== null ||
    p.isReviewed === true
  );
}

function buildAssessmentInterpretation(p: Form3PatternData): string {
  const parts: string[] = [];
  if (p.interpretation.trim()) parts.push(p.interpretation.trim());
  if (p.judgmentRationale.trim()) {
    parts.push(`【判断の根拠】\n${p.judgmentRationale.trim()}`);
  }
  if (p.crossPatternRelations.trim()) {
    parts.push(`【他パターンとの関連】\n${p.crossPatternRelations.trim()}`);
  }
  return parts.join("\n\n");
}

/**
 * schemaVersion 1 → 2。
 * - 自動細分割しない
 * - v1Backup 保持
 * - 決定的 migration ID（payload スコープ）で冪等
 * - Final へ v1 7項目を自動転記しない（学校見出しの対応が未確定なため）
 * - 既に v2 ならそのまま返す
 */
export function migrateForm3V1ToV2(
  input: Form3Data | Form3DataV2,
  patientId: string,
  options: MigrateForm3V1ToV2Options = {},
): Form3DataV2 {
  if (isForm3DataV2(input)) {
    return {
      ...input,
      patientId,
      schemaVersion: FORM3_SCHEMA_VERSION_V2,
    };
  }

  const v1 = cloneV1(input);
  const now = options.now ?? new Date().toISOString();
  const warnings: Form3MigrationWarning[] = [];
  const informationCards: Form3InformationCardV2[] = [];
  const assessmentCards: Form3AssessmentCardV2[] = [];
  const finalForm = createEmptyForm3V2(patientId).finalForm;
  const workspacePatternFlags: Partial<
    Record<Form3PatternKey, Form3WorkspacePatternFlags>
  > = {};

  let orderInfo = 0;
  let orderAssess = 0;

  for (const key of FORM3_PATTERN_KEYS) {
    const pattern = v1.patterns[key] ?? {
      relatedInformation: "",
      interpretation: "",
      crossPatternRelations: "",
      judgment: null,
      judgmentRationale: "",
      additionalInformationNeeded: "",
      isReviewed: false,
    };

    // Final は空のまま（学生が学校様式へ再統合）。自動転記しない。
    finalForm[key] = {
      informationSO: "",
      interpretationAnalysisCareNeed: "",
    };

    if (patternHasAnyV1Content(pattern)) {
      warnings.push({
        code: "v1_final_mapping_unresolved",
        message:
          "v1 Workspace 項目と学校指定 Final（情報S・O／解釈・分析・援助の必要性）の自動対応は確定できないため、Final へ転記していません。内容は Card と v1Backup に保持しています。",
        patternKey: key,
      });
    }

    let infoId: string | null = null;
    if (pattern.relatedInformation.trim() !== "") {
      infoId = migrationForm3InformationId(key);
      informationCards.push({
        id: infoId,
        content: pattern.relatedInformation,
        soType: null,
        sourceType: "other",
        sourceReference: {
          kind: "migration",
          note: "form3_v1_relatedInformation",
        },
        sourceLabel: "旧様式3から移行",
        patternKeys: [key],
        order: orderInfo++,
        status: "active",
        createdAt: now,
        updatedAt: now,
        migratedFromV1: true,
        stableMigrationKey: migrationStableKeyInfo(key),
      });
      warnings.push({
        code: "v1_information_preserved_as_single_card",
        message:
          "関連情報の長文を1枚の Information Card として退避しました（自動分割していません）。",
        patternKey: key,
        cardId: infoId,
      });
    }

    const needsAssessment =
      pattern.interpretation.trim() !== "" ||
      pattern.judgment !== null ||
      pattern.judgmentRationale.trim() !== "" ||
      pattern.additionalInformationNeeded.trim() !== "" ||
      pattern.crossPatternRelations.trim() !== "";

    if (needsAssessment) {
      const assessId = migrationForm3AssessmentId(key);
      const interpretation = buildAssessmentInterpretation(pattern);
      assessmentCards.push({
        id: assessId,
        interpretation:
          interpretation ||
          (pattern.judgment
            ? `（移行）判断: ${pattern.judgment}`
            : "（移行）旧様式3の内容"),
        classification: pattern.judgment,
        evidenceInformationIds: infoId ? [infoId] : [],
        needMoreInformation: pattern.additionalInformationNeeded,
        patternKey: key as Form3PatternKey,
        order: orderAssess++,
        status: "draft",
        createdAt: now,
        updatedAt: now,
        migratedFromV1: true,
        stableMigrationKey: migrationStableKeyAssess(key),
      });
      warnings.push({
        code: "v1_assessment_preserved_as_single_card",
        message:
          "解釈・判断等を1枚の Assessment Card として退避しました（カード reviewed / 提出にはしていません）。",
        patternKey: key,
        cardId: assessId,
      });
    }

    if (pattern.isReviewed === true) {
      workspacePatternFlags[key] = { isOrganized: true };
      warnings.push({
        code: "v1_is_reviewed_moved_to_workspace_flags",
        message:
          "v1 isReviewed を workspacePatternFlags.isOrganized へ移しました（Final / Submission ではありません）。",
        patternKey: key,
      });
    }
  }

  const migration: Form3MigrationMetadata = {
    migratedFromSchemaVersion: 1,
    migratedAt: now,
    warnings,
  };

  return {
    schemaVersion: FORM3_SCHEMA_VERSION_V2,
    patientId,
    informationCards,
    assessmentCards,
    finalForm,
    workspacePatternFlags:
      Object.keys(workspacePatternFlags).length > 0
        ? workspacePatternFlags
        : undefined,
    migration,
    v1Backup: v1,
    updatedAt: typeof v1.updatedAt === "string" ? v1.updatedAt : "",
  };
}
