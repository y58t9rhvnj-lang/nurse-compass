// Compass Version 2.2 Sprint 4A — 教員レビュー画面の期限表示（表示専用・非破壊）

import { parseServerDateTime } from "@/lib/datetime/formatSavedAtJa";
import { formatAssessmentDateTimeJa } from "./formatAssessmentDate";
import type { AssessmentTimingStatus } from "./types";

/**
 * 提出時点で確定した timing_status の文言（教員レビュー専用）。
 * 学生画面・RPC は変更しない。
 */
export function teacherTimingJudgmentLabel(
  timing: AssessmentTimingStatus | null | undefined,
): string {
  if (timing === "on_time") return "提出時判定：期限内";
  if (timing === "late") return "提出時判定：期限後";
  return "提出時判定：—";
}

/**
 * 現在の milestone.deadline_at と submitted_at の表示時比較。
 * RPC と同じく「提出時刻 < 期限」を期限内相当とする（>= は期限後）。
 */
export function teacherCurrentDeadlineRelationLabel(
  submittedAt: string | null | undefined,
  currentDeadlineAt: string | null | undefined,
): string | null {
  if (!submittedAt || !currentDeadlineAt) return null;
  const submitted = parseServerDateTime(submittedAt);
  const deadline = parseServerDateTime(currentDeadlineAt);
  if (!submitted || !deadline) return null;
  if (submitted.getTime() < deadline.getTime()) {
    return "現在の期限との関係：期限前に提出";
  }
  return "現在の期限との関係：期限後に提出";
}

/**
 * snapshot から提出時点の deadlineAt を読む（無い場合は null。推測しない）。
 * 優先: assessmentMilestone.deadlineAt → assessmentCycle.deadlineAt
 */
export function extractDeadlineAtAtSubmitFromSnapshot(
  snapshot: unknown,
): string | null {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return null;
  }
  const root = snapshot as Record<string, unknown>;
  const milestone =
    root.assessmentMilestone &&
    typeof root.assessmentMilestone === "object" &&
    !Array.isArray(root.assessmentMilestone)
      ? (root.assessmentMilestone as Record<string, unknown>)
      : null;
  if (typeof milestone?.deadlineAt === "string" && milestone.deadlineAt.trim()) {
    return milestone.deadlineAt.trim();
  }
  const cycle =
    root.assessmentCycle &&
    typeof root.assessmentCycle === "object" &&
    !Array.isArray(root.assessmentCycle)
      ? (root.assessmentCycle as Record<string, unknown>)
      : null;
  if (typeof cycle?.deadlineAt === "string" && cycle.deadlineAt.trim()) {
    return cycle.deadlineAt.trim();
  }
  return null;
}

export function teacherDeadlineAtSubmitLabel(
  deadlineAtAtSubmit: string | null | undefined,
): string {
  if (deadlineAtAtSubmit && parseServerDateTime(deadlineAtAtSubmit)) {
    return `提出時の期限：${formatAssessmentDateTimeJa(deadlineAtAtSubmit)}`;
  }
  return "提出時の期限：記録なし";
}

export type TeacherTimingDisplayLines = {
  judgment: string;
  currentRelation: string | null;
  deadlineAtSubmit: string;
};

/** 教員レビュー用の期限関連表示行をまとめる */
export function buildTeacherTimingDisplayLines(input: {
  timingStatus: AssessmentTimingStatus | null | undefined;
  submittedAt: string | null | undefined;
  currentDeadlineAt: string | null | undefined;
  deadlineAtAtSubmit: string | null | undefined;
  /** 未提出など提出が無いとき */
  empty?: boolean;
}): TeacherTimingDisplayLines | null {
  if (input.empty || !input.submittedAt) return null;
  return {
    judgment: teacherTimingJudgmentLabel(input.timingStatus),
    currentRelation: teacherCurrentDeadlineRelationLabel(
      input.submittedAt,
      input.currentDeadlineAt,
    ),
    deadlineAtSubmit: teacherDeadlineAtSubmitLabel(input.deadlineAtAtSubmit),
  };
}

/** 表セル向け：改行区切りテキスト */
export function formatTeacherTimingDisplayText(
  lines: TeacherTimingDisplayLines | null,
  emptyFallback = "—",
): string {
  if (!lines) return emptyFallback;
  return [
    lines.judgment,
    lines.currentRelation,
    lines.deadlineAtSubmit,
  ]
    .filter(Boolean)
    .join("\n");
}
