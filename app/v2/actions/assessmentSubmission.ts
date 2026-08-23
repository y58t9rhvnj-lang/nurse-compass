"use server";

import { isSupabaseConfigured } from "@/lib/v2/env";
import { getCurrentProfile, type AppProfile } from "@/lib/v2/auth/currentUser";
import { createServerSupabaseClient } from "@/lib/v2/supabase/serverClient";
import { caseIdForPatient } from "@/lib/v2/notebook/caseId";
import { buildAssessmentSnapshot } from "@/lib/v2/assessment/snapshotBuilder";
import {
  listOwnSubmissionsForCase,
  listStudentMilestonesForCase,
  rpcGetAssessmentSubmitPreview,
  rpcListOpenMilestones,
  rpcSubmitAssessmentSubmission,
} from "@/lib/v2/assessment/assessmentRepository";
import { buildStudentSubmissionTasks } from "@/lib/v2/assessment/studentSubmissionTasks";
import { collectForm2Missing } from "@/lib/form2/collectForm2Missing";
import { collectForm3Missing } from "@/lib/form3/v2/collectForm3Missing";
import { getForm2 } from "@/lib/v2/notebook/form2Repository";
import { rowToForm2Snapshot } from "@/lib/v2/notebook/form2Mapper";
import { getForm3 } from "@/lib/v2/notebook/form3Repository";
import { rowToForm3SnapshotV2 } from "@/lib/form3/v2/form3V2Mapper";
import type {
  AssessmentOpenMilestonesResult,
  AssessmentSubmissionListResult,
  AssessmentSubmitErrorKind,
  AssessmentSubmitPreviewResult,
  AssessmentSubmitResult,
  StudentSubmissionTasksResult,
} from "@/lib/v2/assessment/types";
import type { Form3MissingItem } from "@/lib/form3/v2/collectForm3Missing";
import type { AssessmentMilestoneType } from "@/lib/v2/assessment/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type StudentContext =
  | { ok: true; supabase: SupabaseClient; profile: AppProfile }
  | { ok: false; kind: "not_configured" | "unauthorized"; message: string };

async function requireStudentContext(): Promise<StudentContext> {
  if (!isSupabaseConfigured()) {
    return { ok: false, kind: "not_configured", message: "backend not configured" };
  }
  const profile = await getCurrentProfile();
  if (!profile || !profile.isActive || profile.role !== "student") {
    return { ok: false, kind: "unauthorized", message: "student login required" };
  }
  const supabase = await createServerSupabaseClient();
  return { ok: true, supabase, profile };
}

function mapRpcError(
  error: string,
  message?: string,
): { kind: AssessmentSubmitErrorKind; message: string } {
  switch (error) {
    case "unauthorized":
      return {
        kind: "unauthorized",
        message: message ?? "ログインが必要です。",
      };
    case "validation":
      return {
        kind: "validation",
        message: message ?? "入力内容を確認してください。",
      };
    case "not_found":
      return { kind: "not_found", message: message ?? "提出課題が見つかりません" };
    case "not_open":
      return {
        kind: "not_open",
        message: message ?? "この提出課題は現在受付を終了しています。",
      };
    case "duplicate":
      return {
        kind: "duplicate",
        message:
          message ??
          "同じ提出処理がすでに受け付けられています。提出履歴をご確認ください。",
      };
    default:
      return {
        kind: "db_error",
        message: message ?? "提出に失敗しました。時間をおいて再度お試しください。",
      };
  }
}

export async function listOpenAssessmentMilestonesAction(
  patientId: string,
): Promise<AssessmentOpenMilestonesResult> {
  const ctx = await requireStudentContext();
  if (!ctx.ok) return { ok: false, kind: ctx.kind, message: ctx.message };
  const caseId = caseIdForPatient(patientId);
  if (!caseId) return { ok: false, kind: "validation", message: "unknown case" };
  const result = await rpcListOpenMilestones(ctx.supabase, caseId);
  if (!result.ok) {
    const mapped = mapRpcError(result.error, result.message);
    return { ok: false, kind: mapped.kind, message: mapped.message };
  }
  return { ok: true, items: result.items, serverNow: result.serverNow };
}

export async function getAssessmentSubmitPreviewAction(input: {
  patientId: string;
  assessmentMilestoneId: string;
}): Promise<AssessmentSubmitPreviewResult> {
  const ctx = await requireStudentContext();
  if (!ctx.ok) return { ok: false, kind: ctx.kind, message: ctx.message };
  if (!caseIdForPatient(input.patientId)) {
    return { ok: false, kind: "validation", message: "unknown case" };
  }
  const result = await rpcGetAssessmentSubmitPreview(
    ctx.supabase,
    input.assessmentMilestoneId,
  );
  if (!result.ok) {
    const mapped = mapRpcError(result.error, result.message);
    return { ok: false, kind: mapped.kind, message: mapped.message };
  }
  return { ok: true, data: result.data };
}

