import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  listTeacherAssessmentReviewsForMilestone,
} from "./assessmentReviewRepository";
import {
  logAssessmentDiag,
  supabaseErrFields,
} from "./assessmentDiagnostics";
import {
  ASSESSMENT_RUBRIC_KEYS,
  canCompleteAssessmentReview,
  countRubricScores,
} from "./assessmentRubric";
import { parseSubmissionScope } from "./submissionScope";
import { extractDeadlineAtAtSubmitFromSnapshot } from "./teacherReviewTimingDisplay";
import { isKnownVerificationStudentLoginId } from "./aiEvaluationVerificationAccounts";
import type {
  AssessmentEvaluationType,
  AssessmentLateReviewStatus,
  AssessmentMilestoneStatus,
  AssessmentMilestoneType,
  AssessmentSubmissionScope,
  AssessmentTimingStatus,
} from "./types";

export type TeacherReviewMilestoneSummary = {
  milestoneId: string;
  cycleId: string;
  cycleTitle: string;
  caseId: string;
  title: string;
  description: string | null;
  milestoneType: AssessmentMilestoneType;
  evaluationType: AssessmentEvaluationType;
  deadlineAt: string;
  status: AssessmentMilestoneStatus;
  sequenceNumber: number;
  submissionScope: AssessmentSubmissionScope;
  /** 実学生数（exclude_from_assessment=false） */
  realStudentCount: number;
  submittedStudentCount: number;
  unsubmittedStudentCount: number;
  lateStudentCount: number;
  /** 本番 AI 評価対象（検証用除外） */
  candidateStudentCount: number;
  unevaluatedStudentCount: number;
  /** 検証用学生アカウント数（本番対象外） */
  verificationStudentCount: number;
};

export type TeacherStudentProfile = {
  id: string;
  displayName: string;
  loginId: string;
  studentNumber: string | null;
  /** 本番 AI 評価から除外（検証用）。ログイン・受入テストは可能 */
  excludeFromAssessment: boolean;
};

/** 現在の evaluation candidate に紐づく review 表示状態 */
export type TeacherReviewDisplayStatus =
  | "none"
  | "draft"
  | "completed"
  | "returned"
  | "return_revoked"
  | "no_candidate";

export type TeacherStudentReviewSummary = {
  status: TeacherReviewDisplayStatus;
  reviewId: string | null;
  updatedAt: string | null;
  updatedByName: string | null;
  completedAt: string | null;
  completedByName: string | null;
  returnedAt: string | null;
  scoredCount: number;
  rubricTotal: number;
  hasOverallComment: boolean;
  /** 一覧から一括確定可能か（保存済み draft + 条件充足） */
  canBulkComplete: boolean;
};

export type TeacherStudentSubmissionRow = {
  student: TeacherStudentProfile;
  submissionCount: number;
  latestSubmittedAt: string | null;
  latestTimingStatus: AssessmentTimingStatus | null;
  latestLateReviewStatus: AssessmentLateReviewStatus | null;
  /** snapshot から読んだ提出時 deadlineAt（無い場合 null。推測しない） */
  latestDeadlineAtAtSubmit: string | null;
  hasCandidate: boolean;
  candidateSubmissionId: string | null;
  /** アクティブな AI 評価 staging（needs_review / partially_adopted）があるか */
  hasActiveAiEvaluation: boolean;
  /** @deprecated 提出系の粗い状態。review 表示は reviewSummary を使う */
  evaluationState: "unevaluated" | "no_candidate" | "not_submitted";
  reviewSummary: TeacherStudentReviewSummary;
  isUnsubmitted: boolean;
  isLate: boolean;
  isPendingLateReview: boolean;
  /**
   * この学生の期限後・承認待ち提出 ID（submitted_at 昇順＝古い順）。
   * 一括承認の対象。最新以外の pending も含む。
   */
  pendingLateSubmissionIds: string[];
};

