import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  listTeacherAssessmentReviewsForMilestone,
} from "./assessmentReviewRepository";
import {
  ASSESSMENT_RUBRIC_KEYS,
  canCompleteAssessmentReview,
  countRubricScores,
} from "./assessmentRubric";
import { parseSubmissionScope } from "./submissionScope";
import { extractDeadlineAtAtSubmitFromSnapshot } from "./teacherReviewTimingDisplay";
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
  submittedStudentCount: number;
  unsubmittedStudentCount: number;
  lateStudentCount: number;
  candidateStudentCount: number;
  unevaluatedStudentCount: number;
};

export type TeacherStudentProfile = {
  id: string;
  displayName: string;
  loginId: string;
  studentNumber: string | null;
};

/** 現在の evaluation candidate に紐づく review 表示状態 */
export type TeacherReviewDisplayStatus =
  | "none"
  | "draft"
  | "completed"
  | "no_candidate";

export type TeacherStudentReviewSummary = {
  status: TeacherReviewDisplayStatus;
  reviewId: string | null;
  updatedAt: string | null;
  updatedByName: string | null;
  completedAt: string | null;
  completedByName: string | null;
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
  /** @deprecated 提出系の粗い状態。review 表示は reviewSummary を使う */
  evaluationState: "unevaluated" | "no_candidate" | "not_submitted";
  reviewSummary: TeacherStudentReviewSummary;
  isUnsubmitted: boolean;
  isLate: boolean;
  isPendingLateReview: boolean;
};

export type TeacherSubmissionHistoryItem = {
  id: string;
  submissionNumber: number;
  submittedAt: string;
  timingStatus: AssessmentTimingStatus;
  lateReviewStatus: AssessmentLateReviewStatus | null;
  isEvaluationCandidate: boolean;
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
    .select("id, display_name, login_id, student_number")
    .eq("organization_id", organizationId)
    .eq("role", "student")
    .eq("is_active", true)
    .order("display_name", { ascending: true });
  if (error) return { rows: [], error };
  return {
    rows: ((data ?? []) as Record<string, unknown>[]).map((r) => ({
      id: String(r.id),
      displayName: String(r.display_name ?? ""),
      loginId: String(r.login_id ?? ""),
      studentNumber:
        typeof r.student_number === "string" ? r.student_number : null,
    })),
    error: null,
  };
}

