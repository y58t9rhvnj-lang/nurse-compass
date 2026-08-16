// Form3 Phase B2-2A — Read Path 純関数（Repository save / autosave 非接続）
//
// Autosave Migration Rule:
//   1. Migration は dirty を発生させない
//   2. ユーザー編集が発生するまで autosave しない
//   3. 初回保存時に初めて schemaVersion 2 を永続化する（本モジュールは永続化しない）
//   5. Migration だけでは Repository へ save しない

import {
  loadForm3Payload,
  type LoadForm3PayloadOptions,
  type LoadForm3PayloadResult,
} from "./form3V2Persistence";
import { createEmptyForm3V2 } from "./form3V2Factory";
import type { Form3DataV2, Form3MigrationWarning } from "./form3V2Types";

export type Form3ReadHydration = {
  /** メモリ上の v2。DB には書かない */
  dataV2: Form3DataV2;
  warnings: Form3MigrationWarning[];
  sourceSchemaVersion: LoadForm3PayloadResult["sourceSchemaVersion"];
  /**
   * 常に false。Migration / 初回 hydrate は dirty にしない。
   * Hook はこれを見て saveStatus を dirty にしないこと。
   */
  dirty: false;
  /** 本 hydrate は永続化しない（Repository save 禁止） */
  shouldPersist: false;
};

/**
 * 読込専用: schema判定 → (v1→migrate) → sanitize → Form3DataV2。
 * save / autosave / Repository には一切触れない。
 */
export function hydrateForm3ReadPath(
  raw: unknown,
  patientId: string,
  options: LoadForm3PayloadOptions = {},
): Form3ReadHydration {
  if (raw === null || raw === undefined) {
    return {
      dataV2: createEmptyForm3V2(patientId),
      warnings: [],
      sourceSchemaVersion: null,
      dirty: false,
      shouldPersist: false,
    };
  }

  const loaded = loadForm3Payload(raw, patientId, options);
  return {
    dataV2: loaded.data,
    warnings: loaded.warnings,
    sourceSchemaVersion: loaded.sourceSchemaVersion,
    dirty: false,
    shouldPersist: false,
  };
}

/** Snapshot.payload または null から読込 hydrate */
export function hydrateForm3ReadFromSnapshotPayload(
  payload: unknown | null | undefined,
  patientId: string,
  options: LoadForm3PayloadOptions = {},
): Form3ReadHydration {
  return hydrateForm3ReadPath(payload ?? null, patientId, options);
}
