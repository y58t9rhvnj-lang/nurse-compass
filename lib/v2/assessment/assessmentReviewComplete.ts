import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  canCompleteAssessmentReview,
  type AssessmentRubricScores,
} from "./assessmentRubric";
import {
  completeTeacherAssessmentReviewRow,
  getTeacherAssessmentReviewBySubmissionId,
  validateReviewTargetSubmission,
  type AssessmentReviewRow,
} from "./assessmentReviewRepository";

export type CompleteAssessmentReviewCoreInput = {
  organizationId: string;
  actorUserId: string;
  milestoneId: string;
  studentId: string;
  submissionId: string;
  reviewId: string;
  baseUpdatedAt: string;
  rubricScores: AssessmentRubricScores;
  overallComment: string;
  strengthsComment: string;
  nextStepsComment: string;
  missingInformationComment: string;
  privateNote: string;
};

/**
 * 個別確定・一括確定の共通コア。
 * Server Action 同士の相互呼び出しはしない。
 */
export async function completeAssessmentReviewCore(
  supabase: SupabaseClient,
  input: CompleteAssessmentReviewCoreInput,
): Promise<
  | { ok: true; review: AssessmentReviewRow }
  | { ok: false; kind: string; message: string }
> {
  if (
    !canCompleteAssessmentReview({
      overallComment: input.overallComment,
      rubricScores: input.rubricScores,
    })
  ) {
    return {
      ok: false,
      kind: "validation",
      message:
        "評価を確定するには、総合コメントまたは評価項目を1つ以上入力してください。",
    };
  }

  const validated = await validateReviewTargetSubmission(
    supabase,
    input.organizationId,
    {
      milestoneId: input.milestoneId,
      studentId: input.studentId,
      submissionId: input.submissionId,
    },
  );
  if (!validated.ok) {
    return {
      ok: false,
      kind:
        validated.kind === "not_candidate"
          ? "not_candidate"
          : validated.kind,
      message:
        validated.kind === "not_candidate"
          ? "評価対象が変更されています。"
          : validated.message,
    };
  }

  const existing = await getTeacherAssessmentReviewBySubmissionId(
    supabase,
    input.organizationId,
    input.submissionId,
  );
  if (existing.error) {
    return { ok: false, kind: "db_error", message: "評価を確認できませんでした。" };
  }
  if (!existing.row || existing.row.id !== input.reviewId) {
    return {
      ok: false,
      kind: "conflict",
      message:
        "別の画面でこの評価が更新されています。再読み込みして内容を確認してください。",
    };
  }
  if (
    existing.row.assessmentMilestoneId !== input.milestoneId ||
    existing.row.studentUserId !== input.studentId ||
    existing.row.organizationId !== input.organizationId
  ) {
    return { ok: false, kind: "unauthorized", message: "評価を確定できません。" };
  }
  if (existing.row.status !== "draft") {
    return {
      ok: false,
      kind: "validation",
      message: "下書き状態の評価のみ確定できます。",
    };
  }

  const completed = await completeTeacherAssessmentReviewRow(supabase, {
    organizationId: input.organizationId,
    reviewId: input.reviewId,
    baseUpdatedAt: input.baseUpdatedAt,
    actorUserId: input.actorUserId,
    rubricScores: input.rubricScores,
    overallComment: input.overallComment,
    strengthsComment: input.strengthsComment,
    nextStepsComment: input.nextStepsComment,
    missingInformationComment: input.missingInformationComment,
    privateNote: input.privateNote,
  });
  if (!completed.ok) {
    return { ok: false, kind: completed.kind, message: completed.message };
  }
  return { ok: true, review: completed.row };
}
