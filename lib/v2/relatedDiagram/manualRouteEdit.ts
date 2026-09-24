/**
 * Manual Route Editing V2 — orthogonal segment operation.
 * Authored record = topology.routes ExplicitConnectionRoute.
 * Geometry operations never emit a diagonal segment.
 */

import { CONNECTION_HIT_RADIUS_PX } from "./cardConnectionManage";
import { countPolylineCardHits } from "./diagramLayoutL2";
import {
  cloneStableRouteState,
  seedStableRouteState,
  stableRoutesList,
  type StableRouteState,
  type StoredRouteGeometry,
} from "./incrementalRoutes";
import {
  classifyRouteInteractions,
  type Point,
} from "./orthogonalRouting";
import { repairRouteEndpoint } from "./repairRouteEndpoint";
import {
  emptyRouteTopology,
  hasExplicitConnectionRoute,
  isJunctionOwnedConnection,
  isStudentManualRoute,
  type ExplicitConnectionRoute,
  type RelatedDiagramRouteTopology,
} from "./routeTopology";
import type {
  RelatedDiagramCard,
  RelatedDiagramConnection,
} from "./types";

export const MANUAL_ORTHO_EPS = 0.51;
export const MANUAL_COLLINEAR_EPS = 0.75;
export const MIN_LEG_PX = 24;
export const MIN_DRAGGED_PX = 48;
export const ENDPOINT_EXCLUSION_PX = 24;

export type SegmentOrientation = "horizontal" | "vertical" | "zero" | "diagonal";

export type EditableSegment = {
  index: number;
  orientation: "horizontal" | "vertical";
  a: Point;
  b: Point;
};

export function isManualConnection(
  topology: RelatedDiagramRouteTopology | undefined,
  connection: { id: string; origin: string },
): boolean {
  return isStudentManualRoute(topology, connection);
}

export function canEditConnectionRoute(
  topology: RelatedDiagramRouteTopology | undefined,
  connection: { id: string; origin: string },
): boolean {
  if (isJunctionOwnedConnection(topology, connection.id)) return false;
  return connection.origin === "student_diagram";
}

export function segmentOrientation(a: Point, b: Point): SegmentOrientation {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  if (dx <= MANUAL_ORTHO_EPS && dy <= MANUAL_ORTHO_EPS) return "zero";
  if (dy <= MANUAL_ORTHO_EPS) return "horizontal";
  if (dx <= MANUAL_ORTHO_EPS) return "vertical";
  return "diagonal";
}

export function isParallelMoveSegmentIndex(
  points: Point[],
  index: number,
): boolean {
  return points.length >= 4 && index > 0 && index < points.length - 2;
}

/** Student V1: complete middle H/V segments only. First / last / 2-point excluded. */
export function listEditableSegments(points: Point[]): EditableSegment[] {
  const out: EditableSegment[] = [];
  if (points.length < 4) return out;
  for (let i = 1; i < points.length - 2; i += 1) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const orientation = segmentOrientation(a, b);
    if (orientation !== "horizontal" && orientation !== "vertical") continue;
    out.push({ index: i, orientation, a: { ...a }, b: { ...b } });
  }
  return out;
}

function pointToSegmentDistance(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 <= 1e-6) return Math.hypot(point.x - a.x, point.y - a.y);
  let t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

export function pickEditableSegment(
  points: Point[],
  point: Point,
  radius = CONNECTION_HIT_RADIUS_PX,
): EditableSegment | null {
  let best: { segment: EditableSegment; distance: number } | null = null;
  for (const segment of listEditableSegments(points)) {
    const distance = pointToSegmentDistance(point, segment.a, segment.b);
    if (distance > radius) continue;
    if (
      !best ||
      distance < best.distance ||
      (distance === best.distance && segment.index < best.segment.index)
    ) {
      best = { segment, distance };
    }
  }
  return best?.segment ?? null;
}

function clonePoints(points: Point[]): Point[] {
  return points.map((point) => ({ x: point.x, y: point.y }));
}

