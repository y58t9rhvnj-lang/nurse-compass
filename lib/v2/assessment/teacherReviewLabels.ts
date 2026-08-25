// Compass Version 2.2 Sprint 4A — 教員レビュー画面の表示文言

import type {
  AssessmentLateReviewStatus,
  AssessmentTimingStatus,
} from "./types";

export function caseDisplayLabel(caseId: string): string {
  if (caseId === "A" || caseId === "SP-001") return "患者 A（SP-001）";
  return `事例 ${caseId}`;
}

export function timingStatusLabel(
  timing: AssessmentTimingStatus | null | undefined,
): string {
  if (timing === "late") return "期限後";
  if (timing === "on_time") return "期限内";
  return "—";
}

export function lateReviewStatusLabel(
  status: AssessmentLateReviewStatus | null | undefined,
): string {
  switch (status) {
    case "pending":
      return "教員確認待ち";
    case "approved":
      return "承認済み";
    case "rejected":
      return "却下";
    default:
      return "—";
  }
}

export function evaluationStateLabel(
  state: "unevaluated" | "no_candidate" | "not_submitted",
): string {
  switch (state) {
    case "unevaluated":
      return "未評価";
    case "no_candidate":
      return "評価対象なし";
    case "not_submitted":
      return "未提出";
  }
}

export function reviewDisplayStatusLabel(
  status: "none" | "draft" | "completed" | "no_candidate",
): string {
  switch (status) {
    case "none":
      return "未作成";
    case "draft":
      return "下書き";
    case "completed":
      return "評価確定";
    case "no_candidate":
      return "評価対象なし";
  }
}

export function studentIdLabel(student: {
  studentNumber: string | null;
  loginId: string;
}): string {
  return student.studentNumber?.trim() || student.loginId;
}
