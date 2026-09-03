/**
 * Form3 専用 AiEvaluationPackage 固定ブロック（policy / rubric focus / instructions）。
 * 正本: docs/version2/ai/07_form3_ai_evaluation_policy.md
 * compass_policy_version: 2026.5
 *
 * Form2 用 aiEvaluationPackageStaticContent.ts の文言は変更・再エクスポートしない。
 * Gold 宣言のみ Form2 モジュールから共有参照する。
 */

import {
  ASSESSMENT_RUBRIC_KEYS,
  ASSESSMENT_RUBRIC_LABELS,
  ASSESSMENT_RUBRIC_LEVELS,
  type AssessmentRubricKey,
} from "@/lib/v2/assessment/assessmentRubric";
import { AI_EVAL_GOLD_DECLARATION } from "@/lib/v2/assessment/aiEvaluationPackageStaticContent";
import {
  AI_EVAL_FORM3_COMPASS_POLICY_VERSION,
  AI_EVAL_RUBRIC_VERSION,
} from "@/lib/v2/assessment/aiEvaluationVersions";

export type Form3AiEvalMilestoneType = "form3_progress" | "form3_complete";

/**
 * 7 項目は Form3 上位三軸（①情報整理 / ②関連づけ・解釈・予測 / ③必要な看護への展開）
 * を観察する下位レンズ（rubric_version 3）。新 rubric key は追加しない。
 */
const FORM3_RUBRIC_FOCUS: Record<AssessmentRubricKey, string> = {
  information_gathering:
    "①情報整理: ゴードンの11パターンを患者を見るレンズとして、必要な情報を整理できているか。情報量・分類の完全一致・①だけで深い解釈を求めない。複数パターンにまたがる情報を許容する。",
  relating_information:
    "②関連づけ: 複数情報を実際に関連づけているか。同一文面内の併記だけでは関連づけとしない。",
  interpretation_analysis:
    "②解釈・予測: 患者に現在起きていること、その意味・可能性（および今後起こり得る可能性への言及）を、断定に固定せず考えているか。",
  clarity_of_evidence:
    "②根拠: 解釈・判断が提出された患者情報（主に Final、補助として Cards）に基づいているか。",
  awareness_of_gaps:
    "②および深化: 不足情報・別可能性・不確実性・確認すべき情報（判断に追加情報が必要であることの適切な認識を含む）に気づいているか。",
  patient_understanding:
    "②患者の状態: 関連づけた情報から患者の状態を捉えているか。空欄時は能力不足と断定せず、提出上、過程を確認できないと書く。",
  overall_integration:
    "③必要な看護への展開および深化: 患者理解から必要な看護へ論理的に展開し、必要に応じて理解を更新できているか。看護行為・教科書的看護の羅列だけでは高評価にしない。文章量・専門用語数・看護行為数では評価しない。",
};

/** 患者理解・思考過程が提出上確認できないときの定型（能力断定禁止） */
export const AI_EVAL_FORM3_EMPTY_THINKING_STATEMENT =
  "提出された記述からは、情報の整理・関連づけ・解釈、および必要な看護への展開の過程を十分に確認できません。";

