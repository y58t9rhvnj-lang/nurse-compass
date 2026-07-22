// Compass Version2 — Learning Layer (Sprint D-2C)
// patient_understanding_records の Server Action 戻り値（Result）型。
//
// 方針（既存 form2 / links の Result 設計を踏襲）:
//   ・戻り値は判別可能なユニオン（ok:true/false）。UI へは分類済みの kind のみ返す。
//   ・DB の生エラー・内部情報は返さない。

import type { PatientUnderstanding } from "./patientUnderstandingMapper";
import type { ActionErrorKind } from "./types";

// 取得結果。未作成なら data: null。
export type PatientUnderstandingLoadResult =
  | { ok: true; data: PatientUnderstanding | null }
  | { ok: false; kind: Exclude<ActionErrorKind, "conflict">; message: string };

// 保存（upsert）結果。確定した snapshot を返す。
export type PatientUnderstandingSaveResult =
  | { ok: true; data: PatientUnderstanding }
  | { ok: false; kind: Exclude<ActionErrorKind, "conflict">; message: string };
