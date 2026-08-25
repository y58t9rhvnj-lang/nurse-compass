import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  parseRubricScores,
  type AssessmentReviewStatus,
  type AssessmentRubricScores,
} from "./assessmentRubric";

export type AssessmentReviewRow = {
  id: string;
  organizationId: string;
  assessmentCycleId: string;
  assessmentMilestoneId: string;
  studentUserId: string;
  assessmentSubmissionId: string;
  status: AssessmentReviewStatus;
  rubricScores: AssessmentRubricScores;
  overallComment: string;
  strengthsComment: string;
  nextStepsComment: string;
  missingInformationComment: string;
  privateNote: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  completedAt: string | null;
  completedBy: string | null;
  reopenedAt: string | null;
  reopenedBy: string | null;
};

type PgErr = { message?: string; code?: string } | null;

const SELECT_COLS =
  "id, organization_id, assessment_cycle_id, assessment_milestone_id, student_user_id, assessment_submission_id, status, rubric_scores, overall_comment, strengths_comment, next_steps_comment, missing_information_comment, private_note, created_at, created_by, updated_at, updated_by, completed_at, completed_by, reopened_at, reopened_by";

function mapRow(r: Record<string, unknown>): AssessmentReviewRow {
  const status = r.status === "completed" ? "completed" : "draft";
  return {
    id: String(r.id),
    organizationId: String(r.organization_id),
    assessmentCycleId: String(r.assessment_cycle_id),
    assessmentMilestoneId: String(r.assessment_milestone_id),
    studentUserId: String(r.student_user_id),
    assessmentSubmissionId: String(r.assessment_submission_id),
    status,
    rubricScores: parseRubricScores(r.rubric_scores),
    overallComment: String(r.overall_comment ?? ""),
    strengthsComment: String(r.strengths_comment ?? ""),
    nextStepsComment: String(r.next_steps_comment ?? ""),
    missingInformationComment: String(r.missing_information_comment ?? ""),
    privateNote: String(r.private_note ?? ""),
    createdAt: String(r.created_at),
    createdBy: String(r.created_by),
    updatedAt: String(r.updated_at),
    updatedBy: String(r.updated_by),
    completedAt: typeof r.completed_at === "string" ? r.completed_at : null,
    completedBy: typeof r.completed_by === "string" ? r.completed_by : null,
    reopenedAt: typeof r.reopened_at === "string" ? r.reopened_at : null,
    reopenedBy: typeof r.reopened_by === "string" ? r.reopened_by : null,
  };
}

export type ValidatedReviewTarget = {
  organizationId: string;
  assessmentCycleId: string;
  assessmentMilestoneId: string;
  studentUserId: string;
  assessmentSubmissionId: string;
  submissionNumber: number;
  submittedAt: string;
};

/**
 * 現在の evaluation candidate であり、指定 milestone・student・org に属することを検証。
 */
export async function validateReviewTargetSubmission(
  supabase: SupabaseClient,
  organizationId: string,
  input: {
    milestoneId: string;
    studentId: string;
    submissionId: string;
  },
): Promise<
  | { ok: true; target: ValidatedReviewTarget }
  | { ok: false; kind: string; message: string; error?: PgErr }
