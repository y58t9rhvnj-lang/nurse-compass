/**
 * Slice 2B-2F-1 — safe Direct Card placement.
 * Does not move existing cards, reroute connections, or shrink A3.
 */

import { A3_HEIGHT_PX, A3_WIDTH_PX } from "./a3Canvas";
import { resolveCardDropPosition, type CardRect } from "./a3CardBoundary";
import {
  CARD_MIN_GAP,
  isLegalCardPlacement,
  resolveCardDropCollision,
} from "./cardCollision";
import {
  UNDERSTANDING_CARD_HEIGHT,
  UNDERSTANDING_CARD_WIDTH,
} from "./form3ToUnderstandingCard";
import { a3CenterPoint, topLeftFromCenter } from "./placeForm3UnderstandingCard";
import type { RelatedDiagramCard } from "./types";

export const DIRECT_CARD_GLOBAL_SEARCH_STEP_PX = 20;

export type DirectCardPlacementStage =
  | "viewport_center"
  | "local_search"
  | "global_search";

export type DirectCardPlacementResult =
  | {
      ok: true;
      x: number;
      y: number;
      stage: DirectCardPlacementStage;
    }
  | {
      ok: false;
      reason: "no_space";
    };

function placementSize(size?: { width: number; height: number }): {
  width: number;
  height: number;
} {
  return (
    size ?? {
      width: UNDERSTANDING_CARD_WIDTH,
      height: UNDERSTANDING_CARD_HEIGHT,
    }
  );
}

function legalOptions(input: {
  canvasWidth: number;
  canvasHeight: number;
  minGap: number;
}): {
  canvasWidth: number;
  canvasHeight: number;
  minGap: number;
} {
  return {
    canvasWidth: input.canvasWidth,
    canvasHeight: input.canvasHeight,
    minGap: input.minGap,
  };
}

function desiredTopLeft(input: {
  desiredCenter?: { x: number; y: number };
  size: { width: number; height: number };
  canvasWidth: number;
  canvasHeight: number;
}): CardRect {
  const center =
    input.desiredCenter ?? a3CenterPoint(input.canvasWidth, input.canvasHeight);
  const raw = topLeftFromCenter(center, input.size);
  return resolveCardDropPosition(
    { ...raw, ...input.size },
    input.canvasWidth,
    input.canvasHeight,
  );
}

function gridStops(max: number, step: number): number[] {
  if (max < 0) return [];
  const out: number[] = [];
  for (let value = 0; value <= max; value += step) {
    out.push(value);
  }
  if (out[out.length - 1] !== max) out.push(max);
  return out;
}

function candidateDistance(
  a: { x: number; y: number },
  origin: { x: number; y: number },
): number {
  return Math.hypot(a.x - origin.x, a.y - origin.y);
}

export function searchDirectCardFreeSpace(input: {
  origin: { x: number; y: number };
  size: { width: number; height: number };
  otherCards: RelatedDiagramCard[];
  canvasWidth?: number;
  canvasHeight?: number;
  minGap?: number;
  stepPx?: number;
}): { x: number; y: number } | null {
  const canvasWidth = input.canvasWidth ?? A3_WIDTH_PX;
  const canvasHeight = input.canvasHeight ?? A3_HEIGHT_PX;
  const minGap = input.minGap ?? CARD_MIN_GAP;
  const step = input.stepPx ?? DIRECT_CARD_GLOBAL_SEARCH_STEP_PX;
  const maxX = canvasWidth - input.size.width;
  const maxY = canvasHeight - input.size.height;
  const xs = gridStops(maxX, step);
  const ys = gridStops(maxY, step);
  const legal: Array<{ x: number; y: number }> = [];
  const options = legalOptions({ canvasWidth, canvasHeight, minGap });
  for (const y of ys) {
    for (const x of xs) {
      const rect = {
        x,
        y,
        width: input.size.width,
        height: input.size.height,
      };
      if (!isLegalCardPlacement(rect, input.otherCards, options)) continue;
      legal.push({ x, y });
    }
  }
  if (legal.length === 0) return null;
  legal.sort((a, b) => {
    const da = candidateDistance(a, input.origin);
    const db = candidateDistance(b, input.origin);
    if (da !== db) return da - db;
    const ma = Math.abs(a.x - input.origin.x) + Math.abs(a.y - input.origin.y);
    const mb = Math.abs(b.x - input.origin.x) + Math.abs(b.y - input.origin.y);
    if (ma !== mb) return ma - mb;
    if (a.x !== b.x) return a.x - b.x;
    return a.y - b.y;
  });
  return legal[0] ?? null;
}

export function placeDirectCard(input: {
  desiredCenter?: { x: number; y: number };
  otherCards: RelatedDiagramCard[];
  canvasWidth?: number;
  canvasHeight?: number;
  size?: { width: number; height: number };
  minGap?: number;
}): DirectCardPlacementResult {
  const canvasWidth = input.canvasWidth ?? A3_WIDTH_PX;
  const canvasHeight = input.canvasHeight ?? A3_HEIGHT_PX;
  const minGap = input.minGap ?? CARD_MIN_GAP;
  const size = placementSize(input.size);
  const options = legalOptions({ canvasWidth, canvasHeight, minGap });
  const desired = desiredTopLeft({
    desiredCenter: input.desiredCenter,
    size,
    canvasWidth,
    canvasHeight,
  });

  if (isLegalCardPlacement(desired, input.otherCards, options)) {
    return {
      ok: true,
      x: desired.x,
      y: desired.y,
      stage: "viewport_center",
    };
  }

  const local = resolveCardDropCollision({
    movingCard: {
      id: "__direct_place__",
      x: desired.x,
      y: desired.y,
      width: size.width,
      height: size.height,
    },
    desiredPosition: { x: desired.x, y: desired.y },
    otherCards: input.otherCards,
    lastLegal: { x: desired.x, y: desired.y },
    canvasWidth,
    canvasHeight,
    minGap,
  });
  const localRect = {
    x: local.position.x,
    y: local.position.y,
    width: size.width,
    height: size.height,
  };
  if (
    local.resolution !== "last_legal" &&
    isLegalCardPlacement(localRect, input.otherCards, options)
  ) {
    return {
      ok: true,
      x: local.position.x,
      y: local.position.y,
      stage: "local_search",
    };
  }

  const global = searchDirectCardFreeSpace({
    origin: { x: desired.x, y: desired.y },
    size,
    otherCards: input.otherCards,
    canvasWidth,
    canvasHeight,
    minGap,
  });
  if (
    global &&
    isLegalCardPlacement(
      { ...global, width: size.width, height: size.height },
      input.otherCards,
      options,
    )
  ) {
    return {
      ok: true,
      x: global.x,
      y: global.y,
      stage: "global_search",
    };
  }

  return { ok: false, reason: "no_space" };
}
