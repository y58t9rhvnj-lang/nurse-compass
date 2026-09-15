/**
 * Local endpoint / fan-leg repair. Keeps the existing polyline body.
 * Does not replan, normalize, or re-score the whole route.
 */

import type { Point } from "./orthogonalRouting";

const ORTHO_EPS = 0.51;
const DUP_EPS = 0.2;

function samePoint(a: Point, b: Point, eps = DUP_EPS): boolean {
  return Math.abs(a.x - b.x) <= eps && Math.abs(a.y - b.y) <= eps;
}

function isOrthogonalPair(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) <= ORTHO_EPS || Math.abs(a.y - b.y) <= ORTHO_EPS;
}

export function dedupeOrthogonalPoints(points: Point[]): Point[] {
  const out: Point[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (last && samePoint(last, p)) continue;
    out.push({ x: p.x, y: p.y });
  }
  return out;
}

function lastSegmentElbow(prev: Point, prev2: Point | undefined, pin: Point): Point {
  if (prev2 && Math.abs(prev2.y - prev.y) <= ORTHO_EPS) {
    return { x: pin.x, y: prev.y };
  }
  if (prev2 && Math.abs(prev2.x - prev.x) <= ORTHO_EPS) {
    return { x: prev.x, y: pin.y };
  }
  return { x: pin.x, y: prev.y };
}

function firstSegmentElbow(next: Point, next2: Point | undefined, pin: Point): Point {
  if (next2 && Math.abs(next.y - next2.y) <= ORTHO_EPS) {
    return { x: pin.x, y: next.y };
  }
  if (next2 && Math.abs(next.x - next2.x) <= ORTHO_EPS) {
    return { x: next.x, y: pin.y };
  }
  return { x: next.x, y: pin.y };
}

export function repairRouteEndpoint(input: {
  existingPoints: Point[];
  movingEnd: "source" | "target";
  livePin: Point;
}): Point[] {
  const existing = input.existingPoints;
  if (existing.length < 2) {
    return [input.livePin, input.livePin];
  }
  if (input.movingEnd === "target") {
    const body = existing.slice(0, -1).map((p) => ({ x: p.x, y: p.y }));
    const prev = body[body.length - 1]!;
    if (isOrthogonalPair(prev, input.livePin)) {
      return dedupeOrthogonalPoints([...body, input.livePin]);
    }
    const elbow = lastSegmentElbow(prev, body[body.length - 2], input.livePin);
    return dedupeOrthogonalPoints([...body, elbow, input.livePin]);
  }
  const rest = existing.slice(1).map((p) => ({ x: p.x, y: p.y }));
  const next = rest[0]!;
  if (isOrthogonalPair(input.livePin, next)) {
    return dedupeOrthogonalPoints([input.livePin, ...rest]);
  }
  const elbow = firstSegmentElbow(next, rest[1], input.livePin);
  return dedupeOrthogonalPoints([input.livePin, elbow, ...rest]);
}

export function nearestPointIndex(
  points: Point[],
  anchor: Point,
  tol = 12,
): number {
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;
    const d = Math.hypot(p.x - anchor.x, p.y - anchor.y);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return bestD <= tol ? best : -1;
}

export function repairRouteAroundAnchor(input: {
  existingPoints: Point[];
  anchor: Point;
  movingEnd: "source" | "target";
  livePin: Point;
}): Point[] {
  const idx = nearestPointIndex(input.existingPoints, input.anchor, 12);
  if (idx < 0) {
    return repairRouteEndpoint({
      existingPoints: input.existingPoints,
      movingEnd: input.movingEnd,
      livePin: input.livePin,
    });
  }
  if (input.movingEnd === "target") {
    const prefix = input.existingPoints
      .slice(0, idx + 1)
      .map((p) => ({ x: p.x, y: p.y }));
    const tail = repairRouteEndpoint({
      existingPoints: [
        prefix[prefix.length - 1]!,
        input.existingPoints[input.existingPoints.length - 1]!,
      ],
      movingEnd: "target",
      livePin: input.livePin,
    });
    return dedupeOrthogonalPoints([...prefix.slice(0, -1), ...tail]);
  }
  const suffix = input.existingPoints.slice(idx).map((p) => ({ x: p.x, y: p.y }));
  const head = repairRouteEndpoint({
    existingPoints: [input.existingPoints[0]!, suffix[0]!],
    movingEnd: "source",
    livePin: input.livePin,
  });
  return dedupeOrthogonalPoints([...head, ...suffix.slice(1)]);
}
