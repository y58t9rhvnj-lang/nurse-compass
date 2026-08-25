/** Client-safe return-state helpers (no server-only imports). */

/** 学生に可視な返却状態（取消済みは不可視） */
export function isAssessmentReviewVisibleToStudent(row: {
  returnedAt: string | null;
  returnRevokedAt: string | null;
}): boolean {
  return Boolean(row.returnedAt) && !row.returnRevokedAt;
}

/** 返却中（取消されていない） */
export function isAssessmentReviewCurrentlyReturned(row: {
  returnedAt: string | null;
  returnRevokedAt: string | null;
}): boolean {
  return isAssessmentReviewVisibleToStudent(row);
}