export type TeacherSubmissionHistoryItem = {
  id: string;
  submissionNumber: number;
  submittedAt: string;
  timingStatus: AssessmentTimingStatus;
  lateReviewStatus: AssessmentLateReviewStatus | null;
  isEvaluationCandidate: boolean;
  /** この提出に紐づく review の表示状態（無ければ none） */
  reviewDisplayStatus: Exclude<TeacherReviewDisplayStatus, "no_candidate">;
  sourceVersions: unknown;
  /** snapshot から読んだ提出時 deadlineAt（無い場合 null） */
  deadlineAtAtSubmit: string | null;
  snapshot: unknown;
};

type PgErr = { message?: string; code?: string } | null;

function asTiming(v: unknown): AssessmentTimingStatus {
  return v === "late" ? "late" : "on_time";
}

function asLate(v: unknown): AssessmentLateReviewStatus | null {
  if (v === "pending" || v === "approved" || v === "rejected") return v;
  return null;
}

export async function listActiveStudentsInOrg(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<{ rows: TeacherStudentProfile[]; error: PgErr }> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, login_id, student_number, exclude_from_assessment")
    .eq("organization_id", organizationId)
    .eq("role", "student")
    .eq("is_active", true)
    .order("display_name", { ascending: true });
  if (error) {
    // 列未適用環境向けフォールバック
    const fallback = await supabase
      .from("profiles")
      .select("id, display_name, login_id, student_number")
      .eq("organization_id", organizationId)
      .eq("role", "student")
      .eq("is_active", true)
      .order("display_name", { ascending: true });
    if (fallback.error) return { rows: [], error: fallback.error };
    return {
      rows: ((fallback.data ?? []) as Record<string, unknown>[]).map((r) => ({
        id: String(r.id),
        displayName: String(r.display_name ?? ""),
        loginId: String(r.login_id ?? ""),
        studentNumber:
          typeof r.student_number === "string" ? r.student_number : null,
        excludeFromAssessment: isKnownVerificationStudentLoginId(
          String(r.login_id ?? ""),
        ),
      })),
      error: null,
    };
  }
  return {
    rows: ((data ?? []) as Record<string, unknown>[]).map((r) => ({
      id: String(r.id),
      displayName: String(r.display_name ?? ""),
      loginId: String(r.login_id ?? ""),
      studentNumber:
        typeof r.student_number === "string" ? r.student_number : null,
      excludeFromAssessment: r.exclude_from_assessment === true,
    })),
    error: null,
  };
}