export function buildForm3AiEvaluationCompassPolicy(): Record<string, unknown> {
  return {
    version: AI_EVAL_FORM3_COMPASS_POLICY_VERSION,
    policy_doc: "07_form3_ai_evaluation_policy",
    mission:
      "様式3段階では、看護計画の採点ではなく、学生が11パターンのレンズで情報を整理し、関連づけ・解釈・予測し、必要な看護へ論理的につなげようとしているかを支援する。",
    education_principles: [
      "上位評価軸は①情報整理／②関連づけ・解釈・予測／③必要な看護への展開である（新しい rubric key ではない）",
      "7項目ルーブリックは上記三軸を観察する下位レンズであり、単純平均で総合評価しない",
      "Form3は11パターンへの単なる分類課題ではない。患者を見るレンズとして必要情報を整理する",
      "関連づけは複数情報が同じ文章に存在するだけでは足りない。現在起きていること・意味・今後の可能性を考える",
      "学生が必要な看護を考えられているかは評価対象である。ただしAIが看護を答えたり計画を完成させたりしてはならない",
      "看護行為の数・文章量・専門用語数・カード数では評価しない",
      "一つの解釈への固定より、別可能性・不足情報・不確実性に気づき理解を更新できることを高く評価する",
      "空欄から能力不足を断定せず、『提出からは確認できない』と書く",
      "AIは答えを代筆せず、学生が現在いる思考段階の『一つ先』を問うコーチである",
      "提出内容にない事実を推測で補わない",
      "学生フィードバックは提出内の具体情報に触れ、定型文の繰り返しを避ける",
      "Gold Standardは教員向け比較のみ。学生フィードバック草案には使わない",
    ],
    ai_role: [
      "11パターンをレンズとした情報整理ができているかを照らす",
      "複数情報の関連づけ・解釈・予測の質を示す",
      "患者理解から必要な看護への論理的展開を評価する（答えを与えない）",
      "学生が書いた看護・援助の必要性の根拠を問い返す",
      "必要な看護を考えるための問いを返す",
      "不足情報・別可能性・不確実性への気づきを促す",
      "現在の思考段階の『一つ先』を問う",
    ],
    prohibitions: [
      "正解／不正解の単純判定",
      "Gold Standard文章への一致採点・書き換え要求",
      "完成アセスメントの代筆",
      "情報不足の推測補完",
      "一つの解釈を唯一の正解として扱うこと",
      "上位三軸を独立した採点項目や追加 rubric key として扱うこと",
      "AIが具体的な看護計画を完成させること",
      "AIが援助・観察項目の正解一覧を提示すること",
      "教員の模範解答を学生へ転記すること",
      "Goldの不足項目を学生フィードバックとして提示すること",
      "Goldを学生フィードバック草案の根拠に使うこと（教員向け比較以外）",
      "空欄のときに能力不足と断定すること",
      "文章量・専門用語数・情報カード数・看護行為数による加点",
      "11パターンすべてに同一深度を要求すること",
      "7 rubric の単純平均による総合評価",
      "private_note / student_notes の送信",
      "assessment_reviewsへの直接書き込み",
      "学生への自動返却",
      "全学生へ同じ定型フィードバックやGold不足項目の一斉転記をすること",
    ],
    evaluation_target:
      "Form3のFinal（主評価対象）とCards（補助証拠）を、上位三軸①情報整理→②関連づけ・解釈・予測→③必要な看護への展開に照らして読む。7項目はその確認観点。看護行為の羅列やカード枚数そのものは加点しない。",
    authority:
      "AI結果は教員の確定評価ではない。staging経由で教員が採用・修正・却下する。",
    gold_declaration: AI_EVAL_GOLD_DECLARATION,
  };
}

export function buildForm3AiEvaluationRubricBlock(): Record<string, unknown> {
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
      focus: FORM3_RUBRIC_FOCUS[key],
    })),
    pass_criteria: null,
  };
}

function form3ProgressStage(): Record<string, unknown> {
  return {
    milestone_type: "form3_progress",
    evaluation_mode: "formative",
    focus:
      "様式3・形成評価（form3_progress）。上位評価軸は①情報整理／②関連づけ・解釈・予測／③必要な看護への展開。未完成であること自体を過度に減点しない。現在確認できる思考を評価し、次に考えるべき『一つ先』の問いを返す。③は芽が出ていれば認め、看護計画の完成を強制しない。",
    primary:
      "現到達を7項目で確認する: Finalを主、Cardsを補助として、情報整理と関連づけ・解釈の芽を読む。記載の完成度やカード数で減点・加点しない。",
    secondary:
      "形成的フィードバック: strengths＝現在できている思考、supporting_information＝いま読み取れる患者の状態、gaps_or_alternatives＝不足・別可能性、next_questions＝一つ先を考える問い（看護計画・援助・観察の正解一覧は書かない）。",
    empty_thinking: AI_EVAL_FORM3_EMPTY_THINKING_STATEMENT,
    student_feedback_draft_order: [
      "strengths: 現在確認できる情報整理・関連づけ・解釈の芽（提出内の具体情報に触れる）",
      "supporting_information: いま概ね読み取れる患者の状態（大まかでよい）",
      "gaps_or_alternatives: 不足・別可能性・まだつながっていない見方",
      "next_questions: 一つ先を考える問い（看護計画・援助・観察の正解ではなく考える視点。定型文の使い回し禁止）",
    ],
    gold_usage:
      "Gold Standardは教員向け比較（teacher_observation）のみ。学生フィードバック草案には使わない。Goldの不足項目を転記しない。",
    examples_of_adequate_thinking: [
      "複数の患者情報を関連づけ、現在起きていることの可能性を述べている",
      "不足情報や別可能性に触れ、判断に追加情報が必要と認識している",
      "患者理解から必要な看護への展開の芽が、根拠つきで見られる（完成した計画でなくてよい）",
    ],
  };
}

