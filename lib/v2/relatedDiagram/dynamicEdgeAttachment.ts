/**
 * Route geometry metadata only. Edges are not semantic.
 * Flip only when the opposite side is clearly better (hysteresis).
 */

import {
  cardCenter,
  chooseCardEdges,
  type EdgeSide,
} from "./orthogonalRouting";
import type { RelatedDiagramCard } from "./types";

export const EDGE_HYSTERESIS = 1.4;

const OPPOSITE: Record<EdgeSide, EdgeSide> = {
  top: "bottom",
  bottom: "top",
  left: "right",
  right: "left",
};

export function oppositeEdge(side: EdgeSide): EdgeSide {
  return OPPOSITE[side];
}

function axisOf(side: EdgeSide): "h" | "v" {
  return side === "left" || side === "right" ? "h" : "v";
}

function clearlyDominant(
  source: RelatedDiagramCard,
  target: RelatedDiagramCard,
  preferred: { sourceEdge: EdgeSide; targetEdge: EdgeSide },
): boolean {
  const s = cardCenter(source);
  const t = cardCenter(target);
  const dx = Math.abs(t.x - s.x);
  const dy = Math.abs(t.y - s.y);
  if (axisOf(preferred.sourceEdge) === "h") {
    return dx >= dy * EDGE_HYSTERESIS;
  }
  return dy >= dx * EDGE_HYSTERESIS;
}

function fullyOppositeSide(
  source: RelatedDiagramCard,
  target: RelatedDiagramCard,
  current: { sourceEdge: EdgeSide; targetEdge: EdgeSide },
): boolean {
  const t = cardCenter(target);
  if (current.sourceEdge === "right" && t.x < source.layout.x) return true;
  if (current.sourceEdge === "left" && t.x > source.layout.x + source.layout.width) {
    return true;
  }
  if (current.sourceEdge === "bottom" && t.y < source.layout.y) return true;
  if (current.sourceEdge === "top" && t.y > source.layout.y + source.layout.height) {
    return true;
  }
  return false;
}

export function chooseEdgesWithHysteresis(
  source: RelatedDiagramCard,
  target: RelatedDiagramCard,
  current?: { sourceEdge: EdgeSide; targetEdge: EdgeSide },
): { sourceEdge: EdgeSide; targetEdge: EdgeSide; flipped: boolean } {
  const preferred = chooseCardEdges(source, target);
  if (!current) return { ...preferred, flipped: false };
  if (
    current.sourceEdge === preferred.sourceEdge &&
    current.targetEdge === preferred.targetEdge
  ) {
    return { ...current, flipped: false };
  }
  const opposite =
    current.sourceEdge === oppositeEdge(preferred.sourceEdge) &&
    current.targetEdge === oppositeEdge(preferred.targetEdge);
  if (
    (opposite &&
      (clearlyDominant(source, target, preferred) ||
        fullyOppositeSide(source, target, current))) ||
    (!opposite && clearlyDominant(source, target, preferred))
  ) {
    return { ...preferred, flipped: true };
  }
  return { ...current, flipped: false };
}

export function chooseAnchorFacingEdge(
  from: { x: number; y: number },
  card: RelatedDiagramCard,
  current?: EdgeSide,
): { edge: EdgeSide; flipped: boolean } {
  const c = cardCenter(card);
  const dx = c.x - from.x;
  const dy = c.y - from.y;
  const preferred: EdgeSide =
    Math.abs(dx) >= Math.abs(dy)
      ? dx >= 0
        ? "left"
        : "right"
      : dy >= 0
        ? "top"
        : "bottom";
  if (!current || current === preferred) {
    return { edge: preferred, flipped: false };
  }
  const opposite = current === oppositeEdge(preferred);
  const dominant =
    axisOf(preferred) === "h"
      ? Math.abs(dx) >= Math.abs(dy) * EDGE_HYSTERESIS
      : Math.abs(dy) >= Math.abs(dx) * EDGE_HYSTERESIS;
  if (opposite && dominant) return { edge: preferred, flipped: true };
  return { edge: current, flipped: false };
}
