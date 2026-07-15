// Version2「精神様式2 受け持ち対象記録」のデータ型。
//
// 方針（修正版）:
// - 患者基本情報を含め、すべて学生が自分で確認して手入力する。
//   電子カルテ／患者会話からの自動表示・自動転記は一切行わない。
// - 治療内容（薬物療法・精神療法・作業療法・SST・心理教育等）は
//   個別フィールドを持たず、treatment.policyAndContent に統合する。
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
export interface Form2History {
  familyBackground: string;
  developmentalHistory: string;
  schoolHistory: string;
  employmentHistory: string;
  beforeOnset: string;
  firstAdmission: string;
  subsequentCourse: string;
  currentAdmissionCourse: string;
  currentCondition: string;
  currentLife: string;
  insight: string;
  medicationRecognition: string;
  dischargeThoughts: string;
}

// 医師の治療方針・内容。薬物療法等はここに統合し、独立欄は持たない。
export interface Form2Treatment {
  policyAndContent: string;
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
  "familyBackground",
  "developmentalHistory",
  "schoolHistory",
  "employmentHistory",
  "beforeOnset",
  "firstAdmission",
  "subsequentCourse",
  "currentAdmissionCourse",
  "currentCondition",
  "currentLife",
  "insight",
  "medicationRecognition",
  "dischargeThoughts",
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

// 未入力状態の初期データ（安定参照は呼び出し側で管理する）。
export function createEmptyForm2(patientId: string): Form2Data {
  return {
    version: FORM2_VERSION,
    patientId,
    student: { studentNumber: "", studentName: "" },
    period: { start: "", end: "" },
    basicInformation: emptyBasic(),
    history: emptyHistory(),
    treatment: { policyAndContent: "" },
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
    treatment: { policyAndContent: pickString(treatment, "policyAndContent") },
    updatedAt: typeof v.updatedAt === "string" ? v.updatedAt : "",
  };
}
