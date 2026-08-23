/**
 * Compass Version2.1 Day 1 / Day 1.5 — 様式3 ドメイン純関数の検証スクリプト。
 *
 * 既存の scripts/validate-*.ts と同様、パッケージ追加なしで npx tsx 実行する。
 *
 * 実行:
 *   npx tsx scripts/validate-form3-day1.ts
 */

import {
  FORM3_PATTERN_DEFINITIONS,
  getForm3PatternDefinition,
  isForm3PatternGuidePending,
} from "../lib/form3/form3PatternDefinitions";
import {
  getForm3OverallProgress,
  getForm3PatternProgress,
} from "../lib/form3/form3Progress";
import {
  FORM3_JUDGMENTS,
  FORM3_PATTERN_KEYS,
  FORM3_PATTERN_ORDER,
  FORM3_SCHEMA_VERSION,
  createEmptyForm3,
  createEmptyForm3PatternData,
  type Form3Judgment,
  type Form3PatternData,
  type Form3PatternKey,
} from "../lib/form3/form3Types";
import {
  checkForm3ReviewRequirements,
  meetsForm3ReviewRequirements,
} from "../lib/form3/form3Validation";

type Check = { name: string; ok: boolean; detail?: string };
const checks: Check[] = [];

function check(name: string, ok: boolean, detail?: string) {
  checks.push({ name, ok, detail });
}

function withFields(
  base: Form3PatternData,
  patch: Partial<Form3PatternData>,
): Form3PatternData {
  return { ...base, ...patch };
}

// ── 1. 固定キー・順序・ガイド転記（Day 1.5） ──
check("スキーマバージョンは 1", FORM3_SCHEMA_VERSION === 1);
check("パターンキーは 11 個", FORM3_PATTERN_KEYS.length === 11);
check("定義配列はちょうど 11（12番目なし）", FORM3_PATTERN_DEFINITIONS.length === 11);
check(
  "PATTERN_ORDER は KEYS と同順・同長",
  FORM3_PATTERN_ORDER.length === 11 &&
    FORM3_PATTERN_ORDER.every((k, i) => k === FORM3_PATTERN_KEYS[i]),
);
check(
  "定義配列も 11・固定順",
  FORM3_PATTERN_DEFINITIONS.length === 11 &&
    FORM3_PATTERN_DEFINITIONS.every(
      (d, i) => d.key === FORM3_PATTERN_ORDER[i],
    ),
);

const uniqueKeys = new Set(FORM3_PATTERN_DEFINITIONS.map((d) => d.key));
check(
  "定義キーに重複がない",
  uniqueKeys.size === FORM3_PATTERN_DEFINITIONS.length,
  `unique=${uniqueKeys.size}`,
);

const unexpectedKeys = FORM3_PATTERN_DEFINITIONS.filter(
  (d) => !(FORM3_PATTERN_KEYS as readonly string[]).includes(d.key),
);
check(
  "定義に未知キーがない",
  unexpectedKeys.length === 0,
  unexpectedKeys.map((d) => d.key).join(","),
);

const EXPECTED_LABELS = [
  "健康知覚―健康管理",
  "栄養―代謝",
  "排泄",
  "活動―運動",
  "睡眠―休息",
  "認知―知覚",
  "自己知覚―自己概念",
  "役割―関係",
  "性―生殖",
  "コーピング―ストレス耐性",
  "価値―信念",
] as const;

FORM3_PATTERN_ORDER.forEach((key, i) => {
  const def = getForm3PatternDefinition(key);
  check(
    `labelJa[${i}] ${EXPECTED_LABELS[i]}`,
    def.labelJa === EXPECTED_LABELS[i],
    def.labelJa,
  );
  check(
    `definition が空でない[${key}]`,
    def.definition.trim().length > 0,
    `len=${def.definition.trim().length}`,
  );
  check(
    `assessmentPerspectives が1件以上[${key}]`,
    def.assessmentPerspectives.length > 0 &&
      def.assessmentPerspectives.every((s) => s.trim().length > 0),
    `count=${def.assessmentPerspectives.length}`,
  );
  check(
    `informationChecklist が1件以上[${key}]`,
    def.informationChecklist.length > 0 &&
      def.informationChecklist.every((s) => s.trim().length > 0),
    `count=${def.informationChecklist.length}`,
  );
  check(
    `ガイド転記済み[${key}]`,
    isForm3PatternGuidePending(key) === false,
  );
});

// getForm3PatternDefinition が ORDER 全キーで同一参照を返すこと
for (const key of FORM3_PATTERN_ORDER) {
  const a = getForm3PatternDefinition(key);
  const b = FORM3_PATTERN_DEFINITIONS.find((d) => d.key === key);
  check(
    `lookup一致[${key}]`,
    b != null && a.key === b.key && a.labelJa === b.labelJa,
  );
}

// 型上のキー集合と定義集合が一致（12番目パターン追加の防止）
const allKeysCovered = (FORM3_PATTERN_KEYS as readonly Form3PatternKey[]).every(
  (k) => uniqueKeys.has(k),
);
check("KEYS 全件が定義に存在", allKeysCovered);

// ── 2. 空データ生成（独立オブジェクト） ───────
const empty = createEmptyForm3("A");
check("schemaVersion 設定", empty.schemaVersion === 1);
check("patientId 設定", empty.patientId === "A");
check("updatedAt は空文字", empty.updatedAt === "");
check(
  "11キーすべて存在",
  FORM3_PATTERN_KEYS.every((k) => empty.patterns[k] != null),
);

