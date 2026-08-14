// Compass Version2.1 — 様式3 進捗判定の純関数。
//
// 入力文字数では判定しない。
// isReviewed === true でも、完了条件を満たさないデータは reviewed 扱いしない。

import { meetsForm3ReviewRequirements } from "./form3Validation";
import type {
  Form3Data,
  Form3PatternData,
  Form3PatternKey,
  Form3PatternProgress,
} from "./form3Types";
import { FORM3_PATTERN_ORDER } from "./form3Types";

function hasNonEmptyText(pattern: Form3PatternData): boolean {
  return (
    pattern.relatedInformation.trim() !== "" ||
    pattern.interpretation.trim() !== "" ||
    pattern.crossPatternRelations.trim() !== "" ||
    pattern.judgmentRationale.trim() !== "" ||
    pattern.additionalInformationNeeded.trim() !== ""
  );
}

function isPristine(pattern: Form3PatternData): boolean {
  return (
    pattern.judgment === null &&
    !hasNonEmptyText(pattern) &&
    pattern.isReviewed === false
  );
}

/**
 * 1パターンの進捗。
 *
 * - not_started: 未入力かつ未整理
 * - reviewed / reviewed_insufficient: isReviewed かつ完了条件を満たす
 * - needs_rationale: 判断はあるが完了条件未達（不正な isReviewed も含む）
 * - in_progress: 上記以外で何らかの入力または不正フラグがある
 */
export function getForm3PatternProgress(
  pattern: Form3PatternData,
): Form3PatternProgress {
  const complete = meetsForm3ReviewRequirements(pattern);

  if (pattern.isReviewed && complete) {
    return pattern.judgment === "insufficient_information"
      ? "reviewed_insufficient"
      : "reviewed";
  }

  // 不正な isReviewed: true（完了条件未満）は整理済みにしない
  if (pattern.judgment !== null && !complete) {
    return "needs_rationale";
  }

  if (isPristine(pattern)) {
    return "not_started";
  }

  return "in_progress";
}

export type Form3OverallProgress = {
  total: number;
  reviewedCount: number;
  byKey: Record<Form3PatternKey, Form3PatternProgress>;
};

/** 全体進捗（整理済み件数は reviewed + reviewed_insufficient） */
export function getForm3OverallProgress(data: Form3Data): Form3OverallProgress {
  const byKey = {} as Record<Form3PatternKey, Form3PatternProgress>;
  let reviewedCount = 0;
  for (const key of FORM3_PATTERN_ORDER) {
    const progress = getForm3PatternProgress(data.patterns[key]);
    byKey[key] = progress;
    if (progress === "reviewed" || progress === "reviewed_insufficient") {
      reviewedCount += 1;
    }
  }
  return {
    total: FORM3_PATTERN_ORDER.length,
    reviewedCount,
    byKey,
  };
}
