// Compass Version2.1 — 様式3（ゴードンの11の機能的健康パターン）ドメイン型。
//
// 方針（docs/version2/18_form3_design.md）:
//   ・1レコード + jsonb payload を前提としたクライアント側スキーマ。
//   ・DB 列 version（楽観ロック）とは別に、payload 内は schemaVersion を使う。
//   ・11パターンは配列ではなく固定キーの Record。表示順は FORM3_PATTERN_ORDER。
//   ・様式2からの転記用フィールドは持たない。

export const FORM3_SCHEMA_VERSION = 1 as const;

/** 安定キー（DB・UI・進捗の正本）。表示名は form3PatternDefinitions 側 */
export const FORM3_PATTERN_KEYS = [
  "health_perception_management",
  "nutritional_metabolic",
  "elimination",
  "activity_exercise",
  "sleep_rest",
  "cognitive_perceptual",
  "self_perception_self_concept",
  "role_relationship",
  "sexuality_reproductive",
  "coping_stress_tolerance",
  "value_belief",
] as const;

export type Form3PatternKey = (typeof FORM3_PATTERN_KEYS)[number];

/** 表示・ナビ用の固定順（キー配列と同順） */
export const FORM3_PATTERN_ORDER: readonly Form3PatternKey[] = FORM3_PATTERN_KEYS;

export type Form3Judgment =
  | "functioning_normally"
  | "strength"
  | "problem"
  | "risk"
  | "insufficient_information";

export const FORM3_JUDGMENTS: readonly Form3Judgment[] = [
  "functioning_normally",
  "strength",
  "problem",
  "risk",
  "insufficient_information",
] as const;

export type Form3PatternData = {
  relatedInformation: string;
  interpretation: string;
  crossPatternRelations: string;
  judgment: Form3Judgment | null;
  judgmentRationale: string;
  additionalInformationNeeded: string;
  /** 学生が「整理済み」としたか。完了条件を満たすときのみ true を許可する想定 */
  isReviewed: boolean;
};

export type Form3Patterns = Record<Form3PatternKey, Form3PatternData>;

export type Form3Data = {
  schemaVersion: typeof FORM3_SCHEMA_VERSION;
  patientId: string;
  patterns: Form3Patterns;
  /** ISO。未保存時は "" */
  updatedAt: string;
};

/** 静的ガイド（コード同梱。DBに持たない） */
export type Form3PatternDefinition = {
  key: Form3PatternKey;
  labelJa: string;
  definition: string;
  assessmentPerspectives: string[];
  informationChecklist: string[];
};

/**
 * パターン単位の進捗。
 * 入力文字数では判定しない（空／入力あり／判断と根拠の関係／整理済みフラグで判定）。
 */
export type Form3PatternProgress =
  | "not_started"
  | "in_progress"
  | "needs_rationale"
  | "reviewed"
  | "reviewed_insufficient";

/** 空の1パターン（毎回新しいオブジェクト） */
export function createEmptyForm3PatternData(): Form3PatternData {
  return {
    relatedInformation: "",
    interpretation: "",
    crossPatternRelations: "",
    judgment: null,
    judgmentRationale: "",
    additionalInformationNeeded: "",
    isReviewed: false,
  };
}

/**
 * 空の様式3データ。
 * 11キーすべてを独立オブジェクトで埋める（共有参照による副作用を防ぐ）。
 */
export function createEmptyForm3(patientId: string): Form3Data {
  const patterns = {} as Form3Patterns;
  for (const key of FORM3_PATTERN_KEYS) {
    patterns[key] = createEmptyForm3PatternData();
  }
  return {
    schemaVersion: FORM3_SCHEMA_VERSION,
    patientId,
    patterns,
    updatedAt: "",
  };
}

export function isForm3PatternKey(value: string): value is Form3PatternKey {
  return (FORM3_PATTERN_KEYS as readonly string[]).includes(value);
}

export function isForm3Judgment(value: string): value is Form3Judgment {
  return (FORM3_JUDGMENTS as readonly string[]).includes(value);
}
