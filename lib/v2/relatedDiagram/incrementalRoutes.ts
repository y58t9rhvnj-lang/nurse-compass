/**
 * Stable route geometry + incremental updates after a single card / group move.
 * Unrelated routes keep the same stored points. No full-graph replan.
 */

import { A3_HEIGHT_PX, A3_WIDTH_PX } from "./a3Canvas";
import { getA3LegendBounds } from "./a3Legend";
import {
  chooseAnchorFacingEdge,
  chooseEdgesWithHysteresis,
} from "./dynamicEdgeAttachment";
import {
  a3BoundaryViolationReasons,
  clampRoutePointToA3,
  collectUnsafeBridgeJumperIds,
  legendObstacle,
  obstacleKeepOut,
  sourceExitCorridor,
  targetEntryCorridor,
} from "./geometryGuard";
import {
  classifyRouteInteractions,
  edgeMidpoint,
  outwardPoint,
  planOrthogonalRoutes,
  type CrossingBridge,
  type EdgeSide,
  type Point,
  type RoutedConnection,
} from "./orthogonalRouting";
import { findRectilinearPath } from "./rectilinearPathfinder";
import {
  BRIDGE_REROUTE_EXTRA_BUDGET,
  FAN_BP_RELOCATION_DETOUR_THRESHOLD,
  exceedsFinalDetourRatio,
  exceedsReasonableDetour,
  isCongestedCandidate,
  pickWithinBridgeBudget,
  polylineManhattan,
  sameGroupIds,
  scoreCongestedRoute,
  secondaryEdgePair,
  simplifyTinyDoglegs,
  withinBridgeRerouteBudget,
  type CongestionContext,
} from "./routeCongestion";
import {
  compareQualityReports,
  evaluateRouteQuality,
  qualityNeedsFanRelocation,
  selectQualityCandidate,
  siblingWorsenedTooMuch,
  toQualityTrace,
  type RouteQualityTrace,
} from "./routeQuality";
import {
  CARD_ROUTE_CLEARANCE,
  MIN_ARROW_APPROACH,
  MIN_ENDPOINT_STUB,
  cardObstacle,
  defaultRouteCanvas,
  isSafeBridgePlacement,
  keepOutRect,
  obstacleViolationSegments,
  selectBestOrthogonalRoute,
  validateOrthogonalRoute,
  validateRouteGate,
} from "./routeHardening";
import {
  nearestPointIndex,
  repairRouteAroundAnchor,
  repairRouteEndpoint,
} from "./repairRouteEndpoint";
import type { RelatedDiagramRouteTopology } from "./routeTopology";
import type {
  RelatedDiagramCard,
  RelatedDiagramConnection,
} from "./types";

export type StoredRouteGeometry = {
  connectionId: string;
  sourceCardId: string;
  targetCardId: string;
  sourceEdge: EdgeSide;
  targetEdge: EdgeSide;
  sourcePin: Point;
  targetPin: Point;
  points: Point[];
};

export type StableRouteState = {
  byId: Record<string, StoredRouteGeometry>;
  lastValidPoints: Record<string, Point[]>;
  invalidReasons: Record<string, string[]>;
  bridges: CrossingBridge[];
  qualityTrace?: Record<string, RouteQualityTrace>;
};

export function clonePoints(points: Point[]): Point[] {
  return points.map((p) => ({ x: p.x, y: p.y }));
}

export function cloneStableRouteState(state: StableRouteState): StableRouteState {
  const byId: Record<string, StoredRouteGeometry> = {};
  for (const [id, route] of Object.entries(state.byId)) {
    byId[id] = {
      ...route,
      sourcePin: { ...route.sourcePin },
      targetPin: { ...route.targetPin },
      points: clonePoints(route.points),
    };
  }
  const lastValidPoints: Record<string, Point[]> = {};
  for (const [id, points] of Object.entries(state.lastValidPoints)) {
    lastValidPoints[id] = clonePoints(points);
  }
  const qualityTrace: Record<string, RouteQualityTrace> = {};
  for (const [id, trace] of Object.entries(state.qualityTrace ?? {})) {
    qualityTrace[id] = {
      ...trace,
      unsafeBridgeReasons: [...trace.unsafeBridgeReasons],
      routeBBox: { ...trace.routeBBox },
      crossCanvasRatio: { ...trace.crossCanvasRatio },
    };
  }
  return {
    byId,
    lastValidPoints,
    invalidReasons: { ...state.invalidReasons },
    bridges: state.bridges.map((b) => ({ ...b })),
    qualityTrace,
  };
}

export function pointsDeepEqual(a: Point[], b: Point[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((p, i) => p.x === b[i]!.x && p.y === b[i]!.y);
}

export function bridgesDeepEqual(a: CrossingBridge[], b: CrossingBridge[]): boolean {
  if (a.length !== b.length) return false;
  const key = (br: CrossingBridge) =>
    `${br.jumperConnectionId}:${br.underConnectionId}:${br.x}:${br.y}:${br.jumperAxis}`;
  const left = [...a].map(key).sort();
  const right = [...b].map(key).sort();
  return left.every((k, i) => k === right[i]);
}

export function storedToRouted(route: StoredRouteGeometry): RoutedConnection {
  return {
    connectionId: route.connectionId,
    sourceCardId: route.sourceCardId,
    targetCardId: route.targetCardId,
    sourceEdge: route.sourceEdge,
    targetEdge: route.targetEdge,
    points: route.points,
  };
}

export function stableRoutesList(state: StableRouteState): RoutedConnection[] {
  return Object.values(state.byId)
    .map(storedToRouted)
    .sort((a, b) => (a.connectionId < b.connectionId ? -1 : 1));
}

export const FAN_BP_RELOCATION_STEPS = [16, -16, 32, -32, 48, -48, 64, -64];

export function oppositeFanHalfPlane(
  branch: Point,
  previous: Point,
  next: Point,
): boolean {
  const sx = Math.sign(previous.x - branch.x);
  const sy = Math.sign(previous.y - branch.y);
  const nx = Math.sign(next.x - branch.x);
  const ny = Math.sign(next.y - branch.y);
  return (sx !== 0 && nx === -sx) || (sy !== 0 && ny === -sy);
}

function livePin(card: RelatedDiagramCard, edge: EdgeSide): Point {
  return edgeMidpoint(card.layout, edge);
}

function knowledgeConnectionIds(
  connections: RelatedDiagramConnection[],
  cards: RelatedDiagramCard[],
): Set<string> {
  const byId = new Map(cards.map((c) => [c.id, c]));
  return new Set(
    connections
      .filter((c) => {
        const s = byId.get(c.sourceCardId);
        const t = byId.get(c.targetCardId);
        return s?.cardType === "knowledge" && t?.cardType === "knowledge";
      })
      .map((c) => c.id),
  );
}

export function collectAffectedConnectionIds(input: {
  movedCardId: string;
  cards: RelatedDiagramCard[];
  connections: RelatedDiagramConnection[];
  topology?: RelatedDiagramRouteTopology;
  previous: StableRouteState;
}): string[] {
  const { movedCardId, connections, topology, previous } = input;
  const moved = input.cards.find((c) => c.id === movedCardId);
  const affected = new Set<string>();
  for (const conn of connections) {
    if (conn.sourceCardId === movedCardId || conn.targetCardId === movedCardId) {
      affected.add(conn.id);
    }
  }
  const siblingProtected = new Set<string>();
  if (topology) {
    for (const group of topology.routeGroups) {
      if (group.sourceCardId === movedCardId) continue;
      const incidentInGroup = group.connectionIds.some((id) => affected.has(id));
      if (!incidentInGroup) continue;
      for (const id of group.connectionIds) {
        if (!affected.has(id)) siblingProtected.add(id);
      }
    }
  }
  if (moved) {
    const keepOut = cardObstacle(moved);
    for (const route of Object.values(previous.byId)) {
      if (affected.has(route.connectionId)) continue;
      if (siblingProtected.has(route.connectionId)) continue;
      const hits = obstacleViolationSegments(
        route.points,
        [keepOut],
        new Set(),
        CARD_ROUTE_CLEARANCE,
      );
      if (hits.length > 0) affected.add(route.connectionId);
    }
  }
  if (topology) {
    const sourceGroups = topology.routeGroups.filter(
      (g) => g.sourceCardId === movedCardId,
    );
    for (const group of sourceGroups) {
      for (const id of group.connectionIds) affected.add(id);
    }
  }
  return [...affected].sort();
}

function makeStored(
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
    sourcePin: livePin(source, sourceEdge),
    targetPin: livePin(target, targetEdge),
    points: clonePoints(points),
  };
}

