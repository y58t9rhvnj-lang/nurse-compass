/**
 * AI評価 Import の純関数（DB / server-only 非依存）
 * preview / execute が共有する validation 経路。
 */

import {
  validateAiEvaluationResult,
  type AiEvalIssue,
  type AiEvalRequestSnapshot,
  type AiEvalValidateOutcome,
  type AiEvalWarning,
} from "@/lib/v2/assessment/aiEvaluationResultValidate";

export type AiEvaluationImportPreview = {
  fileName: string;
  evaluationRequestId: string | null;
  validationStatus: "ok" | "warning" | "invalid";
  reviewStatus: "invalid" | "needs_review";
  resultHash: string | null;
  errors: AiEvalIssue[];
  versionWarnings: AiEvalWarning[];
  piiWarnings: AiEvalWarning[];
  requestFound: boolean;
  requestExpired: boolean;
};

/**
 * request 照合前後の検証（DB 非依存）。
 */
export function runAiEvaluationImportValidation(input: {
  jsonText: string;
  organizationId: string;
  request: AiEvalRequestSnapshot | null;
  requestLookup: "found" | "missing" | "skipped";
}): {
  preliminary: AiEvalValidateOutcome;
  validated: AiEvalValidateOutcome;
  requestExpired: boolean;
} {
  const preliminary = validateAiEvaluationResult({
    source: input.jsonText,
    actorOrganizationId: input.organizationId,
    requestLookup: "skipped",
  });
  const validated = validateAiEvaluationResult({
    source: preliminary.raw ?? input.jsonText,
    actorOrganizationId: input.organizationId,
    request: input.request,
    requestLookup: input.requestLookup,
  });
  const requestExpired =
    !!input.request &&
    (input.request.status === "expired" ||
      new Date(input.request.expiresAt).getTime() <= Date.now());
  return { preliminary, validated, requestExpired };
}

export function buildAiEvaluationImportPreview(input: {
  fileName: string;
  validated: AiEvalValidateOutcome;
  requestFound: boolean;
  requestExpired: boolean;
}): AiEvaluationImportPreview {
  return {
    fileName: input.fileName || "result.json",
    evaluationRequestId: input.validated.evaluationRequestId,
    validationStatus: input.validated.validationStatus,
    reviewStatus: input.validated.reviewStatus,
    resultHash: input.validated.resultHash,
    errors: input.validated.errors,
    versionWarnings: input.validated.versionWarnings,
    piiWarnings: input.validated.piiWarnings,
    requestFound: input.requestFound,
    requestExpired: input.requestExpired,
  };
}