function snap(value: number): number {
  return Math.round(value);
}

function sameAxisValue(a: number, b: number): boolean {
  return Math.abs(a - b) <= MANUAL_ORTHO_EPS;
}

function isOrthogonalPolyline(points: Point[]): boolean {
  if (points.length < 2) return false;
  for (let i = 0; i < points.length - 1; i += 1) {
    if (segmentOrientation(points[i]!, points[i + 1]!) === "diagonal") return false;
  }
  return true;
}

/** Duplicate / zero-length / true H-H or V-V merge only. Does not repair diagonals. */
export function canonicalizeManualRoute(points: Point[]): Point[] {
  const raw: Point[] = [];
  for (const point of points) {
    const cur = { x: snap(point.x), y: snap(point.y) };
    const prev = raw[raw.length - 1];
    if (prev && prev.x === cur.x && prev.y === cur.y) continue;
    raw.push(cur);
  }
  if (raw.length < 2) return raw;
  const out: Point[] = [raw[0]!];
  for (let i = 1; i < raw.length - 1; i += 1) {
    const prev = out[out.length - 1]!;
    const cur = raw[i]!;
    const next = raw[i + 1]!;
    const back = segmentOrientation(prev, cur);
    const forth = segmentOrientation(cur, next);
    if (back === "diagonal" || forth === "diagonal") {
      out.push(cur);
      continue;
    }
    if (back === "zero" || forth === "zero") continue;
    if (back === "horizontal" && forth === "horizontal") continue;
    if (back === "vertical" && forth === "vertical") continue;
    out.push(cur);
  }
  out.push(raw[raw.length - 1]!);
  return out.filter((point, index, list) => {
    const prev = list[index - 1];
    if (!prev) return true;
    return prev.x !== point.x || prev.y !== point.y;
  });
}

export function simplifyManualRoute(points: Point[]): Point[] {
  return canonicalizeManualRoute(points);
}

function interiorCoord(a: number, b: number, grab: number): number | null {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  if (hi - lo < 2) return null;
  const clamped = Math.max(lo + 1, Math.min(hi - 1, snap(grab)));
  if (clamped === a || clamped === b) return null;
  return clamped;
}

function adoptOrReject(original: Point[], candidate: Point[]): Point[] {
  const next = canonicalizeManualRoute(candidate);
  if (next.length < 2) return original;
  if (!isOrthogonalPolyline(next)) return original;
  const first = original[0]!;
  const last = original[original.length - 1]!;
  const nextFirst = next[0]!;
  const nextLast = next[next.length - 1]!;
  if (
    !sameAxisValue(first.x, nextFirst.x) ||
    !sameAxisValue(first.y, nextFirst.y) ||
    !sameAxisValue(last.x, nextLast.x) ||
    !sameAxisValue(last.y, nextLast.y)
  ) {
    return original;
  }
  return next;
}

function resolveSegmentIndex(
  points: Point[],
  requested: number,
  grab: Point,
): number | null {
  if (isParallelMoveSegmentIndex(points, requested)) {
    const orientation = segmentOrientation(points[requested]!, points[requested + 1]!);
    if (orientation === "horizontal" || orientation === "vertical") {
      return requested;
    }
  }
  return pickEditableSegment(points, grab)?.index ?? null;
}

function hasZeroSegment(points: Point[]): boolean {
  for (let i = 0; i < points.length - 1; i += 1) {
    if (segmentOrientation(points[i]!, points[i + 1]!) === "zero") return true;
  }
  return false;
}

function adoptParallelMove(original: Point[], candidate: Point[]): Point[] {
  if (candidate.length !== original.length) return original;
  if (hasZeroSegment(candidate)) return original;
  if (!isOrthogonalPolyline(candidate)) return original;
  const first = original[0]!;
  const last = original[original.length - 1]!;
  const nextFirst = candidate[0]!;
  const nextLast = candidate[candidate.length - 1]!;
  if (
    !sameAxisValue(first.x, nextFirst.x) ||
    !sameAxisValue(first.y, nextFirst.y) ||
    !sameAxisValue(last.x, nextLast.x) ||
    !sameAxisValue(last.y, nextLast.y)
  ) {
    return original;
  }
  return candidate;
}

