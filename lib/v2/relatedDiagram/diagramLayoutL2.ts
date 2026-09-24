/**
 * L2 connection-aware layout + orthogonal route readability.
 * Not a packing pass. Long / hard-to-follow edges only.
 */

import { A3_HEIGHT_PX, A3_WIDTH_PX } from "./a3Canvas";
import type { CardRect } from "./a3CardBoundary";
import { getA3LegendBounds, rectIntersectsA3Legend } from "./a3Legend";
import {
  CARD_MIN_GAP,
  collidingCards,
  isLegalCardPlacement,
  type CardCollisionBody,
} from "./cardCollision";
import {
  layoutRelatedDiagram,
  type DiagramLayoutPosition,
  type DiagramLayoutResult,
} from "./diagramLayout";
import { knowledgeCardsOf, knowledgeGroupBounds } from "./knowledgeGroupLayout";
import {
  countBends,
  polylineLength,
  type Point,
} from "./orthogonalRouting";
import type {
  RelatedDiagramCard,
  RelatedDiagramConnection,
} from "./types";

export const PREFERRED_EDGE_GAP_MIN = 48;
export const PREFERRED_EDGE_GAP_MAX = 260;
export const L2_MAX_PULL_PX = 180;
export const L2_MIN_IMPROVEMENT_PX = 36;
export const L2_MAX_PASSES = 10;
export const L2_HUB_DEGREE = 3;

const KNOWLEDGE_BODY_ID = "__knowledge_group__";

type Pos = { x: number; y: number };
type PosMap = Map<string, Pos>;

function toPx(value: number): number {
  return Math.round(value);
}

function compareId(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function clonePos(pos: PosMap): PosMap {
  const next: PosMap = new Map();
  for (const [id, value] of pos) next.set(id, { x: value.x, y: value.y });
  return next;
}

function snapshot(cards: RelatedDiagramCard[]): PosMap {
  const pos: PosMap = new Map();
  for (const card of [...cards].sort((a, b) => compareId(a.id, b.id))) {
    pos.set(card.id, { x: toPx(card.layout.x), y: toPx(card.layout.y) });
  }
  return pos;
}

function rectOf(card: RelatedDiagramCard, pos: Pos): CardRect {
  return {
    x: pos.x,
    y: pos.y,
    width: card.layout.width,
    height: card.layout.height,
  };
}

function viewCard(card: RelatedDiagramCard, pos: PosMap): RelatedDiagramCard {
  const current = pos.get(card.id);
  if (!current) return card;
  return { ...card, layout: { ...card.layout, x: current.x, y: current.y } };
}

function viewCards(
  cards: RelatedDiagramCard[],
  pos: PosMap,
): RelatedDiagramCard[] {
  return cards.map((card) => viewCard(card, pos));
}

export function orthogonalBorderGap(a: CardRect, b: CardRect): number {
  const gx = Math.max(0, a.x - (b.x + b.width), b.x - (a.x + a.width));
  const gy = Math.max(0, a.y - (b.y + b.height), b.y - (a.y + a.height));
  return gx + gy;
}

export function isExcessiveEdgeGap(gap: number): boolean {
  return gap > PREFERRED_EDGE_GAP_MAX;
}

export type RouteReadabilityScore = {
  cardThrough: number;
  outOfBounds: number;
  legendHits: number;
  crossings: number;
  bends: number;
  length: number;
};

export function compareRouteReadability(
  a: RouteReadabilityScore,
  b: RouteReadabilityScore,
): number {
  if (a.cardThrough !== b.cardThrough) return a.cardThrough - b.cardThrough;
  if (a.outOfBounds !== b.outOfBounds) return a.outOfBounds - b.outOfBounds;
  if (a.legendHits !== b.legendHits) return a.legendHits - b.legendHits;
  if (a.crossings !== b.crossings) return a.crossings - b.crossings;
  if (a.bends !== b.bends) return a.bends - b.bends;
  return a.length - b.length;
}

export function preferExistingRouteIfTied<T>(
  existing: T,
  candidate: T,
  existingScore: RouteReadabilityScore,
  candidateScore: RouteReadabilityScore,
): T {
  return compareRouteReadability(candidateScore, existingScore) < 0
    ? candidate
    : existing;
}

function segmentHitsRect(a: Point, b: Point, rect: CardRect): boolean {
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);
  const inset = 1;
  return (
    minX < rect.x + rect.width - inset &&
    maxX > rect.x + inset &&
    minY < rect.y + rect.height - inset &&
    maxY > rect.y + inset
  );
}

