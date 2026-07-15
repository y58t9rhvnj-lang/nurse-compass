import {
  createEmptyForm2,
  type Form2Data,
  normalizeForm2,
} from "./form2Types";

// 「精神様式2」の永続化層。localStorage をバックエンドに見立て、
// CRUD と購読をこの層へ閉じ込める（将来 API/DB へ差し替えやすくするため）。
// UI/フックは getSnapshot / subscribe / setForm2 / clearForm2 にのみ依存する。
//
// 設計は既存の notesStore と揃える（患者別キー・useSyncExternalStore・安定参照）。

const KEY_PREFIX = "compass:v2:form2:";

// useSyncExternalStore 用に安定参照を保つキャッシュとリスナー。
const cache = new Map<string, Form2Data>();
const listeners = new Set<() => void>();

function storageKey(patientId: string): string {
  return `${KEY_PREFIX}${patientId}`;
}

// SSR ではブラウザ API を使えないため、window 有無でガードする。
function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function read(patientId: string): Form2Data {
  if (!isBrowser()) return createEmptyForm2(patientId);
  try {
    const raw = window.localStorage.getItem(storageKey(patientId));
    if (!raw) return createEmptyForm2(patientId);
    const parsed = JSON.parse(raw) as unknown;
    return normalizeForm2(parsed, patientId);
  } catch {
    // 不正 JSON・読み取り失敗時は空データで安全にフォールバック。
    return createEmptyForm2(patientId);
  }
}

function write(patientId: string, data: Form2Data): void {
  const next: Form2Data = { ...data, patientId };
  // キャッシュは先に更新し、保存失敗でも画面が落ちないようにする。
  cache.set(patientId, next);
  if (isBrowser()) {
    try {
      window.localStorage.setItem(storageKey(patientId), JSON.stringify(next));
    } catch {
      // 容量超過・プライベートモード等の保存失敗は握りつぶす。
    }
  }
  emit();
}

function emit(): void {
  for (const l of listeners) l();
}

// --- useSyncExternalStore 用 API ---

// 別タブでの変更（storage イベント）にも追従する。
export function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  const onStorage = (e: StorageEvent) => {
    if (e.key && e.key.startsWith(KEY_PREFIX)) {
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

// 安定参照を返す（同じ患者なら同じオブジェクト参照を維持）。
export function getSnapshot(patientId: string): Form2Data {
  const cached = cache.get(patientId);
  if (cached) return cached;
  const loaded = read(patientId);
  cache.set(patientId, loaded);
  return loaded;
}

// サーバー描画時は常に空の安定参照（患者別）。
const serverCache = new Map<string, Form2Data>();
export function getServerSnapshot(patientId: string): Form2Data {
  const cached = serverCache.get(patientId);
  if (cached) return cached;
  const empty = createEmptyForm2(patientId);
  serverCache.set(patientId, empty);
  return empty;
}

// --- 更新 API ---

// メモリ上のスナップショットのみを更新して即座に再描画へ反映する
// （localStorage へは書き込まない）。入力のたびにディスク書き込みを行うと
// 重くなるため、実際の保存は commitForm2 でデバウンスして行う。
export function stageForm2(
  patientId: string,
  updater: (prev: Form2Data) => Form2Data,
): Form2Data {
  const prev = getSnapshot(patientId);
  const next: Form2Data = { ...updater(prev), patientId };
  cache.set(patientId, next);
  emit();
  return next;
}

// 現在メモリにある内容を updatedAt を打刻して localStorage へ確定保存する。
export function commitForm2(patientId: string): Form2Data {
  const current = getSnapshot(patientId);
  const next: Form2Data = { ...current, updatedAt: new Date().toISOString() };
  write(patientId, next);
  return next;
}

// 部分更新を即座に確定保存する（初期化直後など、デバウンス不要な場面用）。
export function setForm2(
  patientId: string,
  updater: (prev: Form2Data) => Form2Data,
): Form2Data {
  const prev = getSnapshot(patientId);
  const next: Form2Data = {
    ...updater(prev),
    patientId,
    updatedAt: new Date().toISOString(),
  };
  write(patientId, next);
  return next;
}

// 現在の患者の様式2のみを削除する（他患者・他データには触れない）。
export function clearForm2(patientId: string): void {
  if (isBrowser()) {
    try {
      window.localStorage.removeItem(storageKey(patientId));
    } catch {
      // 削除失敗も握りつぶす。
    }
  }
  cache.set(patientId, createEmptyForm2(patientId));
  emit();
}
