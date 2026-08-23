"use server";

// Compass Version 2.2 Sprint 2 — 課題提出 Server Actions

import { isSupabaseConfigured } from "@/lib/v2/env";
import { getCurrentProfile, type AppProfile } from "@/lib/v2/auth/currentUser";
import { createServerSupabaseClient } from "@/lib/v2/supabase/serverClient";
import { caseIdForPatient } from "@/lib/v2/notebook/caseId";
import { buildAssessmentSnapshot } from "@/lib/v2/assessment/snapshotBuilder";
import {
  listOwnSubmissionsForCase,
  rpcGetAssessmentSubmitPreview,
  rpcSubmitAssessmentSubmission,
} from "@/lib/v2/assessment/assessmentRepository";
import type {
  AssessmentSubmissionListResult,
  AssessmentSubmitErrorKind,
  AssessmentSubmitPreviewResult,
  AssessmentSubmitResult,
} from "@/lib/v2/assessment/types";
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
      return { kind: "unauthorized", message: message ?? "unauthorized" };
    case "validation":
      return { kind: "validation", message: message ?? "invalid input" };
    case "no_open_cycle":
      return {
        kind: "no_open_cycle",
        message: message ?? "提出期間が設定されていません",
      };
    case "ambiguous_cycle":
      return {
        kind: "ambiguous_cycle",
        message: message ?? "提出期間の設定に不備があります",
      };
    case "duplicate":
      return { kind: "duplicate", message: message ?? "duplicate submission" };
    default:
      return { kind: "db_error", message: message ?? "failed to submit" };
  }
}

/** 提出確認 Dialog 用（サーバ時刻・期限・late 予告） */
export async function getAssessmentSubmitPreviewAction(
  patientId: string,
): Promise<AssessmentSubmitPreviewResult> {
  const ctx = await requireStudentContext();
  if (!ctx.ok) return { ok: false, kind: ctx.kind, message: ctx.message };

  const caseId = caseIdForPatient(patientId);
  if (!caseId) return { ok: false, kind: "validation", message: "unknown case" };

  const result = await rpcGetAssessmentSubmitPreview(ctx.supabase, caseId);
  if (!result.ok) {
    const mapped = mapRpcError(result.error, result.message);
    return { ok: false, kind: mapped.kind, message: mapped.message };
  }
  return { ok: true, data: result.data };
}

/** 課題提出（Form2/Form3 共通。両様式を含む snapshot を1件作成） */
export async function submitAssessmentAction(input: {
  patientId: string;
  clientRequestId?: string | null;
}): Promise<AssessmentSubmitResult> {
  const ctx = await requireStudentContext();
  if (!ctx.ok) return { ok: false, kind: ctx.kind, message: ctx.message };

  const caseId = caseIdForPatient(input.patientId);
  if (!caseId) return { ok: false, kind: "validation", message: "unknown case" };

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

/** 自分の提出履歴 + 評価候補 */
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
    evaluationCandidateId: listed.evaluationCandidateId,
    deadlineAt: listed.deadlineAt,
    cycleTitle: listed.cycleTitle,
  };
}
