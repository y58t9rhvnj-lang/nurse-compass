/**
 * Session-local document Undo/Redo primitive for Form2 / Form3.
 * Generic. React-free. Does not persist, query storage, or mutate Form state.
 */

export const DOCUMENT_HISTORY_LIMIT = 50;

export type DocumentHistoryEntry<T> = {
  before: T;
  after: T;
  reason?: string;
};

export type DocumentHistory<T> = {
  past: DocumentHistoryEntry<T>[];
  future: DocumentHistoryEntry<T>[];
};

export type PushDocumentHistoryInput<T> = {
  before: T;
  after: T;
  reason?: string;
  equal?: (before: T, after: T) => boolean;
};

function cloneSnapshot<T>(value: T): T {
  return structuredClone(value);
}

function cloneEntry<T>(entry: DocumentHistoryEntry<T>): DocumentHistoryEntry<T> {
  return {
    before: cloneSnapshot(entry.before),
    after: cloneSnapshot(entry.after),
    reason: entry.reason,
  };
}

function isNoOp<T>(input: PushDocumentHistoryInput<T>): boolean {
  if (input.equal) return input.equal(input.before, input.after);
  return Object.is(input.before, input.after);
}

export function emptyDocumentHistory<T>(): DocumentHistory<T> {
  return { past: [], future: [] };
}

export function canUndoDocumentHistory<T>(history: DocumentHistory<T>): boolean {
  return history.past.length > 0;
}

export function canRedoDocumentHistory<T>(history: DocumentHistory<T>): boolean {
  return history.future.length > 0;
}

export function clearDocumentHistory<T>(
  _history?: DocumentHistory<T>,
): DocumentHistory<T> {
  return emptyDocumentHistory();
}

export function pushDocumentHistory<T>(
  history: DocumentHistory<T>,
  input: PushDocumentHistoryInput<T>,
  limit = DOCUMENT_HISTORY_LIMIT,
): DocumentHistory<T> {
  if (isNoOp(input)) return history;
  const entry: DocumentHistoryEntry<T> = {
    before: cloneSnapshot(input.before),
    after: cloneSnapshot(input.after),
  };
  if (input.reason !== undefined) entry.reason = input.reason;
  const past = [...history.past, entry];
  while (past.length > limit) past.shift();
  return { past, future: [] };
}

export function undoDocumentHistory<T>(history: DocumentHistory<T>): {
  history: DocumentHistory<T>;
  snapshot: T | null;
} {
  if (history.past.length === 0) {
    return { history, snapshot: null };
  }
  const entry = history.past[history.past.length - 1]!;
  return {
    history: {
      past: history.past.slice(0, -1),
      future: [cloneEntry(entry), ...history.future],
    },
    snapshot: cloneSnapshot(entry.before),
  };
}

export function redoDocumentHistory<T>(history: DocumentHistory<T>): {
  history: DocumentHistory<T>;
  snapshot: T | null;
} {
  if (history.future.length === 0) {
    return { history, snapshot: null };
  }
  const entry = history.future[0]!;
  return {
    history: {
      past: [...history.past, cloneEntry(entry)],
      future: history.future.slice(1),
    },
    snapshot: cloneSnapshot(entry.after),
  };
}