export function seedStableRouteState(
  cards: RelatedDiagramCard[],
  connections: RelatedDiagramConnection[],
  topology?: RelatedDiagramRouteTopology,
): StableRouteState {
  const plan = planOrthogonalRoutes(cards, connections, {
    canvas: { x: 0, y: 0, width: A3_WIDTH_PX, height: A3_HEIGHT_PX },
    extraObstacles: [getA3LegendBounds()],
    topology,
  });
  const authored = new Map((topology?.routes ?? []).map((r) => [r.connectionId, r]));
  const planned = new Map(plan.routes.map((r) => [r.connectionId, r]));
  const invalid = new Map(plan.invalidRoutes.map((r) => [r.connectionId, r]));
  const byId: Record<string, StoredRouteGeometry> = {};
  const lastValidPoints: Record<string, Point[]> = {};
  const invalidReasons: Record<string, string[]> = {};
  const cardById = new Map(cards.map((c) => [c.id, c]));
  for (const conn of connections) {
    const source = cardById.get(conn.sourceCardId);
    const target = cardById.get(conn.targetCardId);
    if (!source || !target) continue;
    const preset = authored.get(conn.id);
    const accepted = planned.get(conn.id);
    const failed = invalid.get(conn.id);
    const sourceEdge = preset?.sourceEdge ?? accepted?.sourceEdge ?? failed?.sourceEdge ?? "right";
    const targetEdge = preset?.targetEdge ?? accepted?.targetEdge ?? failed?.targetEdge ?? "left";
    const points =
      preset && preset.points.length >= 2
        ? preset.points
        : accepted?.points ?? failed?.points;
    if (!points || points.length < 2) continue;
    const stored = makeStored(conn, source, target, sourceEdge, targetEdge, points);
    byId[conn.id] = stored;
    if (failed && !accepted && !preset) {
      invalidReasons[conn.id] = failed.reasons;
    } else {
      lastValidPoints[conn.id] = clonePoints(stored.points);
    }
  }
  return {
    byId,
    lastValidPoints,
    invalidReasons,
    bridges: plan.bridges.map((b) => ({ ...b })),
    qualityTrace: {},
  };
}

function allObstacles(cards: RelatedDiagramCard[]): ReturnType<typeof cardObstacle>[] {
  return [...cards.map(cardObstacle), legendObstacle(getA3LegendBounds())];
}

function validateStored(
  stored: StoredRouteGeometry,
  cards: RelatedDiagramCard[],
  gate = false,
): string[] {
  const source = cards.find((c) => c.id === stored.sourceCardId);
  const target = cards.find((c) => c.id === stored.targetCardId);
  if (!source || !target) return ["missing-card"];
  const input = {
    points: stored.points,
    sourcePin: stored.sourcePin,
    targetPin: stored.targetPin,
    obstacles: allObstacles(cards),
    sourceCardId: source.id,
    targetCardId: target.id,
    clearance: 0,
    sourceEdge: stored.sourceEdge,
    targetEdge: stored.targetEdge,
  };
  return (gate ? validateRouteGate(input) : validateOrthogonalRoute(input)).reasons;
}

function fallbackFromLastValid(input: {
  lastValid: Point[] | undefined;
  existing: Point[];
  movingEnd: "source" | "target" | "both";
  sourcePin: Point;
  targetPin: Point;
}): Point[] {
  const base = input.lastValid ?? input.existing;
  if (input.movingEnd === "both") {
    const fromSource = repairRouteEndpoint({
      existingPoints: base,
      movingEnd: "source",
      livePin: input.sourcePin,
    });
    return repairRouteEndpoint({
      existingPoints: fromSource,
      movingEnd: "target",
      livePin: input.targetPin,
    });
  }
  const first = repairRouteEndpoint({
    existingPoints: base,
    movingEnd: input.movingEnd,
    livePin: input.movingEnd === "source" ? input.sourcePin : input.targetPin,
  });
  if (input.movingEnd === "source") {
    first[first.length - 1] = { x: input.targetPin.x, y: input.targetPin.y };
  } else {
    first[0] = { x: input.sourcePin.x, y: input.sourcePin.y };
  }
  return first;
}

function localReroute(input: {
  source: RelatedDiagramCard;
  target: RelatedDiagramCard;
  sourceEdge: EdgeSide;
  targetEdge: EdgeSide;
  cards: RelatedDiagramCard[];
  priorRoutes?: Point[][];
}): Point[] | null {
  return selectBestOrthogonalRoute({
    source: cardObstacle(input.source),
    target: cardObstacle(input.target),
    sourceEdge: input.sourceEdge,
    targetEdge: input.targetEdge,
    obstacles: allObstacles(input.cards),
    canvas: defaultRouteCanvas(),
    priorRoutes: input.priorRoutes,
  });
}

function geometryLegalPoints(
  points: Point[],
  source: RelatedDiagramCard,
  target: RelatedDiagramCard,
  sourceEdge: EdgeSide,
  targetEdge: EdgeSide,
  cards: RelatedDiagramCard[],
): boolean {
  return validateOrthogonalRoute({
    points,
    sourcePin: livePin(source, sourceEdge),
    targetPin: livePin(target, targetEdge),
    obstacles: allObstacles(cards),
    sourceCardId: source.id,
    targetCardId: target.id,
    clearance: 0,
    sourceEdge,
    targetEdge,
  }).ok;
}

function chooseBudgetedRoute(
  candidates: Point[][],
  congestion?: CongestionContext,
): Point[] | null {
  if (candidates.length === 0) return null;
  const unique: Point[][] = [];
  const seen = new Set<string>();
  for (const points of candidates) {
    const key = points.map((p) => `${Math.round(p.x)}:${Math.round(p.y)}`).join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(points);
  }
  const budgeted = pickWithinBridgeBudget(unique, polylineManhattan);
  const pool = budgeted.length ? budgeted : [unique.sort((a, b) => polylineManhattan(a) - polylineManhattan(b))[0]!];
  if (congestion && pool.length > 1) {
    const picked = selectQualityCandidate(pool, (points) =>
      evaluateRouteQuality({
        points,
        sourcePin: points[0]!,
        targetPin: points[points.length - 1]!,
        congestion,
      }),
    );
    if (picked) return picked;
  } else {
    pool.sort((a, b) => polylineManhattan(a) - polylineManhattan(b));
  }
  return pool[0] ?? null;
}

