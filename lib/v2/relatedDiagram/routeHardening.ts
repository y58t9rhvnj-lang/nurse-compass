/**
 * Slice 2A routing hardening: obstacle keep-out, stubs, candidate
 * orthogonal routes, scoring, continuity, and bridge safe zones.
 * Junctions stay explicit. Geometry quality only.
 */

import { A3_HEIGHT_PX, A3_WIDTH_PX } from "./a3Canvas";
import {
  a3BoundaryViolationReasons,
  firstSegmentFacesEdge,
  inferEdgeFromPin,
  lastSegmentFacesEdge,
  obstacleKeepOut,
  polylineHitsExpandedLegend,
  selfCardPenetrationSegments,
  sourceExitCorridor,
  targetEntryCorridor,
} from "./geometryGuard";
import {
  BRIDGE_RADIUS_PX,
  countBends,
  countRouteCrossings,
  edgeMidpoint,
  isOrthogonalPolyline,
  outwardPoint,
  polylineLength,
  type CrossingBridge,
  type EdgeSide,
  type Point,
  type Rect,
} from "./orthogonalRouting";
import type { RelatedDiagramCard } from "./types";

export const CARD_ROUTE_CLEARANCE = 12;
export const MIN_ENDPOINT_STUB = 20;
export const MIN_BRANCH_CLEARANCE = 24;
export const MIN_ARROW_APPROACH = 24;
export const BRANCH_EXIT_SPACING = 20;
export const BRIDGE_SAFE_MARGIN = 10;
export const BEND_PENALTY = 140;
export const OBSTACLE_VIOLATION_PENALTY = 1_000_000;
export const NEAR_CARD_PENALTY = 18;
export const ENDPOINT_CLEARANCE_PENALTY = 420;

export type RouteObstacle = Rect & { id: string };

export type RouteCanvas = Rect;

const ORTHO_EPS = 0.51;
const DUP_EPS = 0.2;
export const ENDPOINT_MATCH_EPS = 0.2;

export function defaultRouteCanvas(): RouteCanvas {
  return { x: 0, y: 0, width: A3_WIDTH_PX, height: A3_HEIGHT_PX };
}

export function keepOutRect(box: Rect, clearance = CARD_ROUTE_CLEARANCE): Rect {
  return {
    x: box.x - clearance,
    y: box.y - clearance,
    width: box.width + clearance * 2,
    height: box.height + clearance * 2,
  };
}

export function cardObstacle(card: RelatedDiagramCard): RouteObstacle {
  return {
    id: card.id,
    x: card.layout.x,
    y: card.layout.y,
    width: card.layout.width,
    height: card.layout.height,
  };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function samePoint(a: Point, b: Point, eps = DUP_EPS): boolean {
  return Math.abs(a.x - b.x) <= eps && Math.abs(a.y - b.y) <= eps;
}

function segLen(a: Point, b: Point): number {
  return Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
}

export function minBridgeSegmentLength(
  radius = BRIDGE_RADIUS_PX,
  margin = BRIDGE_SAFE_MARGIN,
): number {
  return 2 * radius + 2 * margin;
}

function uniquePoints(points: Point[]): Point[] {
  const out: Point[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (!last || !samePoint(last, p)) out.push({ x: p.x, y: p.y });
  }
  return out;
}

function snapOrthogonalPair(a: Point, b: Point): Point {
  if (Math.abs(a.x - b.x) <= ORTHO_EPS) return { x: a.x, y: b.y };
  if (Math.abs(a.y - b.y) <= ORTHO_EPS) return { x: b.x, y: a.y };
  if (Math.abs(b.x - a.x) >= Math.abs(b.y - a.y)) return { x: b.x, y: a.y };
  return { x: a.x, y: b.y };
}

function colinearMiddle(a: Point, b: Point, c: Point): boolean {
  const h = Math.abs(a.y - b.y) <= ORTHO_EPS && Math.abs(b.y - c.y) <= ORTHO_EPS;
  const v = Math.abs(a.x - b.x) <= ORTHO_EPS && Math.abs(b.x - c.x) <= ORTHO_EPS;
  if (h) {
    const lo = Math.min(a.x, c.x);
    const hi = Math.max(a.x, c.x);
    return b.x > lo + DUP_EPS && b.x < hi - DUP_EPS;
  }
  if (v) {
    const lo = Math.min(a.y, c.y);
    const hi = Math.max(a.y, c.y);
    return b.y > lo + DUP_EPS && b.y < hi - DUP_EPS;
  }
  return false;
}

function axisAligned(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) <= ORTHO_EPS || Math.abs(a.y - b.y) <= ORTHO_EPS;
}

function appendOrthogonal(out: Point[], next: Point): void {
  const prev = out[out.length - 1];
  if (!prev) {
    out.push({ x: next.x, y: next.y });
    return;
  }
  if (samePoint(prev, next)) return;
  if (axisAligned(prev, next)) {
    out.push({ x: next.x, y: next.y });
    return;
  }
  const elbow = { x: next.x, y: prev.y };
  if (!samePoint(prev, elbow)) out.push(elbow);
  if (!samePoint(elbow, next)) out.push({ x: next.x, y: next.y });
}

function stripColinear(points: Point[]): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < points.length; i++) {
    const prev = out[out.length - 1];
    const cur = points[i]!;
    const next = points[i + 1];
    if (prev && next && colinearMiddle(prev, cur, next)) continue;
    out.push(cur);
  }
  return out;
}

