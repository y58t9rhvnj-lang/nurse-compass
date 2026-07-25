import "server-only";

// 学生アカウント作成の共通コア（server-only）。
//
// 単体登録・CSV 一括登録の「両方」からこの関数を使い、作成ロジックを二重実装しない。
// 呼び出し側は事前に getVerifiedAdminProfile() で actor を確定して渡すこと
// （この関数自身は認可 redirect を行わない）。
//
// 処理順:
//   入力検証 → 重複確認 → 初期パスワード生成 → Auth 作成 → profiles 作成
//   → profile 失敗時の Auth 補償削除 → 監査ログ
//
// 秘密情報（初期パスワード・内部メール・トークン）はログ・戻り値・監査へ出さない。
// 初期パスワードはこの関数から返さない（必要なら呼び出し側で buildInitialPassword で導出）。

import { getAuthEmailDomain } from "@/lib/v2/env.server";
import { createAdminSupabaseClient } from "@/lib/v2/supabase/adminClient";
import { loginIdToAuthEmail, normalizeLoginId } from "@/lib/v2/auth/loginId";
import { buildInitialPassword } from "@/lib/v2/auth/initialPassword";
import type { AppProfile } from "@/lib/v2/auth/currentUser";
import {
  validateDisplayName,
  validateStudentNumber,
} from "@/lib/v2/admin/studentInput";
import { writeAdminAuditLog } from "@/lib/v2/admin/auditLog";
import {
  ADMIN_AUDIT_ACTIONS,
  ADMIN_AUDIT_TARGET_TYPES,
} from "@/lib/v2/admin/auditTypes";

export type StudentAccountAuditSource = "single" | "csv_import";

export type CreateStudentAccountErrorCode =
  | "validation"
  | "duplicate_login_id"
  | "auth_create_failed"
  | "profile_create_failed"
  | "compensation_failed";

export type CreateStudentAccountInput = {
  actor: AppProfile; // 検証済み admin（getVerifiedAdminProfile 済み）
  loginId: string; // CSV/フォームの学籍番号（未正規化可・内部で検証）
  displayName: string;
  auditSource: StudentAccountAuditSource;
};

export type CreateStudentAccountResult =
  | {
      ok: true;
      studentId: string;
      loginId: string;
      displayName: string;
      auditWarning: boolean;
    }
  | { ok: false; code: CreateStudentAccountErrorCode; message: string };

function looksLikeDuplicate(message: string | undefined): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    m.includes("already been registered") ||
    m.includes("already registered") ||
    m.includes("already exists") ||
    m.includes("duplicate")
  );
}

export async function createStudentAccount(
  input: CreateStudentAccountInput,
): Promise<CreateStudentAccountResult> {
  // 1) 入力検証（サーバー側の正）。
  const numberCheck = validateStudentNumber(input.loginId);
  if (!numberCheck.ok) {
    return { ok: false, code: "validation", message: numberCheck.message };
  }
  const nameCheck = validateDisplayName(input.displayName);
  if (!nameCheck.ok) {
    return { ok: false, code: "validation", message: nameCheck.message };
  }

  let loginId: string;
  try {
    loginId = normalizeLoginId(numberCheck.value);
  } catch {
    return {
      ok: false,
      code: "validation",
      message: "学籍番号の形式が正しくありません。",
    };
  }

  // 固定値（クライアント入力・自由入力を使わない）。
  const organizationId = input.actor.organizationId;
  const displayName = nameCheck.value;
  const initialPassword = buildInitialPassword(loginId);
  const email = loginIdToAuthEmail(loginId, getAuthEmailDomain());

  const admin = createAdminSupabaseClient();

  // 2) 事前重複チェック（login_id はシステム全体一意）。
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("login_id", loginId)
    .maybeSingle();
  if (existing) {
    return {
      ok: false,
      code: "duplicate_login_id",
      message: "この学籍番号はすでに登録されています。",
    };
  }

  // 3) Auth ユーザー作成（内部メール変換は既存ルールを再利用）。
  const { data: userRes, error: authError } = await admin.auth.admin.createUser({
    email,
    password: initialPassword,
    email_confirm: true,
    user_metadata: { login_id: loginId },
  });

  if (authError || !userRes?.user) {
    if (looksLikeDuplicate(authError?.message)) {
      return {
        ok: false,
        code: "duplicate_login_id",
        message: "この学籍番号はすでに登録されています。",
      };
    }
    return {
      ok: false,
      code: "auth_create_failed",
      message: "アカウントの作成に失敗しました。時間をおいて再度お試しください。",
    };
  }

  const userId = userRes.user.id;

  // 4) profiles 作成。role/is_active/must_change_password/password_changed_at は固定。
  const { error: profileError } = await admin.from("profiles").insert({
    id: userId,
    organization_id: organizationId,
    login_id: loginId,
    student_number: loginId,
    display_name: displayName,
    role: "student",
    is_active: true,
    must_change_password: true,
    password_changed_at: null,
    // academic_year / created_at / updated_at は DB default。
  });

  if (profileError) {
    // 5) 補償削除: 孤立した Auth ユーザーを消す。
    const { error: delError } = await admin.auth.admin.deleteUser(userId);
    if (delError) {
      // 重大: Auth ユーザー残存。固定文言のみ記録
      // （パスワード・氏名・内部メール・学籍番号・トークンは出さない）。
      console.error(
        "[createStudentAccount] compensation deleteUser failed: orphan auth user remains",
      );
      return {
        ok: false,
        code: "compensation_failed",
        message: "登録処理で重大なエラーが発生しました。管理者へ連絡してください。",
      };
    }
    if (profileError.code === "23505") {
      return {
        ok: false,
        code: "duplicate_login_id",
        message: "この学籍番号はすでに登録されています。",
      };
    }
    return {
      ok: false,
      code: "profile_create_failed",
      message: "アカウント情報の保存に失敗しました。もう一度お試しください。",
    };
  }

  // 6) 監査ログ（初期パスワード・氏名・内部メール等は入れない）。
  const audit = await writeAdminAuditLog({
    actorUserId: input.actor.id,
    actorLoginId: input.actor.loginId,
    actorRole: "admin",
    organizationId,
    action: ADMIN_AUDIT_ACTIONS.USER_CREATE,
    targetType: ADMIN_AUDIT_TARGET_TYPES.USER,
    targetId: userId,
    targetLoginId: loginId,
    summary: "学生アカウントを作成しました",
    metadata: { role: "student", source: input.auditSource },
  });

  return {
    ok: true,
    studentId: userId,
    loginId,
    displayName,
    auditWarning: !audit.ok,
  };
}
