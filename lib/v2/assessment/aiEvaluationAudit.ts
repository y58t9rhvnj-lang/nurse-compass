import "server-only";

import { createAdminSupabaseClient } from "@/lib/v2/supabase/adminClient";
import { isServiceRoleConfigured } from "@/lib/v2/env.server";

export type WriteAiEvaluationAuditInput = {
  organizationId: string;
  actorUserId: string;
  actorLoginId: string;
  actorRole: "teacher" | "admin" | "system";
  action: string;
  assessmentSubmissionId?: string | null;
  stagingId?: string | null;
  requestId?: string | null;
  evaluationRequestId?: string | null;
  resultHash?: string | null;
  packageSchemaVersion?: number | null;
  resultSchemaVersion?: number | null;
  compassPolicyVersion?: string | null;
  rubricVersion?: string | null;
  goldStandardVersion?: string | null;
  caseVersion?: string | null;
  exportSchemaVersion?: number | null;
  selectionSummary?: Record<string, unknown>;
  summary: string;
  metadata?: Record<string, unknown>;
};

/**
 * AI評価 staging 監査。本文全文・提出本文・氏名は入れないこと。
 */
export async function writeAiEvaluationAuditLog(
  input: WriteAiEvaluationAuditInput,
): Promise<{ ok: true; id: string } | { ok: false; errorCode: string }> {
  if (!isServiceRoleConfigured()) {
    return { ok: false, errorCode: "not_configured" };
  }
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("assessment_ai_evaluation_audit_logs")
    .insert({
      organization_id: input.organizationId,
      actor_user_id: input.actorUserId,
      actor_login_id: input.actorLoginId,
      actor_role: input.actorRole,
      action: input.action,
      assessment_submission_id: input.assessmentSubmissionId ?? null,
      staging_id: input.stagingId ?? null,
      request_id: input.requestId ?? null,
      evaluation_request_id: input.evaluationRequestId ?? null,
      result_hash: input.resultHash ?? null,
      package_schema_version: input.packageSchemaVersion ?? null,
      result_schema_version: input.resultSchemaVersion ?? null,
      compass_policy_version: input.compassPolicyVersion ?? null,
      rubric_version: input.rubricVersion ?? null,
      gold_standard_version: input.goldStandardVersion ?? null,
      case_version: input.caseVersion ?? null,
      export_schema_version: input.exportSchemaVersion ?? null,
      selection_summary: input.selectionSummary ?? {},
      summary: input.summary,
      metadata: input.metadata ?? {},
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[aiEvaluationAudit] insert failed");
    return { ok: false, errorCode: "insert_failed" };
  }
  return { ok: true, id: String(data.id) };
}
