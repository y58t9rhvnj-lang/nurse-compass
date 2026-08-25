import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AiEvalIssue,
  AiEvalWarning,
} from "@/lib/v2/assessment/aiEvaluationResultValidate";

export type AiEvaluationStagingInsert = {
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
  rawResultJson: unknown;
  normalizedResultJson: unknown | null;
  resultHash: string;
  validationStatus: "ok" | "warning" | "invalid";
  validationErrors: AiEvalIssue[];
  versionWarnings: AiEvalWarning[];
  piiWarnings: AiEvalWarning[];
  reviewStatus: "invalid" | "needs_review";
  sourceModel: string | null;
  sourceProvider: string | null;
  promptVersion: string | null;
  importedBy: string;
  importedAt: string;
};

export type AiEvaluationStagingRow = {
  id: string;
  organizationId: string;
  requestId: string;
  evaluationRequestId: string;
  assessmentSubmissionId: string;
  reviewStatus: string;
  validationStatus: string;
  resultHash: string;
  importedAt: string;
};

function mapStaging(r: Record<string, unknown>): AiEvaluationStagingRow {
  return {
    id: String(r.id),
    organizationId: String(r.organization_id),
    requestId: String(r.request_id),
    evaluationRequestId: String(r.evaluation_request_id),
    assessmentSubmissionId: String(r.assessment_submission_id),
    reviewStatus: String(r.review_status),
    validationStatus: String(r.validation_status),
    resultHash: String(r.result_hash),
    importedAt: String(r.imported_at),
  };
}

export function mapDbErrorToImportMessage(error: {
  code?: string;
  message?: string;
}): { kind: string; message: string } {
  if (error.code === "23505") {
    const msg = error.message ?? "";
    if (msg.includes("eval_req") || msg.includes("evaluation_request")) {
      return {
        kind: "duplicate_evaluation_request",
        message: "この evaluation_request_id は既に取り込まれています。",
      };
    }
    if (msg.includes("result_hash")) {
      return {
        kind: "duplicate_result_hash",
        message: "同一内容の評価結果が既に取り込まれています。",
      };
    }
    if (msg.includes("one_active") || msg.includes("active")) {
      return {
        kind: "active_staging_conflict",
        message:
          "同一提出に確認中の AI 評価候補が既にあります。再試行してください。",
      };
    }
    return {
      kind: "conflict",
      message: "取込が競合しました。内容を確認して再試行してください。",
    };
  }
  return {
    kind: "db_error",
    message: "AI評価結果を保存できませんでした。",
  };
}

export async function findActiveStagingForSubmission(
  admin: SupabaseClient,
  submissionId: string,
): Promise<
  | { ok: true; rows: AiEvaluationStagingRow[] }
  | { ok: false; message: string }
> {
  const { data, error } = await admin
    .from("assessment_ai_evaluation_staging")
    .select(
      "id, organization_id, request_id, evaluation_request_id, assessment_submission_id, review_status, validation_status, result_hash, imported_at",
    )
    .eq("assessment_submission_id", submissionId)
    .in("review_status", ["needs_review", "partially_adopted"]);
  if (error) {
    return { ok: false, message: "既存の AI 評価候補を確認できませんでした。" };
  }
  return {
    ok: true,
    rows: ((data ?? []) as Record<string, unknown>[]).map(mapStaging),
  };
}

export async function supersedeStagingRows(
  admin: SupabaseClient,
  input: { oldIds: string[]; newStagingId: string },
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (input.oldIds.length === 0) return { ok: true };
  const { error } = await admin
    .from("assessment_ai_evaluation_staging")
    .update({
      review_status: "superseded",
      superseded_by: input.newStagingId,
    })
    .in("id", input.oldIds)
    .in("review_status", ["needs_review", "partially_adopted"]);
  if (error) {
    return { ok: false, message: "旧 AI 評価候補の更新に失敗しました。" };
  }
  return { ok: true };
}

