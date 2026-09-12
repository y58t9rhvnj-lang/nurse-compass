/**
 * Pure orthogonal (Manhattan) connection routing + crossing bridges.
 * Recomputes from cards/layout + connections — not fixture-hardcoded.
 * Does not move cards (not auto-layout).
 */

import type {
  RelatedDiagramCard,
  RelatedDiagramConnection,
} from "./types";
import {
  hitOnExplicitJunction,
  junctionsFromTopology,
  type RelatedDiagramRouteTopology,
} from "./routeTopology";

export type EdgeSide = "top" | "right" | "bottom" | "left";
export type Point = { x: number; y: number };
export type Axis = "h" | "v";

export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CrossingBridge = {
  jumperConnectionId: string;
  underConnectionId: string;
  x: number;
  y: number;
  jumperAxis: Axis;
};

export type RoutedConnection = {
  connectionId: string;
  sourceCardId: string;
  targetCardId: string;
  sourceEdge: EdgeSide;
  targetEdge: EdgeSide;
  points: Point[];
};

/** Visual/routing metadata only. Not a semantic relation type. */
export type RouteJunctionKind = "sharedTrunk" | "branchPoint" | "junctionPoint";

export type RouteJunction = {
  kind: RouteJunctionKind;
  x: number;
  y: number;
  connectionIds: [string, string];
};

export type OrthogonalRoutePlan = {
  routes: RoutedConnection[];
  bridges: CrossingBridge[];
  junctions: RouteJunction[];
};

export const ROUTE_STUB_PX = 14;
export const ROUTE_CLEARANCE_PX = 10;
/** True semicircle hop: width = 2r, height = r. */
export const BRIDGE_RADIUS_PX = 10;
export const BRIDGE_WIDTH_PX = BRIDGE_RADIUS_PX * 2;
export const BRIDGE_HEIGHT_PX = BRIDGE_RADIUS_PX;
export const BRIDGE_MIN_VISIBLE_RADIUS_PX = 8;

type CardBox = Rect & { id: string };

function cardBox(card: RelatedDiagramCard): CardBox {
  return {
    id: card.id,
    x: card.layout.x,
    y: card.layout.y,
    width: card.layout.width,
    height: card.layout.height,
  };
}

export function cardCenter(card: RelatedDiagramCard): Point {
  return {
    x: card.layout.x + card.layout.width / 2,
    y: card.layout.y + card.layout.height / 2,
  };
}

export function edgeMidpoint(box: Rect, side: EdgeSide): Point {
  switch (side) {
    case "top":
      return { x: box.x + box.width / 2, y: box.y };
    case "right":
      return { x: box.x + box.width, y: box.y + box.height / 2 };
    case "bottom":
      return { x: box.x + box.width / 2, y: box.y + box.height };
    case "left":
      return { x: box.x, y: box.y + box.height / 2 };
  }
}

export function outwardPoint(p: Point, side: EdgeSide, stub: number): Point {
  switch (side) {
    case "top":
      return { x: p.x, y: p.y - stub };
    case "right":
      return { x: p.x + stub, y: p.y };
    case "bottom":
      return { x: p.x, y: p.y + stub };
    case "left":
      return { x: p.x - stub, y: p.y };
  }
}

const ALIGN_EPS = 6;

/** Choose readable source/target edges from relative card position. */
export function chooseCardEdges(
  source: RelatedDiagramCard,
  target: RelatedDiagramCard,
): { sourceEdge: EdgeSide; targetEdge: EdgeSide } {
  const s = cardCenter(source);
  const t = cardCenter(target);
  const dx = t.x - s.x;
  const dy = t.y - s.y;
  if (Math.abs(dy) <= ALIGN_EPS && Math.abs(dx) > ALIGN_EPS) {
    return dx > 0
      ? { sourceEdge: "right", targetEdge: "left" }
      : { sourceEdge: "left", targetEdge: "right" };
  }
  if (Math.abs(dx) <= ALIGN_EPS && Math.abs(dy) > ALIGN_EPS) {
    return dy > 0
      ? { sourceEdge: "bottom", targetEdge: "top" }
      : { sourceEdge: "top", targetEdge: "bottom" };
  }
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { sourceEdge: "right", targetEdge: "left" }
      : { sourceEdge: "left", targetEdge: "right" };
  }
  return dy >= 0
    ? { sourceEdge: "bottom", targetEdge: "top" }
    : { sourceEdge: "top", targetEdge: "bottom" };
}

export function isAxisAligned(a: Point, b: Point, eps = 0.51): boolean {
  return Math.abs(a.x - b.x) <= eps || Math.abs(a.y - b.y) <= eps;
}

export function isOrthogonalPolyline(points: Point[]): boolean {
  if (points.length < 2) return false;
  for (let i = 1; i < points.length; i++) {
    if (!isAxisAligned(points[i - 1]!, points[i]!)) return false;
  }
  return true;
}

export function countBends(points: Point[]): number {
  let n = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const c = points[i + 1]!;
    const inH = Math.abs(a.y - b.y) <= 0.51;
    const outH = Math.abs(b.y - c.y) <= 0.51;
    if (inH !== outH) n += 1;
  }
  return n;
}

