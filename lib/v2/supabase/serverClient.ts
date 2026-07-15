import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/v2/env";

// Server Component / Route Handler / Server Action 用の Supabase クライアント。
//
// publishable(anon) キー＋リクエストのセッション Cookie で動作するため、
// 「そのユーザーの権限」で RLS が正しく効く（service role は使わない）。
//
// 認可判断では getSession() が返す user を信用しないこと。
// 本人確認・権限判定には getClaims()（高速なローカル検証）を優先し、
// 厳密さが必要な変更系では getUser()（Auth サーバーへ問い合わせ）を使う。
export async function createServerSupabaseClient() {
  const url = getSupabaseUrl();
  const key = getSupabasePublishableKey();
  if (!url || !key) {
    throw new Error(
      "Supabase の公開環境変数が未設定です（NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY）。",
    );
  }

  // Next.js 16 では cookies() は非同期。
  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Component からは Cookie を書き込めない。
          // セッション更新は proxy(updateV2Session) が担うため無視してよい。
        }
      },
    },
  });
}
