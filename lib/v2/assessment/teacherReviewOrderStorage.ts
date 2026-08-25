/** 教員レビュー詳細の前後移動用 student 順（一覧から引き継ぎ） */

export const TEACHER_REVIEW_ORDER_VERSION = 1 as const;
/** 12時間より古い順序は破棄 */
export const TEACHER_REVIEW_ORDER_MAX_AGE_MS = 12 * 60 * 60 * 1000;

export type TeacherReviewOrderPayload = {
  version: typeof TEACHER_REVIEW_ORDER_VERSION;
  milestoneId: string;
  studentIds: string[];
  filter: string;
  sort: string;
  savedAt: number;
};

export function teacherReviewOrderStorageKey(milestoneId: string): string {
  return `nc:teacherReviewOrder:${milestoneId}`;
}

export function saveTeacherReviewOrder(
  payload: Omit<TeacherReviewOrderPayload, "version" | "savedAt"> & {
    savedAt?: number;
  },
): void {
  if (typeof window === "undefined") return;
  const full: TeacherReviewOrderPayload = {
    version: TEACHER_REVIEW_ORDER_VERSION,
    milestoneId: payload.milestoneId,
    studentIds: payload.studentIds,
    filter: payload.filter,
    sort: payload.sort,
    savedAt: payload.savedAt ?? Date.now(),
  };
  try {
    sessionStorage.setItem(
      teacherReviewOrderStorageKey(payload.milestoneId),
      JSON.stringify(full),
    );
  } catch {
    // quota / private mode
  }
}

export function loadTeacherReviewOrder(
  milestoneId: string,
  currentStudentId: string,
): string[] | null {
  if (typeof window === "undefined") return null;
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(teacherReviewOrderStorageKey(milestoneId));
  } catch {
    return null;
  }
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    clearTeacherReviewOrder(milestoneId);
    return null;
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    clearTeacherReviewOrder(milestoneId);
    return null;
  }
  const o = parsed as Record<string, unknown>;
  if (o.version !== TEACHER_REVIEW_ORDER_VERSION) {
    clearTeacherReviewOrder(milestoneId);
    return null;
  }
  if (o.milestoneId !== milestoneId) {
    clearTeacherReviewOrder(milestoneId);
    return null;
  }
  if (typeof o.savedAt !== "number" || !Number.isFinite(o.savedAt)) {
    clearTeacherReviewOrder(milestoneId);
    return null;
  }
  if (Date.now() - o.savedAt > TEACHER_REVIEW_ORDER_MAX_AGE_MS) {
    clearTeacherReviewOrder(milestoneId);
    return null;
  }
  if (!Array.isArray(o.studentIds) || o.studentIds.length === 0) {
    clearTeacherReviewOrder(milestoneId);
    return null;
  }
  const ids = o.studentIds.filter((id): id is string => typeof id === "string");
  if (ids.length === 0 || !ids.includes(currentStudentId)) {
    clearTeacherReviewOrder(milestoneId);
    return null;
  }
  return ids;
}

export function clearTeacherReviewOrder(milestoneId: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(teacherReviewOrderStorageKey(milestoneId));
  } catch {
    // ignore
  }
}
