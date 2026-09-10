"use server";

import { isSupabaseConfigured } from "@/lib/v2/env";
import { getCurrentProfile, type AppProfile } from "@/lib/v2/auth/currentUser";
import { createServerSupabaseClient } from "@/lib/v2/supabase/serverClient";
import { completeAssessmentReviewCore } from "@/lib/v2/assessment/assessmentReviewComplete";
import {
  sanitizeComment,
  validateRubricScoresInput,
} from "@/lib/v2/assessment/assessmentRubric";
import {
  getTeacherAssessmentReviewBySubmissionId,
  insertTeacherAssessmentReviewDraft,
  reopenTeacherAssessmentReviewRow,
  returnTeacherAssessmentReviewRow,
  revokeReturnedAssessmentReviewRow,
  updateTeacherAssessmentReviewDraft,
  validateReviewTargetSubmission,
  type AssessmentReviewRow,
} from "@/lib/v2/assessment/assessmentReviewRepository";
import { isAssessmentReviewCurrentlyReturned } from "@/lib/v2/assessment/assessmentReviewStatus";
import { getTeacherStudentProfile } from "@/lib/v2/assessment/teacherReviewRepository";
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

type CommentFields = {
  overallComment: string;
  strengthsComment: string;
  nextStepsComment: string;
  missingInformationComment: string;
  privateNote: string;
};

function sanitizeComments(input: {
  overallComment?: unknown;
  strengthsComment?: unknown;
  nextStepsComment?: unknown;
  missingInformationComment?: unknown;
  privateNote?: unknown;
}): CommentFields {
  return {
    overallComment: sanitizeComment(input.overallComment),
    strengthsComment: sanitizeComment(input.strengthsComment),
    nextStepsComment: sanitizeComment(input.nextStepsComment),
    missingInformationComment: sanitizeComment(input.missingInformationComment),
    privateNote: sanitizeComment(input.privateNote),
  };
}

async function assertStudentInOrg(
  supabase: SupabaseClient,
  organizationId: string,
  studentId: string,
): Promise<{ ok: true } | { ok: false; kind: string; message: string }> {
  const got = await getTeacherStudentProfile(
    supabase,
    organizationId,
    studentId,
  );
  if (got.error) {
    return { ok: false, kind: "db_error", message: "学生情報を確認できませんでした。" };
  }
  if (!got.row) {
    return { ok: false, kind: "not_found", message: "学生が見つかりません。" };
  }
  return { ok: true };
}

async function resolveProfileDisplayName(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string | null | undefined,
): Promise<string | null> {
  if (!userId) return null;
  const { data } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("organization_id", organizationId)
    .eq("id", userId)
    .maybeSingle();
  if (!data) return null;
  const name = String(
    (data as { display_name?: string | null }).display_name ?? "",
  ).trim();
  return name || null;
}

export async function getTeacherAssessmentReviewAction(input: {
  milestoneId: string;
  studentId: string;
  submissionId: string;
}): Promise<
  | {
      ok: true;
      review: AssessmentReviewRow | null;
      isCurrentCandidate: boolean;
      completedByDisplayName: string | null;
      updatedByDisplayName: string | null;
    }
  | { ok: false; kind: string; message: string }
> {
  const ctx = await requireStaffContext();
  if (!ctx.ok) return ctx;

  const studentOk = await assertStudentInOrg(
    ctx.supabase,
    ctx.profile.organizationId,
    input.studentId,
  );
  if (!studentOk.ok) return studentOk;

  const validated = await validateReviewTargetSubmission(
    ctx.supabase,
    ctx.profile.organizationId,
    input,
  );
  const isCurrentCandidate = validated.ok;

  const got = await getTeacherAssessmentReviewBySubmissionId(
    ctx.supabase,
    ctx.profile.organizationId,
    input.submissionId,
  );
  if (got.error) {
    return { ok: false, kind: "db_error", message: "評価を読み込めませんでした。" };
  }

  if (!isCurrentCandidate && !got.row) {
    return {
      ok: true,
      review: null,
      isCurrentCandidate: false,
      completedByDisplayName: null,
      updatedByDisplayName: null,
    };
  }

  if (got.row) {
    if (
      got.row.organizationId !== ctx.profile.organizationId ||
      got.row.assessmentMilestoneId !== input.milestoneId ||
      got.row.studentUserId !== input.studentId ||
      got.row.assessmentSubmissionId !== input.submissionId
    ) {
      return { ok: false, kind: "unauthorized", message: "評価にアクセスできません。" };
    }
  }

  const [completedByDisplayName, updatedByDisplayName] = await Promise.all([
    resolveProfileDisplayName(
      ctx.supabase,
      ctx.profile.organizationId,
      got.row?.completedBy,
    ),
    resolveProfileDisplayName(
      ctx.supabase,
      ctx.profile.organizationId,
      got.row?.updatedBy,
    ),
  ]);

  return {
    ok: true,
    review: got.row,
    isCurrentCandidate,
    completedByDisplayName,
    updatedByDisplayName,
  };
}

