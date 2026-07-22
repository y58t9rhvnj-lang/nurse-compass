// Version2「精神様式2 受け持ち対象記録」のデータ型。
//
// 方針（修正版）:
// - 患者基本情報を含め、すべて学生が自分で確認して手入力する。
//   電子カルテ／患者会話からの自動表示・自動転記は一切行わない。
// - 治療内容は 4 項目（治療方針 / 治療の目標 / 内服 / 治療プログラム）に分け、
//   様式表示・印刷時のみ小ラベル付きで 1 つの治療欄に統合表示する。
// - 旧構成のキー（history の一部・treatment.policyAndContent）は optional として型に温存し、
//   既存 JSON の消失を防ぐ（normalizeForm2 が値を保持する。自動統合・削除はしない）。
// - 将来のバックエンド移行に備え、version を含めた素朴な JSON 構造とする。

export const FORM2_VERSION = 1 as const;

export interface Form2Student {
  studentNumber: string;
  studentName: string;
}

export interface Form2Period {
  start: string;
  end: string;
}

// 患者基本情報（すべて学生入力。自動表示しない）。
export interface Form2BasicInformation {
  patientName: string;
  age: string;
  sex: string;
  diagnosis: string;
  pastHistory: string;
  admissionType: string;
  chiefComplaint: string;
}

// 受け持つまでの経過（生育歴・現病歴）。編集時は小項目に分けるが、
// 様式表示では一つのまとまりとして表示する。
//
// 表示・保存対象は下記 9 項目（FORM2_HISTORY_KEYS）。
// firstAdmission / insight / medicationRecognition / dischargeThoughts は旧構成の項目で、
// 現行 UI では非表示・新規保存対象外。ただし既存 JSON の消失を防ぐため型に optional として
// 温存し、normalizeForm2 が値を保持する（自動統合・削除・上書きはしない）。
export interface Form2History {
  developmentalHistory: string; // 生育歴
  familyBackground: string; // 家族背景
  schoolHistory: string; // 学校生活
  employmentHistory: string; // 就労歴
  beforeOnset: string; // 発症までの経過
  subsequentCourse: string; // その後の入退院歴および経過
  currentAdmissionCourse: string; // 今回の入院に至る経過
  currentCondition: string; // 入院から現在までの病状
  currentLife: string; // 現在の生活状況
  // --- 旧構成（互換温存・UI 非表示・新規保存対象外） ---
  firstAdmission?: string;
  insight?: string;
  medicationRecognition?: string;
  dischargeThoughts?: string;
}

// 医師の治療方針・内容。4 項目に分割する。
// policyAndContent は旧構成の単一欄。互換温存のため optional で保持し、normalizeForm2 が
// 値を保持しつつ、新 policy が空のときのみラベル付きで policy へ移行する（旧値は削除しない）。
export interface Form2Treatment {
  policy: string; // 治療方針
  goal: string; // 治療の目標
  medication: string; // 内服
  program: string; // 治療プログラム（参加状況を含む）
  // --- 旧構成（互換温存） ---
  policyAndContent?: string;
}

export interface Form2Data {
  version: typeof FORM2_VERSION;
  patientId: string;
  student: Form2Student;
  period: Form2Period;
  basicInformation: Form2BasicInformation;
  history: Form2History;
  treatment: Form2Treatment;
  updatedAt: string; // ISO 文字列。未保存時は空文字。
}

export const FORM2_BASIC_KEYS: (keyof Form2BasicInformation)[] = [
  "patientName",
  "age",
  "sex",
  "diagnosis",
  "pastHistory",
  "admissionType",
  "chiefComplaint",
];

export const FORM2_HISTORY_KEYS: (keyof Form2History)[] = [
  "developmentalHistory",
  "familyBackground",
  "schoolHistory",
  "employmentHistory",
  "beforeOnset",
  "subsequentCourse",
  "currentAdmissionCourse",
  "currentCondition",
  "currentLife",
];

// 旧構成の履歴項目（互換温存・UI 非表示・新規保存対象外）。normalizeForm2 が値を保持する。
export const FORM2_HISTORY_LEGACY_KEYS: (keyof Form2History)[] = [
  "firstAdmission",
  "insight",
  "medicationRecognition",
  "dischargeThoughts",
];

// 医師の治療方針・内容の入力・保存対象キー（4 項目）。
export const FORM2_TREATMENT_KEYS: (keyof Form2Treatment)[] = [
  "policy",
  "goal",
  "medication",
  "program",
];

