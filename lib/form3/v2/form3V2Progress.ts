// Form3 Phase B — 進捗純関数（文字数・理解度スコアなし）

import { FORM3_PATTERN_KEYS, type Form3PatternKey } from "../form3Types";
import {
  isForm3FinalPatternEmpty,
  meetsForm3AssessmentReviewedRequirements,
} from "./form3V2Validation";
import type {
  Form3AssessmentCardV2,
  Form3DataV2,
  Form3FinalPatternV2,
  Form3InformationCardV2,
} from "./form3V2Types";

export type Form3InformationCardProgressV2 =
  | "empty"
  | "in_progress"
  | "ready"
  | "archived";

export type Form3AssessmentCardProgressV2 =
  | "empty"
  | "in_progress"
  | "needs_evidence"
  | "needs_classification"
  | "reviewed"
  | "reviewed_insufficient"
  | "archived";

export type Form3FinalPatternProgressV2 =
  | "empty"
  | "in_progress"
  | "completed";

export function getForm3InformationCardProgressV2(
  card: Form3InformationCardV2,
): Form3InformationCardProgressV2 {
  if (card.status === "archived") return "archived";
  if (card.content.trim() === "") return "empty";
  if (card.soType === null || card.patternKeys.length === 0) {
    return "in_progress";
  }
  return "ready";
}

export function getForm3AssessmentCardProgressV2(
  card: Form3AssessmentCardV2,
  data: Form3DataV2,
): Form3AssessmentCardProgressV2 {
  if (card.status === "archived") return "archived";

  const empty =
    card.interpretation.trim() === "" &&
    card.classification === null &&
    card.evidenceInformationIds.length === 0 &&
    card.needMoreInformation.trim() === "";

  if (card.status === "reviewed") {
    if (meetsForm3AssessmentReviewedRequirements(card, data)) {
      return card.classification === "insufficient_information"
        ? "reviewed_insufficient"
        : "reviewed";
    }
    // reviewed だが条件未満
    if (card.evidenceInformationIds.length < 1) return "needs_evidence";
    if (card.classification === null) return "needs_classification";
    return "in_progress";
  }

  if (empty) return "empty";

  if (
    card.interpretation.trim() !== "" &&
    card.classification !== null &&
    card.evidenceInformationIds.length < 1
  ) {
    return "needs_evidence";
  }
  if (
    card.interpretation.trim() !== "" &&
    card.classification === null &&
    card.evidenceInformationIds.length >= 1
  ) {
    return "needs_classification";
  }
  return "in_progress";
}

/**
 * Final Artifact 進捗（学校指定2欄のみ）。
 * workspacePatternFlags.isOrganized / Assessment reviewed / Submission とは別。
 */
export function getForm3FinalPatternProgressV2(
  pattern: Form3FinalPatternV2,
): Form3FinalPatternProgressV2 {
  if (isForm3FinalPatternEmpty(pattern)) return "empty";
  if (
    pattern.informationSO.trim() !== "" &&
    pattern.interpretationAnalysisCareNeed.trim() !== ""
  ) {
    return "completed";
  }
  return "in_progress";
}

export type Form3V2PatternWorkspaceProgress = {
  patternKey: Form3PatternKey;
  informationActiveCount: number;
  assessmentActiveCount: number;
  final: Form3FinalPatternProgressV2;
};

export function getForm3V2WorkspaceProgressByPattern(
  data: Form3DataV2,
): Form3V2PatternWorkspaceProgress[] {
  return FORM3_PATTERN_KEYS.map((patternKey) => {
    const informationActiveCount = data.informationCards.filter(
      (c) =>
        c.status === "active" &&
        (c.patternKeys.length === 0 || c.patternKeys.includes(patternKey)),
    ).length;
    const assessmentActiveCount = data.assessmentCards.filter(
      (c) => c.status !== "archived" && c.patternKey === patternKey,
    ).length;
    return {
      patternKey,
      informationActiveCount,
      assessmentActiveCount,
      final: getForm3FinalPatternProgressV2(data.finalForm[patternKey]),
    };
  });
}
