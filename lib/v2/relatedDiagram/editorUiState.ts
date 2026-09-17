/**
 * Slice 2B-2C — Editor chrome mode. UI only; not history.
 * Connection selected is a typed contract. Connection editing is not implemented.
 */

import type { DiagramSelection } from "./diagramSelection";

export type RelatedDiagramEditorMode =
  | "idle"
  | "card_selected"
  | "form3_reference"
  | "card_edit"
  | "connecting"
  | "connection_selected";

export type EditorChromeInput = {
  selection: DiagramSelection;
  form3Open: boolean;
  editOpen: boolean;
  connecting: boolean;
};

export function resolveRelatedDiagramEditorMode(
  input: EditorChromeInput,
): RelatedDiagramEditorMode {
  if (input.connecting) return "connecting";
  if (input.editOpen) return "card_edit";
  if (input.form3Open) return "form3_reference";
  if (input.selection.kind === "connection") return "connection_selected";
  if (input.selection.kind === "card") return "card_selected";
  return "idle";
}

export function editorModeIsDrawer(
  mode: RelatedDiagramEditorMode,
): boolean {
  return mode === "form3_reference" || mode === "card_edit";
}

export function editorModeBlocksDrawer(
  mode: RelatedDiagramEditorMode,
): boolean {
  return mode === "connecting";
}

export const EDITOR_DRAWER_WIDTH = "min(420px, 42vw)";
export const EDITOR_CONTEXT_BAR_HEIGHT_PX = 52;
export const EDITOR_TOOLBAR_HEIGHT_PX = 52;
export const EDITOR_TOUCH_TARGET_PX = 44;

export const EDITOR_ADD_CARD_PLACEHOLDER =
  "カード追加は次のSliceで実装します";