export function polylineLength(points: Point[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    len += Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
  }
  return len;
}

function inflate(box: Rect, pad: number): Rect {
  return {
    x: box.x - pad,
    y: box.y - pad,
    width: box.width + pad * 2,
    height: box.height + pad * 2,
  };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function uniquePoints(points: Point[]): Point[] {
  const out: Point[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (!last || Math.abs(last.x - p.x) > 0.2 || Math.abs(last.y - p.y) > 0.2) {
      out.push(p);
    }
  }
  return out;
}

function segmentHitsRect(
  a: Point,
  b: Point,
  rect: Rect,
): boolean {
  const r = {
    left: rect.x,
    right: rect.x + rect.width,
    top: rect.y,
    bottom: rect.y + rect.height,
  };
  if (Math.abs(a.y - b.y) <= 0.51) {
    const y = a.y;
    const lo = Math.min(a.x, b.x);
    const hi = Math.max(a.x, b.x);
    return y > r.top && y < r.bottom && hi > r.left && lo < r.right;
  }
  if (Math.abs(a.x - b.x) <= 0.51) {
    const x = a.x;
    const lo = Math.min(a.y, b.y);
    const hi = Math.max(a.y, b.y);
    return x > r.left && x < r.right && hi > r.top && lo < r.bottom;
  }
  return true;
}

/** True if any interior segment (not first/last stub) hits an obstacle card. */
export function polylineHitsObstacles(
  points: Point[],
  obstacles: CardBox[],
  ignoreIds: Set<string>,
  clearance: number,
): boolean {
  if (points.length < 2) return false;
  const start = points.length <= 3 ? 0 : 1;
  const end = points.length <= 3 ? points.length - 1 : points.length - 2;
  for (let i = start; i < end; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    for (const box of obstacles) {
      if (ignoreIds.has(box.id)) continue;
      if (segmentHitsRect(a, b, inflate(box, clearance))) return true;
    }
  }
  return false;
}

function hvPath(from: Point, to: Point): Point[] {
  if (Math.abs(from.x - to.x) <= 0.2 || Math.abs(from.y - to.y) <= 0.2) {
    return [from, to];
  }
  return [from, { x: to.x, y: from.y }, to];
}

function vhPath(from: Point, to: Point): Point[] {
  if (Math.abs(from.x - to.x) <= 0.2 || Math.abs(from.y - to.y) <= 0.2) {
    return [from, to];
  }
  return [from, { x: from.x, y: to.y }, to];
}

function candidatePolylines(
  source: CardBox,
  target: CardBox,
  sourceEdge: EdgeSide,
  targetEdge: EdgeSide,
  stub: number,
  clearance: number,
  canvas: Rect,
  blockers: CardBox[],
): Point[][] {
  const sp = edgeMidpoint(source, sourceEdge);
  const tp = edgeMidpoint(target, targetEdge);
  const a = outwardPoint(sp, sourceEdge, stub);
  const b = outwardPoint(tp, targetEdge, stub);
  const pad = stub + clearance;
  const x0 = Math.min(source.x, target.x);
  const x1 = Math.max(source.x + source.width, target.x + target.width);
  const y0 = Math.min(source.y, target.y);
  const y1 = Math.max(source.y + source.height, target.y + target.height);
  const xBlock = blockers.filter(
    (o) => o.x < x1 && o.x + o.width > x0,
  );
  const yBlock = blockers.filter(
    (o) => o.y < y1 && o.y + o.height > y0,
  );
  const topLane = clamp(
    Math.min(source.y, target.y, ...xBlock.map((o) => o.y)) - pad,
    canvas.y + stub,
    canvas.y + canvas.height - stub,
  );
  const bottomLane = clamp(
    Math.max(
      source.y + source.height,
      target.y + target.height,
      ...xBlock.map((o) => o.y + o.height),
    ) + pad,
    canvas.y + stub,
    canvas.y + canvas.height - stub,
  );
  const leftLane = clamp(
    Math.min(source.x, target.x, ...yBlock.map((o) => o.x)) - pad,
    canvas.x + stub,
    canvas.x + canvas.width - stub,
  );
  const rightLane = clamp(
    Math.max(
      source.x + source.width,
      target.x + target.width,
      ...yBlock.map((o) => o.x + o.width),
    ) + pad,
    canvas.x + stub,
    canvas.x + canvas.width - stub,
  );

  const wrap = (mid: Point[]): Point[] => uniquePoints([sp, a, ...mid, b, tp]);

  return [
    wrap(hvPath(a, b)),
    wrap(vhPath(a, b)),
    wrap([
      { x: a.x, y: topLane },
      { x: b.x, y: topLane },
    ]),
    wrap([
      { x: a.x, y: bottomLane },
      { x: b.x, y: bottomLane },
    ]),
    wrap([
      { x: leftLane, y: a.y },
      { x: leftLane, y: b.y },
    ]),
    wrap([
      { x: rightLane, y: a.y },
      { x: rightLane, y: b.y },
    ]),
  ].filter((pts) => pts.length >= 2 && isOrthogonalPolyline(pts));
}

function routeScore(
  points: Point[],
  hitsObstacle: boolean,
  crossingCount: number,
): number {
  return (
    (hitsObstacle ? 100_000 : 0) +
    countBends(points) * 120 +
    polylineLength(points) +
    crossingCount * 45
  );
}

const AXIS_EPS = 1.1;
const ENDPOINT_EPS = 1.15;

function almost(a: number, b: number, eps = ENDPOINT_EPS): boolean {
  return Math.abs(a - b) <= eps;
}

function isHorizontalSeg(a: Point, b: Point): boolean {
  return Math.abs(a.y - b.y) <= AXIS_EPS;
}

function isVerticalSeg(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) <= AXIS_EPS;
}