export async function submitAssessmentAction(input: {
  patientId: string;
  assessmentMilestoneId: string;
  clientRequestId?: string | null;
}): Promise<AssessmentSubmitResult> {
  const ctx = await requireStudentContext();
  if (!ctx.ok) return { ok: false, kind: ctx.kind, message: ctx.message };

  const caseId = caseIdForPatient(input.patientId);
  if (!caseId) return { ok: false, kind: "validation", message: "unknown case" };
  if (!input.assessmentMilestoneId) {
    return { ok: false, kind: "validation", message: "milestone required" };
  }

  const built = await buildAssessmentSnapshot({
    supabase: ctx.supabase,
    userId: ctx.profile.id,
    caseId,
    patientId: input.patientId,
  });
  if (!built.ok) {
    return { ok: false, kind: "db_error", message: built.message };
  }

  const result = await rpcSubmitAssessmentSubmission(ctx.supabase, {
    milestoneId: input.assessmentMilestoneId,
    caseId,
    snapshot: built.data.snapshot,
    sourceVersions: built.data.sourceVersions,
    snapshotSchemaVersion: built.data.schemaVersion,
    clientRequestId: input.clientRequestId ?? null,
  });

  if (!result.ok) {
    const mapped = mapRpcError(result.error, result.message);
    return { ok: false, kind: mapped.kind, message: mapped.message };
  }
  return { ok: true, data: result.data };
}

export async function listMyAssessmentSubmissionsAction(
  patientId: string,
): Promise<AssessmentSubmissionListResult> {
  const ctx = await requireStudentContext();
  if (!ctx.ok) return { ok: false, kind: ctx.kind, message: ctx.message };
  const caseId = caseIdForPatient(patientId);
  if (!caseId) return { ok: false, kind: "validation", message: "unknown case" };

  const listed = await listOwnSubmissionsForCase(
    ctx.supabase,
    ctx.profile.id,
    caseId,
  );
  if (listed.error) {
    return { ok: false, kind: "db_error", message: "failed to load submissions" };
  }
  return {
    ok: true,
    items: listed.items,
    evaluationCandidateIds: listed.evaluationCandidateIds,
  };
}

/** 提出画面・バッジ用: open/closed/archived（見える範囲）＋提出履歴 */
export async function listStudentSubmissionTasksAction(
  patientId: string,
): Promise<StudentSubmissionTasksResult> {
  const ctx = await requireStudentContext();
  if (!ctx.ok) return { ok: false, kind: ctx.kind, message: ctx.message };
  const caseId = caseIdForPatient(patientId);
  if (!caseId) return { ok: false, kind: "validation", message: "unknown case" };

  const [milestones, submissions] = await Promise.all([
    listStudentMilestonesForCase(ctx.supabase, caseId),
    listOwnSubmissionsForCase(ctx.supabase, ctx.profile.id, caseId),
  ]);
  if (milestones.error || submissions.error) {
    return { ok: false, kind: "db_error", message: "提出課題を読み込めませんでした。" };
  }

  const serverNow = new Date().toISOString();
  const built = buildStudentSubmissionTasks({
    milestones: milestones.rows,
    submissions: submissions.items,
    serverNow,
  });
  return {
    ok: true,
    tasks: built.tasks,
    pendingBadgeCount: built.pendingBadgeCount,
    serverNow,
  };
}

export async function getSubmissionPendingBadgeCountAction(
  patientId: string,
): Promise<{ ok: true; count: number } | { ok: false; message: string }> {
  const res = await listStudentSubmissionTasksAction(patientId);
  if (!res.ok) return { ok: false, message: res.message };
  return { ok: true, count: res.pendingBadgeCount };
}

export type SubmissionContentCheckResult =
  | {
      ok: true;
      form2Missing: string[];
      form3Missing: Form3MissingItem[];
      needsForm3Confirm: boolean;
    }
  | { ok: false; kind: string; message: string };

/** 提出直前の未入力確認（最新保存データを再取得） */
export async function getSubmissionContentCheckAction(input: {
  patientId: string;
  milestoneType: AssessmentMilestoneType;
}): Promise<SubmissionContentCheckResult> {
  const ctx = await requireStudentContext();
  if (!ctx.ok) return { ok: false, kind: ctx.kind, message: ctx.message };
  const caseId = caseIdForPatient(input.patientId);
  if (!caseId) return { ok: false, kind: "validation", message: "unknown case" };

  let form2Missing: string[] = [];
  let form3Missing: Form3MissingItem[] = [];
  let studentNumber: string | null = null;
  let studentName: string | null = null;

  const needsForm2 =
    input.milestoneType === "form2" ||
    input.milestoneType === "final" ||
    input.milestoneType === "custom" ||
    input.milestoneType === "form3_progress" ||
    input.milestoneType === "form3_complete";
  const needsForm3 =
    input.milestoneType === "form3_progress" ||
    input.milestoneType === "form3_complete" ||
    input.milestoneType === "final" ||
    input.milestoneType === "custom";

  if (needsForm2 || needsForm3) {
    const { row } = await getForm2(ctx.supabase, ctx.profile.id, caseId);
    if (row) {
      const snap = rowToForm2Snapshot(row, input.patientId);
      studentNumber = snap.payload.student.studentNumber;
      studentName = snap.payload.student.studentName;
      if (needsForm2) {
        form2Missing = collectForm2Missing(snap.payload);
      }
    }
  }

  if (needsForm3) {
    const { row } = await getForm3(ctx.supabase, ctx.profile.id, caseId);
    if (row) {
      const snap = rowToForm3SnapshotV2(row, input.patientId);
      form3Missing = collectForm3Missing(snap.payload, {
        studentNumber,
        studentName,
      });
    }
  }

  return {
    ok: true,
    form2Missing,
    form3Missing,
    needsForm3Confirm: form3Missing.length > 0,
  };
}