/**
 * staging 挿入。
 * needs_review で旧 active がある場合:
 *   1) 新行を一時的に review_status=invalid で INSERT（partial unique 回避）
 *   2) 旧 active を superseded_by=新ID で superseded
 *   3) 新行を needs_review に UPDATE
 * invalid 取込では supersede しない。
 */
export async function insertStagingThenSupersedeActives(
  admin: SupabaseClient,
  input: {
    row: AiEvaluationStagingInsert;
    supersedeActive: boolean;
  },
): Promise<
  | { ok: true; staging: AiEvaluationStagingRow; supersededIds: string[] }
  | { ok: false; kind: string; message: string }
> {
  let activeIds: string[] = [];
  if (input.supersedeActive) {
    const active = await findActiveStagingForSubmission(
      admin,
      input.row.assessmentSubmissionId,
    );
    if (!active.ok) {
      return { ok: false, kind: "db_error", message: active.message };
    }
    activeIds = active.rows.map((r) => r.id);
  }

  const needsTwoPhase =
    input.supersedeActive &&
    input.row.reviewStatus === "needs_review" &&
    activeIds.length > 0;

  const insertPayload = {
    organization_id: input.row.organizationId,
    request_id: input.row.requestId,
    evaluation_request_id: input.row.evaluationRequestId,
    assessment_submission_id: input.row.assessmentSubmissionId,
    assessment_cycle_id: input.row.assessmentCycleId,
    assessment_milestone_id: input.row.assessmentMilestoneId,
    student_user_id: input.row.studentUserId,
    package_schema_version: input.row.packageSchemaVersion,
    result_schema_version: input.row.resultSchemaVersion,
    compass_policy_version: input.row.compassPolicyVersion,
    rubric_version: input.row.rubricVersion,
    gold_standard_version: input.row.goldStandardVersion,
    case_version: input.row.caseVersion,
    export_schema_version: input.row.exportSchemaVersion,
    raw_result_json: input.row.rawResultJson,
    normalized_result_json: input.row.normalizedResultJson,
    result_hash: input.row.resultHash,
    validation_status: input.row.validationStatus,
    validation_errors: input.row.validationErrors,
    version_warnings: input.row.versionWarnings,
    pii_warnings: input.row.piiWarnings,
    review_status: needsTwoPhase
      ? ("invalid" as const)
      : input.row.reviewStatus,
    source_model: input.row.sourceModel,
    source_provider: input.row.sourceProvider,
    prompt_version: input.row.promptVersion,
    imported_at: input.row.importedAt,
    imported_by: input.row.importedBy,
  };

  const { data: inserted, error: insErr } = await admin
    .from("assessment_ai_evaluation_staging")
    .insert(insertPayload)
    .select(
      "id, organization_id, request_id, evaluation_request_id, assessment_submission_id, review_status, validation_status, result_hash, imported_at",
    )
    .maybeSingle();

  if (insErr || !inserted) {
    const mapped = mapDbErrorToImportMessage(insErr ?? {});
    return { ok: false, kind: mapped.kind, message: mapped.message };
  }

  let staging = mapStaging(inserted as Record<string, unknown>);

  if (needsTwoPhase) {
    const sup = await supersedeStagingRows(admin, {
      oldIds: activeIds,
      newStagingId: staging.id,
    });
    if (!sup.ok) {
      return { ok: false, kind: "db_error", message: sup.message };
    }

    const { data: finalRow, error: upErr } = await admin
      .from("assessment_ai_evaluation_staging")
      .update({ review_status: "needs_review" })
      .eq("id", staging.id)
      .select(
        "id, organization_id, request_id, evaluation_request_id, assessment_submission_id, review_status, validation_status, result_hash, imported_at",
      )
      .maybeSingle();

    if (upErr || !finalRow) {
      const mapped = mapDbErrorToImportMessage(upErr ?? {});
      return { ok: false, kind: mapped.kind, message: mapped.message };
    }
    staging = mapStaging(finalRow as Record<string, unknown>);
  }

  return {
    ok: true,
    staging,
    supersededIds: needsTwoPhase ? activeIds : [],
  };
}
