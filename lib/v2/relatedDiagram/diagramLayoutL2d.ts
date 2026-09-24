/**
 * L2-D D0–D2: incremental Arrange + Knowledge layer relayout.
 * D3/D4/D5 are not implemented here.
 */

import { A3_HEIGHT_PX, A3_WIDTH_PX } from "./a3Canvas";
import { getA3LegendBounds } from "./a3Legend";
import { CARD_MIN_GAP, isLegalCardPlacement } from "./cardCollision";
import { cloneTopology } from "./diagramHistory";
import {
  countPolylineBoundsHits,
  countPolylineCardHits,
  countPolylineLegendHits,
} from "./diagramLayoutL2";
import {
  analyzeRouteReadability,
  routeHighwayFlag,
} from "./diagramLayoutL2b";
import { knowledgeCardsOf } from "./knowledgeGroupLayout";
import {
  classifyRouteInteractions,
  countBends,
  edgeMidpoint,
  polylineLength,
  type EdgeSide,
  type Point,
} from "./orthogonalRouting";
import {
  cardObstacle,
  defaultRouteCanvas,
  selectBestOrthogonalRoute,
} from "./routeHardening";
import { repairRouteEndpoint } from "./repairRouteEndpoint";
import {
  isStudentManualRoute,
  type RelatedDiagramRouteTopology,
} from "./routeTopology";
import {
  cloneStableRouteState,
  pointsDeepEqual,
  stableRoutesList,
  type StableRouteState,
  type StoredRouteGeometry,
} from "./incrementalRoutes";
import type {
  RelatedDiagramCard,
  RelatedDiagramConnection,
} from "./types";

export const L2D_GAP_MIN = 48;
export const L2D_GAP_PREFERRED = 96;
export const L2D_GAP_SIBLING = 48;
export const L2D_GAP_MAX = 220;
export const L2D_JUNCTION_TRUNK = 36;
export const L2D_A3_MARGIN = 24;
export const L2D_ROUTE_GUTTER = 36;
const LOCAL_SHIFTS = [0, -48, 48, -96, 96, -24, 24, -72, 72, -144, 144, -192, 192];

const EDGES: EdgeSide[] = ["bottom", "top", "right", "left"];