export async function saveTeacherAssessmentReviewDraftAction(input: {
  milestoneId: string;
  studentId: string;
  submissionId: string;
  reviewId?: string | null;
  baseUpdatedAt?: string | null;
  rubricScores: unknown;
  overallComment?: unknown;
  strengthsComment?: unknown;
  nextStepsComment?: unknown;
  missingInformationComment?: unknown;
  privateNote?: unknown;
}): Promise<
  | { ok: true; review: AssessmentReviewRow }
  | { ok: false; kind: string; message: string }
> {
  const ctx = await requireStaffContext();
  if (!ctx.ok) return ctx;

  const studentOk = await assertStudentInOrg(
    ctx.supabase,
    ctx.profile.organizationId,
    input.studentId,
  );
  if (!studentOk.ok) return studentOk;

  const scores = validateRubricScoresInput(input.rubricScores);
  if (!scores.ok) return { ok: false, kind: "validation", message: scores.message };
  const comments = sanitizeComments(input);

  if (!input.reviewId) {
    const validated = await validateReviewTargetSubmission(
      ctx.supabase,
      ctx.profile.organizationId,
      {
        milestoneId: input.milestoneId,
        studentId: input.studentId,
        submissionId: input.submissionId,
      },
    );
    if (!validated.ok) {
      return {
        ok: false,
        kind: validated.kind,
        message: validated.message,
      };
    }
    const inserted = await insertTeacherAssessmentReviewDraft(ctx.supabase, {
      organizationId: ctx.profile.organizationId,
      assessmentCycleId: validated.target.assessmentCycleId,
      assessmentMilestoneId: validated.target.assessmentMilestoneId,
      studentUserId: validated.target.studentUserId,
      assessmentSubmissionId: validated.target.assessmentSubmissionId,
      actorUserId: ctx.profile.id,
      rubricScores: scores.scores,
      ...comments,
    });
    if (!inserted.ok) {
      return {
        ok: false,
        kind: inserted.kind,
        message: inserted.message,
      };
    }
    return { ok: true, review: inserted.row };
  }

  if (!input.baseUpdatedAt) {
    return {
      ok: false,
      kind: "validation",
      message: "保存の基準時刻がありません。再読み込みしてください。",
    };
  }

  const existing = await getTeacherAssessmentReviewBySubmissionId(
    ctx.supabase,
    ctx.profile.organizationId,
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
    existing.row.studentUserId !== input.studentId
  ) {
    return { ok: false, kind: "unauthorized", message: "評価を更新できません。" };
  }

  const updated = await updateTeacherAssessmentReviewDraft(ctx.supabase, {
    organizationId: ctx.profile.organizationId,
    reviewId: input.reviewId,
    baseUpdatedAt: input.baseUpdatedAt,
    actorUserId: ctx.profile.id,
    rubricScores: scores.scores,
    ...comments,
  });
  if (!updated.ok) {
    return { ok: false, kind: updated.kind, message: updated.message };
  }
  return { ok: true, review: updated.row };
}

export async function completeTeacherAssessmentReviewAction(input: {
  milestoneId: string;
  studentId: string;
  submissionId: string;
  reviewId: string;
  baseUpdatedAt: string;
  rubricScores: unknown;
  overallComment?: unknown;
  strengthsComment?: unknown;
  nextStepsComment?: unknown;
  missingInformationComment?: unknown;
  privateNote?: unknown;
}): Promise<
  | { ok: true; review: AssessmentReviewRow }
  | { ok: false; kind: string; message: string }