export function countPolylineCardHits(
  points: Point[],
  cards: Array<CardRect & { id?: string }>,
  ignoreIds: Set<string>,
): number {
  let hits = 0;
  for (const card of cards) {
    if (card.id && ignoreIds.has(card.id)) continue;
    for (let i = 1; i < points.length; i += 1) {
      if (segmentHitsRect(points[i - 1]!, points[i]!, card)) {
        hits += 1;
        break;
      }
    }
  }
  return hits;
}

export function countPolylineLegendHits(points: Point[]): number {
  const legend = getA3LegendBounds();
  for (let i = 1; i < points.length; i += 1) {
    if (segmentHitsRect(points[i - 1]!, points[i]!, legend)) return 1;
  }
  return 0;
}

export function countPolylineBoundsHits(
  points: Point[],
  canvasWidth = A3_WIDTH_PX,
  canvasHeight = A3_HEIGHT_PX,
): number {
  for (const point of points) {
    if (
      point.x < 0 ||
      point.y < 0 ||
      point.x > canvasWidth ||
      point.y > canvasHeight
    ) {
      return 1;
    }
  }
  return 0;
}

export function scoreOrthogonalPolyline(
  points: Point[],
  cards: Array<CardRect & { id?: string }>,
  ignoreIds: Set<string>,
  crossings = 0,
): RouteReadabilityScore {
  return {
    cardThrough: countPolylineCardHits(points, cards, ignoreIds),
    outOfBounds: countPolylineBoundsHits(points),
    legendHits: countPolylineLegendHits(points),
    crossings,
    bends: countBends(points),
    length: polylineLength(points),
  };
}

function lRoute(a: CardRect, b: CardRect): Point[] {
  const start = { x: a.x + a.width / 2, y: a.y + a.height / 2 };
  const end = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  const horizFirst = [start, { x: end.x, y: start.y }, end];
  const vertFirst = [start, { x: start.x, y: end.y }, end];
  const empty = new Set<string>();
  const sh = scoreOrthogonalPolyline(horizFirst, [], empty);
  const sv = scoreOrthogonalPolyline(vertFirst, [], empty);
  return compareRouteReadability(sh, sv) <= 0 ? horizFirst : vertFirst;
}

function properCross(a1: Point, a2: Point, b1: Point, b2: Point): boolean {
  const aHoriz = Math.abs(a1.y - a2.y) <= 0.51;
  const bHoriz = Math.abs(b1.y - b2.y) <= 0.51;
  if (aHoriz === bHoriz) return false;
  const h1 = aHoriz ? a1 : b1;
  const h2 = aHoriz ? a2 : b2;
  const v1 = aHoriz ? b1 : a1;
  const v2 = aHoriz ? b2 : a2;
  const y = h1.y;
  const x = v1.x;
  const minHx = Math.min(h1.x, h2.x);
  const maxHx = Math.max(h1.x, h2.x);
  const minVy = Math.min(v1.y, v2.y);
  const maxVy = Math.max(v1.y, v2.y);
  return x > minHx + 0.51 && x < maxHx - 0.51 && y > minVy + 0.51 && y < maxVy - 0.51;
}

function countLRouteCrossings(routes: Point[][]): number {
  let n = 0;
  for (let i = 0; i < routes.length; i += 1) {
    for (let j = i + 1; j < routes.length; j += 1) {
      const a = routes[i]!;
      const b = routes[j]!;
      for (let p = 1; p < a.length; p += 1) {
        for (let q = 1; q < b.length; q += 1) {
          if (properCross(a[p - 1]!, a[p]!, b[q - 1]!, b[q]!)) n += 1;
        }
      }
    }
  }
  return n;
}

function degreeMap(connections: RelatedDiagramConnection[]): Map<string, number> {
  const deg = new Map<string, number>();
  for (const conn of connections) {
    deg.set(conn.sourceCardId, (deg.get(conn.sourceCardId) ?? 0) + 1);
    deg.set(conn.targetCardId, (deg.get(conn.targetCardId) ?? 0) + 1);
  }
  return deg;
}

function knowledgeIdSet(cards: RelatedDiagramCard[]): Set<string> {
  return new Set(knowledgeCardsOf(cards).map((card) => card.id));
}

function bodyId(cardId: string, knowledgeIds: Set<string>): string {
  return knowledgeIds.has(cardId) ? KNOWLEDGE_BODY_ID : cardId;
}

