// Compass Version2.1 Day 4 — 様式3 UI 用純関数（ナビ項目・表示モデル）。
// React 非依存。validate-form3-day4 から検証する。

import { getForm3PatternDefinition } from "@/lib/form3/form3PatternDefinitions";
import {
  getForm3OverallProgress,
  getForm3PatternProgress,
} from "@/lib/form3/form3Progress";
import {
  FORM3_PATTERN_ORDER,
  type Form3Data,
  type Form3Judgment,
  type Form3PatternKey,
  type Form3PatternProgress,
} from "@/lib/form3/form3Types";
import {
  FORM3_FIELD_ORDER,
  FORM3_JUDGMENT_LABELS,
  FORM3_PATTERN_SHORT_LABELS,
  FORM3_PROGRESS_LABELS,
  FORM3_REVIEW_ISSUE_LABELS,
  formatForm3OverallProgressLabel,
} from "@/components/v2/form3/form3UiLabels";
import type { Form3ReviewIssue } from "@/lib/form3/form3Validation";
import {
  getForm3ThinkingPrompts,
  hasForm3ThinkingPrompts,
} from "@/lib/form3/form3ThinkingPrompts";

export type Form3NavItem = {
  key: Form3PatternKey;
  index: number; // 1-based
  shortLabel: string;
  fullLabel: string;
  progress: Form3PatternProgress;
  progressLabel: string;
  selected: boolean;
};

export function buildForm3NavItems(
  data: Form3Data,
  activeKey: Form3PatternKey,
): Form3NavItem[] {
  return FORM3_PATTERN_ORDER.map((key, i) => {
    const progress = getForm3PatternProgress(data.patterns[key]);
    return {
      key,
      index: i + 1,
      shortLabel: FORM3_PATTERN_SHORT_LABELS[key],
      fullLabel: getForm3PatternDefinition(key).labelJa,
      progress,
      progressLabel: FORM3_PROGRESS_LABELS[progress],
      selected: key === activeKey,
    };
  });
}

/** ちょうど1件だけ selected であること（ナビ不変条件） */
export function countSelectedForm3NavItems(items: Form3NavItem[]): number {
  return items.filter((item) => item.selected).length;
}

export function getForm3ProgressLabel(
  progress: Form3PatternProgress,
): string {
  return FORM3_PROGRESS_LABELS[progress];
}

export function getForm3JudgmentLabel(judgment: Form3Judgment): string {
  return FORM3_JUDGMENT_LABELS[judgment];
}

export function getForm3ReviewIssueLabels(
  issues: readonly Form3ReviewIssue[],
): string[] {
  return issues.map((issue) => FORM3_REVIEW_ISSUE_LABELS[issue]);
}

export function getForm3FieldOrder(): readonly string[] {
  return FORM3_FIELD_ORDER;
}

export function getForm3OverallProgressView(data: Form3Data): {
  reviewedCount: number;
  total: number;
  label: string;
} {
  const overall = getForm3OverallProgress(data);
  return {
    reviewedCount: overall.reviewedCount,
    total: overall.total,
    label: formatForm3OverallProgressLabel(
      overall.reviewedCount,
      overall.total,
    ),
  };
}

export function resolveActiveForm3PatternKey(
  candidate: string | null | undefined,
): Form3PatternKey {
  if (
    candidate &&
    (FORM3_PATTERN_ORDER as readonly string[]).includes(candidate)
  ) {
    return candidate as Form3PatternKey;
  }
  return FORM3_PATTERN_ORDER[0];
}

export function getThinkingPromptsForActivePattern(
  key: Form3PatternKey,
): readonly string[] {
  return getForm3ThinkingPrompts(key);
}

export function patternHasThinkingPrompts(key: Form3PatternKey): boolean {
  return hasForm3ThinkingPrompts(key);
}

/** 進捗状態の意味色クラス（装飾ではなく状態識別。テキスト併用前提） */
export function form3ProgressToneClass(
  progress: Form3PatternProgress,
): string {
  switch (progress) {
    case "not_started":
      return "border-[#D1D1D6] bg-[#F2F2F7] text-[#6E6E73]";
    case "in_progress":
      return "border-[#B8D4F5] bg-[#EAF3FF] text-[#0A6CD6]";
    case "needs_rationale":
      return "border-[#E0B75B] bg-[#FFF7E6] text-[#8A6D3B]";
    case "reviewed":
      return "border-[#A8D5B5] bg-[#EAF7EE] text-[#2D6A4F]";
    case "reviewed_insufficient":
      return "border-[#C7C7CC] bg-[#EFEFF4] text-[#48484A]";
    default:
      return "border-[#D1D1D6] bg-[#F2F2F7] text-[#6E6E73]";
  }
}

/** 判断5区分の意味色（色だけに依存しない UI で併用） */
export function form3JudgmentToneClass(
  judgment: Form3Judgment,
  selected: boolean,
): string {
  const base = selected ? "ring-2 ring-offset-1 " : "";
  switch (judgment) {
    case "functioning_normally":
      return (
        base +
        (selected
          ? "border-[#2D6A4F] bg-[#EAF7EE] text-[#1B4332] ring-[#2D6A4F]"
          : "border-[#A8D5B5] bg-white text-[#1B4332] hover:bg-[#EAF7EE]")
      );
    case "strength":
      return (
        base +
        (selected
          ? "border-[#0A6CD6] bg-[#EAF3FF] text-[#074A94] ring-[#0A6CD6]"
          : "border-[#B8D4F5] bg-white text-[#074A94] hover:bg-[#EAF3FF]")
      );
    case "problem":
      return (
        base +
        (selected
          ? "border-[#C0392B] bg-[#FBEAE8] text-[#922B21] ring-[#C0392B]"
          : "border-[#F3D6D2] bg-white text-[#922B21] hover:bg-[#FBEAE8]")
      );
    case "risk":
      return (
        base +
        (selected
          ? "border-[#D68910] bg-[#FEF5E7] text-[#9A5B0A] ring-[#D68910]"
          : "border-[#F5CBA7] bg-white text-[#9A5B0A] hover:bg-[#FEF5E7]")
      );
    case "insufficient_information":
      return (
        base +
        (selected
          ? "border-[#8E8E93] bg-[#EFEFF4] text-[#3A3A3C] ring-[#8E8E93]"
          : "border-[#D1D1D6] bg-white text-[#3A3A3C] hover:bg-[#F2F2F7]")
      );
  }
}