> {
  const { data: cand, error: cErr } = await supabase
    .from("assessment_evaluation_candidates")
    .select(
      "submission_id, assessment_milestone_id, assessment_cycle_id, student_user_id, organization_id, submission_number, submitted_at",
    )
    .eq("organization_id", organizationId)
    .eq("assessment_milestone_id", input.milestoneId)
    .eq("student_user_id", input.studentId)
    .maybeSingle();
  if (cErr) {
    return {
      ok: false,
      kind: "db_error",
      message: "評価対象を確認できませんでした。",
      error: cErr,
    };
  }
  if (!cand) {
    return {
      ok: false,
      kind: "no_candidate",
      message: "現在、評価対象となる提出はありません。",
    };
  }
  const row = cand as Record<string, unknown>;
  const candidateSubmissionId = String(row.submission_id);
  if (candidateSubmissionId !== input.submissionId) {
    return {
      ok: false,
      kind: "not_candidate",
      message: "指定の提出は現在の評価対象ではありません。",
    };
  }

  const { data: sub, error: sErr } = await supabase
    .from("assessment_submissions")
    .select(
      "id, organization_id, assessment_milestone_id, assessment_cycle_id, student_user_id, submission_number, submitted_at, is_withdrawn",
    )
    .eq("id", input.submissionId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (sErr) {
    return {
      ok: false,
      kind: "db_error",
      message: "提出情報を確認できませんでした。",
      error: sErr,
    };
  }
  if (!sub) {
    return { ok: false, kind: "not_found", message: "提出が見つかりません。" };
  }
  const s = sub as Record<string, unknown>;
  if (s.is_withdrawn === true) {
    return { ok: false, kind: "not_found", message: "提出が見つかりません。" };
  }
  if (String(s.assessment_milestone_id) !== input.milestoneId) {
    return {
      ok: false,
      kind: "mismatch",
      message: "提出が課題と一致しません。",
    };
  }
  if (String(s.student_user_id) !== input.studentId) {
    return {
      ok: false,
      kind: "mismatch",
      message: "提出が学生と一致しません。",
    };
  }

  return {
    ok: true,
    target: {
      organizationId,
      assessmentCycleId: String(s.assessment_cycle_id),
      assessmentMilestoneId: String(s.assessment_milestone_id),
      studentUserId: String(s.student_user_id),
      assessmentSubmissionId: String(s.id),
      submissionNumber: Number(s.submission_number),
      submittedAt: String(s.submitted_at),
    },
  };
}

export async function getTeacherAssessmentReviewBySubmissionId(
  supabase: SupabaseClient,
  organizationId: string,
  submissionId: string,
): Promise<{ row: AssessmentReviewRow | null; error: PgErr }> {
  const { data, error } = await supabase
    .from("assessment_reviews")
    .select(SELECT_COLS)
    .eq("organization_id", organizationId)
    .eq("assessment_submission_id", submissionId)
    .maybeSingle();
  if (error) return { row: null, error };
  if (!data) return { row: null, error: null };
  return { row: mapRow(data as Record<string, unknown>), error: null };
}

export async function insertTeacherAssessmentReviewDraft(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    assessmentCycleId: string;
    assessmentMilestoneId: string;
    studentUserId: string;
    assessmentSubmissionId: string;
    actorUserId: string;
    rubricScores: AssessmentRubricScores;
    overallComment: string;
    strengthsComment: string;
    nextStepsComment: string;
    missingInformationComment: string;
    privateNote: string;
  },
): Promise<
  | { ok: true; row: AssessmentReviewRow }
  | { ok: false; kind: "conflict" | "db_error"; message: string; error?: PgErr }
> {
  const { data, error } = await supabase
    .from("assessment_reviews")
    .insert({
      organization_id: input.organizationId,
      assessment_cycle_id: input.assessmentCycleId,
      assessment_milestone_id: input.assessmentMilestoneId,
      student_user_id: input.studentUserId,
      assessment_submission_id: input.assessmentSubmissionId,
      status: "draft",
      rubric_scores: input.rubricScores,
      overall_comment: input.overallComment,
      strengths_comment: input.strengthsComment,
      next_steps_comment: input.nextStepsComment,
      missing_information_comment: input.missingInformationComment,
      private_note: input.privateNote,
      created_by: input.actorUserId,
      updated_by: input.actorUserId,
    })
    .select(SELECT_COLS)
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        kind: "conflict",
        message:
          "別の画面でこの評価が更新されています。再読み込みして内容を確認してください。",
        error,
      };
    }
    return {
      ok: false,
      kind: "db_error",
      message: "下書きを保存できませんでした。",
      error,
    };
  }
  if (!data) {
    return {
      ok: false,
      kind: "db_error",
      message: "下書きを保存できませんでした。",
    };
  }
  return { ok: true, row: mapRow(data as Record<string, unknown>) };
}

export async function updateTeacherAssessmentReviewDraft(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    reviewId: string;
    baseUpdatedAt: string;
    actorUserId: string;
    rubricScores: AssessmentRubricScores;
    overallComment: string;
    strengthsComment: string;
    nextStepsComment: string;
    missingInformationComment: string;
    privateNote: string;
  },
): Promise<
  | { ok: true; row: AssessmentReviewRow }
  | { ok: false; kind: "conflict" | "db_error" | "readonly"; message: string }