export async function listTeacherReviewMilestoneSummaries(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<{ rows: TeacherReviewMilestoneSummary[]; error: PgErr }> {
  logAssessmentDiag({
    op: "listTeacherReviewMilestones",
    phase: "start",
    organizationId,
  });
  const { data: milestones, error: mErr } = await supabase
    .from("assessment_milestones")
    .select(
      "id, assessment_cycle_id, title, description, milestone_type, evaluation_type, deadline_at, status, sequence_number, submission_scope, organization_id, assessment_cycles!inner(id, title, case_id, organization_id)",
    )
    .eq("organization_id", organizationId)
    .order("deadline_at", { ascending: true });
  if (mErr) {
    logAssessmentDiag({
      op: "listTeacherReviewMilestones.milestones",
      phase: "fail",
      organizationId,
      ...supabaseErrFields(mErr),
    });
    return { rows: [], error: mErr };
  }

  const students = await listActiveStudentsInOrg(supabase, organizationId);
  if (students.error) {
    logAssessmentDiag({
      op: "listTeacherReviewMilestones.students",
      phase: "fail",
      organizationId,
      ...supabaseErrFields(students.error),
    });
    return { rows: [], error: students.error };
  }
  const realStudents = students.rows.filter((s) => !s.excludeFromAssessment);
  const verificationStudentCount = students.rows.filter(
    (s) => s.excludeFromAssessment,
  ).length;
  const realStudentIds = new Set(realStudents.map((s) => s.id));
  const realStudentTotal = realStudents.length;

  const milestoneRows = (milestones ?? []) as Record<string, unknown>[];
  const milestoneIds = milestoneRows.map((m) => String(m.id));

  let submissions: Array<{
    assessment_milestone_id: string;
    student_user_id: string;
    timing_status: string;
  }> = [];
  let candidates: Array<{
    assessment_milestone_id: string;
    student_user_id: string;
  }> = [];

  if (milestoneIds.length > 0) {
    const [{ data: subs, error: subErr }, aiCands, baseCands] = await Promise.all([
      supabase
        .from("assessment_submissions")
        .select("assessment_milestone_id, student_user_id, timing_status")
        .eq("organization_id", organizationId)
        .eq("is_withdrawn", false)
        .in("assessment_milestone_id", milestoneIds),
      supabase
        .from("assessment_ai_evaluation_candidates")
        .select("assessment_milestone_id, student_user_id")
        .eq("organization_id", organizationId)
        .in("assessment_milestone_id", milestoneIds),
      supabase
        .from("assessment_evaluation_candidates")
        .select("assessment_milestone_id, student_user_id")
        .eq("organization_id", organizationId)
        .in("assessment_milestone_id", milestoneIds),
    ]);
    if (subErr) {
      logAssessmentDiag({
        op: "listTeacherReviewMilestones.submissions",
        phase: "fail",
        organizationId,
        ...supabaseErrFields(subErr),
      });
    }
    submissions = (subs ?? []) as typeof submissions;
    if (!aiCands.error) {
      candidates = (aiCands.data ?? []) as typeof candidates;
      logAssessmentDiag({
        op: "listTeacherReviewMilestones.aiCandidates",
        phase: "success",
        organizationId,
        detail: `count=${candidates.length}`,
      });
    } else {
      logAssessmentDiag({
        op: "listTeacherReviewMilestones.aiCandidates",
        phase: "fail",
        organizationId,
        ...supabaseErrFields(aiCands.error),
        detail: "fallback_to_base_candidates",
      });
      // VIEW 未適用時: 基底候補から検証用を除外
      const excluded = new Set(
        students.rows.filter((s) => s.excludeFromAssessment).map((s) => s.id),
      );
      if (baseCands.error) {
        logAssessmentDiag({
          op: "listTeacherReviewMilestones.baseCandidates",
          phase: "fail",
          organizationId,
          ...supabaseErrFields(baseCands.error),
        });
      }
      candidates = ((baseCands.data ?? []) as typeof candidates).filter(
        (c) => !excluded.has(c.student_user_id),
      );
    }
  }

  const rows: TeacherReviewMilestoneSummary[] = milestoneRows.map((m) => {
    const cycle = m.assessment_cycles as Record<string, unknown>;
    const mid = String(m.id);
    const subStudents = new Set<string>();
    const lateStudents = new Set<string>();
    for (const s of submissions) {
      if (s.assessment_milestone_id !== mid) continue;
      if (!realStudentIds.has(s.student_user_id)) continue;
      subStudents.add(s.student_user_id);
      if (s.timing_status === "late") lateStudents.add(s.student_user_id);
    }
    const candStudents = new Set(
      candidates
        .filter((c) => c.assessment_milestone_id === mid)
        .map((c) => c.student_user_id)
        .filter((id) => realStudentIds.has(id)),
    );
    const submitted = subStudents.size;
    const candidateCount = candStudents.size;
    return {
      milestoneId: mid,
      cycleId: String(cycle.id),
      cycleTitle: String(cycle.title),
      caseId: String(cycle.case_id),
      title: String(m.title),
      description: (m.description as string | null) ?? null,
      milestoneType: m.milestone_type as AssessmentMilestoneType,
      evaluationType: m.evaluation_type as AssessmentEvaluationType,
      deadlineAt: String(m.deadline_at),
      status: m.status as AssessmentMilestoneStatus,
      sequenceNumber: Number(m.sequence_number),
      submissionScope: parseSubmissionScope(m.submission_scope),
      realStudentCount: realStudentTotal,
      submittedStudentCount: submitted,
      unsubmittedStudentCount: Math.max(0, realStudentTotal - submitted),
      lateStudentCount: lateStudents.size,
      candidateStudentCount: candidateCount,
      unevaluatedStudentCount: candidateCount,
      verificationStudentCount,
    };
  });

  rows.sort((a, b) => {
    const t = a.cycleTitle.localeCompare(b.cycleTitle, "ja");
    if (t !== 0) return t;
    return a.sequenceNumber - b.sequenceNumber;
  });

  logAssessmentDiag({
    op: "listTeacherReviewMilestones",
    phase: "success",
    organizationId,
    detail: `milestoneCount=${rows.length}`,
  });
  return { rows, error: null };
}

export async function getTeacherMilestoneMeta(
  supabase: SupabaseClient,
  organizationId: string,
  milestoneId: string,
): Promise<{
  row: TeacherReviewMilestoneSummary | null;
  error: PgErr;
}> {
  const listed = await listTeacherReviewMilestoneSummaries(
    supabase,
    organizationId,
  );
  if (listed.error) return { row: null, error: listed.error };
  return {
    row: listed.rows.find((r) => r.milestoneId === milestoneId) ?? null,
    error: null,
  };
}

export async function listTeacherStudentSubmissionRows(
  supabase: SupabaseClient,
  organizationId: string,
  milestoneId: string,
): Promise<{ rows: TeacherStudentSubmissionRow[]; error: PgErr }> {
  logAssessmentDiag({
    op: "listTeacherStudentSubmissionRows",
    phase: "start",
    organizationId,
    milestoneId,
  });
  const students = await listActiveStudentsInOrg(supabase, organizationId);
  if (students.error) {
    logAssessmentDiag({
      op: "listTeacherStudentSubmissionRows.students",
      phase: "fail",
      organizationId,
      milestoneId,
      ...supabaseErrFields(students.error),
    });
    return { rows: [], error: students.error };
  }

  const [
    { data: subs, error: sErr },
    aiCands,
    baseCands,
    reviewsRes,
  ] = await Promise.all([
    supabase
      .from("assessment_submissions")
      .select(
        "id, student_user_id, submission_number, submitted_at, timing_status, late_review_status, snapshot",
      )
      .eq("organization_id", organizationId)
      .eq("assessment_milestone_id", milestoneId)
      .eq("is_withdrawn", false)
      .order("submitted_at", { ascending: false }),
    supabase
      .from("assessment_ai_evaluation_candidates")
      .select("submission_id, student_user_id")
      .eq("organization_id", organizationId)
      .eq("assessment_milestone_id", milestoneId),
    supabase
      .from("assessment_evaluation_candidates")
      .select("submission_id, student_user_id")
      .eq("organization_id", organizationId)
      .eq("assessment_milestone_id", milestoneId),
    listTeacherAssessmentReviewsForMilestone(
      supabase,
      organizationId,
      milestoneId,
    ),
  ]);
  if (sErr) {
    logAssessmentDiag({
      op: "listTeacherStudentSubmissionRows.submissions",
      phase: "fail",
      organizationId,
      milestoneId,
      ...supabaseErrFields(sErr),
    });
    return { rows: [], error: sErr };
  }
  if (reviewsRes.error) {
    logAssessmentDiag({
      op: "listTeacherStudentSubmissionRows.reviews",
      phase: "fail",
      organizationId,
      milestoneId,
      ...supabaseErrFields(reviewsRes.error),
    });
    return { rows: [], error: reviewsRes.error };
  }

  let cands: Array<{ submission_id: string; student_user_id: string }> = [];
  if (!aiCands.error) {
    cands = (aiCands.data ?? []) as typeof cands;
    logAssessmentDiag({
      op: "listTeacherStudentSubmissionRows.aiCandidates",
      phase: "success",
      organizationId,
      milestoneId,
      detail: `count=${cands.length}`,
    });
  } else if (!baseCands.error) {
    logAssessmentDiag({
      op: "listTeacherStudentSubmissionRows.aiCandidates",
      phase: "fail",
      organizationId,
      milestoneId,
      ...supabaseErrFields(aiCands.error),
      detail: "fallback_to_base_candidates",
    });
    const excluded = new Set(
      students.rows.filter((s) => s.excludeFromAssessment).map((s) => s.id),
    );
    cands = ((baseCands.data ?? []) as typeof cands).filter(
      (c) => !excluded.has(c.student_user_id),
    );
  } else {
    logAssessmentDiag({
      op: "listTeacherStudentSubmissionRows.candidates",
      phase: "fail",
      organizationId,
      milestoneId,
      ...supabaseErrFields(baseCands.error ?? aiCands.error),
    });
    return { rows: [], error: baseCands.error ?? aiCands.error };
  }

  const candByStudent = new Map<string, string>();
  const candidateSubmissionIds: string[] = [];
  for (const c of cands) {
    candByStudent.set(c.student_user_id, c.submission_id);
    candidateSubmissionIds.push(c.submission_id);
  }

  const aiActiveBySubmission = new Set<string>();
  if (candidateSubmissionIds.length > 0) {
    const { data: aiRows } = await supabase
      .from("assessment_ai_evaluation_staging")
      .select("assessment_submission_id")
      .eq("organization_id", organizationId)
      .in("assessment_submission_id", candidateSubmissionIds)
      .in("review_status", ["needs_review", "partially_adopted"]);
    for (const r of (aiRows ?? []) as Array<{
      assessment_submission_id: string;
    }>) {
      aiActiveBySubmission.add(r.assessment_submission_id);
    }
  }

  /** candidate submission_id → review（1 submission = 最大1 review） */
  const reviewBySubmissionId = new Map<string, (typeof reviewsRes.rows)[number]>();
  for (const r of reviewsRes.rows) {
    // 同一 submission に複数来ても後勝ちではなく先勝ち（unique 前提の防御）
    if (!reviewBySubmissionId.has(r.assessmentSubmissionId)) {
      reviewBySubmissionId.set(r.assessmentSubmissionId, r);
    }
  }

  const actorIds = new Set<string>();
  for (const r of reviewsRes.rows) {
    actorIds.add(r.updatedBy);
    if (r.completedBy) actorIds.add(r.completedBy);
  }
  const nameById = new Map<string, string>();
  if (actorIds.size > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name")
      .eq("organization_id", organizationId)
      .in("id", [...actorIds]);
    for (const p of (profiles ?? []) as Array<{
      id: string;
      display_name: string | null;
    }>) {
      nameById.set(p.id, String(p.display_name ?? "").trim() || p.id);
    }
  }

  type SubRow = {
    id: string;
    student_user_id: string;
    submission_number: number;
    submitted_at: string;
    timing_status: string;
    late_review_status: string | null;
    snapshot: unknown;
  };
  const byStudent = new Map<string, SubRow[]>();
  for (const s of (subs ?? []) as SubRow[]) {
    const list = byStudent.get(s.student_user_id) ?? [];
    list.push(s);
    byStudent.set(s.student_user_id, list);
  }

  const rubricTotal = ASSESSMENT_RUBRIC_KEYS.length;

  // student_user_id ごとに必ず1行（profiles 重複があっても排除）
  const uniqueStudents: TeacherStudentProfile[] = [];
  const seenStudentIds = new Set<string>();
  for (const student of students.rows) {
    if (seenStudentIds.has(student.id)) continue;
    seenStudentIds.add(student.id);
    uniqueStudents.push(student);
  }

  const rows: TeacherStudentSubmissionRow[] = uniqueStudents.map((student) => {
    const list = byStudent.get(student.id) ?? [];
    const latest = list[0] ?? null;
    const candidateId = candByStudent.get(student.id) ?? null;
    const hasCandidate = Boolean(candidateId);
    const isUnsubmitted = list.length === 0;
    let evaluationState: TeacherStudentSubmissionRow["evaluationState"] =
      "not_submitted";
    if (!isUnsubmitted) {
      evaluationState = hasCandidate ? "unevaluated" : "no_candidate";
    }

    let reviewSummary: TeacherStudentReviewSummary;
    if (!hasCandidate || !candidateId) {
      reviewSummary = {
        status: "no_candidate",
        reviewId: null,
        updatedAt: null,
        updatedByName: null,
        completedAt: null,
        completedByName: null,
        returnedAt: null,
        scoredCount: 0,
        rubricTotal,
        hasOverallComment: false,
        canBulkComplete: false,
      };
    } else {
      const review = reviewBySubmissionId.get(candidateId) ?? null;
      if (!review) {
        reviewSummary = {
          status: "none",
          reviewId: null,
          updatedAt: null,
          updatedByName: null,
          completedAt: null,
          completedByName: null,
          returnedAt: null,
          scoredCount: 0,
          rubricTotal,
          hasOverallComment: false,
          canBulkComplete: false,
        };
      } else {
        const scoredCount = countRubricScores(review.rubricScores);
        const hasOverallComment = review.overallComment.trim().length >= 1;
        const canBulkComplete =
          review.status === "draft" &&
          canCompleteAssessmentReview({
            overallComment: review.overallComment,
            rubricScores: review.rubricScores,
          });
        let status: TeacherReviewDisplayStatus =
          review.status === "completed" ? "completed" : "draft";
        if (review.status === "completed" && review.returnedAt) {
          status = review.returnRevokedAt ? "return_revoked" : "returned";
        }
        reviewSummary = {
          status,
          reviewId: review.id,
          updatedAt: review.updatedAt,
          updatedByName: nameById.get(review.updatedBy) ?? null,
          completedAt: review.completedAt,
          completedByName: review.completedBy
            ? (nameById.get(review.completedBy) ?? null)
            : null,
          returnedAt: review.returnedAt,
          scoredCount,
          rubricTotal,
          hasOverallComment,
          canBulkComplete,
        };
      }
    }

    // list は submitted_at desc。一括承認は古い順に処理する。
    const pendingLateSubmissionIds = list
      .filter(
        (s) =>
          s.timing_status === "late" && s.late_review_status === "pending",
      )
      .map((s) => s.id)
      .reverse();

    return {
      student,
      submissionCount: list.length,
      latestSubmittedAt: latest?.submitted_at ?? null,
      latestTimingStatus: latest ? asTiming(latest.timing_status) : null,
      latestLateReviewStatus: latest
        ? asLate(latest.late_review_status)
        : null,
      latestDeadlineAtAtSubmit: latest
        ? extractDeadlineAtAtSubmitFromSnapshot(latest.snapshot)
        : null,
      hasCandidate,
      candidateSubmissionId: candidateId,
      hasActiveAiEvaluation: candidateId
        ? aiActiveBySubmission.has(candidateId)
        : false,
      evaluationState,
      reviewSummary,
      isUnsubmitted,
      isLate: latest?.timing_status === "late",
      isPendingLateReview: pendingLateSubmissionIds.length > 0,
      pendingLateSubmissionIds,
    };
  });

  logAssessmentDiag({
    op: "listTeacherStudentSubmissionRows",
    phase: "success",
    organizationId,
    milestoneId,
    detail: `rowCount=${rows.length}`,
  });
  return { rows, error: null };
}

export async function getTeacherStudentProfile(
  supabase: SupabaseClient,
  organizationId: string,
  studentId: string,
): Promise<{ row: TeacherStudentProfile | null; error: PgErr }> {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, display_name, login_id, student_number, role, organization_id, exclude_from_assessment",
    )
    .eq("id", studentId)
    .eq("organization_id", organizationId)
    .eq("role", "student")
    .maybeSingle();
  if (error) {
    const fallback = await supabase
      .from("profiles")
      .select("id, display_name, login_id, student_number, role, organization_id")
      .eq("id", studentId)
      .eq("organization_id", organizationId)
      .eq("role", "student")
      .maybeSingle();
    if (fallback.error) return { row: null, error: fallback.error };
    if (!fallback.data) return { row: null, error: null };
    const r = fallback.data as Record<string, unknown>;
    return {
      row: {
        id: String(r.id),
        displayName: String(r.display_name ?? ""),
        loginId: String(r.login_id ?? ""),
        studentNumber:
          typeof r.student_number === "string" ? r.student_number : null,
        excludeFromAssessment: isKnownVerificationStudentLoginId(
          String(r.login_id ?? ""),
        ),
      },
      error: null,
    };
  }
  if (!data) return { row: null, error: null };
  const r = data as Record<string, unknown>;
  return {
    row: {
      id: String(r.id),
      displayName: String(r.display_name ?? ""),
      loginId: String(r.login_id ?? ""),
      studentNumber:
        typeof r.student_number === "string" ? r.student_number : null,
      excludeFromAssessment: r.exclude_from_assessment === true,
    },
    error: null,
  };
}

