// Phase A-1: Patient A 一貫性検証スクリプト（§15）
//
// 目的: 第1回講義で使う患者Aの内容が、Canonical facts と各データ間で
//       矛盾なく整合していることを自動チェックする。
// 実行: npx tsx scripts/validate-patient-a.ts
//
// 判定に用いない「意図的な不確かさ」は最後に別枠で報告する。

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PATIENTS } from "../lib/wardData";
import { getChartData } from "../lib/chartData";
import { getCompassExtra } from "../lib/compassPatientData";

const TODAY = "2025/07/09";
const ADMIT = "2021/06/18";

type Check = { name: string; ok: boolean; detail?: string };
const checks: Check[] = [];
function check(name: string, ok: boolean, detail?: string) {
  checks.push({ name, ok, detail });
}

const ward = PATIENTS.A;
const chart = getChartData("A");
const info = chart.patientInfo;
const compass = getCompassExtra("A");

// カルテ全文（テキスト検索用）
const chartText = JSON.stringify(chart);

// 会話定義（コード上の文字列を検証）
const convoSrc = readFileSync(
  join(process.cwd(), "lib", "patientFacingData.ts"),
  "utf8",
);
// A の会話ブロックだけを抽出（"  A: {" から次の "  // Eさん" の直前まで）
const aStart = convoSrc.indexOf("  A: {");
const eStart = convoSrc.indexOf("Eさん", aStart);
const aConvo = aStart >= 0 && eStart >= 0 ? convoSrc.slice(aStart, eStart) : "";

// 日付ユーティリティ
function toUTC(d: string): number {
  const [y, m, day] = d.split("/").map(Number);
  return Date.UTC(y, m - 1, day);
}
function daysBetween(a: string, b: string): number {
  return Math.round((toUTC(b) - toUTC(a)) / 86400000);
}

// ── 1. 年齢・性別 ─────────────────────────────
check("年齢 47歳（病棟・カルテ一致）", ward.age === 47 && info.age === 47, `ward=${ward.age}, chart=${info.age}`);
check("性別 男性（病棟・カルテ一致）", ward.sex === "男性" && info.sex === "男性");

// ── 2. 診断・入院形態・時期 ───────────────────
check("診断 統合失調症", ward.diagnosis === "統合失調症" && info.diagnosis === "統合失調症");
check("入院日 一致（病棟・カルテ）", ward.admit === ADMIT && info.admit === ADMIT, `ward=${ward.admit}, chart=${info.admit}`);
check("医療保護→任意入院の経緯がカルテに存在", chartText.includes("医療保護入院") && chartText.includes("任意入院"));
check("5回目の入院である旨の記載", chartText.includes("5回目の入院"));

// ── 3. 家族・キーパーソン（叔父）／同胞なし ─────
check("キーパーソンは叔父（基本情報）", info.family.includes("叔父"));
check("母を現在のキーパーソンとしていない", !info.family.includes("母と二人暮らし") && !info.family.includes("母がキーパーソン"));
check("同胞なし（妹の記載が残っていない）", !chartText.includes("妹"));
check("旧設定（印刷会社/製本）が残っていない", !chartText.includes("印刷会社") && !chartText.includes("製本"));

// ── 4. 身長・体重（現在/以前） ────────────────
check("身長165cmの記載", chartText.includes("165cm"));
check("以前約80kg・現在約70kgの記載", chartText.includes("80kg") && chartText.includes("70kg"));
check("以前の脂質異常が改善した記載", chartText.includes("脂質") && chartText.includes("改善"));

// ── 5. 服薬の一貫性 ───────────────────────────
const teiki = chart.prescriptionOrders.filter(
  (o) => o.category === "定期" && (o.status === "active" || o.status === undefined),
);
const teikiDrugs = teiki.flatMap((o) => o.groups.flatMap((g) => g.drugs.map((d) => d.name))).join(" ");
for (const drug of ["ロフラゼプ酸エチル", "リスペリドン", "クエチアピン", "ゾピクロン"]) {
  check(`定期処方に ${drug} が含まれる`, teikiDrugs.includes(drug), teikiDrugs);
}
const tonpuku = chart.prescriptionOrders.filter((o) => o.category === "頓服");
const tonpukuDrugs = tonpuku.flatMap((o) => o.groups.flatMap((g) => g.drugs.map((d) => d.name))).join(" ");
check("頓服に ブロチゾラム（不眠時）が含まれる", tonpukuDrugs.includes("ブロチゾラム"));
check("頓服に センノシド（便秘時）が含まれる", tonpukuDrugs.includes("センノシド"));
check("現行の定期処方にクロルプロマジンが残っていない", !teikiDrugs.includes("クロルプロマジン"));
check(
  "クロルプロマジン→クエチアピンの変更が処方履歴に記録されている",
  chart.prescriptionHistory.some((h) => h.label.includes("クロルプロマジン") && h.label.includes("クエチアピン")),
);

