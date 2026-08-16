// Compass Version2.1 — Form3 Day 2
// Form3Data ⇄ form3_records 行 の変換。
//
// 方針:
//   ・payload は sanitizeForm3Payload で正規化し、patientId はサーバ値で上書きする。
//   ・11パターン固定キーのみ残す（未知キー削除・欠落キー補完）。
//   ・様式2本文・患者理解全文などの転記フィールドは受け取っても捨てる。
//   ・不正な isReviewed:true は false へ戻し、本文は保持する（保存拒否しない）。
//   ・DB 列 version（レコード版）と Form3Data.schemaVersion（スキーマ版）は別物。
//
// Phase B2-1: v2 正規化は lib/form3/v2/form3V2Mapper.ts（Repository 未接続）。
//   sanitizeForm3PayloadAsV2 / rowToForm3SnapshotV2 / prepareForm3V2ForPersist

import {
  FORM3_PATTERN_KEYS,
  FORM3_SCHEMA_VERSION,
  createEmptyForm3,
  createEmptyForm3PatternData,
  isForm3Judgment,
  type Form3Data,
  type Form3PatternData,
  type Form3PatternKey,
  type Form3Patterns,
} from "@/lib/form3/form3Types";
import { meetsForm3ReviewRequirements } from "@/lib/form3/form3Validation";
import { detectForm3PayloadSchema } from "@/lib/form3/v2/form3V2SchemaDetect";
import type { Form3SaveWarning, Form3Snapshot } from "./types";

export interface Form3Row {
  id: string;
  user_id: string;
  organization_id: string;
  academic_year: number;
  case_id: string;
  payload: unknown;
  version: number;
  created_at: string;
  updated_at: string;
}

export type SanitizeForm3Result = {
  payload: Form3Data;
  warnings: Form3SaveWarning[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function pickString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function sanitizePattern(
  raw: unknown,
  patternKey: Form3PatternKey,
  warnings: Form3SaveWarning[],
): Form3PatternData {
  const base = createEmptyForm3PatternData();
  const obj = asRecord(raw);
  if (!obj) return base;

  const judgmentRaw = obj.judgment;
  const judgment =
    judgmentRaw === null || judgmentRaw === undefined
      ? null
      : typeof judgmentRaw === "string" && isForm3Judgment(judgmentRaw)
        ? judgmentRaw
        : null;

  const candidate: Form3PatternData = {
    relatedInformation: pickString(obj.relatedInformation),
    interpretation: pickString(obj.interpretation),
    crossPatternRelations: pickString(obj.crossPatternRelations),
    judgment,
    judgmentRationale: pickString(obj.judgmentRationale),
    additionalInformationNeeded: pickString(obj.additionalInformationNeeded),
    // boolean 以外は false。true でも完了条件未満なら後で落とす。
    isReviewed: obj.isReviewed === true,
  };

  if (candidate.isReviewed && !meetsForm3ReviewRequirements(candidate)) {
    candidate.isReviewed = false;
    warnings.push({ code: "invalid_reviewed_reset", patternKey });
  }

  return candidate;
}

/**
 * クライアント／DB由来の payload をサーバ信頼の Form3Data へ正規化する。
 * patientId は引数で上書きする（クライアント申告値を信用しない）。
 */
export function sanitizeForm3Payload(
  raw: unknown,
  patientId: string,
): SanitizeForm3Result {
  const warnings: Form3SaveWarning[] = [];
  const base = createEmptyForm3(patientId);
  const obj = asRecord(raw);
  if (!obj) {
    return { payload: base, warnings };
  }

  const patternsRaw = asRecord(obj.patterns);
  const patterns = {} as Form3Patterns;
  for (const key of FORM3_PATTERN_KEYS) {
    patterns[key] = sanitizePattern(
      patternsRaw ? patternsRaw[key] : undefined,
      key,
      warnings,
    );
  }

  // schemaVersion は常に現行定数へ正規化（未知・欠落・旧値でも 1）。
  // patientId はサーバ値。updatedAt は文字列のみ採用（それ以外は空）。
  // 未知トップレベルキー（form2 / overviewText 等）はここに拾わず破棄する。
  const payload: Form3Data = {
    schemaVersion: FORM3_SCHEMA_VERSION,
    patientId,
    patterns,
    updatedAt: pickString(obj.updatedAt),
  };

  return { payload, warnings };
}

/** DB 行 → Snapshot。DB version と schemaVersion を混同しない。 */
export function rowToForm3Snapshot(
  row: Form3Row,
  patientId: string,
): Form3Snapshot {
  const rawPayload = row.payload;
  const detected = detectForm3PayloadSchema(rawPayload).schemaVersion;
  const { payload } = sanitizeForm3Payload(rawPayload, patientId);
  return {
    payload,
    version: row.version,
    updatedAt: row.updated_at,
    persistedSchemaVersion: detected ?? 1,
    rawPayload,
  };
}

export const FORM3_SELECT_COLUMNS =
  "id, user_id, organization_id, academic_year, case_id, payload, version, created_at, updated_at";
