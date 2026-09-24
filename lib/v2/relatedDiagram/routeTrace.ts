/**
 * Route Trace V1 — partial orthogonal replacement of a 1:1 route.
 * Does not replan the scene. Does not keep freehand strokes.
 */

import {
  canEditConnectionRoute,
  simplifyManualRoute,
  segmentOrientation,
} from "./manualRouteEdit";
import type { Point } from "./orthogonalRouting";
import type { RelatedDiagramRouteTopology } from "./routeTopology";

export const TRACE_ANCHOR_SNAP_RADIUS_PX = 48;
export const TRACE_SAMPLE_MIN_DIST_PX = 12;
export const TRACE_MIN_RUN_PX = 24;
export const TRACE_REPLACEMENT_POINT_CAP = 8;
export const TRACE_DIRECTION_HYSTERESIS_PX = 10;
export const TRACE_VERTEX_EPS = 0.75;

export type RouteProjection = {
  segmentIndex: number;
  t: number;
  along: number;
  point: Point;
  distToRoute: number;
};

export type PartialRouteTraceResult = {
  ok: boolean;
  reason?: string;
  points: Point[];
  startAnchor: Point;
  endAnchor: Point;
  replacementPointCount: number;
  reversed: boolean;
  plannerCalls: 0;
};

function clonePoints(points: Point[]): Point[] {
  return points.map((point) => ({ x: point.x, y: point.y }));
}

function samePoint(a: Point, b: Point, eps = TRACE_VERTEX_EPS): boolean {
  return Math.abs(a.x - b.x) <= eps && Math.abs(a.y - b.y) <= eps;
}

function hypotPoint(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length === 0) return 0;
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

export function canTraceConnectionRoute(
  topology: RelatedDiagramRouteTopology | undefined,
  connection: { id: string; origin: string },
): boolean {
  return canEditConnectionRoute(topology, connection);
}

export function sampleTracePoints(
  raw: Point[],
  minDist = TRACE_SAMPLE_MIN_DIST_PX,
): Point[] {
  if (raw.length === 0) return [];
  const out: Point[] = [{ ...raw[0]! }];
  for (let i = 1; i < raw.length; i += 1) {
    const point = raw[i]!;
    if (hypotPoint(out[out.length - 1]!, point) < minDist) continue;
    out.push({ ...point });
  }
  const last = raw[raw.length - 1]!;
  if (!samePoint(out[out.length - 1]!, last)) out.push({ ...last });
  return out;
}

export function projectPointToRoute(
  points: Point[],
  query: Point,
): RouteProjection | null {
  if (points.length < 2) return null;
  let best: RouteProjection | null = null;
  let walked = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const len = Math.sqrt(len2);
    let t = 0;
    if (len2 > 1e-6) {
      t = ((query.x - a.x) * dx + (query.y - a.y) * dy) / len2;
      t = Math.max(0, Math.min(1, t));
    }
    const point = { x: a.x + dx * t, y: a.y + dy * t };
    const distToRoute = hypotPoint(query, point);
    const along = walked + t * len;
    if (
      !best ||
      distToRoute < best.distToRoute - 0.01 ||
      (Math.abs(distToRoute - best.distToRoute) <= 0.01 && along < best.along)
    ) {
      best = { segmentIndex: i, t, along, point, distToRoute };
    }
    walked += len;
  }
  return best;
}

export function decideTraceAnchors(
  existing: Point[],
  rawTrace: Point[],
): {
  start: RouteProjection;
  end: RouteProjection;
  reversed: boolean;
} | null {
  const sampled = sampleTracePoints(rawTrace);
  if (sampled.length < 2 || existing.length < 2) return null;
  const first = projectPointToRoute(existing, sampled[0]!);
  const last = projectPointToRoute(existing, sampled[sampled.length - 1]!);
  if (!first || !last) return null;
  if (last.along + TRACE_VERTEX_EPS < first.along) {
    return { start: last, end: first, reversed: true };
  }
  return { start: first, end: last, reversed: false };
}

function connectOrthogonal(from: Point, to: Point): Point[] {
  if (samePoint(from, to)) return [{ ...from }];
  const kind = segmentOrientation(from, to);
  if (kind === "horizontal" || kind === "vertical" || kind === "zero") {
    return [{ ...from }, { ...to }];
  }
  return [{ ...from }, { x: to.x, y: from.y }, { ...to }];
}