// ── 6. 感冒の臨時処方エピソード ───────────────
check("感冒に対する臨時処方が存在", chart.prescriptionOrders.some((o) => o.category === "臨時"));
check("感冒（咽頭痛/鼻汁）が記録されている", chartText.includes("咽頭痛") && chartText.includes("鼻汁"));
check("肺炎などの重大合併症を作っていない", !chartText.includes("肺炎") || chartText.includes("肺炎を疑う所見なし"));

// ── 7. フローシート（14日連続・入院日数整合） ──
const fs = [...chart.flowsheet].sort((a, b) => a.date.localeCompare(b.date));
check("フローシートが14日以上", fs.length >= 14, `${fs.length}日`);
let consecutive = true;
for (let i = 1; i < fs.length; i++) {
  if (daysBetween(fs[i - 1].date, fs[i].date) !== 1) consecutive = false;
}
check("フローシートの日付が連続している", consecutive);
const latest = fs[fs.length - 1];
check(
  "最新日の入院日数が入院日から算出した値と一致",
  latest.dayOfStay === daysBetween(ADMIT, latest.date) + 1,
  `dayOfStay=${latest.dayOfStay}, 期待=${daysBetween(ADMIT, latest.date) + 1}`,
);

// ── 8. 幻聴と睡眠の関連 ───────────────────────
const voicesSleep =
  chart.clinicalRecords.some((r) => r.content.includes("幻聴") && (r.content.includes("入眠") || r.content.includes("不眠"))) ||
  chart.nursingRecords.some((r) => {
    const t = [r.observation, r.evaluation, r.body, r.content].filter(Boolean).join(" ");
    return t.includes("幻聴");
  });
check("幻聴と不眠/入眠の関連が記録されている", voicesSleep);
check("幻聴の内容（自己否定的）が記載されている", chartText.includes("だめな人間") || chartText.includes("怠け者"));
check("ラジオでの対処が記載されている", chartText.includes("ラジオ"));

// ── 9. 回復のサイン ───────────────────────────
check("SST参加の定着が記載されている", chartText.includes("SST"));
check("体重管理への取り組みが記載されている", chartText.includes("体重") && chartText.includes("間食"));
check("服薬自己管理への関心が記載されている", chartText.includes("自己管理") && chartText.includes("Iさん"));

// ── 10. 治療方針（地域生活） ──────────────────
check(
  "退院支援・地域生活の方針が記載されている",
  chartText.includes("グループホーム") || chartText.includes("地域生活") || chartText.includes("退院支援"),
);

// ── 11. サマリー（医師・多職種。看護サマリーは看護記録タブ） ──
check("一般サマリーが8本以上", chart.summaries.length >= 8, `${chart.summaries.length}本`);
check(
  "看護サマリーは看護記録エリアに移動",
  chart.nursingSummaries.length >= 5 &&
    !chart.summaries.some((s) => s.id === "sum-a-nursing"),
  `nursingSummaries=${chart.nursingSummaries.length}`,
);
const admissionSummary = chart.summaries.find((s) => s.id === "sum-a-admission");
check("入院時サマリーの日付が入院日と一致", admissionSummary?.date === ADMIT);
check(
  "入院時サマリーに後の知識（任意入院/SST/退院支援）が混入していない",
  !!admissionSummary &&
    !admissionSummary.content.includes("任意入院") &&
    !admissionSummary.content.includes("SST") &&
    !admissionSummary.content.includes("退院支援"),
);
const timepoints = new Set(chart.summaries.map((s) => s.timepoint));
check("サマリーの時点が複数（時間変化を示す）", timepoints.size >= 3);

