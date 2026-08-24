"use client";

import type { ReactNode } from "react";
import {
  buildTeacherTimingDisplayLines,
  formatTeacherTimingDisplayText,
} from "@/lib/v2/assessment/teacherReviewTimingDisplay";
import type {
  AssessmentTimingStatus,
} from "@/lib/v2/assessment/types";

/** 教員レビュー用：提出時判定・現在期限との関係・提出時期限 */
export function TeacherTimingDisplayBlock({
  timingStatus,
  submittedAt,
  currentDeadlineAt,
  deadlineAtAtSubmit,
  emptyFallback = "—",
  className = "whitespace-pre-line text-xs leading-snug",
}: {
  timingStatus: AssessmentTimingStatus | null | undefined;
  submittedAt: string | null | undefined;
  currentDeadlineAt: string | null | undefined;
  deadlineAtAtSubmit: string | null | undefined;
  emptyFallback?: string;
  className?: string;
}): ReactNode {
  const lines = buildTeacherTimingDisplayLines({
    timingStatus,
    submittedAt,
    currentDeadlineAt,
    deadlineAtAtSubmit,
  });
  return (
    <span className={className}>
      {formatTeacherTimingDisplayText(lines, emptyFallback)}
    </span>
  );
}