/** Same-line interior overlap (not a crossing; no bridge). */
export function isColinearOverlap(
  a1: Point,
  a2: Point,
  b1: Point,
  b2: Point,
): boolean {
  if (isHorizontalSeg(a1, a2) && isHorizontalSeg(b1, b2) && almost(a1.y, b1.y, 1.2)) {
    const aLo = Math.min(a1.x, a2.x);
    const aHi = Math.max(a1.x, a2.x);
    const bLo = Math.min(b1.x, b2.x);
    const bHi = Math.max(b1.x, b2.x);
    return Math.min(aHi, bHi) - Math.max(aLo, bLo) > ENDPOINT_EPS;
  }
  if (isVerticalSeg(a1, a2) && isVerticalSeg(b1, b2) && almost(a1.x, b1.x, 1.2)) {
    const aLo = Math.min(a1.y, a2.y);
    const aHi = Math.max(a1.y, a2.y);
    const bLo = Math.min(b1.y, b2.y);
    const bHi = Math.max(b1.y, b2.y);
    return Math.min(aHi, bHi) - Math.max(aLo, bLo) > ENDPOINT_EPS;
  }
  return false;
}

function nearPoint(a: Point, b: Point, tol = 1.2): boolean {
  return almost(a.x, b.x, tol) && almost(a.y, b.y, tol);
}

function pointOnCardBorder(p: Point, box: Rect, tol = 0.85): boolean {
  const left = box.x;
  const right = box.x + box.width;
  const top = box.y;
  const bottom = box.y + box.height;
  const insideX = p.x >= left - tol && p.x <= right + tol;
  const insideY = p.y >= top - tol && p.y <= bottom + tol;
  if (!insideX || !insideY) return false;
  return (
    almost(p.x, left, tol) ||
    almost(p.x, right, tol) ||
    almost(p.y, top, tol) ||
    almost(p.y, bottom, tol)
  );
}

/**
 * Proper H×V interior crossing. Excludes T-junctions, endpoint touches,
 * and same-line overlap.
 */
export function properSegmentCrossing(
  a1: Point,
  a2: Point,
  b1: Point,
  b2: Point,
): Point | null {
  if (isColinearOverlap(a1, a2, b1, b2)) return null;
  const aH = isHorizontalSeg(a1, a2);
  const aV = isVerticalSeg(a1, a2);
  const bH = isHorizontalSeg(b1, b2);
  const bV = isVerticalSeg(b1, b2);
  if (!(aH && bV) && !(aV && bH)) return null;
  const h1 = aH ? a1 : b1;
  const h2 = aH ? a2 : b2;
  const v1 = aH ? b1 : a1;
  const v2 = aH ? b2 : a2;
  const y = (h1.y + h2.y) / 2;
  const x = (v1.x + v2.x) / 2;
  const hLo = Math.min(h1.x, h2.x);
  const hHi = Math.max(h1.x, h2.x);
  const vLo = Math.min(v1.y, v2.y);
  const vHi = Math.max(v1.y, v2.y);
  // Strict interior only. Endpoint coincidence is a T/L join, not a bridge.
  // Do not inflate a band around ends — that dropped real crossings near bends.
  const onH = x > hLo + 0.35 && x < hHi - 0.35;
  const onV = y > vLo + 0.35 && y < vHi - 0.35;
  if (!onH || !onV) return null;
  return { x, y };
}

export function countRouteCrossings(
  points: Point[],
  others: Point[][],
): number {
  let n = 0;
  for (const other of others) {
    for (let i = 1; i < points.length; i++) {
      for (let j = 1; j < other.length; j++) {
        if (
          properSegmentCrossing(
            points[i - 1]!,
            points[i]!,
            other[j - 1]!,
            other[j]!,
          )
        ) {
          n += 1;
        }
      }
    }
  }
  return n;
}

const JUNCTION_EPS = 1.5;

