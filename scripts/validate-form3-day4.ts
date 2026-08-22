/**
 * Compass Version2.1 Day 4 — Form3 Assessment Workspace UI 定義・変換の検証。
 *
 * UI テスト基盤は使わず、ナビ／ラベル／順序／思考ヒント等の純関数を検証する。
 *
 * 実行:
 *   npx tsx scripts/validate-form3-day4.ts
 */

import {
  FORM3_FIELD_ORDER,
  FORM3_JUDGMENT_LABELS,
  FORM3_PATTERN_SHORT_LABELS,
  FORM3_PROGRESS_LABELS,
  FORM3_REVIEW_ISSUE_LABELS,
  FORM3_TEXT_FIELD_META,
  formatForm3OverallProgressLabel,
  getForm3SaveStatusView,
} from "../components/v2/form3/form3UiLabels";
import {
  buildForm3NavItems,
  countSelectedForm3NavItems,
  getForm3FieldOrder,
  getForm3JudgmentLabel,
  getForm3ProgressLabel,
  getForm3ReviewIssueLabels,
  getThinkingPromptsForActivePattern,
  patternHasThinkingPrompts,
  resolveActiveForm3PatternKey,
} from "../components/v2/form3/form3UiModel";
import {
  FORM3_JUDGMENTS,
  FORM3_PATTERN_KEYS,
  FORM3_PATTERN_ORDER,
  createEmptyForm3,
  type Form3Judgment,
  type Form3PatternProgress,
} from "../lib/form3/form3Types";
import { getForm3PatternDefinition } from "../lib/form3/form3PatternDefinitions";
import {
  FORM3_THINKING_PROMPTS,
  getForm3ThinkingPrompts,
} from "../lib/form3/form3ThinkingPrompts";
import type { Form3ReviewIssue } from "../lib/form3/form3Validation";

type Check = { name: string; ok: boolean; detail?: string };
const checks: Check[] = [];

function check(name: string, ok: boolean, detail?: string) {
  checks.push({ name, ok, detail });
}

// ── ナビ項目 ─────────────────────────────────
{
  const data = createEmptyForm3("A");
  const items = buildForm3NavItems(data, "health_perception_management");
  check("11パターンのナビ項目が定義される", items.length === 11);
  check("12番目のパターンがない", items.length === 11 && FORM3_PATTERN_KEYS.length === 11);
  check(
    "1パターンだけがアクティブ",
    countSelectedForm3NavItems(items) === 1 && items[0]?.selected === true,
  );
  check(
    "ナビに番号・短い名・進捗がある",
    items.every(
      (it) =>
        it.index >= 1 &&
        it.index <= 11 &&
        it.shortLabel.length > 0 &&
        it.progressLabel.length > 0,
    ),
  );
  check(
    "短いラベルが全キーにある",
    FORM3_PATTERN_ORDER.every((k) => !!FORM3_PATTERN_SHORT_LABELS[k]),
  );
}

// ── 進捗・判断ラベル ─────────────────────────
{
  const progresses: Form3PatternProgress[] = [
    "not_started",
    "in_progress",
    "needs_rationale",
    "reviewed",
    "reviewed_insufficient",
  ];
  check(
    "すべての進捗値に日本語ラベルがある",
    progresses.every((p) => getForm3ProgressLabel(p) === FORM3_PROGRESS_LABELS[p]),
  );
  check(
    "進捗状態ラベルの対応（未着手）",
    FORM3_PROGRESS_LABELS.not_started === "未着手",
  );
  check(
    "進捗状態ラベルの対応（整理済み）",
    FORM3_PROGRESS_LABELS.reviewed === "整理済み",
  );

  check(
    "すべての判断値に日本語ラベルがある",
    FORM3_JUDGMENTS.every(
      (j) => getForm3JudgmentLabel(j) === FORM3_JUDGMENT_LABELS[j],
    ),
  );
  check(
    "判断ラベルの対応（情報不足）",
    FORM3_JUDGMENT_LABELS.insufficient_information ===
      "情報不足で判断できない",
  );
}

