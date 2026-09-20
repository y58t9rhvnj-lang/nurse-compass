/**
 * Form2 student Undo/Redo adapter over the shared document history primitive.
 * Snapshot = Form2Data payload only. Does not persist, query storage,
 * or mutate Form React state. DB lock version stays in the Form hook.
 */

import {
  canRedoDocumentHistory,
  canUndoDocumentHistory,
  clearDocumentHistory,
  DOCUMENT_HISTORY_LIMIT,
  emptyDocumentHistory,
  pushDocumentHistory,
  redoDocumentHistory,
  undoDocumentHistory,
  type DocumentHistory,
} from "../v2/history/documentHistory";
import type { Form2Data } from "./form2Types";

export { DOCUMENT_HISTORY_LIMIT };
export type Form2DocumentHistory = DocumentHistory<Form2Data>;

export type Form2HistoryControlLock = {
  mode?: "edit" | "view";
  understandingOpen?: boolean;
};

export type Form2FieldEditSession = {
  fieldId: string;
  before: Form2Data;
  composing: boolean;
  commitOnCompositionEnd: boolean;
};

function omitUpdatedAt<T extends { updatedAt: string }>(
  value: T,
): Omit<T, "updatedAt"> {
  const { updatedAt: _updatedAt, ...rest } = value;
  return rest;
}

function deepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (typeof left !== typeof right) return false;
  if (left === null || right === null) return left === right;
  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) return false;
    for (let i = 0; i < left.length; i += 1) {
      if (!deepEqual(left[i], right[i])) return false;
    }
    return true;
  }
  if (typeof left === "object" && typeof right === "object") {
    const leftObj = left as Record<string, unknown>;
    const rightObj = right as Record<string, unknown>;
    const keys = Object.keys(leftObj);
    if (keys.length !== Object.keys(rightObj).length) return false;
    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(rightObj, key)) return false;
      if (!deepEqual(leftObj[key], rightObj[key])) return false;
    }
    return true;
  }
  return false;
}

export function form2DataEqualForHistory(
  before: Form2Data,
  after: Form2Data,
): boolean {
  if (Object.is(before, after)) return true;
  return deepEqual(omitUpdatedAt(before), omitUpdatedAt(after));
}

export function emptyForm2DocumentHistory(): Form2DocumentHistory {
  return emptyDocumentHistory<Form2Data>();
}

export function canUndoForm2DocumentHistory(
  history: Form2DocumentHistory,
): boolean {
  return canUndoDocumentHistory(history);
}

export function canRedoForm2DocumentHistory(
  history: Form2DocumentHistory,
): boolean {
  return canRedoDocumentHistory(history);
}

export function clearForm2DocumentHistory(
  _history?: Form2DocumentHistory,
): Form2DocumentHistory {
  return clearDocumentHistory();
}

export function pushForm2DocumentHistory(
  history: Form2DocumentHistory,
  input: {
    before: Form2Data;
    after: Form2Data;
    reason?: string;
  },
): Form2DocumentHistory {
  return pushDocumentHistory(
    history,
    {
      before: input.before,
      after: input.after,
      reason: input.reason,
      equal: form2DataEqualForHistory,
    },
    DOCUMENT_HISTORY_LIMIT,
  );
}

export function undoForm2DocumentHistory(history: Form2DocumentHistory): {
  history: Form2DocumentHistory;
  snapshot: Form2Data | null;
  reason?: string;
} {
  const entry = history.past[history.past.length - 1];
  const result = undoDocumentHistory(history);
  return {
    history: result.history,
    snapshot: result.snapshot,
    reason: entry?.reason,
  };
}

export function redoForm2DocumentHistory(history: Form2DocumentHistory): {
  history: Form2DocumentHistory;
  snapshot: Form2Data | null;
  reason?: string;
} {
  const entry = history.future[0];
  const result = redoDocumentHistory(history);
  return {
    history: result.history,
    snapshot: result.snapshot,
    reason: entry?.reason,
  };
}

export function form2HistorySessionKey(
  patientId: string,
  userId = "",
): string {
  return `${userId}:${patientId}`;
}

export function form2UndoRedoLocked(lock: Form2HistoryControlLock): boolean {
  return lock.mode === "view" || lock.understandingOpen === true;
}

export function form2UndoRedoDisabled(
  history: Form2DocumentHistory,
  lock: Form2HistoryControlLock = {},
  pendingFieldEdit = false,
): { undo: boolean; redo: boolean } {
  const locked = form2UndoRedoLocked(lock);
  return {
    undo: locked || !(canUndoForm2DocumentHistory(history) || pendingFieldEdit),
    redo: locked || !canRedoForm2DocumentHistory(history),
  };
}

export function beginForm2FieldEditSession(
  fieldId: string,
  before: Form2Data,
): Form2FieldEditSession {
  return {
    fieldId,
    before: structuredClone(before),
    composing: false,
    commitOnCompositionEnd: false,
  };
}

export function setForm2FieldComposing(
  session: Form2FieldEditSession,
  composing: boolean,
): Form2FieldEditSession {
  return {
    ...session,
    composing,
    commitOnCompositionEnd: composing ? session.commitOnCompositionEnd : false,
  };
}

export function shouldCommitForm2FieldEditSession(
  session: Form2FieldEditSession,
  after: Form2Data,
  options: { force?: boolean } = {},
): boolean {
  if (session.composing && options.force !== true) return false;
  return !form2DataEqualForHistory(session.before, after);
}

export function applyForm2FieldEditCommit(
  history: Form2DocumentHistory,
  session: Form2FieldEditSession,
  after: Form2Data,
  options: { force?: boolean } = {},
): { history: Form2DocumentHistory; committed: boolean } {
  if (!shouldCommitForm2FieldEditSession(session, after, options)) {
    return { history, committed: false };
  }
  return {
    history: pushForm2DocumentHistory(history, {
      before: session.before,
      after,
      reason: `form2_field_edit:${session.fieldId}`,
    }),
    committed: true,
  };
}