> {
  const ctx = await requireStaffContext();
  if (!ctx.ok) return ctx;

  const studentOk = await assertStudentInOrg(
    ctx.supabase,
    ctx.profile.organizationId,
    input.studentId,
  );
  if (!studentOk.ok) return studentOk;

  const scores = validateRubricScoresInput(input.rubricScores);
  if (!scores.ok) return { ok: false, kind: "validation", message: scores.message };
  const comments = sanitizeComments(input);

  return completeAssessmentReviewCore(ctx.supabase, {
    organizationId: ctx.profile.organizationId,
    actorUserId: ctx.profile.id,
    milestoneId: input.milestoneId,
    studentId: input.studentId,
    submissionId: input.submissionId,
    reviewId: input.reviewId,
    baseUpdatedAt: input.baseUpdatedAt,
    rubricScores: scores.scores,
    ...comments,
  });
}

/**
 * 未保存のまま確定: repository 経由で draft 保存 → 共通コアで確定。
 * Server Action 同士は呼ばない。
 */
export async function saveAndCompleteTeacherAssessmentReviewAction(input: {
  milestoneId: string;
  studentId: string;
  submissionId: string;
  reviewId?: string | null;
  baseUpdatedAt?: string | null;
  rubricScores: unknown;
  overallComment?: unknown;
  strengthsComment?: unknown;
  nextStepsComment?: unknown;
  missingInformationComment?: unknown;
  privateNote?: unknown;
}): Promise<
  | { ok: true; review: AssessmentReviewRow }
  | { ok: false; kind: string; message: string }
> {
  const ctx = await requireStaffContext();
  if (!ctx.ok) return ctx;

  const studentOk = await assertStudentInOrg(
    ctx.supabase,
    ctx.profile.organizationId,
    input.studentId,
  );
  if (!studentOk.ok) return studentOk;

  const scores = validateRubricScoresInput(input.rubricScores);
  if (!scores.ok) return { ok: false, kind: "validation", message: scores.message };
  const comments = sanitizeComments(input);

  let reviewId = input.reviewId ?? null;
  let baseUpdatedAt = input.baseUpdatedAt ?? null;

  if (reviewId && baseUpdatedAt) {
    return completeAssessmentReviewCore(ctx.supabase, {
      organizationId: ctx.profile.organizationId,
      actorUserId: ctx.profile.id,
      milestoneId: input.milestoneId,
      studentId: input.studentId,
      submissionId: input.submissionId,
      reviewId,
      baseUpdatedAt,
      rubricScores: scores.scores,
      ...comments,
    });
  }

  const validated = await validateReviewTargetSubmission(
    ctx.supabase,
    ctx.profile.organizationId,
    {
      milestoneId: input.milestoneId,
      studentId: input.studentId,
      submissionId: input.submissionId,
    },
  );
  if (!validated.ok) {
    return { ok: false, kind: validated.kind, message: validated.message };
  }

  const inserted = await insertTeacherAssessmentReviewDraft(ctx.supabase, {
    organizationId: ctx.profile.organizationId,
    assessmentCycleId: validated.target.assessmentCycleId,
    assessmentMilestoneId: validated.target.assessmentMilestoneId,
    studentUserId: validated.target.studentUserId,
    assessmentSubmissionId: validated.target.assessmentSubmissionId,
    actorUserId: ctx.profile.id,
    rubricScores: scores.scores,
    ...comments,
  });
  if (!inserted.ok) {
    return { ok: false, kind: inserted.kind, message: inserted.message };
  }

  return completeAssessmentReviewCore(ctx.supabase, {
    organizationId: ctx.profile.organizationId,
    actorUserId: ctx.profile.id,
    milestoneId: input.milestoneId,
    studentId: input.studentId,
    submissionId: input.submissionId,
    reviewId: inserted.row.id,
    baseUpdatedAt: inserted.row.updatedAt,
    rubricScores: scores.scores,
    ...comments,
  });
}

export async function reopenTeacherAssessmentReviewAction(input: {
  milestoneId: string;
  studentId: string;
  submissionId: string;
  reviewId: string;
  baseUpdatedAt: string;
}): Promise<
  | { ok: true; review: AssessmentReviewRow }
  | { ok: false; kind: string; message: string }
