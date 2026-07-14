import type { Note } from "./notes";

// 気づきメモの永続化層。現状は localStorage 実装だが、
// 将来バックエンド（API/DB）へ差し替えやすいよう、CRUD と購読をこの層に閉じ込める。
// UI/フック側はこのモジュールのインターフェース（getSnapshot / subscribe / CRUD）にのみ依存する。

const KEY_PREFIX = "nc:notes:";

// useSyncExternalStore 用に安定参照を保つためのキャッシュとリスナー。
const cache = new Map<string, Note[]>();
const listeners = new Set<() => void>();
const EMPTY: Note[] = [];

function storageKey(patientId: string): string {
  return `${KEY_PREFIX}${patientId}`;
}

// SSR ではブラウザ API を使えないため、window 有無でガードする。
function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function readAll(patientId: string): Note[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(storageKey(patientId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isNote);
  } catch {
    return [];
  }
}

function writeAll(patientId: string, notes: Note[]): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(storageKey(patientId), JSON.stringify(notes));
  } catch {
    // 保存失敗（容量超過・プライベートモード等）は握りつぶす
  }
  // キャッシュを更新してから購読者へ通知
  cache.set(patientId, [...notes].sort((a, b) => b.updatedAt - a.updatedAt));
  emit();
}

function emit(): void {
  for (const l of listeners) l();
}

function isNote(value: unknown): value is Note {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.patientId === "string" &&
    typeof v.text === "string" &&
    typeof v.createdAt === "number" &&
    typeof v.updatedAt === "number"
  );
}

function createId(): string {
  if (isBrowser() && typeof window.crypto?.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `note-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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

// 安定参照を返す（同じ内容なら同じ配列参照）。
export function getSnapshot(patientId: string): Note[] {
  const cached = cache.get(patientId);
  if (cached) return cached;
  const loaded = readAll(patientId).sort((a, b) => b.updatedAt - a.updatedAt);
  cache.set(patientId, loaded);
  return loaded;
}

// サーバー描画時は常に空（安定参照）。
export function getServerSnapshot(): Note[] {
  return EMPTY;
}

// --- CRUD ---

export function getNotes(patientId: string): Note[] {
  return getSnapshot(patientId);
}

export function addNote(patientId: string, text: string): Note {
  const now = Date.now();
  const note: Note = {
    id: createId(),
    patientId,
    text: text.trim(),
    createdAt: now,
    updatedAt: now,
  };
  writeAll(patientId, [note, ...readAll(patientId)]);
  return note;
}

export function updateNote(
  patientId: string,
  id: string,
  text: string,
): Note | null {
  const notes = readAll(patientId);
  const idx = notes.findIndex((n) => n.id === id);
  if (idx === -1) return null;
  const updated: Note = {
    ...notes[idx],
    text: text.trim(),
    updatedAt: Date.now(),
  };
  notes[idx] = updated;
  writeAll(patientId, notes);
  return updated;
}

export function deleteNote(patientId: string, id: string): void {
  writeAll(
    patientId,
    readAll(patientId).filter((n) => n.id !== id),
  );
}
