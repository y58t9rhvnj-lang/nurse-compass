/**
 * Complexity / congestion scoring for affected-route pathfinding.
 * Existing routes are soft obstacles. Cards / Legend stay hard.
 * Does not replan the full graph or move unrelated geometry.
 */

import {
  evaluateBridgeFeasibility,
  MIN_BEND_BRIDGE_DISTANCE,
  MIN_BRIDGE_TO_BRIDGE_DISTANCE,
  MIN_JUNCTION_BRIDGE_DISTANCE,
} from "./geometryGuard";
import {
  properSegmentCrossing,
  type EdgeSide,
  type Point,
} from "./orthogonalRouting";
import {
  MIN_ARROW_APPROACH,
  MIN_ENDPOINT_STUB,
  minBridgeSegmentLength,
} from "./routeHardening";

export const ROUTE_SOFT_CLEARANCE = 12;
export const MIN_PARALLEL_ROUTE_GAP = 14;
export const PREFERRED_MAX_CROSSINGS = 1;
export const MAX_REASONABLE_DETOUR_RATIO = 2.0;
export const MAX_FINAL_DETOUR_RATIO = 3.0;
export const BRIDGE_REROUTE_EXTRA_BUDGET = 320;
export const FAN_BP_RELOCATION_DETOUR_THRESHOLD = 2.0;
export const TINY_DOGLEG_THRESHOLD = 10;
export const ALTERNATE_SCORE_MARGIN = 280;

const EPS = 0.51;
const PARALLEL_EXACT_PENALTY = 720;
const PARALLEL_GAP_WEIGHT = 28;
const SOFT_NEAR_WEIGHT = 18;
const CONGESTION_PER_ROUTE = 36;
const INFEASIBLE_CROSSING_PENALTY = 900;
const EXISTING_BRIDGE_PENALTY = 480;
const SHORT_CROSSING_PENALTY = 640;
const ENDPOINT_CROSSING_PENALTY = 520;
const BEND_CROSSING_PENALTY = 360;
const JUNCTION_CROSSING_PENALTY = 480;

export type SoftRoute = {
  connectionId: string;
  points: Point[];
  groupId?: string;
};

export type CongestionContext = {
  routes: SoftRoute[];
  exemptIds: Set<string>;
  bridges: Point[];
  junctions: Point[];
};

export function crossingCost(count: number): number {
  if (count <= 0) return 0;
  if (count === 1) return 320;
  if (count === 2) return 800;
  return 1500 + (count - 3) * 900;
}

export function polylineManhattan(points: Point[]): number {
  let n = 0;
  for (let i = 1; i < points.length; i++) {
    n +=
      Math.abs(points[i]!.x - points[i - 1]!.x) +
      Math.abs(points[i]!.y - points[i - 1]!.y);
  }
  return n;
}

function segLen(a: Point, b: Point): number {
  return Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
}

function horiz(a: Point, b: Point): boolean {
  return Math.abs(a.y - b.y) <= EPS;
}

function vert(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) <= EPS;
}

export function distancePointToSegment(p: Point, a: Point, b: Point): number {
  if (horiz(a, b)) {
    const lo = Math.min(a.x, b.x);
    const hi = Math.max(a.x, b.x);
    const x = Math.min(hi, Math.max(lo, p.x));
    return Math.hypot(p.x - x, p.y - a.y);
  }
  if (vert(a, b)) {
    const lo = Math.min(a.y, b.y);
    const hi = Math.max(a.y, b.y);
    const y = Math.min(hi, Math.max(lo, p.y));
    return Math.hypot(p.x - a.x, p.y - y);
  }
  return Math.hypot(p.x - a.x, p.y - a.y);
}

function rangeOverlap(
  a1: number,
  a2: number,
  b1: number,
  b2: number,
): number {
  const lo = Math.max(Math.min(a1, a2), Math.min(b1, b2));
  const hi = Math.min(Math.max(a1, a2), Math.max(b1, b2));
  return Math.max(0, hi - lo);
}

export function parallelGap(a1: Point, a2: Point, b1: Point, b2: Point): number | null {
  if (horiz(a1, a2) && horiz(b1, b2)) {
    if (rangeOverlap(a1.x, a2.x, b1.x, b2.x) <= EPS) return null;
    return Math.abs(a1.y - b1.y);
  }
  if (vert(a1, a2) && vert(b1, b2)) {
    if (rangeOverlap(a1.y, a2.y, b1.y, b2.y) <= EPS) return null;
    return Math.abs(a1.x - b1.x);
  }
  return null;
}

