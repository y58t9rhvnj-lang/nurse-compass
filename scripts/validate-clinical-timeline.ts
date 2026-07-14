// 診療録タブの経過記録タイムライン検証（Sprint: 電子カルテ改善）。
// 診療録画面に看護記録が SOAP 構造のまま表示され、医師記録と区別でき、
// 患者ごとに正しく絞り込まれ、元データを複製していないことを確認する。
import { getChartData } from "../lib/chartData";
import {
  buildClinicalTimeline,
  RECORD_TYPE_LABEL,
  type TimelineRecord,
} from "../lib/chartTimeline";
import { inferNursingType } from "../lib/nursingChart";

let failures = 0;
function check(label: string, cond: boolean, detail?: string) {
  if (cond) console.log(`[OK]   ${label}`);
  else {
    console.error(`[FAIL] ${label}${detail ? ` (${detail})` : ""}`);
    failures += 1;
  }
}

const A = getChartData("A");
const timelineA = buildClinicalTimeline(A, "A");

const medical = timelineA.filter((r) => r.recordType === "medical");
const nursing = timelineA.filter((r) => r.recordType === "nursing");

// ── 1. 看護記録が診療録タイムラインに含まれる ──
check("診療録タイムラインに看護記録が含まれる", nursing.length > 0, `${nursing.length}件`);
check("診療録タイムラインに医師などの診療録が含まれる", medical.length > 0, `${medical.length}件`);

// ── 2. 看護記録の参照元は看護記録タブと同一（複製していない） ──
check(
  "看護記録の件数が看護記録タブと一致（複製なし）",
  nursing.length === A.nursingRecords.length,
  `timeline ${nursing.length} / tab ${A.nursingRecords.length}`,
);
check(
  "看護タイムラインの日時が看護記録タブの元データと一致",
  A.nursingRecords.every((src) =>
    nursing.some((r) => r.date === src.date && r.time === src.time && r.author === src.author),
  ),
);

// ── 3. 医師記録側に看護は混ざらない（二重表示防止） ──
check(
  "診療録（medical）側に看護記録が混在しない",
  medical.every((r) => r.profession !== "看護"),
);
// 看護は nursingRecords を正とし、clinicalRecords の看護エントリ数と看護タイムライン数は独立
// （＝ clinicalRecords の看護重複を診療録表示に流用していない）
const clinicalNursingCount = A.clinicalRecords.filter((r) => r.profession === "看護").length;
check(
  "看護表示は nursingRecords 由来（clinicalRecords の看護重複を使っていない）",
  nursing.length === A.nursingRecords.length && nursing.length !== clinicalNursingCount,
  `nursing ${nursing.length} / clinicalRecords看護 ${clinicalNursingCount}`,
);

// ── 4. 記録種別・記録者・職種・所属が判別できる ──
check("記録種別ラベルが定義されている", RECORD_TYPE_LABEL.medical === "診療録" && RECORD_TYPE_LABEL.nursing === "看護記録");
check(
  "全レコードに記録者・職種・所属・日時がある",
  timelineA.every(
    (r) => r.author && r.profession && r.department && r.date && r.time,
  ),
);
check("看護記録の職種が看護", nursing.every((r) => r.profession === "看護"));

// ── 5. 看護SOAPが S/O/A/P で分離されている ──
const nursingSoap = nursing.filter((r) => r.nursingType === "soap");
check("看護SOAP記録が存在する", nursingSoap.length > 0, `${nursingSoap.length}件`);
check(
  "看護SOAP記録は soap オブジェクト（S/O/A/P）を持つ",
  nursingSoap.every(
    (r) =>
      r.soap !== undefined &&
      typeof r.soap.s === "string" &&
      typeof r.soap.o === "string" &&
      typeof r.soap.a === "string" &&
      typeof r.soap.p === "string",
  ),
);
// 看護記録タブの soap 判定件数と一致
const tabSoapCount = A.nursingRecords.filter((r) => inferNursingType(r) === "soap").length;
check(
  "看護SOAP件数が看護記録タブと一致",
  nursingSoap.length === tabSoapCount,
  `timeline ${nursingSoap.length} / tab ${tabSoapCount}`,
);

// ── 6. 患者Aで正しく絞り込み、他患者が混ざらない ──
check("全レコードが patientId=A", timelineA.every((r) => r.patientId === "A"));
const timelineE = buildClinicalTimeline(getChartData("E"), "E");
check("他患者(E)のタイムラインは patientId=E", timelineE.every((r) => r.patientId === "E"));

// ── 7. 時系列（昇順、現在の診療録の並びに合わせる）で破綻がない ──
const sorted = [...timelineA].sort((a, b) =>
  `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`),
);
check(
  "日時でソート可能（recordedAt が date/time と一致）",
  sorted.every((r) => r.recordedAt === `${r.date} ${r.time}`),
);
// 同一日時でも記録種別・記録者で判別できる
const byStamp = new Map<string, TimelineRecord[]>();
for (const r of timelineA) {
  const k = `${r.date} ${r.time}`;
  byStamp.set(k, [...(byStamp.get(k) ?? []), r]);
}
let sameStampOk = true;
for (const group of byStamp.values()) {
  if (group.length > 1) {
    const sigs = new Set(group.map((r) => `${r.recordType}|${r.author}`));
    if (sigs.size !== group.length) sameStampOk = false;
  }
}
check("同一日時の記録も記録種別・記録者で判別できる", sameStampOk);

// ── 8. Version2 を追加していない（表示用変換のみ） ──
check(
  "看護記録の SOAP は元データからの参照（再作成していない）",
  nursingSoap.every((r) => {
    const src = A.nursingRecords.find(
      (n) => n.date === r.date && n.time === r.time && n.author === r.author,
    );
    return src !== undefined;
  }),
);

if (failures > 0) {
  console.error(`\n診療録タイムライン検証: ${failures}件の失敗`);
  process.exit(1);
}
console.log("\n診療録タイムライン検証: すべてOK");
