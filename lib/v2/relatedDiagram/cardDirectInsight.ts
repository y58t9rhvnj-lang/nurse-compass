/**
 * Slice 2B-2D — Direct Insight Understanding Card.
 * Student-authored patient understanding on the Related Diagram.
 * No Form3 / Knowledge / Information provenance.
 */

import {
  UNDERSTANDING_CARD_HEIGHT,
  UNDERSTANDING_CARD_WIDTH,
  type CardEntitySnapshot,
} from "./form3ToUnderstandingCard";
import type {
  RelatedDiagramCard,
  RelatedDiagramCardState,
} from "./types";

export const DIRECT_INSIGHT_ORIGIN = "direct_insight" as const;
export const DIRECT_INSIGHT_LABEL = "関連図での新しい気づき";

export type DirectInsightComposeDraft = {
  text: string;
  state: RelatedDiagramCardState | null;
};

export function emptyDirectInsightComposeDraft(): DirectInsightComposeDraft {
  return { text: "", state: null };
}

export function canCommitDirectInsightCompose(
  draft: DirectInsightComposeDraft,
): boolean {
  if (draft.text.trim() === "") return false;
  return draft.state === "current" || draft.state === "potential";
}

export function newDirectInsightCardId(now = Date.now()): string {
  return `di_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function buildDirectInsightCard(input: {
  text: string;
  state: RelatedDiagramCardState;
  layout: { x: number; y: number; zIndex: number };
  cardId?: string;
  now?: string;
}): CardEntitySnapshot {
  const ts = input.now ?? "2026-09-17T00:00:00.000Z";
  const card: RelatedDiagramCard = {
    id: input.cardId ?? newDirectInsightCardId(),
    cardType: "understanding",
    text: input.text.trim(),
    state: input.state,
    origin: DIRECT_INSIGHT_ORIGIN,
    layout: {
      x: input.layout.x,
      y: input.layout.y,
      width: UNDERSTANDING_CARD_WIDTH,
      height: UNDERSTANDING_CARD_HEIGHT,
      zIndex: input.layout.zIndex,
    },
    isLocked: false,
    createdAt: ts,
    updatedAt: ts,
  };
  return { card, sources: [] };
}
