// Version2 の「公開してよい」環境変数だけを型安全に読み出すモジュール。
//
// ここで扱うのは NEXT_PUBLIC_ で始まる、ブラウザへ露出してよい値のみ。
// service role key などの秘密情報は絶対に参照しない
// （秘密情報は lib/v2/env.server.ts で "server-only" 付きでのみ読む）。
//
// Next.js は process.env.NEXT_PUBLIC_* を「その参照箇所」でビルド時に
// 文字列置換するため、必ず直接プロパティアクセスで書く。

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

// Supabase は従来の anon key を publishable key へ移行中のため、
// 新方式(publishable)を優先し、既存プロジェクトの anon key へフォールバックする。
const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function getSupabaseUrl(): string | undefined {
  return SUPABASE_URL;
}

export function getSupabasePublishableKey(): string | undefined {
  return SUPABASE_PUBLISHABLE_KEY;
}

// 公開クライアントを構築できる最低限の設定が揃っているか。
export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
}

// 未設定時に「何が足りないか」を安全に列挙する（値そのものは返さない）。
export function missingPublicSupabaseEnv(): string[] {
  const missing: string[] = [];
  if (!SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!SUPABASE_PUBLISHABLE_KEY) {
    missing.push(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY（または既存プロジェクトなら NEXT_PUBLIC_SUPABASE_ANON_KEY）",
    );
  }
  return missing;
}
