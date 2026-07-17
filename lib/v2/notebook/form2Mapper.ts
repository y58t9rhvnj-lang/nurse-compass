// Compass Version2 β — Phase 3-2
// Form2Data ⇄ form2_records 行 の変換。
//
// 方針:
//   ・payload には Form2Data をそのまま保持するが、normalizeForm2 で正規化し、
//     payload 内の patientId は検証済み patientId で必ず上書きする
//     （クライアント由来の識別情報を信用しない）。
//   ・DB 列 version（レコード版）と Form2Data.version（スキーマ版）は別物として扱う。

import { normalizeForm2, type Form2Data } from "@/lib/form2/form2Types";
import type { Form2Snapshot } from "./types";

// form2_records の 1 行（読み取り時に select する列）。
export interface Form2Row {
  id: string;
  user_id: string;
  organization_id: string;
  academic_year: number;
  case_id: string;
  payload: unknown; // Form2Data だが JSON 由来のため unknown として受ける
  version: number;
  created_at: string;
  updated_at: string;
}

// payload をサーバ信頼の Form2Data へ正規化する。patientId は引数で上書き。
export function sanitizeForm2Payload(
  payload: unknown,
  patientId: string,
): Form2Data {
  return normalizeForm2(payload, patientId);
}

// DB 行 → Snapshot（表示・保存フロー用）。patientId はサーバが決めた値を渡す。
export function rowToForm2Snapshot(
  row: Form2Row,
  patientId: string,
): Form2Snapshot {
  return {
    payload: normalizeForm2(row.payload, patientId),
    version: row.version,
    updatedAt: row.updated_at,
  };
}

// read 時に必要な列のリスト（生 select 文字列を一箇所に集約）。
export const FORM2_SELECT_COLUMNS =
  "id, user_id, organization_id, academic_year, case_id, payload, version, created_at, updated_at";