export function orthogonalizeReplacement(
  rawTrace: Point[],
  start: Point,
  end: Point,
): Point[] {
  const sampled = sampleTracePoints(rawTrace);
  if (sampled.length < 2) {
    return simplifyManualRoute(connectOrthogonal(start, end));
  }
  const xs = sampled.map((point) => point.x);
  const ys = sampled.map((point) => point.y);
  const chordDx = Math.abs(end.x - start.x);
  const chordDy = Math.abs(end.y - start.y);
  const chordHorizontal = chordDx + TRACE_DIRECTION_HYSTERESIS_PX >= chordDy;
  if (chordHorizontal) {
    const midY = median(ys);
    if (
      Math.abs(midY - start.y) < TRACE_MIN_RUN_PX &&
      Math.abs(midY - end.y) < TRACE_MIN_RUN_PX
    ) {
      return simplifyManualRoute(connectOrthogonal(start, end));
    }
    return simplifyManualRoute([
      start,
      { x: start.x, y: midY },
      { x: end.x, y: midY },
      end,
    ]).slice(0, TRACE_REPLACEMENT_POINT_CAP);
  }
  const midX = median(xs);
  if (
    Math.abs(midX - start.x) < TRACE_MIN_RUN_PX &&
    Math.abs(midX - end.x) < TRACE_MIN_RUN_PX
  ) {
    return simplifyManualRoute(connectOrthogonal(start, end));
  }
  return simplifyManualRoute([
    start,
    { x: midX, y: start.y },
    { x: midX, y: end.y },
    end,
  ]).slice(0, TRACE_REPLACEMENT_POINT_CAP);
}

function splitPrefix(existing: Point[], proj: RouteProjection): Point[] {
  const head = existing.slice(0, proj.segmentIndex + 1).map((point) => ({
    ...point,
  }));
  if (proj.t <= 0.02) return head;
  if (samePoint(head[head.length - 1]!, proj.point)) return head;
  return [...head, { ...proj.point }];
}

function splitSuffix(existing: Point[], proj: RouteProjection): Point[] {
  const tail = existing.slice(proj.segmentIndex + 1).map((point) => ({
    ...point,
  }));
  if (proj.t >= 0.98) return tail;
  if (tail[0] && samePoint(tail[0], proj.point)) return tail;
  return [{ ...proj.point }, ...tail];
}

export function applyPartialRouteTrace(input: {
  existing: Point[];
  rawTrace: Point[];
}): PartialRouteTraceResult {
  const existing = clonePoints(input.existing);
  const empty = {
    ok: false,
    points: existing,
    startAnchor: existing[0] ?? { x: 0, y: 0 },
    endAnchor: existing[existing.length - 1] ?? { x: 0, y: 0 },
    replacementPointCount: 0,
    reversed: false,
    plannerCalls: 0 as const,
  };
  const anchors = decideTraceAnchors(existing, input.rawTrace);
  if (!anchors) {
    return { ...empty, reason: "no-anchor" };
  }
  const far = TRACE_ANCHOR_SNAP_RADIUS_PX * 3;
  if (anchors.start.distToRoute > far && anchors.end.distToRoute > far) {
    return { ...empty, reason: "snap-miss" };
  }
  const startAnchor = { ...anchors.start.point };
  const endAnchor = { ...anchors.end.point };
  const prefix = splitPrefix(existing, anchors.start);
  const suffix = splitSuffix(existing, anchors.end);
  const replacement = orthogonalizeReplacement(
    input.rawTrace,
    startAnchor,
    endAnchor,
  );
  const mid = replacement.slice(1, -1);
  const composed = simplifyManualRoute([
    ...prefix,
    ...mid,
    ...suffix,
  ]);
  const source = existing[0]!;
  const target = existing[existing.length - 1]!;
  if (composed.length >= 2) {
    composed[0] = { ...source };
    composed[composed.length - 1] = { ...target };
  }
  return {
    ok: composed.length >= 2,
    points: composed,
    startAnchor,
    endAnchor,
    replacementPointCount: Math.max(0, replacement.length),
    reversed: anchors.reversed,
    plannerCalls: 0,
  };
}

export function routeIsOrthogonalPolyline(points: Point[]): boolean {
  if (points.length < 2) return false;
  for (let i = 0; i < points.length - 1; i += 1) {
    if (segmentOrientation(points[i]!, points[i + 1]!) === "diagonal") {
      return false;
    }
  }
  return true;
}
