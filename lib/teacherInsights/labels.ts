/**
 * Teacher Insight UI 用の表示ラベル（純関数・server-only 非依存）。
 */

import type {
  CoachingQuestionStage,
  TeacherInsightGoldRelationshipKind,
  TeacherInsightHypothesisEvidenceState,
} from "./types";

export const COACHING_STAGE_LABEL_JA: Record<CoachingQuestionStage, string> = {
  facts: "事実",
  meaning: "意味づけ",
  missing: "不足情報",
  update: "患者理解の更新",
  reflection: "振り返り",
};

export const HYPOTHESIS_EVIDENCE_STATE_LABEL_JA: Record<
  TeacherInsightHypothesisEvidenceState,
  string
> = {
  supported_by_catalog: "カタログで支えられる",
  partially_supported: "部分的に支えられる",
  insufficient_evidence: "根拠が不足している",
  open_alternative: "代替仮説として開いている",
};

export const GOLD_RELATIONSHIP_KIND_LABEL_JA: Record<
  TeacherInsightGoldRelationshipKind,
  string
> = {
  reinforces: "Gold Standard を補強する",
  extends: "Gold Standard を拡張する",
  contrasts_risk: "断定リスクへの注意（対比）",
  independent: "独立した視点",
};

export function uniqueStageLabelsJa(
  stages: readonly CoachingQuestionStage[],
): string {
  const seen = new Set<CoachingQuestionStage>();
  const labels: string[] = [];
  for (const stage of stages) {
    if (seen.has(stage)) continue;
    seen.add(stage);
    labels.push(COACHING_STAGE_LABEL_JA[stage]);
  }
  return labels.join(" / ");
}
