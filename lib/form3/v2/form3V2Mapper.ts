// Form3 Phase B2-1 — Mapper 接続直前（Repository / Supabase 非接続）
//
// 既存 form3Mapper.sanitizeForm3Payload（v1）は維持。
// 本モジュールは v2 正規化・Snapshot 形まで用意し、Repository 配線は次フェーズ。

import type { Form3Row } from "@/lib/v2/notebook/form3Mapper";
import {
  loadForm3Payload,
  saveForm3Payload,
  type LoadForm3PayloadOptions,
  type LoadForm3PayloadResult,
  type SaveForm3PayloadResult,
} from "./form3V2Persistence";
import type { Form3DataV2, Form3MigrationWarning } from "./form3V2Types";

export type Form3SnapshotV2 = {
  payload: Form3DataV2;
  /** DB レコード version（楽観ロック）。schemaVersion とは別物 */
  version: number;
  updatedAt: string;
};

export type SanitizeForm3PayloadAsV2Result = {
  payload: Form3DataV2;
  warnings: Form3MigrationWarning[];
  sourceSchemaVersion: LoadForm3PayloadResult["sourceSchemaVersion"];
};

/**
 * クライアント／DB 由来 payload を Form3DataV2 へ正規化する。
 * v1 なら migrate → sanitize。v2 なら sanitize。
 * patientId は引数で上書きする。
 */
export function sanitizeForm3PayloadAsV2(
  raw: unknown,
  patientId: string,
  options: LoadForm3PayloadOptions = {},
): SanitizeForm3PayloadAsV2Result {
  const loaded = loadForm3Payload(raw, patientId, options);
  return {
    payload: loaded.data,
    warnings: loaded.warnings,
    sourceSchemaVersion: loaded.sourceSchemaVersion,
  };
}

/**
 * DB 行形 → Form3SnapshotV2。
 * 実 DB 呼び出しはしない（行オブジェクトを渡す純変換）。
 */
export function rowToForm3SnapshotV2(
  row: Form3Row,
  patientId: string,
  options: LoadForm3PayloadOptions = {},
): Form3SnapshotV2 {
  const { payload } = sanitizeForm3PayloadAsV2(row.payload, patientId, options);
  return {
    payload,
    version: row.version,
    updatedAt: row.updated_at,
  };
}

/**
 * 保存直前の正規化（Actions / Repository が将来呼ぶ想定）。
 * 現状は saveForm3Payload の薄いラッパ。
 */
export function prepareForm3V2ForPersist(
  data: Form3DataV2,
  patientId: string,
): SaveForm3PayloadResult {
  return saveForm3Payload(data, patientId);
}