> {
  const ctx = await requireStaffContext();
  if (!ctx.ok) return ctx;

  const studentOk = await assertStudentInOrg(
    ctx.supabase,
    ctx.profile.organizationId,
    input.studentId,
  );
  if (!studentOk.ok) return studentOk;

  const validated = await validateReviewTargetSubmission(
    ctx.supabase,
    ctx.profile.organizationId,
    {
      milestoneId: input.milestoneId,
      studentId: input.studentId,
      submissionId: input.submissionId,
    },
  );
  if (!validated.ok) {
    return { ok: false, kind: validated.kind, message: validated.message };
  }

  const existing = await getTeacherAssessmentReviewBySubmissionId(
    ctx.supabase,
    ctx.profile.organizationId,
    input.submissionId,
  );
  if (existing.error || !existing.row || existing.row.id !== input.reviewId) {
    return {
      ok: false,
      kind: "conflict",
      message:
        "別の画面でこの評価が更新されています。再読み込みして内容を確認してください。",
    };
  }
  if (existing.row.status !== "completed") {
    return {
      ok: false,
      kind: "validation",
      message: "確定済みの評価のみ下書きに戻せます。",
    };
  }
  if (isAssessmentReviewCurrentlyReturned(existing.row)) {
    return {
      ok: false,
      kind: "validation",
      message:
        "返却済みの評価は、先に返却を取り消してから下書きに戻せます。",
    };
  }

  const reopened = await reopenTeacherAssessmentReviewRow(ctx.supabase, {
    organizationId: ctx.profile.organizationId,
    reviewId: input.reviewId,
    baseUpdatedAt: input.baseUpdatedAt,
    actorUserId: ctx.profile.id,
  });
  if (!reopened.ok) {
    return { ok: false, kind: reopened.kind, message: reopened.message };
  }
  return { ok: true, review: reopened.row };
}

export async function returnTeacherAssessmentReviewAction(input: {
  milestoneId: string;
  studentId: string;
  submissionId: string;
  reviewId: string;
  baseUpdatedAt: string;
}): Promise<
  | { ok: true; review: AssessmentReviewRow }
  | { ok: false; kind: string; message: string }
> {
  const ctx = await requireStaffContext();
  if (!ctx.ok) return ctx;

  const studentOk = await assertStudentInOrg(
    ctx.supabase,
    ctx.profile.organizationId,
    input.studentId,
  );
  if (!studentOk.ok) return studentOk;

  const validated = await validateReviewTargetSubmission(
    ctx.supabase,
    ctx.profile.organizationId,
    {
      milestoneId: input.milestoneId,
      studentId: input.studentId,
      submissionId: input.submissionId,
    },
  );
  if (!validated.ok) {
    return { ok: false, kind: validated.kind, message: validated.message };
  }

  const existing = await getTeacherAssessmentReviewBySubmissionId(
    ctx.supabase,
    ctx.profile.organizationId,
    input.submissionId,
  );
  if (existing.error || !existing.row || existing.row.id !== input.reviewId) {
    return {
      ok: false,
      kind: "conflict",
      message:
        "別の画面でこの評価が更新されています。再読み込みして内容を確認してください。",
    };
  }
  if (existing.row.status !== "completed") {
    return {
      ok: false,
      kind: "validation",
      message: "確定済みの評価のみ返却できます。",
    };
  }
  if (isAssessmentReviewCurrentlyReturned(existing.row)) {
    return {
      ok: false,
      kind: "validation",
      message: "すでに学生へ返却済みです。",
    };
  }

  const returned = await returnTeacherAssessmentReviewRow(ctx.supabase, {
    organizationId: ctx.profile.organizationId,
    reviewId: input.reviewId,
    baseUpdatedAt: input.baseUpdatedAt,
    actorUserId: ctx.profile.id,
  });
  if (!returned.ok) {
    return { ok: false, kind: returned.kind, message: returned.message };
  }
  return { ok: true, review: returned.row };
}

export async function revokeReturnedAssessmentReviewAction(input: {
  milestoneId: string;
  studentId: string;
  submissionId: string;
  reviewId: string;
  baseUpdatedAt: string;
  reason: unknown;
}): Promise<
  | { ok: true; review: AssessmentReviewRow }
  | { ok: false; kind: string; message: string }
