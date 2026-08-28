"use server";

import { isSupabaseConfigured } from "@/lib/v2/env";
import { isServiceRoleConfigured } from "@/lib/v2/env.server";
import { getCurrentProfile } from "@/lib/v2/auth/currentUser";
import { createServerSupabaseClient } from "@/lib/v2/supabase/serverClient";
import { getTeacherMilestoneMeta } from "@/lib/v2/assessment/teacherReviewRepository";
import {
  executeBatchExport,
  executeBatchImportZip,
  previewBatchExport,
  previewBatchImportZip,
} from "@/lib/v2/assessment/aiEvaluationBatch";

async function requireStaff() {
  if (!isSupabaseConfigured()) {
    return {
      ok: false as const,
      kind: "not_configured",
      message: "backend not configured",
    };
  }
  const profile = await getCurrentProfile();
  if (
    !profile ||
    !profile.isActive ||
    (profile.role !== "teacher" && profile.role !== "admin")
  ) {
    return {
      ok: false as const,
      kind: "unauthorized",
      message: "staff login required",
    };
  }
  if (!isServiceRoleConfigured()) {
    return {
      ok: false as const,
      kind: "not_configured",
      message: "service role が設定されていません。",
    };
  }
  const supabase = await createServerSupabaseClient();
  return { ok: true as const, supabase, profile };
}

export async function previewBatchAiExportAction(input: {
  milestoneId: string;
  submissionIds?: string[] | null;
}) {
  const ctx = await requireStaff();
  if (!ctx.ok) return ctx;
  const meta = await getTeacherMilestoneMeta(
    ctx.supabase,
    ctx.profile.organizationId,
    input.milestoneId,
  );
  if (meta.error || !meta.row) {
    return { ok: false as const, kind: "not_found", message: "課題が見つかりません。" };
  }
  return previewBatchExport({
    supabase: ctx.supabase,
    profile: ctx.profile,
    milestoneId: meta.row.milestoneId,
    milestoneTitle: meta.row.title,
    submissionScope: meta.row.submissionScope,
    submissionIds: input.submissionIds,
    unsubmittedStudentCount: null,
  });
}

export async function exportBatchAiPackagesAction(input: {
  milestoneId: string;
  submissionIds?: string[] | null;
}) {
  const ctx = await requireStaff();
  if (!ctx.ok) return ctx;
  const meta = await getTeacherMilestoneMeta(
    ctx.supabase,
    ctx.profile.organizationId,
    input.milestoneId,
  );
  if (meta.error || !meta.row) {
    return { ok: false as const, kind: "not_found", message: "課題が見つかりません。" };
  }
  return executeBatchExport({
    supabase: ctx.supabase,
    profile: ctx.profile,
    milestoneId: meta.row.milestoneId,
    milestoneTitle: meta.row.title,
    submissionScope: meta.row.submissionScope,
    submissionIds: input.submissionIds,
  });
}

export async function previewBatchAiImportAction(input: {
  zipBase64: string;
  fileName?: string;
}) {
  const ctx = await requireStaff();
  if (!ctx.ok) return ctx;
  return previewBatchImportZip({
    profile: ctx.profile,
    zipBase64: input.zipBase64,
    fileName: input.fileName,
  });
}

export async function importBatchAiResultsAction(input: {
  zipBase64: string;
  fileName?: string;
}) {
  const ctx = await requireStaff();
  if (!ctx.ok) return ctx;
  return executeBatchImportZip({
    profile: ctx.profile,
    zipBase64: input.zipBase64,
    fileName: input.fileName,
  });
}
