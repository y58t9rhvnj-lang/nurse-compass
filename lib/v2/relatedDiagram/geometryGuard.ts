/**
 * Final Geometry Guard: endpoint corridors, Legend hard obstacle,
 * self-card penetration, and Independent Crossing feasibility.
 * Leaf module — do not import routeHardening / orthogonalRouting values
 * (those files import this one).
 */

import { A3_HEIGHT_PX, A3_WIDTH_PX } from "./a3Canvas";
import { getA3LegendBounds } from "./a3Legend";

export type GuardPoint = { x: number; y: number };
export type GuardRect = { x: number; y: number; width: number; height: number };
export type GuardEdge = "top" | "right" | "bottom" | "left";
export type GuardObstacle = GuardRect & { id: string };
export type GuardBridge = {
  jumperConnectionId: string;
  underConnectionId: string;
  x: number;
  y: number;
};

export const LEGEND_OBSTACLE_ID = "__legend__";
export const LEGEND_ROUTE_CLEARANCE = 12;
export const A3_ROUTE_MARGIN = 12;
export const A3_BOUNDARY_REASON = "a3-boundary-violation";
export const ENDPOINT_CORRIDOR_WIDTH = 10;
export const MIN_BRIDGE_TO_BRIDGE_DISTANCE = 28;
export const MIN_JUNCTION_BRIDGE_DISTANCE = 24;
export const GUARD_BRIDGE_RADIUS = 10;
export const GUARD_BRIDGE_SAFE_MARGIN = 10;
export const MIN_BEND_BRIDGE_DISTANCE = GUARD_BRIDGE_RADIUS + GUARD_BRIDGE_SAFE_MARGIN;
export const BRIDGE_DIAMETER_PX = GUARD_BRIDGE_RADIUS * 2;
export const GUARD_MIN_ENDPOINT_STUB = 20;
export const GUARD_MIN_ARROW_APPROACH = 24;
export const ARROW_MARKER_VIEWBOX = 10;
export const ARROW_MARKER_REF_X = 10;

const EPS = 0.51;

export type EndpointCorridor = {
  cardId: string;
  pin: GuardPoint;
  edge: GuardEdge;
  length: number;
  width?: number;
};

export function legendObstacle(bounds = getA3LegendBounds()): GuardObstacle {
  return { id: LEGEND_OBSTACLE_ID, ...bounds };
}

export function keepOut(box: GuardRect, clearance: number): GuardRect {
  return {
    x: box.x - clearance,
    y: box.y - clearance,
    width: box.width + clearance * 2,
    height: box.height + clearance * 2,
  };
}

export function expandedLegendRect(bounds = getA3LegendBounds()): GuardRect {
  return keepOut(bounds, LEGEND_ROUTE_CLEARANCE);
}

export function obstacleKeepOut(box: GuardObstacle, clearance: number): GuardRect {
  if (box.id === LEGEND_OBSTACLE_ID) {
    return keepOut(box, Math.max(clearance, LEGEND_ROUTE_CLEARANCE));
  }
  return keepOut(box, clearance);
}

export function inferEdgeFromPin(box: GuardRect, pin: GuardPoint): GuardEdge {
  const dl = Math.abs(pin.x - box.x);
  const dr = Math.abs(pin.x - (box.x + box.width));
  const dt = Math.abs(pin.y - box.y);
  const db = Math.abs(pin.y - (box.y + box.height));
  const best = Math.min(dl, dr, dt, db);
  if (best === dr) return "right";
  if (best === dl) return "left";
  if (best === dt) return "top";
  return "bottom";
}

export function endpointCorridorRect(corridor: EndpointCorridor): GuardRect {
  const width = corridor.width ?? ENDPOINT_CORRIDOR_WIDTH;
  const half = width / 2;
  const { pin, edge, length } = corridor;
  switch (edge) {
    case "right":
      return { x: pin.x, y: pin.y - half, width: length, height: width };
    case "left":
      return { x: pin.x - length, y: pin.y - half, width: length, height: width };
    case "bottom":
      return { x: pin.x - half, y: pin.y, width: width, height: length };
    case "top":
      return { x: pin.x - half, y: pin.y - length, width: width, height: length };
  }
}