> {
  const ctx = await requireStaffContext();
  if (!ctx.ok) return ctx;

  const studentOk = await assertStudentInOrg(
    ctx.supabase,
    ctx.profile.organizationId,
    input.studentId,
  );
  if (!studentOk.ok) return studentOk;

  const reason =
    typeof input.reason === "string" ? input.reason.trim() : "";
  if (reason.length < 1 || reason.length > 1000) {
    return {
      ok: false,
      kind: "validation",
      message: "取消理由は1〜1000文字で入力してください。",
    };
  }

  const validated = await validateReviewTargetSubmission(
    ctx.supabase,
    ctx.profile.organizationId,
    {
      milestoneId: input.milestoneId,
      studentId: input.studentId,
      submissionId: input.submissionId,
    },
  );
  if (!validated.ok) {
    return { ok: false, kind: validated.kind, message: validated.message };
  }

  const existing = await getTeacherAssessmentReviewBySubmissionId(
    ctx.supabase,
    ctx.profile.organizationId,
    input.submissionId,
  );
  if (existing.error || !existing.row || existing.row.id !== input.reviewId) {
    return {
      ok: false,
      kind: "conflict",
      message:
        "別の画面でこの評価が更新されています。再読み込みして内容を確認してください。",
    };
  }
  if (!isAssessmentReviewCurrentlyReturned(existing.row)) {
    return {
      ok: false,
      kind: "validation",
      message: "返却中の評価のみ取消できます。",
    };
  }

  const revoked = await revokeReturnedAssessmentReviewRow(ctx.supabase, {
    organizationId: ctx.profile.organizationId,
    reviewId: input.reviewId,
    baseUpdatedAt: input.baseUpdatedAt,
    actorUserId: ctx.profile.id,
    reason,
  });
  if (!revoked.ok) {
    return { ok: false, kind: revoked.kind, message: revoked.message };
  }
  return { ok: true, review: revoked.row };
}

export type BulkCompleteItemInput = {
  studentId: string;
  submissionId: string;
  reviewId: string;
  baseUpdatedAt: string;
};

export type BulkCompleteItemResult = {
  studentId: string;
  ok: boolean;
  kind?: string;
  message: string;
};

/**
 * 保存済み draft の一括確定。共通コアを逐次呼び出し（SA→SA はしない）。
 */
export async function bulkCompleteTeacherAssessmentReviewsAction(input: {
  milestoneId: string;
  items: BulkCompleteItemInput[];
}): Promise<
  | {
      ok: true;
      results: BulkCompleteItemResult[];
      successCount: number;
      failureCount: number;
    }
  | { ok: false; kind: string; message: string }