/**
 * Orthogonalize interior points only. Source / target pins are never moved.
 * If an interior point is not axis-aligned with a pin, an intermediate bend
 * is inserted instead of snapping the pin.
 */
export function normalizeOrthogonalPolyline(
  points: Point[],
  sourcePin?: Point,
  targetPin?: Point,
): Point[] {
  if (points.length === 0) return [];
  const start = sourcePin
    ? { x: sourcePin.x, y: sourcePin.y }
    : { x: points[0]!.x, y: points[0]!.y };
  const end = targetPin
    ? { x: targetPin.x, y: targetPin.y }
    : { x: points[points.length - 1]!.x, y: points[points.length - 1]!.y };
  const built: Point[] = [start];
  const lastIndex = points.length - 1;
  for (let i = 1; i < lastIndex; i++) {
    appendOrthogonal(built, { x: points[i]!.x, y: points[i]!.y });
  }
  appendOrthogonal(built, end);

  const cleaned = stripColinear(uniquePoints(built));
  if (cleaned.length === 0) return [start, end];
  cleaned[0] = { x: start.x, y: start.y };
  cleaned[cleaned.length - 1] = { x: end.x, y: end.y };
  if (cleaned.length >= 2 && !axisAligned(cleaned[0]!, cleaned[1]!)) {
    cleaned.splice(1, 0, { x: cleaned[1]!.x, y: cleaned[0]!.y });
  }
  if (
    cleaned.length >= 2 &&
    !axisAligned(cleaned[cleaned.length - 2]!, cleaned[cleaned.length - 1]!)
  ) {
    const prev = cleaned[cleaned.length - 2]!;
    const last = cleaned[cleaned.length - 1]!;
    cleaned.splice(cleaned.length - 1, 0, { x: last.x, y: prev.y });
  }
  cleaned[0] = { x: start.x, y: start.y };
  cleaned[cleaned.length - 1] = { x: end.x, y: end.y };
  return uniquePoints(cleaned);
}

export type RouteValidation = {
  ok: boolean;
  reasons: string[];
};

export function validateOrthogonalRoute(input: {
  points: Point[];
  sourcePin: Point;
  targetPin: Point;
  obstacles: RouteObstacle[];
  sourceCardId: string;
  targetCardId: string;
  clearance?: number;
  sourceEdge?: EdgeSide;
  targetEdge?: EdgeSide;
}): RouteValidation {
  const reasons: string[] = [];
  const points = input.points;
  if (points.length < 2) reasons.push("too-few-points");
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !samePoint(first, input.sourcePin, ENDPOINT_MATCH_EPS)) {
    reasons.push("source-endpoint-mismatch");
  }
  if (!last || !samePoint(last, input.targetPin, ENDPOINT_MATCH_EPS)) {
    reasons.push("target-endpoint-mismatch");
  }
  const continuity = polylineContinuity(points);
  if (!continuity.orthogonal) reasons.push("not-orthogonal");
  if (!continuity.continuous) reasons.push("not-continuous");
  if (!continuity.noZeroLength) reasons.push("zero-length");
  if (!continuity.noDuplicates) reasons.push("duplicate-points");
  const ignore = new Set<string>();
  const sourceBox = input.obstacles.find((o) => o.id === input.sourceCardId);
  const targetBox = input.obstacles.find((o) => o.id === input.targetCardId);
  if (sourceBox) ignore.add(sourceBox.id);
  if (targetBox) ignore.add(targetBox.id);
  if (
    polylineViolatesKeepOuts(
      points,
      input.obstacles,
      ignore,
      input.clearance ?? 0,
    )
  ) {
    reasons.push("obstacle-violation");
  }
  if (sourceBox && targetBox && points.length >= 2) {
    const sourceEdge =
      input.sourceEdge ?? inferEdgeFromPin(sourceBox, input.sourcePin);
    const targetEdge =
      input.targetEdge ?? inferEdgeFromPin(targetBox, input.targetPin);
    const hits = selfCardPenetrationSegments(
      points,
      sourceBox,
      targetBox,
      sourceExitCorridor(sourceBox.id, input.sourcePin, sourceEdge),
      targetEntryCorridor(targetBox.id, input.targetPin, targetEdge),
    );
    if (hits.length > 0) reasons.push("self-card-penetration");
  }
  if (polylineHitsExpandedLegend(points)) {
    reasons.push("legend-violation");
  }
  reasons.push(...a3BoundaryViolationReasons(points));
  return { ok: reasons.length === 0, reasons };
}

/** Affected-route gate. Does not change Slice 1 planner validation. */
export function validateRouteGate(
  input: Parameters<typeof validateOrthogonalRoute>[0] & {
    targetEdge: EdgeSide;
    sourceEdge?: EdgeSide;
    requireArrowApproach?: boolean;
  },
): RouteValidation {
  const base = validateOrthogonalRoute(input);
  const reasons = [...base.reasons];
  if (input.requireArrowApproach !== false) {
    if (lastSegmentLength(input.points) < MIN_ARROW_APPROACH - 0.2) {
      reasons.push("arrow-approach");
    }
    if (!lastSegmentFacesEdge(input.points, input.targetEdge)) {
      reasons.push("arrow-reversed");
    }
  }
  if (input.sourceEdge && !firstSegmentFacesEdge(input.points, input.sourceEdge)) {
    reasons.push("source-inward");
  }
  return { ok: reasons.length === 0, reasons };
}

