/**
 * Shared student document Undo/Redo keyboard contract.
 * Does not own history stacks or call save APIs.
 */

export type DocumentUndoRedoShortcutAction = "undo" | "redo";

export type DocumentUndoRedoShortcutEvent = {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  repeat?: boolean;
  isComposing?: boolean;
  keyCode?: number;
};

export type EditableTargetLike = {
  tagName?: string;
  isContentEditable?: boolean;
  closest?: (selector: string) => unknown;
  parentElement?: EditableTargetLike | null;
};

export type ResolveDocumentUndoRedoShortcutInput = {
  event: DocumentUndoRedoShortcutEvent;
  enabled: boolean;
  canUndo: boolean;
  canRedo: boolean;
  target?: unknown;
};

export type ResolveDocumentUndoRedoShortcutResult = {
  action: DocumentUndoRedoShortcutAction | null;
  preventDefault: boolean;
};

const EDITABLE_SELECTOR =
  "input, textarea, [contenteditable]:not([contenteditable='false'])";

function asEditableNode(target: unknown): EditableTargetLike | null {
  if (!target || typeof target !== "object") return null;
  return target as EditableTargetLike;
}

export function isEditableUndoRedoTarget(target: unknown): boolean {
  let node = asEditableNode(target);
  while (node) {
    const tag = (node.tagName ?? "").toUpperCase();
    if (tag === "INPUT" || tag === "TEXTAREA") return true;
    if (node.isContentEditable === true) return true;
    if (typeof node.closest === "function") {
      try {
        if (node.closest(EDITABLE_SELECTOR)) return true;
      } catch {
        // ignore non-DOM mocks
      }
    }
    node = node.parentElement ?? null;
  }
  return false;
}

export function isDocumentUndoShortcut(
  event: DocumentUndoRedoShortcutEvent,
): boolean {
  const key = event.key.toLowerCase();
  const cmdOrCtrl = Boolean(event.metaKey || event.ctrlKey);
  return (
    cmdOrCtrl &&
    !event.altKey &&
    key === "z" &&
    !event.shiftKey
  );
}

export function isDocumentRedoShortcut(
  event: DocumentUndoRedoShortcutEvent,
): boolean {
  const key = event.key.toLowerCase();
  const cmdOrCtrl = Boolean(event.metaKey || event.ctrlKey);
  if (!cmdOrCtrl || event.altKey) return false;
  if (key === "z" && event.shiftKey) return true;
  return Boolean(event.ctrlKey && !event.metaKey && key === "y" && !event.shiftKey);
}

function isComposingEvent(event: DocumentUndoRedoShortcutEvent): boolean {
  return event.isComposing === true || event.keyCode === 229;
}

export function resolveDocumentUndoRedoShortcut(
  input: ResolveDocumentUndoRedoShortcutInput,
): ResolveDocumentUndoRedoShortcutResult {
  const none = { action: null, preventDefault: false };
  const event = input.event;
  if (!input.enabled) return none;
  if (event.repeat) return none;
  if (isComposingEvent(event)) return none;
  if (isEditableUndoRedoTarget(input.target)) return none;

  if (isDocumentUndoShortcut(event)) {
    if (!input.canUndo) return none;
    return { action: "undo", preventDefault: true };
  }
  if (isDocumentRedoShortcut(event)) {
    if (!input.canRedo) return none;
    return { action: "redo", preventDefault: true };
  }
  return none;
}
