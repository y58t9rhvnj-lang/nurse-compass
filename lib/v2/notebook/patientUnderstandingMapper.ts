// Compass Version2 — Learning Layer (Sprint D-2C)
// PatientUnderstanding ⇄ patient_understanding_records 行 の変換。
//
// 方針（既存 form2 / notes マッパーを踏襲）:
//   ・学生 × ケースで 1 レコード（head）。overview_text のみ学生が更新する。
//   ・user_id / organization_id / academic_year / case_id / patient_id はサーバが決定し保存する。
//   ・updatedAt は DB の生 updated_at(ISO)。将来の履歴・整合チェックに使えるよう保持する。

// patient_understanding_records の 1 行（select する列）。
export interface PatientUnderstandingRow {
  overview_text: string;
  updated_at: string;
}

// サーバが upsert に渡す行（id/created_at/updated_at は DB 既定・トリガーに任せる）。
export interface PatientUnderstandingUpsert {
  user_id: string;
  organization_id: string;
  academic_year: number;
  case_id: string;
  patient_id: string;
  overview_text: string;
}

// クライアントへ渡すドメイン型（識別情報は含めない）。
export interface PatientUnderstanding {
  overviewText: string;
  updatedAt: string;
}

export const PATIENT_UNDERSTANDING_SELECT_COLUMNS = "overview_text, updated_at";

export function rowToPatientUnderstanding(
  row: PatientUnderstandingRow,
): PatientUnderstanding {
  return {
    overviewText: row.overview_text ?? "",
    updatedAt: row.updated_at,
  };
}
