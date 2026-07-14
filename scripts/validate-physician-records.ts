// Sprint A-3.1: 患者A 医師記録・処方・オーダー整合性検証。
import { getChartData } from "../lib/chartData";
import { PATIENT_A_PHYSICIAN_RECORDS } from "../lib/chart/patientAPhysicianRecords";

const TODAY = "2025/07/09";
const ADMIT = "2021/06/18";

let failures = 0;
function check(label: string, cond: boolean, detail?: string) {
  if (cond) {
    console.log(`[OK]   ${label}`);
  } else {
    console.error(`[FAIL] ${label}${detail ? ` (${detail})` : ""}`);
    failures += 1;
  }
}

function toUTC(d: string): number {
  const [y, m, day] = d.split("/").map(Number);
  return Date.UTC(y, m - 1, day);
}

const chart = getChartData("A");
const physician = chart.clinicalRecords.filter((r) => r.profession === "医師");
const allPhysician = PATIENT_A_PHYSICIAN_RECORDS;

// ── 件数・日付範囲 ─────────────────────────────
check("医師記録が45件以上", physician.length >= 45, `${physician.length}件`);
check("医師記録が60件以下", physician.length <= 60, `${physician.length}件`);
const dates = physician.map((r) => r.date).sort();
check(
  "日付範囲が入院日から今日まで",
  dates[0] === ADMIT && toUTC(dates[dates.length - 1]) <= toUTC(TODAY),
  `${dates[0]} 〜 ${dates[dates.length - 1]}`,
);

// ── 問題リスト（POS）番号の安定性 ───────────────
const problemList = physician.find((r) => r.id === "clinical-a-problemlist");
check("問題リスト記録が存在", !!problemList);
if (problemList) {
  for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) {
    check(`問題リストに #${n} が含まれる`, problemList.content.includes(`#${n}`));
  }
  check("問題リストに看護問題の表現がない", !problemList.content.includes("看護問題"));
}

const withProblems = physician.filter((r) => r.problems && r.problems.length > 0);
check("全医師記録に問題番号が付いている", withProblems.length === physician.length, `${withProblems.length}/${physician.length}`);
check("POS番号付き記録が多数存在", withProblems.length >= 20, `${withProblems.length}件`);
const badProblemNums = withProblems.flatMap((r) => r.problems ?? []).filter((n) => n < 1 || n > 9);
check("問題番号は #1〜#9 の範囲", badProblemNums.length === 0);

// ── 時系列 ─────────────────────────────────────
let chrono = true;
const sorted = [...physician].sort((a, b) => {
  const d = a.date.localeCompare(b.date);
  return d !== 0 ? d : a.time.localeCompare(b.time);
});
for (let i = 1; i < sorted.length; i++) {
  const prev = sorted[i - 1];
  const cur = sorted[i];
  const pd = prev.date.localeCompare(cur.date);
  if (pd > 0) chrono = false;
  if (pd === 0 && prev.time > cur.time) chrono = false;
}
check("医師記録の日付・時刻が矛盾しない", chrono);

const voluntary = physician.find((r) => r.id === "clinical-a-voluntary-20230710");
const admission = physician.find((r) => r.id === "clinical-a-admission");
check(
  "任意入院記録は入院記録より後",
  !!voluntary && !!admission && voluntary.date > admission.date,
);

// ── 処方（定期・頓服・臨時・履歴） ───────────────
const teiki = chart.prescriptionOrders.filter((o) => o.category === "定期" && (o.status ?? "active") === "active");
const teikiDrugs = teiki.flatMap((o) => o.groups.flatMap((g) => g.drugs.map((d) => d.name))).join(" ");
for (const drug of ["ロフラゼプ酸エチル", "リスペリドン", "クエチアピン", "ゾピクロン"]) {
  check(`現行定期処方に ${drug}`, teikiDrugs.includes(drug));
}
check("現行定期にクロルプロマジンがない", !teikiDrugs.includes("クロルプロマジン"));

const tonpuku = chart.prescriptionOrders.filter((o) => o.category === "頓服");
const tonpukuDrugs = tonpuku.flatMap((o) => o.groups.flatMap((g) => g.drugs.map((d) => d.name))).join(" ");
check("頓服にブロチゾラム", tonpukuDrugs.includes("ブロチゾラム"));
check("頓服にセンノシド", tonpukuDrugs.includes("センノシド"));
check("頓服にアセトアミノフェン", tonpukuDrugs.includes("アセトアミノフェン"));

const rinji = chart.prescriptionOrders.filter((o) => o.category === "臨時");
check("臨時処方が存在", rinji.length >= 1);
check(
  "臨時処方に開始と終了（completed）がある",
  rinji.some((o) => o.status === "completed" && !!o.endDate),
);

const hist = chart.prescriptionHistory.map((h) => h.label).join(" ");
check("処方履歴にクロルプロマジン→クエチアピン変更", hist.includes("クロルプロマジン") && hist.includes("クエチアピン"));
check("入院時処方の履歴がある", hist.includes("入院時"));

const discontinued = chart.prescriptionOrders.filter((o) => o.status === "discontinued");
check("中止された歴史的処方がある", discontinued.length >= 1);
check(
  "クロルプロマジンは中止済み処方のみ",
  discontinued.some((o) =>
    o.groups.some((g) => g.drugs.some((d) => d.name.includes("クロルプロマジン"))),
  ),
);

