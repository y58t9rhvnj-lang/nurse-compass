"use client";

import { useCallback, useRef, useState } from "react";
import {
  applyForm2UnderstandingFieldEditCommit,
  beginForm2UnderstandingFieldEditSession,
  canRedoForm2UnderstandingHistory,
  canUndoForm2UnderstandingHistory,
  clearForm2UnderstandingHistory,
  emptyForm2UnderstandingHistory,
  form2UnderstandingEqualForHistory,
  form2UnderstandingHistorySessionKey,
  form2UnderstandingUndoRedoDisabled,
  redoForm2UnderstandingHistory,
  setForm2UnderstandingFieldComposing,
  undoForm2UnderstandingHistory,
  type Form2UnderstandingDocument,
  type Form2UnderstandingFieldEditSession,
  type Form2UnderstandingHistory,
} from "@/lib/form2/form2UnderstandingHistory";

export type UseForm2UnderstandingHistoryArgs = {
  patientId: string;
  userId?: string;
  getDocument: () => Form2UnderstandingDocument;
};

/**
 * Session-local Understanding document history + one field-edit session.
 * Does not call save APIs. Caller restores via onChangeReflection / onChangeText.
 */
export function useForm2UnderstandingHistory({
  patientId,
  userId = "",
  getDocument,
}: UseForm2UnderstandingHistoryArgs) {
  const sessionKey = form2UnderstandingHistorySessionKey(patientId, userId);
  const sessionKeyRef = useRef(sessionKey);
  const restoringRef = useRef(false);
  const intentGuardRef = useRef(false);
  const [history, setHistory] = useState<Form2UnderstandingHistory>(() =>
    emptyForm2UnderstandingHistory(),
  );
  const historyRef = useRef(history);
  const [fieldSession, setFieldSession] =
    useState<Form2UnderstandingFieldEditSession | null>(null);
  const fieldSessionRef = useRef<Form2UnderstandingFieldEditSession | null>(
    null,
  );

  if (sessionKeyRef.current !== sessionKey) {
    sessionKeyRef.current = sessionKey;
    const cleared = clearForm2UnderstandingHistory();
    historyRef.current = cleared;
    fieldSessionRef.current = null;
    setHistory(cleared);
    setFieldSession(null);
  }

  const commitHistory = useCallback((next: Form2UnderstandingHistory) => {
    historyRef.current = next;
    setHistory(next);
  }, []);

  const setSession = useCallback(
    (next: Form2UnderstandingFieldEditSession | null) => {
      fieldSessionRef.current = next;
      setFieldSession(next);
    },
    [],
  );

  const commitActiveField = useCallback(
    (options: { force?: boolean } = {}) => {
      const session = fieldSessionRef.current;
      if (!session) return false;
      if (session.composing && options.force !== true) {
        setSession({ ...session, commitOnCompositionEnd: true });
        return false;
      }
      if (restoringRef.current) {
        setSession(null);
        return false;
      }
      const after = getDocument();
      const result = applyForm2UnderstandingFieldEditCommit(
        historyRef.current,
        session,
        after,
        options,
      );
      commitHistory(result.history);
      setSession(null);
      return result.committed;
    },
    [commitHistory, getDocument, setSession],
  );

  const beginField = useCallback(
    (fieldId: string) => {
      if (restoringRef.current) return;
      const current = fieldSessionRef.current;
      if (current && current.fieldId !== fieldId) {
        commitActiveField({ force: true });
      } else if (current && current.fieldId === fieldId) {
        return;
      }
      setSession(beginForm2UnderstandingFieldEditSession(fieldId, getDocument()));
    },
    [commitActiveField, getDocument, setSession],
  );

  const setComposing = useCallback(
    (composing: boolean) => {
      const session = fieldSessionRef.current;
      if (!session) return;
      const next = setForm2UnderstandingFieldComposing(session, composing);
      if (!composing && session.commitOnCompositionEnd) {
        setSession({ ...next, composing: false });
        commitActiveField({ force: true });
        return;
      }
      setSession(next);
    },
    [commitActiveField, setSession],
  );

  const undo = useCallback(() => {
    const result = undoForm2UnderstandingHistory(historyRef.current);
    commitHistory(result.history);
    return { snapshot: result.snapshot, reason: result.reason };
  }, [commitHistory]);

  const redo = useCallback(() => {
    const result = redoForm2UnderstandingHistory(historyRef.current);
    commitHistory(result.history);
    return { snapshot: result.snapshot, reason: result.reason };
  }, [commitHistory]);

  const clear = useCallback(() => {
    commitHistory(clearForm2UnderstandingHistory());
    setSession(null);
  }, [commitHistory, setSession]);

  const beginRestore = useCallback(() => {
    restoringRef.current = true;
    setSession(null);
  }, [setSession]);

  const endRestore = useCallback(() => {
    restoringRef.current = false;
  }, []);

  const runUndoIntent = useCallback(
    (restore: (snapshot: Form2UnderstandingDocument) => void) => {
      if (intentGuardRef.current) return;
      intentGuardRef.current = true;
      try {
        commitActiveField({ force: true });
        const result = undo();
        if (!result.snapshot) return;
        beginRestore();
        try {
          restore(result.snapshot);
        } finally {
          endRestore();
        }
      } finally {
        queueMicrotask(() => {
          intentGuardRef.current = false;
        });
      }
    },
    [beginRestore, commitActiveField, endRestore, undo],
  );

  const runRedoIntent = useCallback(
    (restore: (snapshot: Form2UnderstandingDocument) => void) => {
      if (intentGuardRef.current) return;
      intentGuardRef.current = true;
      try {
        commitActiveField({ force: true });
        const result = redo();
        if (!result.snapshot) return;
        beginRestore();
        try {
          restore(result.snapshot);
        } finally {
          endRestore();
        }
      } finally {
        queueMicrotask(() => {
          intentGuardRef.current = false;
        });
      }
    },
    [beginRestore, commitActiveField, endRestore, redo],
  );

  const pendingFieldEdit = Boolean(
    fieldSession &&
      !form2UnderstandingEqualForHistory(fieldSession.before, getDocument()),
  );

  const controlsDisabled = useCallback(
    () => form2UnderstandingUndoRedoDisabled(historyRef.current, pendingFieldEdit),
    [pendingFieldEdit],
  );

  return {
    history,
    fieldSession,
    pendingFieldEdit,
    canUndo: canUndoForm2UnderstandingHistory(history) || pendingFieldEdit,
    canRedo: canRedoForm2UnderstandingHistory(history),
    beginField,
    commitActiveField,
    setComposing,
    undo,
    redo,
    clear,
    beginRestore,
    endRestore,
    runUndoIntent,
    runRedoIntent,
    controlsDisabled,
    restoringRef,
  };
}
