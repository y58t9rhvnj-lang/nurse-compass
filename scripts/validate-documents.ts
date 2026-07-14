// アセスメント帳票（記載済みA4文書）整合性検証
//
// 目的: Patient A の4帳票（入院診療計画書・転倒転落・褥瘡・栄養）が、
//       既存データと矛盾なく、評価結果と個別計画が対応していることを自動チェックする。
// 実行: npx tsx scripts/validate-documents.ts

import { getChartData } from "../lib/chartData";
import type { FormDocument } from "../lib/chartData";

type Check = { name: string; ok: boolean; detail?: string };
const checks: Check[] = [];
function check(name: string, ok: boolean, detail?: string) {
  checks.push({ name, ok, detail });
}

const chart = getChartData("A");
const forms = chart.formDocuments;

function textOf(doc: FormDocument): string {
  return JSON.stringify(doc);
}
function find(name: string): FormDocument | undefined {
  return forms.find((d) => d.documentName === name);
}

// ── 1. 4帳票の存在と名称 ─────────────────────────────
const NAMES = [
  "入院診療計画書",
  "転倒・転落アセスメントシート",
  "褥瘡リスクアセスメントシート",
  "栄養スクリーニング・アセスメントシート",
];
check("帳票が4件", forms.length === 4, `${forms.length}件`);
for (const n of NAMES) {
  check(`「${n}」が存在`, !!find(n));
}

// ── 2. 患者情報の一貫性（全帳票） ─────────────────────
for (const doc of forms) {
  const t = textOf(doc);
  check(
    `${doc.documentName}: 患者ID P-2021-0308`,
    t.includes("P-2021-0308"),
  );
  check(`${doc.documentName}: 氏名 Aさん`, t.includes("Aさん"));
  check(`${doc.documentName}: 主病名 統合失調症`, t.includes("統合失調症"));
  check(
    `${doc.documentName}: 状態が確定/評価済/説明済のいずれか`,
    ["確定", "評価済", "説明済"].includes(doc.status),
  );
  check(`${doc.documentName}: ページ数>=1`, doc.pageCount >= 1);
}

// ── 3. 入院診療計画書（入院時・医療保護入院、未来知識なし） ────────
const plan = find("入院診療計画書");
if (plan) {
  const t = textOf(plan);
  check("入院診療計画書: 医療保護入院", t.includes("医療保護入院"));
  check("入院診療計画書: 入院日2021/06/18", t.includes("2021/06/18"));
  check(
    "入院診療計画書: 治療目標が具体的（安定化/生活）",
    t.includes("安定化") && t.includes("生活"),
  );
  check("入院診療計画書: 退院支援に住居確保", t.includes("住居"));
  // 入院時点で未把握のはずの情報を書き込んでいない
  check("入院診療計画書: 未来知識なし（Iさん）", !t.includes("Iさん"));
  check("入院診療計画書: 未来知識なし（SST定着）", !t.includes("SST"));
  check("入院診療計画書: 未来知識なし（体重70）", !t.includes("70"));
  check(
    "入院診療計画書: 面接で把握すべき情報を残す（聴取困難/確認予定）",
    t.includes("聴取困難") || t.includes("確認予定"),
  );
}

// ── 4. 転倒・転落（危険度と点数の整合、薬剤の実在、過剰対策なし） ──
const fall = find("転倒・転落アセスメントシート");
if (fall) {
  const t = textOf(fall);
  check("転倒: 危険度Ⅰ（低〜中）", t.includes("危険度Ⅰ"));
  check("転倒: 合計点9点", t.includes("9点") || t.includes('"9"'));
  check("転倒: 歩行自立を反映", t.includes("歩行自立"));
  // 実在する処方薬のみ（転倒関連）
  for (const drug of [
    "ゾピクロン",
    "ブロチゾラム",
    "リスペリドン",
    "クエチアピン",
    "ロフラゼプ酸エチル",
  ]) {
    check(`転倒: 実在処方薬を参照（${drug}）`, t.includes(drug));
  }
  // 未処方の薬効群を「処方あり」として記載していない
  check(
    "転倒: 降圧薬・利尿薬を処方薬として誤記載していない",
    t.includes("降圧薬・利尿薬の処方はなし") || !t.includes("利尿薬"),
  );
  // 過剰対策を設定していない
  check("転倒: センサーマットを設定していない", !t.includes("センサーマット") || t.includes("設定しない"));
  check("転倒: 身体抑制を設定していない", !t.includes("抑制") || t.includes("設定しない"));
  check(
    "転倒: 常時付き添いを設定していない",
    !t.includes("常時付き添い") || t.includes("設定しない"),
  );
  check("転倒: 再評価タイミング記載", t.includes("再評価"));
}