function activeRoutes(ctx: CongestionContext): SoftRoute[] {
  return ctx.routes.filter((r) => !ctx.exemptIds.has(r.connectionId));
}

export function listCrossingSites(
  points: Point[],
  ctx: CongestionContext,
): Array<{ x: number; y: number; otherId: string; a: Point; b: Point }> {
  const out: Array<{ x: number; y: number; otherId: string; a: Point; b: Point }> = [];
  for (const other of activeRoutes(ctx)) {
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]!;
      const b = points[i]!;
      for (let j = 1; j < other.points.length; j++) {
        const hit = properSegmentCrossing(a, b, other.points[j - 1]!, other.points[j]!);
        if (hit) out.push({ ...hit, otherId: other.connectionId, a, b });
      }
    }
  }
  return out;
}

export function countSoftCrossings(points: Point[], ctx: CongestionContext): number {
  return listCrossingSites(points, ctx).length;
}

export function parallelPenalty(a: Point, b: Point, ctx: CongestionContext): number {
  let best = 0;
  for (const other of activeRoutes(ctx)) {
    for (let i = 1; i < other.points.length; i++) {
      const gap = parallelGap(a, b, other.points[i - 1]!, other.points[i]!);
      if (gap == null) continue;
      if (gap <= 0.35) best = Math.max(best, PARALLEL_EXACT_PENALTY);
      else if (gap < MIN_PARALLEL_ROUTE_GAP) {
        best = Math.max(
          best,
          (MIN_PARALLEL_ROUTE_GAP - gap) * PARALLEL_GAP_WEIGHT,
        );
      }
    }
  }
  return best;
}

export function softClearancePenalty(a: Point, b: Point, ctx: CongestionContext): number {
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  let nearest = Infinity;
  for (const other of activeRoutes(ctx)) {
    for (let i = 1; i < other.points.length; i++) {
      nearest = Math.min(
        nearest,
        distancePointToSegment(mid, other.points[i - 1]!, other.points[i]!),
      );
    }
  }
  if (!Number.isFinite(nearest) || nearest >= ROUTE_SOFT_CLEARANCE) return 0;
  return (ROUTE_SOFT_CLEARANCE - nearest) * SOFT_NEAR_WEIGHT;
}

export function congestionCount(a: Point, b: Point, ctx: CongestionContext): number {
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  let n = 0;
  for (const other of activeRoutes(ctx)) {
    let near = false;
    for (let i = 1; i < other.points.length; i++) {
      if (
        distancePointToSegment(mid, other.points[i - 1]!, other.points[i]!) <
        ROUTE_SOFT_CLEARANCE
      ) {
        near = true;
        break;
      }
    }
    if (near) n += 1;
  }
  return n;
}

function crossingSitePenalty(
  hit: Point,
  a: Point,
  b: Point,
  ctx: CongestionContext,
  pathEnds?: { start: Point; goal: Point },
): number {
  let extra = 0;
  const edgeLen = segLen(a, b);
  if (edgeLen <= minBridgeSegmentLength()) extra += SHORT_CROSSING_PENALTY;
  const toA = segLen(hit, a);
  const toB = segLen(hit, b);
  if (toA < MIN_BEND_BRIDGE_DISTANCE || toB < MIN_BEND_BRIDGE_DISTANCE) {
    extra += BEND_CROSSING_PENALTY;
  }
  if (pathEnds) {
    if (
      Math.hypot(hit.x - pathEnds.start.x, hit.y - pathEnds.start.y) <
        MIN_ENDPOINT_STUB ||
      Math.hypot(hit.x - pathEnds.goal.x, hit.y - pathEnds.goal.y) <
        MIN_ARROW_APPROACH
    ) {
      extra += ENDPOINT_CROSSING_PENALTY;
    }
  }
  for (const j of ctx.junctions) {
    if (Math.hypot(j.x - hit.x, j.y - hit.y) < MIN_JUNCTION_BRIDGE_DISTANCE) {
      extra += JUNCTION_CROSSING_PENALTY;
      break;
    }
  }
  for (const br of ctx.bridges) {
    if (Math.hypot(br.x - hit.x, br.y - hit.y) < MIN_BRIDGE_TO_BRIDGE_DISTANCE) {
      extra += EXISTING_BRIDGE_PENALTY;
      break;
    }
  }
  const hop = evaluateBridgeFeasibility({
    bridge: {
      jumperConnectionId: "__candidate__",
      underConnectionId: "__under__",
      x: hit.x,
      y: hit.y,
    },
    jumperPoints: [a, b],
    siblingBridges: ctx.bridges.map((p, i) => ({
      jumperConnectionId: `__b${i}`,
      underConnectionId: "__u",
      x: p.x,
      y: p.y,
    })),
    junctions: ctx.junctions,
  });
  if (!hop.ok) extra += INFEASIBLE_CROSSING_PENALTY;
  return extra;
}

