"use server";

import { isSupabaseConfigured } from "@/lib/v2/env";
import { getCurrentProfile } from "@/lib/v2/auth/currentUser";
import { createServerSupabaseClient } from "@/lib/v2/supabase/serverClient";

type RpcResult =
  | {
      ok: true;
      submissionId: string;
      decision: "approved" | "rejected";
      submissionNumber: number;
      previousCandidateSubmissionId: string | null;
      newCandidateSubmissionId: string | null;
      candidateChanged: boolean;
    }
  | { ok: false; kind: string; message: string };

function mapRpcPayload(raw: unknown): RpcResult {
  if (!raw || typeof raw !== "object") {
    return { ok: false, kind: "db_error", message: "応答を解釈できませんでした。" };
  }
  const o = raw as Record<string, unknown>;
  if (o.ok === true) {
    return {
      ok: true,
      submissionId: String(o.submissionId ?? ""),
      decision: o.decision === "rejected" ? "rejected" : "approved",
      submissionNumber: Number(o.submissionNumber ?? 0),
      previousCandidateSubmissionId:
        typeof o.previousCandidateSubmissionId === "string"
          ? o.previousCandidateSubmissionId
          : null,
      newCandidateSubmissionId:
        typeof o.newCandidateSubmissionId === "string"
          ? o.newCandidateSubmissionId
          : null,
      candidateChanged: Boolean(o.candidateChanged),
    };
  }
  const err = String(o.error ?? "db_error");
  if (err === "conflict" || o.message === "already_reviewed") {
    return {
      ok: false,
      kind: "conflict",
      message:
        "別の画面で状態が更新されています。再読み込みして内容を確認してください。",
    };
  }
  if (err === "unauthorized") {
    return { ok: false, kind: "unauthorized", message: "操作権限がありません。" };
  }
  if (err === "not_found") {
    return { ok: false, kind: "not_found", message: "提出が見つかりません。" };
  }
  if (err === "validation") {
    return {
      ok: false,
      kind: "validation",
      message:
        o.message === "note_too_long"
          ? "理由は1000文字以内で入力してください。"
          : "この提出は承認・却下できません。",
    };
  }
  return { ok: false, kind: "db_error", message: "処理に失敗しました。" };
}

function sanitizeNote(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t) return null;
  return t.slice(0, 1000);
}

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
  const supabase = await createServerSupabaseClient();
  return { ok: true as const, supabase, profile };
}

export async function approveLateAssessmentSubmissionAction(input: {
  submissionId: string;
  note?: string | null;
}): Promise<RpcResult> {
  const ctx = await requireStaff();
  if (!ctx.ok) return ctx;
  const note = sanitizeNote(input.note);
  if (typeof input.note === "string" && input.note.trim().length > 1000) {
    return {
      ok: false,
      kind: "validation",
      message: "理由は1000文字以内で入力してください。",
    };
  }
  const { data, error } = await ctx.supabase.rpc(
    "approve_late_assessment_submission",
    {
      p_submission_id: input.submissionId,
      p_note: note,
    },
  );
  if (error) {
    return { ok: false, kind: "db_error", message: "承認に失敗しました。" };
  }
  return mapRpcPayload(data);
}

export async function rejectLateAssessmentSubmissionAction(input: {
  submissionId: string;
  note?: string | null;
}): Promise<RpcResult> {
  const ctx = await requireStaff();
  if (!ctx.ok) return ctx;
  if (typeof input.note === "string" && input.note.trim().length > 1000) {
    return {
      ok: false,
      kind: "validation",
      message: "理由は1000文字以内で入力してください。",
    };
  }
  const note = sanitizeNote(input.note);
  const { data, error } = await ctx.supabase.rpc(
    "reject_late_assessment_submission",
    {
      p_submission_id: input.submissionId,
      p_note: note,
    },
  );
  if (error) {
    return { ok: false, kind: "db_error", message: "却下に失敗しました。" };
  }
  return mapRpcPayload(data);
}

export type BulkApproveLateItemResult = {
  submissionId: string;
  ok: boolean;
  kind?: string;
  message: string;
};

/**
 * 期限後・承認待ち提出の一括承認。個別 approve と同じ RPC を逐次呼び出し。
 */
export async function bulkApproveLateAssessmentSubmissionsAction(input: {
  submissionIds: string[];
}): Promise<
  | {
      ok: true;
      results: BulkApproveLateItemResult[];
      successCount: number;
      failureCount: number;
    }
  | { ok: false; kind: string; message: string }
> {
  const ctx = await requireStaff();
  if (!ctx.ok) {
    return { ok: false, kind: ctx.kind, message: "staff login required" };
  }

  if (!Array.isArray(input.submissionIds) || input.submissionIds.length === 0) {
    return {
      ok: false,
      kind: "validation",
      message: "承認する提出がありません。",
    };
  }
  if (input.submissionIds.length > 200) {
    return {
      ok: false,
      kind: "validation",
      message: "一度に承認できる件数は200件までです。",
    };
  }

  const seen = new Set<string>();
  const results: BulkApproveLateItemResult[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (const submissionId of input.submissionIds) {
    if (!submissionId || seen.has(submissionId)) continue;
    seen.add(submissionId);

    const { data, error } = await ctx.supabase.rpc(
      "approve_late_assessment_submission",
      {
        p_submission_id: submissionId,
        p_note: null,
      },
    );
    if (error) {
      failureCount += 1;
      results.push({
        submissionId,
        ok: false,
        kind: "db_error",
        message: "承認に失敗しました。",
      });
      continue;
    }
    const mapped = mapRpcPayload(data);
    if (!mapped.ok) {
      failureCount += 1;
      results.push({
        submissionId,
        ok: false,
        kind: mapped.kind,
        message: mapped.message,
      });
      continue;
    }
    successCount += 1;
    results.push({
      submissionId,
      ok: true,
      message: "承認しました。",
    });
  }

  return { ok: true, results, successCount, failureCount };
}
