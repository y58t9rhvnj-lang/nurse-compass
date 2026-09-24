/**
 * Related Diagram L0/L1 conservative layout (pure).
 * Overlap / A3 / legend only. No route, history, or semantic reorder.
 */

import { A3_HEIGHT_PX, A3_WIDTH_PX } from "./a3Canvas";
import { resolveCardDropPosition, type CardRect } from "./a3CardBoundary";
import { rectIntersectsA3Legend } from "./a3Legend";
import {
  CARD_MIN_GAP,
  collidingCards,
  findNearestLegalPlacement,
  isLegalCardPlacement,
  type CardCollisionBody,
} from "./cardCollision";
import {
  knowledgeCardsOf,
  knowledgeGroupBounds,
} from "./knowledgeGroupLayout";
import type { RelatedDiagramCard } from "./types";

const KNOWLEDGE_BODY_ID = "__knowledge_group__";
const LAYOUT_MAX_PASSES = 64;

export type DiagramLayoutPosition = {
  cardId: string;
  x: number;
  y: number;
};

export type DiagramLayoutReason =
  | "already_arranged"
  | "arranged"
  | "impossible_to_fit";

export type DiagramLayoutResult = {
  positions: DiagramLayoutPosition[];
  changedCardIds: string[];
  fullyArranged: boolean;
  reason: DiagramLayoutReason;
};

export type LayoutRelatedDiagramInput = {
  cards: RelatedDiagramCard[];
  canvasWidth?: number;
  canvasHeight?: number;
};

type Pos = { x: number; y: number };
type PosMap = Map<string, Pos>;

type LayoutBody = {
  id: string;
  kind: "card" | "knowledge";
  cardIds: string[];
};

type Quality = {
  outOfBounds: number;
  legendHits: number;
  overlapPairs: number;
  displacement: number;
};

function toPx(value: number): number {
  return Math.round(value);
}

