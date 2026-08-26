"use server";

import { isSupabaseConfigured } from "@/lib/v2/env";
import { getCurrentProfile, type AppProfile } from "@/lib/v2/auth/currentUser";
import { createServerSupabaseClient } from "@/lib/v2/supabase/serverClient";
import { rpcAcknowledgeAiEvaluationWarning } from "@/lib/v2/assessment/aiEvaluationWarningRepository";
import type { SupabaseClient } from "@supabase/supabase-js";

type TeacherContext =
  | { ok: true; supabase: SupabaseClient; profile: AppProfile }
  | { ok: false; kind: string; message: string };

async function requireTeacherContext(): Promise<TeacherContext> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      kind: "not_configured",
      message: "backend not configured",
    };
  }
  const profile = await getCurrentProfile();
  if (!profile || !profile.isActive || profile.role !== "teacher") {
    return {
      ok: false,
      kind: "teacher_only",
      message: "警告の確認は教員のみ実行できます。",
    };
  }
  const supabase = await createServerSupabaseClient();
  return { ok: true, supabase, profile };
}

export async function acknowledgeAiEvaluationWarningAction(input: {
  stagingId: string;
  warningFamily: "version" | "pii";
  warningCode: string;
  warningPayloadHash: string;
}): Promise<
  | { ok: true; ackId: string; acknowledgedAt: string }
  | { ok: false; kind: string; message: string }
> {
  const ctx = await requireTeacherContext();
  if (!ctx.ok) return ctx;

  if (
    !input.stagingId.trim() ||
    !input.warningCode.trim() ||
    !input.warningPayloadHash.trim() ||
    (input.warningFamily !== "version" && input.warningFamily !== "pii")
  ) {
    return {
      ok: false,
      kind: "validation",
      message: "警告情報の形式が正しくありません。",
    };
  }

  return rpcAcknowledgeAiEvaluationWarning(ctx.supabase, {
    stagingId: input.stagingId,
    warningFamily: input.warningFamily,
    warningCode: input.warningCode.trim(),
    warningPayloadHash: input.warningPayloadHash.trim(),
  });
}

/** UI の「すべて確認」用。各警告を個別 RPC で記録する（一括 boolean は作らない）。 */
export async function acknowledgeAllAiEvaluationWarningsAction(input: {
  stagingId: string;
  warnings: Array<{
    warningFamily: "version" | "pii";
    warningCode: string;
    warningPayloadHash: string;
  }>;
}): Promise<
  | { ok: true; acknowledgedCount: number }
  | { ok: false; kind: string; message: string }
> {
  const ctx = await requireTeacherContext();
  if (!ctx.ok) return ctx;
  if (!input.stagingId.trim() || !Array.isArray(input.warnings)) {
    return { ok: false, kind: "validation", message: "入力が不正です。" };
  }

  let n = 0;
  for (const w of input.warnings) {
    const res = await rpcAcknowledgeAiEvaluationWarning(ctx.supabase, {
      stagingId: input.stagingId,
      warningFamily: w.warningFamily,
      warningCode: w.warningCode,
      warningPayloadHash: w.warningPayloadHash,
    });
    if (!res.ok) return res;
    n += 1;
  }
  return { ok: true, acknowledgedCount: n };
}
