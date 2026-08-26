import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type AiEvaluationWarningAckRow = {
  id: string;
  stagingId: string;
  warningFamily: "version" | "pii";
  warningCode: string;
  warningPayloadHash: string;
  acknowledgedBy: string;
  acknowledgedAt: string;
};

export async function listWarningAcksForStaging(
  supabase: SupabaseClient,
  organizationId: string,
  stagingId: string,
): Promise<
  | { ok: true; rows: AiEvaluationWarningAckRow[] }
  | { ok: false; message: string }
> {
  const { data, error } = await supabase
    .from("assessment_ai_evaluation_warning_acknowledgements")
    .select(
      "id, staging_id, warning_family, warning_code, warning_payload_hash, acknowledged_by, acknowledged_at",
    )
    .eq("organization_id", organizationId)
    .eq("staging_id", stagingId);
  if (error) {
    return { ok: false, message: "警告確認状態を読み込めませんでした。" };
  }
  return {
    ok: true,
    rows: ((data ?? []) as Record<string, unknown>[]).map((r) => ({
      id: String(r.id),
      stagingId: String(r.staging_id),
      warningFamily: r.warning_family === "pii" ? "pii" : "version",
      warningCode: String(r.warning_code),
      warningPayloadHash: String(r.warning_payload_hash),
      acknowledgedBy: String(r.acknowledged_by),
      acknowledgedAt: String(r.acknowledged_at),
    })),
  };
}

export async function rpcAcknowledgeAiEvaluationWarning(
  supabase: SupabaseClient,
  input: {
    stagingId: string;
    warningFamily: "version" | "pii";
    warningCode: string;
    warningPayloadHash: string;
  },
): Promise<
  | { ok: true; ackId: string; acknowledgedAt: string }
  | { ok: false; kind: string; message: string }
> {
  const { data, error } = await supabase.rpc(
    "acknowledge_ai_evaluation_warning",
    {
      p_staging_id: input.stagingId,
      p_warning_family: input.warningFamily,
      p_warning_code: input.warningCode,
      p_warning_payload_hash: input.warningPayloadHash,
    },
  );
  if (error) {
    return {
      ok: false,
      kind: "db_error",
      message: "警告の確認を保存できませんでした。",
    };
  }
  const row = data as Record<string, unknown> | null;
  if (!row || row.ok !== true) {
    const err = typeof row?.error === "string" ? row.error : "db_error";
    const messages: Record<string, string> = {
      unauthorized: "ログインが必要です。",
      teacher_only: "警告の確認は教員のみ実行できます。",
      not_found: "AI評価候補が見つかりません。",
      staging_not_active: "この候補は確認対象ではありません。",
      invalid_candidate: "無効な候補には確認できません。",
      validation: "警告情報の形式が正しくありません。",
    };
    return {
      ok: false,
      kind: err,
      message: messages[err] ?? "警告の確認に失敗しました。",
    };
  }
  return {
    ok: true,
    ackId: String(row.ackId),
    acknowledgedAt: String(row.acknowledgedAt),
  };
}
