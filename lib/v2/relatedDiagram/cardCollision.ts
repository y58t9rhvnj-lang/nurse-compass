/**
 * Drop-time card-vs-card collision. Drag-time overlap is allowed.
 * Only the moved object (card or Knowledge group) is translated.
 */

import { A3_HEIGHT_PX, A3_WIDTH_PX } from "./a3Canvas";
import {
  clampCardToA3,
  resolveCardDropPosition,
  type CardRect,
} from "./a3CardBoundary";
import { getA3LegendBounds, rectIntersectsA3Legend } from "./a3Legend";
import type { RelatedDiagramCard } from "./types";

export const CARD_MIN_GAP = 12;
const SEARCH_STEP_PX = 20;
const SEARCH_RINGS = 12;
const SEARCH_DIRS: Array<[number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

export type CollisionResolution =
  | "none"
  | "axis_escape"
  | "nearby_search"
  | "last_legal";

export type CardCollisionBody = CardRect & { id: string };

export type CardDropCollisionResult = {
  position: { x: number; y: number };
  collided: boolean;
  blockers: string[];
  resolution: CollisionResolution;
};

export type GroupDropCollisionResult = {
  dx: number;
  dy: number;
  collided: boolean;
  blockers: string[];
  resolution: CollisionResolution;
};

export function inflateRect(rect: CardRect, pad: number): CardRect {
  return {
    x: rect.x - pad,
    y: rect.y - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  };
}

export function rectsOverlap(a: CardRect, b: CardRect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

export function cardLayoutRect(card: RelatedDiagramCard): CardCollisionBody {
  return {
    id: card.id,
    x: card.layout.x,
    y: card.layout.y,
    width: card.layout.width,
    height: card.layout.height,
  };
}

export function collidingCards(
  moving: CardRect,
  others: CardCollisionBody[],
  minGap = CARD_MIN_GAP,
): CardCollisionBody[] {
  return others.filter((other) => rectsOverlap(moving, inflateRect(other, minGap)));
}

function insideCanvas(rect: CardRect, canvasWidth: number, canvasHeight: number): boolean {
  const clamped = clampCardToA3(rect, canvasWidth, canvasHeight);
  return clamped.x === rect.x && clamped.y === rect.y;
}

function isLegalRect(
  rect: CardRect,
  others: CardCollisionBody[],
  minGap: number,
  canvasWidth: number,
  canvasHeight: number,
): boolean {
  if (!insideCanvas(rect, canvasWidth, canvasHeight)) return false;
  if (rectIntersectsA3Legend(rect, canvasWidth, canvasHeight)) return false;
  return collidingCards(rect, others, minGap).length === 0;
}

export function isLegalCardPlacement(
  rect: CardRect,
  otherCards: Array<RelatedDiagramCard | CardCollisionBody>,
  options?: {
    minGap?: number;
    canvasWidth?: number;
    canvasHeight?: number;
  },
): boolean {
  const canvasWidth = options?.canvasWidth ?? A3_WIDTH_PX;
  const canvasHeight = options?.canvasHeight ?? A3_HEIGHT_PX;
  const minGap = options?.minGap ?? CARD_MIN_GAP;
  const others = otherCards.map((card) =>
    "layout" in card ? cardLayoutRect(card) : card,
  );
  return isLegalRect(rect, others, minGap, canvasWidth, canvasHeight);
}

function escapeCandidates(
  desired: CardRect,
  blockers: CardCollisionBody[],
  minGap: number,
): CardRect[] {
  const out: CardRect[] = [];
  for (const blocker of blockers) {
    const reserved = inflateRect(blocker, minGap);
    out.push({ ...desired, x: reserved.x - desired.width });
    out.push({ ...desired, x: reserved.x + reserved.width });
    out.push({ ...desired, y: reserved.y - desired.height });
    out.push({ ...desired, y: reserved.y + reserved.height });
  }
  return out;
}

function nearbyCandidates(desired: CardRect): CardRect[] {
  const out: CardRect[] = [];
  for (let ring = 1; ring <= SEARCH_RINGS; ring += 1) {
    const dist = ring * SEARCH_STEP_PX;
    for (const [sx, sy] of SEARCH_DIRS) {
      out.push({
        ...desired,
        x: desired.x + sx * dist,
        y: desired.y + sy * dist,
      });
    }
  }
  return out;
}

function candidateDistance(a: CardRect, origin: CardRect): number {
  return Math.hypot(a.x - origin.x, a.y - origin.y);
}

function pickNearestLegal(
  candidates: CardRect[],
  origin: CardRect,
  others: CardCollisionBody[],
  minGap: number,
  canvasWidth: number,
  canvasHeight: number,
): CardRect | null {
  const legal: CardRect[] = [];
  for (const raw of candidates) {
    const clamped = clampCardToA3(raw, canvasWidth, canvasHeight);
    if (!isLegalRect(clamped, others, minGap, canvasWidth, canvasHeight)) {
      continue;
    }
    legal.push(clamped);
  }
  if (legal.length === 0) return null;
  legal.sort((a, b) => {
    const da = candidateDistance(a, origin);
    const db = candidateDistance(b, origin);
    if (da !== db) return da - db;
    const ma = Math.abs(a.x - origin.x) + Math.abs(a.y - origin.y);
    const mb = Math.abs(b.x - origin.x) + Math.abs(b.y - origin.y);
    if (ma !== mb) return ma - mb;
    if (a.x !== b.x) return a.x - b.x;
    return a.y - b.y;
  });
  return legal[0] ?? null;
}

function resolveAgainstCards(
  rect: CardRect,
  others: CardCollisionBody[],
  minGap: number,
  canvasWidth: number,
  canvasHeight: number,
): { rect: CardRect; resolution: CollisionResolution; blockers: string[] } | null {
  const blockers = collidingCards(rect, others, minGap);
  if (blockers.length === 0) {
    return { rect, resolution: "none", blockers: [] };
  }
  const axis = pickNearestLegal(
    escapeCandidates(rect, blockers, minGap),
    rect,
    others,
    minGap,
    canvasWidth,
    canvasHeight,
  );
  if (axis) {
    return {
      rect: axis,
      resolution: "axis_escape",
      blockers: blockers.map((b) => b.id),
    };
  }
  const near = pickNearestLegal(
    nearbyCandidates(rect),
    rect,
    others,
    minGap,
    canvasWidth,
    canvasHeight,
  );
  if (near) {
    return {
      rect: near,
      resolution: "nearby_search",
      blockers: blockers.map((b) => b.id),
    };
  }
  return null;
}

/**
 * Bounded nearest legal rect. Used by conservative layout when drop
 * helpers do not search (no card blocker, but A3 / legend still illegal).
 */
export function findNearestLegalPlacement(
  origin: CardRect,
  otherCards: Array<RelatedDiagramCard | CardCollisionBody> = [],
  options?: {
    canvasWidth?: number;
    canvasHeight?: number;
    minGap?: number;
  },
): CardRect | null {
  const canvasWidth = options?.canvasWidth ?? A3_WIDTH_PX;
  const canvasHeight = options?.canvasHeight ?? A3_HEIGHT_PX;
  const minGap = options?.minGap ?? CARD_MIN_GAP;
  const others = otherCards.map((card) =>
    "layout" in card ? cardLayoutRect(card) : card,
  );
  const clamped = clampCardToA3(origin, canvasWidth, canvasHeight);
  if (isLegalRect(clamped, others, minGap, canvasWidth, canvasHeight)) {
    return clamped;
  }
  const blockers = collidingCards(clamped, others, minGap);
  const legend = getA3LegendBounds(canvasWidth, canvasHeight);
  const axis = pickNearestLegal(
    [
      ...escapeCandidates(clamped, blockers, minGap),
      ...escapeCandidates(clamped, [{ id: "__legend__", ...legend }], 0),
    ],
    origin,
    others,
    minGap,
    canvasWidth,
    canvasHeight,
  );
  if (axis) return axis;
  return pickNearestLegal(
    nearbyCandidates(clamped),
    origin,
    others,
    minGap,
    canvasWidth,
    canvasHeight,
  );
}

export function resolveCardDropCollision(input: {
  movingCard: RelatedDiagramCard | CardCollisionBody;
  desiredPosition: { x: number; y: number };
  otherCards: Array<RelatedDiagramCard | CardCollisionBody>;
  lastLegal: { x: number; y: number };
  canvasWidth?: number;
  canvasHeight?: number;
  minGap?: number;
}): CardDropCollisionResult {
  const canvasWidth = input.canvasWidth ?? A3_WIDTH_PX;
  const canvasHeight = input.canvasHeight ?? A3_HEIGHT_PX;
  const minGap = input.minGap ?? CARD_MIN_GAP;
  const others = input.otherCards.map((card) =>
    "layout" in card ? cardLayoutRect(card) : card,
  );
  const size = "layout" in input.movingCard ? input.movingCard.layout : input.movingCard;
  const lastLegalRect: CardRect = {
    x: input.lastLegal.x,
    y: input.lastLegal.y,
    width: size.width,
    height: size.height,
  };

  let rect: CardRect = clampCardToA3(
    {
      x: input.desiredPosition.x,
      y: input.desiredPosition.y,
      width: size.width,
      height: size.height,
    },
    canvasWidth,
    canvasHeight,
  );
  const firstBlockers = collidingCards(rect, others, minGap);
  let collided = firstBlockers.length > 0;
  let blockers = firstBlockers.map((b) => b.id);
  let resolution: CollisionResolution = "none";

  const first = resolveAgainstCards(
    rect,
    others,
    minGap,
    canvasWidth,
    canvasHeight,
  );
  if (!first) {
    return {
      position: { x: lastLegalRect.x, y: lastLegalRect.y },
      collided: true,
      blockers,
      resolution: "last_legal",
    };
  }
  rect = first.rect;
  if (first.resolution !== "none") {
    resolution = first.resolution;
  }

  rect = resolveCardDropPosition(rect, canvasWidth, canvasHeight);

  const afterLegend = collidingCards(rect, others, minGap);
  if (afterLegend.length > 0) {
    collided = true;
    blockers = [...new Set([...blockers, ...afterLegend.map((b) => b.id)])];
    const again = resolveAgainstCards(
      rect,
      others,
      minGap,
      canvasWidth,
      canvasHeight,
    );
    if (!again) {
      return {
        position: { x: lastLegalRect.x, y: lastLegalRect.y },
        collided: true,
        blockers,
        resolution: "last_legal",
      };
    }
    rect = resolveCardDropPosition(again.rect, canvasWidth, canvasHeight);
    if (collidingCards(rect, others, minGap).length > 0) {
      return {
        position: { x: lastLegalRect.x, y: lastLegalRect.y },
        collided: true,
        blockers,
        resolution: "last_legal",
      };
    }
    if (again.resolution !== "none") {
      resolution = again.resolution;
    }
  }

  return {
    position: { x: rect.x, y: rect.y },
    collided,
    blockers,
    resolution,
  };
}

export function resolveGroupDropCollision(input: {
  groupBounds: CardRect;
  desiredDelta: { dx: number; dy: number };
  externalCards: Array<RelatedDiagramCard | CardCollisionBody>;
  lastLegalDelta?: { dx: number; dy: number };
  canvasWidth?: number;
  canvasHeight?: number;
  minGap?: number;
}): GroupDropCollisionResult {
  const start = input.groupBounds;
  const last = input.lastLegalDelta ?? { dx: 0, dy: 0 };
  const result = resolveCardDropCollision({
    movingCard: { id: "__knowledge_group__", ...start },
    desiredPosition: {
      x: start.x + input.desiredDelta.dx,
      y: start.y + input.desiredDelta.dy,
    },
    otherCards: input.externalCards,
    lastLegal: {
      x: start.x + last.dx,
      y: start.y + last.dy,
    },
    canvasWidth: input.canvasWidth,
    canvasHeight: input.canvasHeight,
    minGap: input.minGap,
  });
  return {
    dx: result.position.x - start.x,
    dy: result.position.y - start.y,
    collided: result.collided,
    blockers: result.blockers,
    resolution: result.resolution,
  };
}

export function otherCardsUnchanged(
  before: RelatedDiagramCard[],
  after: RelatedDiagramCard[],
  movedIds: Set<string>,
): boolean {
  if (before.length !== after.length) return false;
  const afterById = new Map(after.map((c) => [c.id, c]));
  for (const card of before) {
    if (movedIds.has(card.id)) continue;
    const next = afterById.get(card.id);
    if (!next) return false;
    if (next.layout.x !== card.layout.x || next.layout.y !== card.layout.y) {
      return false;
    }
    if (
      next.layout.width !== card.layout.width ||
      next.layout.height !== card.layout.height
    ) {
      return false;
    }
  }
  return true;
}
