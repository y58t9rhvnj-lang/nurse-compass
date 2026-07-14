// 看護記録構造検証（Sprint A-3.2 / Hotfix）
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getChartData } from "../lib/chartData";
import type { NursingRecord } from "../lib/chartData";
import {
  DEFAULT_NURSING_SUB_TAB,
  NURSING_SUB_TABS,
  NURSING_SUBNAV_STICKY_CLASS,
  extractJapaneseQuotedStatements,
  inferNursingType,
  normalizeSoapFields,
  nursingRecordText,
  resolveSoapFields,
} from "../lib/nursingChart";
import { CHART_TABS } from "../lib/chartTabs";
import {
  PATIENT_A_NURSING_CLINICAL_RECORDS,
  PATIENT_A_NURSING_RECORDS,
} from "../lib/chart/patientANursingRecords";
import { PATIENT_A_NURSING_PLAN } from "../lib/chart/patientANursingPlan";
import { PATIENT_A_NURSING_SUMMARIES } from "../lib/chart/patientANursingSummaries";

let failures = 0;
function check(label: string, cond: boolean, detail?: string) {
  if (cond) console.log(`[OK]   ${label}`);
  else {
    console.error(`[FAIL] ${label}${detail ? ` (${detail})` : ""}`);
    failures += 1;
  }
}

check("看護記録サブビューが3つ", NURSING_SUB_TABS.length === 3);
check(
  "サブビュー順が 記録|看護計画|看護サマリー",
  NURSING_SUB_TABS.map((t) => t.label).join("|") === "記録|看護計画|看護サマリー",
  NURSING_SUB_TABS.map((t) => t.label).join("|"),
);
check(
  "サブビューidの順が daily|plan|summary",
  NURSING_SUB_TABS.map((t) => t.id).join("|") === "daily|plan|summary",
);
check(
  "デフォルトサブビューは記録(daily)",
  DEFAULT_NURSING_SUB_TAB === "daily" && NURSING_SUB_TABS[0].id === "daily",
  DEFAULT_NURSING_SUB_TAB,
);
check("『記録』ラベルを使用（日々の記録は不使用）", !NURSING_SUB_TABS.some((t) => t.label === "日々の記録"));
check(
  "sticky サブナビ設定が存在",
  NURSING_SUBNAV_STICKY_CLASS.includes("sticky") && NURSING_SUBNAV_STICKY_CLASS.includes("z-"),
);
check(
  "sticky サブナビが top-0 で密着",
  NURSING_SUBNAV_STICKY_CLASS.includes("top-0"),
  NURSING_SUBNAV_STICKY_CLASS,
);
check(
  "sticky サブナビが不透明背景",
  NURSING_SUBNAV_STICKY_CLASS.includes("bg-[#F7F7F9]"),
  NURSING_SUBNAV_STICKY_CLASS,
);
check(
  "sticky サブナビに隙間を生む負のマージンがない",
  !/-m[tybxl]?-/.test(NURSING_SUBNAV_STICKY_CLASS),
  NURSING_SUBNAV_STICKY_CLASS,
);

const viewSrc = readFileSync(
  join(process.cwd(), "components/chart/NursingRecordView.tsx"),
  "utf8",
);
check(
  "スクロールコンテナが上部パディングを持たない（ChartPanel非使用）",
  !viewSrc.includes("<ChartPanel>") && viewSrc.includes("overflow-y-auto"),
);
check(
  "上位タブ直下に sticky スタックを密着（NURSING_SUBNAV_STICKY_CLASS適用）",
  viewSrc.includes("className={NURSING_SUBNAV_STICKY_CLASS}"),
);
check(
  "sticky ラッパーの下にコンテンツ用パディングを分離",
  viewSrc.includes('className="px-2.5 pb-2.5 pt-2.5"'),
);

check(
  "トップタブが『医療サマリー』に改称",
  CHART_TABS.includes("医療サマリー") &&
    !(CHART_TABS as string[]).includes("サマリー"),
);

const chartA = getChartData("A");

check("Patient A 看護計画がある", chartA.nursingPlanItems.length >= 5, `${chartA.nursingPlanItems.length}件`);
check("Patient A 看護サマリーがある", chartA.nursingSummaries.length >= 5, `${chartA.nursingSummaries.length}件`);
check(
  "Patient A 看護計画モジュール一致",
  chartA.nursingPlanItems.length === PATIENT_A_NURSING_PLAN.length,
);
check(
  "Patient A 看護サマリーモジュール一致",
  chartA.nursingSummaries.length === PATIENT_A_NURSING_SUMMARIES.length,
);

check(
  "看護サマリーが医療サマリーに重複しない（フル本文）",
  !chartA.summaries.some(
    (s) => s.id === "sum-a-nursing" || s.title.includes("看護サマリー"),
  ),
);

