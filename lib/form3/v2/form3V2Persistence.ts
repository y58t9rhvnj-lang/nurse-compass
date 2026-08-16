// Form3 Phase B2-1 — load / save 純関数（Repository・Supabase 非接続）
//
// load: payload → schema判定 → (v1→migrate) → sanitize → Form3DataV2
// save: Form3DataV2 → validate → sanitize → serialize

import { sanitizeForm3Payload } from "@/lib/v2/notebook/form3Mapper";
import { createEmptyForm3V2 } from "./form3V2Factory";
import { migrateForm3V1ToV2 } from "./form3V2Migration";
import {
  parseForm3JsonPayload,
  serializeForm3DataV2,
  serializeForm3DataV2ToJson,
} from "./form3V2Serialize";
import { sanitizeForm3V2Payload } from "./form3V2Sanitize";
import {
  isForm3DataV1,
  isForm3DataV2,
  type Form3DataV2,
  type Form3MigrationWarning,
} from "./form3V2Types";
import {
  validateForm3V2Persistence,
  type Form3V2PersistenceIssue,
} from "./form3V2Validation";

export type Form3PayloadSchemaVersion = 1 | 2;

export type DetectForm3PayloadSchemaResult = {
  schemaVersion: Form3PayloadSchemaVersion | null;
};

/**
 * payload の schema 判定。
 * - schemaVersion 明示を優先
 * - 欠落時は構造ヒューリスティック（patterns → v1、cards+finalForm → v2）
 */
export function detectForm3PayloadSchema(
  raw: unknown,
): DetectForm3PayloadSchemaResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { schemaVersion: null };
  }
  const v = raw as Record<string, unknown>;

  if (v.schemaVersion === 2) return { schemaVersion: 2 };
  if (v.schemaVersion === 1) return { schemaVersion: 1 };

  if (
    Array.isArray(v.informationCards) &&
    Array.isArray(v.assessmentCards) &&
    v.finalForm !== null &&
    typeof v.finalForm === "object"
  ) {
    return { schemaVersion: 2 };
  }
  if (v.patterns !== null && typeof v.patterns === "object") {
    return { schemaVersion: 1 };
  }
  return { schemaVersion: null };
}

export type LoadForm3PayloadOptions = {
  /** migrate の migratedAt 固定（テスト用） */
  now?: string;
};

export type LoadForm3PayloadResult = {
  data: Form3DataV2;
  warnings: Form3MigrationWarning[];
  /** 入力が v1 / v2 のどちらと判定されたか。空・不明は null */
  sourceSchemaVersion: Form3PayloadSchemaVersion | null;
};

/**
 * 任意 payload を Form3DataV2 へ正規化して読み込む。
 *
 * ```
 * payload → v1 → migrate → sanitize → v2
 * payload → v2 → sanitize → v2
 * ```
 *
 * Repository には接続しない。
 */
export function loadForm3Payload(
  raw: unknown,
  patientId: string,
  options: LoadForm3PayloadOptions = {},
): LoadForm3PayloadResult {
  const parsed = parseForm3JsonPayload(raw);
  const { schemaVersion } = detectForm3PayloadSchema(parsed);

  if (schemaVersion === 1 || isForm3DataV1(parsed)) {
    const { payload: v1 } = sanitizeForm3Payload(parsed, patientId);
    const migrated = migrateForm3V1ToV2(v1, patientId, { now: options.now });
    const { data, warnings: sanitizeWarnings } = sanitizeForm3V2Payload(
      migrated,
      patientId,
    );
    const warnings: Form3MigrationWarning[] = [
      ...(data.migration?.warnings ?? []),
      ...sanitizeWarnings,
    ];
    return { data, warnings, sourceSchemaVersion: 1 };
  }

  if (schemaVersion === 2 || isForm3DataV2(parsed)) {
    const { data, warnings } = sanitizeForm3V2Payload(parsed, patientId);
    return { data, warnings, sourceSchemaVersion: 2 };
  }

  return {
    data: createEmptyForm3V2(patientId),
    warnings: [],
    sourceSchemaVersion: null,
  };
}

/** deserialize 別名（JSON 文字列／オブジェクト両対応） */
export function deserializeForm3Payload(
  raw: unknown,
  patientId: string,
  options: LoadForm3PayloadOptions = {},
): LoadForm3PayloadResult {
  return loadForm3Payload(raw, patientId, options);
}

export type SaveForm3PayloadResult =
  | {
      ok: true;
      /** JSONB へ渡すプレーンオブジェクト */
      payload: Record<string, unknown>;
      /** 正規化後のドメインオブジェクト */
      data: Form3DataV2;
      json: string;
      warnings: Form3MigrationWarning[];
    }
  | {
      ok: false;
      issues: Form3V2PersistenceIssue[];
      warnings: Form3MigrationWarning[];
    };

/**
 * Form3DataV2 を保存用 payload へ変換する。
 * validate → sanitize → serialize。Repository には接続しない。
 */
export function saveForm3Payload(
  data: Form3DataV2,
  patientId: string,
): SaveForm3PayloadResult {
  const before = validateForm3V2Persistence(data);
  if (!before.ok) {
    return { ok: false, issues: before.issues, warnings: [] };
  }

  const { data: sanitized, warnings } = sanitizeForm3V2Payload(data, patientId);
  const after = validateForm3V2Persistence(sanitized);
  if (!after.ok) {
    return { ok: false, issues: after.issues, warnings };
  }

  const payload = serializeForm3DataV2(sanitized);
  return {
    ok: true,
    payload,
    data: sanitized,
    json: serializeForm3DataV2ToJson(sanitized),
    warnings,
  };
}

/** 往復比較用（キー順に依存しないよう serialize 経由） */
export function form3DataV2PersistenceFingerprint(data: Form3DataV2): string {
  return serializeForm3DataV2ToJson(data);
}