export function sourceExitCorridor(
  cardId: string,
  pin: GuardPoint,
  edge: GuardEdge,
): EndpointCorridor {
  return { cardId, pin, edge, length: GUARD_MIN_ENDPOINT_STUB };
}

export function targetEntryCorridor(
  cardId: string,
  pin: GuardPoint,
  edge: GuardEdge,
): EndpointCorridor {
  return { cardId, pin, edge, length: GUARD_MIN_ARROW_APPROACH };
}

export function pointInRect(p: GuardPoint, rect: GuardRect, eps = EPS): boolean {
  return (
    p.x >= rect.x - eps &&
    p.x <= rect.x + rect.width + eps &&
    p.y >= rect.y - eps &&
    p.y <= rect.y + rect.height + eps
  );
}

function axisMatchesEdge(a: GuardPoint, b: GuardPoint, edge: GuardEdge): boolean {
  if (edge === "left" || edge === "right") return Math.abs(a.y - b.y) <= EPS;
  return Math.abs(a.x - b.x) <= EPS;
}

export function clipOrthogonalSegmentToRect(
  a: GuardPoint,
  b: GuardPoint,
  rect: GuardRect,
): [GuardPoint, GuardPoint] | null {
  if (Math.abs(a.y - b.y) <= EPS) {
    const y = (a.y + b.y) / 2;
    if (y < rect.y - EPS || y > rect.y + rect.height + EPS) return null;
    const lo = Math.max(Math.min(a.x, b.x), rect.x);
    const hi = Math.min(Math.max(a.x, b.x), rect.x + rect.width);
    if (hi - lo <= EPS) return null;
    return [
      { x: lo, y },
      { x: hi, y },
    ];
  }
  if (Math.abs(a.x - b.x) <= EPS) {
    const x = (a.x + b.x) / 2;
    if (x < rect.x - EPS || x > rect.x + rect.width + EPS) return null;
    const lo = Math.max(Math.min(a.y, b.y), rect.y);
    const hi = Math.min(Math.max(a.y, b.y), rect.y + rect.height);
    if (hi - lo <= EPS) return null;
    return [
      { x, y: lo },
      { x, y: hi },
    ];
  }
  return [a, b];
}

export function segmentHitsOpenRect(
  a: GuardPoint,
  b: GuardPoint,
  rect: GuardRect,
): boolean {
  const left = rect.x;
  const right = rect.x + rect.width;
  const top = rect.y;
  const bottom = rect.y + rect.height;
  if (Math.abs(a.y - b.y) <= EPS) {
    const y = (a.y + b.y) / 2;
    const lo = Math.min(a.x, b.x);
    const hi = Math.max(a.x, b.x);
    return y > top && y < bottom && hi > left && lo < right;
  }
  if (Math.abs(a.x - b.x) <= EPS) {
    const x = (a.x + b.x) / 2;
    const lo = Math.min(a.y, b.y);
    const hi = Math.max(a.y, b.y);
    return x > left && x < right && hi > top && lo < bottom;
  }
  return true;
}

export function segmentInEndpointCorridor(
  a: GuardPoint,
  b: GuardPoint,
  corridor: EndpointCorridor,
): boolean {
  const rect = endpointCorridorRect(corridor);
  return (
    pointInRect(a, rect) &&
    pointInRect(b, rect) &&
    axisMatchesEdge(a, b, corridor.edge)
  );
}

export function segmentAllowedThroughCorridor(
  a: GuardPoint,
  b: GuardPoint,
  keepOutRect: GuardRect,
  corridor: EndpointCorridor,
): boolean {
  const clipped = clipOrthogonalSegmentToRect(a, b, keepOutRect);
  if (!clipped) return true;
  const rect = endpointCorridorRect(corridor);
  return (
    pointInRect(clipped[0], rect) &&
    pointInRect(clipped[1], rect) &&
    axisMatchesEdge(clipped[0], clipped[1], corridor.edge)
  );
}