function pointOnSegment(
  p: Point,
  a: Point,
  b: Point,
  includeEnds = true,
): boolean {
  if (isHorizontalSeg(a, b)) {
    if (!almost(p.y, (a.y + b.y) / 2, JUNCTION_EPS)) return false;
    const lo = Math.min(a.x, b.x);
    const hi = Math.max(a.x, b.x);
    return includeEnds
      ? p.x >= lo - JUNCTION_EPS && p.x <= hi + JUNCTION_EPS
      : p.x > lo + 0.35 && p.x < hi - 0.35;
  }
  if (isVerticalSeg(a, b)) {
    if (!almost(p.x, (a.x + b.x) / 2, JUNCTION_EPS)) return false;
    const lo = Math.min(a.y, b.y);
    const hi = Math.max(a.y, b.y);
    return includeEnds
      ? p.y >= lo - JUNCTION_EPS && p.y <= hi + JUNCTION_EPS
      : p.y > lo + 0.35 && p.y < hi - 0.35;
  }
  return false;
}

function isRouteVertex(route: RoutedConnection, p: Point): boolean {
  return route.points.some((q) => nearPoint(p, q, JUNCTION_EPS));
}

function isOwnBend(route: RoutedConnection, p: Point): boolean {
  for (let i = 1; i < route.points.length - 1; i++) {
    if (nearPoint(p, route.points[i]!, JUNCTION_EPS)) return true;
  }
  return false;
}

function sharedCardEnd(
  a: RoutedConnection,
  b: RoutedConnection,
): "source" | "target" | null {
  if (a.sourceCardId === b.sourceCardId) return "source";
  if (a.targetCardId === b.targetCardId) return "target";
  return null;
}

function routeEnd(route: RoutedConnection, side: "source" | "target"): Point {
  return side === "source"
    ? route.points[0]!
    : route.points[route.points.length - 1]!;
}

function overlapTouches(
  axis: Axis,
  span: { lo: number; hi: number },
  fixed: number,
  p: Point,
): boolean {
  if (axis === "h") {
    return (
      almost(p.y, fixed, JUNCTION_EPS) &&
      p.x >= span.lo - JUNCTION_EPS &&
      p.x <= span.hi + JUNCTION_EPS
    );
  }
  return (
    almost(p.x, fixed, JUNCTION_EPS) &&
    p.y >= span.lo - JUNCTION_EPS &&
    p.y <= span.hi + JUNCTION_EPS
  );
}

function hitIsInterior(a: Point, b: Point, hit: Point): boolean {
  if (isHorizontalSeg(a, b)) {
    const lo = Math.min(a.x, b.x);
    const hi = Math.max(a.x, b.x);
    return hit.x > lo + 0.35 && hit.x < hi - 0.35 && almost(hit.y, (a.y + b.y) / 2, JUNCTION_EPS);
  }
  if (isVerticalSeg(a, b)) {
    const lo = Math.min(a.y, b.y);
    const hi = Math.max(a.y, b.y);
    return hit.y > lo + 0.35 && hit.y < hi - 0.35 && almost(hit.x, (a.x + b.x) / 2, JUNCTION_EPS);
  }
  return false;
}

function overlapInterval(
  a1: number,
  a2: number,
  b1: number,
  b2: number,
): { lo: number; hi: number } | null {
  const lo = Math.max(Math.min(a1, a2), Math.min(b1, b2));
  const hi = Math.min(Math.max(a1, a2), Math.max(b1, b2));
  if (hi - lo <= ENDPOINT_EPS) return null;
  return { lo, hi };
}

function pushJunction(
  out: RouteJunction[],
  seen: Set<string>,
  kind: RouteJunctionKind,
  p: Point,
  aId: string,
  bId: string,
) {
  const ids: [string, string] =
    aId < bId ? [aId, bId] : [bId, aId];
  const key = `${kind}:${Math.round(p.x)}:${Math.round(p.y)}:${ids[0]}:${ids[1]}`;
  if (seen.has(key)) return;
  seen.add(key);
  out.push({ kind, x: p.x, y: p.y, connectionIds: ids });
}

/**
 * Junctions are explicit topology only. Geometry is never inferred.
 */
export function collectRouteJunctions(
  _routes: RoutedConnection[],
  topology?: RelatedDiagramRouteTopology,
): RouteJunction[] {
  return topology ? junctionsFromTopology(topology) : [];
}


export type CrossingMeetingKind = "interior" | "bendT";

export type CrossingAnalysis = {
  x: number;
  y: number;
  connectionAId: string;
  aSource: string;
  aTarget: string;
  connectionBId: string;
  bSource: string;
  bTarget: string;
  aAxis: Axis;
  bAxis: Axis;
  meetingKind: CrossingMeetingKind;
  internalCrossing: boolean;
  vertexCoincidence: boolean;
  sharedTrunk: boolean;
  explicitBranchPoint: boolean;
  cardEdgeAttachment: boolean;
  classifiedAs: "junction" | "independent" | "excluded";
  hasBridge: boolean;
  excludeReason: string | null;
};

type MeetingHit = {
  hit: Point;
  a: RoutedConnection;
  b: RoutedConnection;
  a1: Point;
  a2: Point;
  b1: Point;
  b2: Point;
  meetingKind: CrossingMeetingKind;
};

