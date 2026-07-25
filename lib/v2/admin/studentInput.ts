// 学生登録の入力検証（純粋関数・環境非依存）。
//
// クライアント/サーバー双方で再利用する（"server-only" は付けない）。
// ただし最終的な正はサーバー側の検証とする。

// 学籍番号: 半角数字8桁。全角数字は自動変換せずエラーにする。
export const STUDENT_NUMBER_PATTERN = /^\d{8}$/;

// 氏名の最大文字数（過剰な文字種制限はしない。長さのみ制限）。
export const DISPLAY_NAME_MAX_LENGTH = 100;

export type FieldCheck =
  | { ok: true; value: string }
  | { ok: false; message: string };

// 学籍番号を検証して正規化（trim）した値を返す。
export function validateStudentNumber(raw: string): FieldCheck {
  const value = raw.trim();
  if (value.length === 0) {
    return { ok: false, message: "学籍番号を入力してください。" };
  }
  if (!STUDENT_NUMBER_PATTERN.test(value)) {
    return {
      ok: false,
      message: "学籍番号は半角数字8桁で入力してください。",
    };
  }
  return { ok: true, value };
}

// 氏名を検証して正規化（前後空白除去）した値を返す。
export function validateDisplayName(raw: string): FieldCheck {
  const value = raw.trim();
  if (value.length === 0) {
    return { ok: false, message: "氏名を入力してください。" };
  }
  if (value.length > DISPLAY_NAME_MAX_LENGTH) {
    return {
      ok: false,
      message: `氏名は${DISPLAY_NAME_MAX_LENGTH}文字以内で入力してください。`,
    };
  }
  return { ok: true, value };
}
