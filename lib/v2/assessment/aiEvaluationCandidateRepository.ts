import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiEvalIssue, AiEvalWarning } from "./aiEvaluationResultValidate";

export type AiEvaluationStagingFullRow = {
  id: string;
  organizationId: string;
  requestId: string;
  evaluationRequestId: string;
  assessmentSubmissionId: string;
  assessmentCycleId: string;
  assessmentMilestoneId: string;
  studentUserId: string;
  packageSchemaVersion: number;
  resultSchemaVersion: number;
  compassPolicyVersion: string;
  rubricVersion: string;
  goldStandardVersion: string;
  caseVersion: string;
  exportSchemaVersion: number;
  normalizedResultJson: unknown;
  resultHash: string;
  validationStatus: string;
  validationErrors: AiEvalIssue[];
  versionWarnings: AiEvalWarning[];
  piiWarnings: AiEvalWarning[];
  reviewStatus: string;
  sourceModel: string | null;
  sourceProvider: string | null;
  promptVersion: string | null;
  importedAt: string;
  teacherDraftOverlayJson: unknown;
};

const FULL_SELECT = [
  "id",
  "organization_id",
  "request_id",
  "evaluation_request_id",
  "assessment_submission_id",
  "assessment_cycle_id",
  "assessment_milestone_id",
  "student_user_id",
  "package_schema_version",
  "result_schema_version",
  "compass_policy_version",
  "rubric_version",
  "gold_standard_version",
  "case_version",
  "export_schema_version",
  "normalized_result_json",
  "result_hash",
  "validation_status",
  "validation_errors",
  "version_warnings",
  "pii_warnings",
  "review_status",
  "source_model",
  "source_provider",
  "prompt_version",
  "imported_at",
  "teacher_draft_overlay_json",
].join(", ");

function asWarnings(
  raw: unknown,
  columnFamily: "version" | "pii",
): AiEvalWarning[] {
  if (!Array.isArray(raw)) return [];
  const out: AiEvalWarning[] = [];
  for (const w of raw) {
    if (!w || typeof w !== "object") continue;
    const o = w as Record<string, unknown>;
    if (
      typeof o.code !== "string" ||
      typeof o.message !== "string" ||
      typeof o.payload_hash !== "string"
    ) {
      continue;
    }
    // Column implies family; tolerate rows that omit it (or mismatch).
    const family =
      o.family === "version" || o.family === "pii" ? o.family : columnFamily;
    const rawPayload = o.payload ?? o.details;
    const payload =
      rawPayload && typeof rawPayload === "object" && !Array.isArray(rawPayload)
        ? (rawPayload as Record<string, unknown>)
        : {};
    out.push({
      family,
      code: o.code,
      message: o.message,
      payload,
      payload_hash: o.payload_hash,
    });
  }
  return out;
}

function asIssues(raw: unknown): AiEvalIssue[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((e): e is AiEvalIssue => {
    if (!e || typeof e !== "object") return false;
    const o = e as Record<string, unknown>;
    return typeof o.code === "string" && typeof o.message === "string";
  });
}

function mapFull(r: Record<string, unknown>): AiEvaluationStagingFullRow {
  return {
    id: String(r.id),
    organizationId: String(r.organization_id),
    requestId: String(r.request_id),
    evaluationRequestId: String(r.evaluation_request_id),
    assessmentSubmissionId: String(r.assessment_submission_id),
    assessmentCycleId: String(r.assessment_cycle_id),
    assessmentMilestoneId: String(r.assessment_milestone_id),
    studentUserId: String(r.student_user_id),
    packageSchemaVersion: Number(r.package_schema_version),
    resultSchemaVersion: Number(r.result_schema_version),
    compassPolicyVersion: String(r.compass_policy_version),
    rubricVersion: String(r.rubric_version),
    goldStandardVersion: String(r.gold_standard_version),
    caseVersion: String(r.case_version),
    exportSchemaVersion: Number(r.export_schema_version),
    normalizedResultJson: r.normalized_result_json,
    resultHash: String(r.result_hash),
    validationStatus: String(r.validation_status),
    validationErrors: asIssues(r.validation_errors),
    versionWarnings: asWarnings(r.version_warnings, "version"),
    piiWarnings: asWarnings(r.pii_warnings, "pii"),
    reviewStatus: String(r.review_status),
    sourceModel: typeof r.source_model === "string" ? r.source_model : null,
    sourceProvider:
      typeof r.source_provider === "string" ? r.source_provider : null,
    promptVersion:
      typeof r.prompt_version === "string" ? r.prompt_version : null,
    importedAt: String(r.imported_at),
    teacherDraftOverlayJson: r.teacher_draft_overlay_json,
  };
}

/** staff SELECT（RLS）。raw_result_json は取得しない。 */
export async function getActiveAiEvaluationStagingForSubmission(
  supabase: SupabaseClient,
  organizationId: string,
  submissionId: string,
): Promise<
  | { ok: true; row: AiEvaluationStagingFullRow | null }
  | { ok: false; message: string }
> {
  const { data, error } = await supabase
    .from("assessment_ai_evaluation_staging")
    .select(FULL_SELECT)
    .eq("organization_id", organizationId)
    .eq("assessment_submission_id", submissionId)
    .in("review_status", ["needs_review", "partially_adopted"])
    .order("imported_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    return { ok: false, message: "AI評価候補を読み込めませんでした。" };
  }
  if (!data) return { ok: true, row: null };
  return { ok: true, row: mapFull(data as Record<string, unknown>) };
}

export async function listAiEvaluationStagingHistoryForSubmission(
  supabase: SupabaseClient,
  organizationId: string,
  submissionId: string,
): Promise<
  | {
      ok: true;
      rows: Array<{
        id: string;
        reviewStatus: string;
        validationStatus: string;
        importedAt: string;
        resultHash: string;
      }>;
    }
  | { ok: false; message: string }
> {
  const { data, error } = await supabase
    .from("assessment_ai_evaluation_staging")
    .select("id, review_status, validation_status, imported_at, result_hash")
    .eq("organization_id", organizationId)
    .eq("assessment_submission_id", submissionId)
    .in("review_status", [
      "adopted",
      "rejected",
      "superseded",
      "invalid",
      "needs_review",
      "partially_adopted",
    ])
    .order("imported_at", { ascending: false })
    .limit(20);
  if (error) {
    return { ok: false, message: "AI評価履歴を読み込めませんでした。" };
  }
  return {
    ok: true,
    rows: ((data ?? []) as Record<string, unknown>[]).map((r) => ({
      id: String(r.id),
      reviewStatus: String(r.review_status),
      validationStatus: String(r.validation_status),
      importedAt: String(r.imported_at),
      resultHash: String(r.result_hash),
    })),
  };
}

export async function countAdoptionsForStaging(
  supabase: SupabaseClient,
  stagingId: string,
): Promise<{ ok: true; count: number } | { ok: false; message: string }> {
  const { count, error } = await supabase
    .from("assessment_ai_evaluation_adoptions")
    .select("id", { count: "exact", head: true })
    .eq("staging_id", stagingId);
  if (error) {
    return { ok: false, message: "採用履歴を確認できませんでした。" };
  }
  return { ok: true, count: count ?? 0 };
}
