// Compass Version2.1 — 様式3「整理済み」条件の純関数。
//
// オートセーブ（空欄可）とは分離する。本モジュールは「整理済み」にする瞬間の条件のみ。

import type { Form3PatternData } from "./form3Types";

export type Form3ReviewIssue =
  | "judgment_required"
  | "rationale_required"
  | "additional_information_required";

export type Form3ReviewCheckResult = {
  ok: boolean;
  issues: Form3ReviewIssue[];
};

/**
 * パターンを「整理済み」にできるか。
 * - judgment 必須
 * - judgmentRationale（trim 後）必須（正常・強みを含む全判断）
 * - insufficient_information のとき additionalInformationNeeded（trim 後）必須
 */
export function checkForm3ReviewRequirements(
  pattern: Form3PatternData,
): Form3ReviewCheckResult {
  const issues: Form3ReviewIssue[] = [];

  if (pattern.judgment === null) {
    issues.push("judgment_required");
  }

  if (pattern.judgmentRationale.trim() === "") {
    issues.push("rationale_required");
  }

  if (
    pattern.judgment === "insufficient_information" &&
    pattern.additionalInformationNeeded.trim() === ""
  ) {
    issues.push("additional_information_required");
  }

  return { ok: issues.length === 0, issues };
}

/** 完了条件を満たすか（boolean のみ欲しいとき） */
export function meetsForm3ReviewRequirements(
  pattern: Form3PatternData,
): boolean {
  return checkForm3ReviewRequirements(pattern).ok;
}
