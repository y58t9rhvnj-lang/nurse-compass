"use server";

// Compass Version2 — Sprint D-3B
// 初回パスワード変更 Server Action（ログイン中の本人専用）。
//
// 方針:
//   ・本人確認は getUser()（Auth サーバーへ問い合わせる厳密版）で行い、
//     クライアント申告の id は一切信用しない。対象は常に auth.uid()。
//   ・パスワード要件はサーバー側でも再検証する（クライアント検証だけに依存しない）。
//   ・Supabase Auth のパスワードは本人セッションの updateUser で更新する。
//   ・profiles には authenticated 向け UPDATE ポリシーが無いため、
//     フラグ更新は service role クライアントで id = 本人 に限定して行う
//     （学生が任意の行・任意のフラグを書き換える経路を作らない）。
//   ・パスワードや内部情報はログ・戻り値へ出さない（分類済みメッセージのみ）。

import { isSupabaseConfigured } from "@/lib/v2/env";
import { createServerSupabaseClient } from "@/lib/v2/supabase/serverClient";
import { createAdminSupabaseClient } from "@/lib/v2/supabase/adminClient";
import { validateNewPassword } from "@/lib/v2/auth/passwordPolicy";

// code で失敗種別を区別する（画面はメッセージ表示のみだが、
// "profile_update" は「パスワードは変更済み」を利用者へ明示する特別扱い）。
export type ChangePasswordResult =
  | { ok: true }
  | {
      ok: false;
      code:
        | "not_configured"
        | "validation"
        | "unauthorized"
        | "not_required"
        | "auth_update"
        | "profile_update";
      message: string;
    };

// パスワードは変更済みだが、初回設定の完了処理（フラグ保存）だけ失敗した場合の文言。
// 生の DB エラー・パスワードは含めない。
const PROFILE_UPDATE_FAILED_MESSAGE =
  "パスワードは変更されましたが、初回設定の完了処理に失敗しました。新しいパスワードで再ログインしてください。解消しない場合は管理者へ連絡してください。";

export async function changePasswordAction(
  newPassword: string,
  confirmPassword: string,
): Promise<ChangePasswordResult> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      code: "not_configured",
      message: "認証基盤が未設定です。管理者にお問い合わせください。",
    };
  }

  // 入力検証（サーバー側でも実施）。
  const policy = validateNewPassword(newPassword, confirmPassword);
  if (!policy.ok) {
    return { ok: false, code: "validation", message: policy.message };
  }

  const supabase = await createServerSupabaseClient();

  // 本人確認は Auth サーバーへ問い合わせる getUser() を使用（厳密版）。
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData?.user;
  if (userError || !user) {
    return {
      ok: false,
      code: "unauthorized",
      message: "セッションが無効です。再度ログインしてください。",
    };
  }

  // 有効なアカウントか、かつ「初回変更が必要な状態か」を profiles で確認する。
  // 画面リダイレクトだけに依存せず、Action 側でも状態を検証する。
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_active, must_change_password")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || profile.is_active !== true) {
    return {
      ok: false,
      code: "unauthorized",
      message: "このアカウントは現在利用できません。",
    };
  }
  // 初回変更が不要なユーザーからの直接呼び出しは拒否する
  // （この Action は初回パスワード設定専用。任意変更は別導線で実装予定）。
  if (profile.must_change_password !== true) {
    return {
      ok: false,
      code: "not_required",
      message: "この操作は現在利用できません。",
    };
  }

  // 1) Supabase Auth のパスワードを更新（本人セッション）。
  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });
  if (updateError) {
    // 生エラーは返さない（新旧同一等の詳細も伏せる）。
    return {
      ok: false,
      code: "auth_update",
      message: "パスワードを更新できませんでした。入力内容をご確認ください。",
    };
  }

  // 2) profiles のフラグを更新（service role・本人 id 限定）。
  //    パスワードは更新済みなので、ここが失敗しても新パスワードでログイン可能。
  //    その場合は次回も変更画面へ誘導されるため、安全側に倒れる。
  //    入力エラー(auth_update)とは区別し、「変更済み」であることを利用者へ伝える。
  const admin = createAdminSupabaseClient();
  const { error: flagError } = await admin
    .from("profiles")
    .update({
      must_change_password: false,
      password_changed_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (flagError) {
    return {
      ok: false,
      code: "profile_update",
      message: PROFILE_UPDATE_FAILED_MESSAGE,
    };
  }

  return { ok: true };
}