function collectMeetingHits(routes: RoutedConnection[]): MeetingHit[] {
  const hits: MeetingHit[] = [];
  const seen = new Set<string>();
  const push = (row: MeetingHit) => {
    const ids =
      row.a.connectionId < row.b.connectionId
        ? `${row.a.connectionId}|${row.b.connectionId}`
        : `${row.b.connectionId}|${row.a.connectionId}`;
    const key = `${ids}:${Math.round(row.hit.x)}:${Math.round(row.hit.y)}`;
    if (seen.has(key)) return;
    seen.add(key);
    hits.push(row);
  };

  for (let i = 0; i < routes.length; i++) {
    for (let j = i + 1; j < routes.length; j++) {
      const a = routes[i]!;
      const b = routes[j]!;
      for (let si = 1; si < a.points.length; si++) {
        for (let sj = 1; sj < b.points.length; sj++) {
          const a1 = a.points[si - 1]!;
          const a2 = a.points[si]!;
          const b1 = b.points[sj - 1]!;
          const b2 = b.points[sj]!;
          const hit = properSegmentCrossing(a1, a2, b1, b2);
          if (hit) {
            push({ hit, a, b, a1, a2, b1, b2, meetingKind: "interior" });
          }
        }
      }
    }
  }
  return hits;
}

function classifyMeeting(
  row: MeetingHit,
  junctions: RouteJunction[],
  topology?: RelatedDiagramRouteTopology,
): CrossingAnalysis {
  const { hit, a, b, a1, a2, b1, b2, meetingKind } = row;
  const aAxis = segmentAxis(a1, a2);
  const bAxis = segmentAxis(b1, b2);
  const vertexCoincidence = isRouteVertex(a, hit) || isRouteVertex(b, hit);
  const sharedTrunk = junctions.some(
    (j) =>
      j.kind === "sharedTrunk" &&
      j.connectionIds.includes(a.connectionId) &&
      j.connectionIds.includes(b.connectionId),
  );
  const explicitBranchPoint = junctions.some(
    (j) =>
      j.kind === "branchPoint" &&
      nearPoint(hit, j, JUNCTION_EPS) &&
      j.connectionIds.includes(a.connectionId) &&
      j.connectionIds.includes(b.connectionId),
  );
  const cardEdgeAttachment =
    nearPoint(hit, a.points[0]!) ||
    nearPoint(hit, a.points[a.points.length - 1]!) ||
    nearPoint(hit, b.points[0]!) ||
    nearPoint(hit, b.points[b.points.length - 1]!);
  const explicitJunction = hitOnExplicitJunction(
    hit,
    a.connectionId,
    b.connectionId,
    topology,
    JUNCTION_EPS,
  );

  let classifiedAs: CrossingAnalysis["classifiedAs"] = "independent";
  let excludeReason: string | null = null;
  if (explicitJunction) {
    classifiedAs = "junction";
    excludeReason = explicitBranchPoint
      ? "intentional_branch_point"
      : "explicit_junction";
  } else if (cardEdgeAttachment) {
    classifiedAs = "excluded";
    excludeReason = "card_attachment";
  }

  return {
    x: hit.x,
    y: hit.y,
    connectionAId: a.connectionId,
    aSource: a.sourceCardId,
    aTarget: a.targetCardId,
    connectionBId: b.connectionId,
    bSource: b.sourceCardId,
    bTarget: b.targetCardId,
    aAxis,
    bAxis,
    meetingKind,
    internalCrossing: meetingKind === "interior",
    vertexCoincidence,
    sharedTrunk,
    explicitBranchPoint,
    cardEdgeAttachment,
    classifiedAs,
    hasBridge: classifiedAs === "independent",
    excludeReason,
  };
}

function jumperForHit(row: MeetingHit): {
  jumper: RoutedConnection;
  under: RoutedConnection;
  jumperAxis: Axis;
} {
  const { hit, a, b, a1, a2, b1, b2 } = row;
  const first = a.connectionId < b.connectionId ? a : b;
  const second = a.connectionId < b.connectionId ? b : a;
  const firstSeg = a.connectionId < b.connectionId ? [a1, a2] : [b1, b2];
  const secondSeg = a.connectionId < b.connectionId ? [b1, b2] : [a1, a2];
  const firstInterior = hitIsInterior(firstSeg[0]!, firstSeg[1]!, hit);
  const secondInterior = hitIsInterior(secondSeg[0]!, secondSeg[1]!, hit);
  let jumper = second;
  let jumperSeg = secondSeg;
  if (firstInterior && !secondInterior) {
    jumper = first;
    jumperSeg = firstSeg;
  } else if (secondInterior && !firstInterior) {
    jumper = second;
    jumperSeg = secondSeg;
  }
  return {
    jumper,
    under: jumper.connectionId === a.connectionId ? b : a,
    jumperAxis: segmentAxis(jumperSeg[0]!, jumperSeg[1]!),
  };
}

/**
 * Explicit Junction → no bridge. Any other proper H×V interior crossing → bridge.
 * Shared-trunk pairs at the same point collapse to one Independent Crossing.
 */
