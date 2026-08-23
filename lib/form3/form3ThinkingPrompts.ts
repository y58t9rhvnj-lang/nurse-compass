// Compass Version2.1 Day 4 — 様式3「考えるヒント」（静的教育コンテンツ）。
//
// 方針（Constitution / Education Principles）:
//   ・答え・看護問題・模範解釈は書かない。
//   ・患者情報を見る入口となる問いのみ。
//   ・AI 機能ではない。コード同梱の静的データ。
//
// 拡張:
//   ・Day4 は health_perception_management のみ定義。
//   ・他パターンは空配列（未設定）。将来ここへ問いを追加する。
//   ・Form3PatternDefinition には混ぜない（ガイド正本 PDF と分離）。

import {
  FORM3_PATTERN_ORDER,
  type Form3PatternKey,
} from "./form3Types";

/** パターンごとの「考えるヒント」問い一覧（編集不可の静的データ） */
export type Form3ThinkingPrompts = {
  patternKey: Form3PatternKey;
  questions: readonly string[];
};

const PROMPTS: Record<Form3PatternKey, readonly string[]> = {
  health_perception_management: [
    "患者さんは、自分の病気や健康状態をどのように受け止めていますか。",
    "治療や服薬について、どのように考えていますか。",
    "健康管理が保たれている、または難しいと考える根拠は何ですか。",
  ],
  nutritional_metabolic: [],
  elimination: [],
  activity_exercise: [],
  sleep_rest: [],
  cognitive_perceptual: [],
  self_perception_self_concept: [],
  role_relationship: [],
  sexuality_reproductive: [],
  coping_stress_tolerance: [],
  value_belief: [],
};

export function getForm3ThinkingPrompts(
  key: Form3PatternKey,
): readonly string[] {
  return PROMPTS[key];
}

export function hasForm3ThinkingPrompts(key: Form3PatternKey): boolean {
  return PROMPTS[key].length > 0;
}

/** 検証・一覧用（全11キー。未設定は questions が空） */
export const FORM3_THINKING_PROMPTS: readonly Form3ThinkingPrompts[] =
  FORM3_PATTERN_ORDER.map((patternKey) => ({
    patternKey,
    questions: PROMPTS[patternKey],
  }));
