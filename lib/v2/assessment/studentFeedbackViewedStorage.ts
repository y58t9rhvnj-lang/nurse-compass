/** 学生フィードバック既読（端末内）。DB に viewed 列が無いため localStorage で代替。 */

const STORAGE_KEY = "nc:studentFeedbackViewedReviewIds:v1";

function readSet(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(
      parsed.filter((id): id is string => typeof id === "string" && id.length > 0),
    );
  } catch {
    return new Set();
  }
}

function writeSet(ids: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // quota / private mode
  }
}

export function isStudentFeedbackReviewViewed(reviewId: string): boolean {
  if (!reviewId) return false;
  return readSet().has(reviewId);
}

/** idempotent: 既に既読なら false、新規既読なら true */
export function markStudentFeedbackReviewViewed(reviewId: string): boolean {
  if (!reviewId) return false;
  const set = readSet();
  if (set.has(reviewId)) return false;
  set.add(reviewId);
  writeSet(set);
  return true;
}

export function countUnviewedStudentFeedbackReviews(
  reviewIds: readonly string[],
): number {
  const viewed = readSet();
  let n = 0;
  for (const id of reviewIds) {
    if (id && !viewed.has(id)) n += 1;
  }
  return n;
}

/** 返却一覧に無い既読IDを掃除（任意） */
export function pruneStudentFeedbackViewed(activeReviewIds: readonly string[]): void {
  const active = new Set(activeReviewIds);
  const set = readSet();
  let changed = false;
  for (const id of [...set]) {
    if (!active.has(id)) {
      set.delete(id);
      changed = true;
    }
  }
  if (changed) writeSet(set);
}
