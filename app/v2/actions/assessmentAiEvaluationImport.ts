"use server";

import { isSupabaseConfigured } from "@/lib/v2/env";
import { isServiceRoleConfigured } from "@/lib/v2/env.server";
import { getCurrentProfile, type AppProfile } from "@/lib/v2/auth/currentUser";
import { createServerSupabaseClient } from "@/lib/v2/supabase/serverClient";
import { createAdminSupabaseClient } from "@/lib/v2/supabase/adminClient";
import {
  validateAiEvaluationResult,
  type AiEvalIssue,
  type AiEvalWarning,
} from "@/lib/v2/assessment/aiEvaluationResultValidate";
import { getAiEvaluationRequestByEvalId } from "@/lib/v2/assessment/aiEvaluationRequestRepository";
import { insertStagingThenSupersedeActives } from "@/lib/v2/assessment/aiEvaluationStagingRepository";
import { markAiEvaluationRequestUsed } from "@/lib/v2/assessment/aiEvaluationRequestRepository";
import { writeAiEvaluationAuditLog } from "@/lib/v2/assessment/aiEvaluationAudit";
import type { SupabaseClient } from "@supabase/supabase-js";

type StaffContext =
  | { ok: true; supabase: SupabaseClient; profile: AppProfile }
  | { ok: false; kind: string; message: string };

async function requireStaffContext(): Promise<StaffContext> {
  if (!isSupabaseConfigured()) {
    return { ok: false, kind: "not_configured", message: "backend not configured" };
  }
  const profile = await getCurrentProfile();
  if (
    !profile ||
    !profile.isActive ||
    (profile.role !== "teacher" && profile.role !== "admin")
  ) {
    return { ok: false, kind: "unauthorized", message: "staff login required" };
  }
  const supabase = await createServerSupabaseClient();
  return { ok: true, supabase, profile };
}

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

export type PreviewAiEvaluationImportResult =
  | { ok: true; preview: AiEvaluationImportPreview }
  | { ok: false; kind: string; message: string };

/** 取込前プレビュー（DB 書き込みなし） */
export async function previewAiEvaluationImportAction(input: {
  fileName: string;
  jsonText: string;
}): Promise<PreviewAiEvaluationImportResult> {
  const ctx = await requireStaffContext();
  if (!ctx.ok) return ctx;
  if (!input.jsonText?.trim()) {
    return { ok: false, kind: "validation", message: "JSON が空です。" };
  }
  if (!isServiceRoleConfigured()) {
    return {
      ok: false,
      kind: "not_configured",
      message: "service role が設定されていないため取込できません。",
    };
  }

  const admin = createAdminSupabaseClient();
  const preliminary = validateAiEvaluationResult({
    source: input.jsonText,
    actorOrganizationId: ctx.profile.organizationId,
    requestLookup: "skipped",
  });

  let request = null;
  let requestLookup: "found" | "missing" | "skipped" = "skipped";
  if (preliminary.evaluationRequestId) {
    const got = await getAiEvaluationRequestByEvalId(
      admin,
      preliminary.evaluationRequestId,
    );
    if (!got.ok) {
      return { ok: false, kind: got.kind, message: got.message };
    }
    request = got.row;
    requestLookup = got.row ? "found" : "missing";
  } else {
    requestLookup = "missing";
  }

  const validated = validateAiEvaluationResult({
    source: preliminary.raw ?? input.jsonText,
    actorOrganizationId: ctx.profile.organizationId,
    request,
    requestLookup,
  });

  const requestExpired =
    !!request &&
    (request.status === "expired" ||
      new Date(request.expiresAt).getTime() <= Date.now());

  return {
    ok: true,
    preview: {
      fileName: input.fileName || "result.json",
      evaluationRequestId: validated.evaluationRequestId,
      validationStatus: validated.validationStatus,
      reviewStatus: validated.reviewStatus,
      resultHash: validated.resultHash,
      errors: validated.errors,
      versionWarnings: validated.versionWarnings,
      piiWarnings: validated.piiWarnings,
      requestFound: !!request,
      requestExpired,
    },
  };
}