export async function listTeacherReviewMilestoneSummaries(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<{ rows: TeacherReviewMilestoneSummary[]; error: PgErr }> {
  const { data: milestones, error: mErr } = await supabase
    .from("assessment_milestones")
    .select(
      "id, assessment_cycle_id, title, description, milestone_type, evaluation_type, deadline_at, status, sequence_number, submission_scope, organization_id, assessment_cycles!inner(id, title, case_id, organization_id)",
    )
    .eq("organization_id", organizationId)
    .order("deadline_at", { ascending: true });
  if (mErr) return { rows: [], error: mErr };

  const students = await listActiveStudentsInOrg(supabase, organizationId);
  if (students.error) return { rows: [], error: students.error };
  const studentTotal = students.rows.length;
  const studentIds = new Set(students.rows.map((s) => s.id));

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
    const [{ data: subs }, { data: cands }] = await Promise.all([
      supabase
        .from("assessment_submissions")
        .select("assessment_milestone_id, student_user_id, timing_status")
        .eq("organization_id", organizationId)
        .eq("is_withdrawn", false)
        .in("assessment_milestone_id", milestoneIds),
      supabase
        .from("assessment_evaluation_candidates")
        .select("assessment_milestone_id, student_user_id")
        .eq("organization_id", organizationId)
        .in("assessment_milestone_id", milestoneIds),
    ]);
    submissions = (subs ?? []) as typeof submissions;
    candidates = (cands ?? []) as typeof candidates;
  }

  const rows: TeacherReviewMilestoneSummary[] = milestoneRows.map((m) => {
    const cycle = m.assessment_cycles as Record<string, unknown>;
    const mid = String(m.id);
    const subStudents = new Set<string>();
    const lateStudents = new Set<string>();
    for (const s of submissions) {
      if (s.assessment_milestone_id !== mid) continue;
      if (!studentIds.has(s.student_user_id)) continue;
      subStudents.add(s.student_user_id);
      if (s.timing_status === "late") lateStudents.add(s.student_user_id);
    }
    const candStudents = new Set(
      candidates
        .filter((c) => c.assessment_milestone_id === mid)
        .map((c) => c.student_user_id)
        .filter((id) => studentIds.has(id)),
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
      submittedStudentCount: submitted,
      unsubmittedStudentCount: Math.max(0, studentTotal - submitted),
      lateStudentCount: lateStudents.size,
      candidateStudentCount: candidateCount,
      unevaluatedStudentCount: candidateCount,
    };
  });

  rows.sort((a, b) => {
    const t = a.cycleTitle.localeCompare(b.cycleTitle, "ja");
    if (t !== 0) return t;
    return a.sequenceNumber - b.sequenceNumber;
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
  const students = await listActiveStudentsInOrg(supabase, organizationId);
  if (students.error) return { rows: [], error: students.error };

  const [
    { data: subs, error: sErr },
    { data: cands, error: cErr },
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
  if (sErr) return { rows: [], error: sErr };
  if (cErr) return { rows: [], error: cErr };
  if (reviewsRes.error) return { rows: [], error: reviewsRes.error };

  const candByStudent = new Map<string, string>();
  for (const c of (cands ?? []) as Array<{
    submission_id: string;
    student_user_id: string;
  }>) {
    candByStudent.set(c.student_user_id, c.submission_id);
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
        reviewSummary = {
          status: review.status === "completed" ? "completed" : "draft",
          reviewId: review.id,
          updatedAt: review.updatedAt,
          updatedByName: nameById.get(review.updatedBy) ?? null,
          completedAt: review.completedAt,
          completedByName: review.completedBy
            ? (nameById.get(review.completedBy) ?? null)
            : null,
          scoredCount,
          rubricTotal,
          hasOverallComment,
          canBulkComplete,
        };
      }
    }

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
      evaluationState,
      reviewSummary,
      isUnsubmitted,
      isLate: latest?.timing_status === "late",
      isPendingLateReview: latest?.late_review_status === "pending",
    };
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
    .select("id, display_name, login_id, student_number, role, organization_id")
    .eq("id", studentId)
    .eq("organization_id", organizationId)
    .eq("role", "student")
    .maybeSingle();
  if (error) return { row: null, error };
  if (!data) return { row: null, error: null };
  const r = data as Record<string, unknown>;
  return {
    row: {
      id: String(r.id),
      displayName: String(r.display_name ?? ""),
      loginId: String(r.login_id ?? ""),
      studentNumber:
        typeof r.student_number === "string" ? r.student_number : null,
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
  const [{ data: subs, error: sErr }, { data: cand, error: cErr }] =
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
    ]);
  if (sErr) return { items: [], candidateSubmissionId: null, error: sErr };
  if (cErr) return { items: [], candidateSubmissionId: null, error: cErr };

  const candidateSubmissionId =
    cand && typeof (cand as { submission_id?: string }).submission_id === "string"
      ? (cand as { submission_id: string }).submission_id
      : null;

  const items: TeacherSubmissionHistoryItem[] = (
    (subs ?? []) as Record<string, unknown>[]
  ).map((s) => ({
    id: String(s.id),
    submissionNumber: Number(s.submission_number),
    submittedAt: String(s.submitted_at),
    timingStatus: asTiming(s.timing_status),
    lateReviewStatus: asLate(s.late_review_status),
    isEvaluationCandidate: String(s.id) === candidateSubmissionId,
    sourceVersions: s.source_versions ?? null,
    deadlineAtAtSubmit: extractDeadlineAtAtSubmitFromSnapshot(s.snapshot),
    snapshot: s.snapshot,
  }));

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
  const history = await listTeacherStudentSubmissionHistory(
    supabase,
    organizationId,
    milestoneId,
    studentId,
  );
  if (history.error) {
    return { item: null, candidateSubmissionId: null, error: history.error };
  }
  return {
    item: history.items.find((i) => i.id === submissionId) ?? null,
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