export function existingBridgeAvoidance(a: Point, b: Point, ctx: CongestionContext): number {
  let best = 0;
  for (const br of ctx.bridges) {
    const d = distancePointToSegment(br, a, b);
    if (d < MIN_BRIDGE_TO_BRIDGE_DISTANCE) {
      best = Math.max(
        best,
        EXISTING_BRIDGE_PENALTY * (1 - d / MIN_BRIDGE_TO_BRIDGE_DISTANCE),
      );
    }
  }
  return best;
}

export function visibilityEdgeCongestionCost(
  a: Point,
  b: Point,
  ctx: CongestionContext,
  pathEnds?: { start: Point; goal: Point },
): number {
  let cost = softClearancePenalty(a, b, ctx);
  cost += parallelPenalty(a, b, ctx);
  cost += congestionCount(a, b, ctx) * CONGESTION_PER_ROUTE;
  cost += existingBridgeAvoidance(a, b, ctx);
  const hits = listCrossingSites([a, b], ctx);
  cost += crossingCost(hits.length);
  for (const hit of hits) {
    cost += crossingSitePenalty(hit, a, b, ctx, pathEnds);
  }
  return cost;
}

export function offsetRails(routes: SoftRoute[], exemptIds: Set<string>): Point[] {
  const out: Point[] = [];
  const gap = MIN_PARALLEL_ROUTE_GAP;
  for (const route of routes) {
    if (exemptIds.has(route.connectionId)) continue;
    for (const p of route.points) {
      out.push({ x: p.x - gap, y: p.y });
      out.push({ x: p.x + gap, y: p.y });
      out.push({ x: p.x, y: p.y - gap });
      out.push({ x: p.x, y: p.y + gap });
    }
  }
  return out;
}

export function sameGroupIds(
  groups: Array<{ id: string; connectionIds: string[] }> | undefined,
  connectionId: string,
): Set<string> {
  const ids = new Set<string>([connectionId]);
  for (const group of groups ?? []) {
    if (!group.connectionIds.includes(connectionId)) continue;
    for (const id of group.connectionIds) ids.add(id);
  }
  return ids;
}

export function secondaryEdgePair(
  primary: { sourceEdge: EdgeSide; targetEdge: EdgeSide },
): { sourceEdge: EdgeSide; targetEdge: EdgeSide } {
  const h =
    primary.sourceEdge === "left" || primary.sourceEdge === "right";
  return h
    ? { sourceEdge: "bottom", targetEdge: "top" }
    : { sourceEdge: "right", targetEdge: "left" };
}

export function simplifyTinyDoglegs(
  points: Point[],
  threshold = TINY_DOGLEG_THRESHOLD,
): Point[] {
  if (points.length < 4) return points.map((p) => ({ ...p }));
  const out = points.map((p) => ({ ...p }));
  let i = 1;
  while (i <= out.length - 3) {
    if (i === 1 || i === out.length - 3) {
      i += 1;
      continue;
    }
    const a = out[i - 1]!;
    const b = out[i]!;
    const c = out[i + 1]!;
    const d = out[i + 2]!;
    const jog = horiz(a, b) && vert(b, c) && horiz(c, d);
    const jogV = vert(a, b) && horiz(b, c) && vert(c, d);
    if ((jog || jogV) && segLen(b, c) > 0.2 && segLen(b, c) < threshold) {
      if (jog && Math.abs(a.y - d.y) <= threshold) {
        out.splice(i, 2, { x: d.x, y: a.y });
        continue;
      }
      if (jogV && Math.abs(a.x - d.x) <= threshold) {
        out.splice(i, 2, { x: a.x, y: d.y });
        continue;
      }
    }
    i += 1;
  }
  const cleaned: Point[] = [];
  for (const p of out) {
    const last = cleaned[cleaned.length - 1];
    if (last && Math.abs(last.x - p.x) <= 0.2 && Math.abs(last.y - p.y) <= 0.2) {
      continue;
    }
    cleaned.push(p);
  }
  if (cleaned.length >= 2) {
    cleaned[0] = { ...points[0]! };
    cleaned[cleaned.length - 1] = { ...points[points.length - 1]! };
  }
  return cleaned;
}

