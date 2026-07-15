import "server-only";

// Version2 の「サーバー専用」環境変数（秘密情報）を読み出すモジュール。
//
// 先頭の import "server-only" により、このモジュールが Client Component や
// 共有クライアントバンドルへ混入するとビルド時にエラーになる。
// service role key はここでのみ読み、ブラウザ・ログ・エラーへ出さない。

// service role key（RLS を回避できる秘密鍵）。
// 指定の名称を優先し、Supabase 新方式の secret key 名にもフォールバックする。
export function getServiceRoleKey(): string | undefined {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY
  );
}

export function isServiceRoleConfigured(): boolean {
  return Boolean(getServiceRoleKey());
}

// 個人ID → 内部Auth識別子（仮想メール）変換に使う内部ドメイン。
// 実在組織ドメインと衝突しないよう、既定値は .invalid（RFC 6761 予約）を使う。
export function getAuthEmailDomain(): string {
  return process.env.V2_AUTH_EMAIL_DOMAIN ?? "students.compass.invalid";
}