export function obstacleViolationSegments(
  points: Point[],
  obstacles: RouteObstacle[],
  ignoreIds: Set<string>,
  clearance = 0,
): { a: Point; b: Point }[] {
  const hits: { a: Point; b: Point }[] = [];
  if (points.length < 2) return hits;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    for (const box of obstacles) {
      if (ignoreIds.has(box.id)) continue;
      if (segmentHitsRect(a, b, obstacleKeepOut(box, clearance))) {
        hits.push({ a, b });
        break;
      }
    }
  }
  return hits;
}

export function polylineContinuity(points: Point[]): {
  continuous: boolean;
  orthogonal: boolean;
  noZeroLength: boolean;
  noDuplicates: boolean;
} {
  if (points.length < 2) {
    return {
      continuous: false,
      orthogonal: false,
      noZeroLength: false,
      noDuplicates: false,
    };
  }
  let noZeroLength = true;
  let noDuplicates = true;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    if (samePoint(a, b)) {
      noZeroLength = false;
      noDuplicates = false;
    }
    if (segLen(a, b) <= DUP_EPS) noZeroLength = false;
  }
  return {
    continuous: noZeroLength && noDuplicates,
    orthogonal: isOrthogonalPolyline(points),
    noZeroLength,
    noDuplicates,
  };
}

export function firstSegmentLength(points: Point[]): number {
  if (points.length < 2) return 0;
  return segLen(points[0]!, points[1]!);
}

export function lastSegmentLength(points: Point[]): number {
  if (points.length < 2) return 0;
  return segLen(points[points.length - 2]!, points[points.length - 1]!);
}

export function segmentHitsRect(a: Point, b: Point, rect: Rect): boolean {
  const left = rect.x;
  const right = rect.x + rect.width;
  const top = rect.y;
  const bottom = rect.y + rect.height;
  if (Math.abs(a.y - b.y) <= ORTHO_EPS) {
    const y = (a.y + b.y) / 2;
    const lo = Math.min(a.x, b.x);
    const hi = Math.max(a.x, b.x);
    return y > top && y < bottom && hi > left && lo < right;
  }
  if (Math.abs(a.x - b.x) <= ORTHO_EPS) {
    const x = (a.x + b.x) / 2;
    const lo = Math.min(a.y, b.y);
    const hi = Math.max(a.y, b.y);
    return x > left && x < right && hi > top && lo < bottom;
  }
  return true;
}

/**
 * True if any segment enters an unrelated card keep-out.
 * Source / target ids in ignoreIds are connection endpoints, not obstacles.
 */
export function polylineViolatesKeepOuts(
  points: Point[],
  obstacles: RouteObstacle[],
  ignoreIds: Set<string>,
  clearance = CARD_ROUTE_CLEARANCE,
): boolean {
  if (points.length < 2) return false;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    for (const box of obstacles) {
      if (ignoreIds.has(box.id)) continue;
      if (segmentHitsRect(a, b, obstacleKeepOut(box, clearance))) return true;
    }
  }
  return false;
}

export function distancePointToRect(p: Point, rect: Rect): number {
  const nearestX = clamp(p.x, rect.x, rect.x + rect.width);
  const nearestY = clamp(p.y, rect.y, rect.y + rect.height);
  const insideX = p.x >= rect.x && p.x <= rect.x + rect.width;
  const insideY = p.y >= rect.y && p.y <= rect.y + rect.height;
  if (insideX && insideY) {
    return -Math.min(
      p.x - rect.x,
      rect.x + rect.width - p.x,
      p.y - rect.y,
      rect.y + rect.height - p.y,
    );
  }
  return Math.hypot(p.x - nearestX, p.y - nearestY);
}

function hvPath(from: Point, to: Point): Point[] {
  if (Math.abs(from.x - to.x) <= ORTHO_EPS || Math.abs(from.y - to.y) <= ORTHO_EPS) {
    return [from, to];
  }
  return [from, { x: to.x, y: from.y }, to];
}

function vhPath(from: Point, to: Point): Point[] {
  if (Math.abs(from.x - to.x) <= ORTHO_EPS || Math.abs(from.y - to.y) <= ORTHO_EPS) {
    return [from, to];
  }
  return [from, { x: from.x, y: to.y }, to];
}

function nearCardPenalty(
  points: Point[],
  obstacles: RouteObstacle[],
  ignoreIds: Set<string>,
  clearance: number,
): number {
  let penalty = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;
    for (const box of obstacles) {
      if (ignoreIds.has(box.id)) continue;
      const d = distancePointToRect(p, box);
      if (d < clearance) {
        penalty += (clearance - d) * NEAR_CARD_PENALTY;
      }
    }
  }
  return penalty;
}

