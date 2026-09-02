/**
 * AiEvaluationPackage の固定ブロック（policy / rubric focus / instructions）。
 * docs/version2/ai/samples/ai-evaluation-package.sample.json および
 * 02_ai_evaluation_policy.md / package schema に準拠。
 *
 * 2026.4: 「患者理解を深める」3段階は教育原則。evaluation_stage に tertiary は追加しない。
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

/**
 * 7 項目は、上位の3段階教育原則を具体的に確認する観点（rubric_version 3）。
 * 看護計画・援助・情報カードは評価しない。
 */
const RUBRIC_FOCUS: Record<AssessmentRubricKey, string> = {
  information_gathering:
    "段階1の材料: form2 に、各情報の意味を考える材料となる情報があるか。件数・文章量の加点はしない。情報カードは様式2段階の評価対象外。",
  relating_information:
    "段階1→2: field_reflections を中心に、意味づけた情報同士を症状・治療・生活・本人の思いなどとしてつなげられているか。情報カードは用いない。各項目に高度な統合は求めない。",
  interpretation_analysis:
    "段階1: field_reflections で、これまでの学習内容も活用しつつ、一つの情報から妥当な意味や可能性を考えられているか。例: 入院形態から病識・治療理解の可能性。単一情報で断定せず、他の発言・治療行動・服薬などで確かめようとする姿勢を評価する。",
  clarity_of_evidence:
    "段階1: 解釈が提出内の様式2情報・考察内の根拠に基づいているか（form2_evidence_links・情報カードは使わない）。飛躍した断定は低くみる。",
  awareness_of_gaps:
    "段階3: field_reflections / patient_understanding で、まだ分からないことや別の可能性に気づいているか。一つの見方に固定せず理解を更新しようとする姿勢。記載量だけで高評価にしない。",
  patient_understanding:
    "段階2: 各項目の考察から『この患者さんはどのような人か』を大まかに捉えているか。完璧な統合は不要。空欄時は『できていない』とせず、提出上、統合過程を確認できないと書く。",
  overall_integration:
    "段階3: 患者理解を更新・深化できる形に統合されているか（不足への気づき・別可能性・見方の修正）。看護目標・計画・援助・観察項目・情報カードは評価対象外。",
};

export const AI_EVAL_GOLD_DECLARATION =
  "Gold Standardは、重要情報・根拠・臨床推論の可能性・不足情報を確認する評価参照である。学生の記述が同じ文章、同じ順序、同じ結論であることを要求してはならない。事例情報に基づく妥当な別解を認めること。Goldは教員向け比較（teacher_observation）にのみ用い、学生フィードバック草案の作成には使用しない。";

/** 患者理解が未記載のときの評価・フィードバック定型（「できていない」断定禁止） */
export const AI_EVAL_EMPTY_PATIENT_UNDERSTANDING_STATEMENT =
  "提出上、患者理解の記述がないため、情報をどのように意味づけ・関連づけ・統合したかという過程は確認できません。";

/** 学生フィードバックに含めてはならない表現（検出用） */
export const AI_EVAL_FORBIDDEN_STUDENT_FEEDBACK_PATTERNS: readonly RegExp[] = [
  /看護の方向性/,
  /看護目標/,
  /看護計画/,
  /具体的な援助|具体的援助/,
  /観察項目/,
  /実施すべき看護/,
  /患者理解ができていない/,
];

