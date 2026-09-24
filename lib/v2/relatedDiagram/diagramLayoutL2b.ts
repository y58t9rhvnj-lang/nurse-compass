/**
 * L2-B: route-driven readability refinement.
 * Compare route-only and card-move candidates together.
 * Short, local, followable routes beat "do not move cards".
 */

import { A3_HEIGHT_PX, A3_WIDTH_PX } from "./a3Canvas";
import { getA3LegendBounds } from "./a3Legend";
import { CARD_MIN_GAP, isLegalCardPlacement } from "./cardCollision";
import { cloneTopology } from "./diagramHistory";
import {
  L2_HUB_DEGREE,
  countPolylineBoundsHits,
  countPolylineCardHits,
  countPolylineLegendHits,
  isExcessiveEdgeGap,
  orthogonalBorderGap,
} from "./diagramLayoutL2";
import { knowledgeCardsOf } from "./knowledgeGroupLayout";
import {
  classifyRouteInteractions,
  countBends,
  countRouteCrossings,
  edgeMidpoint,
  polylineLength,
  type EdgeSide,
  type Point,
} from "./orthogonalRouting";
import {
  captureTopologyGeometryParams,
  regenerateExplicitTopologyGeometry,
} from "./regenerateRouteTopology";
import {
  cardObstacle,
  defaultRouteCanvas,
  selectBestOrthogonalRoute,
} from "./routeHardening";
import type { RelatedDiagramRouteTopology } from "./routeTopology";
import {
  cloneStableRouteState,
  pointsDeepEqual,
  seedStableRouteState,
  stableRoutesList,
  type StableRouteState,
  type StoredRouteGeometry,
} from "./incrementalRoutes";
import type {
  RelatedDiagramCard,
  RelatedDiagramConnection,
} from "./types";

export const L2B_EXTREME_DETOUR = 3;
export const L2B_SHORT_ROUTE_PX = 240;
export const L2B_SHORT_BEND_LIMIT = 4;
export const L2B_LONG_BEND_LIMIT = 6;
export const L2B_MOVE_STEPS = [24, 48, 72, 96] as const;
export const L2B_MAX_PASSES = 6;
export const L2B_CROSSING_BEND_SLACK = 2;
export const L2B_CROSSING_DETOUR_SLACK = 0.75;
export const L2B_MAX_MOVE_DISPLACEMENT = 192;
export const L2B_CORRIDOR_MARGIN = 96;
export const L2B_LONG_ROUTE_PX = 500;
export const L2B_VERY_LONG_ROUTE_PX = 750;
export const L2B_HIGHWAY_SPAN_X = A3_WIDTH_PX * 0.42;
export const L2B_HIGHWAY_SPAN_Y = A3_HEIGHT_PX * 0.42;
export const L2B_MAX_NEIGHBORHOOD = 4;

const EDGES: EdgeSide[] = ["top", "right", "bottom", "left"];
const MOVE_DELTAS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

export type RouteProblemReason =
  | "card_intersection"
  | "extreme_detour"
  | "too_many_bends"
  | "avoidable_crossing"
  | "excessive_length"
  | "legend_intersection"
  | "out_of_bounds"
  | "corridor_violation"
  | "highway";

export type ConnectionReadability = {
  connectionId: string;
  length: number;
  directLowerBound: number;
  detourRatio: number;
  bendCount: number;
  cardIntersectionCount: number;
  crossingCount: number;
  corridorViolation: number;
  highway: number;
  reasons: RouteProblemReason[];
};

export type SceneReadability = {
  connections: ConnectionReadability[];
  totalLength: number;
  totalBends: number;
  totalCardThrough: number;
  totalCrossings: number;
  problematicConnectionCount: number;
  longestRouteLength: number;
  maxDetourRatio: number;
  routesOver500px: number;
  routesOver750px: number;
  maxBendCount: number;
  corridorViolationCount: number;
  highwayCount: number;
};

export type RefineRouteReadabilityResult = {
  cards: RelatedDiagramCard[];
  routeState: StableRouteState;
  topology?: RelatedDiagramRouteTopology;
  changedCardIds: string[];
  routeChanged: boolean;
};

type SceneLex = {
  boundsHard: number;
  legendHard: number;
  overlapHard: number;
  knowledgeBreak: number;
  cardThrough: number;
  extremeDetour: number;
  veryLongRoutes: number;
  longRoutes: number;
  longest: number;
  corridor: number;
  highway: number;
  maxBends: number;
  bends: number;
  crossings: number;
  length: number;
  displacement: number;
};

type Candidate = {
  cards: RelatedDiagramCard[];
  routeState: StableRouteState;
  topology?: RelatedDiagramRouteTopology;
  changedCardIds: string[];
  score: SceneLex;
};