export function dragOrthogonalSegment(input: {
  points: Point[];
  segmentIndex: number;
  deltaX: number;
  deltaY: number;
  grab?: Point;
}): Point[] {
  const original = clonePoints(input.points);
  if (!isParallelMoveSegmentIndex(original, input.segmentIndex) && original.length < 4) {
    return original;
  }
  const fallbackGrab = (() => {
    const a = original[input.segmentIndex];
    const b = original[input.segmentIndex + 1];
    if (a && b) return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    return { x: original[0]!.x, y: original[0]!.y };
  })();
  const grab = input.grab ?? fallbackGrab;
  const index = resolveSegmentIndex(original, input.segmentIndex, grab);
  if (index == null || !isParallelMoveSegmentIndex(original, index)) return original;
  const start = original[index]!;
  const end = original[index + 1]!;
  const orientation = segmentOrientation(start, end);
  if (orientation !== "horizontal" && orientation !== "vertical") return original;
  const moved = clonePoints(original);
  if (orientation === "horizontal") {
    const nextY = snap(start.y + input.deltaY);
    if (nextY === start.y) return original;
    moved[index] = { x: start.x, y: nextY };
    moved[index + 1] = { x: end.x, y: nextY };
    return adoptParallelMove(original, moved);
  }
  const nextX = snap(start.x + input.deltaX);
  if (nextX === start.x) return original;
  moved[index] = { x: nextX, y: start.y };
  moved[index + 1] = { x: nextX, y: end.y };
  return adoptParallelMove(original, moved);
}

export function upsertManualRoute(
  topology: RelatedDiagramRouteTopology | undefined,
  route: ExplicitConnectionRoute,
): RelatedDiagramRouteTopology {
  const base = topology ?? emptyRouteTopology();
  const next: ExplicitConnectionRoute = {
    connectionId: route.connectionId,
    sourceEdge: route.sourceEdge,
    targetEdge: route.targetEdge,
    points: clonePoints(route.points),
  };
  const routes = [
    ...base.routes.filter((row) => row.connectionId !== route.connectionId),
    next,
  ].sort((a, b) => (a.connectionId < b.connectionId ? -1 : 1));
  return { ...base, routes };
}

export function removeManualRoute(
  topology: RelatedDiagramRouteTopology | undefined,
  connectionId: string,
): RelatedDiagramRouteTopology | undefined {
  if (!topology) return undefined;
  const routes = topology.routes.filter((row) => row.connectionId !== connectionId);
  if (routes.length === topology.routes.length) return topology;
  return { ...topology, routes };
}

function storedWithPoints(
  previous: StoredRouteGeometry,
  points: Point[],
): StoredRouteGeometry {
  const next = canonicalizeManualRoute(points);
  const use = next.length >= 2 ? next : previous.points;
  return {
    ...previous,
    sourceEdge: previous.sourceEdge,
    targetEdge: previous.targetEdge,
    points: use,
    sourcePin: { ...use[0]! },
    targetPin: { ...use[use.length - 1]! },
  };
}

export function applyManualPointsToRouteState(
  routeState: StableRouteState,
  connectionId: string,
  points: Point[],
): StableRouteState {
  const previous = routeState.byId[connectionId];
  if (!previous) return routeState;
  const next = cloneStableRouteState(routeState);
  next.byId[connectionId] = storedWithPoints(previous, points);
  next.lastValidPoints[connectionId] = clonePoints(next.byId[connectionId]!.points);
  return next;
}

export function refreshStableRouteBridges(input: {
  routeState: StableRouteState;
  topology?: RelatedDiagramRouteTopology;
  cards?: RelatedDiagramCard[];
}): StableRouteState {
  const classified = classifyRouteInteractions(
    stableRoutesList(input.routeState),
    input.cards ?? [],
    input.topology,
  );
  return {
    ...input.routeState,
    bridges: classified.bridges.map((bridge) => ({ ...bridge })),
  };
}

