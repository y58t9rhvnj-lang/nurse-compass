// Form3 Phase B2-1 — schemaVersion 2 Draft（クライアント専用・localStorage）
//
// 既存 v1 Draft（lib/v2/notebook/form3Draft.ts）は維持。
// キー空間を分離し、Day1–5 / 旧 Hook を壊さない。
//
// 方針:
//   ・接頭辞 compass:v2sb:form3:draft:v2:（v1 の form3:draft: とは別）
//   ・読込時は loadForm3Payload（v1 形を誤って書いた場合も migrate）
//   ・保存成功時の破棄は Hook 配線時（本フェーズでは純関数＋storage API のみ）

import {
  loadForm3Payload,
  saveForm3Payload,
} from "./form3V2Persistence";
import type { Form3DataV2 } from "./form3V2Types";

const DRAFT_PREFIX_V2 = "compass:v2sb:form3:draft:v2:";

export interface Form3V2Draft {
  payload: Form3DataV2;
  version: number | null;
  stashedAt: string;
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function draftKeyV2(userId: string, caseId: string): string {
  return `${DRAFT_PREFIX_V2}${userId}:${caseId}`;
}

const cache = new Map<string, Form3V2Draft | null>();
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

/**
 * 生 JSON を v2 下書きとして受理。
 * 破損・形不正・patientId 不一致は null。
 * payload が v1 形でも loadForm3Payload 経由で v2 へ正規化して受理する。
 */
export function parseForm3V2Draft(
  raw: unknown,
  expectedPatientId: string,
): Form3V2Draft | null {
  if (typeof raw !== "object" || raw === null) return null;
  const p = raw as Record<string, unknown>;
  if (typeof p.payload !== "object" || p.payload === null) return null;

  const rawPatientId = (p.payload as Record<string, unknown>).patientId;
  if (rawPatientId !== expectedPatientId) return null;

  const loaded = loadForm3Payload(p.payload, expectedPatientId);
  if (loaded.data.schemaVersion !== 2) return null;
  if (loaded.data.patientId !== expectedPatientId) return null;

  return {
    payload: loaded.data,
    version: typeof p.version === "number" ? p.version : null,
    stashedAt: typeof p.stashedAt === "string" ? p.stashedAt : "",
  };
}

function readFromStorage(
  userId: string,
  caseId: string,
  patientId: string,
): Form3V2Draft | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(draftKeyV2(userId, caseId));
    if (!raw) return null;
    return parseForm3V2Draft(JSON.parse(raw) as unknown, patientId);
  } catch {
    return null;
  }
}

export function readForm3V2Draft(
  userId: string,
  caseId: string,
  patientId: string,
): Form3V2Draft | null {
  return readFromStorage(userId, caseId, patientId);
}

export function writeForm3V2Draft(
  userId: string,
  caseId: string,
  draft: Omit<Form3V2Draft, "stashedAt">,
): void {
  if (!isBrowser()) return;

  const saved = saveForm3Payload(draft.payload, draft.payload.patientId);
  if (!saved.ok) return;

  const value: Form3V2Draft = {
    payload: saved.data,
    version: draft.version,
    stashedAt: new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(
      draftKeyV2(userId, caseId),
      JSON.stringify(value),
    );
  } catch {
    // 容量超過等は握りつぶす
  }
  cache.set(draftKeyV2(userId, caseId), value);
  emit();
}

export function clearForm3V2Draft(userId: string, caseId: string): void {
  if (isBrowser()) {
    try {
      window.localStorage.removeItem(draftKeyV2(userId, caseId));
    } catch {
      // ignore
    }
  }
  cache.set(draftKeyV2(userId, caseId), null);
  emit();
}

export function subscribeForm3V2Draft(callback: () => void): () => void {
  listeners.add(callback);
  const onStorage = (e: StorageEvent) => {
    if (e.key && e.key.startsWith(DRAFT_PREFIX_V2)) {
      cache.clear();
      emit();
    }
  };
  if (isBrowser()) window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(callback);
    if (isBrowser()) window.removeEventListener("storage", onStorage);
  };
}

export function getForm3V2DraftSnapshot(
  userId: string,
  caseId: string,
  patientId: string,
): Form3V2Draft | null {
  const key = draftKeyV2(userId, caseId);
  if (cache.has(key)) return cache.get(key) ?? null;
  const loaded = readFromStorage(userId, caseId, patientId);
  cache.set(key, loaded);
  return loaded;
}

export function getForm3V2DraftServerSnapshot(): Form3V2Draft | null {
  return null;
}

/** テスト用: キャッシュを空にする */
export function __resetForm3V2DraftCacheForTests(): void {
  cache.clear();
}

export const FORM3_V2_DRAFT_PREFIX = DRAFT_PREFIX_V2;
