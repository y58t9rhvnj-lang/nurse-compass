import { NextResponse } from "next/server";
import { getAuthEmailDomain } from "@/lib/v2/env.server";
import { isSupabaseConfigured } from "@/lib/v2/env";
import { loginIdToAuthEmail, normalizeLoginId } from "@/lib/v2/auth/loginId";
import { createServerSupabaseClient } from "@/lib/v2/supabase/serverClient";

// 個人ID＋パスワードでログインする Route Handler（公開ルート）。
//
// サーバー側で login_id を正規化 → 仮想メールへ変換 → signInWithPassword。
// 仮想メールはレスポンス・ログへ一切出さない。
// 失敗理由は特定させないよう、常に同一の一般的メッセージを返す。
const GENERIC_ERROR = "IDまたはパスワードが正しくありません。";

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "認証基盤が未設定です。管理者にお問い合わせください。" },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "不正なリクエストです。" }, { status: 400 });
  }

  const rawLoginId =
    body && typeof body === "object" && "loginId" in body
      ? String((body as Record<string, unknown>).loginId ?? "")
      : "";
  const password =
    body && typeof body === "object" && "password" in body
      ? String((body as Record<string, unknown>).password ?? "")
      : "";

  let email: string;
  try {
    email = loginIdToAuthEmail(normalizeLoginId(rawLoginId), getAuthEmailDomain());
  } catch {
    // 不正な login_id 形式でも詳細は返さない。
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }
  if (!password) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error || !data.user) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  // 無効化ユーザーはサインインさせない（プロフィール is_active を確認）。
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!profile || profile.is_active !== true) {
    await supabase.auth.signOut();
    return NextResponse.json(
      { error: "このアカウントは現在利用できません。" },
      { status: 403 },
    );
  }

  return NextResponse.json({ ok: true });
}