export function scoreOrthogonalRoute(
  points: Point[],
  obstacles: RouteObstacle[],
  ignoreIds: Set<string>,
  options?: {
    clearance?: number;
    crossingCount?: number;
    stub?: number;
    approach?: number;
  },
): { score: number; hitsObstacle: boolean } {
  const clearance = options?.clearance ?? CARD_ROUTE_CLEARANCE;
  const stub = options?.stub ?? MIN_ENDPOINT_STUB;
  const approach = options?.approach ?? MIN_ARROW_APPROACH;
  const hitsObstacle = polylineViolatesKeepOuts(
    points,
    obstacles,
    ignoreIds,
    clearance,
  );
  const first = firstSegmentLength(points);
  const last = lastSegmentLength(points);
  const endpointPenalty =
    (first + 0.01 < stub ? (stub - first) * (ENDPOINT_CLEARANCE_PENALTY / stub) : 0) +
    (last + 0.01 < approach
      ? (approach - last) * (ENDPOINT_CLEARANCE_PENALTY / approach)
      : 0);
  const score =
    (hitsObstacle ? OBSTACLE_VIOLATION_PENALTY : 0) +
    countBends(points) * BEND_PENALTY +
    polylineLength(points) +
    nearCardPenalty(points, obstacles, ignoreIds, clearance) +
    endpointPenalty +
    (options?.crossingCount ?? 0) * 45;
  return { score, hitsObstacle };
}

function overlapsAxis(value: number, start: number, size: number): boolean {
  return value > start && value < start + size;
}

function maxClearStub(
  pin: Point,
  edge: EdgeSide,
  desired: number,
  blockers: RouteObstacle[],
  clearance: number,
): number {
  let len = desired;
  for (const box of blockers) {
    const ko = keepOutRect(box, clearance);
    if (edge === "right" && overlapsAxis(pin.y, ko.y, ko.height) && ko.x > pin.x) {
      len = Math.min(len, Math.max(8, ko.x - pin.x - 1));
    } else if (edge === "left" && overlapsAxis(pin.y, ko.y, ko.height) && ko.x + ko.width < pin.x) {
      len = Math.min(len, Math.max(8, pin.x - (ko.x + ko.width) - 1));
    } else if (edge === "bottom" && overlapsAxis(pin.x, ko.x, ko.width) && ko.y > pin.y) {
      len = Math.min(len, Math.max(8, ko.y - pin.y - 1));
    } else if (edge === "top" && overlapsAxis(pin.x, ko.x, ko.width) && ko.y + ko.height < pin.y) {
      len = Math.min(len, Math.max(8, pin.y - (ko.y + ko.height) - 1));
    }
  }
  return len;
}

function laneClamp(n: number, canvas: RouteCanvas, pad: number): number {
  return clamp(n, canvas.x + pad, canvas.x + canvas.width - pad);
}

function laneClampY(n: number, canvas: RouteCanvas, pad: number): number {
  return clamp(n, canvas.y + pad, canvas.y + canvas.height - pad);
}