export async function listTeacherStudentSubmissionHistory(
  supabase: SupabaseClient,
  organizationId: string,
  milestoneId: string,
  studentId: string,
): Promise<{
  items: TeacherSubmissionHistoryItem[];
  candidateSubmissionId: string | null;
  error: PgErr;
}> {
  logAssessmentDiag({
    op: "listTeacherStudentSubmissionHistory",
    phase: "start",
    organizationId,
    milestoneId,
    hasStudentRef: true,
  });
  const [{ data: subs, error: sErr }, { data: cand, error: cErr }, reviewsRes] =
    await Promise.all([
      supabase
        .from("assessment_submissions")
        .select(
          "id, submission_number, submitted_at, timing_status, late_review_status, source_versions, snapshot",
        )
        .eq("organization_id", organizationId)
        .eq("assessment_milestone_id", milestoneId)
        .eq("student_user_id", studentId)
        .eq("is_withdrawn", false)
        .order("submitted_at", { ascending: false }),
      supabase
        .from("assessment_evaluation_candidates")
        .select("submission_id")
        .eq("organization_id", organizationId)
        .eq("assessment_milestone_id", milestoneId)
        .eq("student_user_id", studentId)
        .maybeSingle(),
      listTeacherAssessmentReviewsForMilestone(
        supabase,
        organizationId,
        milestoneId,
      ),
    ]);
  if (sErr) {
    logAssessmentDiag({
      op: "listTeacherStudentSubmissionHistory.submissions",
      phase: "fail",
      organizationId,
      milestoneId,
      hasStudentRef: true,
      ...supabaseErrFields(sErr),
    });
    return { items: [], candidateSubmissionId: null, error: sErr };
  }
  if (cErr) {
    logAssessmentDiag({
      op: "listTeacherStudentSubmissionHistory.candidates",
      phase: "fail",
      organizationId,
      milestoneId,
      hasStudentRef: true,
      ...supabaseErrFields(cErr),
    });
    return { items: [], candidateSubmissionId: null, error: cErr };
  }
  if (reviewsRes.error) {
    logAssessmentDiag({
      op: "listTeacherStudentSubmissionHistory.reviews",
      phase: "fail",
      organizationId,
      milestoneId,
      hasStudentRef: true,
      ...supabaseErrFields(reviewsRes.error),
    });
    return { items: [], candidateSubmissionId: null, error: reviewsRes.error };
  }

  const candidateSubmissionId =
    cand && typeof (cand as { submission_id?: string }).submission_id === "string"
      ? (cand as { submission_id: string }).submission_id
      : null;

  const reviewBySubmission = new Map<
    string,
    (typeof reviewsRes.rows)[number]
  >();
  for (const r of reviewsRes.rows) {
    if (r.studentUserId !== studentId) continue;
    if (!reviewBySubmission.has(r.assessmentSubmissionId)) {
      reviewBySubmission.set(r.assessmentSubmissionId, r);
    }
  }

  const items: TeacherSubmissionHistoryItem[] = (
    (subs ?? []) as Record<string, unknown>[]
  ).map((s) => {
    const id = String(s.id);
    const review = reviewBySubmission.get(id) ?? null;
    let reviewDisplayStatus: TeacherSubmissionHistoryItem["reviewDisplayStatus"] =
      "none";
    if (review) {
      if (review.status === "completed" && review.returnedAt) {
        reviewDisplayStatus = review.returnRevokedAt
          ? "return_revoked"
          : "returned";
      } else {
        reviewDisplayStatus =
          review.status === "completed" ? "completed" : "draft";
      }
    }
    return {
      id,
      submissionNumber: Number(s.submission_number),
      submittedAt: String(s.submitted_at),
      timingStatus: asTiming(s.timing_status),
      lateReviewStatus: asLate(s.late_review_status),
      isEvaluationCandidate: id === candidateSubmissionId,
      reviewDisplayStatus,
      sourceVersions: s.source_versions ?? null,
      deadlineAtAtSubmit: extractDeadlineAtAtSubmitFromSnapshot(s.snapshot),
      snapshot: s.snapshot,
    };
  });

  logAssessmentDiag({
    op: "listTeacherStudentSubmissionHistory",
    phase: "success",
    organizationId,
    milestoneId,
    hasStudentRef: true,
    detail: `itemCount=${items.length};hasCandidate=${Boolean(candidateSubmissionId)}`,
  });
  return { items, candidateSubmissionId, error: null };
}

