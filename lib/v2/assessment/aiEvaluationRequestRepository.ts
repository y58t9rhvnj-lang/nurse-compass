import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiEvalRequestSnapshot } from "@/lib/v2/assessment/aiEvaluationResultValidate";

export type AiEvaluationRequestInsert = {
  organizationId: string;
  assessmentSubmissionId: string;
  assessmentCycleId: string;
  assessmentMilestoneId: string;
  studentUserId: string;
  evaluationRequestId: string;
  packageSchemaVersion: number;
  resultSchemaVersion: number;
  compassPolicyVersion: string;
  rubricVersion: string;
  goldStandardVersion: string;
  caseVersion: string;
  exportSchemaVersion: number;
  packageHash: string;
  anonymousSubmissionId: string;
  generatedAt: string;
  generatedBy: string;
  expiresAt: string;
};

function mapRequest(r: Record<string, unknown>): AiEvalRequestSnapshot {
  const statusRaw = String(r.status ?? "generated");
  const status =
    statusRaw === "used" || statusRaw === "expired" ? statusRaw : "generated";
  return {
    id: String(r.id),
    organizationId: String(r.organization_id),
    assessmentSubmissionId: String(r.assessment_submission_id),
    assessmentCycleId: String(r.assessment_cycle_id),
    assessmentMilestoneId: String(r.assessment_milestone_id),
    studentUserId: String(r.student_user_id),
    evaluationRequestId: String(r.evaluation_request_id),
    packageSchemaVersion: Number(r.package_schema_version),
    resultSchemaVersion: Number(r.result_schema_version),
    compassPolicyVersion: String(r.compass_policy_version),
    rubricVersion: String(r.rubric_version),
    goldStandardVersion: String(r.gold_standard_version),
    caseVersion: String(r.case_version),
    exportSchemaVersion: Number(r.export_schema_version),
    status,
    expiresAt: String(r.expires_at),
    usedAt: typeof r.used_at === "string" ? r.used_at : null,
  };
}

export async function insertAiEvaluationRequest(
  admin: SupabaseClient,
  input: AiEvaluationRequestInsert,
): Promise<
  | { ok: true; row: AiEvalRequestSnapshot }
  | { ok: false; kind: "conflict" | "db_error"; message: string }
> {
  const { data, error } = await admin
    .from("assessment_ai_evaluation_requests")
    .insert({
      organization_id: input.organizationId,
      assessment_submission_id: input.assessmentSubmissionId,
      assessment_cycle_id: input.assessmentCycleId,
      assessment_milestone_id: input.assessmentMilestoneId,
      student_user_id: input.studentUserId,
      evaluation_request_id: input.evaluationRequestId,
      package_schema_version: input.packageSchemaVersion,
      result_schema_version: input.resultSchemaVersion,
      compass_policy_version: input.compassPolicyVersion,
      rubric_version: input.rubricVersion,
      gold_standard_version: input.goldStandardVersion,
      case_version: input.caseVersion,
      export_schema_version: input.exportSchemaVersion,
      package_hash: input.packageHash,
      anonymous_submission_id: input.anonymousSubmissionId,
      generated_at: input.generatedAt,
      generated_by: input.generatedBy,
      expires_at: input.expiresAt,
      status: "generated",
      used_at: null,
    })
    .select("*")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        kind: "conflict",
        message: "評価リクエストの記録が競合しました。",
      };
    }
    return {
      ok: false,
      kind: "db_error",
      message: "評価リクエストを記録できませんでした。",
    };
  }
  if (!data) {
    return {
      ok: false,
      kind: "db_error",
      message: "評価リクエストを記録できませんでした。",
    };
  }
  return { ok: true, row: mapRequest(data as Record<string, unknown>) };
}

export async function getAiEvaluationRequestByEvalId(
  admin: SupabaseClient,
  evaluationRequestId: string,
): Promise<
  | { ok: true; row: AiEvalRequestSnapshot | null }
  | { ok: false; kind: "db_error"; message: string }
> {
  const { data, error } = await admin
    .from("assessment_ai_evaluation_requests")
    .select("*")
    .eq("evaluation_request_id", evaluationRequestId)
    .maybeSingle();
  if (error) {
    return {
      ok: false,
      kind: "db_error",
      message: "評価リクエストを読み込めませんでした。",
    };
  }
  if (!data) return { ok: true, row: null };
  return { ok: true, row: mapRequest(data as Record<string, unknown>) };
}

export async function markAiEvaluationRequestUsed(
  admin: SupabaseClient,
  input: { requestId: string; usedAt: string },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data, error } = await admin
    .from("assessment_ai_evaluation_requests")
    .update({
      status: "used",
      used_at: input.usedAt,
    })
    .eq("id", input.requestId)
    .eq("status", "generated")
    .select("id")
    .maybeSingle();
  if (error) {
    return { ok: false, message: "リクエスト状態を更新できませんでした。" };
  }
  // 既に used でも取込自体は続行可
  if (!data) return { ok: true };
  return { ok: true };
}