export function generateOrthogonalCandidates(input: {
  source: RouteObstacle;
  target: RouteObstacle;
  sourceEdge: EdgeSide;
  targetEdge: EdgeSide;
  obstacles: RouteObstacle[];
  canvas?: RouteCanvas;
  stub?: number;
  clearance?: number;
}): Point[][] {
  const stub = input.stub ?? MIN_ENDPOINT_STUB;
  const clearance = input.clearance ?? CARD_ROUTE_CLEARANCE;
  const canvas = input.canvas ?? defaultRouteCanvas();
  const { source, target, sourceEdge, targetEdge } = input;
  const blockers = input.obstacles.filter(
    (o) => o.id !== source.id && o.id !== target.id,
  );
  const sp = edgeMidpoint(source, sourceEdge);
  const tp = edgeMidpoint(target, targetEdge);
  const a = outwardPoint(sp, sourceEdge, stub);
  const b = outwardPoint(tp, targetEdge, Math.max(stub, MIN_ARROW_APPROACH));
  const a2 = outwardPoint(sp, sourceEdge, stub + clearance);
  const b2 = outwardPoint(tp, targetEdge, Math.max(stub, MIN_ARROW_APPROACH) + clearance);
  const aClear = outwardPoint(
    sp,
    sourceEdge,
    maxClearStub(sp, sourceEdge, stub, blockers, clearance),
  );
  const bClear = outwardPoint(
    tp,
    targetEdge,
    maxClearStub(tp, targetEdge, Math.max(stub, MIN_ARROW_APPROACH), blockers, clearance),
  );
  const pad = stub + clearance;
  const x0 = Math.min(source.x, target.x);
  const x1 = Math.max(source.x + source.width, target.x + target.width);
  const y0 = Math.min(source.y, target.y);
  const y1 = Math.max(source.y + source.height, target.y + target.height);
  const xBlock = blockers.filter((o) => o.x < x1 && o.x + o.width > x0);
  const yBlock = blockers.filter((o) => o.y < y1 && o.y + o.height > y0);

  const topLane = laneClampY(
    Math.min(source.y, target.y, ...xBlock.map((o) => o.y)) - pad,
    canvas,
    stub,
  );
  const bottomLane = laneClampY(
    Math.max(
      source.y + source.height,
      target.y + target.height,
      ...xBlock.map((o) => o.y + o.height),
    ) + pad,
    canvas,
    stub,
  );
  const leftLane = laneClamp(
    Math.min(source.x, target.x, ...yBlock.map((o) => o.x)) - pad,
    canvas,
    stub,
  );
  const rightLane = laneClamp(
    Math.max(
      source.x + source.width,
      target.x + target.width,
      ...yBlock.map((o) => o.x + o.width),
    ) + pad,
    canvas,
    stub,
  );
  const srcTop = laneClampY(source.y - pad, canvas, stub);
  const srcBottom = laneClampY(source.y + source.height + pad, canvas, stub);
  const srcLeft = laneClamp(source.x - pad, canvas, stub);
  const srcRight = laneClamp(source.x + source.width + pad, canvas, stub);
  const tgtTop = laneClampY(target.y - pad, canvas, stub);
  const tgtBottom = laneClampY(target.y + target.height + pad, canvas, stub);
  const tgtLeft = laneClamp(target.x - pad, canvas, stub);
  const tgtRight = laneClamp(target.x + target.width + pad, canvas, stub);

  const wrap = (mid: Point[]): Point[] =>
    normalizeOrthogonalPolyline([sp, a, ...mid, b, tp], sp, tp);
  const wrapClear = (mid: Point[]): Point[] =>
    normalizeOrthogonalPolyline([sp, aClear, ...mid, bClear, tp], sp, tp);

  const raw: Point[][] = [
    wrap(hvPath(a, b)),
    wrap(vhPath(a, b)),
    wrapClear(hvPath(aClear, bClear)),
    wrapClear(vhPath(aClear, bClear)),
    wrap(hvPath(a2, b2)),
    wrap(vhPath(a2, b2)),
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
    wrap([
      { x: a.x, y: srcTop },
      { x: b.x, y: srcTop },
    ]),
    wrap([
      { x: a.x, y: srcBottom },
      { x: b.x, y: srcBottom },
    ]),
    wrap([
      { x: srcLeft, y: a.y },
      { x: srcLeft, y: b.y },
    ]),
    wrap([
      { x: srcRight, y: a.y },
      { x: srcRight, y: b.y },
    ]),
    wrap([
      { x: a.x, y: tgtTop },
      { x: b.x, y: tgtTop },
    ]),
    wrap([
      { x: a.x, y: tgtBottom },
      { x: b.x, y: tgtBottom },
    ]),
    wrap([
      { x: tgtLeft, y: a.y },
      { x: tgtLeft, y: b.y },
    ]),
    wrap([
      { x: tgtRight, y: a.y },
      { x: tgtRight, y: b.y },
    ]),
    wrapClear([
      { x: aClear.x, y: topLane },
      { x: bClear.x, y: topLane },
    ]),
    wrapClear([
      { x: aClear.x, y: bottomLane },
      { x: bClear.x, y: bottomLane },
    ]),
    wrapClear([
      { x: leftLane, y: aClear.y },
      { x: leftLane, y: bClear.y },
    ]),
    wrapClear([
      { x: rightLane, y: aClear.y },
      { x: rightLane, y: bClear.y },
    ]),
  ];

  for (const box of blockers) {
    const ko = keepOutRect(box, clearance);
    const left = ko.x - 1;
    const right = ko.x + ko.width + 1;
    const top = ko.y - 1;
    const bottom = ko.y + ko.height + 1;
    raw.push(
      wrapClear([
        { x: aClear.x, y: top },
        { x: bClear.x, y: top },
      ]),
      wrapClear([
        { x: aClear.x, y: bottom },
        { x: bClear.x, y: bottom },
      ]),
      wrapClear([
        { x: left, y: aClear.y },
        { x: left, y: top },
        { x: bClear.x, y: top },
      ]),
      wrapClear([
        { x: left, y: aClear.y },
        { x: left, y: bottom },
        { x: bClear.x, y: bottom },
      ]),
      wrapClear([
        { x: right, y: aClear.y },
        { x: right, y: top },
        { x: bClear.x, y: top },
      ]),
      wrapClear([
        { x: right, y: aClear.y },
        { x: right, y: bottom },
        { x: bClear.x, y: bottom },
      ]),
    );
  }

  const seen = new Set<string>();
  const out: Point[][] = [];
  for (const pts of raw) {
    if (pts.length < 2 || !isOrthogonalPolyline(pts)) continue;
    if (a3BoundaryViolationReasons(pts).length > 0) continue;
    const key = pts.map((p) => `${Math.round(p.x)}:${Math.round(p.y)}`).join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(pts);
  }
  return out;
}

export function generatePointToPointCandidates(
  from: Point,
  to: Point,
  obstacles: RouteObstacle[],
  ignoreIds: Set<string>,
  canvas: RouteCanvas = defaultRouteCanvas(),
  clearance = CARD_ROUTE_CLEARANCE,
): Point[][] {
  const pad = MIN_ENDPOINT_STUB + clearance;
  const blockers = obstacles.filter((o) => !ignoreIds.has(o.id));
  const top = laneClampY(
    Math.min(from.y, to.y, ...blockers.map((o) => o.y)) - pad,
    canvas,
    MIN_ENDPOINT_STUB,
  );
  const bottom = laneClampY(
    Math.max(from.y, to.y, ...blockers.map((o) => o.y + o.height)) + pad,
    canvas,
    MIN_ENDPOINT_STUB,
  );
  const left = laneClamp(
    Math.min(from.x, to.x, ...blockers.map((o) => o.x)) - pad,
    canvas,
    MIN_ENDPOINT_STUB,
  );
  const right = laneClamp(
    Math.max(from.x, to.x, ...blockers.map((o) => o.x + o.width)) + pad,
    canvas,
    MIN_ENDPOINT_STUB,
  );
  const raw = [
    normalizeOrthogonalPolyline(hvPath(from, to), from, to),
    normalizeOrthogonalPolyline(vhPath(from, to), from, to),
    normalizeOrthogonalPolyline(
      [from, { x: from.x, y: top }, { x: to.x, y: top }, to],
      from,
      to,
    ),
    normalizeOrthogonalPolyline(
      [from, { x: from.x, y: bottom }, { x: to.x, y: bottom }, to],
      from,
      to,
    ),
    normalizeOrthogonalPolyline(
      [from, { x: left, y: from.y }, { x: left, y: to.y }, to],
      from,
      to,
    ),
    normalizeOrthogonalPolyline(
      [from, { x: right, y: from.y }, { x: right, y: to.y }, to],
      from,
      to,
    ),
  ];
  return raw.filter(
    (pts) =>
      pts.length >= 2 &&
      isOrthogonalPolyline(pts) &&
      a3BoundaryViolationReasons(pts).length === 0,
  );
}

