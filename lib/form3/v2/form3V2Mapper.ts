// Form3 Phase B2-1 / B2-2B — Mapper（Repository 接続直前〜接続）
//
// 既存 form3Mapper.sanitizeForm3Payload（v1）は維持。
// v2 は prepareForm3V2ForPersist → Action → 既存 insert/update を使用。

import type { Form3Row } from "@/lib/v2/notebook/form3Mapper";
import {
  detectForm3PayloadSchema,
  loadForm3Payload,
  type LoadForm3PayloadOptions,
  type LoadForm3PayloadResult,
} from "./form3V2Persistence";
import {
  prepareForm3V2PersistPipeline,
  type PrepareForm3V2PersistPipelineResult,
} from "./form3V2WritePath";
import type { Form3DataV2, Form3MigrationWarning } from "./form3V2Types";

export type Form3SnapshotV2 = {
  payload: Form3DataV2;
  /** DB レコード version（楽観ロック）。payload.schemaVersion とは別物 */
  version: number;
  updatedAt: string;
  /** DB に永続化されている schemaVersion（本 Snapshot は v2 行向け） */
  persistedSchemaVersion: 2;
  /** payload.migration / v1Backup から判定 */
  migratedFromV1: boolean;
  warnings: Form3MigrationWarning[];
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

function isMigratedFromV1(payload: Form3DataV2): boolean {
  return Boolean(payload.migration || payload.v1Backup);
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
  const sanitized = sanitizeForm3PayloadAsV2(row.payload, patientId, options);
  const rawSchema = detectForm3PayloadSchema(row.payload).schemaVersion;
  return {
    payload: sanitized.payload,
    version: row.version,
    updatedAt: row.updated_at,
    persistedSchemaVersion: 2,
    migratedFromV1: rawSchema === 1 || isMigratedFromV1(sanitized.payload),
    warnings: sanitized.warnings,
  };
}

/**
 * 保存直前の正規化（sanitize → validation → serialize）。
 * Action が呼ぶ一本道。
 */
export function prepareForm3V2ForPersist(
  data: Form3DataV2,
  patientId: string,
): PrepareForm3V2PersistPipelineResult {
  return prepareForm3V2PersistPipeline(data, patientId);
}
