import "server-only";

// 管理者操作の監査ログ writer（server-only）。
//
// 役割:
//   管理者による「本体操作の成功後」に、監査ログを1件だけ登録する。
//   service role client を使うため server-only（ブラウザへ露出しない）。
//
// 記録してはいけない情報（呼び出し側・metadata の双方で厳守）:
//   ・パスワード / 初期パスワード
//   ・Supabase Auth のトークン
//   ・Cookie / セッション情報
//   ・CSV ファイルの全内容
//   ・必要以上の個人情報
//   metadata には「件数」「対象種別」「結果サマリ」等、追跡に必要な最小限のみ。

import { createAdminSupabaseClient } from "@/lib/v2/supabase/adminClient";
import { isServiceRoleConfigured } from "@/lib/v2/env.server";
import type { AdminAuditAction, AdminAuditTargetType } from "./auditTypes";

export type WriteAdminAuditLogInput = {
  actorUserId: string;
  actorLoginId: string;
  actorRole: "admin";
  organizationId: string;
  action: AdminAuditAction;
  targetType: AdminAuditTargetType;
  targetId?: string | null;
  targetLoginId?: string | null;
  summary: string;
  metadata?: Record<string, unknown>;
};

export type AuditLogResult =
  | { ok: true; auditLogId: string }
  | { ok: false; errorCode: "not_configured" | "insert_failed" };

// 監査ログを1件登録する。成功時は auditLogId を返す。
// 生の DB エラーは戻り値へ出さず、errorCode のみで表現する。
export async function writeAdminAuditLog(
  input: WriteAdminAuditLogInput,
): Promise<AuditLogResult> {
  if (!isServiceRoleConfigured()) {
    return { ok: false, errorCode: "not_configured" };
  }

  const admin = createAdminSupabaseClient();

  const { data, error } = await admin
    .from("admin_audit_logs")
    .insert({
      organization_id: input.organizationId,
      actor_user_id: input.actorUserId,
      actor_login_id: input.actorLoginId,
      actor_role: input.actorRole,
      action: input.action,
      target_type: input.targetType,
      target_id: input.targetId ?? null,
      target_login_id: input.targetLoginId ?? null,
      summary: input.summary,
      metadata: input.metadata ?? {},
    })
    .select("id")
    .single();

  if (error || !data) {
    // 生エラーの内容（メッセージ・詳細）は戻り値へ出さない。
    // サーバー側での検知用に、秘密情報を含まない一般メッセージのみ記録する。
    console.error("[auditLog] failed to insert admin audit log");
    return { ok: false, errorCode: "insert_failed" };
  }

  return { ok: true, auditLogId: data.id as string };
}
