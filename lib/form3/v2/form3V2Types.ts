// Form3 Phase B — schemaVersion 2 ドメイン型（純データ）。
// 正本: docs/version3/11_form3_phase_b_implementation_plan.md
// Final 項目の学校正本根拠: docs/version2/source/form3_source_notes.md
// DB 楽観ロック列 version とは別物。

import {
  FORM3_JUDGMENTS,
  FORM3_PATTERN_KEYS,
  type Form3Data,
  type Form3Judgment,
  type Form3PatternKey,
} from "../form3Types";

export const FORM3_SCHEMA_VERSION_V2 = 2 as const;

export type Form3SoType = "S" | "O";

/** Information の情報源（S/O とは直交） */
export const FORM3_INFORMATION_SOURCE_TYPES = [
  "patient_conversation",
  "family_conversation",
  "nursing_record",
  "physician_record",
  "chart",
  "laboratory",
  "vital",
  "observation",
  "medication",
  "treatment",
  "student_observation",
  "other",
] as const;

export type Form3InformationSourceType =
  (typeof FORM3_INFORMATION_SOURCE_TYPES)[number];

export type Form3InformationCardStatus = "active" | "archived";

/**
 * Assessment Card の作業状態（Workspace）。
 * Submission（提出確定）とは別。
 * Final Artifact の学校欄とも別。
 */
export type Form3AssessmentCardStatus = "draft" | "reviewed" | "archived";

export type Form3SourceReference = {
  kind: "fixture" | "manual" | "db" | "migration";
  sourceType?: Form3InformationSourceType;
  sourceRecordId?: string;
  path?: string;
  note?: string;
};

export type Form3InformationCardV2 = {
  id: string;
  content: string;
  soType: Form3SoType | null;
  sourceType: Form3InformationSourceType;
  sourceReference?: Form3SourceReference;
  sourceLabel?: string;
  observedAt?: string;
  patternKeys: Form3PatternKey[];
  order: number;
  status: Form3InformationCardStatus;
  createdAt: string;
  updatedAt: string;
  migratedFromV1?: boolean;
  /**
   * 移行由来の安定キー（payload 内冪等・将来テーブル昇格時の突合用）。
   * id とは別。id は payload スコープの決定的 ID または UUID。
   */
  stableMigrationKey?: string;
};

export type Form3AssessmentCardV2 = {
  id: string;
  interpretation: string;
  classification: Form3Judgment | null;
  evidenceInformationIds: string[];
  needMoreInformation: string;
  patternKey: Form3PatternKey | null;
  order: number;
  status: Form3AssessmentCardStatus;
  createdAt: string;
  updatedAt: string;
  migratedFromV1?: boolean;
  stableMigrationKey?: string;
};

/**
 * 学校指定様式3（Word）から確認できた見出しのみ。
 * 根拠: docs/version2/source/form3_source_notes.md
 *   - 情報（Ｓ・Ｏ）
 *   - 解釈・分析・援助の必要性
 *
 * v1 Workspace の7フィールド（judgment / isReviewed 等）とは分離する。
 * パターン全体の単一 judgment・isReviewed は Final に置かない。
 * careNeed は独立フィールドにせず、interpretationAnalysisCareNeed 文中に学生が書く。
 */
export type Form3FinalPatternV2 = {
  /** 学校指定: 情報（Ｓ・Ｏ） */
  informationSO: string;
  /** 学校指定: 解釈・分析・援助の必要性 */
  interpretationAnalysisCareNeed: string;
};

export type Form3FinalFormV2 = Record<Form3PatternKey, Form3FinalPatternV2>;

/**
 * Workspace 用の整理フラグ（Artifact / Submission ではない）。
 * v1 isReviewed の移行先。Final には載せない。
 */
export type Form3WorkspacePatternFlags = {
  /** パターン単位の「整理済み」（提出ではない） */
  isOrganized: boolean;
};

export type Form3MigrationWarningCode =
  | "v1_information_preserved_as_single_card"
  | "v1_assessment_preserved_as_single_card"
  | "v1_final_mapping_unresolved"
  | "v1_is_reviewed_moved_to_workspace_flags"
  | "archived_evidence_reference"
  | "invalid_reference_removed"
  | "duplicate_information_id_renamed"
  | "duplicate_assessment_id_renamed"
  | "invalid_classification_cleared"
  | "invalid_pattern_removed"
  | "invalid_source_type_normalized"
  | "invalid_so_type_normalized";

export type Form3MigrationWarning = {
  code: Form3MigrationWarningCode;
  message: string;
  patternKey?: Form3PatternKey;
  cardId?: string;
};

export type Form3MigrationMetadata = {
  migratedFromSchemaVersion: 1;
  /** 注入可能。冪等テストでは固定値を渡す */
  migratedAt: string;
  warnings: Form3MigrationWarning[];
};

export type Form3DataV2 = {
  schemaVersion: typeof FORM3_SCHEMA_VERSION_V2;
  patientId: string;
  informationCards: Form3InformationCardV2[];
  assessmentCards: Form3AssessmentCardV2[];
  finalForm: Form3FinalFormV2;
  /**
   * Workspace 付帯（Final / Submission ではない）。
   * v1 isReviewed の受け皿。
   */
  workspacePatternFlags?: Partial<
    Record<Form3PatternKey, Form3WorkspacePatternFlags>
  >;
  migration?: Form3MigrationMetadata;
  /** 移行監査用。再変換の冪等判定にも使用 */
  v1Backup?: Form3Data;
  updatedAt: string;
};

export type Form3Payload = Form3Data | Form3DataV2;

export function isForm3InformationSourceType(
  value: string,
): value is Form3InformationSourceType {
  return (FORM3_INFORMATION_SOURCE_TYPES as readonly string[]).includes(value);
}

export function isForm3SoType(value: string): value is Form3SoType {
  return value === "S" || value === "O";
}

export function isForm3DataV1(value: unknown): value is Form3Data {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    v.schemaVersion === 1 &&
    typeof v.patientId === "string" &&
    v.patterns !== null &&
    typeof v.patterns === "object"
  );
}

export function isForm3DataV2(value: unknown): value is Form3DataV2 {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    v.schemaVersion === 2 &&
    typeof v.patientId === "string" &&
    Array.isArray(v.informationCards) &&
    Array.isArray(v.assessmentCards) &&
    v.finalForm !== null &&
    typeof v.finalForm === "object"
  );
}

export function createEmptyForm3FinalPattern(): Form3FinalPatternV2 {
  return {
    informationSO: "",
    interpretationAnalysisCareNeed: "",
  };
}

export function createEmptyForm3FinalForm(): Form3FinalFormV2 {
  const finalForm = {} as Form3FinalFormV2;
  for (const key of FORM3_PATTERN_KEYS) {
    finalForm[key] = createEmptyForm3FinalPattern();
  }
  return finalForm;
}

export { FORM3_JUDGMENTS, FORM3_PATTERN_KEYS };
export type { Form3Judgment, Form3PatternKey, Form3Data };
