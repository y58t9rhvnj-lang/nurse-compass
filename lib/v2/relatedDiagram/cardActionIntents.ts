/**
 * Slice 2B-2A — action intents only.
 * No edit apply, no connection create, no card delete.
 */

import {
  getCardActionCapabilities,
  type CardDeletePolicy,
  type CardEditMode,
} from "./cardActionCapabilities";
import type {
  RelatedDiagramCard,
  RelatedDiagramCardOrigin,
  RelatedDiagramCardType,
} from "./types";

export type CardEditIntent = {
  kind: "edit";
  cardId: string;
  editMode: CardEditMode;
};

export type CardConnectIntent = {
  kind: "connect";
  sourceCardId: string;
};

export type CardDeleteIntent = {
  kind: "delete";
  cardId: string;
  deletePolicy: CardDeletePolicy;
};

export type CardActionIntent =
  | CardEditIntent
  | CardConnectIntent
  | CardDeleteIntent;

type CapabilityCard = {
  id: string;
  cardType: RelatedDiagramCardType;
  origin: RelatedDiagramCardOrigin;
  state: RelatedDiagramCard["state"];
};

export function createCardEditIntent(
  card: CapabilityCard,
): CardEditIntent | null {
  const caps = getCardActionCapabilities(card);
  if (!caps.canEdit) return null;
  return { kind: "edit", cardId: card.id, editMode: caps.editMode };
}

export function createCardConnectIntent(
  card: CapabilityCard,
): CardConnectIntent | null {
  const caps = getCardActionCapabilities(card);
  if (!caps.canConnect) return null;
  return { kind: "connect", sourceCardId: card.id };
}

export function createCardDeleteIntent(
  card: CapabilityCard,
): CardDeleteIntent | null {
  const caps = getCardActionCapabilities(card);
  if (!caps.canDelete) return null;
  return { kind: "delete", cardId: card.id, deletePolicy: caps.deletePolicy };
}