function emptyBasic(): Form2BasicInformation {
  const basic = {} as Form2BasicInformation;
  for (const key of FORM2_BASIC_KEYS) basic[key] = "";
  return basic;
}

function emptyHistory(): Form2History {
  const history = {} as Form2History;
  for (const key of FORM2_HISTORY_KEYS) history[key] = "";
  return history;
}

function emptyTreatment(): Form2Treatment {
  const treatment = {} as Form2Treatment;
  for (const key of FORM2_TREATMENT_KEYS) treatment[key] = "";
  return treatment;
}

// 未入力状態の初期データ（安定参照は呼び出し側で管理する）。
export function createEmptyForm2(patientId: string): Form2Data {
  return {
    version: FORM2_VERSION,
    patientId,
    student: { studentNumber: "", studentName: "" },
    period: { start: "", end: "" },
    basicInformation: emptyBasic(),
    history: emptyHistory(),
    treatment: emptyTreatment(),
    updatedAt: "",
  };
}

function pickString(
  source: Record<string, unknown> | undefined,
  key: string,
): string {
  const value = source?.[key];
  return typeof value === "string" ? value : "";
}

// 破損・旧バージョン・部分的な JSON でも落ちないよう、既知の形へ正規化する。
export function normalizeForm2(raw: unknown, patientId: string): Form2Data {
  const base = createEmptyForm2(patientId);
  if (typeof raw !== "object" || raw === null) return base;
  const v = raw as Record<string, unknown>;

  const student = v.student as Record<string, unknown> | undefined;
  const period = v.period as Record<string, unknown> | undefined;
  const basic = v.basicInformation as Record<string, unknown> | undefined;
  const history = v.history as Record<string, unknown> | undefined;
  const treatment = v.treatment as Record<string, unknown> | undefined;

  const normalizedBasic = emptyBasic();
  for (const key of FORM2_BASIC_KEYS) {
    normalizedBasic[key] = pickString(basic, key);
  }

  const normalizedHistory = emptyHistory();
  for (const key of FORM2_HISTORY_KEYS) {
    normalizedHistory[key] = pickString(history, key);
  }
  // 旧構成の履歴値は削除・上書き・自動統合せず、値がある場合のみ温存する
  // （UI 非表示・新規保存対象外だが、既存 JSON の消失を防ぐ）。
  for (const legacyKey of FORM2_HISTORY_LEGACY_KEYS) {
    const legacyValue = pickString(history, legacyKey);
    if (legacyValue) normalizedHistory[legacyKey] = legacyValue;
  }

  const normalizedTreatment = emptyTreatment();
  for (const key of FORM2_TREATMENT_KEYS) {
    normalizedTreatment[key] = pickString(treatment, key);
  }
  // 旧 policyAndContent は互換のため温存し、新 policy が空のときのみラベル付きで移行する
  // （旧値は削除しない）。
  const legacyPolicyAndContent = pickString(treatment, "policyAndContent");
  if (legacyPolicyAndContent) {
    normalizedTreatment.policyAndContent = legacyPolicyAndContent;
    if (!normalizedTreatment.policy.trim()) {
      normalizedTreatment.policy = `【旧・医師の治療方針・内容】\n${legacyPolicyAndContent}`;
    }
  }

  return {
    version: FORM2_VERSION,
    patientId,
    student: {
      studentNumber: pickString(student, "studentNumber"),
      studentName: pickString(student, "studentName"),
    },
    period: {
      start: pickString(period, "start"),
      end: pickString(period, "end"),
    },
    basicInformation: normalizedBasic,
    history: normalizedHistory,
    treatment: normalizedTreatment,
    updatedAt: typeof v.updatedAt === "string" ? v.updatedAt : "",
  };
}

// 治療4項目を、入力済みのものだけ小ラベル付きで1つの治療欄へ統合する（様式表示・印刷用）。
// 表示順：治療方針 → 治療の目標 → 内服 → 治療プログラム（参加状況を含む）。空欄は表示しない。
const TREATMENT_MERGE: { key: keyof Form2Treatment; label: string }[] = [
  { key: "policy", label: "治療方針" },
  { key: "goal", label: "治療の目標" },
  { key: "medication", label: "内服" },
  { key: "program", label: "治療プログラム（参加状況を含む）" },
];

export function mergeTreatmentText(treatment: Form2Treatment): string {
  return TREATMENT_MERGE.map(({ key, label }) => {
    const value = (treatment[key] ?? "").trim();
    return value ? `【${label}】\n${value}` : "";
  })
    .filter((s) => s.length > 0)
    .join("\n\n");
}
