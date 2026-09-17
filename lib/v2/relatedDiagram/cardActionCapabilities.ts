/**
 * Slice 2B-2A — action capability matrix.
 * Card type, origin, and state stay independent.
 * Origin must not infer semantic type; state must not infer origin.
 */

import type {
  RelatedDiagramCard,
  RelatedDiagramCardOrigin,
  RelatedDiagramCardType,
} from "./types";

export type CardEditMode =
  | "forbidden_original"
  | "card_text_and_state"
  | "diagram_display_only"
  | "deferred";

export type CardDeletePolicy = "allowed" | "deferred" | "blocked_connected";

export type CardActionCapabilities = {
  canEdit: boolean;
  canConnect: boolean;
  canDelete: boolean;
  editMode: CardEditMode;
  deletePolicy: CardDeletePolicy;
};

export function getCardActionCapabilities(card: {
  cardType: RelatedDiagramCardType;
  origin: RelatedDiagramCardOrigin;
  state: RelatedDiagramCard["state"];
}): CardActionCapabilities {
  if (card.cardType === "information") {
    return {
      canEdit: false,
      canConnect: true,
      canDelete: true,
      editMode: "forbidden_original",
      deletePolicy: "allowed",
    };
  }
  if (card.cardType === "knowledge") {
    return {
      canEdit: true,
      canConnect: true,
      canDelete: true,
      editMode: "diagram_display_only",
      deletePolicy: "allowed",
    };
  }
  if (card.cardType === "nursing_problem") {
    return {
      canEdit: true,
      canConnect: true,
      canDelete: true,
      editMode: "card_text_and_state",
      deletePolicy: "allowed",
    };
  }
  return {
    canEdit: true,
    canConnect: true,
    canDelete: true,
    editMode: "card_text_and_state",
    deletePolicy: "allowed",
  };
}

export function assessmentUnderstandingKeepsProvenance(): readonly string[] {
  return [
    "sourceExcerpt",
    "selectedText",
    "selectionStart",
    "selectionEnd",
    "assessmentId",
  ];
}
