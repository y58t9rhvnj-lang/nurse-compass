// Form3 Phase B — 空データ生成・ID ヘルパ（外部パッケージなし）

import {
  createEmptyForm3FinalForm,
  FORM3_SCHEMA_VERSION_V2,
  type Form3DataV2,
} from "./form3V2Types";

/** クライアント作成用。オートセーブ前後で変えない */
export function createForm3CardId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * 移行用の安定キー（論理）。将来個別テーブル化時の突合に使う。
 * グローバル一意の DB PK ではない。
 */
export function migrationStableKeyInfo(patternKey: string): string {
  return `v1-relatedInformation:${patternKey}`;
}

export function migrationStableKeyAssess(patternKey: string): string {
  return `v1-assessment-bundle:${patternKey}`;
}

/**
 * 移行用カード id（決定的）。
 *
 * 一意性スコープ: **単一の form3_records.payload 内**
 * （所有軸 user×org×year×case の1行に紐づく JSON 内）。
 *
 * グローバル一意の DB 主キーとしては使わない。
 * テーブル昇格時は UUID を新規採番し、stableMigrationKey で突合する。
 */
export function migrationForm3InformationId(patternKey: string): string {
  return `form3-payload:mig-info-v1:${patternKey}`;
}

export function migrationForm3AssessmentId(patternKey: string): string {
  return `form3-payload:mig-assess-v1:${patternKey}`;
}

export function createEmptyForm3V2(patientId: string): Form3DataV2 {
  return {
    schemaVersion: FORM3_SCHEMA_VERSION_V2,
    patientId,
    informationCards: [],
    assessmentCards: [],
    finalForm: createEmptyForm3FinalForm(),
    updatedAt: "",
  };
}