export function detourRatio(candidateLen: number, baselineLen: number): number {
  if (baselineLen <= 1) return 1;
  return candidateLen / baselineLen;
}

export function exceedsReasonableDetour(
  candidateLen: number,
  baselineLen: number,
): boolean {
  return detourRatio(candidateLen, baselineLen) > MAX_REASONABLE_DETOUR_RATIO + 0.001;
}

export function extraRouteLength(candidateLen: number, baselineLen: number): number {
  return Math.max(0, candidateLen - baselineLen);
}

export function withinBridgeRerouteBudget(
  candidateLen: number,
  baselineLegalLen: number,
  budget = BRIDGE_REROUTE_EXTRA_BUDGET,
): boolean {
  return extraRouteLength(candidateLen, baselineLegalLen) <= budget + 0.001;
}

export function semanticDetourBaseline(
  sourcePin: Point,
  targetPin: Point,
  branchPoint?: Point,
): number {
  const direct =
    Math.abs(sourcePin.x - targetPin.x) + Math.abs(sourcePin.y - targetPin.y);
  if (!branchPoint) return Math.max(1, direct);
  const via =
    Math.abs(sourcePin.x - branchPoint.x) +
    Math.abs(sourcePin.y - branchPoint.y) +
    Math.abs(branchPoint.x - targetPin.x) +
    Math.abs(branchPoint.y - targetPin.y);
  return Math.max(1, via);
}

export function exceedsFinalDetourRatio(
  routeLen: number,
  sourcePin: Point,
  targetPin: Point,
  branchPoint?: Point,
  maxRatio = MAX_FINAL_DETOUR_RATIO,
): boolean {
  return (
    detourRatio(routeLen, semanticDetourBaseline(sourcePin, targetPin, branchPoint)) >
    maxRatio + 0.001
  );
}

export function pickWithinBridgeBudget<T>(
  candidates: T[],
  lengthOf: (item: T) => number,
  budget = BRIDGE_REROUTE_EXTRA_BUDGET,
): T[] {
  if (candidates.length === 0) return [];
  const baseline = Math.min(...candidates.map(lengthOf));
  return candidates.filter((item) =>
    withinBridgeRerouteBudget(lengthOf(item), baseline, budget),
  );
}

export type CandidateScore = {
  score: number;
  crossings: number;
  congestion: number;
  infeasible: boolean;
  parallelHits: number;
  length: number;
  reasons: string[];
};

export function scoreCongestedRoute(
  points: Point[],
  ctx: CongestionContext,
): CandidateScore {
  const reasons: string[] = [];
  const sites = listCrossingSites(points, ctx);
  const crossings = sites.length;
  let congestion = 0;
  let parallelHits = 0;
  let infeasible = false;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    congestion += congestionCount(a, b, ctx);
    if (parallelPenalty(a, b, ctx) >= PARALLEL_EXACT_PENALTY * 0.5) parallelHits += 1;
  }
  const start = points[0]!;
  const goal = points[points.length - 1]!;
  for (const hit of sites) {
    const extra = crossingSitePenalty(hit, hit.a, hit.b, ctx, { start, goal });
    if (extra >= INFEASIBLE_CROSSING_PENALTY) infeasible = true;
  }
  if (crossings > PREFERRED_MAX_CROSSINGS) reasons.push("crossing-budget");
  if (infeasible) reasons.push("infeasible-bridge");
  if (parallelHits > 0) reasons.push("parallel-overlap");
  const length = polylineManhattan(points);
  const score =
    crossingCost(crossings) +
    congestion * (CONGESTION_PER_ROUTE / 2) +
    parallelHits * 80 +
    (infeasible ? INFEASIBLE_CROSSING_PENALTY : 0) +
    length;
  return {
    score,
    crossings,
    congestion,
    infeasible,
    parallelHits,
    length,
    reasons,
  };
}

export function isCongestedCandidate(score: CandidateScore): boolean {
  return (
    score.crossings > PREFERRED_MAX_CROSSINGS ||
    score.infeasible ||
    score.parallelHits > 0
  );
}