// ── 12. 臨床文書（複数の視点）＋記載済み帳票 ─────────────────
const totalDocs = chart.clinicalDocuments.length + chart.formDocuments.length;
check("文書（臨床文書＋帳票）が10件以上", totalDocs >= 10, `${totalDocs}件`);
check("記載済み帳票が4件", chart.formDocuments.length === 4, `${chart.formDocuments.length}件`);
const formText = JSON.stringify(chart.formDocuments);
check(
  "入院診療計画書の帳票が存在",
  chart.formDocuments.some((d) => d.documentName === "入院診療計画書"),
);
const fall = chart.formDocuments.find(
  (d) => d.documentName === "転倒・転落アセスメントシート",
);
check("転倒・転落アセスメント帳票が存在", !!fall);
check(
  "転倒リスクを過大評価していない（危険度Ⅰ／低〜中）",
  !!fall && JSON.stringify(fall).includes("危険度Ⅰ"),
);
const pressure = chart.formDocuments.find(
  (d) => d.documentName === "褥瘡リスクアセスメントシート",
);
check(
  "褥瘡リスクは低リスク",
  !!pressure && JSON.stringify(pressure).includes("低リスク"),
);
const nutrition = chart.formDocuments.find(
  (d) => d.documentName === "栄養スクリーニング・アセスメントシート",
);
check(
  "栄養リスクは低リスク（食事良好と整合）",
  !!nutrition && JSON.stringify(nutrition).includes("低リスク"),
);
check(
  "帳票に架空値の検査結果を追加していない（未測定表記）",
  formText.includes("未測定"),
);
check("多職種カンファレンス記録が存在", chart.clinicalDocuments.some((d) => d.category.includes("多職種")));

// ── 13. 日付の妥当性（未来日なし） ─────────────
const allDates: string[] = [
  ...chart.clinicalRecords.map((r) => r.date),
  ...chart.nursingRecords.map((r) => r.date),
  ...chart.flowsheet.map((r) => r.date),
  ...chart.exams.map((r) => r.date),
  ...chart.summaries.map((r) => r.date),
  ...chart.prescriptionOrders.map((r) => r.datetime.split(" ")[0]),
];
const future = allDates.filter((d) => toUTC(d) > toUTC(TODAY));
check("未来日の記録がない", future.length === 0, future.join(", "));

// ── 14. 検査トレンド（脂質改善・HbA1c安定） ────
const lipid = chart.exams.filter((e) => e.category === "脂質" && e.kind === "blood");
check("脂質検査が複数時点存在", lipid.length >= 2, `${lipid.length}時点`);
const a1c = chart.exams.filter((e) => e.category === "血糖" && e.kind === "blood");
check("HbA1c（血糖）検査が複数時点存在", a1c.length >= 2, `${a1c.length}時点`);
check("心電図（QT評価）が存在", chart.exams.some((e) => e.category === "心電図"));

// ── 15. 会話とカルテの整合（I/叔父の命名一致） ──
check("会話でキーパーソンを叔父としている", aConvo.includes("叔父"));
check("会話に旧設定（母の面会）が残っていない", !aConvo.includes("本人：母の面会あり"));
check("会話に幻聴・ラジオの記載がある", aConvo.includes("幻聴") && aConvo.includes("ラジオ"));
check("会話に服薬自己管理への関心（Iさん）がある", aConvo.includes("Iさん") && aConvo.includes("自己管理"));
check("会話に『ここにいる方が安心』の退院不安がある", aConvo.includes("ここにいる方が安心"));

// ── 16. Compass 患者トップの整合 ──────────────
check("患者トップ（今日の様子）が幻聴/ラジオに言及", (compass.today.sleep + compass.today.summary).includes("幻聴") || (compass.today.sleep).includes("ラジオ"));
check("患者トップに旧設定（製本/母の肉じゃが）が残っていない", !JSON.stringify(compass).includes("製本") && !JSON.stringify(compass).includes("肉じゃが"));

// ── 結果出力 ──────────────────────────────────
const failed = checks.filter((c) => !c.ok);
console.log(`Patient A consistency validation: ${checks.length} checks, ${failed.length} failed`);
for (const c of checks) {
  console.log(`  ${c.ok ? "[PASS]" : "[FAIL]"} ${c.name}${c.detail && !c.ok ? `  (${c.detail})` : ""}`);
}

console.log("\n── 意図的な不確かさ（判定対象外・仕様上あいまいなまま残す事項） ──");
for (const note of [
  "2〜4回目の入院の正確な年月は代表的な年のみを置き、日単位の厳密さは持たせていない。",
  "叔父が実際にAを嫌っているかは未確認（Aの受けとめであり、事実として断定しない）。",
  "退院先（グループホーム/アパート）は検討段階で確定していない。",
  "父の消息（行方不明）は不明のままとし、詳細な経緯は作り込まない。",
]) {
  console.log(`  - ${note}`);
}

if (failed.length > 0) process.exit(1);
console.log("\nAll Patient A consistency checks passed.");