const firstKey = FORM3_PATTERN_KEYS[0];
const secondKey = FORM3_PATTERN_KEYS[1];
empty.patterns[firstKey].relatedInformation = "only-first";
check(
  "1パターン変更が他へ影響しない",
  empty.patterns[secondKey].relatedInformation === "",
  empty.patterns[secondKey].relatedInformation,
);
check(
  "空パターンの judgment は null",
  createEmptyForm3PatternData().judgment === null,
);
check(
  "空パターンの isReviewed は false",
  createEmptyForm3PatternData().isReviewed === false,
);

// ── 3. 進捗 ───────────────────────────────────
check(
  "未入力は not_started",
  getForm3PatternProgress(createEmptyForm3PatternData()) === "not_started",
);

check(
  "文字入力があれば in_progress",
  getForm3PatternProgress(
    withFields(createEmptyForm3PatternData(), {
      interpretation: "気づきあり",
    }),
  ) === "in_progress",
);

check(
  "判断あり・根拠なしは needs_rationale",
  getForm3PatternProgress(
    withFields(createEmptyForm3PatternData(), {
      judgment: "problem",
      judgmentRationale: "",
    }),
  ) === "needs_rationale",
);

check(
  "判断あり・根拠が空白のみは needs_rationale",
  getForm3PatternProgress(
    withFields(createEmptyForm3PatternData(), {
      judgment: "strength",
      judgmentRationale: "   ",
    }),
  ) === "needs_rationale",
);

function reviewedOk(
  judgment: Form3Judgment,
  extra?: Partial<Form3PatternData>,
): Form3PatternData {
  return withFields(createEmptyForm3PatternData(), {
    judgment,
    judgmentRationale: "根拠あり",
    additionalInformationNeeded:
      judgment === "insufficient_information" ? "追加で必要な情報" : "",
    isReviewed: true,
    ...extra,
  });
}

for (const j of [
  "functioning_normally",
  "strength",
  "problem",
  "risk",
] as const) {
  check(
    `${j} + 根拠 + isReviewed → reviewed`,
    getForm3PatternProgress(reviewedOk(j)) === "reviewed",
  );
  check(
    `${j} は整理済み条件を満たす`,
    meetsForm3ReviewRequirements(reviewedOk(j)) === true,
  );
}

check(
  "情報不足 + 根拠 + 追加情報 + isReviewed → reviewed_insufficient",
  getForm3PatternProgress(reviewedOk("insufficient_information")) ===
    "reviewed_insufficient",
);

check(
  "情報不足は追加必要情報が必須（条件）",
  checkForm3ReviewRequirements(
    withFields(createEmptyForm3PatternData(), {
      judgment: "insufficient_information",
      judgmentRationale: "根拠あり",
      additionalInformationNeeded: "",
    }),
  ).issues.includes("additional_information_required"),
);

check(
  "不正な isReviewed:true（根拠なし）を reviewed 扱いしない",
  getForm3PatternProgress(
    withFields(createEmptyForm3PatternData(), {
      judgment: "functioning_normally",
      judgmentRationale: "",
      isReviewed: true,
    }),
  ) === "needs_rationale",
);

check(
  "正常に機能している判断にも根拠が必要",
  checkForm3ReviewRequirements(
    withFields(createEmptyForm3PatternData(), {
      judgment: "functioning_normally",
      judgmentRationale: "",
    }),
  ).issues.includes("rationale_required"),
);

check(
  "強みの判断にも根拠が必要",
  checkForm3ReviewRequirements(
    withFields(createEmptyForm3PatternData(), {
      judgment: "strength",
      judgmentRationale: "",
    }),
  ).issues.includes("rationale_required"),
);

check(
  "judgment null は judgment_required",
  checkForm3ReviewRequirements(createEmptyForm3PatternData()).issues.includes(
    "judgment_required",
  ),
);

// 文字数では判定しない: 1文字でも in_progress、空なら not_started
check(
  "1文字入力でも in_progress（文字数閾値なし）",
  getForm3PatternProgress(
    withFields(createEmptyForm3PatternData(), { relatedInformation: "あ" }),
  ) === "in_progress",
);

// 全体進捗
const overallEmpty = getForm3OverallProgress(createEmptyForm3("A"));
check("全体 total は 11", overallEmpty.total === 11);
check("空データ reviewedCount は 0", overallEmpty.reviewedCount === 0);

const mixed = createEmptyForm3("A");
mixed.patterns.sleep_rest = reviewedOk("strength");
mixed.patterns.elimination = reviewedOk("insufficient_information");
const overallMixed = getForm3OverallProgress(mixed);
check("整理済み2件をカウント", overallMixed.reviewedCount === 2);

check("判断値は5種", FORM3_JUDGMENTS.length === 5);

// ── 結果 ──────────────────────────────────────
const failed = checks.filter((c) => !c.ok);
for (const c of checks) {
  const mark = c.ok ? "OK" : "FAIL";
  console.log(`[${mark}] ${c.name}${c.detail ? ` — ${c.detail}` : ""}`);
}
console.log(
  `\n===== form3 Day1/Day1.5: ${checks.length - failed.length} OK / ${failed.length} FAIL =====`,
);
if (failed.length > 0) process.exit(1);