export async function getTeacherSubmissionById(
  supabase: SupabaseClient,
  organizationId: string,
  milestoneId: string,
  studentId: string,
  submissionId: string,
): Promise<{
  item: TeacherSubmissionHistoryItem | null;
  candidateSubmissionId: string | null;
  error: PgErr;
}> {
  logAssessmentDiag({
    op: "getTeacherSubmissionById",
    phase: "start",
    organizationId,
    milestoneId,
    hasStudentRef: true,
  });
  const history = await listTeacherStudentSubmissionHistory(
    supabase,
    organizationId,
    milestoneId,
    studentId,
  );
  if (history.error) {
    logAssessmentDiag({
      op: "getTeacherSubmissionById",
      phase: "fail",
      organizationId,
      milestoneId,
      hasStudentRef: true,
      ...supabaseErrFields(history.error),
    });
    return { item: null, candidateSubmissionId: null, error: history.error };
  }
  const item = history.items.find((i) => i.id === submissionId) ?? null;
  logAssessmentDiag({
    op: "getTeacherSubmissionById",
    phase: "success",
    organizationId,
    milestoneId,
    hasStudentRef: true,
    detail: `found=${Boolean(item)};hasSnapshot=${item?.snapshot != null}`,
  });
  return {
    item,
    candidateSubmissionId: history.candidateSubmissionId,
    error: null,
  };
}

/** Spec aliases (Sprint 4A) */
export const listTeacherReviewMilestones = listTeacherReviewMilestoneSummaries;
export const getTeacherMilestoneSubmissionSummary = getTeacherMilestoneMeta;
export const getTeacherStudentSubmissionDetail = getTeacherSubmissionById;

export async function getEvaluationCandidateSubmission(
  supabase: SupabaseClient,
  organizationId: string,
  milestoneId: string,
  studentId: string,
): Promise<{ submissionId: string | null; error: PgErr }> {
  const { data, error } = await supabase
    .from("assessment_evaluation_candidates")
    .select("submission_id")
    .eq("organization_id", organizationId)
    .eq("assessment_milestone_id", milestoneId)
    .eq("student_user_id", studentId)
    .maybeSingle();
  if (error) return { submissionId: null, error };
  const id =
    data && typeof (data as { submission_id?: string }).submission_id === "string"
      ? (data as { submission_id: string }).submission_id
      : null;
  return { submissionId: id, error: null };
}