function applyDelta(
  pos: PosMap,
  cardIds: string[],
  dx: number,
  dy: number,
): PosMap {
  const next = clonePos(pos);
  for (const id of cardIds) {
    const current = next.get(id);
    if (!current) continue;
    next.set(id, { x: toPx(current.x + dx), y: toPx(current.y + dy) });
  }
  return next;
}

function hardLegal(
  cards: RelatedDiagramCard[],
  pos: PosMap,
  canvasWidth: number,
  canvasHeight: number,
): boolean {
  const views = viewCards(cards, pos);
  for (const card of views) {
    const others = views.filter((item) => item.id !== card.id);
    if (
      !isLegalCardPlacement(card.layout, others, {
        canvasWidth,
        canvasHeight,
        minGap: CARD_MIN_GAP,
      })
    ) {
      return false;
    }
  }
  const knowledge = knowledgeCardsOf(views);
  if (knowledge.length > 0) {
    const box = knowledgeGroupBounds(views);
    if (
      box &&
      (box.x < 0 ||
        box.y < 0 ||
        box.x + box.width > canvasWidth ||
        box.y + box.height > canvasHeight)
    ) {
      return false;
    }
  }
  return true;
}

type SceneScore = {
  hard: number;
  through: number;
  crossings: number;
  excessiveCount: number;
  excessLength: number;
  bends: number;
  displacement: number;
};

function sceneScore(
  cards: RelatedDiagramCard[],
  connections: RelatedDiagramConnection[],
  pos: PosMap,
  origin: PosMap,
  canvasWidth: number,
  canvasHeight: number,
): SceneScore {
  const byId = new Map(cards.map((card) => [card.id, card]));
  const views = viewCards(cards, pos);
  const rects = views.map((card) => ({ id: card.id, ...card.layout }));
  let hard = 0;
  let displacement = 0;
  for (const card of views) {
    const start = origin.get(card.id)!;
    displacement +=
      Math.abs(card.layout.x - start.x) + Math.abs(card.layout.y - start.y);
    if (
      card.layout.x < 0 ||
      card.layout.y < 0 ||
      card.layout.x + card.layout.width > canvasWidth ||
      card.layout.y + card.layout.height > canvasHeight
    ) {
      hard += 1;
    }
    if (rectIntersectsA3Legend(card.layout, canvasWidth, canvasHeight)) hard += 1;
  }
  const bodies: CardCollisionBody[] = views.map((card) => ({
    id: card.id,
    ...card.layout,
  }));
  for (let i = 0; i < bodies.length; i += 1) {
    hard += collidingCards(bodies[i]!, bodies.slice(i + 1), CARD_MIN_GAP).length;
  }

  const ordered = [...connections].sort((a, b) => compareId(a.id, b.id));
  const routes: Point[][] = [];
  let through = 0;
  let excessiveCount = 0;
  let excessLength = 0;
  let bends = 0;
  for (const conn of ordered) {
    const source = byId.get(conn.sourceCardId);
    const target = byId.get(conn.targetCardId);
    if (!source || !target) continue;
    const a = rectOf(source, pos.get(source.id)!);
    const b = rectOf(target, pos.get(target.id)!);
    const gap = orthogonalBorderGap(a, b);
    if (isExcessiveEdgeGap(gap)) {
      excessiveCount += 1;
      excessLength += gap - PREFERRED_EDGE_GAP_MAX;
    }
    const route = lRoute(a, b);
    routes.push(route);
    through += countPolylineCardHits(
      route,
      rects,
      new Set([source.id, target.id]),
    );
    through += countPolylineLegendHits(route);
    bends += countBends(route);
  }
  return {
    hard,
    through,
    crossings: countLRouteCrossings(routes),
    excessiveCount,
    excessLength,
    bends,
    displacement,
  };
}

function scoreLex(next: SceneScore, prev: SceneScore): number {
  if (next.hard !== prev.hard) return next.hard - prev.hard;
  if (next.through !== prev.through) return next.through - prev.through;
  if (next.crossings !== prev.crossings) return next.crossings - prev.crossings;
  if (next.excessiveCount !== prev.excessiveCount) {
    return next.excessiveCount - prev.excessiveCount;
  }
  if (next.excessLength !== prev.excessLength) {
    return next.excessLength - prev.excessLength;
  }
  if (next.bends !== prev.bends) return next.bends - prev.bends;
  return next.displacement - prev.displacement;
}