> {
  const { data, error } = await supabase
    .from("assessment_reviews")
    .update({
      rubric_scores: input.rubricScores,
      overall_comment: input.overallComment,
      strengths_comment: input.strengthsComment,
      next_steps_comment: input.nextStepsComment,
      missing_information_comment: input.missingInformationComment,
      private_note: input.privateNote,
      updated_by: input.actorUserId,
    })
    .eq("id", input.reviewId)
    .eq("organization_id", input.organizationId)
    .eq("updated_at", input.baseUpdatedAt)
    .eq("status", "draft")
    .select(SELECT_COLS)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      kind: "db_error",
      message: "下書きを保存できませんでした。",
    };
  }
  if (!data) {
    // 競合 or completed など
    const existing = await getReviewById(
      supabase,
      input.organizationId,
      input.reviewId,
    );
    if (existing.row?.status === "completed") {
      return {
        ok: false,
        kind: "readonly",
        message: "評価が確定済みのため、下書き保存できません。",
      };
    }
    return {
      ok: false,
      kind: "conflict",
      message:
        "別の画面でこの評価が更新されています。再読み込みして内容を確認してください。",
    };
  }
  return { ok: true, row: mapRow(data as Record<string, unknown>) };
}

async function getReviewById(
  supabase: SupabaseClient,
  organizationId: string,
  reviewId: string,
): Promise<{ row: AssessmentReviewRow | null; error: PgErr }> {
  const { data, error } = await supabase
    .from("assessment_reviews")
    .select(SELECT_COLS)
    .eq("organization_id", organizationId)
    .eq("id", reviewId)
    .maybeSingle();
  if (error) return { row: null, error };
  if (!data) return { row: null, error: null };
  return { row: mapRow(data as Record<string, unknown>), error: null };
}

export async function completeTeacherAssessmentReviewRow(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    reviewId: string;
    baseUpdatedAt: string;
    actorUserId: string;
    rubricScores: AssessmentRubricScores;
    overallComment: string;
    strengthsComment: string;
    nextStepsComment: string;
    missingInformationComment: string;
    privateNote: string;
  },
): Promise<
  | { ok: true; row: AssessmentReviewRow }
  | { ok: false; kind: "conflict" | "db_error"; message: string }
> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("assessment_reviews")
    .update({
      status: "completed",
      rubric_scores: input.rubricScores,
      overall_comment: input.overallComment,
      strengths_comment: input.strengthsComment,
      next_steps_comment: input.nextStepsComment,
      missing_information_comment: input.missingInformationComment,
      private_note: input.privateNote,
      updated_by: input.actorUserId,
      completed_at: now,
      completed_by: input.actorUserId,
    })
    .eq("id", input.reviewId)
    .eq("organization_id", input.organizationId)
    .eq("updated_at", input.baseUpdatedAt)
    .eq("status", "draft")
    .select(SELECT_COLS)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      kind: "db_error",
      message: "評価を確定できませんでした。",
    };
  }
  if (!data) {
    return {
      ok: false,
      kind: "conflict",
      message:
        "別の画面でこの評価が更新されています。再読み込みして内容を確認してください。",
    };
  }
  return { ok: true, row: mapRow(data as Record<string, unknown>) };
}

export async function listTeacherAssessmentReviewsForMilestone(
  supabase: SupabaseClient,
  organizationId: string,
  milestoneId: string,
): Promise<{ rows: AssessmentReviewRow[]; error: PgErr }> {
  const { data, error } = await supabase
    .from("assessment_reviews")
    .select(SELECT_COLS)
    .eq("organization_id", organizationId)
    .eq("assessment_milestone_id", milestoneId);
  if (error) return { rows: [], error };
  return {
    rows: ((data ?? []) as Record<string, unknown>[]).map(mapRow),
    error: null,
  };
}

export async function reopenTeacherAssessmentReviewRow(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    reviewId: string;
    baseUpdatedAt: string;
    actorUserId: string;
  },
): Promise<
  | { ok: true; row: AssessmentReviewRow }
  | { ok: false; kind: "conflict" | "db_error" | "validation"; message: string }
> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("assessment_reviews")
    .update({
      status: "draft",
      updated_by: input.actorUserId,
      reopened_at: now,
      reopened_by: input.actorUserId,
      // completed_at / completed_by は保持（null にしない）
    })
    .eq("id", input.reviewId)
    .eq("organization_id", input.organizationId)
    .eq("updated_at", input.baseUpdatedAt)
    .eq("status", "completed")
    .select(SELECT_COLS)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      kind: "db_error",
      message: "下書きに戻せませんでした。",
    };
  }
  if (!data) {
    return {
      ok: false,
      kind: "conflict",
      message:
        "別の画面でこの評価が更新されています。再読み込みして内容を確認してください。",
    };
  }
  return { ok: true, row: mapRow(data as Record<string, unknown>) };
}

/** Spec alias */
export const getTeacherAssessmentReview = getTeacherAssessmentReviewBySubmissionId;
