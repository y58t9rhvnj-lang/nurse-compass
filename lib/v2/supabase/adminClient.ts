import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "@/lib/v2/env";
import { getServiceRoleKey } from "@/lib/v2/env.server";

// service role key を使う「管理用」Supabase クライアント。
//
// このクライアントは RLS を回避できるため危険。用途を厳格に限定する：
//   - アカウント作成用スクリプト（シード）
//   - ごく一部の教員向けサーバー処理（将来）
// 通常の学生・教員データ取得には使わない（必ず serverClient + RLS を使う）。
//
// 先頭の import "server-only" により、Client Component や共有バンドルから
// import するとビルド時にエラーになる（＝ブラウザへ秘密鍵が漏れない）。
export function createAdminSupabaseClient() {
  const url = getSupabaseUrl();
  const serviceRoleKey = getServiceRoleKey();
  if (!url || !serviceRoleKey) {
    // エラーメッセージに鍵の値は含めない。
    throw new Error(
      "Admin クライアントには NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が必要です。",
    );
  }
  return createClient(url, serviceRoleKey, {
    auth: {
      // 管理用途ではセッション永続化・自動更新は不要。
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