// ── オーダー → 結果 → レビュー チェーン ─────────
const orderRecords = physician.filter((r) => r.orderId);
const reviewRecords = physician.filter(
  (r) => r.orderId && (r.content.includes("採血") || r.content.includes("LDL") || r.content.includes("HbA1c")),
);
check("オーダー記録が存在", orderRecords.length >= 3, `${orderRecords.length}件`);
check("結果レビュー記録が存在", reviewRecords.length >= 2, `${reviewRecords.length}件`);

const lab2025Order = physician.find((r) => r.orderId === "order-a-labs-20250620" && r.content.includes("指示"));
const lab2025Review = physician.find((r) => r.id === "clinical-a-20250628-lab-review");
check(
  "2025/06 採血オーダー→レビューの連鎖",
  !!lab2025Order && !!lab2025Review && lab2025Review.date > lab2025Order.date,
);

// ── 臨床スレッド ───────────────────────────────
const sleepThread = physician.some((r) => r.problems?.includes(2) || r.problems?.includes(3));
check("睡眠/幻聴スレッドの記録がある", sleepThread);
check(
  "睡眠スレッドに頓用の言及",
  physician.some((r) => r.content.includes("ブロチゾラム") || r.content.includes("頓用")),
);

const constipationThread = physician.some((r) => r.problems?.includes(6));
check("便秘スレッドの記録がある", constipationThread);

const selfMgmtThread = physician.some((r) => r.problems?.includes(7));
check("服薬自己管理スレッドの記録がある", selfMgmtThread);

const weightThread = physician.some((r) => r.problems?.includes(5));
check("体重/脂質スレッドの記録がある", weightThread);

const dischargeThread = physician.some((r) => r.problems?.includes(8));
check("退院支援スレッドの記録がある", dischargeThread);

const coldStart = physician.find((r) => r.id === "clinical-a-cold-20250703");
const coldEnd = physician.find((r) => r.id === "clinical-a-20250707-cold-end");
check("感冒エピソードに開始記録がある", !!coldStart);
check("感冒エピソードに終了記録がある", !!coldEnd && coldEnd.date > (coldStart?.date ?? ""));
check("感冒に肺炎などの重大合併症なし", !physician.some((r) => r.content.includes("肺炎") && !r.content.includes("肺炎を疑う所見なし")));

// ── POS + SOAP 表示（経過記録はS/O/A/P構造、指示・問題リストはPOS本文） ──
const soapRecords = physician.filter((r) => r.soap);
const contentOnly = physician.length - soapRecords.length;
const soapPct = Math.round((soapRecords.length / physician.length) * 100);
check(
  "経過記録がSOAP構造を持つ（多数）",
  soapRecords.length >= 40,
  `${soapRecords.length}件`,
);
check(
  "診療録のSOAP表示が過半数",
  soapPct >= 50,
  `${soapPct}% (${soapRecords.length}/${physician.length})`,
);
check(
  "指示記録・問題リストはPOS本文で保持",
  contentOnly >= 4 && contentOnly <= 10,
  `${contentOnly}件`,
);
check("SOAP構造の記録が存在", soapRecords.length >= 5, `${soapRecords.length}件`);
check(
  "S/O/A/P4要素を備えた記録が存在",
  soapRecords.some((r) => r.soap?.s && r.soap?.o && r.soap?.a && r.soap?.p),
);
check(
  "全SOAP記録にA（評価）またはP（計画）がある",
  soapRecords.every((r) => Boolean(r.soap?.a || r.soap?.p)),
);
check(
  "全SOAP記録の患者発言はSに格納（O/Aに素の「」混在なし）",
  soapRecords.every(
    (r) => !(r.soap?.o ?? "").includes("「") && !(r.soap?.a ?? "").includes("「"),
  ),
);

// ── 禁止表現・canon 矛盾 ───────────────────────
const joined = physician.map((r) => r.content).join("\n");
const prohibited = ["自己効力感", "看護問題は", "アセスメントとして", "と診断すべき"];
check(
  "医師記録に禁止アセスメント表現がない",
  !prohibited.some((p) => joined.includes(p)),
);
check("canon: 幻聴の自己否定的内容", joined.includes("だめな人間") || joined.includes("怠け者"));
check("canon: 5回目の入院", joined.includes("5回目"));
check("canon: 任意入院移行", joined.includes("任意入院"));
check("突然の退院意欲は出さない", !joined.includes("退院したい"));

// ── 脂質トレンド（検査データ） ─────────────────
const lipid = chart.exams
  .filter((e): e is import("../lib/chartData").BloodExam => e.kind === "blood" && e.category === "脂質")
  .sort((a, b) => a.date.localeCompare(b.date));
check("脂質検査が複数時点", lipid.length >= 2);
const ldls = lipid.map((e) => {
  const row = e.rows.find((r) => r.name === "LDL-C");
  return row ? Number(row.value) : 999;
});
if (ldls.length >= 2) {
  check("LDLが改善傾向（最新≤最古）", ldls[ldls.length - 1] <= ldls[0], ldls.join("→"));
}

// ── モジュールとカルテの一致 ───────────────────
check(
  "PATIENT_A_PHYSICIAN_RECORDS がカルテに反映されている",
  allPhysician.length === physician.length,
  `module=${allPhysician.length}, chart=${physician.length}`,
);

console.log(`\nPhysician record validation: ${failures} failed (${physician.length} physician entries)`);
if (failures > 0) {
  console.error("Some physician record checks FAILED.");
  process.exit(1);
} else {
  console.log("All physician record checks passed.");
}