function findSegmentContaining(
  points: Point[],
  p: Point,
): { a: Point; b: Point; index: number } | null {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const h = Math.abs(a.y - b.y) <= ORTHO_EPS;
    const v = Math.abs(a.x - b.x) <= ORTHO_EPS;
    if (h) {
      const lo = Math.min(a.x, b.x);
      const hi = Math.max(a.x, b.x);
      if (Math.abs(p.y - (a.y + b.y) / 2) <= 1.2 && p.x > lo + 0.35 && p.x < hi - 0.35) {
        return { a, b, index: i - 1 };
      }
    } else if (v) {
      const lo = Math.min(a.y, b.y);
      const hi = Math.max(a.y, b.y);
      if (Math.abs(p.x - (a.x + b.x) / 2) <= 1.2 && p.y > lo + 0.35 && p.y < hi - 0.35) {
        return { a, b, index: i - 1 };
      }
    }
  }
  return null;
}

export function isSafeBridgePlacement(
  point: Point,
  jumperPoints: Point[],
  extras?: {
    otherVertices?: Point[];
    junctions?: Point[];
    keepOuts?: Rect[];
    radius?: number;
    margin?: number;
  },
): boolean {
  const radius = extras?.radius ?? BRIDGE_RADIUS_PX;
  const margin = extras?.margin ?? BRIDGE_SAFE_MARGIN;
  const need = radius + margin;
  const seg = findSegmentContaining(jumperPoints, point);
  if (!seg) return false;
  if (segLen(seg.a, seg.b) <= minBridgeSegmentLength(radius, margin)) return false;
  if (segLen(point, seg.a) < need || segLen(point, seg.b) < need) return false;

  const vertices = [
    ...jumperPoints,
    ...(extras?.otherVertices ?? []),
    ...(extras?.junctions ?? []),
  ];
  for (const v of vertices) {
    if (Math.hypot(point.x - v.x, point.y - v.y) < need) return false;
  }
  for (const box of extras?.keepOuts ?? []) {
    if (distancePointToRect(point, box) < margin) return false;
  }
  if (jumperPoints.length >= 2) {
    const target = jumperPoints[jumperPoints.length - 1]!;
    if (Math.hypot(point.x - target.x, point.y - target.y) < MIN_ARROW_APPROACH) {
      return false;
    }
    const source = jumperPoints[0]!;
    if (Math.hypot(point.x - source.x, point.y - source.y) < MIN_ENDPOINT_STUB) {
      return false;
    }
  }
  return true;
}

export function crossingPointsOf(
  points: Point[],
  others: Point[][],
): Point[] {
  const hits: Point[] = [];
  for (const other of others) {
    for (let i = 1; i < points.length; i++) {
      for (let j = 1; j < other.length; j++) {
        const a1 = points[i - 1]!;
        const a2 = points[i]!;
        const b1 = other[j - 1]!;
        const b2 = other[j]!;
        const aH = Math.abs(a1.y - a2.y) <= 1.1;
        const aV = Math.abs(a1.x - a2.x) <= 1.1;
        const bH = Math.abs(b1.y - b2.y) <= 1.1;
        const bV = Math.abs(b1.x - b2.x) <= 1.1;
        if (!(aH && bV) && !(aV && bH)) continue;
        const h1 = aH ? a1 : b1;
        const h2 = aH ? a2 : b2;
        const v1 = aH ? b1 : a1;
        const v2 = aH ? b2 : a2;
        const y = (h1.y + h2.y) / 2;
        const x = (v1.x + v2.x) / 2;
        const onH = x > Math.min(h1.x, h2.x) + 0.35 && x < Math.max(h1.x, h2.x) - 0.35;
        const onV = y > Math.min(v1.y, v2.y) + 0.35 && y < Math.max(v1.y, v2.y) - 0.35;
        if (onH && onV) hits.push({ x, y });
      }
    }
  }
  return hits;
}

function routeCrossingsAreSafe(
  points: Point[],
  prior: Point[][],
  obstacles: RouteObstacle[],
  ignoreIds: Set<string>,
  junctions: Point[],
): boolean {
  const hits = crossingPointsOf(points, prior);
  if (hits.length === 0) return true;
  const keepOuts = obstacles
    .filter((o) => !ignoreIds.has(o.id))
    .map((o) => keepOutRect(o));
  const otherVertices = prior.flat();
  return hits.every((hit) =>
    isSafeBridgePlacement(hit, points, {
      otherVertices,
      junctions,
      keepOuts,
    }),
  );
}

