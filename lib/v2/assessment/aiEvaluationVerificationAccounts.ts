/**
 * 検証用学生アカウントの明示リスト（login_id）。
 * 正本は profiles.exclude_from_assessment。
 * 列未適用環境でのみフォールバックとして参照する（login_id 単独依存の恒久実装にはしない）。
 *
 * 検証用 8ID = 下記6学生 + teacher01 + admin01（スタッフは学生候補に出ない）。
 */
export const KNOWN_VERIFICATION_STUDENT_LOGIN_IDS = [
  "student01",
  "student02",
  "99999991",
  "99999992",
  "19810719",
  "12515054",
] as const;

export function isKnownVerificationStudentLoginId(loginId: string): boolean {
  return (KNOWN_VERIFICATION_STUDENT_LOGIN_IDS as readonly string[]).includes(
    loginId,
  );
}
