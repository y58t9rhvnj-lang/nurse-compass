// パスワード要件の判定（純粋関数・環境非依存）。
//
// このモジュールは秘密情報を扱わず、環境にも依存しない純粋関数のみ。
// そのためサーバー・クライアント・スクリプト(tsx)のどこからでも import できる
// （"server-only" は付けない）。将来の CSV 一括登録でも同じ規則を再利用する。
//
// 方針:
//   - 8〜72 文字（72 は bcrypt のバイト上限に由来する安全側の上限）
//   - 英字を1文字以上・数字を1文字以上含む
//   - パスワードそのものは戻り値・ログへ出さない（呼び出し側も同様）

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;

export type PasswordCheckResult =
  | { ok: true }
  | { ok: false; message: string };

// 新しいパスワードが要件を満たすか判定する。理由はユーザー向け日本語で返す。
export function checkPasswordPolicy(password: string): PasswordCheckResult {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return {
      ok: false,
      message: `パスワードは${PASSWORD_MIN_LENGTH}文字以上にしてください。`,
    };
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return {
      ok: false,
      message: `パスワードは${PASSWORD_MAX_LENGTH}文字以内にしてください。`,
    };
  }
  if (!/[A-Za-z]/.test(password)) {
    return { ok: false, message: "英字を1文字以上含めてください。" };
  }
  if (!/[0-9]/.test(password)) {
    return { ok: false, message: "数字を1文字以上含めてください。" };
  }
  return { ok: true };
}

// 新パスワードと確認用の一致も含めた総合判定。
export function validateNewPassword(
  password: string,
  confirm: string,
): PasswordCheckResult {
  const policy = checkPasswordPolicy(password);
  if (!policy.ok) return policy;
  if (password !== confirm) {
    return { ok: false, message: "確認用パスワードが一致しません。" };
  }
  return { ok: true };
}
