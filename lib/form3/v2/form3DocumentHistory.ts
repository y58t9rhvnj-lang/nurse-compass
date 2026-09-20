/**
 * Form3 student Undo/Redo adapter over the shared document history primitive.
 * Snapshot = Form3DataV2 payload only. Does not persist, query storage,
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
} from "../../v2/history/documentHistory";
import {
  isForm3V2AutosaveReason,
  type Form3V2AutosaveReason,
} from "./form3V2AutosaveReasons";
import type { Form3DataV2 } from "./form3V2Types";

export { DOCUMENT_HISTORY_LIMIT };
export type Form3DocumentHistory = DocumentHistory<Form3DataV2>;

export type Form3HistoryControlLock = {
  mode?: "edit" | "view";
  dialogOpen?: boolean;
  submitConfirmOpen?: boolean;
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

/**
 * Semantic equality for history NO-OP.
 * Ignores card/document updatedAt that ops rewrite on every confirm.
 * Does not JSON.stringify the full payload.
 */
export function form3DataV2EqualForHistory(
  before: Form3DataV2,
  after: Form3DataV2,
): boolean {
  if (Object.is(before, after)) return true;
  return deepEqual(
    {
      schemaVersion: before.schemaVersion,
      patientId: before.patientId,
      informationCards: before.informationCards.map(omitUpdatedAt),
      assessmentCards: before.assessmentCards.map(omitUpdatedAt),
      finalForm: before.finalForm,
      workspacePatternFlags: before.workspacePatternFlags ?? null,
      migration: before.migration ?? null,
      v1Backup: before.v1Backup ?? null,
    },
    {
      schemaVersion: after.schemaVersion,
      patientId: after.patientId,
      informationCards: after.informationCards.map(omitUpdatedAt),
      assessmentCards: after.assessmentCards.map(omitUpdatedAt),
      finalForm: after.finalForm,
      workspacePatternFlags: after.workspacePatternFlags ?? null,
      migration: after.migration ?? null,
      v1Backup: after.v1Backup ?? null,
    },
  );
}

export function emptyForm3DocumentHistory(): Form3DocumentHistory {
  return emptyDocumentHistory<Form3DataV2>();
}

export function canUndoForm3DocumentHistory(
  history: Form3DocumentHistory,
): boolean {
  return canUndoDocumentHistory(history);
}

export function canRedoForm3DocumentHistory(
  history: Form3DocumentHistory,
): boolean {
  return canRedoDocumentHistory(history);
}

export function clearForm3DocumentHistory(
  _history?: Form3DocumentHistory,
): Form3DocumentHistory {
  return clearDocumentHistory();
}

export function pushForm3DocumentHistory(
  history: Form3DocumentHistory,
  input: {
    before: Form3DataV2;
    after: Form3DataV2;
    reason?: string;
  },
): Form3DocumentHistory {
  return pushDocumentHistory(
    history,
    {
      before: input.before,
      after: input.after,
      reason: input.reason,
      equal: form3DataV2EqualForHistory,
    },
    DOCUMENT_HISTORY_LIMIT,
  );
}

export function undoForm3DocumentHistory(history: Form3DocumentHistory): {
  history: Form3DocumentHistory;
  snapshot: Form3DataV2 | null;
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

export function redoForm3DocumentHistory(history: Form3DocumentHistory): {
  history: Form3DocumentHistory;
  snapshot: Form3DataV2 | null;
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

export function form3HistorySessionKey(
  patientId: string,
  userId = "",
): string {
  return `${userId}:${patientId}`;
}

export function form3UndoRedoLocked(
  lock: Form3HistoryControlLock,
): boolean {
  return (
    lock.mode === "view" ||
    lock.dialogOpen === true ||
    lock.submitConfirmOpen === true
  );
}

export function form3UndoRedoDisabled(
  history: Form3DocumentHistory,
  lock: Form3HistoryControlLock = {},
): { undo: boolean; redo: boolean } {
  const locked = form3UndoRedoLocked(lock);
  return {
    undo: locked || !canUndoForm3DocumentHistory(history),
    redo: locked || !canRedoForm3DocumentHistory(history),
  };
}

export function form3RestoreAutosaveReason(
  reason?: string,
): Form3V2AutosaveReason {
  if (reason === "information_archived") return "information_restored";
  if (reason === "assessment_archived") return "assessment_restored";
  if (isForm3V2AutosaveReason(reason)) return reason;
  return "information_updated";
}