export function analyzeRouteMeetings(
  routes: RoutedConnection[],
  cards: RelatedDiagramCard[] = [],
  topology?: RelatedDiagramRouteTopology,
): {
  meetings: CrossingAnalysis[];
  hvCrossingCount: number;
  intentionalJunctionCount: number;
  independentCrossingCount: number;
  bridgeCount: number;
  bridges: CrossingBridge[];
  junctions: RouteJunction[];
} {
  void cards;
  const junctions = collectRouteJunctions(routes, topology);
  const rawHits = collectMeetingHits(routes);
  const meetings = rawHits.map((row) => classifyMeeting(row, junctions, topology));
  const byPoint = new Map<
    string,
    { row: MeetingHit; analysis: CrossingAnalysis; chosen: ReturnType<typeof jumperForHit> }
  >();
  for (let i = 0; i < rawHits.length; i++) {
    const row = rawHits[i]!;
    const analysis = meetings[i]!;
    if (!analysis.hasBridge) continue;
    const key = `${Math.round(row.hit.x)}:${Math.round(row.hit.y)}`;
    const chosen = jumperForHit(row);
    const prev = byPoint.get(key);
    if (
      !prev ||
      chosen.jumper.connectionId > prev.chosen.jumper.connectionId
    ) {
      byPoint.set(key, { row, analysis, chosen });
    }
  }
  const bridges: CrossingBridge[] = [...byPoint.values()].map(({ row, chosen }) => ({
    jumperConnectionId: chosen.jumper.connectionId,
    underConnectionId: chosen.under.connectionId,
    x: row.hit.x,
    y: row.hit.y,
    jumperAxis: chosen.jumperAxis,
  }));
  const independentPoints = new Set(
    meetings
      .filter((m) => m.classifiedAs === "independent")
      .map((m) => `${Math.round(m.x)}:${Math.round(m.y)}`),
  );
  return {
    meetings,
    hvCrossingCount: new Set(meetings.map((m) => `${Math.round(m.x)}:${Math.round(m.y)}`))
      .size,
    intentionalJunctionCount: topology
      ? topology.branchPoints.length
      : meetings.filter((m) => m.classifiedAs === "junction").length,
    independentCrossingCount: independentPoints.size,
    bridgeCount: bridges.length,
    bridges,
    junctions,
  };
}

export function classifyRouteInteractions(
  routes: RoutedConnection[],
  cards: RelatedDiagramCard[] = [],
  topology?: RelatedDiagramRouteTopology,
): { bridges: CrossingBridge[]; junctions: RouteJunction[] } {
  const analyzed = analyzeRouteMeetings(routes, cards, topology);
  return { bridges: analyzed.bridges, junctions: analyzed.junctions };
}

export function detectCrossings(
  routes: RoutedConnection[],
  cards: RelatedDiagramCard[] = [],
  topology?: RelatedDiagramRouteTopology,
): CrossingBridge[] {
  return classifyRouteInteractions(routes, cards, topology).bridges;
}

export function planOrthogonalRoutes(
  cards: RelatedDiagramCard[],
  connections: RelatedDiagramConnection[],
  options?: {
    canvas?: Rect;
    extraObstacles?: Rect[];
    stub?: number;
    clearance?: number;
    topology?: RelatedDiagramRouteTopology;
  },
): OrthogonalRoutePlan {
  const stub = options?.stub ?? ROUTE_STUB_PX;
  const clearance = options?.clearance ?? ROUTE_CLEARANCE_PX;
  const canvas = options?.canvas ?? {
    x: 0,
    y: 0,
    width: 2000,
    height: 1600,
  };
  const boxes = cards.map(cardBox);
  const extra: CardBox[] = (options?.extraObstacles ?? []).map((r, i) => ({
    ...r,
    id: `__obstacle_${i}`,
  }));
  const obstacles = [...boxes, ...extra];
  const byId = new Map(cards.map((c) => [c.id, c]));
  const ordered = [...connections].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );

  const authored = new Map(
    (options?.topology?.routes ?? []).map((r) => [r.connectionId, r]),
  );

  const accepted: RoutedConnection[] = [];
  for (const conn of ordered) {
    const source = byId.get(conn.sourceCardId);
    const target = byId.get(conn.targetCardId);
    if (!source || !target || source.id === target.id) continue;
    const preset = authored.get(conn.id);
    if (preset && preset.points.length >= 2) {
      accepted.push({
        connectionId: conn.id,
        sourceCardId: source.id,
        targetCardId: target.id,
        sourceEdge: preset.sourceEdge,
        targetEdge: preset.targetEdge,
        points: preset.points,
      });
      continue;
    }
    const { sourceEdge, targetEdge } = chooseCardEdges(source, target);
    const ignore = new Set([source.id, target.id]);
    const blockers = obstacles.filter((o) => !ignore.has(o.id));
    const candidates = candidatePolylines(
      cardBox(source),
      cardBox(target),
      sourceEdge,
      targetEdge,
      stub,
      clearance,
      canvas,
      blockers,
    );
    const prior = accepted.map((r) => r.points);
    let best: Point[] | null = null;
    let bestScore = Infinity;
    for (const pts of candidates) {
      const hits = polylineHitsObstacles(pts, obstacles, ignore, clearance);
      const crosses = countRouteCrossings(pts, prior);
      const score = routeScore(pts, hits, crosses);
      if (score < bestScore) {
        bestScore = score;
        best = pts;
      }
    }
    if (!best) continue;
    accepted.push({
      connectionId: conn.id,
      sourceCardId: source.id,
      targetCardId: target.id,
      sourceEdge,
      targetEdge,
      points: best,
    });
  }

  const classified = classifyRouteInteractions(
    accepted,
    cards,
    options?.topology,
  );
  return {
    routes: accepted,
    bridges: classified.bridges,
    junctions: classified.junctions,
  };
}

