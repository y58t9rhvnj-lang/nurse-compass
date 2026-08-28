/**
 * AiEvaluationPackage の固定ブロック（policy / rubric focus / instructions）。
 * docs/version2/ai/samples/ai-evaluation-package.sample.json および
 * 02_ai_evaluation_policy.md / package schema に準拠。
 */

import {
  ASSESSMENT_RUBRIC_KEYS,
  ASSESSMENT_RUBRIC_LABELS,
  ASSESSMENT_RUBRIC_LEVELS,
  type AssessmentRubricKey,
} from "@/lib/v2/assessment/assessmentRubric";
import {
  AI_EVAL_COMPASS_POLICY_VERSION,
  AI_EVAL_RUBRIC_VERSION,
} from "@/lib/v2/assessment/aiEvaluationVersions";

const RUBRIC_FOCUS: Record<AssessmentRubricKey, string> = {
  information_gathering:
    "information_cardsとform2に、評価に必要な情報が含まれているか（件数加点ではない）",
  relating_information:
    "form2とfield_reflectionsで症状・生活・治療・背景を内容的に関連づけているか",
  interpretation_analysis:
    "field_reflectionsとpatient_understandingに、情報から導いた解釈があるか",
  clarity_of_evidence:
    "information_cards・form2・field_reflectionsの間で判断を支える情報が説明可能か（form2_evidence_linksは使わない）",
  awareness_of_gaps:
    "field_reflectionsとpatient_understandingで不足・不確実性・別の可能性を認識しているか",
  patient_understanding:
    "form2とpatient_understandingから、症状だけでなく生活者として捉えているか（別解可）",
  overall_integration:
    "information_cards・field_reflections・form2・patient_understandingの一貫性",
};

export const AI_EVAL_GOLD_DECLARATION =
  "Gold Standardは、重要情報・根拠・臨床推論の可能性・不足情報を確認する評価参照である。学生の記述が同じ文章、同じ順序、同じ結論であることを要求してはならない。事例情報に基づく妥当な別解を認めること。";

export function buildAiEvaluationCompassPolicy(): Record<string, unknown> {
  return {
    version: AI_EVAL_COMPASS_POLICY_VERSION,
    mission:
      "Compassは完成物の採点ではなく、根拠ある臨床推論と患者理解の形成を支援する。",
    education_principles: [
      "AIは答えを代筆しない",
      "事実と解釈を区別する",
      "未完成の思考にも価値がある",
      "妥当な複数の患者理解を認める",
      "工程と成果物の内容的つながりを評価する",
    ],
    ai_role: [
      "視点を広げる",
      "根拠を問い返す",
      "見落としに気付かせる",
      "形成的ルーブリック評価の草案を返す",
    ],
    prohibitions: [
      "正解／不正解の単純判定",
      "Gold Standard文章への一致採点・書き換え要求",
      "完成アセスメントの代筆",
      "情報不足の推測補完",
      "private_note / student_notes の送信",
      "form2_evidence_links を様式2評価根拠に使うこと",
      "カード数・リンク数・保存回数・文章量を努力点として加点すること",
      "assessment_reviewsへの直接書き込み",
      "学生への自動返却",
    ],
    evaluation_target:
      "成果物（form2・patient_understanding・scope内form3）と理解形成工程（field_reflections・information_cards）の内容的つながり。information_cards→field_reflections→form2→patient_understanding。",
    authority:
      "AI結果は教員の確定評価ではない。staging経由で教員が採用・修正・却下する。",
  };
}

export function buildAiEvaluationRubricBlock(): Record<string, unknown> {
  return {
    version: AI_EVAL_RUBRIC_VERSION,
    scale: {
      min: 1,
      max: 5,
      levels: ASSESSMENT_RUBRIC_LEVELS.map((l) => ({
        value: l.value,
        label: l.label,
      })),
    },
    items: ASSESSMENT_RUBRIC_KEYS.map((key) => ({
      key,
      label: ASSESSMENT_RUBRIC_LABELS[key],
      focus: RUBRIC_FOCUS[key],
    })),
    pass_criteria: null,
  };
}

export function buildAiEvaluationInstructions(): Record<string, unknown> {
  return {
    do_not_require_verbatim_gold_match: true,
    allow_valid_alternative_interpretations: true,
    evaluate_information_interpretation_links: true,
    do_not_speculate_missing_information: true,
    distinguish_fact_inference_evaluation: true,
    make_uncertainty_explicit: true,
    citation_rules: {
      require_field_path_or_anonymous_object_id: true,
      do_not_use_array_index_alone_as_persistent_id: true,
    },
    output_separation: {
      student_feedback_draft_vs_teacher_observation: true,
      teacher_observation_not_for_student_return: true,
      private_note_not_sent_to_ai: true,
    },
    persistence_rules: {
      do_not_write_assessment_reviews_directly: true,
      staging_required_before_teacher_adoption: true,
    },
    language: {
      locale: "ja-JP",
      tone: "教育的・非断定・丁寧",
      forbidden_tones: [
        "正解／不正解の単純判定",
        "威圧的・断定的表現",
        "Gold Standard文章への書き換え要求",
        "完成アセスメントの代筆",
        "カード数・リンク数・保存回数による努力不足の断定",
      ],
    },
  };
}

export function buildAiEvaluationOutputSchemaHint(): Record<string, unknown> {
  return {
    result_schema: "ai-evaluation-result.schema.json",
    required_sections: [
      "metadata",
      "item_evaluations",
      "student_feedback_draft",
      "teacher_observation",
      "uncertainty",
      "follow_up_checks",
      "staging_hint",
    ],
  };
}