export function firstSegmentFacesEdge(
  points: GuardPoint[],
  sourceEdge: GuardEdge,
): boolean {
  if (points.length < 2) return false;
  const a = points[0]!;
  const b = points[1]!;
  switch (sourceEdge) {
    case "right":
      return b.x > a.x + 0.2 && Math.abs(a.y - b.y) <= EPS;
    case "left":
      return b.x < a.x - 0.2 && Math.abs(a.y - b.y) <= EPS;
    case "top":
      return b.y < a.y - 0.2 && Math.abs(a.x - b.x) <= EPS;
    case "bottom":
      return b.y > a.y + 0.2 && Math.abs(a.x - b.x) <= EPS;
  }
}

export function lastSegmentFacesEdge(
  points: GuardPoint[],
  targetEdge: GuardEdge,
): boolean {
  if (points.length < 2) return false;
  const a = points[points.length - 2]!;
  const b = points[points.length - 1]!;
  switch (targetEdge) {
    case "left":
      return a.x < b.x - 0.2 && Math.abs(a.y - b.y) <= EPS;
    case "right":
      return a.x > b.x + 0.2 && Math.abs(a.y - b.y) <= EPS;
    case "top":
      return a.y < b.y - 0.2 && Math.abs(a.x - b.x) <= EPS;
    case "bottom":
      return a.y > b.y + 0.2 && Math.abs(a.x - b.x) <= EPS;
  }
}

export function selfCardPenetrationSegments(
  points: GuardPoint[],
  source: GuardRect,
  target: GuardRect,
  sourceCorridor: EndpointCorridor,
  targetCorridor: EndpointCorridor,
): { a: GuardPoint; b: GuardPoint }[] {
  const hits: { a: GuardPoint; b: GuardPoint }[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    if (
      segmentHitsOpenRect(a, b, source) &&
      !segmentAllowedThroughCorridor(a, b, source, sourceCorridor)
    ) {
      hits.push({ a, b });
    }
    if (
      segmentHitsOpenRect(a, b, target) &&
      !segmentAllowedThroughCorridor(a, b, target, targetCorridor)
    ) {
      hits.push({ a, b });
    }
  }
  return hits;
}

export function legendIntersectionSegments(
  points: GuardPoint[],
  bounds = getA3LegendBounds(),
): { a: GuardPoint; b: GuardPoint }[] {
  const expanded = expandedLegendRect(bounds);
  const hits: { a: GuardPoint; b: GuardPoint }[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    if (segmentHitsOpenRect(a, b, expanded)) hits.push({ a, b });
  }
  return hits;
}

export function polylineHitsExpandedLegend(
  points: GuardPoint[],
  bounds = getA3LegendBounds(),
): boolean {
  return legendIntersectionSegments(points, bounds).length > 0;
}

export function corridorForBox(
  boxId: string,
  corridors?: EndpointCorridor[],
): EndpointCorridor | undefined {
  return corridors?.find((c) => c.cardId === boxId);
}

export function segmentHitsSolidObstacle(
  a: GuardPoint,
  b: GuardPoint,
  box: GuardObstacle,
  clearance: number,
  corridor?: EndpointCorridor,
): boolean {
  const next = obstacleKeepOut(box, clearance);
  if (!segmentHitsOpenRect(a, b, next)) return false;
  if (corridor && segmentAllowedThroughCorridor(a, b, next, corridor)) return false;
  return true;
}

export function requiredBridgeSpan(count: number): number {
  if (count <= 0) return 0;
  return (
    2 * GUARD_BRIDGE_SAFE_MARGIN +
    count * BRIDGE_DIAMETER_PX +
    Math.max(0, count - 1) * MIN_BRIDGE_TO_BRIDGE_DISTANCE
  );
}

function orthoLen(a: GuardPoint, b: GuardPoint): number {
  return Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
}

function findSegmentContaining(
  points: GuardPoint[],
  p: GuardPoint,
): { a: GuardPoint; b: GuardPoint; index: number } | null {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    if (Math.abs(a.y - b.y) <= EPS) {
      const lo = Math.min(a.x, b.x);
      const hi = Math.max(a.x, b.x);
      if (
        Math.abs(p.y - (a.y + b.y) / 2) <= 1.2 &&
        p.x > lo + 0.35 &&
        p.x < hi - 0.35
      ) {
        return { a, b, index: i - 1 };
      }
    } else if (Math.abs(a.x - b.x) <= EPS) {
      const lo = Math.min(a.y, b.y);
      const hi = Math.max(a.y, b.y);
      if (
        Math.abs(p.x - (a.x + b.x) / 2) <= 1.2 &&
        p.y > lo + 0.35 &&
        p.y < hi - 0.35
      ) {
        return { a, b, index: i - 1 };
      }
    }
  }
  return null;
}