export type ImportAiEvaluationResult =
  | {
      ok: true;
      stagingId: string;
      reviewStatus: string;
      validationStatus: string;
      evaluationRequestId: string;
      assessmentSubmissionId: string;
      assessmentMilestoneId: string;
      studentUserId: string;
      resultHash: string;
      supersededCount: number;
      auditLogged: boolean;
    }
  | { ok: false; kind: string; message: string };

/** 1ファイル = 1 result を staging へ取込 */
export async function importAiEvaluationResultAction(input: {
  fileName: string;
  jsonText: string;
}): Promise<ImportAiEvaluationResult> {
  const ctx = await requireStaffContext();
  if (!ctx.ok) return ctx;
  if (!input.jsonText?.trim()) {
    return { ok: false, kind: "validation", message: "JSON が空です。" };
  }
  if (!isServiceRoleConfigured()) {
    return {
      ok: false,
      kind: "not_configured",
      message: "service role が設定されていないため取込できません。",
    };
  }

  const admin = createAdminSupabaseClient();
  const actorRole = ctx.profile.role === "admin" ? "admin" : "teacher";

  const preliminary = validateAiEvaluationResult({
    source: input.jsonText,
    actorOrganizationId: ctx.profile.organizationId,
    requestLookup: "skipped",
  });

  if (!preliminary.evaluationRequestId) {
    return {
      ok: false,
      kind: "validation",
      message: "evaluation_request_id を読み取れません。",
    };
  }

  const got = await getAiEvaluationRequestByEvalId(
    admin,
    preliminary.evaluationRequestId,
  );
  if (!got.ok) {
    return { ok: false, kind: got.kind, message: got.message };
  }
  const requestLookup = got.row ? "found" : "missing";
  const validated = validateAiEvaluationResult({
    source: preliminary.raw ?? input.jsonText,
    actorOrganizationId: ctx.profile.organizationId,
    request: got.row,
    requestLookup,
  });

  // parse 不能など request 無しで hash も無い場合は staging 行を作れない
  if (!validated.resultHash || !got.row) {
    await writeAiEvaluationAuditLog({
      organizationId: ctx.profile.organizationId,
      actorUserId: ctx.profile.id,
      actorLoginId: ctx.profile.loginId,
      actorRole,
      action: "assessment.ai_eval.import",
      evaluationRequestId: validated.evaluationRequestId,
      summary: `AI評価取込失敗: ${input.fileName || "result.json"}`,
      metadata: {
        file_name: input.fileName || null,
        error_codes: validated.errors.map((e) => e.code),
      },
    });
    return {
      ok: false,
      kind: validated.errors[0]?.code ?? "validation",
      message:
        validated.errors[0]?.message ??
        "評価リクエストが見つからないか、結果を正規化できません。",
    };
  }

  const req = got.row;

  const { data: studentProfile } = await admin
    .from("profiles")
    .select("exclude_from_assessment, role, is_active")
    .eq("id", req.studentUserId)
    .maybeSingle();
  if (
    studentProfile &&
    (studentProfile as { exclude_from_assessment?: boolean })
      .exclude_from_assessment === true
  ) {
    return {
      ok: false,
      kind: "verification_account_excluded",
      message:
        "検証用アカウントの評価結果は本番 Import staging に取り込めません。",
    };
  }

  const importedAt = new Date().toISOString();
  const supersedeActive = validated.reviewStatus === "needs_review";

  const inserted = await insertStagingThenSupersedeActives(admin, {
    supersedeActive,
    row: {
      organizationId: req.organizationId,
      requestId: req.id,
      evaluationRequestId: req.evaluationRequestId,
      assessmentSubmissionId: req.assessmentSubmissionId,
      assessmentCycleId: req.assessmentCycleId,
      assessmentMilestoneId: req.assessmentMilestoneId,
      studentUserId: req.studentUserId,
      packageSchemaVersion:
        validated.metadata.packageSchemaVersion ?? req.packageSchemaVersion,
      resultSchemaVersion:
        validated.metadata.resultSchemaVersion ?? req.resultSchemaVersion,
      compassPolicyVersion:
        validated.metadata.compassPolicyVersion ?? req.compassPolicyVersion,
      rubricVersion: validated.metadata.rubricVersion ?? req.rubricVersion,
      goldStandardVersion:
        validated.metadata.goldStandardVersion ?? req.goldStandardVersion,
      caseVersion: validated.metadata.caseVersion ?? req.caseVersion,
      exportSchemaVersion:
        validated.metadata.exportSchemaVersion ?? req.exportSchemaVersion,
      rawResultJson: validated.raw,
      normalizedResultJson: validated.normalized,
      resultHash: validated.resultHash,
      validationStatus: validated.validationStatus,
      validationErrors: validated.errors,
      versionWarnings: validated.versionWarnings,
      piiWarnings: validated.piiWarnings,
      reviewStatus: validated.reviewStatus,
      sourceModel: validated.metadata.sourceModel,
      sourceProvider: validated.metadata.sourceProvider,
      promptVersion: validated.metadata.promptVersion,
      importedBy: ctx.profile.id,
      importedAt,
    },
  });

  if (!inserted.ok) {
    return {
      ok: false,
      kind: inserted.kind,
      message: inserted.message,
    };
  }

  if (validated.reviewStatus === "needs_review") {
    await markAiEvaluationRequestUsed(admin, {
      requestId: req.id,
      usedAt: importedAt,
    });
  }

  const auditImport = await writeAiEvaluationAuditLog({
    organizationId: ctx.profile.organizationId,
    actorUserId: ctx.profile.id,
    actorLoginId: ctx.profile.loginId,
    actorRole,
    action: "assessment.ai_eval.import",
    assessmentSubmissionId: req.assessmentSubmissionId,
    stagingId: inserted.staging.id,
    requestId: req.id,
    evaluationRequestId: req.evaluationRequestId,
    resultHash: validated.resultHash,
    packageSchemaVersion: validated.metadata.packageSchemaVersion,
    resultSchemaVersion: validated.metadata.resultSchemaVersion,
    compassPolicyVersion: validated.metadata.compassPolicyVersion,
    rubricVersion: validated.metadata.rubricVersion,
    goldStandardVersion: validated.metadata.goldStandardVersion,
    caseVersion: validated.metadata.caseVersion,
    exportSchemaVersion: validated.metadata.exportSchemaVersion,
    summary: `AI評価取込: ${input.fileName || "result.json"} → ${validated.reviewStatus}`,
    metadata: {
      file_name: input.fileName || null,
      superseded_count: inserted.supersededIds.length,
      // 本文なし
    },
  });

  await writeAiEvaluationAuditLog({
    organizationId: ctx.profile.organizationId,
    actorUserId: ctx.profile.id,
    actorLoginId: ctx.profile.loginId,
    actorRole,
    action: "assessment.ai_eval.validation",
    assessmentSubmissionId: req.assessmentSubmissionId,
    stagingId: inserted.staging.id,
    requestId: req.id,
    evaluationRequestId: req.evaluationRequestId,
    resultHash: validated.resultHash,
    summary: `検証: ${validated.validationStatus}`,
    metadata: {
      validation_status: validated.validationStatus,
      error_codes: validated.errors.map((e) => e.code),
      version_warning_codes: validated.versionWarnings.map((w) => w.code),
      pii_warning_codes: validated.piiWarnings.map((w) => w.code),
    },
  });

  if (inserted.supersededIds.length > 0) {
    await writeAiEvaluationAuditLog({
      organizationId: ctx.profile.organizationId,
      actorUserId: ctx.profile.id,
      actorLoginId: ctx.profile.loginId,
      actorRole,
      action: "assessment.ai_eval.supersede",
      assessmentSubmissionId: req.assessmentSubmissionId,
      stagingId: inserted.staging.id,
      requestId: req.id,
      evaluationRequestId: req.evaluationRequestId,
      resultHash: validated.resultHash,
      summary: `旧 AI 評価候補を superseded（${inserted.supersededIds.length}件）`,
      metadata: {
        old_staging_ids: inserted.supersededIds,
        new_staging_id: inserted.staging.id,
      },
    });
  }

  return {
    ok: true,
    stagingId: inserted.staging.id,
    reviewStatus: inserted.staging.reviewStatus,
    validationStatus: inserted.staging.validationStatus,
    evaluationRequestId: req.evaluationRequestId,
    assessmentSubmissionId: req.assessmentSubmissionId,
    assessmentMilestoneId: req.assessmentMilestoneId,
    studentUserId: req.studentUserId,
    resultHash: validated.resultHash,
    supersededCount: inserted.supersededIds.length,
    auditLogged: auditImport.ok,
  };
}
