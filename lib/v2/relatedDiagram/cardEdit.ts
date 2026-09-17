/**
 * Slice 2B-2B — Card display edit. Does not mutate Form3 / Knowledge Library.
 */

import { getCardActionCapabilities } from "./cardActionCapabilities";
import type {
  RelatedDiagramCard,
  RelatedDiagramCardState,
  RelatedDiagramSemanticGraph,
} from "./types";

export type CardEditDraft = {
  text: string;
  state: RelatedDiagramCardState | null;
};

export function cardEditDraftFromCard(card: RelatedDiagramCard): CardEditDraft {
  return { text: card.text, state: card.state };
}

export function canCommitCardEdit(
  card: RelatedDiagramCard,
  draft: CardEditDraft,
): boolean {
  const caps = getCardActionCapabilities(card);
  if (!caps.canEdit) return false;
  if (draft.text.trim() === "") return false;
  if (caps.editMode === "card_text_and_state") {
    return draft.state === "current" || draft.state === "potential";
  }
  return true;
}

export function applyCardDisplayEdit(
  card: RelatedDiagramCard,
  draft: CardEditDraft,
  now = "2026-09-16T12:00:00.000Z",
): RelatedDiagramCard | null {
  if (!canCommitCardEdit(card, draft)) return null;
  const caps = getCardActionCapabilities(card);
  if (caps.editMode === "diagram_display_only") {
    return {
      ...card,
      text: draft.text.trim(),
      state: null,
      updatedAt: now,
    };
  }
  return {
    ...card,
    text: draft.text.trim(),
    state: draft.state,
    updatedAt: now,
  };
}

export function patchCardInGraph(
  graph: RelatedDiagramSemanticGraph,
  card: RelatedDiagramCard,
): RelatedDiagramSemanticGraph {
  if (!graph.cards.some((row) => row.id === card.id)) return graph;
  return {
    ...graph,
    cards: graph.cards.map((row) => (row.id === card.id ? card : row)),
  };
}