function hopFitsOnSegment(
  a: GuardPoint,
  b: GuardPoint,
  point: GuardPoint,
): boolean {
  const len = orthoLen(a, b);
  const minLen = 2 * GUARD_BRIDGE_RADIUS + 2 * GUARD_BRIDGE_SAFE_MARGIN;
  if (len <= minLen) return false;
  const along =
    Math.abs(a.y - b.y) <= EPS ? Math.abs(point.x - a.x) : Math.abs(point.y - a.y);
  const need = GUARD_BRIDGE_RADIUS + GUARD_BRIDGE_SAFE_MARGIN;
  return along >= need && len - along >= need;
}

export function evaluateBridgeFeasibility(input: {
  bridge: GuardBridge;
  jumperPoints: GuardPoint[];
  siblingBridges: GuardBridge[];
  junctions: GuardPoint[];
}): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const point = { x: input.bridge.x, y: input.bridge.y };
  const seg = findSegmentContaining(input.jumperPoints, point);
  if (!seg) {
    reasons.push("bridge-off-segment");
    return { ok: false, reasons };
  }
  if (!hopFitsOnSegment(seg.a, seg.b, point)) {
    reasons.push("unrenderable-bridge");
  }
  const onSame = input.siblingBridges.filter((br) => {
    if (br.x === input.bridge.x && br.y === input.bridge.y) return false;
    const other = findSegmentContaining(input.jumperPoints, { x: br.x, y: br.y });
    return other != null && other.index === seg.index;
  });
  if (orthoLen(seg.a, seg.b) + 0.2 < requiredBridgeSpan(onSame.length + 1)) {
    reasons.push("bridge-density");
  }
  for (const other of onSame) {
    if (Math.hypot(other.x - point.x, other.y - point.y) < MIN_BRIDGE_TO_BRIDGE_DISTANCE) {
      reasons.push("bridge-cluster");
      break;
    }
  }
  for (const j of input.junctions) {
    if (Math.hypot(j.x - point.x, j.y - point.y) < MIN_JUNCTION_BRIDGE_DISTANCE) {
      reasons.push("bridge-junction");
      break;
    }
  }
  if (
    orthoLen(point, seg.a) < MIN_BEND_BRIDGE_DISTANCE ||
    orthoLen(point, seg.b) < MIN_BEND_BRIDGE_DISTANCE
  ) {
    reasons.push("bridge-bend");
  }
  if (bridgeArcLeavesA3(point.x, point.y)) {
    reasons.push(A3_BOUNDARY_REASON);
  }
  return { ok: reasons.length === 0, reasons };
}

export function collectUnsafeBridgeJumperIds(input: {
  bridges: GuardBridge[];
  routes: Record<string, { points: GuardPoint[] }>;
  junctions: GuardPoint[];
  changedIds: Set<string>;
}): { jumperIds: Set<string>; reasonsByJumper: Record<string, string[]> } {
  const jumperIds = new Set<string>();
  const reasonsByJumper: Record<string, string[]> = {};
  for (const bridge of input.bridges) {
    if (
      !input.changedIds.has(bridge.jumperConnectionId) &&
      !input.changedIds.has(bridge.underConnectionId)
    ) {
      continue;
    }
    const jumper = input.routes[bridge.jumperConnectionId];
    if (!jumper) continue;
    const report = evaluateBridgeFeasibility({
      bridge,
      jumperPoints: jumper.points,
      siblingBridges: input.bridges.filter(
        (br) => br.jumperConnectionId === bridge.jumperConnectionId,
      ),
      junctions: input.junctions,
    });
    if (!report.ok) {
      jumperIds.add(bridge.jumperConnectionId);
      reasonsByJumper[bridge.jumperConnectionId] = [
        ...(reasonsByJumper[bridge.jumperConnectionId] ?? []),
        ...report.reasons,
      ];
    }
  }
  return { jumperIds, reasonsByJumper };
}