export function buildAiEvaluationCompassPolicy(): Record<string, unknown> {
  return {
    version: AI_EVAL_COMPASS_POLICY_VERSION,
    mission:
      "様式2段階では、看護計画の採点ではなく、学生が各情報の意味を考え、全体像を大まかに捉え、患者理解を深めようとしているかを支援する。",
    education_principles: [
      "上位の教育原則は『患者理解を深める』3段階である（①各情報の意味を考える → ②全体像を大まかに捉える → ③患者理解を深める）。これは評価項目ではなく教育原則である",
      "7項目ルーブリックは上記3段階を具体的に確認するための観点であり、新しい rubric key は追加しない",
      "これまでの学習内容を活用し、一つの情報から妥当な意味や可能性を考える。単一情報で断定しない",
      "他の発言・治療行動・服薬状況などで確かめようとする姿勢を評価する",
      "全体像は『この患者さんはどのような人か』を概ね捉えられていれば合格相当とし、各項目に高度な統合を求めない",
      "不足情報への気づき・別可能性・新しい情報による患者像の修正・見方の更新を、患者理解を深める過程として評価する",
      "患者理解が空でも『できていない』と断定せず、提出上、統合過程を確認できないと書く",
      "情報カードは様式2段階の評価対象にしない",
      "AIは答えを代筆せず、意味を考える・全体像を捉える・理解を深めるコーチである",
      "提出内容にない事実を推測で補わない",
      "学生フィードバックは提出内の具体情報に触れ、定型文の繰り返しを避ける",
    ],
    ai_role: [
      "一つの情報から妥当な意味・可能性を考えているかを照らす",
      "単一情報からの断定と、確かめようとする姿勢を区別する",
      "『この患者さんはどのような人か』を概ね捉えられているかを示す",
      "不足・別可能性・見方の更新につながる視点を返す",
      "『何を確認するか』ではなく『何を考えれば患者理解が深まるか』を問う",
    ],
    prohibitions: [
      "正解／不正解の単純判定",
      "Gold Standard文章への一致採点・書き換え要求",
      "完成アセスメントの代筆",
      "情報不足の推測補完",
      "単一情報からの断定（例: 医療保護入院だから病識がない）",
      "各項目に高度な統合を要求すること",
      "3段階教育原則を独立した採点項目や追加 rubric key として扱うこと",
      "看護目標・看護計画・看護の方向性・具体的援助・観察項目・実施すべき看護を学生フィードバックに出力すること",
      "学生へ答え（完成した看護）を与えること",
      "Goldを学生フィードバック草案の根拠に使うこと（教員向け比較以外）",
      "患者理解が空のときに『患者理解ができていない』と断定すること",
      "情報カードを様式2段階の評価根拠に使うこと",
      "private_note / student_notes の送信",
      "form2_evidence_links を様式2評価根拠に使うこと",
      "カード数・リンク数・保存回数・文章量を努力点として加点すること",
      "assessment_reviewsへの直接書き込み",
      "学生への自動返却",
      "全学生へ同じ定型フィードバックやGold不足項目の一斉転記をすること",
    ],
    evaluation_target:
      "様式2とフィールド振り返り、患者理解を、3段階教育原則（意味・全体像・深化）に照らして読む。7項目はその確認観点。情報カード・看護計画・援助は対象外。流れ: form2の事実 → field_reflectionsの考察 → patient_understandingの統合。",
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
      tone:
        "教育的・非断定・丁寧。『可能性がある』表現を尊重する。単一情報での断定を避け、確かめようとする姿勢を評価する。コーチとして問いを返す。看護目標・計画・援助・観察項目は書かない。",
      forbidden_tones: [
        "正解／不正解の単純判定",
        "威圧的・断定的表現",
        "単一情報からの断定（例: 医療保護入院だから病識がない）",
        "Gold Standard文章への書き換え要求",
        "完成アセスメントの代筆",
        "看護目標・看護計画・看護の方向性・具体的援助・観察項目の提示",
        "『何を観察・確認すればよいか』のチェックリスト化（代わりに考える視点を示す）",
        "患者理解が空のときの『患者理解ができていない』断定",
        "各項目に高度な統合を要求する評価",
        "カード数・リンク数・保存回数・記載量による努力不足の断定",
      ],
    },
    evaluation_stage: {
      focus:
        "様式2段階。上位の教育原則は『患者理解を深める』3段階（①各情報の意味を考えることができる／②全体像を大まかに捉えることができる／③患者理解を深めることができる）。3段階は評価項目ではなく教育原則であり、7項目ルーブリックで確認する。情報カード・看護の方向性・看護計画は評価しない。",
      primary:
        "教育原則①②を7項目で確認する: 学習内容を活用し一つの情報から妥当な意味・可能性を考えているか（断定せず、他の発言・治療行動・服薬などで確かめようとするか）。各項目の考察を症状・治療・生活・本人の思いと結びつけ、『この患者さんはどのような人か』を概ね捉えられているか。完璧な統合や各項目への高度な統合は求めない。主根拠は form2 + field_reflections（＋ patient_understanding）。記載量で加点しない。情報カードは根拠にしない。",
      secondary:
        "教育原則③を7項目で確認する: 不足情報への気づき、別可能性、新しい情報による患者像の修正、一つの見方に固定しない更新。空の patient_understanding は『できていない』とせず『提出上、統合過程を確認できない』と書く。学生フィードバックは strengths＝意味づけ、supporting_information＝大まかな患者像、gaps_or_alternatives＝不足・別可能性、next_questions＝深めるための考える視点。",
      empty_patient_understanding: AI_EVAL_EMPTY_PATIENT_UNDERSTANDING_STATEMENT,
      student_feedback_draft_order: [
        "strengths: 段階1 — 各情報から妥当な意味・可能性を考えられている点（提出内の具体情報に触れる）",
        "supporting_information: 段階2 — 現時点で概ね読み取れる患者像（大まかでよい）",
        "gaps_or_alternatives: 段階3 — 不足・別可能性・まだ更新されていない見方",
        "next_questions: 段階3の継続 — 患者理解を深めるために考えてほしい視点（確認・観察リストではなく考える視点。定型文の使い回し禁止）",
      ],
      gold_usage:
        "Gold Standardは教員向け比較（teacher_observation）のみ。学生フィードバック草案には使わない。Goldの不足項目を全員へ転記しない。",
      examples_of_adequate_thinking: [
        "入院形態（医療保護等）→病識や治療理解の『可能性』を考え、他の発言・治療行動・服薬で確かめようとする（『病識がない』と断定しない）",
        "主訴『夜に怠け者の声で眠れない』→幻聴が睡眠へ影響している可能性／『怠け者』が自己肯定感へ影響している可能性",
        "各項目の考察を症状・治療・生活・本人の思いとして大まかな患者像に結びつける（完璧な統合は不要）",
        "不足や別可能性に触れ、新しい情報で患者像を修正しようとする記述",
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
    student_feedback_draft_semantics: {
      strengths: "段階1: 各情報の意味・可能性を考えられている点",
      supporting_information: "段階2: 概ね読み取れる患者の全体像",
      gaps_or_alternatives: "段階3: 不足・別可能性・未更新の見方",
      next_questions:
        "段階3の継続: 患者理解を深めるための考える視点（確認行動ではなく思考の観点）",
    },
  };
}
