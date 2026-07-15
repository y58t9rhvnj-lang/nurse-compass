// Version2「精神様式2 受け持ち対象記録」のロジック検証（修正版）。
// - 基本情報を含め全項目が空欄から開始し、自動表示・自動転記が無いこと
// - 治療内容が個別フィールドを持たず policyAndContent に統合されていること
// - 不正/旧/部分JSON でも落ちず正規化されること
// - 入力支援（helper）に答え・患者固有情報・模範解答が含まれないこと
import {
  FORM2_BASIC_FIELDS,
  FORM2_HISTORY_FIELDS,
  FORM2_TREATMENT_HELPER,
} from "../lib/form2/form2Fields";
import {
  createEmptyForm2,
  FORM2_BASIC_KEYS,
  FORM2_HISTORY_KEYS,
  FORM2_VERSION,
  normalizeForm2,
} from "../lib/form2/form2Types";

let failures = 0;
function check(label: string, cond: boolean, detail?: string) {
  if (cond) console.log(`[OK]   ${label}`);
  else {
    console.error(`[FAIL] ${label}${detail ? ` (${detail})` : ""}`);
    failures += 1;
  }
}

// --- 空欄から開始（自動表示なし） ---
const empty = createEmptyForm2("A");
check("createEmptyForm2: version=1", empty.version === FORM2_VERSION);
check("createEmptyForm2: patientId 保持", empty.patientId === "A");
check(
  "空開始: 患者基本情報がすべて空欄",
  FORM2_BASIC_KEYS.every((k) => empty.basicInformation[k] === ""),
);
check(
  "空開始: 経過（生育歴・現病歴）がすべて空欄",
  FORM2_HISTORY_KEYS.every((k) => empty.history[k] === ""),
);
check(
  "空開始: 医師の治療方針・内容が空欄",
  empty.treatment.policyAndContent === "",
);
check("空開始: updatedAt 空", empty.updatedAt === "");

// --- 治療内容の統合（個別フィールドを残さない） ---
const treatmentKeys = Object.keys(empty.treatment);
check(
  "統合: treatment は policyAndContent の1欄のみ",
  treatmentKeys.length === 1 && treatmentKeys[0] === "policyAndContent",
);
const forbiddenTherapyKeys = [
  "medicationTherapy",
  "psychotherapy",
  "occupationalTherapy",
  "sst",
  "psychoeducation",
  "otherSupport",
];
const allKeys = [
  ...Object.keys(empty.basicInformation),
  ...Object.keys(empty.history),
  ...Object.keys(empty.treatment),
];
check(
  "統合: 薬物療法/精神療法/作業療法/SST/心理教育の独立フィールドが存在しない",
  forbiddenTherapyKeys.every((k) => !allKeys.includes(k)),
);

// --- 正規化（不正/旧/部分JSON 耐性・自動補完なし） ---
check(
  "normalize: null は空データへ",
  normalizeForm2(null, "A").basicInformation.diagnosis === "",
);
check(
  "normalize: 不正型でも落ちない",
  normalizeForm2("こわれたJSON", "A").patientId === "A",
);
check(
  "normalize: 配列でも落ちない",
  normalizeForm2([1, 2], "A").version === FORM2_VERSION,
);

// 旧構造（sections フラット）を渡しても、新構造の空データに正規化される。
const legacy = normalizeForm2(
  {
    version: 1,
    patientId: "OLD",
    sections: { chiefComplaint: "旧データ", medicationTherapy: "旧薬物" },
  },
  "A",
);
check("normalize: patientId は引数で上書き", legacy.patientId === "A");
check(
  "normalize: 旧 sections は取り込まない（空へ）",
  legacy.basicInformation.chiefComplaint === "",
);

const partial = normalizeForm2(
  {
    version: 999,
    student: { studentName: "山田", studentNumber: 123 },
    period: { start: "2026/07/20" },
    basicInformation: { diagnosis: "学生が記入した診断名", unknownKey: "x" },
    history: { developmentalHistory: "生育歴メモ" },
    treatment: { policyAndContent: "方針メモ", medicationTherapy: "混入" },
    updatedAt: "2026-07-15T00:00:00.000Z",
  },
  "A",
);
check("normalize: version は現行へ固定", partial.version === FORM2_VERSION);
check("normalize: 学生名（文字列）を保持", partial.student.studentName === "山田");
check(
  "normalize: 学籍番号（数値）は空へ",
  partial.student.studentNumber === "",
);
check(
  "normalize: 基本情報の既知欄を保持",
  partial.basicInformation.diagnosis === "学生が記入した診断名",
);
check(
  "normalize: 基本情報の未知キーは取り込まない",
  !Object.prototype.hasOwnProperty.call(
    partial.basicInformation,
    "unknownKey",
  ),
);
check("normalize: 経過の既知欄を保持", partial.history.developmentalHistory === "生育歴メモ");
check("normalize: 治療欄を保持", partial.treatment.policyAndContent === "方針メモ");
check(
  "normalize: 治療欄に混入した療法キーは無視",
  !Object.prototype.hasOwnProperty.call(partial.treatment, "medicationTherapy"),
);
check("normalize: period.start 保持", partial.period.start === "2026/07/20");

// --- 入力欄メタ（全項目網羅） ---
check(
  "fields: 患者基本情報の全キーを網羅",
  FORM2_BASIC_KEYS.every((k) =>
    FORM2_BASIC_FIELDS.some((f) => f.key === k),
  ) && FORM2_BASIC_FIELDS.length === FORM2_BASIC_KEYS.length,
);
check(
  "fields: 経過の全キーを網羅",
  FORM2_HISTORY_KEYS.every((k) =>
    FORM2_HISTORY_FIELDS.some((f) => f.key === k),
  ) && FORM2_HISTORY_FIELDS.length === FORM2_HISTORY_KEYS.length,
);
check(
  "fields: 各欄に補助文（探す/整理の観点）がある",
  FORM2_BASIC_FIELDS.every((f) => f.helper.length > 0) &&
    FORM2_HISTORY_FIELDS.every((f) => f.helper.length > 0),
);

// --- 入力支援に答え・患者固有情報が含まれない ---
// Patient A の実データに現れる固有値が helper に混入していないことを確認する。
const patientAnswerTokens = [
  "統合失調症",
  "Aさん",
  "47",
  "任意入院",
  "鈴木",
  "リスペリドン",
  "クエチアピン",
  "ゾピクロン",
  "医療保護",
];
const allHelpers = [
  ...FORM2_BASIC_FIELDS.map((f) => f.helper),
  ...FORM2_HISTORY_FIELDS.map((f) => f.helper),
  FORM2_TREATMENT_HELPER,
];
check(
  "支援: helper に患者固有の答えが含まれない",
  allHelpers.every((h) => !patientAnswerTokens.some((t) => h.includes(t))),
);
check(
  "支援: 治療欄の補助文は観点列挙（薬物療法等の語＝整理の観点として提示）",
  FORM2_TREATMENT_HELPER.includes("観点") &&
    FORM2_TREATMENT_HELPER.includes("薬物療法"),
);

console.log("");
if (failures === 0) {
  console.log("精神様式2 検証: すべてOK");
  process.exit(0);
} else {
  console.error(`精神様式2 検証: ${failures} 件の失敗`);
  process.exit(1);
}