export function commitManualRouteEdit(input: {
  connection: RelatedDiagramConnection;
  routeState: StableRouteState;
  topology?: RelatedDiagramRouteTopology;
  points: Point[];
  cards?: RelatedDiagramCard[];
}): { routeState: StableRouteState; topology: RelatedDiagramRouteTopology } {
  const previous = input.routeState.byId[input.connection.id];
  const nextPoints = applyManualPointsToRouteState(
    input.routeState,
    input.connection.id,
    input.points,
  );
  const stored = nextPoints.byId[input.connection.id] ?? previous;
  const topology = upsertManualRoute(input.topology, {
    connectionId: input.connection.id,
    sourceEdge: stored?.sourceEdge ?? "right",
    targetEdge: stored?.targetEdge ?? "left",
    points: stored?.points ?? input.points,
  });
  return {
    routeState: refreshStableRouteBridges({
      routeState: nextPoints,
      topology,
      cards: input.cards,
    }),
    topology,
  };
}

export function repairManualRouteEndpoints(input: {
  points: Point[];
  sourcePin: Point;
  targetPin: Point;
}): Point[] {
  const afterSource = repairRouteEndpoint({
    existingPoints: input.points,
    movingEnd: "source",
    livePin: input.sourcePin,
  });
  return repairRouteEndpoint({
    existingPoints: afterSource,
    movingEnd: "target",
    livePin: input.targetPin,
  });
}

export function planAutoRouteForConnection(input: {
  cards: RelatedDiagramCard[];
  connection: RelatedDiagramConnection;
}): StoredRouteGeometry | undefined {
  const planned = seedStableRouteState(input.cards, [input.connection]);
  return planned.byId[input.connection.id];
}

export function resetManualRouteToAuto(input: {
  cards: RelatedDiagramCard[];
  connections: RelatedDiagramConnection[];
  connection: RelatedDiagramConnection;
  routeState: StableRouteState;
  topology?: RelatedDiagramRouteTopology;
}): { routeState: StableRouteState; topology?: RelatedDiagramRouteTopology } {
  const topology = removeManualRoute(input.topology, input.connection.id);
  const planned = planAutoRouteForConnection({
    cards: input.cards,
    connection: input.connection,
  });
  const routeState = cloneStableRouteState(input.routeState);
  if (planned) {
    routeState.byId[input.connection.id] = {
      ...planned,
      points: clonePoints(planned.points),
      sourcePin: { ...planned.sourcePin },
      targetPin: { ...planned.targetPin },
    };
    routeState.lastValidPoints[input.connection.id] = clonePoints(planned.points);
  }
  return { routeState, topology };
}

export function connectionSemanticsEqual(
  a: RelatedDiagramConnection,
  b: RelatedDiagramConnection,
): boolean {
  return (
    a.id === b.id &&
    a.sourceCardId === b.sourceCardId &&
    a.targetCardId === b.targetCardId &&
    a.relationType === b.relationType &&
    a.origin === b.origin
  );
}

export function manualRouteHasCardThrough(input: {
  cards: RelatedDiagramCard[];
  connection: RelatedDiagramConnection;
  points: Point[];
}): boolean {
  return (
    countPolylineCardHits(
      input.points,
      input.cards.map((card) => ({ id: card.id, ...card.layout })),
      new Set([input.connection.sourceCardId, input.connection.targetCardId]),
    ) > 0
  );
}

export function authoredRouteRecord(
  topology: RelatedDiagramRouteTopology | undefined,
  connectionId: string,
): ExplicitConnectionRoute | undefined {
  return topology?.routes.find((row) => row.connectionId === connectionId);
}

export {
  hasExplicitConnectionRoute,
  isJunctionOwnedConnection,
  isStudentManualRoute,
};

export function routeIsOrthogonal(points: Point[]): boolean {
  return isOrthogonalPolyline(points);
}