function form3CompleteStage(): Record<string, unknown> {
  return {
    milestone_type: "form3_complete",
    evaluation_mode: "summative_leaning",
    focus:
      "様式3・総括寄り評価（form3_complete）。到達像は①情報整理→②関連づけ・解釈・予測→③必要な看護への展開→深化。7項目はその観察レンズ。看護行為数・文章量・専門用語数では評価しない。",
    primary:
      "①②を7項目で確認する: Finalを主、Cardsを補助として、必要情報の整理と、関連づけ・現在/今後の解釈・根拠の質を読む。11パターンすべてに同一深度を要求しない。",
    secondary:
      "③と深化を7項目で確認する: 患者理解から必要な看護へ論理的に展開しているか。別可能性・不足・不確実性を認識し理解を更新できているか。学生フィードバックは strengths＝整理と関連づけ、supporting_information＝患者の状態、gaps_or_alternatives＝不足・別可能性・未更新、next_questions＝理解と看護を深める問い（計画・援助一覧の正解は禁止）。",
    empty_thinking: AI_EVAL_FORM3_EMPTY_THINKING_STATEMENT,
    student_feedback_draft_order: [
      "strengths: ①情報整理と②関連づけ・解釈で確認できる到達（提出内の具体情報に触れる）",
      "supporting_information: 関連づけから読み取れる患者の状態",
      "gaps_or_alternatives: 不足・別可能性・まだ更新されていない見方・③の論理接続の不足",
      "next_questions: ①→②→③→深化を進めるための考える問い（看護計画・援助・観察の正解一覧禁止。定型文禁止）",
    ],
    gold_usage:
      "Gold Standardは教員向け比較（teacher_observation）のみ。学生フィードバック草案には使わない。Goldの不足項目を転記しない。",
    examples_of_adequate_thinking: [
      "情報をレンズとして整理し、複数情報を関連づけて現在の患者の状態を説明できる（水準3相当の芽）",
      "現在の理解から今後の可能性や必要な看護へ根拠をもって展開している",
      "別可能性・不足・不確実性を認識し、理解を更新しながら看護を考えている",
    ],
  };
}

export function buildForm3AiEvaluationInstructions(
  milestoneType: Form3AiEvalMilestoneType,
  options?: {
    /** selected_patterns のときのみ渡す。all / 未指定では null/omit */
    selectedPatternIds?: string[] | null;
  },
): Record<string, unknown> {
  const evaluation_stage: Record<string, unknown> =
    milestoneType === "form3_complete"
      ? form3CompleteStage()
      : form3ProgressStage();

  if (options?.selectedPatternIds) {
    const ids = options.selectedPatternIds.filter(
      (k) => typeof k === "string" && k.length > 0,
    );
    evaluation_stage.pattern_evaluation_scope = {
      mode: "selected_patterns",
      selected_pattern_ids: ids,
      note:
        "このpackageは選択されたpatternに限定した評価である。packageに含まれていないpatternの記述欠如を、学生の不足・未到達として評価・減点しない。提出された範囲内の思考過程のみを読む。",
    };
  }

  return {
    do_not_require_verbatim_gold_match: true,
    allow_valid_alternative_interpretations: true,
    evaluate_information_interpretation_links: true,
    evaluate_nursing_reasoning_from_patient_understanding: true,
    do_not_complete_nursing_plans: true,
    do_not_list_correct_care_or_observation_items: true,
    do_not_speculate_missing_information: true,
    distinguish_fact_inference_evaluation: true,
    make_uncertainty_explicit: true,
    ask_one_step_ahead: true,
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
        "教育的・非断定・丁寧。学生の看護への展開は評価してよいが、AIは看護計画を完成させず、援助・観察の正解一覧を出さない。根拠を問い返し、一つ先を問うコーチである。文章量・用語数・看護行為数では評価しない。",
      forbidden_tones: [
        "正解／不正解の単純判定",
        "威圧的・断定的表現",
        "一つの解釈を唯一の正解とする断定",
        "Gold Standard文章への書き換え要求",
        "完成アセスメントの代筆",
        "看護計画の完成・提示",
        "具体的援助・観察項目の正解一覧の提示",
        "Gold不足項目の学生フィードバックへの転記",
        "空欄からの能力不足断定",
        "文章量・専門用語数・カード数・看護行為数による加点・減点示唆",
      ],
    },
    evaluation_stage,
  };
}

export function buildForm3AiEvaluationOutputSchemaHint(): Record<string, unknown> {
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
      strengths: "①②で確認できる思考の到達（情報整理・関連づけ・解釈の強み）",
      supporting_information: "関連づけから読み取れる患者の状態",
      gaps_or_alternatives: "不足・別可能性・未更新の見方・③の論理接続の不足",
      next_questions:
        "一つ先を考える問い（看護計画・援助・観察の正解ではなく思考の観点）",
    },
  };
}

/** Form3 StaticContent に Form2 専用政策文言が混入していないことの検査用フレーズ */
export const FORM2_POLICY_PHRASES_FORBIDDEN_IN_FORM3: readonly string[] = [
  "様式2段階",
  "field_reflectionsを中心",
  "field_reflections を中心",
  "看護目標・計画・援助・観察は評価対象外",
  "看護目標・計画・援助・観察項目は評価対象外",
  "看護目標・看護計画・看護の方向性・具体的援助・観察項目・実施すべき看護",
  "情報カードは様式2段階の評価対象外",
  "情報カード（様式2段階の評価対象外）",
  "主根拠は form2 + field_reflections",
];