function segmentAxis(a: Point, b: Point): Axis {
  return isHorizontalSeg(a, b) ? "h" : "v";
}

function alongT(a: Point, b: Point, p: Point): number {
  if (segmentAxis(a, b) === "h") {
    const span = b.x - a.x;
    return span === 0 ? 0 : (p.x - a.x) / span;
  }
  const span = b.y - a.y;
  return span === 0 ? 0 : (p.y - a.y) / span;
}

/**
 * SVG path for an orthogonal polyline with semicircle bridges on this route.
 * Bridge bulge: horizontal → up (−y); vertical → right (+x). Deterministic.
 */
export function polylineCarriesBridge(
  points: Point[],
  br: CrossingBridge,
): boolean {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    if (bridgeOnSegment(a, b, br, segmentAxis(a, b))) return true;
  }
  return false;
}

function bridgeOnSegment(
  a: Point,
  b: Point,
  br: CrossingBridge,
  axis: Axis,
): boolean {
  if (br.jumperAxis !== axis) return false;
  if (axis === "h") {
    const lo = Math.min(a.x, b.x);
    const hi = Math.max(a.x, b.x);
    return (
      br.x > lo + 0.35 &&
      br.x < hi - 0.35 &&
      Math.abs(br.y - (a.y + b.y) / 2) <= 5
    );
  }
  const lo = Math.min(a.y, b.y);
  const hi = Math.max(a.y, b.y);
  return (
    br.y > lo + 0.35 &&
    br.y < hi - 0.35 &&
    Math.abs(br.x - (a.x + b.x) / 2) <= 5
  );
}

export function hopRadiusForSegment(
  segLen: number,
  requested = BRIDGE_RADIUS_PX,
): number | null {
  const maxR = (segLen - 16) / 2;
  if (maxR < BRIDGE_MIN_VISIBLE_RADIUS_PX) return null;
  return Math.min(requested, maxR);
}

/** One visual hop per coincident point (later jumper id wins). Semantics unchanged. */
export function dedupeBridgesForVisual(
  bridges: CrossingBridge[],
): CrossingBridge[] {
  const byPoint = new Map<string, CrossingBridge>();
  const sorted = [...bridges].sort((a, b) =>
    a.jumperConnectionId < b.jumperConnectionId
      ? -1
      : a.jumperConnectionId > b.jumperConnectionId
        ? 1
        : 0,
  );
  for (const br of sorted) {
    const key = `${Math.round(br.x)}:${Math.round(br.y)}`;
    byPoint.set(key, br);
  }
  return [...byPoint.values()];
}

/** Snap centerline bridges onto an offset polyline (double-line). */
export function snapBridgesToPolyline(
  points: Point[],
  bridges: CrossingBridge[],
): CrossingBridge[] {
  return bridges.map((br) => {
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]!;
      const b = points[i]!;
      const axis = segmentAxis(a, b);
      if (!bridgeOnSegment(a, b, br, axis)) continue;
      return axis === "h"
        ? { ...br, y: (a.y + b.y) / 2 }
        : { ...br, x: (a.x + b.x) / 2 };
    }
    return br;
  });
}

export type BridgeHopGeom = {
  axis: Axis;
  start: Point;
  end: Point;
  r: number;
  sweep: 0 | 1;
};

function hopsOnSegment(
  a: Point,
  b: Point,
  bridges: CrossingBridge[],
  radius: number,
): BridgeHopGeom[] {
  const axis = segmentAxis(a, b);
  const segLen = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
  const onSeg = bridges
    .filter((br) => bridgeOnSegment(a, b, br, axis))
    .sort((p, q) => alongT(a, b, p) - alongT(a, b, q));
  const hops: BridgeHopGeom[] = [];
  for (const br of onSeg) {
    const r = hopRadiusForSegment(segLen, radius);
    if (r == null) continue;
    const t = alongT(a, b, br);
    const distA = t * segLen;
    const distB = (1 - t) * segLen;
    if (distA < r + 8 || distB < r + 8) continue;
    if (axis === "h") {
      const dir = b.x >= a.x ? 1 : -1;
      hops.push({
        axis,
        start: { x: br.x - dir * r, y: a.y },
        end: { x: br.x + dir * r, y: a.y },
        r,
        sweep: dir > 0 ? 1 : 0,
      });
    } else {
      const dir = b.y >= a.y ? 1 : -1;
      hops.push({
        axis,
        start: { x: a.x, y: br.y - dir * r },
        end: { x: a.x, y: br.y + dir * r },
        r,
        sweep: dir > 0 ? 1 : 0,
      });
    }
  }
  return hops;
}