export function estimatedArrowMarkerTip(
  pathEnd: GuardPoint,
  prev: GuardPoint,
  refX = ARROW_MARKER_REF_X,
  viewBox = ARROW_MARKER_VIEWBOX,
): GuardPoint {
  if (refX === viewBox) return { x: pathEnd.x, y: pathEnd.y };
  const len = Math.hypot(pathEnd.x - prev.x, pathEnd.y - prev.y);
  if (len <= EPS) return { x: pathEnd.x, y: pathEnd.y };
  const along = viewBox - refX;
  const ux = (pathEnd.x - prev.x) / len;
  const uy = (pathEnd.y - prev.y) / len;
  return { x: pathEnd.x + ux * along, y: pathEnd.y + uy * along };
}

export function clampRoutePointToA3(
  p: GuardPoint,
  margin = A3_ROUTE_MARGIN,
  width = A3_WIDTH_PX,
  height = A3_HEIGHT_PX,
): GuardPoint {
  return {
    x: Math.min(width - margin, Math.max(margin, p.x)),
    y: Math.min(height - margin, Math.max(margin, p.y)),
  };
}

export function pointInA3Hard(
  p: GuardPoint,
  width = A3_WIDTH_PX,
  height = A3_HEIGHT_PX,
  eps = EPS,
): boolean {
  return p.x >= -eps && p.y >= -eps && p.x <= width + eps && p.y <= height + eps;
}

export function pointInA3RouteInner(
  p: GuardPoint,
  width = A3_WIDTH_PX,
  height = A3_HEIGHT_PX,
  margin = A3_ROUTE_MARGIN,
  eps = EPS,
): boolean {
  return (
    p.x >= margin - eps &&
    p.y >= margin - eps &&
    p.x <= width - margin + eps &&
    p.y <= height - margin + eps
  );
}

export function bridgeArcLeavesA3(
  x: number,
  y: number,
  radius = GUARD_BRIDGE_RADIUS,
  width = A3_WIDTH_PX,
  height = A3_HEIGHT_PX,
): boolean {
  return (
    x - radius < -EPS ||
    y - radius < -EPS ||
    x + radius > width + EPS ||
    y + radius > height + EPS
  );
}

export function markerLeavesA3(
  tip: GuardPoint,
  width = A3_WIDTH_PX,
  height = A3_HEIGHT_PX,
): boolean {
  return !pointInA3Hard(tip, width, height);
}

function segmentLeavesA3Hard(
  a: GuardPoint,
  b: GuardPoint,
  width = A3_WIDTH_PX,
  height = A3_HEIGHT_PX,
): boolean {
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);
  return minX < -EPS || minY < -EPS || maxX > width + EPS || maxY > height + EPS;
}

/**
 * Hard A3 containment plus inner routing margin for body vertices.
 * First / last points (live pins) may sit on a card edge closer than the margin.
 */
export function a3BoundaryViolationReasons(
  points: GuardPoint[],
  options?: { width?: number; height?: number; margin?: number },
): string[] {
  const width = options?.width ?? A3_WIDTH_PX;
  const height = options?.height ?? A3_HEIGHT_PX;
  const margin = options?.margin ?? A3_ROUTE_MARGIN;
  if (points.length === 0) return [];
  for (const p of points) {
    if (!pointInA3Hard(p, width, height)) return [A3_BOUNDARY_REASON];
  }
  for (let i = 1; i < points.length; i++) {
    if (segmentLeavesA3Hard(points[i - 1]!, points[i]!, width, height)) {
      return [A3_BOUNDARY_REASON];
    }
  }
  for (let i = 1; i < points.length - 1; i++) {
    if (!pointInA3RouteInner(points[i]!, width, height, margin)) {
      return [A3_BOUNDARY_REASON];
    }
  }
  return [];
}

export function pinsExact(
  points: GuardPoint[],
  sourcePin: GuardPoint,
  targetPin: GuardPoint,
  eps = 0.2,
): boolean {
  const first = points[0];
  const last = points[points.length - 1];
  return (
    !!first &&
    !!last &&
    Math.abs(first.x - sourcePin.x) <= eps &&
    Math.abs(first.y - sourcePin.y) <= eps &&
    Math.abs(last.x - targetPin.x) <= eps &&
    Math.abs(last.y - targetPin.y) <= eps
  );
}