const planDoc = chartA.clinicalDocuments.find((d) => d.id === "doc-a-nursing-plan");
check(
  "看護計画は書類で重複せず参照のみ",
  planDoc != null &&
    planDoc.sections.length <= 1 &&
    planDoc.sections.every((sec) => sec.body.includes("看護記録")),
);
check(
  "看護計画に #N プレフィックスを使用",
  chartA.nursingPlanItems.every((it) => /^N\d+$/.test(it.problemNumber)),
);

const tab = chartA.nursingRecords;
const clinical = chartA.clinicalRecords.filter((r) => r.profession === "看護");

check("看護記録タブに30件前後", tab.length >= 28 && tab.length <= 32, `${tab.length}件`);
check("診療録の看護エントリが7件", clinical.length === 7, `${clinical.length}件`);
check(
  "モジュールとカルテの看護記録が一致",
  tab.length === PATIENT_A_NURSING_RECORDS.length && clinical.length === PATIENT_A_NURSING_CLINICAL_RECORDS.length,
);

const tabTypes = tab.map(inferNursingType);
const clinicalTypes = clinical.map(
  (r) =>
    r.nursingFormat === "narrative"
      ? "chronological"
      : (r.nursingFormat ?? (r.nursingObservation ? "soap" : r.nursingFocus ? "pos" : "chronological")),
);
const allTypes = [...tabTypes, ...clinicalTypes];
const total = allTypes.length;
const soapN = allTypes.filter((t) => t === "soap").length;
const posN = allTypes.filter((t) => t === "pos").length;
const chronoN = allTypes.filter((t) => t === "chronological").length;
const soapPct = Math.round((soapN / total) * 100);
const posPct = Math.round((posN / total) * 100);
const chronoPct = Math.round((chronoN / total) * 100);

check("SOAP記録が約45%", soapPct >= 40 && soapPct <= 50, `${soapPct}% (${soapN}/${total})`);
check("POS記録が約25%", posPct >= 20 && posPct <= 30, `${posPct}% (${posN}/${total})`);
check("経時記録が約30%", chronoPct >= 25 && chronoPct <= 35, `${chronoPct}% (${chronoN}/${total})`);

check("記録にSOAPがある", tabTypes.includes("soap"));
check("記録にPOSがある", tabTypes.includes("pos"));
check("記録に経時がある", tabTypes.includes("chronological"));

const soapTab = tab.filter((r) => inferNursingType(r) === "soap");
check(
  "SOAP記録にS/O構造がある",
  soapTab.every((r) => {
    const { s, o, a, p } = resolveSoapFields(r);
    return Boolean((s || o) && (a || p || r.intervention || r.evaluation));
  }),
);

// ── Sprint A-3.2 Hotfix: 患者発言「」のS/O分離 ──
// 全患者のSOAP記録を対象に、正規化後のOに「」が残っていないことを保証する。
const allSoapRecords: NursingRecord[] = [];
for (const pid of ["A", "E", "F", "G", "H"]) {
  const c = getChartData(pid);
  for (const r of c.nursingRecords) {
    if (inferTypeSafe(r) === "soap") allSoapRecords.push(r);
  }
}
check(
  "正規化後のOに「」患者発言が残らない（全患者SOAP）",
  allSoapRecords.every((r) => extractJapaneseQuotedStatements(normalizeSoapFields(r).o).length === 0),
  `${allSoapRecords.length}件走査`,
);
check(
  "O源に「」があればSに整理される（全患者SOAP）",
  allSoapRecords.every((r) => {
    const oSource = r.o ?? r.observation ?? "";
    const quotes = extractJapaneseQuotedStatements(oSource);
    if (quotes.length === 0) return true;
    const { s } = normalizeSoapFields(r);
    return quotes.every((q) => s.includes(q)) || (r.s ?? "").trim() !== "";
  }),
);
check(
  "SOAPのS/O/A/Pが独立して解決できる",
  soapTab.every((r) => {
    const n = normalizeSoapFields(r);
    return (
      typeof n.s === "string" &&
      typeof n.o === "string" &&
      typeof n.a === "string" &&
      typeof n.p === "string"
    );
  }),
);
const soapNoSubjective = soapTab.filter(
  (r) => normalizeSoapFields(r).s.trim() === "",
);
check(
  "患者発言のないSOAPが存在し記載なし表示になる",
  soapNoSubjective.length > 0,
  `${soapNoSubjective.length}件`,
);

