// Compass Version2.1 — Form3 Day 3
// 様式3の「保存失敗／競合時」ローカル下書き退避（クライアント専用）。
//
// 方針:
//   ・キー接頭辞 compass:v2sb:form3:draft:（Form2 の form2:draft とは別空間）。
//   ・ユーザ別 ＋ ケース別にキーを分離する。
//   ・保存成功時に必ず破棄する。SSR 安全（window ガード）・失敗は握りつぶす。
//   ・JSON 破損・patientId 不一致は null（復元しない）。

import {
  FORM3_SCHEMA_VERSION,
  type Form3Data,
} from "@/lib/form3/form3Types";
import { sanitizeForm3Payload } from "@/lib/v2/notebook/form3Mapper";

const DRAFT_PREFIX = "compass:v2sb:form3:draft:";

export interface Form3Draft {
  payload: Form3Data;
  version: number | null;
  stashedAt: string;
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function draftKey(userId: string, caseId: string): string {
  return `${DRAFT_PREFIX}${userId}:${caseId}`;
}

const cache = new Map<string, Form3Draft | null>();
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

/**
 * 生 JSON を下書きとして受理できるか検証し、受理時は sanitize 済み payload を返す。
 * 破損・形不正・patientId 不一致は null。
 */
export function parseForm3Draft(
  raw: unknown,
  expectedPatientId: string,
): Form3Draft | null {
  if (typeof raw !== "object" || raw === null) return null;
  const p = raw as Record<string, unknown>;
  if (typeof p.payload !== "object" || p.payload === null) return null;

  // sanitize は patientId を引数で上書きするため、不一致判定は生 payload で行う。
  const rawPatientId = (p.payload as Record<string, unknown>).patientId;
  if (rawPatientId !== expectedPatientId) return null;

  const { payload } = sanitizeForm3Payload(p.payload, expectedPatientId);
  // schemaVersion は sanitize で現行定数へ正規化済み
  if (payload.schemaVersion !== FORM3_SCHEMA_VERSION) return null;

  return {
    payload,
    version: typeof p.version === "number" ? p.version : null,
    stashedAt: typeof p.stashedAt === "string" ? p.stashedAt : "",
  };
}

function readFromStorage(
  userId: string,
  caseId: string,
  patientId: string,
): Form3Draft | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(draftKey(userId, caseId));
    if (!raw) return null;
    return parseForm3Draft(JSON.parse(raw) as unknown, patientId);
  } catch {
    return null;
  }
}

export function readForm3Draft(
  userId: string,
  caseId: string,
  patientId: string,
): Form3Draft | null {
  return readFromStorage(userId, caseId, patientId);
}

export function writeForm3Draft(
  userId: string,
  caseId: string,
  draft: Omit<Form3Draft, "stashedAt">,
): void {
  if (!isBrowser()) return;
  const value: Form3Draft = { ...draft, stashedAt: new Date().toISOString() };
  try {
    window.localStorage.setItem(draftKey(userId, caseId), JSON.stringify(value));
  } catch {
    // 容量超過等は握りつぶす
  }
  cache.set(draftKey(userId, caseId), value);
  emit();
}

export function clearForm3Draft(userId: string, caseId: string): void {
  if (isBrowser()) {
    try {
      window.localStorage.removeItem(draftKey(userId, caseId));
    } catch {
      // ignore
    }
  }
  cache.set(draftKey(userId, caseId), null);
  emit();
}

export function subscribeForm3Draft(callback: () => void): () => void {
  listeners.add(callback);
  const onStorage = (e: StorageEvent) => {
    if (e.key && e.key.startsWith(DRAFT_PREFIX)) {
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

export function getForm3DraftSnapshot(
  userId: string,
  caseId: string,
  patientId: string,
): Form3Draft | null {
  const key = draftKey(userId, caseId);
  if (cache.has(key)) return cache.get(key) ?? null;
  const loaded = readFromStorage(userId, caseId, patientId);
  cache.set(key, loaded);
  return loaded;
}

export function getForm3DraftServerSnapshot(): Form3Draft | null {
  return null;
}

/** テスト用: キャッシュを空にする */
export function __resetForm3DraftCacheForTests(): void {
  cache.clear();
}
