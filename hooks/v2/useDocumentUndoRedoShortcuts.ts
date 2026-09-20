"use client";

import { useEffect, useRef } from "react";
import { resolveDocumentUndoRedoShortcut } from "@/lib/v2/history/documentUndoRedoShortcuts";

export type UseDocumentUndoRedoShortcutsArgs = {
  enabled: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
};

/**
 * Document-level student Undo/Redo shortcuts.
 * Leaves native textarea/input Undo alone. Does not own history.
 */
export function useDocumentUndoRedoShortcuts({
  enabled,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: UseDocumentUndoRedoShortcutsArgs) {
  const latestRef = useRef({ enabled, canUndo, canRedo, onUndo, onRedo });
  latestRef.current = { enabled, canUndo, canRedo, onUndo, onRedo };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const result = resolveDocumentUndoRedoShortcut({
        event,
        enabled: latestRef.current.enabled,
        canUndo: latestRef.current.canUndo,
        canRedo: latestRef.current.canRedo,
        target: event.target,
      });
      if (result.preventDefault) event.preventDefault();
      if (result.action === "undo") latestRef.current.onUndo();
      if (result.action === "redo") latestRef.current.onRedo();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
