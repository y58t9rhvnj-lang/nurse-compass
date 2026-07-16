// 個人ID（login_id）の正規化と、内部Auth識別子（仮想メール）への変換。
//
// このモジュールは秘密情報を扱わず、環境にも依存しない純粋関数のみ。
// そのためサーバー・クライアント・スクリプト(tsx)のどこからでも import できる
//（"server-only" は付けない）。ドメインは呼び出し側が渡す。
//
// 方針:
//   - login_id は英数字とハイフンのみ許可
//   - 正規化は trim → 小文字化
//   - 正規化後の login_id を一意に扱う（DB 側 unique 制約と一致させる）
//   - 仮想メールは画面・URL・学習ログに出さない（内部専用）

const LOGIN_ID_PATTERN = /^[a-z0-9-]+$/;

export function isValidLoginId(raw: string): boolean {
  const normalized = raw.trim().toLowerCase();
  return normalized.length > 0 && LOGIN_ID_PATTERN.test(normalized);
}

// 正規化して返す。不正な文字を含む場合は例外を投げる。
export function normalizeLoginId(raw: string): string {
  const normalized = raw.trim().toLowerCase();
  if (normalized.length === 0 || !LOGIN_ID_PATTERN.test(normalized)) {
    throw new Error("login_id は英数字とハイフンのみ使用できます。");
  }
  return normalized;
}

// 正規化済み login_id と内部ドメインから仮想メールを生成する。
// 例: normalizeLoginId("S001") + "students.compass.invalid"
//     → "s001@students.compass.invalid"
export function loginIdToAuthEmail(
  normalizedLoginId: string,
  domain: string,
): string {
  const d = domain.trim().toLowerCase();
  if (!d) throw new Error("内部Authドメイン（V2_AUTH_EMAIL_DOMAIN）が未設定です。");
  return `${normalizedLoginId}@${d}`;
}
