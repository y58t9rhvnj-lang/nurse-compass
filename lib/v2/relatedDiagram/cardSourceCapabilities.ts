/**
 * Slice 2B-2C — source navigation capability.
 * Does not mutate Form3 / Knowledge Library / provenance.
 */

import type {
  RelatedDiagramCard,
  RelatedDiagramCardOrigin,
} from "./types";

export type CardSourceKind = "form3" | "knowledge_library" | "none";

export type CardSourceCapabilities = {
  canOpenSource: boolean;
  sourceKind: CardSourceKind;
};

export function getCardSourceCapabilities(card: {
  origin: RelatedDiagramCardOrigin;
  cardType?: RelatedDiagramCard["cardType"];
}): CardSourceCapabilities {
  if (
    card.origin === "form3_information" ||
    card.origin === "form3_assessment"
  ) {
    return { canOpenSource: true, sourceKind: "form3" };
  }
  if (card.origin === "knowledge_library") {
    return { canOpenSource: false, sourceKind: "knowledge_library" };
  }
  return { canOpenSource: false, sourceKind: "none" };
}

export function cardShowsSourceAction(card: {
  origin: RelatedDiagramCardOrigin;
}): boolean {
  return getCardSourceCapabilities(card).canOpenSource;
}
