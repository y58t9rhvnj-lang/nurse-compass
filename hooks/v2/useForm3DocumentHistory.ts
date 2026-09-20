"use client";

import { useCallback, useRef, useState } from "react";
import {
  canRedoForm3DocumentHistory,
  canUndoForm3DocumentHistory,
  clearForm3DocumentHistory,
  emptyForm3DocumentHistory,
  form3HistorySessionKey,
  form3RestoreAutosaveReason,
  form3UndoRedoDisabled,
  pushForm3DocumentHistory,
  redoForm3DocumentHistory,
  undoForm3DocumentHistory,
  type Form3DocumentHistory,
  type Form3HistoryControlLock,
} from "@/lib/form3/v2/form3DocumentHistory";
import type { Form3V2AutosaveReason } from "@/lib/form3/v2/form3V2AutosaveReasons";
import type { Form3DataV2 } from "@/lib/form3/v2/form3V2Types";

export type UseForm3DocumentHistoryArgs = {
  patientId: string;
  userId?: string;
};

/**
 * Session-local Form3 document history.
 * Does not call save APIs. Caller restores via markUserEditedV2.
 */
export function useForm3DocumentHistory({
  patientId,
  userId = "",
}: UseForm3DocumentHistoryArgs) {
  const sessionKey = form3HistorySessionKey(patientId, userId);
  const sessionKeyRef = useRef(sessionKey);
  const restoringRef = useRef(false);
  const [history, setHistory] = useState<Form3DocumentHistory>(() =>
    emptyForm3DocumentHistory(),
  );
  const historyRef = useRef(history);

  if (sessionKeyRef.current !== sessionKey) {
    sessionKeyRef.current = sessionKey;
    const cleared = clearForm3DocumentHistory();
    historyRef.current = cleared;
    setHistory(cleared);
  }

  const commit = useCallback((next: Form3DocumentHistory) => {
    historyRef.current = next;
    setHistory(next);
  }, []);

  const record = useCallback(
    (before: Form3DataV2, after: Form3DataV2, reason?: string) => {
      if (restoringRef.current) return;
      commit(
        pushForm3DocumentHistory(historyRef.current, { before, after, reason }),
      );
    },
    [commit],
  );

  const undo = useCallback(() => {
    const result = undoForm3DocumentHistory(historyRef.current);
    commit(result.history);
    return {
      snapshot: result.snapshot,
      reason: form3RestoreAutosaveReason(result.reason),
    };
  }, [commit]);

  const redo = useCallback(() => {
    const result = redoForm3DocumentHistory(historyRef.current);
    commit(result.history);
    return {
      snapshot: result.snapshot,
      reason: form3RestoreAutosaveReason(result.reason),
    };
  }, [commit]);

  const clear = useCallback(() => {
    commit(clearForm3DocumentHistory());
  }, [commit]);

  const beginRestore = useCallback(() => {
    restoringRef.current = true;
  }, []);

  const endRestore = useCallback(() => {
    restoringRef.current = false;
  }, []);

  const controlsDisabled = useCallback(
    (lock: Form3HistoryControlLock) =>
      form3UndoRedoDisabled(historyRef.current, lock),
    [],
  );

  return {
    history,
    canUndo: canUndoForm3DocumentHistory(history),
    canRedo: canRedoForm3DocumentHistory(history),
    record,
    undo,
    redo,
    clear,
    beginRestore,
    endRestore,
    controlsDisabled,
    restoringRef,
  };
}

export type Form3HistoryRestore = {
  snapshot: Form3DataV2 | null;
  reason: Form3V2AutosaveReason;
};