export function hopArcPathD(hop: BridgeHopGeom): string {
  return `M ${hop.start.x} ${hop.start.y} A ${hop.r} ${hop.r} 0 0 ${hop.sweep} ${hop.end.x} ${hop.end.y}`;
}

/** True semicircle hops only (for solid overlay; classifier unchanged). */
export function buildOrthogonalHopArcs(
  points: Point[],
  bridges: CrossingBridge[],
  radius = BRIDGE_RADIUS_PX,
): { d: string; axis: Axis }[] {
  if (points.length < 2) return [];
  const arcs: { d: string; axis: Axis }[] = [];
  for (let i = 1; i < points.length; i++) {
    for (const hop of hopsOnSegment(points[i - 1]!, points[i]!, bridges, radius)) {
      arcs.push({ d: hopArcPathD(hop), axis: hop.axis });
    }
  }
  return arcs;
}

/**
 * Orthogonal spine with a gap at each hop so the chord does not cut the
 * semicircle, and dashed strokes do not break the arc.
 */
export function buildOrthogonalSpineD(
  points: Point[],
  bridges: CrossingBridge[],
  radius = BRIDGE_RADIUS_PX,
): string {
  if (points.length < 2) return "";
  const parts: string[] = [`M ${points[0]!.x} ${points[0]!.y}`];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const hops = hopsOnSegment(a, b, bridges, radius);
    for (const hop of hops) {
      parts.push(`L ${hop.start.x} ${hop.start.y}`);
      parts.push(`M ${hop.end.x} ${hop.end.y}`);
    }
    parts.push(`L ${b.x} ${b.y}`);
  }
  return parts.join(" ");
}

export function buildOrthogonalPathD(
  points: Point[],
  bridges: CrossingBridge[],
  radius = BRIDGE_RADIUS_PX,
): string {
  if (points.length < 2) return "";
  const parts: string[] = [`M ${points[0]!.x} ${points[0]!.y}`];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    for (const hop of hopsOnSegment(a, b, bridges, radius)) {
      parts.push(`L ${hop.start.x} ${hop.start.y}`);
      parts.push(
        `A ${hop.r} ${hop.r} 0 0 ${hop.sweep} ${hop.end.x} ${hop.end.y}`,
      );
    }
    parts.push(`L ${b.x} ${b.y}`);
  }
  return parts.join(" ");
}

export function offsetOrthogonalPolyline(
  points: Point[],
  offset: number,
): Point[] {
  if (points.length < 2) return points;
  const out: Point[] = [];
  for (let i = 0; i < points.length; i++) {
    const prev = points[i - 1];
    const cur = points[i]!;
    const next = points[i + 1];
    if (!prev) {
      const axis = segmentAxis(cur, next!);
      out.push(
        axis === "h"
          ? { x: cur.x, y: cur.y + (next!.x >= cur.x ? -offset : offset) }
          : { x: cur.x + (next!.y >= cur.y ? offset : -offset), y: cur.y },
      );
      continue;
    }
    if (!next) {
      const axis = segmentAxis(prev, cur);
      out.push(
        axis === "h"
          ? { x: cur.x, y: cur.y + (cur.x >= prev.x ? -offset : offset) }
          : { x: cur.x + (cur.y >= prev.y ? offset : -offset), y: cur.y },
      );
      continue;
    }
    const inH = segmentAxis(prev, cur) === "h";
    const outH = segmentAxis(cur, next) === "h";
    const inOff = inH
      ? cur.x >= prev.x
        ? -offset
        : offset
      : cur.y >= prev.y
        ? offset
        : -offset;
    const outOff = outH
      ? next.x >= cur.x
        ? -offset
        : offset
      : next.y >= cur.y
        ? offset
        : -offset;
    if (inH && !outH) {
      out.push({ x: cur.x + outOff, y: cur.y + inOff });
    } else if (!inH && outH) {
      out.push({ x: cur.x + inOff, y: cur.y + outOff });
    } else {
      out.push({
        x: cur.x + (inH ? 0 : inOff),
        y: cur.y + (inH ? inOff : 0),
      });
    }
  }
  return out;
}

export function lastSegmentDirection(points: Point[]): Point {
  if (points.length < 2) return { x: 1, y: 0 };
  const a = points[points.length - 2]!;
  const b = points[points.length - 1]!;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.abs(dx) + Math.abs(dy) || 1;
  return { x: dx / len, y: dy / len };
}

export function pointAlongLastSegment(
  points: Point[],
  inset: number,
): Point {
  if (points.length < 2) return points[0] ?? { x: 0, y: 0 };
  const a = points[points.length - 2]!;
  const b = points[points.length - 1]!;
  const len = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
  const t = len <= 0 ? 0 : Math.max(0, Math.min(1, 1 - inset / len));
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
