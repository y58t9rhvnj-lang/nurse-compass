import { ADMIN_MANUAL_CHAPTERS, TEACHER_MANUAL_CHAPTERS } from "./staffChapters";
import { STUDENT_MANUAL_CHAPTERS } from "./studentChapters";
import type { ManualAudience, ManualCatalog, ManualChapter } from "./types";

export const MANUAL_CATALOG: ManualCatalog = {
  versionLabel: "Nurse Compass V2.2",
  student: STUDENT_MANUAL_CHAPTERS,
  teacher: TEACHER_MANUAL_CHAPTERS,
  admin: ADMIN_MANUAL_CHAPTERS,
};

export function chaptersForAudience(audience: ManualAudience): ManualChapter[] {
  if (audience === "student") return MANUAL_CATALOG.student;
  if (audience === "teacher") {
    return [...MANUAL_CATALOG.teacher, ...MANUAL_CATALOG.student];
  }
  return [...MANUAL_CATALOG.admin, ...MANUAL_CATALOG.teacher, ...MANUAL_CATALOG.student];
}

export function chapterById(
  audience: ManualAudience,
  id: string,
): ManualChapter | undefined {
  return chaptersForAudience(audience).find((chapter) => chapter.id === id);
}

export function flattenManualText(chapters: ManualChapter[]): string {
  return chapters
    .flatMap((chapter) => [
      chapter.title,
      chapter.about,
      ...chapter.ops.flatMap((item) => [
        item.title,
        item.result ?? "",
        ...item.steps.map((step) => step.text),
        ...item.shots.flatMap((shot) => [shot.alt, shot.caption ?? ""]),
      ]),
    ])
    .join("\n");
}