function pathfindCardToCard(input: {
  source: RelatedDiagramCard;
  target: RelatedDiagramCard;
  sourceEdge: EdgeSide;
  targetEdge: EdgeSide;
  cards: RelatedDiagramCard[];
  priorRoute?: Point[];
  priorRoutes?: Point[][];
  congestion?: CongestionContext;
  extraNodes?: Point[];
}): Point[] | null {
  const sourcePin = livePin(input.source, input.sourceEdge);
  const targetPin = livePin(input.target, input.targetEdge);
  const args = {
    start: sourcePin,
    goal: targetPin,
    startStub: outwardPoint(sourcePin, input.sourceEdge, MIN_ENDPOINT_STUB),
    goalApproach: outwardPoint(targetPin, input.targetEdge, MIN_ARROW_APPROACH),
    obstacles: allObstacles(input.cards),
    ignoreIds: new Set<string>(),
    corridors: [
      sourceExitCorridor(input.source.id, sourcePin, input.sourceEdge),
      targetEntryCorridor(input.target.id, targetPin, input.targetEdge),
    ],
    extraNodes: input.extraNodes,
    priorRoute: input.priorRoute,
    priorRoutes: input.priorRoutes,
    congestion: input.congestion,
  };
  const pick = (found: Point[] | null) =>
    found ? simplifyTinyDoglegs(found) : null;
  const smartPts = pick(findRectilinearPath(args));
  const barePts = pick(findRectilinearPath({ ...args, congestion: undefined, clearance: 0 }));
  const localPts = pick(localReroute(input));
  const raw = [smartPts, barePts, localPts].filter((p): p is Point[] => Boolean(p));
  const legal = raw.filter((points) =>
    geometryLegalPoints(
      points,
      input.source,
      input.target,
      input.sourceEdge,
      input.targetEdge,
      input.cards,
    ),
  );
  const chosen = chooseBudgetedRoute(legal.length ? legal : raw, input.congestion);
  if (chosen && input.congestion) {
    const baseline = [...(legal.length ? legal : raw)].sort(
      (a, b) => polylineManhattan(a) - polylineManhattan(b),
    )[0];
    if (
      baseline &&
      exceedsReasonableDetour(polylineManhattan(chosen), polylineManhattan(baseline)) &&
      withinBridgeRerouteBudget(polylineManhattan(chosen), polylineManhattan(baseline)) === false
    ) {
      return baseline;
    }
  }
  return chosen;
}

function pathfindToAnchor(input: {
  start: Point;
  startStub?: Point;
  goal: Point;
  goalApproach?: Point;
  cards: RelatedDiagramCard[];
  ignoreIds: Set<string>;
  corridors?: ReturnType<typeof sourceExitCorridor>[];
  priorRoute?: Point[];
  priorRoutes?: Point[][];
  congestion?: CongestionContext;
  extraNodes?: Point[];
}): Point[] | null {
  const args = {
    start: input.start,
    goal: input.goal,
    startStub: input.startStub,
    goalApproach: input.goalApproach,
    obstacles: allObstacles(input.cards),
    ignoreIds: input.ignoreIds,
    corridors: input.corridors,
    extraNodes: input.extraNodes,
    priorRoute: input.priorRoute,
    priorRoutes: input.priorRoutes,
    congestion: input.congestion,
  };
  const smart = findRectilinearPath(args);
  const bare = findRectilinearPath({ ...args, congestion: undefined, clearance: 0 });
  const raw = [smart, bare]
    .filter((p): p is Point[] => Boolean(p))
    .map((p) => simplifyTinyDoglegs(p));
  const chosen = chooseBudgetedRoute(raw, input.congestion);
  return chosen;
}

function concatAtAnchor(prefix: Point[], suffix: Point[]): Point[] {
  if (prefix.length === 0) return suffix;
  if (suffix.length === 0) return prefix;
  const a = prefix[prefix.length - 1]!;
  const b = suffix[0]!;
  if (Math.abs(a.x - b.x) <= 0.2 && Math.abs(a.y - b.y) <= 0.2) {
    return [...prefix, ...suffix.slice(1)];
  }
  return [...prefix, ...suffix];
}

function splitAtAnchor(points: Point[], anchor: Point): {
  prefix: Point[];
  suffix: Point[];
} {
  const idx = nearestPointIndex(points, anchor, 16);
  if (idx < 0) {
    return { prefix: [points[0]!, anchor], suffix: [anchor, points[points.length - 1]!] };
  }
  return {
    prefix: points.slice(0, idx + 1),
    suffix: points.slice(idx),
  };
}

function slideBranchVertex(points: Point[], from: Point, to: Point): Point[] {
  const idx = nearestPointIndex(points, from, 16);
  if (idx < 0) return clonePoints(points);
  const next = clonePoints(points);
  next[idx] = { x: to.x, y: to.y };
  if (idx > 0) {
    const prev = next[idx - 1]!;
    if (Math.abs(prev.x - to.x) > 0.51 && Math.abs(prev.y - to.y) > 0.51) {
      next.splice(idx, 0, { x: to.x, y: prev.y });
    }
  }
  if (idx < next.length - 1) {
    const aft = next[idx + 1]!;
    const at = next[idx]!;
    if (Math.abs(aft.x - at.x) > 0.51 && Math.abs(aft.y - at.y) > 0.51) {
      next.splice(idx + 1, 0, { x: at.x, y: aft.y });
    }
  }
  return next;
}

function searchLegalAnchor(
  origin: Point,
  cards: RelatedDiagramCard[],
  ignoreIds: Set<string>,
): Point | null {
  const obstacles = allObstacles(cards);
  const inside = (p: Point) =>
    obstacles.some((box) => {
      if (ignoreIds.has(box.id)) return false;
      const r = obstacleKeepOut(box, CARD_ROUTE_CLEARANCE);
      return (
        p.x > r.x &&
        p.x < r.x + r.width &&
        p.y > r.y &&
        p.y < r.y + r.height
      );
    });
  const originClamped = clampRoutePointToA3(origin);
  if (!inside(originClamped)) return originClamped;
  const steps = FAN_BP_RELOCATION_STEPS;
  let best: Point | null = null;
  let bestD = Infinity;
  for (const dx of steps) {
    for (const dy of [0, ...steps]) {
      const p = clampRoutePointToA3({ x: origin.x + dx, y: origin.y + dy });
      if (inside(p)) continue;
      const d = Math.abs(p.x - origin.x) + Math.abs(p.y - origin.y);
      if (d < bestD) {
        best = p;
        bestD = d;
      }
    }
  }
  for (const dy of steps) {
    const p = clampRoutePointToA3({ x: origin.x, y: origin.y + dy });
    if (inside(p)) continue;
    const d = Math.abs(p.y - origin.y);
    if (d < bestD) {
      best = p;
      bestD = d;
    }
  }
  return best;
}

