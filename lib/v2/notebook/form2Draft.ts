// Compass Version2 β — Phase 3-3
// 様式2の「保存失敗／競合時」のローカル下書き退避（クライアント専用）。
//
// 方針:
//   ・V1 の localStorage 実装（キー接頭辞 compass:v2:form2:）とは別空間を使い、
//     V1 データを絶対に上書きしない（キー接頭辞 compass:v2sb:form2:draft:）。
//   ・共用端末を想定し、ユーザ別 ＋ ケース別にキーを分離する。
//   ・保存成功時に必ず破棄する。SSR 安全（window ガード）・失敗は握りつぶす。
//   ・下書きの有無は useSyncExternalStore で購読する（ハイドレーション安全・
//     effect 内 setState を避けるため）。安定参照をキャッシュで保つ。

import type { Form2Data } from "@/lib/form2/form2Types";

const DRAFT_PREFIX = "compass:v2sb:form2:draft:";

export interface Form2Draft {
  payload: Form2Data;
  // 退避時点で判明していた DB レコードバージョン（初回未保存は null）。
  version: number | null;
  // 退避した時刻（ISO）。復元判断・表示に使う。
  stashedAt: string;
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function draftKey(userId: string, caseId: string): string {
  return `${DRAFT_PREFIX}${userId}:${caseId}`;
}

// useSyncExternalStore 用の安定参照キャッシュとリスナー。
const cache = new Map<string, Form2Draft | null>();
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

function readFromStorage(userId: string, caseId: string): Form2Draft | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(draftKey(userId, caseId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    const p = parsed as Record<string, unknown>;
    if (typeof p.payload !== "object" || p.payload === null) return null;
    return {
      payload: p.payload as Form2Data,
      version: typeof p.version === "number" ? p.version : null,
      stashedAt: typeof p.stashedAt === "string" ? p.stashedAt : "",
    };
  } catch {
    return null;
  }
}

export function readForm2Draft(userId: string, caseId: string): Form2Draft | null {
  return readFromStorage(userId, caseId);
}

export function writeForm2Draft(
  userId: string,
  caseId: string,
  draft: Omit<Form2Draft, "stashedAt">,
): void {
  if (!isBrowser()) return;
  const value: Form2Draft = { ...draft, stashedAt: new Date().toISOString() };
  try {
    window.localStorage.setItem(draftKey(userId, caseId), JSON.stringify(value));
  } catch {
    // 容量超過・プライベートモード等は握りつぶす（保存本体はサーバが正）。
  }
  cache.set(draftKey(userId, caseId), value);
  emit();
}

export function clearForm2Draft(userId: string, caseId: string): void {
  if (isBrowser()) {
    try {
      window.localStorage.removeItem(draftKey(userId, caseId));
    } catch {
      // 失敗は握りつぶす。
    }
  }
  cache.set(draftKey(userId, caseId), null);
  emit();
}

// --- useSyncExternalStore 用 API ---

export function subscribeForm2Draft(callback: () => void): () => void {
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

// 安定参照を返す（同じキーなら同じオブジェクト参照を維持し、購読ループを防ぐ）。
export function getForm2DraftSnapshot(
  userId: string,
  caseId: string,
): Form2Draft | null {
  const key = draftKey(userId, caseId);
  if (cache.has(key)) return cache.get(key) ?? null;
  const loaded = readFromStorage(userId, caseId);
  cache.set(key, loaded);
  return loaded;
}

// サーバ描画時は常に null（安定参照）。
export function getForm2DraftServerSnapshot(): Form2Draft | null {
  return null;
}
