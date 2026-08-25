// Compass Version 2.2 Sprint 5B-2 — AI評価 result / request の版定数

export const AI_EVAL_PACKAGE_SCHEMA_VERSION = 1 as const;
export const AI_EVAL_RESULT_SCHEMA_VERSION = 1 as const;
export const AI_EVAL_COMPASS_POLICY_VERSION = "2026.1" as const;
export const AI_EVAL_RUBRIC_VERSION = "1" as const;
export const AI_EVAL_REQUEST_TTL_DAYS = 90 as const;

export const AI_EVAL_SUPPORTED_PACKAGE_SCHEMA_VERSIONS: readonly number[] = [1];
export const AI_EVAL_SUPPORTED_RESULT_SCHEMA_VERSIONS: readonly number[] = [1];

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
