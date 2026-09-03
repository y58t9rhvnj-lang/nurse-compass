// Compass Version 2.2 Sprint 5B-2 — AI評価 result / request の版定数

export const AI_EVAL_PACKAGE_SCHEMA_VERSION = 1 as const;
export const AI_EVAL_RESULT_SCHEMA_VERSION = 1 as const;

/** Form2 政策（02 / 2026.4）。既存定数名・値は後方互換のため維持。 */
export const AI_EVAL_FORM2_COMPASS_POLICY_VERSION = "2026.4" as const;

/** Form3 政策（07 / 2026.5）。 */
export const AI_EVAL_FORM3_COMPASS_POLICY_VERSION = "2026.5" as const;

/**
 * Form2 向け既定 policy version（後方互換エイリアス）。
 * 既存 Form2 package / request / テストが参照する。値は常に 2026.4。
 */
export const AI_EVAL_COMPASS_POLICY_VERSION =
  AI_EVAL_FORM2_COMPASS_POLICY_VERSION;

export const AI_EVAL_RUBRIC_VERSION = "3" as const;
export const AI_EVAL_REQUEST_TTL_DAYS = 90 as const;

export const AI_EVAL_SUPPORTED_PACKAGE_SCHEMA_VERSIONS: readonly number[] = [1];
export const AI_EVAL_SUPPORTED_RESULT_SCHEMA_VERSIONS: readonly number[] = [1];

export type AiEvalCompassPolicyVersion =
  | typeof AI_EVAL_FORM2_COMPASS_POLICY_VERSION
  | typeof AI_EVAL_FORM3_COMPASS_POLICY_VERSION;

/**
 * Form3 AI 評価政策を適用する milestone。
 * （DB enum は form2 / form3_progress / form3_complete / final / custom）
 */
export function isForm3AiEvalMilestone(
  milestoneType: string | null | undefined,
): boolean {
  return (
    milestoneType === "form3_progress" || milestoneType === "form3_complete"
  );
}

/**
 * milestone_type → compass_policy_version。
 * form3_* のみ 2026.5。それ以外（form2 / final / custom / 欠落 / 別名）は 2026.4。
 *
 * 注: ユーザー仕様の form2_progress / form2_complete は現行 DB enum に無いが、
 * Form2 政策への安全なエイリアスとして 2026.4 に解決する。
 */
export function resolveAiEvalCompassPolicyVersion(
  milestoneType: string | null | undefined,
): AiEvalCompassPolicyVersion {
  if (isForm3AiEvalMilestone(milestoneType)) {
    return AI_EVAL_FORM3_COMPASS_POLICY_VERSION;
  }
  return AI_EVAL_FORM2_COMPASS_POLICY_VERSION;
}

export function isSupportedAiEvalPackageSchemaVersion(v: number): boolean {
  return AI_EVAL_SUPPORTED_PACKAGE_SCHEMA_VERSIONS.indexOf(v) !== -1;
}

export function isSupportedAiEvalResultSchemaVersion(v: number): boolean {
  return AI_EVAL_SUPPORTED_RESULT_SCHEMA_VERSIONS.indexOf(v) !== -1;
}

/** 症例キー → Gold / case version（安定 key） */
export function aiEvalCaseVersionsForPatientId(patientId: string): {
  goldStandardVersion: string;
  caseVersion: string;
  caseKey: string;
} {
  const key = `patient-${patientId.trim().toLowerCase() || "a"}`;
  const version = `${key}/1`;
  return {
    caseKey: key,
    goldStandardVersion: version,
    caseVersion: version,
  };
}
