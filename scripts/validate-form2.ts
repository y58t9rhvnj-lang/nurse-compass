// Version2「精神様式2 受け持ち対象記録」のロジック検証。
// データ型の正規化（不正/旧/部分JSONの耐性）、自動表示項目の導出（推測補完なし・
// 患者混在なし）、入力欄メタ（全セクション網羅・補助文の存在）を確認する。
// 元データ（wardData / chartData）は変更しない read-only 検証。
import { buildForm2AutoData } from "../lib/form2/form2AutoData";
import {
  FORM2_FIELD_GROUPS,
  FORM2_FIELD_META,
} from "../lib/form2/form2Fields";
import {
  createEmptyForm2,
  FORM2_SECTION_IDS,
  FORM2_VERSION,
  normalizeForm2,
} from "../lib/form2/form2Types";
import { PATIENTS } from "../lib/wardData";

let failures = 0;
function check(label: string, cond: boolean, detail?: string) {
  if (cond) console.log(`[OK]   ${label}`);
  else {
    console.error(`[FAIL] ${label}${detail ? ` (${detail})` : ""}`);
    failures += 1;
  }
}

// --- データ型・正規化 ---
const empty = createEmptyForm2("A");
check("createEmptyForm2: version=1", empty.version === FORM2_VERSION);
check("createEmptyForm2: patientId 保持", empty.patientId === "A");
check(
  "createEmptyForm2: 全セクションが空文字",
  FORM2_SECTION_IDS.every((id) => empty.sections[id] === ""),
);
check("createEmptyForm2: updatedAt 空", empty.updatedAt === "");

check(
  "normalize: null は空データへ",
  normalizeForm2(null, "A").sections.chiefComplaint === "",
);
check(
  "normalize: 不正型はクラッシュせず空データ",
  normalizeForm2("こわれたJSON文字列", "A").patientId === "A",
);
check(
  "normalize: 数値/配列を渡しても落ちない",
  normalizeForm2([1, 2, 3], "A").version === FORM2_VERSION,
);

const partial = normalizeForm2(
  {
    version: 999,
    patientId: "IGNORED",
    student: { studentName: "山田", studentNumber: 12345 },
    period: { start: "2026/07/20" },
    sections: { chiefComplaint: "眠れない", unknownKey: "捨てられる" },
    updatedAt: "2026-07-15T00:00:00.000Z",
  },
  "A",
);
check("normalize: patientId は引数で上書き", partial.patientId === "A");
check("normalize: version は現行へ固定", partial.version === FORM2_VERSION);
check("normalize: 文字列の学生名を保持", partial.student.studentName === "山田");
check(
  "normalize: 非文字列(studentNumber数値)は空へ",
  partial.student.studentNumber === "",
);
check("normalize: 既知セクションを保持", partial.sections.chiefComplaint === "眠れない");
check(
  "normalize: 未知キーは取り込まない",
  !Object.prototype.hasOwnProperty.call(partial.sections, "unknownKey"),
);
check(
  "normalize: 欠落セクションは空文字で補完",
  partial.sections.treatmentPolicy === "",
);
check("normalize: period.start 保持", partial.period.start === "2026/07/20");
check("normalize: period.end 欠落は空", partial.period.end === "");

// --- 入力欄メタ（全セクション網羅・補助文） ---
const groupedIds = FORM2_FIELD_GROUPS.flatMap((g) => g.fields.map((f) => f.id));
check(
  "fields: 全セクションがグループに登場",
  FORM2_SECTION_IDS.every((id) => groupedIds.includes(id)),
);
check(
  "fields: 重複登場がない",
  groupedIds.length === new Set(groupedIds).size &&
    groupedIds.length === FORM2_SECTION_IDS.length,
);
check(
  "fields: 各欄に補助文（整理の観点）がある",
  FORM2_SECTION_IDS.every((id) => FORM2_FIELD_META[id]?.helper.length > 0),
);
check(
  "fields: 受け持つまでの経過グループが存在",
  FORM2_FIELD_GROUPS.some((g) => g.id === "progress" && g.fields.length >= 4),
);

// --- 自動表示（Patient A・推測補完なし） ---
const autoA = buildForm2AutoData(PATIENTS.A);
check("auto A: 患者氏名", autoA.patientName === "Aさん");
check("auto A: 年齢", autoA.age === "47歳");
check("auto A: 性別", autoA.sex === "男性");
check("auto A: 診断名", autoA.diagnosis === "統合失調症");
check("auto A: 主治医", autoA.doctor === "鈴木医師");
check(
  "auto A: 入院形態はエピソードから導出（任意入院）",
  autoA.admissionType === "任意入院",
);
check(
  "auto A: 既往歴は構造化データが無いため null（補完しない）",
  autoA.pastHistory === null,
);
const drugNames = autoA.medications.map((m) => m.drugs).join(" / ");
check(
  "auto A: 現行処方（リスペリドン）を表示",
  drugNames.includes("リスペリドン"),
);
check(
  "auto A: 中止処方（クロルプロマジン）は表示しない",
  !drugNames.includes("クロルプロマジン"),
);
check(
  "auto A: 頓服（ブロチゾラム）を表示",
  drugNames.includes("ブロチゾラム"),
);
check(
  "auto A: 治療プログラムに SST を含む",
  autoA.treatmentPrograms.includes("SST"),
);
check(
  "auto A: 治療プログラムに食事を含まない",
  !autoA.treatmentPrograms.some((p) => p.includes("食")),
);

// --- 患者混在なし（Patient E は別内容） ---
const autoE = buildForm2AutoData(PATIENTS.E);
check("auto E: 患者氏名が A と異なる", autoE.patientName === "Eさん");
check("auto E: 性別が独立", autoE.sex === "女性");
check("auto E: 診断名が独立", autoE.diagnosis === "うつ病");
check(
  "auto E: 処方が A と混ざらない",
  !autoE.medications.map((m) => m.drugs).join("").includes("リスペリドン"),
);

console.log("");
if (failures === 0) {
  console.log("精神様式2 検証: すべてOK");
  process.exit(0);
} else {
  console.error(`精神様式2 検証: ${failures} 件の失敗`);
  process.exit(1);
}
