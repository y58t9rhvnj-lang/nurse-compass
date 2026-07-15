// Version2「精神様式2 受け持ち対象記録」のデータ型。
//
// 学生が入力する項目のみを保持する（患者基本情報・処方・治療プログラム等は
// Patient A の既存データから表示時に導出し、ここには保存しない）。
// 将来のバックエンド移行に備え、version を含めた素朴な JSON 構造とする。

export const FORM2_VERSION = 1 as const;

// 学生が整理・記述する自由記述セクションの ID。
// Compass Coach の将来的な「欄ごとの問い返し」に備え、ID を安定させる。
export type Form2SectionId =
  | "chiefComplaint" // 主訴
  | "developmentalHistory" // 生育歴
  | "familyBackground" // 家族背景
  | "onsetHistory" // 発症までの経過
  | "firstAdmissionHistory" // 初回入院までの経過
  | "admissionHistory" // その後の入退院歴
  | "currentAdmissionHistory" // 今回の入院に至る経過
  | "currentCondition" // 現在の病状
  | "currentLife" // 現在の生活状況
  | "insight" // 本人の病識
  | "medicationRecognition" // 服薬に対する認識
  | "dischargeThoughts" // 退院に対する思い
  | "currentIssues" // 現在の課題
  | "treatmentPolicy" // 医師の治療方針
  | "medicationTherapy" // 薬物療法
  | "psychotherapy" // 精神療法
  | "occupationalTherapy" // 作業療法
  | "sst" // SST
  | "psychoeducation" // 心理教育
  | "otherSupport"; // その他の治療・支援

export type Form2Sections = Record<Form2SectionId, string>;

export interface Form2Student {
  studentNumber: string;
  studentName: string;
}

export interface Form2Period {
  start: string;
  end: string;
}

export interface Form2Data {
  version: typeof FORM2_VERSION;
  patientId: string;
  student: Form2Student;
  period: Form2Period;
  sections: Form2Sections;
  updatedAt: string; // ISO 文字列。未保存時は空文字。
}

export const FORM2_SECTION_IDS: Form2SectionId[] = [
  "chiefComplaint",
  "developmentalHistory",
  "familyBackground",
  "onsetHistory",
  "firstAdmissionHistory",
  "admissionHistory",
  "currentAdmissionHistory",
  "currentCondition",
  "currentLife",
  "insight",
  "medicationRecognition",
  "dischargeThoughts",
  "currentIssues",
  "treatmentPolicy",
  "medicationTherapy",
  "psychotherapy",
  "occupationalTherapy",
  "sst",
  "psychoeducation",
  "otherSupport",
];

function emptySections(): Form2Sections {
  const sections = {} as Form2Sections;
  for (const id of FORM2_SECTION_IDS) sections[id] = "";
  return sections;
}

// 未入力状態の初期データ（安定参照は呼び出し側で管理する）。
export function createEmptyForm2(patientId: string): Form2Data {
  return {
    version: FORM2_VERSION,
    patientId,
    student: { studentNumber: "", studentName: "" },
    period: { start: "", end: "" },
    sections: emptySections(),
    updatedAt: "",
  };
}

// 破損・旧バージョン・部分的な JSON でも落ちないよう、既知の形へ正規化する。
export function normalizeForm2(raw: unknown, patientId: string): Form2Data {
  const base = createEmptyForm2(patientId);
  if (typeof raw !== "object" || raw === null) return base;
  const v = raw as Record<string, unknown>;

  const student = v.student as Record<string, unknown> | undefined;
  const period = v.period as Record<string, unknown> | undefined;
  const sections = v.sections as Record<string, unknown> | undefined;

  const normalizedSections = emptySections();
  if (sections && typeof sections === "object") {
    for (const id of FORM2_SECTION_IDS) {
      const value = sections[id];
      if (typeof value === "string") normalizedSections[id] = value;
    }
  }

  return {
    version: FORM2_VERSION,
    patientId,
    student: {
      studentNumber:
        typeof student?.studentNumber === "string"
          ? student.studentNumber
          : "",
      studentName:
        typeof student?.studentName === "string" ? student.studentName : "",
    },
    period: {
      start: typeof period?.start === "string" ? period.start : "",
      end: typeof period?.end === "string" ? period.end : "",
    },
    sections: normalizedSections,
    updatedAt: typeof v.updatedAt === "string" ? v.updatedAt : "",
  };
}