function compareId(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function toPx(value: number): number {
  return Math.round(value);
}

function centerOf(card: RelatedDiagramCard): Point {
  return {
    x: card.layout.x + card.layout.width / 2,
    y: card.layout.y + card.layout.height / 2,
  };
}

function knowledgeInternalConnections(
  cards: RelatedDiagramCard[],
  connections: RelatedDiagramConnection[],
): RelatedDiagramConnection[] {
  const ids = new Set(knowledgeCardsOf(cards).map((card) => card.id));
  return connections.filter(
    (conn) => ids.has(conn.sourceCardId) && ids.has(conn.targetCardId),
  );
}

export function deriveKnowledgeLayers(input: {
  cards: RelatedDiagramCard[];
  connections: RelatedDiagramConnection[];
}): Map<string, number> {
  const knowledge = knowledgeCardsOf(input.cards).sort((a, b) =>
    compareId(a.id, b.id),
  );
  const ids = new Set(knowledge.map((card) => card.id));
  const edges = knowledgeInternalConnections(input.cards, input.connections);
  const adj = new Map<string, string[]>();
  const indegree = new Map<string, number>();
  for (const card of knowledge) {
    adj.set(card.id, []);
    indegree.set(card.id, 0);
  }
  for (const conn of edges) {
    adj.get(conn.sourceCardId)!.push(conn.targetCardId);
    indegree.set(conn.targetCardId, (indegree.get(conn.targetCardId) ?? 0) + 1);
  }
  for (const [, next] of adj) next.sort(compareId);

  const color = new Map<string, 0 | 1 | 2>();
  const back = new Set<string>();
  const edgeKey = (a: string, b: string) => `${a}>${b}`;
  const visit = (id: string) => {
    color.set(id, 1);
    for (const next of adj.get(id) ?? []) {
      const state = color.get(next) ?? 0;
      if (state === 1) back.add(edgeKey(id, next));
      else if (state === 0) visit(next);
    }
    color.set(id, 2);
  };
  for (const card of knowledge) {
    if ((color.get(card.id) ?? 0) === 0) visit(card.id);
  }
  for (const conn of edges) {
    if (!back.has(edgeKey(conn.sourceCardId, conn.targetCardId))) continue;
    indegree.set(
      conn.targetCardId,
      Math.max(0, (indegree.get(conn.targetCardId) ?? 0) - 1),
    );
    adj.set(
      conn.sourceCardId,
      (adj.get(conn.sourceCardId) ?? []).filter((id) => id !== conn.targetCardId),
    );
  }

  const layers = new Map<string, number>();
  const queue = knowledge
    .map((card) => card.id)
    .filter((id) => (indegree.get(id) ?? 0) === 0)
    .sort(compareId);
  for (const id of queue) layers.set(id, 0);
  const seen = new Set(queue);
  for (let i = 0; i < queue.length; i += 1) {
    const id = queue[i]!;
    const layer = layers.get(id) ?? 0;
    for (const next of adj.get(id) ?? []) {
      const nextLayer = Math.max(layers.get(next) ?? 0, layer + 1);
      layers.set(next, nextLayer);
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  const leftover = knowledge
    .map((card) => card.id)
    .filter((id) => !layers.has(id))
    .sort(compareId);
  const maxLayer = [...layers.values()].reduce((max, n) => Math.max(max, n), 0);
  leftover.forEach((id, index) => layers.set(id, maxLayer + 1 + index));
  return layers;
}

export function dominantUnitFlow(input: {
  cards: RelatedDiagramCard[];
  connections: RelatedDiagramConnection[];
}): "vertical" | "horizontal" {
  const byId = new Map(input.cards.map((card) => [card.id, card]));
  const dxs: number[] = [];
  const dys: number[] = [];
  for (const conn of [...input.connections].sort((a, b) => compareId(a.id, b.id))) {
    const source = byId.get(conn.sourceCardId);
    const target = byId.get(conn.targetCardId);
    if (!source || !target) continue;
    dxs.push(centerOf(target).x - centerOf(source).x);
    dys.push(centerOf(target).y - centerOf(source).y);
  }
  if (dxs.length === 0) return "vertical";
  const meanAbs = (values: number[]) =>
    values.reduce((sum, value) => sum + Math.abs(value), 0) / values.length;
  if (meanAbs(dys) >= meanAbs(dxs)) return "vertical";
  return "horizontal";
}

export function knowledgeUnitFlow(input: {
  cards: RelatedDiagramCard[];
  connections: RelatedDiagramConnection[];
  layers?: Map<string, number>;
}): "vertical" | "horizontal" {
  const layers = input.layers ?? deriveKnowledgeLayers(input);
  const maxLayer = [...layers.values()].reduce((max, n) => Math.max(max, n), 0);
  if (maxLayer >= 1) return "vertical";
  return dominantUnitFlow(input);
}

function applyPos(
  card: RelatedDiagramCard,
  x: number,
  y: number,
): RelatedDiagramCard {
  return {
    ...card,
    layout: { ...card.layout, x: toPx(x), y: toPx(y) },
  };
}

function layerCards(
  knowledge: RelatedDiagramCard[],
  layers: Map<string, number>,
): Map<number, RelatedDiagramCard[]> {
  const byLayer = new Map<number, RelatedDiagramCard[]>();
  for (const card of knowledge) {
    const layer = layers.get(card.id) ?? 0;
    const list = byLayer.get(layer) ?? [];
    list.push(card);
    byLayer.set(layer, list);
  }
  for (const [layer, list] of byLayer) {
    list.sort((a, b) => {
      if (a.layout.x !== b.layout.x) return a.layout.x - b.layout.x;
      return compareId(a.id, b.id);
    });
    byLayer.set(layer, list);
  }
  return byLayer;
}

function parentsOf(
  id: string,
  connections: RelatedDiagramConnection[],
): string[] {
  return connections
    .filter((conn) => conn.targetCardId === id)
    .map((conn) => conn.sourceCardId)
    .sort(compareId);
}

function childrenOf(
  id: string,
  connections: RelatedDiagramConnection[],
): string[] {
  return connections
    .filter((conn) => conn.sourceCardId === id)
    .map((conn) => conn.targetCardId)
    .sort(compareId);
}

function immediateParentsOf(
  id: string,
  connections: RelatedDiagramConnection[],
  layers: Map<string, number>,
): string[] {
  const layer = layers.get(id) ?? 0;
  return parentsOf(id, connections).filter((parent) => (layers.get(parent) ?? 0) === layer - 1);
}

function immediateChildrenOf(
  id: string,
  connections: RelatedDiagramConnection[],
  layers: Map<string, number>,
): string[] {
  const layer = layers.get(id) ?? 0;
  return childrenOf(id, connections).filter((child) => (layers.get(child) ?? 0) === layer + 1);
}

function resolveSameLayerOverlaps(
  cards: RelatedDiagramCard[],
  gap = L2D_GAP_SIBLING,
): RelatedDiagramCard[] {
  const next = [...cards].sort((a, b) => {
    if (a.layout.x !== b.layout.x) return a.layout.x - b.layout.x;
    return cards.indexOf(a) - cards.indexOf(b);
  });
  for (let i = 1; i < next.length; i += 1) {
    const prev = next[i - 1]!;
    const cur = next[i]!;
    const minX = prev.layout.x + prev.layout.width + gap;
    if (cur.layout.x < minX) {
      next[i] = applyPos(cur, minX, cur.layout.y);
    }
  }
  return next;
}

function adjacentSwapIfBlocked(
  ordered: RelatedDiagramCard[],
  connections: RelatedDiagramConnection[],
  others: RelatedDiagramCard[],
): RelatedDiagramCard[] {
  if (ordered.length < 2) return ordered;
  let current = [...ordered];
  for (let i = 0; i < current.length - 1; i += 1) {
    const a = current[i]!;
    const b = current[i + 1]!;
    const swapped = [...current];
    swapped[i] = applyPos(b, a.layout.x, a.layout.y);
    swapped[i + 1] = applyPos(
      a,
      a.layout.x + b.layout.width + L2D_GAP_SIBLING,
      b.layout.y,
    );
    const packed = resolveSameLayerOverlaps(swapped);
    const sceneNow = [...others, ...current];
    const sceneSwap = [...others, ...packed];
    const throughNow = connections.reduce(
      (sum, conn) =>
        sum +
        countPolylineCardHits(
          [
            edgeMidpoint(a.layout, "right"),
            edgeMidpoint(b.layout, "left"),
          ],
          sceneNow.map((card) => ({ id: card.id, ...card.layout })),
          new Set([a.id, b.id]),
        ),
      0,
    );
    const throughSwap = connections.reduce(
      (sum, conn) =>
        sum +
        countPolylineCardHits(
          [
            edgeMidpoint(packed[i]!.layout, "right"),
            edgeMidpoint(packed[i + 1]!.layout, "left"),
          ],
          sceneSwap.map((card) => ({ id: card.id, ...card.layout })),
          new Set([packed[i]!.id, packed[i + 1]!.id]),
        ),
      0,
    );
    if (throughSwap < throughNow) current = packed;
  }
  return current;
}

function translateKnowledge(
  knowledge: RelatedDiagramCard[],
  dx: number,
  dy: number,
): RelatedDiagramCard[] {
  return knowledge.map((card) =>
    applyPos(card, card.layout.x + dx, card.layout.y + dy),
  );
}

function knowledgeFreeBounds(others: RelatedDiagramCard[]) {
  const legend = getA3LegendBounds();
  let right = A3_WIDTH_PX - L2D_A3_MARGIN;
  let bottom = A3_HEIGHT_PX - L2D_A3_MARGIN;
  for (const card of others) {
    const cx = card.layout.x + card.layout.width / 2;
    const cy = card.layout.y + card.layout.height / 2;
    if (cx < A3_WIDTH_PX * 0.55) {
      bottom = Math.min(bottom, card.layout.y - CARD_MIN_GAP);
    }
    if (cy < A3_HEIGHT_PX * 0.55) {
      right = Math.min(right, card.layout.x - CARD_MIN_GAP);
    }
  }
  right = Math.min(right, legend.x - CARD_MIN_GAP);
  return {
    x: L2D_A3_MARGIN,
    y: L2D_A3_MARGIN,
    right: Math.max(L2D_A3_MARGIN + 400, right),
    bottom: Math.max(L2D_A3_MARGIN + 300, bottom),
  };
}

function packRow(
  items: RelatedDiagramCard[],
  x: number,
  y: number,
  gap = L2D_GAP_SIBLING,
): RelatedDiagramCard[] {
  let cursor = x;
  const packed: RelatedDiagramCard[] = [];
  for (const card of items) {
    packed.push(applyPos(card, cursor, y));
    cursor += card.layout.width + gap;
  }
  return packed;
}

function bboxOf(cards: RelatedDiagramCard[]) {
  return {
    x: Math.min(...cards.map((card) => card.layout.x)),
    y: Math.min(...cards.map((card) => card.layout.y)),
    right: Math.max(...cards.map((card) => card.layout.x + card.layout.width)),
    bottom: Math.max(...cards.map((card) => card.layout.y + card.layout.height)),
  };
}

function clampX(
  x: number,
  width: number,
  bounds: { x: number; right: number },
): number {
  const maxX = bounds.right - width;
  if (maxX < bounds.x) return toPx(bounds.x);
  return toPx(Math.min(Math.max(bounds.x, x), maxX));
}

function shiftIntoBounds(
  knowledge: RelatedDiagramCard[],
  bounds: { x: number; y: number; right: number; bottom: number },
): RelatedDiagramCard[] {
  if (knowledge.length === 0) return knowledge;
  const box = bboxOf(knowledge);
  let dx = 0;
  let dy = 0;
  if (box.x < bounds.x) dx += bounds.x - box.x;
  if (box.y < bounds.y) dy += bounds.y - box.y;
  if (box.right + dx > bounds.right) dx -= box.right + dx - bounds.right;
  if (box.bottom + dy > bounds.bottom) dy -= box.bottom + dy - bounds.bottom;
  const shifted = translateKnowledge(knowledge, dx, dy);
  const box2 = bboxOf(shifted);
  return translateKnowledge(
    shifted,
    box2.x < bounds.x ? bounds.x - box2.x : 0,
    box2.y < bounds.y ? bounds.y - box2.y : 0,
  );
}

function groupIsLegal(
  cards: RelatedDiagramCard[],
  obstacles: RelatedDiagramCard[],
): boolean {
  return cards.every((card) =>
    isLegalCardPlacement(
      card.layout,
      obstacles.filter((item) => item.id !== card.id),
      { minGap: CARD_MIN_GAP },
    ),
  );
}

function groupWidth(
  group: { cards: RelatedDiagramCard[] },
  gap: number,
): number {
  return (
    group.cards.reduce((sum, card) => sum + card.layout.width, 0) +
    gap * Math.max(0, group.cards.length - 1)
  );
}

function affinityXs(
  desired: number,
  width: number,
  bounds: { x: number; right: number },
): number[] {
  const seen = new Set<number>();
  const preferred: number[] = [];
  const extras: number[] = [];
  const add = (bucket: number[], x: number) => {
    const next = clampX(x, width, bounds);
    if (seen.has(next)) return;
    seen.add(next);
    bucket.push(next);
  };
  for (const dx of LOCAL_SHIFTS) add(preferred, desired + dx);
  const minX = bounds.x;
  const maxX = Math.max(bounds.x, bounds.right - width);
  for (let x = minX; x <= maxX; x += L2D_GAP_SIBLING) add(extras, x);
  add(extras, maxX);
  extras.sort((a, b) => {
    const da = Math.abs(a - desired);
    const db = Math.abs(b - desired);
    if (da !== db) return da - db;
    return a - b;
  });
  return [...preferred, ...extras];
}

function groupIsCompact(
  cards: RelatedDiagramCard[],
  gap = L2D_GAP_SIBLING,
): boolean {
  if (cards.length <= 1) return true;
  const ordered = [...cards].sort((a, b) => {
    if (a.layout.x !== b.layout.x) return a.layout.x - b.layout.x;
    return compareId(a.id, b.id);
  });
  for (let i = 1; i < ordered.length; i += 1) {
    const prev = ordered[i - 1]!;
    const cur = ordered[i]!;
    if (cur.layout.y !== prev.layout.y) return false;
    const extra = cur.layout.x - (prev.layout.x + prev.layout.width);
    if (extra > gap + 8) return false;
  }
  return true;
}

function placeGroupWithAffinity(input: {
  group: { desired: number; cards: RelatedDiagramCard[] };
  rowY: number;
  gap: number;
  bounds: { x: number; right: number };
  obstacles: RelatedDiagramCard[];
}): RelatedDiagramCard[] {
  const width = groupWidth(input.group, input.gap);
  const height = Math.max(
    ...input.group.cards.map((card) => card.layout.height),
    0,
  );
  const existing = input.group.cards;
  const sameY = existing.every((card) => card.layout.y === existing[0]!.layout.y);
  const existingY = existing[0]?.layout.y ?? input.rowY;
  const onIntended = Math.abs(existingY - input.rowY) <= 16;
  const droppedFromRow =
    existingY >= input.rowY + height + L2D_GAP_MIN - 16;
  const currentLeft = Math.min(...existing.map((card) => card.layout.x));
  const desiredLeft = clampX(input.group.desired, width, input.bounds);
  if (
    sameY &&
    (onIntended || droppedFromRow) &&
    Math.abs(currentLeft - desiredLeft) <= 48 &&
    groupIsCompact(existing, input.gap) &&
    groupIsLegal(existing, input.obstacles)
  ) {
    return existing;
  }
  const xs = affinityXs(input.group.desired, width, input.bounds);
  const tryAt = (x: number, y: number): RelatedDiagramCard[] | null => {
    const row = packRow(input.group.cards, x, y, input.gap);
    return groupIsLegal(row, input.obstacles) ? row : null;
  };
  for (const x of xs) {
    const hit = tryAt(x, input.rowY);
    if (hit) return hit;
  }
  for (let step = 1; step <= 4; step += 1) {
    const y = input.rowY + step * (height + L2D_GAP_MIN);
    for (const x of xs) {
      const hit = tryAt(x, y);
      if (hit) return hit;
    }
  }
  return packRow(
    input.group.cards,
    clampX(input.group.desired, width, input.bounds),
    input.rowY,
    input.gap,
  );
}

function cardsByRow(cards: RelatedDiagramCard[]): RelatedDiagramCard[][] {
  const byY = new Map<number, RelatedDiagramCard[]>();
  for (const card of cards) {
    const list = byY.get(card.layout.y) ?? [];
    list.push(card);
    byY.set(card.layout.y, list);
  }
  return [...byY.entries()]
    .sort((a, b) => a[0] - b[0] || compareId(a[1][0]!.id, b[1][0]!.id))
    .map(([, row]) => row);
}

function dominantRowY(cards: RelatedDiagramCard[]): number {
  const counts = new Map<number, number>();
  for (const card of cards) {
    counts.set(card.layout.y, (counts.get(card.layout.y) ?? 0) + 1);
  }
  let bestY = Math.max(...cards.map((card) => card.layout.y));
  let bestCount = -1;
  for (const [y, count] of [...counts.entries()].sort((a, b) => a[0] - b[0])) {
    if (count > bestCount || (count === bestCount && y > bestY)) {
      bestY = y;
      bestCount = count;
    }
  }
  return bestY;
}

function tightenSameRowGaps(
  cards: RelatedDiagramCard[],
  obstacles: RelatedDiagramCard[],
  gap = L2D_GAP_SIBLING,
): RelatedDiagramCard[] {
  const next = [...cards].sort((a, b) => {
    if (a.layout.x !== b.layout.x) return a.layout.x - b.layout.x;
    return compareId(a.id, b.id);
  });
  for (let i = 1; i < next.length; i += 1) {
    const prev = next[i - 1]!;
    const cur = next[i]!;
    if (cur.layout.y !== prev.layout.y) continue;
    const minX = prev.layout.x + prev.layout.width + gap;
    if (cur.layout.x <= minX) continue;
    const pulled = applyPos(cur, minX, cur.layout.y);
    const blockers = [
      ...obstacles,
      ...next.filter((item) => item.id !== cur.id),
    ];
    if (groupIsLegal([pulled], blockers)) next[i] = pulled;
  }
  return next;
}

function dropOverlappingGroups(
  knowledge: RelatedDiagramCard[],
  others: RelatedDiagramCard[],
  connections: RelatedDiagramConnection[],
  layers: Map<string, number>,
): RelatedDiagramCard[] {
  const byId = new Map(knowledge.map((card) => [card.id, card]));
  const parents = [
    ...new Set(
      knowledge.flatMap((card) => immediateParentsOf(card.id, connections, layers)),
    ),
  ].sort(compareId);
  for (const parentId of parents) {
    const kids = immediateChildrenOf(parentId, connections, layers)
      .map((id) => byId.get(id))
      .filter((item): item is RelatedDiagramCard => item != null)
      .sort((a, b) => a.layout.x - b.layout.x || compareId(a.id, b.id));
    if (kids.length === 0) continue;
    const obstacles = [
      ...others,
      ...[...byId.values()].filter(
        (card) => !kids.some((kid) => kid.id === card.id),
      ),
    ];
    if (groupIsLegal(kids, obstacles)) continue;
    const parent = byId.get(parentId);
    const width =
      kids.reduce((sum, card) => sum + card.layout.width, 0) +
      L2D_GAP_SIBLING * Math.max(0, kids.length - 1);
    const desired = parent
      ? parent.layout.x + parent.layout.width / 2 - width / 2
      : Math.min(...kids.map((card) => card.layout.x));
    const placed = placeGroupWithAffinity({
      group: { desired, cards: kids },
      rowY: dominantRowY(kids),
      gap: L2D_GAP_SIBLING,
      bounds: {
        x: L2D_A3_MARGIN,
        right: A3_WIDTH_PX - L2D_A3_MARGIN,
      },
      obstacles,
    });
    for (const card of placed) byId.set(card.id, card);
  }
  return knowledge.map((card) => byId.get(card.id) ?? card);
}

function realignDroppedChildren(
  knowledge: RelatedDiagramCard[],
  others: RelatedDiagramCard[],
  connections: RelatedDiagramConnection[],
  layers: Map<string, number>,
): RelatedDiagramCard[] {
  const byId = new Map(knowledge.map((card) => [card.id, card]));
  const parents = [
    ...new Set(
      knowledge.flatMap((card) =>
        immediateParentsOf(card.id, connections, layers),
      ),
    ),
  ].sort(compareId);
  for (const parentId of parents) {
    const parent = byId.get(parentId);
    const kids = immediateChildrenOf(parentId, connections, layers)
      .map((id) => byId.get(id))
      .filter((item): item is RelatedDiagramCard => item != null)
      .sort((a, b) => a.layout.x - b.layout.x || compareId(a.id, b.id));
    if (!parent || kids.length === 0) continue;
    const dropped =
      Math.min(...kids.map((card) => card.layout.y)) >
      parent.layout.y + parent.layout.height + L2D_GAP_MAX + 16;
    if (!dropped) continue;
    const width =
      kids.reduce((sum, card) => sum + card.layout.width, 0) +
      L2D_GAP_SIBLING * Math.max(0, kids.length - 1);
    const desired = parent.layout.x + parent.layout.width / 2 - width / 2;
    if (Math.abs(Math.min(...kids.map((card) => card.layout.x)) - desired) <= 8) {
      continue;
    }
    const obstacles = [
      ...others,
      ...[...byId.values()].filter(
        (card) => !kids.some((kid) => kid.id === card.id),
      ),
    ];
    const bounds = {
      x: L2D_A3_MARGIN,
      right: A3_WIDTH_PX - L2D_A3_MARGIN,
    };
    const rowY = dominantRowY(kids);
    const underParent = packRow(
      kids,
      clampX(desired, width, bounds),
      rowY,
      L2D_GAP_SIBLING,
    );
    const placed = groupIsLegal(underParent, obstacles)
      ? underParent
      : placeGroupWithAffinity({
          group: { desired, cards: kids },
          rowY,
          gap: L2D_GAP_SIBLING,
          bounds,
          obstacles,
        });
    for (const card of placed) byId.set(card.id, card);
  }
  return knowledge.map((card) => byId.get(card.id) ?? card);
}

function clampKnowledgeToCanvas(
  knowledge: RelatedDiagramCard[],
  others: RelatedDiagramCard[],
  connections: RelatedDiagramConnection[],
  layers: Map<string, number>,
): RelatedDiagramCard[] {
  if (knowledge.length === 0) return knowledge;
  const bounds = knowledgeFreeBounds(others);
  const shifted = shiftIntoBounds(knowledge, bounds);
  const dropped = dropOverlappingGroups(shifted, others, connections, layers);
  return realignDroppedChildren(dropped, others, connections, layers);
}

function knowledgeAlreadySettled(input: {
  cards: RelatedDiagramCard[];
  connections: RelatedDiagramConnection[];
}): boolean {
  const knowledge = knowledgeCardsOf(input.cards);
  if (knowledge.length === 0) return true;
  const others = input.cards.filter((card) => card.cardType !== "knowledge");
  if (!groupIsLegal(knowledge, others)) return false;
  const internals = knowledgeInternalConnections(input.cards, input.connections);
  const layers = deriveKnowledgeLayers(input);
  const byLayer = layerCards(knowledge, layers);
  const layerIds = [...byLayer.keys()].sort((a, b) => a - b);
  let prevBottom = Number.NEGATIVE_INFINITY;
  for (const layer of layerIds) {
    const row = byLayer.get(layer) ?? [];
    if (row.length === 0) continue;
    const minY = Math.min(...row.map((card) => card.layout.y));
    const bottom = Math.max(
      ...row.map((card) => card.layout.y + card.layout.height),
    );
    if (minY + 1 < prevBottom + CARD_MIN_GAP) return false;
    prevBottom = bottom;
    for (const band of cardsByRow(row)) {
      if (!groupIsCompact(band)) return false;
    }
  }
  const byId = new Map(knowledge.map((card) => [card.id, card]));
  for (const card of knowledge) {
    const kids = immediateChildrenOf(card.id, internals, layers)
      .map((id) => byId.get(id))
      .filter((item): item is RelatedDiagramCard => item != null);
    for (const band of cardsByRow(kids)) {
      if (band.length >= 2 && !groupIsCompact(band)) return false;
    }
  }
  return true;
}

export function layoutKnowledgeLayers(input: {
  cards: RelatedDiagramCard[];
  connections: RelatedDiagramConnection[];
}): RelatedDiagramCard[] {
  const knowledge = knowledgeCardsOf(input.cards).sort((a, b) =>
    compareId(a.id, b.id),
  );
  if (knowledge.length === 0) return input.cards;
  if (knowledgeAlreadySettled(input)) return input.cards;
  const internals = knowledgeInternalConnections(input.cards, input.connections);
  const layers = deriveKnowledgeLayers(input);
  const flow = knowledgeUnitFlow({
    cards: knowledge,
    connections: internals,
    layers,
  });
  const byLayer = layerCards(knowledge, layers);
  const layerIds = [...byLayer.keys()].sort((a, b) => a - b);
  const others = input.cards.filter((card) => card.cardType !== "knowledge");
  const rawBounds = knowledgeFreeBounds(others);
  const bounds = {
    ...rawBounds,
    x: rawBounds.x + L2D_ROUTE_GUTTER,
    right: rawBounds.right - L2D_ROUTE_GUTTER,
  };
  const layerHeights = layerIds.map((layer) =>
    Math.max(...(byLayer.get(layer) ?? []).map((card) => card.layout.height), 0),
  );
  const totalHeight = layerHeights.reduce((sum, h) => sum + h, 0);
  const gapSlots = Math.max(0, layerIds.length - 1);
  const available = Math.max(0, bounds.bottom - bounds.y - totalHeight);
  const rawGap = gapSlots === 0 ? L2D_GAP_PREFERRED : available / gapSlots;
  const layerGap = Math.max(L2D_GAP_MIN, Math.min(L2D_GAP_MAX, rawGap));

  const placed = new Map<string, RelatedDiagramCard>();
  let cursor = bounds.y;

  for (const layer of layerIds) {
    const row = (byLayer.get(layer) ?? []).map((card) => placed.get(card.id) ?? card);
    const gap = L2D_GAP_SIBLING;
    const remaining = new Set(row.map((card) => card.id));
    type Group = { desired: number; cards: RelatedDiagramCard[] };
    const groups: Group[] = [];
    const immediatePrev = layer === layerIds[0] ? [] : [layer - 1];
    const prevCards = immediatePrev
      .flatMap((id) => byLayer.get(id) ?? [])
      .map((card) => placed.get(card.id))
      .filter((item): item is RelatedDiagramCard => item != null)
      .sort((a, b) => a.layout.x - b.layout.x || compareId(a.id, b.id));

    if (flow === "vertical") {
      for (const parent of prevCards) {
        const kids = row
          .filter(
            (card) =>
              remaining.has(card.id) &&
              immediateChildrenOf(parent.id, internals, layers).includes(card.id) &&
              immediateParentsOf(card.id, internals, layers).length <= 1,
          )
          .sort((a, b) => a.layout.x - b.layout.x || compareId(a.id, b.id));
        if (kids.length === 0) continue;
        const width =
          kids.reduce((sum, card) => sum + card.layout.width, 0) +
          gap * Math.max(0, kids.length - 1);
        groups.push({
          desired: parent.layout.x + parent.layout.width / 2 - width / 2,
          cards: kids,
        });
        for (const kid of kids) remaining.delete(kid.id);
      }
      const merges = row.filter(
        (card) =>
          remaining.has(card.id) &&
          immediateParentsOf(card.id, internals, layers).length >= 2,
      );
      for (const child of merges) {
        const pars = immediateParentsOf(child.id, internals, layers)
          .map((id) => placed.get(id))
          .filter((item): item is RelatedDiagramCard => item != null);
        const mid =
          pars.length === 0
            ? bounds.x
            : (Math.min(...pars.map((item) => item.layout.x)) +
                Math.max(
                  ...pars.map((item) => item.layout.x + item.layout.width),
                )) /
              2;
        groups.push({
          desired: mid - child.layout.width / 2,
          cards: [child],
        });
        remaining.delete(child.id);
      }
      const leftovers = row
        .filter((card) => remaining.has(card.id))
        .sort((a, b) => a.layout.x - b.layout.x || compareId(a.id, b.id));
      if (leftovers.length > 0) {
        groups.push({ desired: bounds.x, cards: leftovers });
      }
    } else {
      groups.push({ desired: bounds.x, cards: row });
    }

    groups.sort((a, b) => {
      if (a.desired !== b.desired) return a.desired - b.desired;
      return compareId(a.cards[0]!.id, b.cards[0]!.id);
    });

    const packed: RelatedDiagramCard[] = [];
    const replacedIds = new Set<string>();
    const rowY = flow === "vertical" ? cursor : bounds.y;
    for (const group of groups) {
      const nextGroup = placeGroupWithAffinity({
        group,
        rowY,
        gap,
        bounds,
        obstacles: [...others, ...placed.values(), ...packed],
      });
      const previous = new Map(group.cards.map((card) => [card.id, card]));
      for (const card of nextGroup) {
        const before = previous.get(card.id);
        if (
          !before ||
          before.layout.x !== card.layout.x ||
          before.layout.y !== card.layout.y
        ) {
          replacedIds.add(card.id);
        }
      }
      packed.push(...nextGroup);
    }
    const rowBuckets = cardsByRow(packed);
    const tightened = rowBuckets.flatMap((row) =>
      tightenSameRowGaps(row, [...others, ...placed.values()]),
    );
    const tightenedRows = cardsByRow(tightened);
    const cleaned = tightenedRows.flatMap((row, index) =>
      adjacentSwapIfBlocked(row, internals, [
        ...others,
        ...placed.values(),
        ...tightenedRows.filter((_, other) => other !== index).flat(),
      ]),
    );
    for (const card of cleaned) placed.set(card.id, card);
    if (flow === "vertical") {
      for (const parent of prevCards) {
        const kids = immediateChildrenOf(parent.id, internals, layers)
          .filter((id) => immediateParentsOf(id, internals, layers).length === 1)
          .map((id) => placed.get(id))
          .filter((item): item is RelatedDiagramCard => item != null);
        if (kids.length < 2) continue;
        if (!kids.some((kid) => replacedIds.has(kid.id))) continue;
        const kidY = kids[0]!.layout.y;
        const sameRow = kids.every((kid) => kid.layout.y === kidY);
        const close =
          kidY <=
          parent.layout.y + parent.layout.height + layerGap + 16;
        if (!sameRow || !close) continue;
        const mid =
          (Math.min(...kids.map((item) => item.layout.x)) +
            Math.max(...kids.map((item) => item.layout.x + item.layout.width))) /
          2;
        placed.set(
          parent.id,
          applyPos(
            parent,
            clampX(mid - parent.layout.width / 2, parent.layout.width, bounds),
            parent.layout.y,
          ),
        );
      }
    }
    const rowHeight = Math.max(...cleaned.map((card) => card.layout.height), 0);
    cursor += rowHeight + layerGap;
  }

  let nextKnowledge = [...placed.values()].sort((a, b) => compareId(a.id, b.id));
  nextKnowledge = clampKnowledgeToCanvas(
    nextKnowledge,
    others,
    internals,
    layers,
  );
  const byY = new Map<number, RelatedDiagramCard[]>();
  for (const card of nextKnowledge) {
    const list = byY.get(card.layout.y) ?? [];
    list.push(card);
    byY.set(card.layout.y, list);
  }
  nextKnowledge = [...byY.values()].flatMap((row) =>
    resolveSameLayerOverlaps(row, L2D_GAP_SIBLING),
  );
  const byNext = new Map(nextKnowledge.map((card) => [card.id, card]));
  return input.cards.map((card) => byNext.get(card.id) ?? card);
}

function junctionConnectionIds(
  topology?: RelatedDiagramRouteTopology,
): Set<string> {
  const ids = new Set<string>();
  for (const group of topology?.routeGroups ?? []) {
    for (const id of group.connectionIds) ids.add(id);
  }
  return ids;
}

function normalizePoly(points: Point[]): Point[] {
  const out: Point[] = [];
  for (const point of points) {
    const next = { x: toPx(point.x), y: toPx(point.y) };
    const last = out[out.length - 1];
    if (last && last.x === next.x && last.y === next.y) continue;
    out.push(next);
  }
  return out;
}

function localFanGeometry(input: {
  source: RelatedDiagramCard;
  children: RelatedDiagramCard[];
  flow: "vertical" | "horizontal";
}): { branch: Point; sourceEdge: EdgeSide; targetEdge: EdgeSide; trunk: Point[] } {
  const sourceEdge: EdgeSide = input.flow === "vertical" ? "bottom" : "right";
  const targetEdge: EdgeSide = input.flow === "vertical" ? "top" : "left";
  const sourcePin = edgeMidpoint(input.source.layout, sourceEdge);
  const childPins = input.children.map((card) =>
    edgeMidpoint(card.layout, targetEdge),
  );
  const spanLeft = Math.min(
    input.source.layout.x,
    ...input.children.map((card) => card.layout.x),
  );
  const spanRight = Math.max(
    input.source.layout.x + input.source.layout.width,
    ...input.children.map((card) => card.layout.x + card.layout.width),
  );
  const desiredX =
    input.flow === "vertical"
      ? childPins.reduce((sum, pin) => sum + pin.x, 0) / childPins.length
      : sourcePin.x + L2D_JUNCTION_TRUNK;
  const minChildY = Math.min(...input.children.map((card) => card.layout.y));
  const gap = Math.max(20, minChildY - sourcePin.y);
  const trunkLen = Math.min(L2D_JUNCTION_TRUNK, Math.max(20, gap / 2));
  const desiredY =
    input.flow === "vertical"
      ? sourcePin.y + trunkLen
      : childPins.reduce((sum, pin) => sum + pin.y, 0) / childPins.length;
  const branch = {
    x: toPx(Math.min(spanRight, Math.max(spanLeft, desiredX))),
    y: toPx(desiredY),
  };
  const stub = {
    x: input.flow === "vertical" ? sourcePin.x : branch.x,
    y: input.flow === "vertical" ? branch.y : sourcePin.y,
  };
  const trunk = normalizePoly([sourcePin, stub, branch]);
  return { branch, sourceEdge, targetEdge, trunk };
}

function segmentHitsCards(
  a: Point,
  b: Point,
  cards: RelatedDiagramCard[],
  ignore: Set<string>,
): boolean {
  return (
    countPolylineCardHits(
      [a, b],
      cards.map((card) => ({ id: card.id, ...card.layout })),
      ignore,
    ) > 0
  );
}

function findClearX(
  y0: number,
  y1: number,
  preferred: number,
  cards: RelatedDiagramCard[],
  ignore: Set<string>,
): number {
  const lo = Math.min(y0, y1);
  const hi = Math.max(y0, y1);
  const blockers = cards.filter((card) => {
    if (ignore.has(card.id)) return false;
    return card.layout.y <= hi && card.layout.y + card.layout.height >= lo;
  });
  const candidates = [
    preferred,
    ...blockers.flatMap((card) => [
      card.layout.x - 24,
      card.layout.x + card.layout.width + 24,
    ]),
    ...blockers.map((card, i) => {
      const next = blockers[i + 1];
      if (!next) return preferred;
      return (card.layout.x + card.layout.width + next.layout.x) / 2;
    }),
  ]
    .filter((x) => x >= L2D_A3_MARGIN && x <= A3_WIDTH_PX - L2D_A3_MARGIN)
    .sort((a, b) => Math.abs(a - preferred) - Math.abs(b - preferred));
  for (const x of candidates) {
    if (
      !segmentHitsCards(
        { x, y: y0 },
        { x, y: y1 },
        cards,
        ignore,
      )
    ) {
      return toPx(x);
    }
  }
  return toPx(preferred);
}

function childLeg(
  branch: Point,
  child: RelatedDiagramCard,
  edge: EdgeSide,
  cards: RelatedDiagramCard[],
  ignore: Set<string>,
): Point[] {
  const pin = edgeMidpoint(child.layout, edge);
  const stub = {
    x: edge === "top" || edge === "bottom" ? pin.x : branch.x,
    y: edge === "top" || edge === "bottom" ? branch.y : pin.y,
  };
  const simple = normalizePoly([branch, stub, pin]);
  if (
    countPolylineCardHits(
      simple,
      cards.map((card) => ({ id: card.id, ...card.layout })),
      ignore,
    ) === 0
  ) {
    return simple;
  }
  const clearX = findClearX(branch.y, pin.y, pin.x, cards, ignore);
  const midY = pin.y + (branch.y < pin.y ? -20 : 20);
  return normalizePoly([
    branch,
    { x: clearX, y: branch.y },
    { x: clearX, y: midY },
    { x: pin.x, y: midY },
    pin,
  ]);
}

function localSpanEscape(
  points: Point[],
  source: RelatedDiagramCard,
  target: RelatedDiagramCard,
): number {
  const pairLeft = Math.min(source.layout.x, target.layout.x);
  const pairRight = Math.max(
    source.layout.x + source.layout.width,
    target.layout.x + target.layout.width,
  );
  const outside = points.some(
    (point) => point.x < pairLeft - 8 || point.x > pairRight + 8,
  );
  if (outside) return 12_000;
  const leftmost = Math.min(source.layout.x, target.layout.x);
  const rightmost = Math.max(
    source.layout.x + source.layout.width,
    target.layout.x + target.layout.width,
  );
  const alongOuterLeft = points.some((point) => Math.abs(point.x - leftmost) <= 1);
  const alongOuterRight = points.some(
    (point) => Math.abs(point.x - rightmost) <= 1,
  );
  if (
    alongOuterLeft &&
    source.layout.x <= target.layout.x &&
    target.layout.x > source.layout.x + 20
  ) {
    return 8_000;
  }
  if (
    alongOuterRight &&
    source.layout.x + source.layout.width >= target.layout.x + target.layout.width &&
    source.layout.x + source.layout.width > target.layout.x + target.layout.width + 20
  ) {
    return 8_000;
  }
  return 0;
}

function scoreRoute(
  points: Point[],
  cards: RelatedDiagramCard[],
  sourceId: string,
  targetId: string,
): number {
  const through = countPolylineCardHits(
    points,
    cards.map((card) => ({ id: card.id, ...card.layout })),
    new Set([sourceId, targetId]),
  );
  const highway = routeHighwayFlag(points);
  const bounds = countPolylineBoundsHits(points);
  const legend = countPolylineLegendHits(points);
  const bends = countBends(points);
  const length = polylineLength(points);
  if (through > 0) return 1_000_000 + through;
  if (highway > 0) return 500_000;
  if (bounds > 0 || legend > 0) return 250_000;
  if (bends >= 4) return 80_000 + bends;
  const source = cards.find((card) => card.id === sourceId);
  const target = cards.find((card) => card.id === targetId);
  const escape =
    source && target ? localSpanEscape(points, source, target) : 0;
  return escape + bends * 200 + length;
}

function inferEdges(points: Point[], source: RelatedDiagramCard, target: RelatedDiagramCard): {
  sourceEdge: EdgeSide;
  targetEdge: EdgeSide;
} {
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const sourceEdge =
    Math.abs(first.y - (source.layout.y + source.layout.height)) <= 1
      ? "bottom"
      : Math.abs(first.y - source.layout.y) <= 1
        ? "top"
        : Math.abs(first.x - (source.layout.x + source.layout.width)) <= 1
          ? "right"
          : "left";
  const targetEdge =
    Math.abs(last.y - target.layout.y) <= 1
      ? "top"
      : Math.abs(last.y - (target.layout.y + target.layout.height)) <= 1
        ? "bottom"
        : Math.abs(last.x - target.layout.x) <= 1
          ? "left"
          : "right";
  return { sourceEdge, targetEdge };
}

function verticalGapRoute(
  source: RelatedDiagramCard,
  target: RelatedDiagramCard,
): Point[] {
  const down = centerOf(source).y <= centerOf(target).y;
  const sourceEdge: EdgeSide = down ? "bottom" : "top";
  const targetEdge: EdgeSide = down ? "top" : "bottom";
  const a = edgeMidpoint(source.layout, sourceEdge);
  const d = edgeMidpoint(target.layout, targetEdge);
  const gapY = (a.y + d.y) / 2;
  return normalizePoly([a, { x: a.x, y: gapY }, { x: d.x, y: gapY }, d]);
}

function sideCorridorRoute(
  source: RelatedDiagramCard,
  target: RelatedDiagramCard,
  cards: RelatedDiagramCard[],
  side: "left" | "right",
): Point[] {
  const lo = Math.min(source.layout.y, target.layout.y);
  const hi = Math.max(
    source.layout.y + source.layout.height,
    target.layout.y + target.layout.height,
  );
  const blockers = cards.filter((card) => {
    if (card.id === source.id || card.id === target.id) return false;
    const top = card.layout.y;
    const bottom = card.layout.y + card.layout.height;
    return bottom >= lo && top <= hi;
  });
  const boxes = [source, target, ...blockers];
  const sideX =
    side === "left"
      ? Math.max(
          L2D_A3_MARGIN,
          Math.min(...boxes.map((card) => card.layout.x)) - 28,
        )
      : Math.min(
          A3_WIDTH_PX - L2D_A3_MARGIN,
          Math.max(...boxes.map((card) => card.layout.x + card.layout.width)) + 28,
        );
  const a = edgeMidpoint(source.layout, side);
  const d = edgeMidpoint(target.layout, side);
  return normalizePoly([a, { x: sideX, y: a.y }, { x: sideX, y: d.y }, d]);
}

function bestOneToOne(
  source: RelatedDiagramCard,
  target: RelatedDiagramCard,
  cards: RelatedDiagramCard[],
  prior: Point[][],
  junctions: Point[],
  flow: "vertical" | "horizontal",
): { points: Point[]; sourceEdge: EdgeSide; targetEdge: EdgeSide } {
  const obstacles = cards.map(cardObstacle);
  const bestBox: {
    current: {
      points: Point[];
      sourceEdge: EdgeSide;
      targetEdge: EdgeSide;
      score: number;
    } | null;
  } = { current: null };
  const consider = (points: Point[]) => {
    if (!points || points.length < 2) return;
    const edges = inferEdges(points, source, target);
    const score = scoreRoute(points, cards, source.id, target.id);
    if (!bestBox.current || score < bestBox.current.score) {
      bestBox.current = { points, ...edges, score };
    }
  };
  if (flow === "vertical") {
    const local = verticalGapRoute(source, target);
    consider(local);
    const localHardSafe =
      bestBox.current != null && bestBox.current.score < 80_000;
    if (!localHardSafe) {
      consider(sideCorridorRoute(source, target, cards, "left"));
      consider(sideCorridorRoute(source, target, cards, "right"));
    }
  } else {
    const a = edgeMidpoint(source.layout, "right");
    const d = edgeMidpoint(target.layout, "left");
    const gapX = (a.x + d.x) / 2;
    consider(normalizePoly([a, { x: gapX, y: a.y }, { x: gapX, y: d.y }, d]));
  }
  if (!bestBox.current || bestBox.current.score >= 80_000) {
    for (const sourceEdge of EDGES) {
      for (const targetEdge of EDGES) {
        const points = selectBestOrthogonalRoute({
          source: cardObstacle(source),
          target: cardObstacle(target),
          sourceEdge,
          targetEdge,
          obstacles,
          canvas: defaultRouteCanvas(),
          priorRoutes: prior,
          junctions,
        });
        if (points) consider(points);
      }
    }
  }
  if (bestBox.current && bestBox.current.score < 80_000) return bestBox.current;
  const fallback = verticalGapRoute(source, target);
  const edges = inferEdges(fallback, source, target);
  return { points: fallback, ...edges };
}

function storedOf(
  conn: RelatedDiagramConnection,
  source: RelatedDiagramCard,
  target: RelatedDiagramCard,
  sourceEdge: EdgeSide,
  targetEdge: EdgeSide,
  points: Point[],
): StoredRouteGeometry {
  return {
    connectionId: conn.id,
    sourceCardId: source.id,
    targetCardId: target.id,
    sourceEdge,
    targetEdge,
    sourcePin: { ...points[0]! },
    targetPin: { ...points[points.length - 1]! },
    points: points.map((point) => ({ x: point.x, y: point.y })),
  };
}

export function collectArrangeAffectedConnectionIds(input: {
  previousCards: RelatedDiagramCard[];
  nextCards: RelatedDiagramCard[];
  connections: RelatedDiagramConnection[];
  topology?: RelatedDiagramRouteTopology;
  previousTopology?: RelatedDiagramRouteTopology;
  activeUnitCardIds: string[];
}): string[] {
  const prev = new Map(input.previousCards.map((card) => [card.id, card]));
  const moved = new Set<string>();
  for (const card of input.nextCards) {
    const before = prev.get(card.id);
    if (!before) continue;
    if (before.layout.x !== card.layout.x || before.layout.y !== card.layout.y) {
      moved.add(card.id);
    }
  }
  const movedJunctions = new Set<string>();
  if (input.topology && input.previousTopology) {
    const beforeBp = new Map(
      input.previousTopology.branchPoints.map((bp) => [bp.id, bp]),
    );
    for (const bp of input.topology.branchPoints) {
      const prevBp = beforeBp.get(bp.id);
      if (!prevBp) continue;
      if (prevBp.x !== bp.x || prevBp.y !== bp.y) {
        for (const id of bp.connectionIds) movedJunctions.add(id);
      }
    }
  }
  const active = new Set(input.activeUnitCardIds);
  const ids = new Set<string>();
  for (const conn of input.connections) {
    const endpointMoved =
      moved.has(conn.sourceCardId) || moved.has(conn.targetCardId);
    const junctionMoved = movedJunctions.has(conn.id);
    const activeImprove =
      active.has(conn.sourceCardId) && active.has(conn.targetCardId);
    if (endpointMoved || junctionMoved || activeImprove) ids.add(conn.id);
  }
  return [...ids].sort(compareId);
}

export function restitchAffectedRoutes(input: {
  previous: StableRouteState;
  previousTopology?: RelatedDiagramRouteTopology;
  cards: RelatedDiagramCard[];
  connections: RelatedDiagramConnection[];
  topology?: RelatedDiagramRouteTopology;
  affectedIds: string[];
}): { routeState: StableRouteState; topology?: RelatedDiagramRouteTopology } {
  const routeState = cloneStableRouteState(input.previous);
  let topology = cloneTopology(input.topology ?? input.previousTopology);
  const byId = new Map(input.cards.map((card) => [card.id, card]));
  const connById = new Map(input.connections.map((conn) => [conn.id, conn]));
  const affected = new Set(input.affectedIds);
  const junctionIds = junctionConnectionIds(topology);
  const knowledge = knowledgeCardsOf(input.cards);
  const internals = knowledgeInternalConnections(input.cards, input.connections);
  const knowledgeIds = new Set(knowledge.map((card) => card.id));
  const knowledgeFlow = knowledgeUnitFlow({
    cards: knowledge,
    connections: internals,
  });

  if (topology) {
    for (const group of [...topology.routeGroups].sort((a, b) =>
      compareId(a.id, b.id),
    )) {
      if (!group.connectionIds.some((id) => affected.has(id))) continue;
      const source = byId.get(group.sourceCardId);
      if (!source) continue;
      const childCards: RelatedDiagramCard[] = [];
      const childConn: RelatedDiagramConnection[] = [];
      for (const id of group.connectionIds) {
        const conn = connById.get(id);
        if (!conn) continue;
        const childId =
          conn.sourceCardId === source.id ? conn.targetCardId : conn.sourceCardId;
        const child = byId.get(childId);
        if (!child) continue;
        childCards.push(child);
        childConn.push(conn);
      }
      if (childCards.length === 0) continue;
      const flow = knowledgeIds.has(source.id)
        ? knowledgeFlow
        : dominantUnitFlow({
            cards: [source, ...childCards],
            connections: childConn,
          });
      const geo = localFanGeometry({ source, children: childCards, flow });
      const bp = topology.branchPoints.find((row) =>
        group.connectionIds.every((id) => row.connectionIds.includes(id)) ||
        row.connectionIds.some((id) => group.connectionIds.includes(id)),
      );
      const trunk = topology.trunks.find((row) => row.id === group.trunkId);
      if (bp) {
        bp.x = geo.branch.x;
        bp.y = geo.branch.y;
      }
      if (trunk) trunk.points = geo.trunk.map((point) => ({ ...point }));
      for (let i = 0; i < childConn.length; i += 1) {
        const conn = childConn[i]!;
        const child = childCards[i]!;
        const ignore = new Set([source.id, child.id]);
        let points = normalizePoly([
          ...geo.trunk,
          ...childLeg(
            geo.branch,
            child,
            geo.targetEdge,
            input.cards,
            ignore,
          ).slice(1),
        ]);
        let sourceEdge = geo.sourceEdge;
        let targetEdge = geo.targetEdge;
        if (scoreRoute(points, input.cards, source.id, child.id) >= 80_000) {
          const best = bestOneToOne(
            source,
            child,
            input.cards,
            [],
            (topology?.branchPoints ?? []).map((row) => ({
              x: row.x,
              y: row.y,
            })),
            flow,
          );
          points = best.points;
          sourceEdge = best.sourceEdge;
          targetEdge = best.targetEdge;
        }
        routeState.byId[conn.id] = storedOf(
          conn,
          source,
          child,
          sourceEdge,
          targetEdge,
          points,
        );
        routeState.lastValidPoints[conn.id] = points.map((point) => ({ ...point }));
        const route = topology.routes.find((row) => row.connectionId === conn.id);
        if (route) {
          route.sourceEdge = sourceEdge;
          route.targetEdge = targetEdge;
          route.points = points.map((point) => ({ ...point }));
        }
      }
    }
  }

  const prior: Point[][] = [];
  for (const [id, route] of Object.entries(routeState.byId)) {
    if (!affected.has(id) || junctionIds.has(id)) prior.push(route.points);
  }
  const junctions = (topology?.branchPoints ?? []).map((bp) => ({
    x: bp.x,
    y: bp.y,
  }));
  for (const id of [...affected].sort(compareId)) {
    if (junctionIds.has(id)) continue;
    const conn = connById.get(id);
    const source = conn ? byId.get(conn.sourceCardId) : undefined;
    const target = conn ? byId.get(conn.targetCardId) : undefined;
    if (!conn || !source || !target) continue;
    const previous = input.previous.byId[id];
    if (previous && isStudentManualRoute(topology, conn)) {
      const sourcePin = edgeMidpoint(source.layout, previous.sourceEdge);
      const targetPin = edgeMidpoint(target.layout, previous.targetEdge);
      let points = previous.points.map((point) => ({ ...point }));
      points = repairRouteEndpoint({
        existingPoints: points,
        movingEnd: "source",
        livePin: sourcePin,
      });
      points = repairRouteEndpoint({
        existingPoints: points,
        movingEnd: "target",
        livePin: targetPin,
      });
      routeState.byId[id] = storedOf(
        conn,
        source,
        target,
        previous.sourceEdge,
        previous.targetEdge,
        points,
      );
      routeState.lastValidPoints[id] = points.map((point) => ({ ...point }));
      prior.push(points);
      if (topology) {
        const route = topology.routes.find((row) => row.connectionId === id);
        if (route) {
          route.sourceEdge = previous.sourceEdge;
          route.targetEdge = previous.targetEdge;
          route.points = points.map((point) => ({ ...point }));
        }
      }
      continue;
    }
    const flow =
      knowledgeIds.has(source.id) && knowledgeIds.has(target.id)
        ? knowledgeFlow
        : dominantUnitFlow({ cards: [source, target], connections: [conn] });
    const best = bestOneToOne(
      source,
      target,
      input.cards,
      prior,
      junctions,
      flow,
    );
    routeState.byId[id] = storedOf(
      conn,
      source,
      target,
      best.sourceEdge,
      best.targetEdge,
      best.points,
    );
    routeState.lastValidPoints[id] = best.points.map((point) => ({ ...point }));
    prior.push(best.points);
    if (topology) {
      const route = topology.routes.find((row) => row.connectionId === id);
      if (route) {
        route.sourceEdge = best.sourceEdge;
        route.targetEdge = best.targetEdge;
        route.points = best.points.map((point) => ({ ...point }));
      }
    }
  }

  const { bridges } = classifyRouteInteractions(
    stableRoutesList(routeState),
    input.cards,
    topology,
  );
  routeState.bridges = bridges.map((bridge) => ({ ...bridge }));
  return { routeState, topology };
}

function positionsEqual(
  a: RelatedDiagramCard[],
  b: RelatedDiagramCard[],
): boolean {
  const left = new Map(a.map((card) => [card.id, card]));
  if (a.length !== b.length) return false;
  for (const card of b) {
    const prev = left.get(card.id);
    if (!prev) return false;
    if (prev.layout.x !== card.layout.x || prev.layout.y !== card.layout.y) {
      return false;
    }
  }
  return true;
}

function routesEqual(a: StableRouteState, b: StableRouteState): boolean {
  const ids = [...new Set([...Object.keys(a.byId), ...Object.keys(b.byId)])].sort();
  for (const id of ids) {
    const left = a.byId[id];
    const right = b.byId[id];
    if (!left || !right) return false;
    if (!pointsDeepEqual(left.points, right.points)) return false;
    if (left.sourceEdge !== right.sourceEdge || left.targetEdge !== right.targetEdge) {
      return false;
    }
  }
  return true;
}

export function applyKnowledgeLayerArrange(input: {
  cards: RelatedDiagramCard[];
  connections: RelatedDiagramConnection[];
  routeState: StableRouteState;
  topology?: RelatedDiagramRouteTopology;
}): {
  cards: RelatedDiagramCard[];
  routeState: StableRouteState;
  topology?: RelatedDiagramRouteTopology;
  changedCardIds: string[];
  routeChanged: boolean;
} {
  const nextCards = layoutKnowledgeLayers({
    cards: input.cards,
    connections: input.connections,
  });
  const knowledgeIds = knowledgeCardsOf(nextCards).map((card) => card.id);
  const knowledgeMoved = knowledgeIds.some((id) => {
    const prev = input.cards.find((card) => card.id === id);
    const next = nextCards.find((card) => card.id === id);
    return (
      !prev ||
      !next ||
      prev.layout.x !== next.layout.x ||
      prev.layout.y !== next.layout.y
    );
  });
  const affected = collectArrangeAffectedConnectionIds({
    previousCards: input.cards,
    nextCards,
    connections: input.connections,
    topology: input.topology,
    previousTopology: input.topology,
    activeUnitCardIds: knowledgeMoved ? knowledgeIds : [],
  });
  const stitched = restitchAffectedRoutes({
    previous: input.routeState,
    previousTopology: input.topology,
    cards: nextCards,
    connections: input.connections,
    topology: input.topology,
    affectedIds: affected,
  });
  const changedCardIds = nextCards
    .filter((card) => {
      const prev = input.cards.find((item) => item.id === card.id);
      return !prev || prev.layout.x !== card.layout.x || prev.layout.y !== card.layout.y;
    })
    .map((card) => card.id)
    .sort(compareId);
  const routeChanged = !routesEqual(input.routeState, stitched.routeState);
  if (positionsEqual(input.cards, nextCards) && !routeChanged) {
    return {
      cards: input.cards,
      routeState: input.routeState,
      topology: input.topology,
      changedCardIds: [],
      routeChanged: false,
    };
  }
  return {
    cards: nextCards,
    routeState: stitched.routeState,
    topology: stitched.topology,
    changedCardIds,
    routeChanged,
  };
}

export function knowledgeArrangeMetrics(input: {
  cards: RelatedDiagramCard[];
  connections: RelatedDiagramConnection[];
  routeState: StableRouteState;
  topology?: RelatedDiagramRouteTopology;
  originCards?: RelatedDiagramCard[];
}) {
  const knowledgeIds = new Set(knowledgeCardsOf(input.cards).map((card) => card.id));
  const internals = knowledgeInternalConnections(input.cards, input.connections);
  const analysis = analyzeRouteReadability({
    cards: input.cards,
    connections: internals,
    routeState: input.routeState,
    topology: input.topology,
  });
  const origin = new Map((input.originCards ?? input.cards).map((card) => [card.id, card]));
  let total = 0;
  let max = 0;
  let moved = 0;
  for (const card of input.cards) {
    if (!knowledgeIds.has(card.id)) continue;
    const prev = origin.get(card.id);
    if (!prev) continue;
    const d =
      Math.abs(card.layout.x - prev.layout.x) +
      Math.abs(card.layout.y - prev.layout.y);
    total += d;
    max = Math.max(max, d);
    if (d > 0) moved += 1;
  }
  return {
    movedCardCount: moved,
    totalCardDisplacement: total,
    maxCardDisplacement: max,
    totalRouteLength: analysis.totalLength,
    longestRouteLength: analysis.longestRouteLength,
    maxDetourRatio: analysis.maxDetourRatio,
    totalBends: analysis.totalBends,
    maxBendCount: analysis.maxBendCount,
    cardThrough: analysis.totalCardThrough,
    crossings: analysis.totalCrossings,
    highwayCount: analysis.highwayCount,
    corridorViolationCount: analysis.corridorViolationCount,
  };
}