// ── 入力欄の順序 ─────────────────────────────
{
  const order = getForm3FieldOrder();
  check(
    "入力欄の順序",
    order.join(",") ===
      [
        "relatedInformation",
        "interpretation",
        "crossPatternRelations",
        "judgment",
        "judgmentRationale",
        "additionalInformationNeeded",
      ].join(","),
  );
  check(
    "FIELD_ORDER 定数と一致",
    order.join(",") === FORM3_FIELD_ORDER.join(","),
  );
  check(
    "テキスト欄メタが思考順（judgment除外）",
    FORM3_TEXT_FIELD_META.map((m) => m.field).join(",") ===
      [
        "relatedInformation",
        "interpretation",
        "crossPatternRelations",
        "judgmentRationale",
        "additionalInformationNeeded",
      ].join(","),
  );
}

// ── 保存状態ラベル ───────────────────────────
{
  check(
    "保存状態ラベル（saved）",
    getForm3SaveStatusView("saved", "", true).label.includes("保存済み"),
  );
  check(
    "保存状態ラベル（saving）",
    getForm3SaveStatusView("saving", "", true).label === "保存中…",
  );
  check(
    "保存状態ラベル（dirty）",
    getForm3SaveStatusView("dirty", "", true).label ===
      "未保存の変更あり",
  );
  check(
    "保存状態ラベル（error）",
    getForm3SaveStatusView("error", "", true).label ===
      "保存できませんでした",
  );
  const conflict = getForm3SaveStatusView("conflict", "", true);
  check(
    "保存状態ラベル（conflict）",
    conflict.label.includes("競合") && conflict.showLoadLatest,
  );
}

// ── markReviewed issue 表示変換 ──────────────
{
  const issues: Form3ReviewIssue[] = [
    "judgment_required",
    "rationale_required",
    "additional_information_required",
  ];
  const labels = getForm3ReviewIssueLabels(issues);
  check("markReviewed issueの表示用変換（件数）", labels.length === 3);
  check(
    "markReviewed issueの表示用変換（判断）",
    labels[0] === FORM3_REVIEW_ISSUE_LABELS.judgment_required,
  );
}

// ── 思考の入口 ───────────────────────────────
{
  const key = "health_perception_management" as const;
  const prompts = getThinkingPromptsForActivePattern(key);
  check(
    "思考の入口が健康知覚―健康管理に設定されている",
    patternHasThinkingPrompts(key) && prompts.length === 3,
  );
  check(
    "正式ラベルが健康知覚―健康管理",
    getForm3PatternDefinition(key).labelJa === "健康知覚―健康管理",
  );
  check(
    "考えるヒントに答え（看護問題例）を書かない（静的3問）",
    prompts[0]?.includes("受け止めて") === true &&
      prompts.every((q) => !q.includes("看護問題は")),
  );
  check(
    "他パターンの思考ヒントは未設定（空）でもキーは11",
    FORM3_THINKING_PROMPTS.length === 11 &&
      FORM3_THINKING_PROMPTS.filter((p) => p.questions.length > 0).length === 1,
  );
  check(
    "getForm3ThinkingPrompts が同一",
    getForm3ThinkingPrompts(key).length === 3,
  );
}

// ── 進捗表示文言 ─────────────────────────────
{
  check(
    "全体進捗は件数表記（パーセント単独ではない）",
    formatForm3OverallProgressLabel(3, 11) === "3 / 11 パターン整理済み" &&
      !formatForm3OverallProgressLabel(3, 11).includes("%"),
  );
}

// ── active key 解決 ──────────────────────────
{
  check(
    "不正キーは先頭パターンへフォールバック",
    resolveActiveForm3PatternKey("not_a_pattern") === FORM3_PATTERN_ORDER[0],
  );
}

// ── 判断値網羅（型の実行時コピー） ───────────
{
  const expected: Form3Judgment[] = [
    "functioning_normally",
    "strength",
    "problem",
    "risk",
    "insufficient_information",
  ];
  check(
    "判断は5区分のみ",
    FORM3_JUDGMENTS.length === 5 &&
      expected.every((j, i) => FORM3_JUDGMENTS[i] === j),
  );
}

const failed = checks.filter((c) => !c.ok);
for (const c of checks) {
  console.log(
    `[${c.ok ? "OK" : "FAIL"}] ${c.name}${c.detail ? ` — ${c.detail}` : ""}`,
  );
}
console.log(
  `\n===== form3 Day4: ${checks.length - failed.length} OK / ${failed.length} FAIL =====`,
);
process.exit(failed.length > 0 ? 1 : 0);