function updateBridgesIncrementally(input: {
  previous: StableRouteState;
  nextById: Record<string, StoredRouteGeometry>;
  changedIds: Set<string>;
  cards: RelatedDiagramCard[];
  topology?: RelatedDiagramRouteTopology;
}): CrossingBridge[] {
  const kept = input.previous.bridges.filter(
    (br) =>
      !input.changedIds.has(br.jumperConnectionId) &&
      !input.changedIds.has(br.underConnectionId),
  );
  const classified = classifyRouteInteractions(
    Object.values(input.nextById).map(storedToRouted),
    input.cards,
    input.topology,
  );
  const incremental = classified.bridges.filter(
    (br) =>
      input.changedIds.has(br.jumperConnectionId) ||
      input.changedIds.has(br.underConnectionId),
  );
  const seen = new Set(
    kept.map((br) => `${Math.round(br.x)}:${Math.round(br.y)}`),
  );
  const merged = [...kept];
  for (const br of incremental) {
    const key = `${Math.round(br.x)}:${Math.round(br.y)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push({ ...br });
  }
  return merged;
}

function topologyWithUpdatedRoutes(
  topology: RelatedDiagramRouteTopology,
  byId: Record<string, StoredRouteGeometry>,
  changedIds: Set<string>,
  bpMoves: Array<{ id: string; x: number; y: number }> = [],
): RelatedDiagramRouteTopology {
  const moved = new Map(bpMoves.map((b) => [b.id, b]));
  return {
    ...topology,
    branchPoints: topology.branchPoints.map((bp) => {
      const next = moved.get(bp.id);
      return next ? { ...bp, x: next.x, y: next.y } : bp;
    }),
    routes: topology.routes.map((route) => {
      if (!changedIds.has(route.connectionId)) return route;
      const stored = byId[route.connectionId];
      if (!stored) return route;
      return {
        ...route,
        sourceEdge: stored.sourceEdge,
        targetEdge: stored.targetEdge,
        points: clonePoints(stored.points),
      };
    }),
  };
}

function relocateFanBranchForChild(input: {
  bp: { id: string; x: number; y: number; connectionIds: string[] };
  source: RelatedDiagramCard;
  target: RelatedDiagramCard;
  sourceEdge: EdgeSide;
  targetEdge: EdgeSide;
  cards: RelatedDiagramCard[];
  connections: RelatedDiagramConnection[];
  previous: StableRouteState;
  priorRoutes: Point[][];
  congestion: CongestionContext;
  currentChildLen: number;
}): { x: number; y: number; points: Point[] } | null {
  const sourcePin = livePin(input.source, input.sourceEdge);
  const targetPin = livePin(input.target, input.targetEdge);
  const sx = Math.sign(targetPin.x - input.bp.x) || 1;
  const sy = Math.sign(targetPin.y - input.bp.y) || 1;
  const offsets: Point[] = [];
  for (const step of [32, 64, 16, 48]) {
    offsets.push({ x: sx * step, y: 0 });
    offsets.push({ x: 0, y: sy * step });
    offsets.push({ x: sx * step, y: sy * step });
  }
  let best: { x: number; y: number; points: Point[]; childLen: number; move: number } | null =
    null;
  for (const off of offsets) {
      const raw = { x: input.bp.x + off.x, y: input.bp.y + off.y };
      const next = clampRoutePointToA3(raw);
      if (Math.abs(next.x - input.bp.x) < 0.2 && Math.abs(next.y - input.bp.y) < 0.2) {
        continue;
      }
      const blocked = allObstacles(input.cards).some((box) => {
        const r = obstacleKeepOut(box, CARD_ROUTE_CLEARANCE);
        return next.x > r.x && next.x < r.x + r.width && next.y > r.y && next.y < r.y + r.height;
      });
      if (blocked) continue;
      const move = Math.abs(next.x - input.bp.x) + Math.abs(next.y - input.bp.y);
      const trunk = pathfindToAnchor({
        start: sourcePin,
        startStub: outwardPoint(sourcePin, input.sourceEdge, MIN_ENDPOINT_STUB),
        goal: next,
        cards: input.cards,
        ignoreIds: new Set<string>(),
        corridors: [sourceExitCorridor(input.source.id, sourcePin, input.sourceEdge)],
        priorRoutes: input.priorRoutes,
      });
      const child = pathfindToAnchor({
        start: next,
        goal: targetPin,
        goalApproach: outwardPoint(targetPin, input.targetEdge, MIN_ARROW_APPROACH),
        cards: input.cards,
        ignoreIds: new Set<string>(),
        corridors: [targetEntryCorridor(input.target.id, targetPin, input.targetEdge)],
        priorRoutes: input.priorRoutes,
      });
      if (!trunk || !child) continue;
      const points = concatAtAnchor(trunk, child);
      const childLen = polylineManhattan(child);
      if (childLen + 1 >= input.currentChildLen) continue;
      if (a3BoundaryViolationReasons(points).length > 0) continue;
      const conn = input.connections.find((c) =>
        input.bp.connectionIds.includes(c.id) &&
        (c.sourceCardId === input.source.id && c.targetCardId === input.target.id),
      );
      if (conn) {
        const trial = makeStored(
          conn,
          input.source,
          input.target,
          input.sourceEdge,
          input.targetEdge,
          points,
        );
        if (validateStored(trial, input.cards, true).length > 0) continue;
      }
      let siblingsOk = true;
      for (const id of input.bp.connectionIds) {
        if (conn && id === conn.id) continue;
        const stored = input.previous.byId[id];
        const siblingConn = input.connections.find((c) => c.id === id);
        if (!stored || !siblingConn) continue;
        const siblingSource = input.cards.find((c) => c.id === siblingConn.sourceCardId);
        const siblingTarget = input.cards.find((c) => c.id === siblingConn.targetCardId);
        if (!siblingSource || !siblingTarget) continue;
        const slid = slideBranchVertex(
          stored.points,
          { x: input.bp.x, y: input.bp.y },
          next,
        );
        const siblingStored = makeStored(
          siblingConn,
          siblingSource,
          siblingTarget,
          stored.sourceEdge,
          stored.targetEdge,
          slid,
        );
        if (validateStored(siblingStored, input.cards, false).length > 0) {
          siblingsOk = false;
          break;
        }
        const prevLeg = splitAtAnchor(stored.points, {
          x: input.bp.x,
          y: input.bp.y,
        }).suffix;
        const nextLeg = splitAtAnchor(slid, next).suffix;
        if (
          siblingWorsenedTooMuch(
            polylineManhattan(prevLeg),
            polylineManhattan(nextLeg),
          )
        ) {
          siblingsOk = false;
          break;
        }
      }
      if (!siblingsOk) continue;
      if (
        !best ||
        childLen < best.childLen - 0.5 ||
        (Math.abs(childLen - best.childLen) <= 0.5 && move < best.move)
      ) {
        best = { x: next.x, y: next.y, points, childLen, move };
        if (move <= 32) return { x: best.x, y: best.y, points: best.points };
      }
  }
  return best ? { x: best.x, y: best.y, points: best.points } : null;
}

export function applyIncrementalCardMove(input: {
  previous: StableRouteState;
  cards: RelatedDiagramCard[];
  connections: RelatedDiagramConnection[];
  topology?: RelatedDiagramRouteTopology;
  movedCardId: string;
}): { state: StableRouteState; topology?: RelatedDiagramRouteTopology } {
  const affected = new Set(
    collectAffectedConnectionIds({
      movedCardId: input.movedCardId,
      cards: input.cards,
      connections: input.connections,
      topology: input.topology,
      previous: input.previous,
    }),
  );
  const cardById = new Map(input.cards.map((c) => [c.id, c]));
  const nextById: Record<string, StoredRouteGeometry> = { ...input.previous.byId };
  const lastValidPoints = { ...input.previous.lastValidPoints };
  const invalidReasons = { ...input.previous.invalidReasons };
  const qualityTrace: Record<string, RouteQualityTrace> = {
    ...(input.previous.qualityTrace ?? {}),
  };
  const bpMoves: Array<{ id: string; x: number; y: number }> = [];
  const trunkCache = new Map<string, Point[]>();
  const priorRoutes = Object.values(input.previous.byId)
    .filter((r) => !affected.has(r.connectionId))
    .map((r) => r.points);
  const congestionFor = (connectionId: string): CongestionContext => ({
    routes: Object.values(input.previous.byId)
      .filter((r) => r.connectionId !== connectionId)
      .map((r) => ({
        connectionId: r.connectionId,
        points: r.points,
        groupId: input.topology?.routeGroups.find((g) =>
          g.connectionIds.includes(r.connectionId),
        )?.id,
      })),
    exemptIds: sameGroupIds(input.topology?.routeGroups, connectionId),
    bridges: input.previous.bridges
      .filter(
        (br) =>
          br.jumperConnectionId !== connectionId &&
          br.underConnectionId !== connectionId,
      )
      .map((br) => ({ x: br.x, y: br.y })),
    junctions: (input.topology?.branchPoints ?? []).map((b) => ({
      x: b.x,
      y: b.y,
    })),
  });
  const pathfindBest = (
    conn: RelatedDiagramConnection,
    source: RelatedDiagramCard,
    target: RelatedDiagramCard,
    preferred: { sourceEdge: EdgeSide; targetEdge: EdgeSide },
    allowAlternate: boolean,
  ): { points: Point[]; sourceEdge: EdgeSide; targetEdge: EdgeSide } | null => {
    const congestion = congestionFor(conn.id);
    const tryPair = (pair: { sourceEdge: EdgeSide; targetEdge: EdgeSide }) => {
      const points = pathfindCardToCard({
        source,
        target,
        sourceEdge: pair.sourceEdge,
        targetEdge: pair.targetEdge,
        cards: input.cards,
        priorRoute: input.previous.byId[conn.id]?.points,
        priorRoutes,
        congestion,
      });
      if (!points) return null;
      const stored = makeStored(
        conn,
        source,
        target,
        pair.sourceEdge,
        pair.targetEdge,
        points,
      );
      if (validateStored(stored, input.cards, true).length > 0) return null;
      return { points, pair, score: scoreCongestedRoute(points, congestion) };
    };
    const primary = tryPair(preferred);
    if (!allowAlternate) {
      return primary
        ? {
            points: primary.points,
            sourceEdge: preferred.sourceEdge,
            targetEdge: preferred.targetEdge,
          }
        : null;
    }
    const alt = tryPair(secondaryEdgePair(preferred));
    const reportOf = (item: NonNullable<typeof primary>) =>
      evaluateRouteQuality({
        points: item.points,
        sourcePin: item.points[0]!,
        targetPin: item.points[item.points.length - 1]!,
        congestion,
      });
    if (primary && alt) {
      const picked = selectQualityCandidate([primary, alt], reportOf);
      if (picked) {
        return {
          points: picked.points,
          sourceEdge: picked.pair.sourceEdge,
          targetEdge: picked.pair.targetEdge,
        };
      }
    }
    if (primary) {
      const primaryQuality = reportOf(primary);
      if (primaryQuality.class === "reject" && alt) {
        return {
          points: alt.points,
          sourceEdge: secondaryEdgePair(preferred).sourceEdge,
          targetEdge: secondaryEdgePair(preferred).targetEdge,
        };
      }
      return {
        points: primary.points,
        sourceEdge: preferred.sourceEdge,
        targetEdge: preferred.targetEdge,
      };
    }
    if (alt) {
      return {
        points: alt.points,
        sourceEdge: secondaryEdgePair(preferred).sourceEdge,
        targetEdge: secondaryEdgePair(preferred).targetEdge,
      };
    }
    return null;
  };

  const commit = (
    connectionId: string,
    conn: RelatedDiagramConnection,
    source: RelatedDiagramCard,
    target: RelatedDiagramCard,
    sourceEdge: EdgeSide,
    targetEdge: EdgeSide,
    points: Point[],
    movingEnd: "source" | "target" | "both",
  ) => {
    let stored = makeStored(
      conn,
      source,
      target,
      sourceEdge,
      targetEdge,
      simplifyTinyDoglegs(points),
    );
    let reasons = validateStored(stored, input.cards, true);
    if (reasons.length > 0) {
      const found = pathfindCardToCard({
        source,
        target,
        sourceEdge,
        targetEdge,
        cards: input.cards,
        priorRoute: input.previous.byId[connectionId]?.points,
        priorRoutes,
        congestion: congestionFor(connectionId),
      });
      if (found) {
        stored = makeStored(conn, source, target, sourceEdge, targetEdge, found);
        reasons = validateStored(stored, input.cards, true);
      }
    }
    if (reasons.length > 0) {
      stored = makeStored(
        conn,
        source,
        target,
        sourceEdge,
        targetEdge,
        fallbackFromLastValid({
          lastValid: input.previous.lastValidPoints[connectionId],
          existing: input.previous.byId[connectionId]?.points ?? points,
          movingEnd,
          sourcePin: stored.sourcePin,
          targetPin: stored.targetPin,
        }),
      );
      reasons = validateStored(stored, input.cards, true);
    }
    const liveBp = (input.topology?.branchPoints ?? []).find((p) =>
      p.connectionIds.includes(connectionId),
    );
    const fanBp = liveBp
      ? (bpMoves.find((m) => m.id === liveBp.id) ?? liveBp)
      : undefined;
    if (
      exceedsFinalDetourRatio(
        polylineManhattan(stored.points),
        stored.sourcePin,
        stored.targetPin,
        fanBp ? { x: fanBp.x, y: fanBp.y } : undefined,
      )
    ) {
      const altPair = secondaryEdgePair({ sourceEdge, targetEdge });
      const alt = pathfindCardToCard({
        source,
        target,
        sourceEdge: altPair.sourceEdge,
        targetEdge: altPair.targetEdge,
        cards: input.cards,
        priorRoute: input.previous.byId[connectionId]?.points,
        priorRoutes,
        congestion: congestionFor(connectionId),
      });
      if (
        alt &&
        !exceedsFinalDetourRatio(
          polylineManhattan(alt),
          livePin(source, altPair.sourceEdge),
          livePin(target, altPair.targetEdge),
          fanBp ? { x: fanBp.x, y: fanBp.y } : undefined,
        )
      ) {
        stored = makeStored(
          conn,
          source,
          target,
          altPair.sourceEdge,
          altPair.targetEdge,
          alt,
        );
        reasons = validateStored(stored, input.cards, true);
      } else {
        reasons = [...new Set([...reasons, "excessive-detour"])];
      }
    }
    const congestion = congestionFor(connectionId);
    const qualityOf = (candidate: StoredRouteGeometry, hard: string[]) =>
      evaluateRouteQuality({
        points: candidate.points,
        sourcePin: candidate.sourcePin,
        targetPin: candidate.targetPin,
        congestion,
        hardReasons: hard,
        branchPoint: fanBp ? { x: fanBp.x, y: fanBp.y } : undefined,
      });
    let quality = qualityOf(stored, reasons);
    let fallbackReason: string | undefined;
    let lastValidUsed = false;
    if (quality.class === "reject" || quality.qualityReasons.length > 0) {
      const altPair = secondaryEdgePair({
        sourceEdge: stored.sourceEdge,
        targetEdge: stored.targetEdge,
      });
      const alt = pathfindCardToCard({
        source,
        target,
        sourceEdge: altPair.sourceEdge,
        targetEdge: altPair.targetEdge,
        cards: input.cards,
        priorRoute: input.previous.byId[connectionId]?.points,
        priorRoutes,
        congestion,
      });
      if (alt) {
        const altStored = makeStored(
          conn,
          source,
          target,
          altPair.sourceEdge,
          altPair.targetEdge,
          alt,
        );
        const altHard = validateStored(altStored, input.cards, true);
        const altQuality = qualityOf(altStored, altHard);
        if (
          altHard.length === 0 &&
          compareQualityReports(altQuality, quality) < 0
        ) {
          stored = altStored;
          reasons = altHard;
          quality = altQuality;
          fallbackReason = "alternate-edge";
        }
      }
    }
    const last = input.previous.lastValidPoints[connectionId];
    const lastMatchesPins =
      !!last &&
      last.length >= 2 &&
      Math.abs(last[0]!.x - stored.sourcePin.x) <= 0.2 &&
      Math.abs(last[0]!.y - stored.sourcePin.y) <= 0.2 &&
      Math.abs(last[last.length - 1]!.x - stored.targetPin.x) <= 0.2 &&
      Math.abs(last[last.length - 1]!.y - stored.targetPin.y) <= 0.2;
    const pierces = (candidate: Point[]) =>
      validateOrthogonalRoute({
        points: candidate,
        sourcePin: stored.sourcePin,
        targetPin: stored.targetPin,
        obstacles: allObstacles(input.cards),
        sourceCardId: source.id,
        targetCardId: target.id,
        clearance: 0,
      }).reasons.includes("obstacle-violation");
    if (
      quality.class === "reject" &&
      last &&
      lastMatchesPins &&
      !pierces(last)
    ) {
      const reused = { ...stored, points: clonePoints(last) };
      const reusedHard = validateStored(reused, input.cards, true);
      if (reusedHard.length === 0) {
        stored = reused;
        reasons = [];
        quality = qualityOf(stored, []);
        fallbackReason = "lastValid";
        lastValidUsed = true;
      }
    } else if (quality.class === "reject" && last && !lastMatchesPins) {
      const repairedPts = fallbackFromLastValid({
        lastValid: last,
        existing: stored.points,
        movingEnd,
        sourcePin: stored.sourcePin,
        targetPin: stored.targetPin,
      });
      const repaired = makeStored(
        conn,
        source,
        target,
        stored.sourceEdge,
        stored.targetEdge,
        repairedPts,
      );
      const repairedHard = validateStored(repaired, input.cards, true);
      const repairedQuality = qualityOf(repaired, repairedHard);
      if (repairedHard.length === 0) {
        stored = repaired;
        reasons = repairedQuality.class === "reject" ? repairedQuality.qualityReasons : [];
        quality = repairedQuality;
        fallbackReason = "lastValid-repair";
        lastValidUsed = true;
      }
    }
    if (quality.class === "reject") {
      reasons = [...new Set([...reasons, ...quality.qualityReasons])];
      if (!fallbackReason) fallbackReason = quality.qualityReasons[0] ?? "quality-reject";
    }
    nextById[connectionId] = stored;
    qualityTrace[connectionId] = toQualityTrace(connectionId, quality, {
      fallbackReason,
      lastValidUsed,
      bpRelocated: bpMoves.some((m) => m.id === liveBp?.id),
    });
    if (reasons.length === 0) {
      lastValidPoints[connectionId] = clonePoints(stored.points);
      delete invalidReasons[connectionId];
    } else if (
      reasons.includes("obstacle-violation") ||
      reasons.includes("legend-violation") ||
      reasons.includes("self-card-penetration")
    ) {
      if (last && lastMatchesPins && !pierces(last)) {
        nextById[connectionId] = { ...stored, points: clonePoints(last) };
        lastValidUsed = true;
        fallbackReason = fallbackReason ?? "lastValid";
      }
      invalidReasons[connectionId] = reasons;
    } else {
      invalidReasons[connectionId] = reasons;
    }
  };

  for (const connectionId of affected) {
    const conn = input.connections.find((c) => c.id === connectionId);
    const prev = input.previous.byId[connectionId];
    if (!conn || !prev) continue;
    const source = cardById.get(conn.sourceCardId);
    const target = cardById.get(conn.targetCardId);
    if (!source || !target) continue;
    const isSource = conn.sourceCardId === input.movedCardId;
    const isTarget = conn.targetCardId === input.movedCardId;
    const fanGroup = input.topology?.routeGroups.find((g) =>
      g.connectionIds.includes(connectionId),
    );
    const bp = input.topology?.branchPoints.find((p) =>
      p.connectionIds.includes(connectionId),
    );
    const isFanSource = Boolean(
      fanGroup && fanGroup.sourceCardId === input.movedCardId && isSource,
    );
    const isFanChild = Boolean(
      fanGroup &&
        fanGroup.sourceCardId !== input.movedCardId &&
        isTarget &&
        !isSource,
    );

    if (isFanChild && bp) {
      const oppositePreview = oppositeFanHalfPlane(bp, prev.targetPin, {
        x: target.layout.x + target.layout.width / 2,
        y: target.layout.y + target.layout.height / 2,
      });
      const facing = chooseAnchorFacingEdge(
        { x: bp.x, y: bp.y },
        target,
        oppositePreview ? undefined : prev.targetEdge,
      );
      const targetEdge = facing.edge;
      const targetPin = livePin(target, targetEdge);
      const split = splitAtAnchor(prev.points, { x: bp.x, y: bp.y });
      let leg = repairRouteAroundAnchor({
        existingPoints: prev.points,
        anchor: { x: bp.x, y: bp.y },
        movingEnd: "target",
        livePin: targetPin,
      });
      let storedTry = makeStored(
        conn,
        source,
        target,
        prev.sourceEdge,
        targetEdge,
        leg,
      );
      if (validateStored(storedTry, input.cards, true).length > 0) {
        const found = pathfindToAnchor({
          start: { x: bp.x, y: bp.y },
          goal: targetPin,
          goalApproach: outwardPoint(targetPin, targetEdge, MIN_ARROW_APPROACH),
          cards: input.cards,
          ignoreIds: new Set<string>(),
          corridors: [targetEntryCorridor(target.id, targetPin, targetEdge)],
          priorRoute: split.suffix,
          priorRoutes,
          congestion: congestionFor(connectionId),
        });
        if (found) {
          leg = concatAtAnchor(split.prefix, found);
        }
      }
      const childSplit = splitAtAnchor(leg, { x: bp.x, y: bp.y });
      const childEnd = childSplit.suffix[childSplit.suffix.length - 1];
      const reachesLivePin =
        !!childEnd &&
        Math.abs(childEnd.x - targetPin.x) <= 0.2 &&
        Math.abs(childEnd.y - targetPin.y) <= 0.2;
      const childLen = reachesLivePin
        ? polylineManhattan(childSplit.suffix)
        : Number.POSITIVE_INFINITY;
      const childDirect = Math.max(
        1,
        Math.abs(bp.x - targetPin.x) + Math.abs(bp.y - targetPin.y),
      );
      const opposite = oppositeFanHalfPlane(bp, prev.targetPin, targetPin);
      const highDetour = childLen / childDirect > FAN_BP_RELOCATION_DETOUR_THRESHOLD;
      const storedForQuality = makeStored(
        conn,
        source,
        target,
        prev.sourceEdge,
        targetEdge,
        leg,
      );
      const hard = validateStored(storedForQuality, input.cards, true);
      const childQuality = evaluateRouteQuality({
        points: leg,
        sourcePin: livePin(source, prev.sourceEdge),
        targetPin,
        congestion: congestionFor(connectionId),
        hardReasons: hard,
        branchPoint: { x: bp.x, y: bp.y },
        localityPoints: childSplit.suffix,
      });
      const qualityFail =
        exceedsFinalDetourRatio(
          polylineManhattan(leg),
          livePin(source, prev.sourceEdge),
          targetPin,
          { x: bp.x, y: bp.y },
        ) ||
        a3BoundaryViolationReasons(leg).length > 0 ||
        hard.length > 0 ||
        qualityNeedsFanRelocation(childQuality);
      if (
        (opposite && (highDetour || qualityFail || qualityNeedsFanRelocation(childQuality))) ||
        (qualityNeedsFanRelocation(childQuality) && (highDetour || hard.length > 0))
      ) {
        const relocated = relocateFanBranchForChild({
          bp,
          source,
          target,
          sourceEdge: prev.sourceEdge,
          targetEdge,
          cards: input.cards,
          connections: input.connections,
          previous: input.previous,
          priorRoutes,
          congestion: congestionFor(connectionId),
          currentChildLen: childLen,
        });
        if (relocated) {
          bpMoves.push({ id: bp.id, x: relocated.x, y: relocated.y });
          leg = relocated.points;
        }
      }
      commit(
        connectionId,
        conn,
        source,
        target,
        prev.sourceEdge,
        targetEdge,
        leg,
        "target",
      );
      continue;
    }

    if (isFanSource && bp && fanGroup) {
      const edges = chooseEdgesWithHysteresis(source, target, {
        sourceEdge: prev.sourceEdge,
        targetEdge: prev.targetEdge,
      });
      const sourcePin = livePin(source, edges.sourceEdge);
      const cacheKey = `${fanGroup.id}:${edges.sourceEdge}:${bp.x}:${bp.y}`;
      let trunk = trunkCache.get(cacheKey);
      if (!trunk) {
        const repaired = repairRouteAroundAnchor({
          existingPoints: prev.points,
          anchor: { x: bp.x, y: bp.y },
          movingEnd: "source",
          livePin: sourcePin,
        });
        const split = splitAtAnchor(repaired, { x: bp.x, y: bp.y });
        const trial = makeStored(
          conn,
          source,
          target,
          edges.sourceEdge,
          prev.targetEdge,
          repaired,
        );
        if (validateStored(trial, input.cards, false).length === 0) {
          trunk = split.prefix;
        } else {
          trunk =
            pathfindToAnchor({
              start: sourcePin,
              startStub: outwardPoint(sourcePin, edges.sourceEdge, MIN_ENDPOINT_STUB),
              goal: { x: bp.x, y: bp.y },
              cards: input.cards,
              ignoreIds: new Set<string>(),
              corridors: [sourceExitCorridor(source.id, sourcePin, edges.sourceEdge)],
              priorRoute: split.prefix,
              priorRoutes,
              congestion: congestionFor(connectionId),
            }) ?? split.prefix;
        }
        if (
          validateOrthogonalRoute({
            points: concatAtAnchor(trunk, [{ x: bp.x, y: bp.y }]),
            sourcePin,
            targetPin: { x: bp.x, y: bp.y },
            obstacles: allObstacles(input.cards),
            sourceCardId: source.id,
            targetCardId: target.id,
            clearance: 0,
          }).ok === false
        ) {
          const movedBp = searchLegalAnchor(
            { x: bp.x, y: bp.y },
            input.cards,
            new Set([source.id]),
          );
          if (movedBp && (movedBp.x !== bp.x || movedBp.y !== bp.y)) {
            const retried = pathfindToAnchor({
              start: sourcePin,
              startStub: outwardPoint(sourcePin, edges.sourceEdge, MIN_ENDPOINT_STUB),
              goal: movedBp,
              cards: input.cards,
              ignoreIds: new Set<string>(),
              corridors: [sourceExitCorridor(source.id, sourcePin, edges.sourceEdge)],
              priorRoute: split.prefix,
              priorRoutes,
              congestion: congestionFor(connectionId),
            });
            if (retried) {
              trunk = retried;
              bpMoves.push({ id: bp.id, x: movedBp.x, y: movedBp.y });
            }
          }
        }
        trunkCache.set(cacheKey, trunk);
      }
      const liveBp = bpMoves.find((m) => m.id === bp.id) ?? bp;
      const split = splitAtAnchor(prev.points, { x: bp.x, y: bp.y });
      const suffix =
        liveBp.x === bp.x && liveBp.y === bp.y
          ? split.suffix
          : slideBranchVertex(split.suffix, { x: bp.x, y: bp.y }, liveBp);
      commit(
        connectionId,
        conn,
        source,
        target,
        edges.sourceEdge,
        prev.targetEdge,
        concatAtAnchor(trunk, suffix),
        "source",
      );
      continue;
    }

    const picked = chooseEdgesWithHysteresis(source, target, {
      sourceEdge: prev.sourceEdge,
      targetEdge: prev.targetEdge,
    });
    const edges = {
      sourceEdge: picked.sourceEdge,
      targetEdge: picked.targetEdge,
      flipped: picked.flipped,
    };
    const sourcePin = livePin(source, edges.sourceEdge);
    const targetPin = livePin(target, edges.targetEdge);
    let points: Point[];
    let movingEnd: "source" | "target" | "both" = isSource
      ? isTarget
        ? "both"
        : "source"
      : isTarget
        ? "target"
        : "both";
    const congestion = congestionFor(connectionId);
    if (edges.flipped || movingEnd === "both") {
      const best = pathfindBest(conn, source, target, edges, true);
      points =
        best?.points ??
        fallbackFromLastValid({
          lastValid: input.previous.lastValidPoints[connectionId],
          existing: prev.points,
          movingEnd,
          sourcePin,
          targetPin,
        });
      if (best) {
        edges.sourceEdge = best.sourceEdge;
        edges.targetEdge = best.targetEdge;
      }
    } else if (isSource && !isTarget) {
      points = repairRouteEndpoint({
        existingPoints: prev.points,
        movingEnd: "source",
        livePin: sourcePin,
      });
    } else if (isTarget && !isSource) {
      points = repairRouteEndpoint({
        existingPoints: prev.points,
        movingEnd: "target",
        livePin: targetPin,
      });
    } else {
      const best = pathfindBest(conn, source, target, edges, true);
      points = best?.points ?? prev.points;
      if (best) {
        edges.sourceEdge = best.sourceEdge;
        edges.targetEdge = best.targetEdge;
      }
    }
    const repairedScore = scoreCongestedRoute(points, congestion);
    if (
      !edges.flipped &&
      movingEnd !== "both" &&
      isCongestedCandidate(repairedScore)
    ) {
      const best = pathfindBest(conn, source, target, edges, true);
      if (best) {
        const nextScore = scoreCongestedRoute(best.points, congestion);
        if (nextScore.score + 1 < repairedScore.score) {
          points = best.points;
          edges.sourceEdge = best.sourceEdge;
          edges.targetEdge = best.targetEdge;
        }
      }
    }
    commit(
      connectionId,
      conn,
      source,
      target,
      edges.sourceEdge,
      edges.targetEdge,
      points,
      movingEnd,
    );
  }

  if (bpMoves.length > 0 && input.topology) {
    for (const move of bpMoves) {
      const bp = input.topology.branchPoints.find((b) => b.id === move.id);
      if (!bp) continue;
      for (const id of bp.connectionIds) {
        if (affected.has(id)) continue;
        const stored = nextById[id];
        if (!stored) continue;
        nextById[id] = {
          ...stored,
          points: slideBranchVertex(
            stored.points,
            { x: bp.x, y: bp.y },
            { x: move.x, y: move.y },
          ),
        };
        affected.add(id);
      }
    }
  }

  let workingTopo = input.topology
    ? topologyWithUpdatedRoutes(input.topology, nextById, affected, bpMoves)
    : input.topology;
  let bridges = updateBridgesIncrementally({
    previous: input.previous,
    nextById,
    changedIds: affected,
    cards: input.cards,
    topology: workingTopo,
  });
  const keepOuts = allObstacles(input.cards).map((o) => keepOutRect(o));
  const junctions = (workingTopo?.branchPoints ?? []).map((b) => ({
    x: b.x,
    y: b.y,
  }));
  const collectUnsafeJumpers = (current: CrossingBridge[]) => {
    const fromCluster = collectUnsafeBridgeJumperIds({
      bridges: current,
      routes: nextById,
      junctions,
      changedIds: affected,
    });
    const fromSafe = new Set<string>();
    for (const br of current) {
      if (
        !affected.has(br.jumperConnectionId) &&
        !affected.has(br.underConnectionId)
      ) {
        continue;
      }
      const jumper = nextById[br.jumperConnectionId];
      if (!jumper) continue;
      if (
        !isSafeBridgePlacement({ x: br.x, y: br.y }, jumper.points, {
          keepOuts,
          junctions,
        })
      ) {
        fromSafe.add(br.jumperConnectionId);
      }
    }
    const jumperIds = new Set([...fromCluster.jumperIds, ...fromSafe]);
    return { jumperIds, reasonsByJumper: fromCluster.reasonsByJumper };
  };
  const rerouteJumpers = (jumperIds: Set<string>) => {
    for (const connectionId of jumperIds) {
      const conn = input.connections.find((c) => c.id === connectionId);
      const stored = nextById[connectionId];
      if (!conn || !stored) continue;
      const source = cardById.get(conn.sourceCardId);
      const target = cardById.get(conn.targetCardId);
      if (!source || !target) continue;
      const baseline =
        localReroute({
          source,
          target,
          sourceEdge: stored.sourceEdge,
          targetEdge: stored.targetEdge,
          cards: input.cards,
          priorRoutes: Object.values(nextById)
            .filter((r) => r.connectionId !== stored.connectionId)
            .map((r) => r.points),
        }) ?? stored.points;
      const baselineLen = polylineManhattan(baseline);
      const tryAdopt = (
        points: Point[],
        sourceEdge: EdgeSide,
        targetEdge: EdgeSide,
      ) => {
        if (
          !withinBridgeRerouteBudget(
            polylineManhattan(points),
            baselineLen,
            BRIDGE_REROUTE_EXTRA_BUDGET,
          )
        ) {
          return false;
        }
        const next = makeStored(conn, source, target, sourceEdge, targetEdge, points);
        if (validateStored(next, input.cards, true).length > 0) return false;
        nextById[stored.connectionId] = next;
        lastValidPoints[stored.connectionId] = clonePoints(next.points);
        delete invalidReasons[stored.connectionId];
        return true;
      };
      const rerouted = pathfindCardToCard({
        source,
        target,
        sourceEdge: stored.sourceEdge,
        targetEdge: stored.targetEdge,
        cards: input.cards,
        priorRoute: stored.points,
        priorRoutes: Object.values(nextById)
          .filter((r) => r.connectionId !== stored.connectionId)
          .map((r) => r.points),
        congestion: congestionFor(connectionId),
      });
      if (rerouted && tryAdopt(rerouted, stored.sourceEdge, stored.targetEdge)) {
        continue;
      }
      const altPair = secondaryEdgePair({
        sourceEdge: stored.sourceEdge,
        targetEdge: stored.targetEdge,
      });
      const alt = pathfindCardToCard({
        source,
        target,
        sourceEdge: altPair.sourceEdge,
        targetEdge: altPair.targetEdge,
        cards: input.cards,
        priorRoute: stored.points,
        priorRoutes: Object.values(nextById)
          .filter((r) => r.connectionId !== stored.connectionId)
          .map((r) => r.points),
        congestion: congestionFor(connectionId),
      });
      if (alt) tryAdopt(alt, altPair.sourceEdge, altPair.targetEdge);
    }
  };
  let unsafe = collectUnsafeJumpers(bridges);
  if (unsafe.jumperIds.size > 0) {
    rerouteJumpers(unsafe.jumperIds);
    workingTopo = workingTopo
      ? topologyWithUpdatedRoutes(workingTopo, nextById, affected, bpMoves)
      : workingTopo;
    bridges = updateBridgesIncrementally({
      previous: input.previous,
      nextById,
      changedIds: affected,
      cards: input.cards,
      topology: workingTopo,
    });
    unsafe = collectUnsafeJumpers(bridges);
    if (unsafe.jumperIds.size > 0) {
      rerouteJumpers(unsafe.jumperIds);
      workingTopo = workingTopo
        ? topologyWithUpdatedRoutes(workingTopo, nextById, affected, bpMoves)
        : workingTopo;
      bridges = updateBridgesIncrementally({
        previous: input.previous,
        nextById,
        changedIds: affected,
        cards: input.cards,
        topology: workingTopo,
      });
      unsafe = collectUnsafeJumpers(bridges);
    }
    for (const connectionId of unsafe.jumperIds) {
      const last = lastValidPoints[connectionId];
      const stored = nextById[connectionId];
      if (last && stored && validateStored({ ...stored, points: last }, input.cards, true).length === 0) {
        nextById[connectionId] = { ...stored, points: clonePoints(last) };
      }
      invalidReasons[connectionId] = [
        ...new Set([
          ...(invalidReasons[connectionId] ?? []),
          ...(unsafe.reasonsByJumper[connectionId] ?? ["unrenderable-bridge"]),
        ]),
      ];
    }
    if (unsafe.jumperIds.size > 0) {
      workingTopo = workingTopo
        ? topologyWithUpdatedRoutes(workingTopo, nextById, affected, bpMoves)
        : workingTopo;
      bridges = updateBridgesIncrementally({
        previous: input.previous,
        nextById,
        changedIds: affected,
        cards: input.cards,
        topology: workingTopo,
      });
    }
  }

  const state: StableRouteState = {
    byId: nextById,
    lastValidPoints,
    invalidReasons,
    bridges,
    qualityTrace,
  };
  return {
    state,
    topology: workingTopo,
  };
}

export function translateStableRouteState(
  state: StableRouteState,
  dx: number,
  dy: number,
  connectionIds: Set<string>,
): StableRouteState {
  if (dx === 0 && dy === 0) return state;
  const shift = (p: Point): Point => ({ x: p.x + dx, y: p.y + dy });
  const byId: Record<string, StoredRouteGeometry> = { ...state.byId };
  const lastValidPoints = { ...state.lastValidPoints };
  for (const id of connectionIds) {
    const route = byId[id];
    if (!route) continue;
    byId[id] = {
      ...route,
      sourcePin: shift(route.sourcePin),
      targetPin: shift(route.targetPin),
      points: route.points.map(shift),
    };
    const last = lastValidPoints[id];
    if (last) lastValidPoints[id] = last.map(shift);
  }
  const bridges = state.bridges.map((br) =>
    connectionIds.has(br.jumperConnectionId) &&
    connectionIds.has(br.underConnectionId)
      ? { ...br, x: br.x + dx, y: br.y + dy }
      : br,
  );
  return { ...state, byId, lastValidPoints, bridges };
}

export function applyIncrementalGroupMove(input: {
  previous: StableRouteState;
  startCards: RelatedDiagramCard[];
  cards: RelatedDiagramCard[];
  connections: RelatedDiagramConnection[];
  topology?: RelatedDiagramRouteTopology;
  dx: number;
  dy: number;
}): { state: StableRouteState; topology?: RelatedDiagramRouteTopology } {
  if (input.dx === 0 && input.dy === 0) {
    return { state: input.previous, topology: input.topology };
  }
  const ids = knowledgeConnectionIds(input.connections, input.startCards);
  let state = translateStableRouteState(input.previous, input.dx, input.dy, ids);
  state = {
    ...state,
    bridges: updateBridgesIncrementally({
      previous: {
        ...input.previous,
        bridges: state.bridges,
      },
      nextById: state.byId,
      changedIds: ids,
      cards: input.cards,
      topology: input.topology,
    }),
  };
  return { state, topology: input.topology };
}

export function previewIncidentFromStable(
  state: StableRouteState,
  cards: RelatedDiagramCard[],
  connections: RelatedDiagramConnection[],
  movingCardId: string,
): RoutedConnection[] {
  const cardById = new Map(cards.map((c) => [c.id, c]));
  const out: RoutedConnection[] = [];
  for (const conn of connections) {
    if (
      conn.sourceCardId !== movingCardId &&
      conn.targetCardId !== movingCardId
    ) {
      continue;
    }
    const stored = state.byId[conn.id];
    const source = cardById.get(conn.sourceCardId);
    const target = cardById.get(conn.targetCardId);
    if (!stored || !source || !target) continue;
    const edges = chooseEdgesWithHysteresis(source, target, {
      sourceEdge: stored.sourceEdge,
      targetEdge: stored.targetEdge,
    });
    const isSource = conn.sourceCardId === movingCardId;
    const pin = isSource
      ? livePin(source, edges.sourceEdge)
      : livePin(target, edges.targetEdge);
    const points = repairRouteEndpoint({
      existingPoints: stored.points,
      movingEnd: isSource ? "source" : "target",
      livePin: pin,
    });
    out.push({
      connectionId: conn.id,
      sourceCardId: source.id,
      targetCardId: target.id,
      sourceEdge: edges.sourceEdge,
      targetEdge: edges.targetEdge,
      points,
    });
  }
  return out;
}

export function membershipSnapshot(topology: RelatedDiagramRouteTopology) {
  return {
    groups: topology.routeGroups.map((g) => ({
      id: g.id,
      sourceCardId: g.sourceCardId,
      trunkId: g.trunkId,
      connectionIds: [...g.connectionIds],
    })),
    trunks: topology.trunks.map((t) => ({
      id: t.id,
      branchPointId: t.branchPointId,
      connectionIds: [...t.connectionIds],
    })),
    branchPoints: topology.branchPoints.map((b) => ({
      id: b.id,
      connectionIds: [...b.connectionIds],
    })),
  };
}
