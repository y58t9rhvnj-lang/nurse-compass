// Version2「精神様式2 受け持ち対象記録」のロジック検証（構成刷新版）。
// - 基本情報を含め全項目が空欄から開始し、自動表示・自動転記が無いこと
// - 受け持つまでの経過が新9項目、治療が新4項目（policy/goal/medication/program）であること
// - 旧構成のキー（history 一部・treatment.policyAndContent）が消失せず温存されること
// - 旧 policyAndContent が、新 policy 未入力時のみラベル付きで移行されること
// - 不正/旧/部分JSON でも落ちず正規化されること
// - 入力支援（helper）に答え・患者固有情報・模範解答が含まれないこと
import {
  FORM2_BASIC_FIELDS,
  FORM2_HISTORY_FIELDS,
  FORM2_TREATMENT_FIELDS,
} from "../lib/form2/form2Fields";
import {
  createEmptyForm2,
  FORM2_BASIC_KEYS,
  FORM2_HISTORY_KEYS,
  FORM2_HISTORY_LEGACY_KEYS,
  FORM2_TREATMENT_KEYS,
  FORM2_VERSION,
  mergeTreatmentText,
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
  "空開始: 治療4項目がすべて空欄",
  FORM2_TREATMENT_KEYS.every((k) => empty.treatment[k] === ""),
);
check("空開始: updatedAt 空", empty.updatedAt === "");

// --- 構成: 経過9項目 / 治療4項目 ---
check("構成: 経過は9項目", FORM2_HISTORY_KEYS.length === 9);
check(
  "構成: 治療は4項目（policy/goal/medication/program）",
  FORM2_TREATMENT_KEYS.length === 4 &&
    FORM2_TREATMENT_KEYS.join(",") === "policy,goal,medication,program",
);
check(
  "構成: 初期 treatment は旧 policyAndContent を持たない",
  !Object.prototype.hasOwnProperty.call(empty.treatment, "policyAndContent"),
);

// --- 独立してはいけない療法フィールドが無い ---
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
check(
  "normalize: 治療欄に混入した療法キーは無視",
  !Object.prototype.hasOwnProperty.call(partial.treatment, "medicationTherapy"),
);
check("normalize: period.start 保持", partial.period.start === "2026/07/20");

// --- 旧データの温存・移行 ---
check(
  "移行: 旧 policyAndContent を互換温存",
  partial.treatment.policyAndContent === "方針メモ",
);
check(
  "移行: 新 policy が空なら旧 policyAndContent をラベル付きで移行",
  partial.treatment.policy === "【旧・医師の治療方針・内容】\n方針メモ",
);

// 新 policy に既入力がある場合、旧値では上書きしない（policyAndContent は温存）。
const bothTreatment = normalizeForm2(
  { treatment: { policy: "新方針", policyAndContent: "旧方針" } },
  "A",
);
check(
  "移行: 新 policy がある場合は旧値で上書きしない",
  bothTreatment.treatment.policy === "新方針" &&
    bothTreatment.treatment.policyAndContent === "旧方針",
);

// 削除4項目（旧 history）の値は削除・自動統合せず温存する。
const legacyHistory = normalizeForm2(
  {
    history: {
      developmentalHistory: "生育",
      insight: "旧・病識メモ",
      dischargeThoughts: "旧・退院への思い",
    },
  },
  "A",
);
check(
  "温存: 旧 history（insight）を消さずに保持",
  legacyHistory.history.insight === "旧・病識メモ",
);
check(
  "温存: 旧 history（dischargeThoughts）を消さずに保持",
  legacyHistory.history.dischargeThoughts === "旧・退院への思い",
);
check(
  "温存: 旧 history を新項目へ自動統合しない",
  FORM2_HISTORY_LEGACY_KEYS.every(
    (k) => !FORM2_HISTORY_KEYS.includes(k),
  ),
);

// --- 治療統合表示（小ラベル付き・空欄は非表示・表示順） ---
const mergedFull = mergeTreatmentText({
  policy: "方針X",
  goal: "目標Y",
  medication: "薬Z",
  program: "OT参加",
});
check(
  "表示: 治療4項目を小ラベル付き・指定順で統合",
  mergedFull ===
    "【治療方針】\n方針X\n\n【治療の目標】\n目標Y\n\n【内服】\n薬Z\n\n【治療プログラム（参加状況を含む）】\nOT参加",
);
const mergedPartial = mergeTreatmentText({
  policy: "",
  goal: "目標のみ",
  medication: "",
  program: "",
});
check(
  "表示: 空欄の治療項目はラベルごと非表示",
  mergedPartial === "【治療の目標】\n目標のみ",
);

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
  "fields: 治療の全キーを網羅",
  FORM2_TREATMENT_KEYS.every((k) =>
    FORM2_TREATMENT_FIELDS.some((f) => f.key === k),
  ) && FORM2_TREATMENT_FIELDS.length === FORM2_TREATMENT_KEYS.length,
);
check(
  "fields: 各欄に補助文（探す/整理の観点）がある",
  FORM2_BASIC_FIELDS.every((f) => f.helper.length > 0) &&
    FORM2_HISTORY_FIELDS.every((f) => f.helper.length > 0) &&
    FORM2_TREATMENT_FIELDS.every((f) => f.helper.length > 0),
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
  ...FORM2_TREATMENT_FIELDS.map((f) => f.helper),
];
check(
  "支援: helper に患者固有の答えが含まれない",
  allHelpers.every((h) => !patientAnswerTokens.some((t) => h.includes(t))),
);

console.log("");
if (failures === 0) {
  console.log("精神様式2 検証: すべてOK");
  process.exit(0);
} else {
  console.error(`精神様式2 検証: ${failures} 件の失敗`);
  process.exit(1);
}