export function selectBestOrthogonalRoute(input: {
  source: RouteObstacle;
  target: RouteObstacle;
  sourceEdge: EdgeSide;
  targetEdge: EdgeSide;
  obstacles: RouteObstacle[];
  canvas?: RouteCanvas;
  stub?: number;
  clearance?: number;
  priorRoutes?: Point[][];
  junctions?: Point[];
  sourcePin?: Point;
  targetPin?: Point;
}): Point[] | null {
  const ignore = new Set([input.source.id, input.target.id]);
  const candidates = generateOrthogonalCandidates(input);
  if (candidates.length === 0) return null;
  const prior = input.priorRoutes ?? [];
  const junctions = input.junctions ?? [];
  const sourcePin = input.sourcePin ?? edgeMidpoint(input.source, input.sourceEdge);
  const targetPin = input.targetPin ?? edgeMidpoint(input.target, input.targetEdge);
  const scored = candidates.map((points, index) => {
    const crossings = countRouteCrossings(points, prior);
    const { score, hitsObstacle } = scoreOrthogonalRoute(
      points,
      input.obstacles,
      ignore,
      {
        clearance: input.clearance,
        crossingCount: crossings,
        stub: input.stub,
        approach: MIN_ARROW_APPROACH,
      },
    );
    const unsafeBridge = !routeCrossingsAreSafe(
      points,
      prior,
      input.obstacles,
      ignore,
      junctions,
    );
    const validation = validateOrthogonalRoute({
      points,
      sourcePin,
      targetPin,
      obstacles: input.obstacles,
      sourceCardId: input.source.id,
      targetCardId: input.target.id,
      clearance: 0,
    });
    return { points, score, hitsObstacle, unsafeBridge, index, validation };
  });

  const legal = scored.filter((row) => row.validation.ok);
  const pool = legal;
  pool.sort((a, b) => {
    if (a.hitsObstacle !== b.hitsObstacle) return a.hitsObstacle ? 1 : -1;
    if (a.unsafeBridge !== b.unsafeBridge) return a.unsafeBridge ? 1 : -1;
    if (a.score !== b.score) return a.score - b.score;
    return a.index - b.index;
  });
  return pool[0]?.points ?? null;
}

export function selectBestPointToPointRoute(
  from: Point,
  to: Point,
  obstacles: RouteObstacle[],
  ignoreIds: Set<string>,
  canvas?: RouteCanvas,
): Point[] {
  const candidates = generatePointToPointCandidates(
    from,
    to,
    obstacles,
    ignoreIds,
    canvas ?? defaultRouteCanvas(),
  );
  if (candidates.length === 0) {
    return normalizeOrthogonalPolyline(hvPath(from, to), from, to);
  }
  const scored = candidates.map((points, index) => {
    const { score, hitsObstacle } = scoreOrthogonalRoute(
      points,
      obstacles,
      ignoreIds,
    );
    return { points, score, hitsObstacle, index };
  });
  scored.sort((a, b) => {
    if (a.hitsObstacle !== b.hitsObstacle) return a.hitsObstacle ? 1 : -1;
    if (a.score !== b.score) return a.score - b.score;
    return a.index - b.index;
  });
  return scored[0]!.points;
}

export function branchExitPoint(
  branch: Point,
  sourceEdge: EdgeSide,
  spacing = BRANCH_EXIT_SPACING,
): Point {
  return outwardPoint(branch, sourceEdge, spacing);
}

export function clearBranchPoint(
  branch: Point,
  cards: Rect[],
  prefer: Point,
  minClearance = MIN_BRANCH_CLEARANCE,
): Point {
  let p = { x: branch.x, y: branch.y };
  const px = Math.sign(prefer.x);
  const py = Math.sign(prefer.y);
  for (let iter = 0; iter < 16; iter++) {
    let worst: { card: Rect; dist: number } | null = null;
    for (const card of cards) {
      const d = distancePointToRect(p, card);
      if (d < minClearance && (!worst || d < worst.dist)) {
        worst = { card, dist: d };
      }
    }
    if (!worst) break;
    const card = worst.card;
    const left = card.x - minClearance;
    const right = card.x + card.width + minClearance;
    const top = card.y - minClearance;
    const bottom = card.y + card.height + minClearance;
    const options: Point[] = [
      { x: p.x, y: top },
      { x: p.x, y: bottom },
      { x: left, y: p.y },
      { x: right, y: p.y },
    ];
    let best = options[0]!;
    let bestScore = -Infinity;
    for (const opt of options) {
      const clear = distancePointToRect(opt, card);
      const preferDot = (opt.x - p.x) * px + (opt.y - p.y) * py;
      const score = (clear >= minClearance ? 10_000 : clear * 40) + preferDot;
      if (score > bestScore) {
        bestScore = score;
        best = opt;
      }
    }
    if (samePoint(best, p, 0.05)) {
      p = { x: p.x + (px || 1) * 2, y: p.y + py * 2 };
    } else {
      p = best;
    }
  }
  return p;
}

