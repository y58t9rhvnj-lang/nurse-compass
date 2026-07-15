"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/v2/env";

// ブラウザ(Client Component)用の Supabase クライアント。
// publishable(anon) キーのみを使用し、秘密鍵は絶対に渡さない。
// Cookie の保存はライブラリ側が自動で行う。
export function createBrowserSupabaseClient() {
  const url = getSupabaseUrl();
  const key = getSupabasePublishableKey();
  if (!url || !key) {
    throw new Error(
      "Supabase の公開環境変数が未設定です（NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY）。",
    );
  }
  return createBrowserClient(url, key);
}
