import "server-only";

import { createAdminSupabaseClient } from "@/lib/v2/supabase/adminClient";
import { isServiceRoleConfigured } from "@/lib/v2/env.server";

export type WriteAiExportAuditInput = {
  organizationId: string;
  actorUserId: string;
  actorLoginId: string;
  actorRole: "teacher" | "admin";
  milestoneId: string | null;
  format: "json" | "jsonl";
  recordCount: number;
  includedArtifacts: string[];
  summary: string;
  metadata?: Record<string, unknown>;
};

export type AiExportAuditResult =
  | { ok: true; auditLogId: string }
  | { ok: false; errorCode: "not_configured" | "insert_failed" };

/**
 * AI 匿名化エクスポートの監査を1件記録する。
 * 提出本文・学生氏名・ログインID一覧は metadata に含めないこと。
 */
export async function writeAiExportAuditLog(
  input: WriteAiExportAuditInput,
): Promise<AiExportAuditResult> {
  if (!isServiceRoleConfigured()) {
    return { ok: false, errorCode: "not_configured" };
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("assessment_ai_export_audit_logs")
    .insert({
      organization_id: input.organizationId,
      actor_user_id: input.actorUserId,
      actor_login_id: input.actorLoginId,
      actor_role: input.actorRole,
      action: "assessment.ai_export",
      milestone_id: input.milestoneId,
      format: input.format,
      record_count: input.recordCount,
      included_artifacts: input.includedArtifacts,
      summary: input.summary,
      metadata: input.metadata ?? {},
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[aiExportAudit] failed to insert audit log");
    return { ok: false, errorCode: "insert_failed" };
  }

  return { ok: true, auditLogId: String(data.id) };
}
