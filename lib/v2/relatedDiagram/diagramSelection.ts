/**
 * Slice 2B-2A — formal Editor selection.
 * Interaction machine may keep selectedCardId for tap/drag;
 * Editor UI must use DiagramSelection, not selectedCardId as the model.
 */

export type DiagramSelection =
  | { kind: "none" }
  | { kind: "card"; cardId: string }
  | { kind: "connection"; connectionId: string };

export function emptyDiagramSelection(): DiagramSelection {
  return { kind: "none" };
}

export function cardDiagramSelection(cardId: string): DiagramSelection {
  return { kind: "card", cardId };
}

export function selectionFromCardId(
  cardId: string | null | undefined,
): DiagramSelection {
  if (!cardId) return { kind: "none" };
  return { kind: "card", cardId };
}

export function selectedCardIdFromSelection(
  selection: DiagramSelection,
): string | null {
  return selection.kind === "card" ? selection.cardId : null;
}

export function isCardSelected(
  selection: DiagramSelection,
  cardId: string,
): boolean {
  return selection.kind === "card" && selection.cardId === cardId;
}

/** Connection selection is typed only. Slice 2B-2A does not activate it. */
export function connectionSelectionReady(_connectionId: string): boolean {
  return false;
}

export function isRelatedDiagramSelectionPreserveTarget(
  target: EventTarget | null,
): boolean {
  if (target == null || typeof target !== "object") return false;
  const el = target as { closest?: (selector: string) => unknown };
  if (typeof el.closest !== "function") return false;
  return Boolean(
    el.closest("[data-rd-form3-drawer]") ||
      el.closest("[data-rd-form3-source-trace]") ||
      el.closest("[data-rd-card-action-bar]") ||
      el.closest("[data-rd-context-bar]") ||
      el.closest("[data-rd-editor-drawer]") ||
      el.closest("[data-rd-card-edit-drawer]") ||
      el.closest("[data-rd-card-delete-confirm]") ||
      el.closest("[data-rd-toolbar]") ||
      el.closest("[data-rd-form3-compose]") ||
      el.closest("[data-rd-insight-compose]") ||
      el.closest("[data-rd-relation-compose]") ||
      el.closest("[data-rd-action-popover]") ||
      el.closest("[data-rd-connecting-hint]") ||
      el.closest("textarea") ||
      el.closest("input") ||
      el.closest("select"),
  );
}