function pickMover(
  sourceId: string,
  targetId: string,
  degrees: Map<string, number>,
  knowledgeIds: Set<string>,
): { moverId: string; anchorId: string } | null {
  if (bodyId(sourceId, knowledgeIds) === bodyId(targetId, knowledgeIds)) {
    return null;
  }
  const sourceKnowledge = knowledgeIds.has(sourceId);
  const targetKnowledge = knowledgeIds.has(targetId);
  if (sourceKnowledge !== targetKnowledge) {
    return sourceKnowledge
      ? { moverId: targetId, anchorId: sourceId }
      : { moverId: sourceId, anchorId: targetId };
  }
  const ds = degrees.get(sourceId) ?? 0;
  const dt = degrees.get(targetId) ?? 0;
  if (ds >= L2_HUB_DEGREE && dt < ds) {
    return { moverId: targetId, anchorId: sourceId };
  }
  if (dt >= L2_HUB_DEGREE && ds < dt) {
    return { moverId: sourceId, anchorId: targetId };
  }
  if (ds !== dt) {
    return ds < dt
      ? { moverId: sourceId, anchorId: targetId }
      : { moverId: targetId, anchorId: sourceId };
  }
  return sourceId > targetId
    ? { moverId: sourceId, anchorId: targetId }
    : { moverId: targetId, anchorId: sourceId };
}