export function routeFromBranchToChild(input: {
  branch: Point;
  sourceEdge: EdgeSide;
  child: RelatedDiagramCard;
  targetEdge: EdgeSide;
  obstacles: RouteObstacle[];
  canvas?: RouteCanvas;
}): Point[] {
  const canvas = input.canvas ?? defaultRouteCanvas();
  const pin = edgeMidpoint(input.child.layout, input.targetEdge);
  const approach = outwardPoint(pin, input.targetEdge, MIN_ARROW_APPROACH);
  const ignore = new Set([input.child.id]);
  const mid = selectBestPointToPointRoute(
    input.branch,
    approach,
    input.obstacles,
    ignore,
    canvas,
  );
  const points = normalizeOrthogonalPolyline(
    [input.branch, ...mid, pin],
    input.branch,
    pin,
  );
  if (firstSegmentLength(points) + 0.01 >= BRANCH_EXIT_SPACING) return points;
  const dx = approach.x - input.branch.x;
  const dy = approach.y - input.branch.y;
  const toward: EdgeSide =
    Math.abs(dx) >= Math.abs(dy)
      ? dx >= 0
        ? "right"
        : "left"
      : dy >= 0
        ? "bottom"
        : "top";
  const spaced = branchExitPoint(input.branch, toward, BRANCH_EXIT_SPACING);
  const detoured = selectBestPointToPointRoute(
    spaced,
    approach,
    input.obstacles,
    ignore,
    canvas,
  );
  return normalizeOrthogonalPolyline(
    [input.branch, ...detoured, pin],
    input.branch,
    pin,
  );
}

export function routeCardToBranch(input: {
  source: RelatedDiagramCard;
  sourceEdge: EdgeSide;
  branch: Point;
  obstacles: RouteObstacle[];
  canvas?: RouteCanvas;
}): Point[] {
  const canvas = input.canvas ?? defaultRouteCanvas();
  const pin = edgeMidpoint(input.source.layout, input.sourceEdge);
  const stub = outwardPoint(pin, input.sourceEdge, MIN_ENDPOINT_STUB);
  const ignore = new Set([input.source.id]);
  const mid = selectBestPointToPointRoute(
    stub,
    input.branch,
    input.obstacles,
    ignore,
    canvas,
  );
  return normalizeOrthogonalPolyline([pin, ...mid], pin, input.branch);
}

export function slideOrthogonalRail(
  value: number,
  axis: "x" | "y",
  from: number,
  to: number,
  obstacles: RouteObstacle[],
  ignoreIds: Set<string>,
  canvas: RouteCanvas,
  direction: 1 | -1,
  clearance = CARD_ROUTE_CLEARANCE,
): number {
  let cur = value;
  const min = axis === "x" ? canvas.x + 8 : canvas.y + 8;
  const max =
    axis === "x" ? canvas.x + canvas.width - 8 : canvas.y + canvas.height - 8;
  for (let i = 0; i < 48; i++) {
    const a = axis === "x" ? { x: cur, y: from } : { x: from, y: cur };
    const b = axis === "x" ? { x: cur, y: to } : { x: to, y: cur };
    const hit = polylineViolatesKeepOuts([a, b], obstacles, ignoreIds, clearance);
    if (!hit) return cur;
    cur += direction * 8;
    if (cur < min || cur > max) return clamp(cur, min, max);
  }
  return clamp(cur, min, max);
}

export function authoredRouteNeedsReroute(
  points: Point[],
  source: RouteObstacle,
  target: RouteObstacle,
  obstacles: RouteObstacle[],
): boolean {
  const ignore = new Set([source.id, target.id]);
  const sp = points[0];
  const tp = points[points.length - 1];
  if (!sp || !tp) return true;
  const srcPin = edgeMidpoint(source, guessEdgeFromPin(source, sp));
  const tgtPin = edgeMidpoint(target, guessEdgeFromPin(target, tp));
  if (!samePoint(sp, srcPin, 1.2) || !samePoint(tp, tgtPin, 1.2)) return true;
  if (!isOrthogonalPolyline(points)) return true;
  if (polylineViolatesKeepOuts(points, obstacles, ignore)) return true;
  return false;
}

function guessEdgeFromPin(box: Rect, pin: Point): EdgeSide {
  const midTop = { x: box.x + box.width / 2, y: box.y };
  const midRight = { x: box.x + box.width, y: box.y + box.height / 2 };
  const midBottom = { x: box.x + box.width / 2, y: box.y + box.height };
  const midLeft = { x: box.x, y: box.y + box.height / 2 };
  const opts: [EdgeSide, Point][] = [
    ["top", midTop],
    ["right", midRight],
    ["bottom", midBottom],
    ["left", midLeft],
  ];
  let best: EdgeSide = "right";
  let bestD = Infinity;
  for (const [side, p] of opts) {
    const d = Math.hypot(pin.x - p.x, pin.y - p.y);
    if (d < bestD) {
      bestD = d;
      best = side;
    }
  }
  return best;
}

export function debugKeepOuts(
  cards: RelatedDiagramCard[],
  clearance = CARD_ROUTE_CLEARANCE,
): (Rect & { id: string })[] {
  return cards.map((card) => ({ id: card.id, ...keepOutRect(card.layout, clearance) }));
}

export function bridgesNeedReroute(
  bridges: CrossingBridge[],
  routes: { connectionId: string; points: Point[] }[],
  obstacles: RouteObstacle[],
  junctions: Point[],
): boolean {
  const byId = new Map(routes.map((r) => [r.connectionId, r.points]));
  const keepOuts = obstacles.map((o) => keepOutRect(o));
  for (const br of bridges) {
    const jumper = byId.get(br.jumperConnectionId);
    if (!jumper) continue;
    if (
      !isSafeBridgePlacement({ x: br.x, y: br.y }, jumper, {
        otherVertices: routes
          .filter((r) => r.connectionId !== br.jumperConnectionId)
          .flatMap((r) => r.points),
        junctions,
        keepOuts,
      })
    ) {
      return true;
    }
  }
  return false;
}
