/**
 * Slice 2B-2C — Context Bar model. Card / connecting / connection.
 * Connection actions are typed only; no Connection edit UI this slice.
 */

import type { CardActionCapabilities } from "./cardActionCapabilities";
import type { RelatedDiagramEditorMode } from "./editorUiState";

export type ContextBarKind = "none" | "card" | "connecting" | "connection";

export type CardContextBarModel = {
  kind: "card";
  cardId: string;
  title: string;
  capabilities: CardActionCapabilities;
  canOpenSource: boolean;
  editDisabledReason?: string | null;
};

export type ConnectingContextBarModel = {
  kind: "connecting";
  sourceCardId: string;
  sourceTitle: string;
};

export type ConnectionContextBarModel = {
  kind: "connection";
  connectionId: string;
};

export type ContextBarModel =
  | { kind: "none" }
  | CardContextBarModel
  | ConnectingContextBarModel
  | ConnectionContextBarModel;

export function contextBarKindFromMode(
  mode: RelatedDiagramEditorMode,
  hasCardContext: boolean,
): ContextBarKind {
  if (mode === "connecting") return "connecting";
  if (mode === "connection_selected") return "connection";
  if (hasCardContext) return "card";
  return "none";
}

export function truncateContextTitle(text: string, max = 40): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

export type VisibleContextAction = "edit" | "connect" | "delete" | "source";

export function visibleContextActions(
  capabilities: CardActionCapabilities,
  canOpenSource: boolean,
): VisibleContextAction[] {
  const actions: VisibleContextAction[] = [];
  if (capabilities.canEdit) actions.push("edit");
  if (capabilities.canConnect) actions.push("connect");
  if (capabilities.canDelete) actions.push("delete");
  if (canOpenSource) actions.push("source");
  return actions;
}