function pullCandidates(mover: CardRect, anchor: CardRect): Array<{ dx: number; dy: number }> {
  const gx = Math.max(0, mover.x - (anchor.x + anchor.width), anchor.x - (mover.x + mover.width));
  const gy = Math.max(0, mover.y - (anchor.y + anchor.height), anchor.y - (mover.y + mover.height));
  const sep = gx + gy;
  const extra = sep - PREFERRED_EDGE_GAP_MAX;
  if (extra <= 0) return [];
  const pull = Math.min(L2_MAX_PULL_PX, extra);
  const signX =
    mover.x + mover.width <= anchor.x ? 1 : anchor.x + anchor.width <= mover.x ? -1 : 0;
  const signY =
    mover.y + mover.height <= anchor.y ? 1 : anchor.y + anchor.height <= mover.y ? -1 : 0;
  const out: Array<{ dx: number; dy: number }> = [];
  const seen = new Set<string>();
  const add = (dx: number, dy: number) => {
    const nx = toPx(dx);
    const ny = toPx(dy);
    if (nx === 0 && ny === 0) return;
    const key = `${nx},${ny}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ dx: nx, dy: ny });
  };
  for (const fraction of [1, 0.5, 0.25]) {
    const amount = toPx(pull * fraction);
    if (gx >= gy && signX !== 0) add(signX * amount, 0);
    if (gy >= gx && signY !== 0) add(0, signY * amount);
    if (signX !== 0 && signY !== 0 && gx > 0 && gy > 0) {
      const share = toPx(amount / 2);
      add(signX * share, signY * (amount - share));
    }
  }
  out.sort((a, b) => {
    const da = Math.abs(a.dx) + Math.abs(a.dy);
    const db = Math.abs(b.dx) + Math.abs(b.dy);
    if (da !== db) return da - db;
    if (a.dx !== b.dx) return a.dx - b.dx;
    return a.dy - b.dy;
  });
  return out;
}

function moverCardIds(
  moverId: string,
  knowledgeIds: Set<string>,
  cards: RelatedDiagramCard[],
): string[] {
  if (!knowledgeIds.has(moverId)) return [moverId];
  return knowledgeCardsOf(cards)
    .map((card) => card.id)
    .sort(compareId);
}

function optimizePositions(
  cards: RelatedDiagramCard[],
  connections: RelatedDiagramConnection[],
  start: PosMap,
  origin: PosMap,
  canvasWidth: number,
  canvasHeight: number,
): PosMap {
  const degrees = degreeMap(connections);
  const knowledgeIds = knowledgeIdSet(cards);
  const byId = new Map(cards.map((card) => [card.id, card]));
  let pos = clonePos(start);
  const orderedConns = [...connections].sort((a, b) => compareId(a.id, b.id));

  for (let pass = 0; pass < L2_MAX_PASSES; pass += 1) {
    const prevScore = sceneScore(
      cards,
      connections,
      pos,
      origin,
      canvasWidth,
      canvasHeight,
    );
    const excessive = orderedConns
      .map((conn) => {
        const source = byId.get(conn.sourceCardId);
        const target = byId.get(conn.targetCardId);
        if (!source || !target) return null;
        const a = rectOf(source, pos.get(source.id)!);
        const b = rectOf(target, pos.get(target.id)!);
        const gap = orthogonalBorderGap(a, b);
        if (!isExcessiveEdgeGap(gap)) return null;
        return { conn, gap };
      })
      .filter((row): row is { conn: RelatedDiagramConnection; gap: number } => row != null)
      .sort((a, b) => {
        if (a.gap !== b.gap) return b.gap - a.gap;
        return compareId(a.conn.id, b.conn.id);
      });

    let accepted: PosMap | null = null;
    for (const row of excessive) {
      const choice = pickMover(
        row.conn.sourceCardId,
        row.conn.targetCardId,
        degrees,
        knowledgeIds,
      );
      if (!choice) continue;
      const moverCard = byId.get(choice.moverId);
      const anchorCard = byId.get(choice.anchorId);
      if (!moverCard || !anchorCard) continue;
      const moverRect = rectOf(moverCard, pos.get(moverCard.id)!);
      const anchorRect = rectOf(anchorCard, pos.get(anchorCard.id)!);
      const ids = moverCardIds(choice.moverId, knowledgeIds, cards);
      let best: { pos: PosMap; score: SceneScore } | null = null;
      for (const delta of pullCandidates(moverRect, anchorRect)) {
        const trial = applyDelta(pos, ids, delta.dx, delta.dy);
        if (!hardLegal(cards, trial, canvasWidth, canvasHeight)) continue;
        const nextScore = sceneScore(
          cards,
          connections,
          trial,
          origin,
          canvasWidth,
          canvasHeight,
        );
        if (scoreLex(nextScore, prevScore) >= 0) continue;
        const lengthGain = prevScore.excessLength - nextScore.excessLength;
        const countGain = prevScore.excessiveCount - nextScore.excessiveCount;
        if (countGain <= 0 && lengthGain < L2_MIN_IMPROVEMENT_PX) continue;
        const addedDisp = nextScore.displacement - prevScore.displacement;
        if (addedDisp > Math.max(L2_MAX_PULL_PX, lengthGain * 1.25)) continue;
        if (!best || scoreLex(nextScore, best.score) < 0) {
          best = { pos: trial, score: nextScore };
        }
      }
      if (best) {
        accepted = best.pos;
        break;
      }
    }
    if (!accepted) break;
    pos = accepted;
  }
  return pos;
}

function toLayoutResult(
  cards: RelatedDiagramCard[],
  origin: PosMap,
  pos: PosMap,
  canvasWidth: number,
  canvasHeight: number,
): DiagramLayoutResult {
  const positions: DiagramLayoutPosition[] = [...cards]
    .map((card) => card.id)
    .sort(compareId)
    .map((cardId) => {
      const current = pos.get(cardId)!;
      return { cardId, x: current.x, y: current.y };
    });
  const changedCardIds = positions
    .filter((row) => {
      const start = origin.get(row.cardId)!;
      return start.x !== row.x || start.y !== row.y;
    })
    .map((row) => row.cardId);
  const views = viewCards(cards, pos);
  const hardOk = hardLegal(cards, pos, canvasWidth, canvasHeight);
  const fullyArranged = hardOk;
  void views;
  let reason: DiagramLayoutResult["reason"];
  if (!fullyArranged) reason = "impossible_to_fit";
  else if (changedCardIds.length === 0) reason = "already_arranged";
  else reason = "arranged";
  return {
    positions,
    changedCardIds,
    fullyArranged,
    reason,
  };
}

export function optimizeRelatedDiagramConnections(input: {
  cards: RelatedDiagramCard[];
  connections: RelatedDiagramConnection[];
  canvasWidth?: number;
  canvasHeight?: number;
}): DiagramLayoutResult {
  const canvasWidth = input.canvasWidth ?? A3_WIDTH_PX;
  const canvasHeight = input.canvasHeight ?? A3_HEIGHT_PX;
  const origin = snapshot(input.cards);
  const pos = optimizePositions(
    input.cards,
    input.connections,
    origin,
    origin,
    canvasWidth,
    canvasHeight,
  );
  return toLayoutResult(input.cards, origin, pos, canvasWidth, canvasHeight);
}

export function layoutRelatedDiagramConnected(input: {
  cards: RelatedDiagramCard[];
  connections: RelatedDiagramConnection[];
  canvasWidth?: number;
  canvasHeight?: number;
}): DiagramLayoutResult {
  const canvasWidth = input.canvasWidth ?? A3_WIDTH_PX;
  const canvasHeight = input.canvasHeight ?? A3_HEIGHT_PX;
  const origin = snapshot(input.cards);
  const l1 = layoutRelatedDiagram({
    cards: input.cards,
    canvasWidth,
    canvasHeight,
  });
  const mid: PosMap = new Map(
    l1.positions.map((row) => [row.cardId, { x: row.x, y: row.y }]),
  );
  const midCards = viewCards(input.cards, mid);
  const l2 = optimizePositions(
    midCards,
    input.connections,
    snapshot(midCards),
    origin,
    canvasWidth,
    canvasHeight,
  );
  let pos = l2;
  if (!hardLegal(input.cards, pos, canvasWidth, canvasHeight)) {
    const repaired = layoutRelatedDiagram({
      cards: viewCards(input.cards, pos),
      canvasWidth,
      canvasHeight,
    });
    pos = new Map(repaired.positions.map((row) => [row.cardId, { x: row.x, y: row.y }]));
  }
  return toLayoutResult(input.cards, origin, pos, canvasWidth, canvasHeight);
}

export type ArrangeRouteMetrics = {
  totalLength: number;
  excessiveEdgeCount: number;
  totalBends: number;
  nonJunctionCrossings: number;
  cardThroughCount: number;
  totalDisplacement: number;
  occupiedArea: number;
  edgeGaps: Array<{ id: string; gap: number; excessive: boolean }>;
};

export function measureConnectionLayoutMetrics(input: {
  cards: RelatedDiagramCard[];
  connections: RelatedDiagramConnection[];
  routes?: Array<{ connectionId: string; points: Point[] }>;
  originCards?: RelatedDiagramCard[];
  junctionCount?: number;
}): ArrangeRouteMetrics {
  const byId = new Map(input.cards.map((card) => [card.id, card]));
  const origin = new Map(
    (input.originCards ?? input.cards).map((card) => [
      card.id,
      { x: card.layout.x, y: card.layout.y },
    ]),
  );
  const rects = input.cards.map((card) => ({ id: card.id, ...card.layout }));
  const ordered = [...input.connections].sort((a, b) => compareId(a.id, b.id));
  const routeById = new Map((input.routes ?? []).map((row) => [row.connectionId, row.points]));
  const routes: Point[][] = [];
  let totalLength = 0;
  let totalBends = 0;
  let cardThroughCount = 0;
  let excessiveEdgeCount = 0;
  const edgeGaps: ArrangeRouteMetrics["edgeGaps"] = [];
  for (const conn of ordered) {
    const source = byId.get(conn.sourceCardId);
    const target = byId.get(conn.targetCardId);
    if (!source || !target) continue;
    const gap = orthogonalBorderGap(source.layout, target.layout);
    const excessive = isExcessiveEdgeGap(gap);
    if (excessive) excessiveEdgeCount += 1;
    edgeGaps.push({ id: conn.id, gap, excessive });
    const points = routeById.get(conn.id) ?? lRoute(source.layout, target.layout);
    routes.push(points);
    totalLength += polylineLength(points);
    totalBends += countBends(points);
    cardThroughCount += countPolylineCardHits(
      points,
      rects,
      new Set([source.id, target.id]),
    );
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let totalDisplacement = 0;
  for (const card of input.cards) {
    minX = Math.min(minX, card.layout.x);
    minY = Math.min(minY, card.layout.y);
    maxX = Math.max(maxX, card.layout.x + card.layout.width);
    maxY = Math.max(maxY, card.layout.y + card.layout.height);
    const start = origin.get(card.id);
    if (start) {
      totalDisplacement +=
        Math.abs(card.layout.x - start.x) + Math.abs(card.layout.y - start.y);
    }
  }
  const occupiedArea =
    input.cards.length === 0 ? 0 : Math.max(0, maxX - minX) * Math.max(0, maxY - minY);
  const rawCrossings = countLRouteCrossings(routes);
  const junctions = input.junctionCount ?? 0;
  return {
    totalLength,
    excessiveEdgeCount,
    totalBends,
    nonJunctionCrossings: Math.max(0, rawCrossings - junctions),
    cardThroughCount,
    totalDisplacement,
    occupiedArea,
    edgeGaps: edgeGaps.sort((a, b) => compareId(a.id, b.id)),
  };
}
