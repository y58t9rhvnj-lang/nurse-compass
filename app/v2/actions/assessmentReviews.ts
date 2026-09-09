"use server";

import { isSupabaseConfigured } from "@/lib/v2/env";
import { getCurrentProfile, type AppProfile } from "@/lib/v2/auth/currentUser";
import { createServerSupabaseClient } from "@/lib/v2/supabase/serverClient";
import { patientIdForCaseId } from "@/lib/v2/notebook/caseId";
import {
  logAssessmentDiag,
  supabaseErrFields,
} from "@/lib/v2/assessment/assessmentDiagnostics";
import {
  getTeacherMilestoneMeta,
  getTeacherStudentProfile,
  getTeacherSubmissionById,
  listActiveStudentsInOrg,
  listTeacherReviewMilestoneSummaries,
  listTeacherStudentSubmissionHistory,
  listTeacherStudentSubmissionRows,
  type TeacherReviewMilestoneSummary,
  type TeacherStudentSubmissionRow,
  type TeacherSubmissionHistoryItem,
  type TeacherStudentProfile,
} from "@/lib/v2/assessment/teacherReviewRepository";
import {
  parseAssessmentSnapshot,
  type SnapshotReadModel,
} from "@/lib/v2/assessment/snapshotReadModel";
import type { SupabaseClient } from "@supabase/supabase-js";

type HistoryMeta = Omit<TeacherSubmissionHistoryItem, "snapshot">;

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

export async function listTeacherReviewMilestonesAction(): Promise<
  | { ok: true; milestones: TeacherReviewMilestoneSummary[]; activeStudentTotal: number }
  | { ok: false; kind: string; message: string }
> {
  const ctx = await requireStaffContext();
  if (!ctx.ok) return ctx;
  const [listed, students] = await Promise.all([
    listTeacherReviewMilestoneSummaries(
      ctx.supabase,
      ctx.profile.organizationId,
    ),
    listActiveStudentsInOrg(ctx.supabase, ctx.profile.organizationId),
  ]);
  if (listed.error || students.error) {
    return { ok: false, kind: "db_error", message: "課題一覧を読み込めませんでした。" };
  }
  return {
    ok: true,
    milestones: listed.rows,
    activeStudentTotal: students.rows.length,
  };
}

export async function getTeacherMilestoneSubmissionSummaryAction(
  milestoneId: string,
): Promise<
  | { ok: true; milestone: TeacherReviewMilestoneSummary }
  | { ok: false; kind: string; message: string }
> {
  const ctx = await requireStaffContext();
  if (!ctx.ok) return ctx;
  if (!milestoneId) {
    return { ok: false, kind: "validation", message: "課題が指定されていません。" };
  }
  const got = await getTeacherMilestoneMeta(
    ctx.supabase,
    ctx.profile.organizationId,
    milestoneId,
  );
  if (got.error) {
    return { ok: false, kind: "db_error", message: "課題情報を読み込めませんでした。" };
  }
  if (!got.row) {
    return { ok: false, kind: "not_found", message: "課題が見つかりません。" };
  }
  return { ok: true, milestone: got.row };
}

export async function listTeacherStudentSubmissionRowsAction(
  milestoneId: string,
): Promise<
  | {
      ok: true;
      milestone: TeacherReviewMilestoneSummary;
      rows: TeacherStudentSubmissionRow[];
    }
  | { ok: false; kind: string; message: string }
> {
  const ctx = await requireStaffContext();
  if (!ctx.ok) return ctx;
  const summary = await getTeacherMilestoneMeta(
    ctx.supabase,
    ctx.profile.organizationId,
    milestoneId,
  );
  if (summary.error) {
    return { ok: false, kind: "db_error", message: "課題情報を読み込めませんでした。" };
  }
  if (!summary.row) {
    return { ok: false, kind: "not_found", message: "課題が見つかりません。" };
  }
  const listed = await listTeacherStudentSubmissionRows(
    ctx.supabase,
    ctx.profile.organizationId,
    milestoneId,
  );
  if (listed.error) {
    return { ok: false, kind: "db_error", message: "学生一覧を読み込めませんでした。" };
  }
  return { ok: true, milestone: summary.row, rows: listed.rows };
}

function stripSnapshot(item: TeacherSubmissionHistoryItem): HistoryMeta {
  const { snapshot: _snap, ...rest } = item;
  return rest;
}

export async function listTeacherStudentSubmissionHistoryAction(input: {
  milestoneId: string;
  studentId: string;
}): Promise<
  | {
      ok: true;
      items: HistoryMeta[];
      candidateSubmissionId: string | null;
    }
  | { ok: false; kind: string; message: string }
> {
  const ctx = await requireStaffContext();
  if (!ctx.ok) return ctx;
  const student = await getTeacherStudentProfile(
    ctx.supabase,
    ctx.profile.organizationId,
    input.studentId,
  );
  if (student.error) {
    return { ok: false, kind: "db_error", message: "学生情報を読み込めませんでした。" };
  }
  if (!student.row) {
    return { ok: false, kind: "not_found", message: "学生が見つかりません。" };
  }
  const milestone = await getTeacherMilestoneMeta(
    ctx.supabase,
    ctx.profile.organizationId,
    input.milestoneId,
  );
  if (!milestone.row) {
    return { ok: false, kind: "not_found", message: "課題が見つかりません。" };
  }
  const history = await listTeacherStudentSubmissionHistory(
    ctx.supabase,
    ctx.profile.organizationId,
    input.milestoneId,
    input.studentId,
  );
  if (history.error) {
    return { ok: false, kind: "db_error", message: "提出履歴を読み込めませんでした。" };
  }
  return {
    ok: true,
    items: history.items.map(stripSnapshot),
    candidateSubmissionId: history.candidateSubmissionId,
  };
}