// ── ヘルパー単体チェック ──
check(
  "extractJapaneseQuotedStatements が複数引用を順序抽出",
  JSON.stringify(
    extractJapaneseQuotedStatements("Aを見て「できるかな」「うらやましい」と発言。"),
  ) === JSON.stringify(["「できるかな」", "「うらやましい」"]),
);
const legacyMix: NursingRecord = {
  date: "2020/01/01",
  time: "10:00",
  author: "看護師",
  format: "soap",
  observation: "消灯後も覚醒している。「今日は声が気になって、眠れそうにないです」と話す。表情に緊張あり。",
  evaluation: "夜間の不眠。",
  intervention: "傾聴。",
};
const legacyNorm = normalizeSoapFields(legacyMix);
check(
  "旧O混在→引用はSへ",
  legacyNorm.s.includes("「今日は声が気になって、眠れそうにないです」"),
  legacyNorm.s,
);
check(
  "旧O混在→引用はOから除去",
  !legacyNorm.o.includes("「"),
  legacyNorm.o,
);
check(
  "旧O混在→客観情報はOに残る",
  legacyNorm.o.includes("消灯後も覚醒") && legacyNorm.o.includes("表情に緊張あり"),
  legacyNorm.o,
);
check(
  "旧O混在→SにOの客観文が混入しない",
  !legacyNorm.s.includes("消灯後も覚醒"),
  legacyNorm.s,
);
const explicitDup: NursingRecord = {
  date: "2020/01/01",
  time: "10:00",
  author: "看護師",
  format: "soap",
  s: "「眠れない」",
  o: "覚醒。「眠れない」と訴える。緊張あり。",
};
const explicitNorm = normalizeSoapFields(explicitDup);
check(
  "明示Sが優先されOの重複引用は除去",
  explicitNorm.s === "「眠れない」" && !explicitNorm.o.includes("「"),
  `${explicitNorm.s} / ${explicitNorm.o}`,
);
check(
  "患者発言なしのSは空（記載なしへ）",
  normalizeSoapFields({
    date: "2020/01/01",
    time: "10:00",
    author: "看護師",
    format: "soap",
    observation: "覚醒している。表情に緊張あり。",
  } as NursingRecord).s === "",
);

const posTab = tab.filter((r) => inferNursingType(r) === "pos");
check(
  "POS記録にフォーカスと本文がある",
  posTab.every((r) => Boolean(r.focus || r.problemNumber) && Boolean(r.body || r.course)),
);
check(
  "POSに経過・評価・計画をもつ記録がある（#N付き）",
  posTab.some(
    (r) =>
      /^N\d+$/.test(r.problemNumber ?? "") &&
      Boolean(r.course) &&
      Boolean(r.posEvaluation) &&
      Boolean(r.posPlan),
  ),
);
check(
  "POS記録に偽SOAPフィールド(A/P)なし",
  posTab.every((r) => !r.a && !r.p),
);

const chronoTab = tab.filter((r) => inferNursingType(r) === "chronological");
check(
  "経時記録に偽SOAPフィールドなし",
  chronoTab.every((r) => !r.s && !r.a && !r.p && !r.observation && !r.intervention && !r.evaluation),
);

check("全タブ記録に本文がある", tab.every((r) => nursingRecordText(r).length > 0));

function inferTypeSafe(r: NursingRecord) {
  try {
    return inferNursingType(r);
  } catch {
    return null;
  }
}

for (const pid of ["E", "F", "G", "H"]) {
  const c = getChartData(pid);
  check(
    `${pid} 患者の看護データがクラッシュしない`,
    c.nursingRecords.every((r) => inferTypeSafe(r) !== null) &&
      Array.isArray(c.nursingPlanItems) &&
      Array.isArray(c.nursingSummaries),
  );
}

const topics = [
  "幻聴",
  "頓服",
  "からだが重い",
  "服薬",
  "Iさん",
  "SST",
  "OT",
  "入浴",
  "歯みがき",
  "洗濯",
  "お金",
  "体重",
  "便秘",
  "感冒",
  "退院",
];
const allText = tab.map(nursingRecordText).join(" ") + clinical.map((r) => r.content).join(" ");
for (const topic of topics) {
  check(`Patient A 記録に「${topic}」の話題`, allText.includes(topic));
}

const oldSummary = chartA.nursingSummaries.find((s) => s.id === "nsum-a-admission");
const currentSummary = chartA.nursingSummaries.find((s) => s.id === "nsum-a-current");
check(
  "入院時サマリーに未来知識なし",
  oldSummary != null && !oldSummary.medication.includes("Iさん") && !oldSummary.strengths.includes("SST"),
);
check(
  "現在看護サマリーにSST言及",
  currentSummary != null && currentSummary.activity.includes("SST"),
);

// 旧形式の正規化
const legacySoap: NursingRecord = {
  date: "2020/01/01",
  time: "10:00",
  author: "看護師",
  observation: "訴えあり",
  intervention: "傾聴",
  evaluation: "継続観察",
};
const legacyPos: NursingRecord = {
  date: "2020/01/01",
  time: "11:00",
  author: "看護師",
  focus: "睡眠",
  body: "入眠良好",
};
const legacyChrono: NursingRecord = {
  date: "2020/01/01",
  time: "12:00",
  author: "看護師",
  content: "病室で過ごす",
};
check("旧SOAP正規化", inferNursingType(legacySoap) === "soap");
check("旧POS正規化", inferNursingType(legacyPos) === "pos");
check("旧経時正規化", inferNursingType(legacyChrono) === "chronological");

console.log(
  `\nNursing record validation: ${failures} failed (${total} entries, SOAP ${soapPct}% / POS ${posPct}% / 経時 ${chronoPct}%)`,
);
if (failures > 0) process.exit(1);
