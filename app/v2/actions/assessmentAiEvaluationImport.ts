"use server";

import { isSupabaseConfigured } from "@/lib/v2/env";
import { isServiceRoleConfigured } from "@/lib/v2/env.server";
import { getCurrentProfile, type AppProfile } from "@/lib/v2/auth/currentUser";
import { createServerSupabaseClient } from "@/lib/v2/supabase/serverClient";
import { createAdminSupabaseClient } from "@/lib/v2/supabase/adminClient";
import {
  importAiEvaluationResult,
  previewAiEvaluationImport,
  type ImportAiEvaluationResult,
  type PreviewAiEvaluationImportResult,
} from "@/lib/v2/assessment/aiEvaluationImportCore";
import type { SupabaseClient } from "@supabase/supabase-js";

// Do not `export type` from "use server" files: Next/Turbopack may register
// type-only names as server references → ReferenceError at module evaluation.

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

/** 取込前プレビュー（DB 書き込みなし） */
export async function previewAiEvaluationImportAction(input: {
  fileName: string;
  jsonText: string;
}): Promise<PreviewAiEvaluationImportResult> {
  const ctx = await requireStaffContext();
  if (!ctx.ok) return ctx;
  if (!isServiceRoleConfigured()) {
    return {
      ok: false,
      kind: "not_configured",
      message: "service role が設定されていないため取込できません。",
    };
  }

  const admin = createAdminSupabaseClient();
  return previewAiEvaluationImport({
    admin,
    organizationId: ctx.profile.organizationId,
    fileName: input.fileName,
    jsonText: input.jsonText,
  });
}

/** 1ファイル = 1 result を staging へ取込 */
export async function importAiEvaluationResultAction(input: {
  fileName: string;
  jsonText: string;
}): Promise<ImportAiEvaluationResult> {
  const ctx = await requireStaffContext();
  if (!ctx.ok) return ctx;
  if (!isServiceRoleConfigured()) {
    return {
      ok: false,
      kind: "not_configured",
      message: "service role が設定されていないため取込できません。",
    };
  }

  const admin = createAdminSupabaseClient();
  const actorRole = ctx.profile.role === "admin" ? "admin" : "teacher";
  return importAiEvaluationResult({
    admin,
    actor: {
      userId: ctx.profile.id,
      loginId: ctx.profile.loginId,
      organizationId: ctx.profile.organizationId,
      role: actorRole,
    },
    fileName: input.fileName,
    jsonText: input.jsonText,
  });
}
