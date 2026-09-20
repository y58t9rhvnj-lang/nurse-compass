"use client";

import { useCallback, useRef, useState } from "react";
import {
  applyForm2FieldEditCommit,
  beginForm2FieldEditSession,
  canRedoForm2DocumentHistory,
  canUndoForm2DocumentHistory,
  clearForm2DocumentHistory,
  emptyForm2DocumentHistory,
  form2DataEqualForHistory,
  form2HistorySessionKey,
  form2UndoRedoDisabled,
  redoForm2DocumentHistory,
  setForm2FieldComposing,
  undoForm2DocumentHistory,
  type Form2DocumentHistory,
  type Form2FieldEditSession,
  type Form2HistoryControlLock,
} from "@/lib/form2/form2DocumentHistory";
import type { Form2Data } from "@/lib/form2/form2Types";

export type UseForm2DocumentHistoryArgs = {
  patientId: string;
  userId?: string;
  getData: () => Form2Data;
};

/**
 * Session-local Form2 document history + one field-edit session.
 * Does not call save APIs. Caller restores via onEdited.
 */
export function useForm2DocumentHistory({
  patientId,
  userId = "",
  getData,
}: UseForm2DocumentHistoryArgs) {
  const sessionKey = form2HistorySessionKey(patientId, userId);
  const sessionKeyRef = useRef(sessionKey);
  const restoringRef = useRef(false);
  const intentGuardRef = useRef(false);
  const [history, setHistory] = useState<Form2DocumentHistory>(() =>
    emptyForm2DocumentHistory(),
  );
  const historyRef = useRef(history);
  const [fieldSession, setFieldSession] = useState<Form2FieldEditSession | null>(
    null,
  );
  const fieldSessionRef = useRef<Form2FieldEditSession | null>(null);

  if (sessionKeyRef.current !== sessionKey) {
    sessionKeyRef.current = sessionKey;
    const cleared = clearForm2DocumentHistory();
    historyRef.current = cleared;
    fieldSessionRef.current = null;
    setHistory(cleared);
    setFieldSession(null);
  }

  const commitHistory = useCallback((next: Form2DocumentHistory) => {
    historyRef.current = next;
    setHistory(next);
  }, []);

  const setSession = useCallback((next: Form2FieldEditSession | null) => {
    fieldSessionRef.current = next;
    setFieldSession(next);
  }, []);

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
      const after = getData();
      const result = applyForm2FieldEditCommit(
        historyRef.current,
        session,
        after,
        options,
      );
      commitHistory(result.history);
      setSession(null);
      return result.committed;
    },
    [commitHistory, getData, setSession],
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
      setSession(beginForm2FieldEditSession(fieldId, getData()));
    },
    [commitActiveField, getData, setSession],
  );

  const setComposing = useCallback(
    (composing: boolean) => {
      const session = fieldSessionRef.current;
      if (!session) return;
      const next = setForm2FieldComposing(session, composing);
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
    const result = undoForm2DocumentHistory(historyRef.current);
    commitHistory(result.history);
    return { snapshot: result.snapshot, reason: result.reason };
  }, [commitHistory]);

  const redo = useCallback(() => {
    const result = redoForm2DocumentHistory(historyRef.current);
    commitHistory(result.history);
    return { snapshot: result.snapshot, reason: result.reason };
  }, [commitHistory]);

  const clear = useCallback(() => {
    commitHistory(clearForm2DocumentHistory());
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
    (restore: (snapshot: Form2Data) => void) => {
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
    (restore: (snapshot: Form2Data) => void) => {
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
    fieldSession && !form2DataEqualForHistory(fieldSession.before, getData()),
  );

  const controlsDisabled = useCallback(
    (lock: Form2HistoryControlLock) =>
      form2UndoRedoDisabled(historyRef.current, lock, pendingFieldEdit),
    [pendingFieldEdit],
  );

  return {
    history,
    fieldSession,
    pendingFieldEdit,
    canUndo: canUndoForm2DocumentHistory(history) || pendingFieldEdit,
    canRedo: canRedoForm2DocumentHistory(history),
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
