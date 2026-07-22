// 初期パスワードの生成（純粋関数・環境非依存）。
//
// 正式ルール: 初期パスワードは "P" + 学籍番号(=login_id, 8桁)。
// 一般パスワード検証（passwordPolicy.ts）とは責務を分ける:
//   ・ここは「初期パスワードの生成」だけを担う。
//   ・生成した初期パスワードは初回ログイン後に必ず変更させる（must_change_password）。
//   ・秘密情報だが固定規則のため、値の保存・ログ出力は呼び出し側で行わないこと。

export function buildInitialPassword(loginId: string): string {
  return `P${loginId}`;
}
