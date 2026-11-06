import type { AssessmentSubmitErrorKind } from "./types";

export const SUPPORTED_STUDENT_SUBMISSION_TYPES = [
  "form2",
  "form3_progress",
  "form3_complete",
  "final",
  "custom",
] as const;

export type SupportedStudentSubmissionType =
  (typeof SUPPORTED_STUDENT_SUBMISSION_TYPES)[number];

export type StudentSubmissionWorkspaceView = "clinical-workspace" | "form3";

export type StudentSubmissionWorkspaceTarget = {
  view: StudentSubmissionWorkspaceView | null;
  label: string;
  available: boolean;
};

export function isSupportedStudentSubmissionType(
  type: string | null | undefined,
): type is SupportedStudentSubmissionType {
  return (
    type === "form2" ||
    type === "form3_progress" ||
    type === "form3_complete" ||
    type === "final" ||
    type === "custom"
  );
}

/**
 * 学生提出カードの確認先。
 * DB の milestone_type は union 外の値が来うる。未対応種別で
 * undefined.label を読んで error boundary に落とさない。
 */
export function studentSubmissionWorkspaceTarget(
  type: string | null | undefined,
): StudentSubmissionWorkspaceTarget {
  switch (type) {
    case "form2":
    case "final":
    case "custom":
      return {
        view: "clinical-workspace",
        label: "様式2を確認する",
        available: true,
      };
    case "form3_progress":
    case "form3_complete":
      return { view: "form3", label: "様式3を確認する", available: true };
    default:
      return { view: null, label: "準備中", available: false };
  }
}

export function studentTaskLoadErrorMessage(
  kind: AssessmentSubmitErrorKind | string | null | undefined,
): string {
  switch (kind) {
    case "unauthorized":
      return "ログインの有効期限が切れているか、提出画面を開く権限がありません。再ログインしてください。";
    case "not_configured":
      return "提出機能を現在利用できません。時間をおいて再度お試しください。";
    case "validation":
      return "提出課題の対象を特定できませんでした。";
    default:
      return "提出課題を読み込めませんでした。通信状況を確認して再試行してください。";
  }
}

export function isEmptySubmissionsCopy(message: string): boolean {
  return (
    message.includes("提出データなし") ||
    message.includes("未提出") ||
    message.includes("表示できる提出課題はありません")
  );
}
