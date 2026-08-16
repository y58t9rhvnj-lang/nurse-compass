// Form3 Phase B — Validation 純関数（提出条件は扱わない）

import type {
  Form3AssessmentCardV2,
  Form3DataV2,
  Form3FinalPatternV2,
  Form3InformationCardV2,
} from "./form3V2Types";

export type Form3V2InformationIssue =
  | "content_required"
  | "invalid_source_type";

export type Form3V2AssessmentIssue =
  | "interpretation_required"
  | "classification_required"
  | "evidence_required"
  | "evidence_missing"
  | "additional_information_required"
  | "pattern_key_required";

export type Form3V2CheckResult<T extends string> = {
  ok: boolean;
  issues: T[];
};

function infoById(data: Form3DataV2): Map<string, Form3InformationCardV2> {
  return new Map(data.informationCards.map((c) => [c.id, c]));
}

/** active Information の入力途中チェック（soType null は許可） */
export function checkForm3InformationCardV2(
  card: Form3InformationCardV2,
): Form3V2CheckResult<Form3V2InformationIssue> {
  const issues: Form3V2InformationIssue[] = [];
  if (card.status === "archived") {
    return { ok: true, issues: [] };
  }
  if (card.content.trim() === "") {
    issues.push("content_required");
  }
  return { ok: issues.length === 0, issues };
}

/**
 * Assessment カード検証。
 * - draft: 空欄・classification null・根拠0件可
 * - reviewed: interpretation / classification / 根拠1件以上必須
 * - insufficient_information + reviewed: needMoreInformation 必須
 */
export function checkForm3AssessmentCardV2(
  card: Form3AssessmentCardV2,
  data: Form3DataV2,
): Form3V2CheckResult<Form3V2AssessmentIssue> {
  const issues: Form3V2AssessmentIssue[] = [];
  if (card.status === "archived" || card.status === "draft") {
    return { ok: true, issues: [] };
  }

  // reviewed
  if (card.interpretation.trim() === "") {
    issues.push("interpretation_required");
  }
  if (card.classification === null) {
    issues.push("classification_required");
  }
  if (card.patternKey === null) {
    issues.push("pattern_key_required");
  }
  if (card.evidenceInformationIds.length < 1) {
    issues.push("evidence_required");
  } else {
    const map = infoById(data);
    for (const id of card.evidenceInformationIds) {
      if (!map.has(id)) {
        issues.push("evidence_missing");
        break;
      }
    }
  }
  if (
    card.classification === "insufficient_information" &&
    card.needMoreInformation.trim() === ""
  ) {
    issues.push("additional_information_required");
  }

  return { ok: issues.length === 0, issues };
}

export function meetsForm3AssessmentReviewedRequirements(
  card: Form3AssessmentCardV2,
  data: Form3DataV2,
): boolean {
  if (card.status !== "reviewed") return false;
  return checkForm3AssessmentCardV2(card, data).ok;
}

/** Final は空欄保存可。提出条件は未実装。学校指定2項目のみ。 */
export function isForm3FinalPatternEmpty(pattern: Form3FinalPatternV2): boolean {
  return (
    pattern.informationSO.trim() === "" &&
    pattern.interpretationAnalysisCareNeed.trim() === ""
  );
}
