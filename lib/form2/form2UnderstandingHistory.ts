/**
 * Form2 Understanding (U3b) student Undo/Redo adapter over the shared
 * document history primitive. Snapshot = working Understanding document only.
 * Does not persist, query storage, or mutate React/save state.
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

export { DOCUMENT_HISTORY_LIMIT };

export type Form2UnderstandingDocument = {
  reflections: Record<string, string>;
  overviewText: string;
};

export type Form2UnderstandingHistory = DocumentHistory<Form2UnderstandingDocument>;

export type Form2UnderstandingFieldEditSession = {
  fieldId: string;
  before: Form2UnderstandingDocument;
  composing: boolean;
  commitOnCompositionEnd: boolean;
};

export type Form2UnderstandingRestoreChange = {
  reflections: { fieldKey: string; text: string }[];
  overviewText: string | null;
};

export const UNDERSTANDING_OVERVIEW_FIELD_ID = "overview";

export function understandingReflectionFieldId(fieldKey: string): string {
  return `reflection:${fieldKey}`;
}

export function createEmptyForm2UnderstandingDocument(): Form2UnderstandingDocument {
  return { reflections: {}, overviewText: "" };
}

function reflectionText(
  document: Form2UnderstandingDocument,
  fieldKey: string,
): string {
  return document.reflections[fieldKey] ?? "";
}

export function form2UnderstandingEqualForHistory(
  before: Form2UnderstandingDocument,
  after: Form2UnderstandingDocument,
): boolean {
  if (Object.is(before, after)) return true;
  if (before.overviewText !== after.overviewText) return false;
  const keys = new Set([
    ...Object.keys(before.reflections),
    ...Object.keys(after.reflections),
  ]);
  for (const key of keys) {
    if (reflectionText(before, key) !== reflectionText(after, key)) return false;
  }
  return true;
}

export function emptyForm2UnderstandingHistory(): Form2UnderstandingHistory {
  return emptyDocumentHistory<Form2UnderstandingDocument>();
}

export function canUndoForm2UnderstandingHistory(
  history: Form2UnderstandingHistory,
): boolean {
  return canUndoDocumentHistory(history);
}

export function canRedoForm2UnderstandingHistory(
  history: Form2UnderstandingHistory,
): boolean {
  return canRedoDocumentHistory(history);
}

export function clearForm2UnderstandingHistory(
  _history?: Form2UnderstandingHistory,
): Form2UnderstandingHistory {
  return clearDocumentHistory();
}

export function pushForm2UnderstandingHistory(
  history: Form2UnderstandingHistory,
  input: {
    before: Form2UnderstandingDocument;
    after: Form2UnderstandingDocument;
    reason?: string;
  },
): Form2UnderstandingHistory {
  return pushDocumentHistory(
    history,
    {
      before: input.before,
      after: input.after,
      reason: input.reason,
      equal: form2UnderstandingEqualForHistory,
    },
    DOCUMENT_HISTORY_LIMIT,
  );
}

export function undoForm2UnderstandingHistory(
  history: Form2UnderstandingHistory,
): {
  history: Form2UnderstandingHistory;
  snapshot: Form2UnderstandingDocument | null;
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

export function redoForm2UnderstandingHistory(
  history: Form2UnderstandingHistory,
): {
  history: Form2UnderstandingHistory;
  snapshot: Form2UnderstandingDocument | null;
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

export function form2UnderstandingHistorySessionKey(
  patientId: string,
  userId = "",
): string {
  return `${userId}:${patientId}:understanding`;
}

export function form2UnderstandingUndoRedoDisabled(
  history: Form2UnderstandingHistory,
  pendingFieldEdit = false,
): { undo: boolean; redo: boolean } {
  return {
    undo: !(canUndoForm2UnderstandingHistory(history) || pendingFieldEdit),
    redo: !canRedoForm2UnderstandingHistory(history),
  };
}

export function beginForm2UnderstandingFieldEditSession(
  fieldId: string,
  before: Form2UnderstandingDocument,
): Form2UnderstandingFieldEditSession {
  return {
    fieldId,
    before: structuredClone(before),
    composing: false,
    commitOnCompositionEnd: false,
  };
}

export function setForm2UnderstandingFieldComposing(
  session: Form2UnderstandingFieldEditSession,
  composing: boolean,
): Form2UnderstandingFieldEditSession {
  return {
    ...session,
    composing,
    commitOnCompositionEnd: composing ? session.commitOnCompositionEnd : false,
  };
}

export function shouldCommitForm2UnderstandingFieldEditSession(
  session: Form2UnderstandingFieldEditSession,
  after: Form2UnderstandingDocument,
  options: { force?: boolean } = {},
): boolean {
  if (session.composing && options.force !== true) return false;
  return !form2UnderstandingEqualForHistory(session.before, after);
}

export function applyForm2UnderstandingFieldEditCommit(
  history: Form2UnderstandingHistory,
  session: Form2UnderstandingFieldEditSession,
  after: Form2UnderstandingDocument,
  options: { force?: boolean } = {},
): { history: Form2UnderstandingHistory; committed: boolean } {
  if (!shouldCommitForm2UnderstandingFieldEditSession(session, after, options)) {
    return { history, committed: false };
  }
  return {
    history: pushForm2UnderstandingHistory(history, {
      before: session.before,
      after,
      reason: `understanding_field_edit:${session.fieldId}`,
    }),
    committed: true,
  };
}

export function diffForm2UnderstandingDocument(
  current: Form2UnderstandingDocument,
  target: Form2UnderstandingDocument,
): Form2UnderstandingRestoreChange {
  const reflections: { fieldKey: string; text: string }[] = [];
  const keys = new Set([
    ...Object.keys(current.reflections),
    ...Object.keys(target.reflections),
  ]);
  for (const fieldKey of keys) {
    const from = reflectionText(current, fieldKey);
    const to = reflectionText(target, fieldKey);
    if (from !== to) reflections.push({ fieldKey, text: to });
  }
  return {
    reflections,
    overviewText:
      current.overviewText !== target.overviewText ? target.overviewText : null,
  };
}

/**
 * Restore only changed working fields through the existing onChange paths.
 * History never writes React/save state itself.
 */
export function applyForm2UnderstandingRestore(
  current: Form2UnderstandingDocument,
  target: Form2UnderstandingDocument,
  onChangeReflection: (fieldKey: string, text: string) => void,
  onChangeText: (text: string) => void,
): Form2UnderstandingRestoreChange {
  const change = diffForm2UnderstandingDocument(current, target);
  for (const item of change.reflections) {
    onChangeReflection(item.fieldKey, item.text);
  }
  if (change.overviewText !== null) {
    onChangeText(change.overviewText);
  }
  return change;
}