function compareId(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}\0${b}` : `${b}\0${a}`;
}

function clonePosMap(pos: PosMap): PosMap {
  const next: PosMap = new Map();
  for (const [id, value] of pos) {
    next.set(id, { x: value.x, y: value.y });
  }
  return next;
}

function cardRect(card: RelatedDiagramCard, pos: Pos): CardRect {
  return {
    x: pos.x,
    y: pos.y,
    width: card.layout.width,
    height: card.layout.height,
  };
}

function cardBody(card: RelatedDiagramCard, pos: Pos): CardCollisionBody {
  return { id: card.id, ...cardRect(card, pos) };
}

function snapshotPositions(cards: RelatedDiagramCard[]): PosMap {
  const pos: PosMap = new Map();
  for (const card of [...cards].sort((a, b) => compareId(a.id, b.id))) {
    pos.set(card.id, { x: toPx(card.layout.x), y: toPx(card.layout.y) });
  }
  return pos;
}

function cardsById(cards: RelatedDiagramCard[]): Map<string, RelatedDiagramCard> {
  return new Map(cards.map((card) => [card.id, card]));
}

function sortedNonKnowledge(cards: RelatedDiagramCard[]): RelatedDiagramCard[] {
  return cards
    .filter((card) => card.cardType !== "knowledge")
    .sort((a, b) => compareId(a.id, b.id));
}

function layoutBodies(cards: RelatedDiagramCard[]): LayoutBody[] {
  const bodies: LayoutBody[] = [];
  const knowledgeIds = knowledgeCardsOf(cards)
    .map((card) => card.id)
    .sort(compareId);
  if (knowledgeIds.length > 0) {
    bodies.push({
      id: KNOWLEDGE_BODY_ID,
      kind: "knowledge",
      cardIds: knowledgeIds,
    });
  }
  for (const card of sortedNonKnowledge(cards)) {
    bodies.push({ id: card.id, kind: "card", cardIds: [card.id] });
  }
  return bodies;
}

function viewCard(
  card: RelatedDiagramCard,
  pos: PosMap,
): RelatedDiagramCard {
  const current = pos.get(card.id);
  if (!current) return card;
  return {
    ...card,
    layout: {
      ...card.layout,
      x: current.x,
      y: current.y,
    },
  };
}

function viewCards(
  cards: RelatedDiagramCard[],
  pos: PosMap,
): RelatedDiagramCard[] {
  return cards.map((card) => viewCard(card, pos));
}

function otherBodies(
  cards: RelatedDiagramCard[],
  pos: PosMap,
  excludeIds: Set<string>,
): CardCollisionBody[] {
  return cards
    .filter((card) => !excludeIds.has(card.id))
    .map((card) => cardBody(card, pos.get(card.id)!));
}

function isOutOfBounds(
  rect: CardRect,
  canvasWidth: number,
  canvasHeight: number,
): boolean {
  return (
    rect.x < 0 ||
    rect.y < 0 ||
    rect.x + rect.width > canvasWidth ||
    rect.y + rect.height > canvasHeight
  );
}

function overlapPairSet(
  cards: RelatedDiagramCard[],
  pos: PosMap,
): Set<string> {
  const ordered = [...cards].sort((a, b) => compareId(a.id, b.id));
  const pairs = new Set<string>();
  for (let i = 0; i < ordered.length; i += 1) {
    const a = ordered[i]!;
    const aRect = cardRect(a, pos.get(a.id)!);
    const rest = ordered.slice(i + 1).map((card) => cardBody(card, pos.get(card.id)!));
    for (const blocker of collidingCards(aRect, rest, CARD_MIN_GAP)) {
      pairs.add(pairKey(a.id, blocker.id));
    }
  }
  return pairs;
}

function measureQuality(
  cards: RelatedDiagramCard[],
  pos: PosMap,
  origin: PosMap,
  canvasWidth: number,
  canvasHeight: number,
): Quality {
  let outOfBounds = 0;
  let legendHits = 0;
  let displacement = 0;
  for (const card of cards) {
    const current = pos.get(card.id)!;
    const start = origin.get(card.id)!;
    const rect = cardRect(card, current);
    if (isOutOfBounds(rect, canvasWidth, canvasHeight)) outOfBounds += 1;
    if (rectIntersectsA3Legend(rect, canvasWidth, canvasHeight)) legendHits += 1;
    displacement += Math.abs(current.x - start.x) + Math.abs(current.y - start.y);
  }
  return {
    outOfBounds,
    legendHits,
    overlapPairs: overlapPairSet(cards, pos).size,
    displacement,
  };
}

function qualityLex3(next: Quality, prev: Quality): number {
  if (next.outOfBounds !== prev.outOfBounds) {
    return next.outOfBounds - prev.outOfBounds;
  }
  if (next.legendHits !== prev.legendHits) {
    return next.legendHits - prev.legendHits;
  }
  return next.overlapPairs - prev.overlapPairs;
}

function hasNewOverlapPairs(next: Set<string>, prev: Set<string>): boolean {
  for (const key of next) {
    if (!prev.has(key)) return true;
  }
  return false;
}

function isFullyArranged(
  cards: RelatedDiagramCard[],
  pos: PosMap,
  canvasWidth: number,
  canvasHeight: number,
): boolean {
  for (const card of cards) {
    const rect = cardRect(card, pos.get(card.id)!);
    if (isOutOfBounds(rect, canvasWidth, canvasHeight)) return false;
    if (rectIntersectsA3Legend(rect, canvasWidth, canvasHeight)) return false;
  }
  return overlapPairSet(cards, pos).size === 0;
}

function samePos(a: Pos, b: Pos): boolean {
  return a.x === b.x && a.y === b.y;
}

function changedCardIds(origin: PosMap, next: PosMap): string[] {
  const ids: string[] = [];
  for (const [id, start] of origin) {
    const current = next.get(id);
    if (!current || !samePos(start, current)) ids.push(id);
  }
  return ids.sort(compareId);
}

function serializePos(pos: PosMap): string {
  return [...pos.entries()]
    .sort((a, b) => compareId(a[0], b[0]))
    .map(([id, value]) => `${id}:${value.x},${value.y}`)
    .join("|");
}

function applyBodyDestination(
  cards: RelatedDiagramCard[],
  pos: PosMap,
  body: LayoutBody,
  dest: Pos,
): PosMap {
  const next = clonePosMap(pos);
  if (body.kind === "card") {
    const id = body.cardIds[0]!;
    next.set(id, { x: toPx(dest.x), y: toPx(dest.y) });
    return next;
  }
  const views = viewCards(cards, pos);
  const bbox = knowledgeGroupBounds(views);
  if (!bbox) return next;
  const dx = toPx(dest.x) - toPx(bbox.x);
  const dy = toPx(dest.y) - toPx(bbox.y);
  if (dx === 0 && dy === 0) return next;
  for (const id of body.cardIds) {
    const current = pos.get(id)!;
    next.set(id, { x: toPx(current.x + dx), y: toPx(current.y + dy) });
  }
  return next;
}

function bodyNeedsBoundsFix(
  cards: RelatedDiagramCard[],
  pos: PosMap,
  body: LayoutBody,
  canvasWidth: number,
  canvasHeight: number,
): boolean {
  const byId = cardsById(cards);
  return body.cardIds.some((id) => {
    const card = byId.get(id);
    if (!card) return false;
    const rect = cardRect(card, pos.get(id)!);
    return (
      isOutOfBounds(rect, canvasWidth, canvasHeight) ||
      rectIntersectsA3Legend(rect, canvasWidth, canvasHeight)
    );
  });
}

function searchLegalDestination(
  origin: CardRect,
  others: CardCollisionBody[],
  canvasWidth: number,
  canvasHeight: number,
): Pos | null {
  const found = findNearestLegalPlacement(origin, others, {
    canvasWidth,
    canvasHeight,
    minGap: CARD_MIN_GAP,
  });
  if (!found) return null;
  return { x: toPx(found.x), y: toPx(found.y) };
}

function acceptBoundsMove(next: Quality, prev: Quality): boolean {
  if (next.outOfBounds < prev.outOfBounds) return true;
  return next.outOfBounds === prev.outOfBounds && next.legendHits < prev.legendHits;
}

function acceptCollisionMove(
  cards: RelatedDiagramCard[],
  prev: PosMap,
  next: PosMap,
  prevQuality: Quality,
  nextQuality: Quality,
): boolean {
  if (nextQuality.outOfBounds > prevQuality.outOfBounds) return false;
  if (nextQuality.legendHits > prevQuality.legendHits) return false;
  if (nextQuality.overlapPairs >= prevQuality.overlapPairs) return false;
  return !hasNewOverlapPairs(
    overlapPairSet(cards, next),
    overlapPairSet(cards, prev),
  );
}

function boundsDestinationForBody(
  cards: RelatedDiagramCard[],
  pos: PosMap,
  body: LayoutBody,
  canvasWidth: number,
  canvasHeight: number,
): Pos | null {
  if (body.kind === "card") {
    const card = cardsById(cards).get(body.cardIds[0]!);
    if (!card) return null;
    const current = cardRect(card, pos.get(card.id)!);
    const others = otherBodies(cards, pos, new Set([card.id]));
    const legal = searchLegalDestination(
      current,
      others,
      canvasWidth,
      canvasHeight,
    );
    if (legal) return legal;
    const dropped = resolveCardDropPosition(current, canvasWidth, canvasHeight);
    return { x: toPx(dropped.x), y: toPx(dropped.y) };
  }
  const views = viewCards(cards, pos);
  const bbox = knowledgeGroupBounds(views);
  if (!bbox) return null;
  const externals = otherBodies(cards, pos, new Set(body.cardIds));
  const legal = searchLegalDestination(
    bbox,
    externals,
    canvasWidth,
    canvasHeight,
  );
  if (legal) return legal;
  const dropped = resolveCardDropPosition(bbox, canvasWidth, canvasHeight);
  return { x: toPx(dropped.x), y: toPx(dropped.y) };
}

function collisionDestinationForBody(
  cards: RelatedDiagramCard[],
  pos: PosMap,
  body: LayoutBody,
  canvasWidth: number,
  canvasHeight: number,
): Pos | null {
  if (body.kind === "card") {
    const card = cardsById(cards).get(body.cardIds[0]!);
    if (!card) return null;
    const current = pos.get(card.id)!;
    const others = otherBodies(cards, pos, new Set([card.id]));
    const dest = searchLegalDestination(
      cardRect(card, current),
      others,
      canvasWidth,
      canvasHeight,
    );
    if (!dest || samePos(dest, current)) return null;
    const placed = {
      x: dest.x,
      y: dest.y,
      width: card.layout.width,
      height: card.layout.height,
    };
    if (!isLegalCardPlacement(placed, others, { canvasWidth, canvasHeight })) {
      return null;
    }
    return dest;
  }
  const views = viewCards(cards, pos);
  const bbox = knowledgeGroupBounds(views);
  if (!bbox) return null;
  const dest = searchLegalDestination(
    bbox,
    otherBodies(cards, pos, new Set(body.cardIds)),
    canvasWidth,
    canvasHeight,
  );
  if (!dest || samePos(dest, { x: toPx(bbox.x), y: toPx(bbox.y) })) return null;
  const trial = applyBodyDestination(cards, pos, body, dest);
  const externals = viewCards(cards, trial).filter(
    (item) => item.cardType !== "knowledge",
  );
  for (const id of body.cardIds) {
    const card = cardsById(cards).get(id);
    if (!card) return null;
    const rect = cardRect(card, trial.get(id)!);
    if (!isLegalCardPlacement(rect, externals, { canvasWidth, canvasHeight })) {
      return null;
    }
  }
  return dest;
}

function overlappingBodyPairs(
  cards: RelatedDiagramCard[],
  pos: PosMap,
  bodies: LayoutBody[],
): Array<[LayoutBody, LayoutBody]> {
  const pairs: Array<[LayoutBody, LayoutBody]> = [];
  const byId = cardsById(cards);
  for (let i = 0; i < bodies.length; i += 1) {
    const a = bodies[i]!;
    const aRects = a.cardIds.map((id) => cardRect(byId.get(id)!, pos.get(id)!));
    for (let j = i + 1; j < bodies.length; j += 1) {
      const b = bodies[j]!;
      const bBodies = b.cardIds.map((id) => cardBody(byId.get(id)!, pos.get(id)!));
      const hits = aRects.some(
        (rect) => collidingCards(rect, bBodies, CARD_MIN_GAP).length > 0,
      );
      if (!hits) continue;
      pairs.push(a.id < b.id ? [a, b] : [b, a]);
    }
  }
  pairs.sort((left, right) => {
    const idCmp = compareId(left[0].id, right[0].id);
    if (idCmp !== 0) return idCmp;
    return compareId(left[1].id, right[1].id);
  });
  return pairs;
}

function pickCollisionMover(
  cards: RelatedDiagramCard[],
  pos: PosMap,
  left: LayoutBody,
  right: LayoutBody,
  canvasWidth: number,
  canvasHeight: number,
): { body: LayoutBody; dest: Pos } | null {
  const options: Array<{ body: LayoutBody; dest: Pos; dist: number }> = [];
  for (const body of [left, right]) {
    const dest = collisionDestinationForBody(
      cards,
      pos,
      body,
      canvasWidth,
      canvasHeight,
    );
    if (!dest) continue;
    let origin: Pos;
    if (body.kind === "card") {
      origin = pos.get(body.cardIds[0]!)!;
    } else {
      const bbox = knowledgeGroupBounds(viewCards(cards, pos));
      if (!bbox) continue;
      origin = { x: toPx(bbox.x), y: toPx(bbox.y) };
    }
    const trial = applyBodyDestination(cards, pos, body, dest);
    const prevQ = measureQuality(cards, pos, pos, canvasWidth, canvasHeight);
    const nextQ = measureQuality(cards, trial, pos, canvasWidth, canvasHeight);
    if (!acceptCollisionMove(cards, pos, trial, prevQ, nextQ)) continue;
    options.push({
      body,
      dest,
      dist: Math.hypot(dest.x - origin.x, dest.y - origin.y),
    });
  }
  if (options.length === 0) return null;
  const hasKnowledge = left.kind === "knowledge" || right.kind === "knowledge";
  const preferred = hasKnowledge
    ? options.filter((option) => option.body.kind === "card")
    : options;
  const pool = preferred.length > 0 ? preferred : options;
  pool.sort((a, b) => {
    if (a.dist !== b.dist) return a.dist - b.dist;
    return compareId(b.body.id, a.body.id);
  });
  return pool[0] ?? null;
}

function runBoundsPass(
  cards: RelatedDiagramCard[],
  pos: PosMap,
  origin: PosMap,
  canvasWidth: number,
  canvasHeight: number,
): PosMap {
  let current = pos;
  for (const body of layoutBodies(cards)) {
    if (!bodyNeedsBoundsFix(cards, current, body, canvasWidth, canvasHeight)) {
      continue;
    }
    const dest = boundsDestinationForBody(
      cards,
      current,
      body,
      canvasWidth,
      canvasHeight,
    );
    if (!dest) continue;
    const trial = applyBodyDestination(cards, current, body, dest);
    const prevQ = measureQuality(cards, current, origin, canvasWidth, canvasHeight);
    const nextQ = measureQuality(cards, trial, origin, canvasWidth, canvasHeight);
    if (!acceptBoundsMove(nextQ, prevQ)) continue;
    current = trial;
  }
  return current;
}

function runCollisionPass(
  cards: RelatedDiagramCard[],
  pos: PosMap,
  origin: PosMap,
  canvasWidth: number,
  canvasHeight: number,
): PosMap {
  let current = pos;
  const bodies = layoutBodies(cards);
  const pairs = overlappingBodyPairs(cards, current, bodies);
  for (const [left, right] of pairs) {
    const still = overlappingBodyPairs(cards, current, [left, right]);
    if (still.length === 0) continue;
    const choice = pickCollisionMover(
      cards,
      current,
      left,
      right,
      canvasWidth,
      canvasHeight,
    );
    if (!choice) continue;
    const trial = applyBodyDestination(cards, current, choice.body, choice.dest);
    const prevQ = measureQuality(cards, current, origin, canvasWidth, canvasHeight);
    const nextQ = measureQuality(cards, trial, origin, canvasWidth, canvasHeight);
    if (!acceptCollisionMove(cards, current, trial, prevQ, nextQ)) continue;
    current = trial;
  }
  return current;
}

function toResult(
  cards: RelatedDiagramCard[],
  origin: PosMap,
  pos: PosMap,
  canvasWidth: number,
  canvasHeight: number,
): DiagramLayoutResult {
  const positions = [...cards]
    .map((card) => card.id)
    .sort(compareId)
    .map((cardId) => {
      const current = pos.get(cardId)!;
      return { cardId, x: current.x, y: current.y };
    });
  const changed = changedCardIds(origin, pos);
  const fullyArranged = isFullyArranged(cards, pos, canvasWidth, canvasHeight);
  let reason: DiagramLayoutReason;
  if (!fullyArranged) reason = "impossible_to_fit";
  else if (changed.length === 0) reason = "already_arranged";
  else reason = "arranged";
  return {
    positions,
    changedCardIds: changed,
    fullyArranged,
    reason,
  };
}

export function layoutRelatedDiagram(
  input: LayoutRelatedDiagramInput,
): DiagramLayoutResult {
  const canvasWidth = input.canvasWidth ?? A3_WIDTH_PX;
  const canvasHeight = input.canvasHeight ?? A3_HEIGHT_PX;
  const cards = input.cards;
  const origin = snapshotPositions(cards);
  let pos = clonePosMap(origin);
  const initialQuality = measureQuality(cards, pos, origin, canvasWidth, canvasHeight);
  const maxPasses = Math.min(
    LAYOUT_MAX_PASSES,
    Math.max(4, cards.length * 3),
  );

  for (let pass = 0; pass < maxPasses; pass += 1) {
    const beforePos = clonePosMap(pos);
    const beforeKey = serializePos(beforePos);
    const beforeQuality = measureQuality(
      cards,
      beforePos,
      origin,
      canvasWidth,
      canvasHeight,
    );
    pos = runBoundsPass(cards, pos, origin, canvasWidth, canvasHeight);
    pos = runCollisionPass(cards, pos, origin, canvasWidth, canvasHeight);
    if (serializePos(pos) === beforeKey) break;
    const afterQuality = measureQuality(
      cards,
      pos,
      origin,
      canvasWidth,
      canvasHeight,
    );
    if (qualityLex3(afterQuality, beforeQuality) > 0) {
      pos = beforePos;
      break;
    }
  }

  if (qualityLex3(
    measureQuality(cards, pos, origin, canvasWidth, canvasHeight),
    initialQuality,
  ) > 0) {
    pos = origin;
  }

  return toResult(cards, origin, pos, canvasWidth, canvasHeight);
}