export async function getTeacherStudentSubmissionDetailAction(input: {
  milestoneId: string;
  studentId: string;
  submissionId?: string | null;
}): Promise<
  | {
      ok: true;
      milestone: TeacherReviewMilestoneSummary;
      student: TeacherStudentProfile;
      history: HistoryMeta[];
      candidateSubmissionId: string | null;
      viewingSubmissionId: string | null;
      isViewingCandidate: boolean;
      readModel: SnapshotReadModel | null;
    }
  | { ok: false; kind: string; message: string }
> {
  const ctx = await requireStaffContext();
  if (!ctx.ok) return ctx;

  logAssessmentDiag({
    op: "getTeacherStudentSubmissionDetailAction",
    phase: "start",
    organizationId: ctx.profile.organizationId,
    role: ctx.profile.role,
    milestoneId: input.milestoneId,
    hasStudentRef: true,
  });

  const [milestone, student] = await Promise.all([
    getTeacherMilestoneMeta(
      ctx.supabase,
      ctx.profile.organizationId,
      input.milestoneId,
    ),
    getTeacherStudentProfile(
      ctx.supabase,
      ctx.profile.organizationId,
      input.studentId,
    ),
  ]);
  if (milestone.error || student.error) {
    logAssessmentDiag({
      op: "getTeacherStudentSubmissionDetailAction",
      phase: "fail",
      organizationId: ctx.profile.organizationId,
      role: ctx.profile.role,
      milestoneId: input.milestoneId,
      hasStudentRef: true,
      ...supabaseErrFields(milestone.error ?? student.error),
      detail: "milestone_or_student_lookup",
    });
    return { ok: false, kind: "db_error", message: "情報を読み込めませんでした。" };
  }
  if (!milestone.row) {
    return { ok: false, kind: "not_found", message: "課題が見つかりません。" };
  }
  if (!student.row) {
    return { ok: false, kind: "not_found", message: "学生が見つかりません。" };
  }

  const history = await listTeacherStudentSubmissionHistory(
    ctx.supabase,
    ctx.profile.organizationId,
    input.milestoneId,
    input.studentId,
  );
  if (history.error) {
    logAssessmentDiag({
      op: "getTeacherStudentSubmissionDetailAction.history",
      phase: "fail",
      organizationId: ctx.profile.organizationId,
      role: ctx.profile.role,
      milestoneId: input.milestoneId,
      hasStudentRef: true,
      ...supabaseErrFields(history.error),
    });
    return { ok: false, kind: "db_error", message: "提出履歴を読み込めませんでした。" };
  }

  const candidateId = history.candidateSubmissionId;
  const requestedId = input.submissionId?.trim() || null;
  let viewing =
    (requestedId
      ? history.items.find((i) => i.id === requestedId)
      : null) ??
    (candidateId
      ? history.items.find((i) => i.id === candidateId)
      : null) ??
    history.items[0] ??
    null;

  // Ensure requested submission belongs to this student+milestone
  if (requestedId && !history.items.some((i) => i.id === requestedId)) {
    return { ok: false, kind: "not_found", message: "提出が見つかりません。" };
  }

  const patientId = patientIdForCaseId(milestone.row.caseId) ?? "A";

  let readModel: SnapshotReadModel | null = null;
  if (viewing) {
    const full = await getTeacherSubmissionById(
      ctx.supabase,
      ctx.profile.organizationId,
      input.milestoneId,
      input.studentId,
      viewing.id,
    );
    if (full.item?.snapshot != null) {
      logAssessmentDiag({
        op: "parseAssessmentSnapshot",
        phase: "start",
        organizationId: ctx.profile.organizationId,
        role: ctx.profile.role,
        milestoneId: input.milestoneId,
        hasStudentRef: true,
      });
      try {
        readModel = parseAssessmentSnapshot(full.item.snapshot, patientId);
        logAssessmentDiag({
          op: "parseAssessmentSnapshot",
          phase: "success",
          organizationId: ctx.profile.organizationId,
          role: ctx.profile.role,
          milestoneId: input.milestoneId,
          hasStudentRef: true,
          detail: `ok=${readModel.ok}`,
        });
      } catch (e) {
        logAssessmentDiag({
          op: "parseAssessmentSnapshot",
          phase: "fail",
          organizationId: ctx.profile.organizationId,
          role: ctx.profile.role,
          milestoneId: input.milestoneId,
          hasStudentRef: true,
          error: e,
        });
        throw e;
      }
    }
  }

  logAssessmentDiag({
    op: "getTeacherStudentSubmissionDetailAction",
    phase: "success",
    organizationId: ctx.profile.organizationId,
    role: ctx.profile.role,
    milestoneId: input.milestoneId,
    hasStudentRef: true,
    detail: `historyCount=${history.items.length};hasReadModel=${Boolean(readModel)}`,
  });

  return {
    ok: true,
    milestone: milestone.row,
    student: student.row,
    history: history.items.map(stripSnapshot),
    candidateSubmissionId: candidateId,
    viewingSubmissionId: viewing?.id ?? null,
    isViewingCandidate: Boolean(
      viewing && candidateId && viewing.id === candidateId,
    ),
    readModel,
  };
}

export async function getEvaluationCandidateSubmissionAction(input: {
  milestoneId: string;
  studentId: string;
}): Promise<
  | { ok: true; submissionId: string | null }
  | { ok: false; kind: string; message: string }
> {
  const detail = await getTeacherStudentSubmissionDetailAction({
    milestoneId: input.milestoneId,
    studentId: input.studentId,
  });
  if (!detail.ok) return detail;
  return { ok: true, submissionId: detail.candidateSubmissionId };
}