> {
  const ctx = await requireStaffContext();
  if (!ctx.ok) return ctx;

  if (!Array.isArray(input.items) || input.items.length === 0) {
    return {
      ok: false,
      kind: "validation",
      message: "確定する評価が選択されていません。",
    };
  }
  if (input.items.length > 200) {
    return {
      ok: false,
      kind: "validation",
      message: "一度に確定できる件数は200件までです。",
    };
  }

  const results: BulkCompleteItemResult[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (const item of input.items) {
    const studentOk = await assertStudentInOrg(
      ctx.supabase,
      ctx.profile.organizationId,
      item.studentId,
    );
    if (!studentOk.ok) {
      failureCount += 1;
      results.push({
        studentId: item.studentId,
        ok: false,
        kind: studentOk.kind,
        message: studentOk.message,
      });
      continue;
    }

    const got = await getTeacherAssessmentReviewBySubmissionId(
      ctx.supabase,
      ctx.profile.organizationId,
      item.submissionId,
    );
    if (got.error || !got.row) {
      failureCount += 1;
      results.push({
        studentId: item.studentId,
        ok: false,
        kind: "not_found",
        message: "評価が見つかりません。",
      });
      continue;
    }
    if (got.row.id !== item.reviewId) {
      failureCount += 1;
      results.push({
        studentId: item.studentId,
        ok: false,
        kind: "conflict",
        message: "別の画面で更新済みです。",
      });
      continue;
    }

    const res = await completeAssessmentReviewCore(ctx.supabase, {
      organizationId: ctx.profile.organizationId,
      actorUserId: ctx.profile.id,
      milestoneId: input.milestoneId,
      studentId: item.studentId,
      submissionId: item.submissionId,
      reviewId: item.reviewId,
      baseUpdatedAt: item.baseUpdatedAt,
      rubricScores: got.row.rubricScores,
      overallComment: got.row.overallComment,
      strengthsComment: got.row.strengthsComment,
      nextStepsComment: got.row.nextStepsComment,
      missingInformationComment: got.row.missingInformationComment,
      privateNote: got.row.privateNote,
    });

    if (!res.ok) {
      failureCount += 1;
      let message = res.message;
      if (res.kind === "conflict") {
        message = "別の画面で更新済みです。";
      } else if (res.kind === "validation") {
        message = "確定条件を満たしていません。";
      } else if (res.kind === "not_candidate" || res.kind === "no_candidate") {
        message = "評価対象が変更されています。";
      }
      results.push({
        studentId: item.studentId,
        ok: false,
        kind: res.kind,
        message,
      });
      continue;
    }

    successCount += 1;
    results.push({
      studentId: item.studentId,
      ok: true,
      message: "確定しました。",
    });
  }

  return { ok: true, results, successCount, failureCount };
}

export type BulkReturnItemInput = {
  studentId: string;
  submissionId: string;
  reviewId: string;
  baseUpdatedAt: string;
};

export type BulkReturnItemResult = {
  studentId: string;
  ok: boolean;
  kind?: string;
  message: string;
};

/**
 * 確定済み・未返却（返却取消含む）の一括返却。個別 return と同じ検証・更新を逐次実行。
 */
export async function bulkReturnTeacherAssessmentReviewsAction(input: {
  milestoneId: string;
  items: BulkReturnItemInput[];
}): Promise<
  | {
      ok: true;
      results: BulkReturnItemResult[];
      successCount: number;
      failureCount: number;
    }
  | { ok: false; kind: string; message: string }
> {
  const ctx = await requireStaffContext();
  if (!ctx.ok) return ctx;

  if (!Array.isArray(input.items) || input.items.length === 0) {
    return {
      ok: false,
      kind: "validation",
      message: "返却する評価がありません。",
    };
  }
  if (input.items.length > 200) {
    return {
      ok: false,
      kind: "validation",
      message: "一度に返却できる件数は200件までです。",
    };
  }

  const results: BulkReturnItemResult[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (const item of input.items) {
    const studentOk = await assertStudentInOrg(
      ctx.supabase,
      ctx.profile.organizationId,
      item.studentId,
    );
    if (!studentOk.ok) {
      failureCount += 1;
      results.push({
        studentId: item.studentId,
        ok: false,
        kind: studentOk.kind,
        message: studentOk.message,
      });
      continue;
    }

    const validated = await validateReviewTargetSubmission(
      ctx.supabase,
      ctx.profile.organizationId,
      {
        milestoneId: input.milestoneId,
        studentId: item.studentId,
        submissionId: item.submissionId,
      },
    );
    if (!validated.ok) {
      failureCount += 1;
      results.push({
        studentId: item.studentId,
        ok: false,
        kind: validated.kind,
        message: validated.message,
      });
      continue;
    }

    const existing = await getTeacherAssessmentReviewBySubmissionId(
      ctx.supabase,
      ctx.profile.organizationId,
      item.submissionId,
    );
    if (existing.error || !existing.row || existing.row.id !== item.reviewId) {
      failureCount += 1;
      results.push({
        studentId: item.studentId,
        ok: false,
        kind: "conflict",
        message:
          "別の画面でこの評価が更新されています。再読み込みして内容を確認してください。",
      });
      continue;
    }
    if (existing.row.status !== "completed") {
      failureCount += 1;
      results.push({
        studentId: item.studentId,
        ok: false,
        kind: "validation",
        message: "確定済みの評価のみ返却できます。",
      });
      continue;
    }
    if (isAssessmentReviewCurrentlyReturned(existing.row)) {
      failureCount += 1;
      results.push({
        studentId: item.studentId,
        ok: false,
        kind: "validation",
        message: "すでに学生へ返却済みです。",
      });
      continue;
    }

    const returned = await returnTeacherAssessmentReviewRow(ctx.supabase, {
      organizationId: ctx.profile.organizationId,
      reviewId: item.reviewId,
      baseUpdatedAt: item.baseUpdatedAt,
      actorUserId: ctx.profile.id,
    });
    if (!returned.ok) {
      failureCount += 1;
      results.push({
        studentId: item.studentId,
        ok: false,
        kind: returned.kind,
        message: returned.message,
      });
      continue;
    }

    successCount += 1;
    results.push({
      studentId: item.studentId,
      ok: true,
      message: "学生へ返却しました。",
    });
  }

  return { ok: true, results, successCount, failureCount };
}
