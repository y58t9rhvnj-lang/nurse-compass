"use server";

// Compass Version2 — Sprint D-3D / D-3E
// 学生単体登録 Server Action（admin 専用）。
//
// 学生作成のコアは lib/v2/admin/createStudentAccount.ts に集約し、CSV 一括登録と
// 共通化している（作成ロジックの二重実装はしない）。この Action は認可・入力受け取り・
// 初期パスワードの一度きり表示のための薄いラッパー。

import { isSupabaseConfigured } from "@/lib/v2/env";
import { getVerifiedAdminProfile } from "@/lib/v2/auth/currentUser";
import { buildInitialPassword } from "@/lib/v2/auth/initialPassword";
import { createStudentAccount } from "@/lib/v2/admin/createStudentAccount";

export type CreateStudentErrorCode =
  | "validation"
  | "unauthorized"
  | "duplicate_login_id"
  | "auth_create_failed"
  | "profile_create_failed"
  | "compensation_failed"
  | "not_configured";

export type CreateStudentInput = {
  studentNumber: string;
  displayName: string;
};

export type CreateStudentResult =
  | {
      ok: true;
      studentId: string;
      loginId: string;
      displayName: string;
      // 初期パスワードは「この結果」でのみ一度だけ返す。
      // URL・DB・監査ログには入れない。呼び出し側は React state 内でのみ一時保持する。
      initialPassword: string;
      // 監査ログの記録に失敗した場合 true（登録自体は成功）。
      auditWarning: boolean;
    }
  | { ok: false; code: CreateStudentErrorCode; message: string };

export async function createStudentAction(
  input: CreateStudentInput,
): Promise<CreateStudentResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, code: "not_configured", message: "認証基盤が未設定です。" };
  }

  // service role を使う前に、Admin 本人をサーバー側で明示的に確定する。
  const actor = await getVerifiedAdminProfile();
  if (!actor) {
    return { ok: false, code: "unauthorized", message: "権限がありません。" };
  }

  const result = await createStudentAccount({
    actor,
    loginId: input.studentNumber,
    displayName: input.displayName,
    auditSource: "single",
  });

  if (!result.ok) {
    return { ok: false, code: result.code, message: result.message };
  }

  return {
    ok: true,
    studentId: result.studentId,
    loginId: result.loginId,
    displayName: result.displayName,
    // 初期パスワードは共通コアからは返さず、ここで導出して一度だけ表示する。
    initialPassword: buildInitialPassword(result.loginId),
    auditWarning: result.auditWarning,
  };
}
