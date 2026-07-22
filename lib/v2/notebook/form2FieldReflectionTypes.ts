// Compass Version2 — Learning Layer (Sprint D-3A)
// form2_field_reflections の Server Action 戻り値（Result）型。
//
// 方針（既存 patientUnderstanding / links の Result 設計を踏襲）:
//   ・戻り値は判別可能なユニオン（ok:true/false）。UI へは分類済みの kind のみ返す。
//   ・DB の生エラー・内部情報は返さない。

import type { Form2FieldReflection } from "./form2FieldReflectionMapper";
import type { ActionErrorKind } from "./types";

// 取得結果。未作成なら空配列。
export type Form2FieldReflectionListResult =
  | { ok: true; data: Form2FieldReflection[] }
  | { ok: false; kind: Exclude<ActionErrorKind, "conflict">; message: string };

// 保存（upsert）結果。確定した snapshot を返す。
export type Form2FieldReflectionSaveResult =
  | { ok: true; data: Form2FieldReflection }
  | { ok: false; kind: Exclude<ActionErrorKind, "conflict">; message: string };