function compareId(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function toPx(n: number): number {
  return Math.round(n);
}

export function directOrthogonalLowerBound(
  source: RelatedDiagramCard,
  target: RelatedDiagramCard,
): number {
  const gap = orthogonalBorderGap(source.layout, target.layout);
  const sx = source.layout.x + source.layout.width / 2;
  const sy = source.layout.y + source.layout.height / 2;
  const tx = target.layout.x + target.layout.width / 2;
  const ty = target.layout.y + target.layout.height / 2;
  const centers = Math.abs(tx - sx) + Math.abs(ty - sy);
  return Math.max(
    1,
    gap,
    Math.max(0, centers - (source.layout.width + target.layout.width) / 2),
  );
}

function crossingCountFor(
  connectionId: string,
  bridges: ReturnType<typeof classifyRouteInteractions>["bridges"],
): number {
  return bridges.filter(
    (bridge) =>
      bridge.jumperConnectionId === connectionId ||
      bridge.underConnectionId === connectionId,
  ).length;
}

export function preferredCorridor(
  source: RelatedDiagramCard,
  target: RelatedDiagramCard,
  margin = L2B_CORRIDOR_MARGIN,
) {
  const left = Math.min(source.layout.x, target.layout.x) - margin;
  const top = Math.min(source.layout.y, target.layout.y) - margin;
  const right =
    Math.max(
      source.layout.x + source.layout.width,
      target.layout.x + target.layout.width,
    ) + margin;
  const bottom =
    Math.max(
      source.layout.y + source.layout.height,
      target.layout.y + target.layout.height,
    ) + margin;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function pointInRect(
  point: Point,
  rect: { x: number; y: number; width: number; height: number },
): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

export function corridorViolationCount(
  points: Point[],
  source: RelatedDiagramCard,
  target: RelatedDiagramCard,
): number {
  const corridor = preferredCorridor(source, target);
  let hits = 0;
  for (const point of points) {
    if (!pointInRect(point, corridor)) hits += 1;
  }
  return hits;
}

export function routeHighwayFlag(points: Point[]): number {
  if (points.length === 0) return 0;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const spanX = Math.max(...xs) - Math.min(...xs);
  const spanY = Math.max(...ys) - Math.min(...ys);
  return spanX > L2B_HIGHWAY_SPAN_X || spanY > L2B_HIGHWAY_SPAN_Y ? 1 : 0;
}

function reasonList(row: {
  cardIntersectionCount: number;
  detourRatio: number;
  bendCount: number;
  length: number;
  crossingCount: number;
  legendHits: number;
  outOfBounds: number;
  excessive: boolean;
  corridorViolation: number;
  highway: number;
}): RouteProblemReason[] {
  const reasons: RouteProblemReason[] = [];
  if (row.cardIntersectionCount > 0) reasons.push("card_intersection");
  if (row.legendHits > 0) reasons.push("legend_intersection");
  if (row.outOfBounds > 0) reasons.push("out_of_bounds");
  if (row.detourRatio > L2B_EXTREME_DETOUR) reasons.push("extreme_detour");
  if (
    (row.length <= L2B_SHORT_ROUTE_PX && row.bendCount > L2B_SHORT_BEND_LIMIT) ||
    row.bendCount > L2B_LONG_BEND_LIMIT
  ) {
    reasons.push("too_many_bends");
  }
  if (row.excessive) reasons.push("excessive_length");
  if (row.crossingCount > 0) reasons.push("avoidable_crossing");
  if (row.corridorViolation > 0) reasons.push("corridor_violation");
  if (row.highway > 0) reasons.push("highway");
  return reasons;
}

export function analyzeRouteReadability(input: {
  cards: RelatedDiagramCard[];
  connections: RelatedDiagramConnection[];
  routeState: StableRouteState;
  topology?: RelatedDiagramRouteTopology;
}): SceneReadability {
  const byId = new Map(input.cards.map((card) => [card.id, card]));
  const routed = stableRoutesList(input.routeState);
  const { bridges } = classifyRouteInteractions(
    routed,
    input.cards,
    input.topology,
  );
  const junctionIds = junctionConnectionIds(input.topology);
  const rects = input.cards.map((card) => ({ id: card.id, ...card.layout }));
  const connections = [...input.connections].sort((a, b) =>
    compareId(a.id, b.id),
  );
  const rows: ConnectionReadability[] = [];
  for (const conn of connections) {
    const stored = input.routeState.byId[conn.id];
    const source = byId.get(conn.sourceCardId);
    const target = byId.get(conn.targetCardId);
    if (!stored || !source || !target) continue;
    const length = polylineLength(stored.points);
    const directLowerBound = directOrthogonalLowerBound(source, target);
    const detourRatio = length / directLowerBound;
    const bendCount = countBends(stored.points);
    const cardIntersectionCount = countPolylineCardHits(
      stored.points,
      rects,
      new Set([source.id, target.id]),
    );
    const crossingCount = crossingCountFor(conn.id, bridges);
    const corridorViolation = corridorViolationCount(
      stored.points,
      source,
      target,
    );
    const highway = junctionIds.has(conn.id)
      ? 0
      : routeHighwayFlag(stored.points);
    rows.push({
      connectionId: conn.id,
      length,
      directLowerBound,
      detourRatio,
      bendCount,
      cardIntersectionCount,
      crossingCount,
      corridorViolation,
      highway,
      reasons: reasonList({
        cardIntersectionCount,
        detourRatio,
        bendCount,
        length,
        crossingCount,
        legendHits: countPolylineLegendHits(stored.points),
        outOfBounds: countPolylineBoundsHits(stored.points),
        excessive: isExcessiveEdgeGap(
          orthogonalBorderGap(source.layout, target.layout),
        ),
        corridorViolation,
        highway,
      }),
    });
  }
  return {
    connections: rows,
    totalLength: rows.reduce((sum, row) => sum + row.length, 0),
    totalBends: rows.reduce((sum, row) => sum + row.bendCount, 0),
    totalCardThrough: rows.reduce(
      (sum, row) => sum + row.cardIntersectionCount,
      0,
    ),
    totalCrossings: bridges.length,
    problematicConnectionCount: rows.filter((row) => row.reasons.length > 0)
      .length,
    longestRouteLength: rows.reduce(
      (max, row) => Math.max(max, row.length),
      0,
    ),
    maxDetourRatio: rows.reduce((max, row) => Math.max(max, row.detourRatio), 0),
    routesOver500px: rows.filter((row) => row.length > L2B_LONG_ROUTE_PX).length,
    routesOver750px: rows.filter((row) => row.length > L2B_VERY_LONG_ROUTE_PX)
      .length,
    maxBendCount: rows.reduce((max, row) => Math.max(max, row.bendCount), 0),
    corridorViolationCount: rows.reduce(
      (sum, row) => sum + row.corridorViolation,
      0,
    ),
    highwayCount: rows.reduce((sum, row) => sum + row.highway, 0),
  };
}

export function sceneDisplacement(
  origin: RelatedDiagramCard[],
  cards: RelatedDiagramCard[],
): number {
  const start = new Map(origin.map((card) => [card.id, card]));
  let total = 0;
  for (const card of cards) {
    const prev = start.get(card.id);
    if (!prev) continue;
    total +=
      Math.abs(card.layout.x - prev.layout.x) +
      Math.abs(card.layout.y - prev.layout.y);
  }
  return total;
}

function knowledgeRelativeBreak(
  origin: RelatedDiagramCard[],
  cards: RelatedDiagramCard[],
): number {
  const start = knowledgeCardsOf(origin)
    .map((card) => card)
    .sort((a, b) => compareId(a.id, b.id));
  const next = knowledgeCardsOf(cards)
    .map((card) => card)
    .sort((a, b) => compareId(a.id, b.id));
  if (start.length === 0) return 0;
  if (start.length !== next.length) return 1;
  const dx = next[0]!.layout.x - start[0]!.layout.x;
  const dy = next[0]!.layout.y - start[0]!.layout.y;
  for (let i = 0; i < start.length; i += 1) {
    if (
      next[i]!.id !== start[i]!.id ||
      next[i]!.layout.x !== start[i]!.layout.x + dx ||
      next[i]!.layout.y !== start[i]!.layout.y + dy
    ) {
      return 1;
    }
  }
  return 0;
}

function sceneLex(
  cards: RelatedDiagramCard[],
  connections: RelatedDiagramConnection[],
  routeState: StableRouteState,
  topology: RelatedDiagramRouteTopology | undefined,
  origin: RelatedDiagramCard[],
): SceneLex {
  const analysis = analyzeRouteReadability({
    cards,
    connections,
    routeState,
    topology,
  });
  let boundsHard = analysis.connections.reduce(
    (sum, row) => sum + (row.reasons.includes("out_of_bounds") ? 1 : 0),
    0,
  );
  let legendHard = analysis.connections.reduce(
    (sum, row) => sum + (row.reasons.includes("legend_intersection") ? 1 : 0),
    0,
  );
  let overlapHard = 0;
  for (const card of cards) {
    if (
      card.layout.x < 0 ||
      card.layout.y < 0 ||
      card.layout.x + card.layout.width > A3_WIDTH_PX ||
      card.layout.y + card.layout.height > A3_HEIGHT_PX
    ) {
      boundsHard += 1;
    }
    const others = cards.filter((item) => item.id !== card.id);
    if (!isLegalCardPlacement(card.layout, others, { minGap: CARD_MIN_GAP })) {
      overlapHard += 1;
    }
    if (countPolylineLegendHits([
      { x: card.layout.x, y: card.layout.y },
      { x: card.layout.x + card.layout.width, y: card.layout.y },
    ])) {
      legendHard += 0;
    }
  }
  return {
    boundsHard,
    legendHard,
    overlapHard,
    knowledgeBreak: knowledgeRelativeBreak(origin, cards),
    cardThrough: analysis.totalCardThrough,
    extremeDetour: analysis.connections.filter((row) => row.detourRatio > L2B_EXTREME_DETOUR)
      .length,
    veryLongRoutes: analysis.routesOver750px,
    longRoutes: analysis.routesOver500px,
    longest: analysis.longestRouteLength,
    corridor: analysis.corridorViolationCount,
    highway: analysis.highwayCount,
    maxBends: analysis.maxBendCount,
    bends: analysis.totalBends,
    crossings: analysis.totalCrossings,
    length: analysis.totalLength,
    displacement: sceneDisplacement(origin, cards),
  };
}

function crossingReductionIsCheap(next: SceneLex, prev: SceneLex): boolean {
  return (
    next.bends <= prev.bends + L2B_CROSSING_BEND_SLACK &&
    next.extremeDetour <= prev.extremeDetour &&
    next.longest <= prev.longest + 80
  );
}

function throughEscapeIsLocal(next: SceneLex, prev: SceneLex): boolean {
  return (
    next.highway <= prev.highway &&
    next.veryLongRoutes <= prev.veryLongRoutes &&
    next.extremeDetour <= prev.extremeDetour &&
    next.corridor <= prev.corridor + 1
  );
}

function compareSceneLex(next: SceneLex, prev: SceneLex): number {
  if (next.boundsHard !== prev.boundsHard) return next.boundsHard - prev.boundsHard;
  if (next.legendHard !== prev.legendHard) return next.legendHard - prev.legendHard;
  if (next.overlapHard !== prev.overlapHard) return next.overlapHard - prev.overlapHard;
  if (next.knowledgeBreak !== prev.knowledgeBreak) {
    return next.knowledgeBreak - prev.knowledgeBreak;
  }
  const nextThrough =
    next.cardThrough < prev.cardThrough && !throughEscapeIsLocal(next, prev)
      ? prev.cardThrough
      : next.cardThrough;
  if (nextThrough !== prev.cardThrough) return nextThrough - prev.cardThrough;
  if (next.extremeDetour !== prev.extremeDetour) {
    return next.extremeDetour - prev.extremeDetour;
  }
  if (next.veryLongRoutes !== prev.veryLongRoutes) {
    return next.veryLongRoutes - prev.veryLongRoutes;
  }
  if (next.longRoutes !== prev.longRoutes) return next.longRoutes - prev.longRoutes;
  if (next.highway !== prev.highway) return next.highway - prev.highway;
  if (next.longest > L2B_LONG_ROUTE_PX || prev.longest > L2B_LONG_ROUTE_PX) {
    if (next.longest !== prev.longest) return next.longest - prev.longest;
  }
  if (next.corridor !== prev.corridor) return next.corridor - prev.corridor;
  if (next.maxBends !== prev.maxBends) return next.maxBends - prev.maxBends;
  if (next.bends !== prev.bends) return next.bends - prev.bends;
  const nextCross =
    next.crossings < prev.crossings && !crossingReductionIsCheap(next, prev)
      ? prev.crossings
      : next.crossings;
  if (nextCross !== prev.crossings) return nextCross - prev.crossings;
  if (next.displacement !== prev.displacement) {
    return next.displacement - prev.displacement;
  }
  return next.length - prev.length;
}

function isReadabilityImprovement(next: SceneLex, prev: SceneLex): boolean {
  return compareSceneLex(next, prev) < 0;
}

function junctionConnectionIds(
  topology?: RelatedDiagramRouteTopology,
): Set<string> {
  const ids = new Set<string>();
  if (!topology) return ids;
  for (const group of topology.routeGroups) {
    for (const id of group.connectionIds) ids.add(id);
  }
  return ids;
}

function obstaclesOf(cards: RelatedDiagramCard[]) {
  const legend = getA3LegendBounds();
  return [...cards.map(cardObstacle), { id: "__legend__", ...legend }];
}

function scoreCandidate(
  points: Point[],
  cards: RelatedDiagramCard[],
  source: RelatedDiagramCard,
  target: RelatedDiagramCard,
  prior: Point[][],
): SceneLex {
  const ignore = new Set([source.id, target.id]);
  const rects = cards.map((card) => ({ id: card.id, ...card.layout }));
  const length = polylineLength(points);
  const direct = directOrthogonalLowerBound(source, target);
  const detourRatio = length / direct;
  const highway = routeHighwayFlag(points);
  return {
    boundsHard: countPolylineBoundsHits(points),
    legendHard: countPolylineLegendHits(points),
    overlapHard: 0,
    knowledgeBreak: 0,
    cardThrough: countPolylineCardHits(points, rects, ignore),
    extremeDetour: detourRatio > L2B_EXTREME_DETOUR ? 1 : 0,
    veryLongRoutes: length > L2B_VERY_LONG_ROUTE_PX ? 1 : 0,
    longRoutes: length > L2B_LONG_ROUTE_PX ? 1 : 0,
    longest: length,
    corridor: corridorViolationCount(points, source, target),
    highway,
    maxBends: countBends(points),
    bends: countBends(points),
    crossings: countRouteCrossings(points, prior),
    length,
    displacement: 0,
  };
}

function edgePairPriority(
  existing: StoredRouteGeometry | undefined,
): Array<[EdgeSide, EdgeSide]> {
  const pairs: Array<[EdgeSide, EdgeSide]> = [];
  const seen = new Set<string>();
  const add = (sourceEdge: EdgeSide, targetEdge: EdgeSide) => {
    const key = `${sourceEdge}:${targetEdge}`;
    if (seen.has(key)) return;
    seen.add(key);
    pairs.push([sourceEdge, targetEdge]);
  };
  if (existing) add(existing.sourceEdge, existing.targetEdge);
  add("top", "top");
  add("bottom", "bottom");
  add("right", "left");
  add("left", "right");
  add("top", "bottom");
  add("bottom", "top");
  add("right", "right");
  add("left", "left");
  for (const sourceEdge of EDGES) {
    for (const targetEdge of EDGES) add(sourceEdge, targetEdge);
  }
  return pairs;
}

function bestOneToOneRoute(input: {
  source: RelatedDiagramCard;
  target: RelatedDiagramCard;
  cards: RelatedDiagramCard[];
  existing?: StoredRouteGeometry;
  prior: Point[][];
  junctions: Point[];
}): { points: Point[]; sourceEdge: EdgeSide; targetEdge: EdgeSide } | null {
  const obstacles = obstaclesOf(input.cards);
  const canvas = defaultRouteCanvas();
  const options: Array<{
    points: Point[];
    sourceEdge: EdgeSide;
    targetEdge: EdgeSide;
    score: SceneLex;
    existing: boolean;
  }> = [];
  const push = (
    points: Point[],
    sourceEdge: EdgeSide,
    targetEdge: EdgeSide,
    existing: boolean,
  ) => {
    options.push({
      points,
      sourceEdge,
      targetEdge,
      existing,
      score: scoreCandidate(
        points,
        input.cards,
        input.source,
        input.target,
        input.prior,
      ),
    });
  };
  if (input.existing && input.existing.points.length >= 2) {
    push(
      input.existing.points,
      input.existing.sourceEdge,
      input.existing.targetEdge,
      true,
    );
  }
  for (const [sourceEdge, targetEdge] of edgePairPriority(input.existing)) {
    const points = selectBestOrthogonalRoute({
      source: cardObstacle(input.source),
      target: cardObstacle(input.target),
      sourceEdge,
      targetEdge,
      obstacles,
      canvas,
      priorRoutes: input.prior,
      junctions: input.junctions,
      sourcePin: edgeMidpoint(input.source.layout, sourceEdge),
      targetPin: edgeMidpoint(input.target.layout, targetEdge),
    });
    if (points) push(points, sourceEdge, targetEdge, false);
    if (
      options.some(
        (row) =>
          !row.existing &&
          row.score.cardThrough === 0 &&
          row.score.boundsHard === 0 &&
          row.score.legendHard === 0 &&
          row.score.highway === 0 &&
          row.score.extremeDetour === 0 &&
          row.score.corridor <= 1 &&
          row.score.maxBends <= 3,
      )
    ) {
      break;
    }
  }
  if (options.length === 0) return null;
  options.sort((a, b) => {
    const cmp = compareSceneLex(a.score, b.score);
    if (cmp !== 0) return cmp;
    if (a.existing !== b.existing) return a.existing ? -1 : 1;
    return 0;
  });
  const winner = options[0]!;
  return {
    points: winner.points,
    sourceEdge: winner.sourceEdge,
    targetEdge: winner.targetEdge,
  };
}

function rebuildState(
  cards: RelatedDiagramCard[],
  routeState: StableRouteState,
  topology: RelatedDiagramRouteTopology | undefined,
  overrides: Record<string, StoredRouteGeometry>,
): { routeState: StableRouteState; topology?: RelatedDiagramRouteTopology } {
  const next = cloneStableRouteState(routeState);
  for (const [id, route] of Object.entries(overrides)) {
    next.byId[id] = {
      ...route,
      points: route.points.map((p) => ({ x: p.x, y: p.y })),
      sourcePin: { ...route.sourcePin },
      targetPin: { ...route.targetPin },
    };
    next.lastValidPoints[id] = route.points.map((p) => ({ x: p.x, y: p.y }));
  }
  let nextTopo = cloneTopology(topology);
  if (nextTopo) {
    nextTopo = {
      ...nextTopo,
      routes: nextTopo.routes.map((route) => {
        const override = overrides[route.connectionId];
        return override
          ? {
              ...route,
              sourceEdge: override.sourceEdge,
              targetEdge: override.targetEdge,
              points: override.points.map((p) => ({ x: p.x, y: p.y })),
            }
          : route;
      }),
    };
  }
  const routed = stableRoutesList(next);
  const { bridges } = classifyRouteInteractions(routed, cards, nextTopo);
  next.bridges = bridges.map((bridge) => ({ ...bridge }));
  return { routeState: next, topology: nextTopo };
}

function routeStatesEqual(a: StableRouteState, b: StableRouteState): boolean {
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

function knowledgeIdsOf(cards: RelatedDiagramCard[]): Set<string> {
  return new Set(knowledgeCardsOf(cards).map((card) => card.id));
}

function isKnowledgeInternal(
  conn: RelatedDiagramConnection,
  knowledgeIds: Set<string>,
): boolean {
  return (
    knowledgeIds.has(conn.sourceCardId) && knowledgeIds.has(conn.targetCardId)
  );
}

function degreeMap(
  connections: RelatedDiagramConnection[],
): Map<string, number> {
  const deg = new Map<string, number>();
  for (const conn of connections) {
    deg.set(conn.sourceCardId, (deg.get(conn.sourceCardId) ?? 0) + 1);
    deg.set(conn.targetCardId, (deg.get(conn.targetCardId) ?? 0) + 1);
  }
  return deg;
}

function applyCardDelta(
  cards: RelatedDiagramCard[],
  ids: string[],
  dx: number,
  dy: number,
): RelatedDiagramCard[] | null {
  const want = new Set(ids);
  const next = cards.map((card) =>
    want.has(card.id)
      ? {
          ...card,
          layout: {
            ...card.layout,
            x: toPx(card.layout.x + dx),
            y: toPx(card.layout.y + dy),
          },
        }
      : card,
  );
  for (const card of next) {
    if (
      card.layout.x < 0 ||
      card.layout.y < 0 ||
      card.layout.x + card.layout.width > A3_WIDTH_PX ||
      card.layout.y + card.layout.height > A3_HEIGHT_PX
    ) {
      return null;
    }
    const others = next.filter((item) => item.id !== card.id);
    if (!isLegalCardPlacement(card.layout, others, { minGap: CARD_MIN_GAP })) {
      return null;
    }
  }
  return next;
}

function blockingCardIds(
  points: Point[],
  cards: RelatedDiagramCard[],
  ignore: Set<string>,
): string[] {
  const hits: string[] = [];
  for (const card of [...cards].sort((a, b) => compareId(a.id, b.id))) {
    if (ignore.has(card.id)) continue;
    if (
      countPolylineCardHits(
        points,
        [{ id: card.id, ...card.layout }],
        new Set(),
      ) > 0
    ) {
      hits.push(card.id);
    }
  }
  return hits;
}

function priorExcept(
  routeState: StableRouteState,
  connectionId: string,
): Point[][] {
  return stableRoutesList(routeState)
    .filter((route) => route.connectionId !== connectionId)
    .map((route) => route.points);
}

function shouldImprove(
  row: ConnectionReadability,
  conn: RelatedDiagramConnection,
  knowledgeIds: Set<string>,
): boolean {
  if (row.reasons.includes("card_intersection")) return true;
  if (row.reasons.includes("legend_intersection")) return true;
  if (row.reasons.includes("out_of_bounds")) return true;
  if (isKnowledgeInternal(conn, knowledgeIds)) return false;
  if (row.reasons.includes("extreme_detour")) return true;
  if (row.reasons.includes("too_many_bends")) return true;
  if (row.reasons.includes("highway")) return true;
  if (row.reasons.includes("corridor_violation") && row.length > L2B_LONG_ROUTE_PX) {
    return true;
  }
  if (row.reasons.includes("excessive_length")) return true;
  return false;
}

function storeBestRoute(
  cards: RelatedDiagramCard[],
  routeState: StableRouteState,
  topology: RelatedDiagramRouteTopology | undefined,
  conn: RelatedDiagramConnection,
): { routeState: StableRouteState; topology?: RelatedDiagramRouteTopology } | null {
  const stored = routeState.byId[conn.id];
  const source = cards.find((card) => card.id === conn.sourceCardId);
  const target = cards.find((card) => card.id === conn.targetCardId);
  if (!stored || !source || !target) return null;
  const best = bestOneToOneRoute({
    source,
    target,
    cards,
    existing: stored,
    prior: priorExcept(routeState, conn.id),
    junctions: (topology?.branchPoints ?? []).map((bp) => ({ x: bp.x, y: bp.y })),
  });
  if (!best) return null;
  if (
    pointsDeepEqual(best.points, stored.points) &&
    best.sourceEdge === stored.sourceEdge &&
    best.targetEdge === stored.targetEdge
  ) {
    return null;
  }
  return rebuildState(cards, routeState, topology, {
    [conn.id]: {
      ...stored,
      sourceEdge: best.sourceEdge,
      targetEdge: best.targetEdge,
      sourcePin: edgeMidpoint(source.layout, best.sourceEdge),
      targetPin: edgeMidpoint(target.layout, best.targetEdge),
      points: best.points,
    },
  });
}

function restitchAfterMove(
  cards: RelatedDiagramCard[],
  connections: RelatedDiagramConnection[],
  previous: StableRouteState,
  topology: RelatedDiagramRouteTopology | undefined,
  movedIds: string[],
): { routeState: StableRouteState; topology?: RelatedDiagramRouteTopology } {
  const moved = new Set(movedIds);
  const junctionIds = junctionConnectionIds(topology);
  const affected = connections.filter(
    (conn) => moved.has(conn.sourceCardId) || moved.has(conn.targetCardId),
  );
  const needsSeed = affected.some((conn) => junctionIds.has(conn.id));
  if (needsSeed && topology) {
    const seeded = seedStableRouteState(cards, connections, topology);
    const merged = cloneStableRouteState(seeded);
    for (const [id, route] of Object.entries(previous.byId)) {
      if (affected.some((conn) => conn.id === id)) continue;
      merged.byId[id] = {
        ...route,
        points: route.points.map((p) => ({ x: p.x, y: p.y })),
        sourcePin: { ...route.sourcePin },
        targetPin: { ...route.targetPin },
      };
      merged.lastValidPoints[id] = route.points.map((p) => ({ x: p.x, y: p.y }));
    }
    const { bridges } = classifyRouteInteractions(
      stableRoutesList(merged),
      cards,
      topology,
    );
    merged.bridges = bridges.map((bridge) => ({ ...bridge }));
    return { routeState: merged, topology };
  }
  let current = previous;
  let currentTopo = topology;
  for (const conn of [...affected].sort((a, b) => compareId(a.id, b.id))) {
    if (junctionIds.has(conn.id)) continue;
    const next = storeBestRoute(cards, current, currentTopo, conn);
    if (!next) continue;
    current = next.routeState;
    currentTopo = next.topology;
  }
  return { routeState: current, topology: currentTopo };
}

function oneHopIds(
  cardId: string,
  connections: RelatedDiagramConnection[],
): string[] {
  const ids = new Set<string>();
  for (const conn of connections) {
    if (conn.sourceCardId === cardId) ids.add(conn.targetCardId);
    if (conn.targetCardId === cardId) ids.add(conn.sourceCardId);
  }
  return [...ids].sort(compareId);
}

function movementIds(
  cardId: string,
  cards: RelatedDiagramCard[],
  knowledgeIds: Set<string>,
): string[] {
  if (!knowledgeIds.has(cardId)) return [cardId];
  return knowledgeCardsOf(cards)
    .map((card) => card.id)
    .sort(compareId);
}

function neighborhoodIds(
  focusId: string,
  connections: RelatedDiagramConnection[],
  knowledgeIds: Set<string>,
): string[] {
  if (knowledgeIds.has(focusId)) return [];
  const ids = [focusId, ...oneHopIds(focusId, connections)].filter(
    (id) => !knowledgeIds.has(id),
  );
  return [...new Set(ids)].sort(compareId).slice(0, L2B_MAX_NEIGHBORHOOD);
}

function uniqueGroups(groups: string[][]): string[][] {
  const seen = new Set<string>();
  const out: string[][] = [];
  for (const group of groups) {
    const key = [...group].sort(compareId).join(",");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push([...group].sort(compareId));
  }
  return out;
}

function pullDeltas(
  from: RelatedDiagramCard,
  toward: RelatedDiagramCard,
): Array<readonly [number, number]> {
  const dx = toward.layout.x + toward.layout.width / 2 - (from.layout.x + from.layout.width / 2);
  const dy = toward.layout.y + toward.layout.height / 2 - (from.layout.y + from.layout.height / 2);
  const sx = dx === 0 ? 0 : dx > 0 ? 1 : -1;
  const sy = dy === 0 ? 0 : dy > 0 ? 1 : -1;
  const out: Array<readonly [number, number]> = [];
  if (sx !== 0) out.push([sx, 0]);
  if (sy !== 0) out.push([0, sy]);
  if (sx !== 0 && sy !== 0) out.push([sx, sy]);
  return out;
}

function candidateFrom(
  cards: RelatedDiagramCard[],
  connections: RelatedDiagramConnection[],
  routeState: StableRouteState,
  topology: RelatedDiagramRouteTopology | undefined,
  origin: RelatedDiagramCard[],
  changedCardIds: string[],
): Candidate {
  return {
    cards,
    routeState,
    topology,
    changedCardIds,
    score: sceneLex(cards, connections, routeState, topology, origin),
  };
}

function collectJointCandidates(
  cards: RelatedDiagramCard[],
  connections: RelatedDiagramConnection[],
  routeState: StableRouteState,
  topology: RelatedDiagramRouteTopology | undefined,
  origin: RelatedDiagramCard[],
  problem: ConnectionReadability,
): Candidate[] {
  const conn = connections.find((row) => row.id === problem.connectionId);
  const stored = routeState.byId[problem.connectionId];
  if (!conn || !stored) return [];
  const knowledgeIds = knowledgeIdsOf(cards);
  const junctionIds = junctionConnectionIds(topology);
  const out: Candidate[] = [];
  if (!junctionIds.has(conn.id)) {
    const routed = storeBestRoute(cards, routeState, topology, conn);
    if (routed) {
      out.push(
        candidateFrom(
          cards,
          connections,
          routed.routeState,
          routed.topology,
          origin,
          [],
        ),
      );
    }
  }
  if (isKnowledgeInternal(conn, knowledgeIds)) return out;
  if (cards.length > 14 && !problem.reasons.includes("card_intersection")) {
    return out;
  }

  const ignore = new Set([conn.sourceCardId, conn.targetCardId]);
  const blockers = blockingCardIds(stored.points, cards, ignore);
  const focus = [...blockers, conn.sourceCardId, conn.targetCardId];
  const groups = uniqueGroups([
    ...focus.map((id) => movementIds(id, cards, knowledgeIds)),
    ...focus.map((id) => neighborhoodIds(id, connections, knowledgeIds)),
  ]).slice(0, cards.length > 14 ? 3 : 8);
  const source = cards.find((card) => card.id === conn.sourceCardId);
  const target = cards.find((card) => card.id === conn.targetCardId);
  const steps = cards.length > 14 ? ([48, 96] as const) : L2B_MOVE_STEPS;
  const baseDirs = cards.length > 14 ? MOVE_DELTAS.slice(0, 4) : MOVE_DELTAS;
  for (const group of groups) {
    for (const step of steps) {
      const dirs = [...baseDirs];
      if (source && group.length === 1 && group[0] === source.id && target) {
        dirs.push(...pullDeltas(source, target));
      }
      if (target && group.length === 1 && group[0] === target.id && source) {
        dirs.push(...pullDeltas(target, source));
      }
      const seen = new Set<string>();
      for (const [sx, sy] of dirs) {
        const key = `${sx}:${sy}:${step}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const moved = applyCardDelta(cards, group, sx * step, sy * step);
        if (!moved) continue;
        if (sceneDisplacement(cards, moved) > L2B_MAX_MOVE_DISPLACEMENT) continue;
        const stitched = restitchAfterMove(
          moved,
          connections,
          routeState,
          topology,
          group,
        );
        if (!junctionIds.has(conn.id)) {
          const rerouted = storeBestRoute(
            moved,
            stitched.routeState,
            stitched.topology,
            conn,
          );
          if (rerouted) {
            stitched.routeState = rerouted.routeState;
            stitched.topology = rerouted.topology;
          }
        }
        out.push(
          candidateFrom(
            moved,
            connections,
            stitched.routeState,
            stitched.topology,
            origin,
            group,
          ),
        );
      }
    }
  }
  return out;
}

function refineOnce(
  cards: RelatedDiagramCard[],
  connections: RelatedDiagramConnection[],
  routeState: StableRouteState,
  topology: RelatedDiagramRouteTopology | undefined,
  origin: RelatedDiagramCard[],
): Candidate | null {
  const knowledgeIds = knowledgeIdsOf(cards);
  const analysis = analyzeRouteReadability({
    cards,
    connections,
    routeState,
    topology,
  });
  const problems = analysis.connections
    .filter((row) => {
      const conn = connections.find((item) => item.id === row.connectionId);
      return conn ? shouldImprove(row, conn, knowledgeIds) : false;
    })
    .sort((a, b) => {
      const rank = (row: ConnectionReadability) => {
        if (row.reasons.includes("card_intersection")) return 0;
        if (row.reasons.includes("highway")) return 1;
        if (row.reasons.includes("extreme_detour")) return 2;
        if (row.reasons.includes("corridor_violation")) return 3;
        return 4;
      };
      if (rank(a) !== rank(b)) return rank(a) - rank(b);
      return compareId(a.connectionId, b.connectionId);
    });
  const current = candidateFrom(
    cards,
    connections,
    routeState,
    topology,
    origin,
    [],
  );
  let best = current;
  for (const problem of problems.slice(0, 3)) {
    for (const cand of collectJointCandidates(
      cards,
      connections,
      routeState,
      topology,
      origin,
      problem,
    )) {
      if (!isReadabilityImprovement(cand.score, best.score)) continue;
      best = cand;
    }
  }
  if (best === current) return null;
  if (!isReadabilityImprovement(best.score, current.score)) return null;
  return best;
}

export function refineRouteReadability(input: {
  cards: RelatedDiagramCard[];
  connections: RelatedDiagramConnection[];
  routeState: StableRouteState;
  topology?: RelatedDiagramRouteTopology;
}): RefineRouteReadabilityResult {
  const origin = input.cards.map((card) => ({
    ...card,
    layout: { ...card.layout },
  }));
  let cards = origin;
  let routeState = cloneStableRouteState(input.routeState);
  let topology = cloneTopology(input.topology);
  let changedCardIds: string[] = [];
  let routeChanged = false;

  if (topology) {
    const junction = optimizeJunctionIfNeeded(
      cards,
      input.connections,
      routeState,
      topology,
      origin,
    );
    if (junction) {
      routeState = junction.routeState;
      topology = junction.topology;
      routeChanged = true;
    }
  }

  for (let pass = 0; pass < L2B_MAX_PASSES; pass += 1) {
    const next = refineOnce(
      cards,
      input.connections,
      routeState,
      topology,
      origin,
    );
    if (!next) break;
    cards = next.cards;
    routeState = next.routeState;
    topology = next.topology;
    changedCardIds = [...new Set([...changedCardIds, ...next.changedCardIds])].sort(
      compareId,
    );
    routeChanged = true;
  }

  if (
    changedCardIds.length === 0 &&
    routeStatesEqual(routeState, input.routeState)
  ) {
    return {
      cards: input.cards,
      routeState: input.routeState,
      topology: input.topology,
      changedCardIds: [],
      routeChanged: false,
    };
  }
  return {
    cards,
    routeState,
    topology,
    changedCardIds,
    routeChanged:
      routeChanged || !routeStatesEqual(routeState, input.routeState),
  };
}

export function refineChanged(result: RefineRouteReadabilityResult): boolean {
  return result.changedCardIds.length > 0 || result.routeChanged;
}

function optimizeJunctionIfNeeded(
  cards: RelatedDiagramCard[],
  connections: RelatedDiagramConnection[],
  routeState: StableRouteState,
  topology: RelatedDiagramRouteTopology,
  origin: RelatedDiagramCard[],
): { routeState: StableRouteState; topology: RelatedDiagramRouteTopology } | null {
  const analysis = analyzeRouteReadability({
    cards,
    connections,
    routeState,
    topology,
  });
  const junctionIds = junctionConnectionIds(topology);
  const needs = analysis.connections.some(
    (row) =>
      junctionIds.has(row.connectionId) &&
      (row.reasons.includes("card_intersection") ||
        row.reasons.includes("legend_intersection") ||
        row.reasons.includes("out_of_bounds") ||
        row.reasons.includes("too_many_bends")),
  );
  if (!needs) return null;
  const params = captureTopologyGeometryParams(topology, cards, connections);
  const before = sceneLex(cards, connections, routeState, topology, origin);
  let best: {
    routeState: StableRouteState;
    topology: RelatedDiagramRouteTopology;
    score: SceneLex;
  } | null = null;
  for (const fan of [...params.fans].sort((a, b) => compareId(a.groupId, b.groupId))) {
    for (const step of [24, 48] as const) {
      for (const [sx, sy] of MOVE_DELTAS.slice(0, 4)) {
        const candidate = {
          ...params,
          fans: params.fans.map((item) =>
            item.groupId === fan.groupId
              ? {
                  ...item,
                  branchOffsetFromSourcePin: {
                    x: item.branchOffsetFromSourcePin.x + sx * step,
                    y: item.branchOffsetFromSourcePin.y + sy * step,
                  },
                }
              : item,
          ),
        };
        const nextTopo = regenerateExplicitTopologyGeometry({
          topology,
          cards,
          connections,
          geometryParams: candidate,
        });
        const seeded = seedStableRouteState(cards, connections, nextTopo);
        const merged = cloneStableRouteState(seeded);
        for (const [id, route] of Object.entries(routeState.byId)) {
          if (junctionIds.has(id)) continue;
          merged.byId[id] = {
            ...route,
            points: route.points.map((p) => ({ x: p.x, y: p.y })),
            sourcePin: { ...route.sourcePin },
            targetPin: { ...route.targetPin },
          };
          merged.lastValidPoints[id] = route.points.map((p) => ({
            x: p.x,
            y: p.y,
          }));
        }
        const { bridges } = classifyRouteInteractions(
          stableRoutesList(merged),
          cards,
          nextTopo,
        );
        merged.bridges = bridges.map((bridge) => ({ ...bridge }));
        const score = sceneLex(cards, connections, merged, nextTopo, origin);
        if (!isReadabilityImprovement(score, before)) continue;
        if (!best || compareSceneLex(score, best.score) < 0) {
          best = { routeState: merged, topology: nextTopo, score };
        }
      }
    }
  }
  return best;
}

export const L2B_HUB_DEGREE = L2_HUB_DEGREE;
