/**
 * Knowledge foundation bounding box + group drag clamp (Slice 2A).
 */

import { A3_HEIGHT_PX, A3_WIDTH_PX } from "./a3Canvas";
import {
  clampCardToA3,
  resolveCardDropPosition,
  type CardRect,
} from "./a3CardBoundary";
import type { RelatedDiagramCard } from "./types";

export const KNOWLEDGE_GROUP_HANDLE_HEIGHT_PX = 18;
export const KNOWLEDGE_GROUP_HANDLE_GAP_PX = 6;

export function knowledgeCardsOf(
  cards: RelatedDiagramCard[],
): RelatedDiagramCard[] {
  return cards.filter((c) => c.cardType === "knowledge");
}

export function knowledgeGroupBounds(
  cards: RelatedDiagramCard[],
): CardRect | null {
  const ks = knowledgeCardsOf(cards);
  if (ks.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const c of ks) {
    minX = Math.min(minX, c.layout.x);
    minY = Math.min(minY, c.layout.y);
    maxX = Math.max(maxX, c.layout.x + c.layout.width);
    maxY = Math.max(maxY, c.layout.y + c.layout.height);
  }
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function knowledgeGroupHandleBounds(bbox: CardRect): CardRect {
  return {
    x: bbox.x,
    y: Math.max(0, bbox.y - KNOWLEDGE_GROUP_HANDLE_HEIGHT_PX - KNOWLEDGE_GROUP_HANDLE_GAP_PX),
    width: 44,
    height: KNOWLEDGE_GROUP_HANDLE_HEIGHT_PX,
  };
}

export function clampGroupDelta(
  bbox: CardRect,
  dx: number,
  dy: number,
  canvasWidth = A3_WIDTH_PX,
  canvasHeight = A3_HEIGHT_PX,
): { dx: number; dy: number } {
  const next = clampCardToA3(
    { ...bbox, x: bbox.x + dx, y: bbox.y + dy },
    canvasWidth,
    canvasHeight,
  );
  return { dx: next.x - bbox.x, dy: next.y - bbox.y };
}

/** Drop: Legend nudge then A3 clamp. Returns delta from the start bbox. */
export function resolveGroupDropDelta(
  bbox: CardRect,
  dx: number,
  dy: number,
  canvasWidth = A3_WIDTH_PX,
  canvasHeight = A3_HEIGHT_PX,
): { dx: number; dy: number } {
  const resolved = resolveCardDropPosition(
    { ...bbox, x: bbox.x + dx, y: bbox.y + dy },
    canvasWidth,
    canvasHeight,
  );
  return { dx: resolved.x - bbox.x, dy: resolved.y - bbox.y };
}

export function applyKnowledgeGroupDelta<
  T extends { cards: RelatedDiagramCard[] },
>(graph: T, dx: number, dy: number): T {
  if (dx === 0 && dy === 0) return graph;
  return {
    ...graph,
    cards: graph.cards.map((card) =>
      card.cardType === "knowledge"
        ? {
            ...card,
            layout: {
              ...card.layout,
              x: card.layout.x + dx,
              y: card.layout.y + dy,
            },
          }
        : card,
    ),
  };
}