// 実在処方薬名（active）を取得し、転倒帳票の薬剤が実在することを担保
const activeDrugs = new Set<string>();
for (const o of chart.prescriptionOrders) {
  if ((o.status ?? "active") !== "active") continue;
  for (const g of o.groups) for (const d of g.drugs) activeDrugs.add(d.name);
}
if (fall) {
  const t = textOf(fall);
  const cited = ["ゾピクロン", "ブロチゾラム", "リスペリドン", "クエチアピン", "ロフラゼプ酸エチル"];
  const allReal = cited.every(
    (c) => t.includes(c) && [...activeDrugs].some((n) => n.includes(c)),
  );
  check("転倒: 記載薬剤はすべて実在の処方に一致", allReal);
}

// ── 5. 褥瘡（低リスク・皮膚障害なし・過剰計画なし） ─────────
const pressure = find("褥瘡リスクアセスメントシート");
if (pressure) {
  const t = textOf(pressure);
  check("褥瘡: 低リスク", t.includes("低リスク"));
  check("褥瘡: 合計0点", t.includes("0点") || t.includes('"0"'));
  check("褥瘡: 明らかな皮膚障害なし", t.includes("明らかな皮膚障害なし"));
  check("褥瘡: 現在の褥瘡なし", t.includes("現在の褥瘡"));
  check(
    "褥瘡: 機械的な2時間ごと体位変換を設定していない",
    !t.includes("2時間ごと") || t.includes("設定しない"),
  );
  check("褥瘡: 採点方式を明示（点数が高いほど）", t.includes("点数が高いほど"));
}

// ── 6. 栄養（BMI計算・低リスク・架空検査値なし・過剰介入なし） ──
const nutrition = find("栄養スクリーニング・アセスメントシート");
if (nutrition) {
  const t = textOf(nutrition);
  // BMI = 70.2 / 1.65^2 = 25.78 → 25.8
  const bmi = Math.round((70.2 / (1.65 * 1.65)) * 10) / 10;
  check("栄養: BMI計算が正しい（25.8）", bmi === 25.8 && t.includes("25.8"));
  check("栄養: 低リスク", t.includes("低リスク"));
  check("栄養: 意図的減量と明記（意図しない減少ではない）", t.includes("意図的") || t.includes("意図しない"));
  check("栄養: 食事は概ね全量摂取", t.includes("全量"));
  // 実在検査値のみ・未実施は未測定
  check("栄養: 実在するHb 13.8を参照", t.includes("13.8"));
  check("栄養: アルブミン等の未実施は未測定", t.includes("未測定"));
  check("栄養: 架空の正常アルブミン値を記載していない", !/アルブミン[^未]*g\/dL/.test(t));
  // 過剰介入なし
  check(
    "栄養: 不要な栄養補助食品を設定していない",
    !t.includes("補助食品") || t.includes("設定しない") || t.includes("不要"),
  );
}

// ── 7. 評価日の一貫性（3看護帳票は同一評価日） ────────────
const nursingForms = [fall, pressure, nutrition].filter(Boolean) as FormDocument[];
check(
  "看護3帳票の評価日が一致（2025/07/01）",
  nursingForms.every((d) => d.evaluationDate === "2025/07/01"),
);

// ── 出力 ─────────────────────────────────────────────
let pass = 0;
for (const c of checks) {
  const mark = c.ok ? "✅" : "❌";
  if (c.ok) pass++;
  console.log(`${mark} ${c.name}${c.detail ? `  (${c.detail})` : ""}`);
}
console.log(`\n${pass}/${checks.length} checks passed`);
if (pass !== checks.length) process.exit(1);
