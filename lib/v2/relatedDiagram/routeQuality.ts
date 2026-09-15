/**
 * Final route quality gate for Slice 2A.
 * Geometric legality is not enough — the adopted route must stay readable.
 * Does not change pathfinding, topology, or the frozen bridge renderer.
 */

import { A3_HEIGHT_PX, A3_WIDTH_PX } from "./a3Canvas";
import {
  evaluateBridgeFeasibility,
  MIN_BEND_BRIDGE_DISTANCE,
  MIN_BRIDGE_TO_BRIDGE_DISTANCE,
  MIN_JUNCTION_BRIDGE_DISTANCE,
} from "./geometryGuard";
import { countBends, type Point } from "./orthogonalRouting";
import {
  listCrossingSites,
  MAX_FINAL_DETOUR_RATIO,
  MAX_REASONABLE_DETOUR_RATIO,
  PREFERRED_MAX_CROSSINGS,
  polylineManhattan,
  scoreCongestedRoute,
  semanticDetourBaseline,
  type CongestionContext,
} from "./routeCongestion";
import { MIN_ARROW_APPROACH, MIN_ENDPOINT_STUB } from "./routeHardening";

export const HARD_MAX_CROSSINGS = 2;
export const MAX_FINAL_BENDS = 6;
export const FAN_SEMANTIC_BEND_EXTRA = 2;
export const CROSS_CANVAS_SPAN_RATIO = 3;
export const CROSS_CANVAS_AREA_RATIO = 6;
export const CROSS_CANVAS_MIN_SPAN = 80;
export const CROSS_CANVAS_EXTRA_PX = 180;
export const FAN_SIBLING_LENGTH_BUDGET = 160;

export type QualityClass = 0 | 1 | 2 | "reject";

export type RouteBBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type RouteQualityReport = {
  legal: boolean;
  hardReasons: string[];
  qualityReasons: string[];
  class: QualityClass;
  length: number;
  directLength: number;
  detourRatio: number;
  crossings: number;
  bends: number;
  bendBudget: number;
  bridgeCount: number;
  unsafeBridgeReasons: string[];
  routeBBox: RouteBBox;
  crossCanvasRatioX: number;
  crossCanvasRatioY: number;
  crossCanvasAreaRatio: number;
  crossCanvas: boolean;
  safeSingleBridge: boolean;
  congestion: number;
};

export type RouteQualityTrace = {
  connectionId: string;
  length: number;
  directLength: number;
  detourRatio: number;
  crossingCount: number;
  bendCount: number;
  bridgeCount: number;
  unsafeBridgeReasons: string[];
  routeBBox: RouteBBox;
  crossCanvasRatio: { x: number; y: number; area: number };
  selectedClass: QualityClass;
  fallbackReason?: string;
  lastValidUsed: boolean;
  bpRelocated: boolean;
};

export function pointsBBox(points: Point[]): RouteBBox {
  if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  let minX = points[0]!.x;
  let maxX = points[0]!.x;
  let minY = points[0]!.y;
  let maxY = points[0]!.y;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function bendBudgetForRoute(branchPoint?: Point): number {
  return MAX_FINAL_BENDS + (branchPoint ? FAN_SEMANTIC_BEND_EXTRA : 0);
}

export function crossCanvasMetrics(
  routePoints: Point[],
  sourcePin: Point,
  targetPin: Point,
): {
  routeBBox: RouteBBox;
  ratioX: number;
  ratioY: number;
  areaRatio: number;
  sourceTargetSpansCanvas: boolean;
  reject: boolean;
} {
  const evalPoints = routePoints.length ? routePoints : [sourcePin, targetPin];
  const routeBBox = pointsBBox(evalPoints);
  const rawX = Math.abs(sourcePin.x - targetPin.x);
  const rawY = Math.abs(sourcePin.y - targetPin.y);
  const directSpanX = Math.max(rawX, CROSS_CANVAS_MIN_SPAN);
  const directSpanY = Math.max(rawY, CROSS_CANVAS_MIN_SPAN);
  const directArea = directSpanX * directSpanY;
  const routeSpanX = Math.max(routeBBox.width, 1);
  const routeSpanY = Math.max(routeBBox.height, 1);
  const ratioX = routeSpanX / directSpanX;
  const ratioY = routeSpanY / directSpanY;
  const areaRatio = (routeSpanX * routeSpanY) / directArea;
  const sourceTargetSpansCanvas =
    rawX > A3_WIDTH_PX * 0.45 || rawY > A3_HEIGHT_PX * 0.45;
  if (sourceTargetSpansCanvas) {
    return {
      routeBBox,
      ratioX,
      ratioY,
      areaRatio,
      sourceTargetSpansCanvas,
      reject: false,
    };
  }
  const blownX =
    ratioX > CROSS_CANVAS_SPAN_RATIO &&
    routeSpanX > rawX + CROSS_CANVAS_EXTRA_PX;
  const blownY =
    ratioY > CROSS_CANVAS_SPAN_RATIO &&
    routeSpanY > rawY + CROSS_CANVAS_EXTRA_PX;
  const blownArea =
    areaRatio > CROSS_CANVAS_AREA_RATIO &&
    (ratioX > 2.2 || ratioY > 2.2) &&
    (routeSpanX > rawX + CROSS_CANVAS_EXTRA_PX ||
      routeSpanY > rawY + CROSS_CANVAS_EXTRA_PX);
  return {
    routeBBox,
    ratioX,
    ratioY,
    areaRatio,
    sourceTargetSpansCanvas,
    reject: blownX || blownY || blownArea,
  };
}

function crossingUnsafeReasons(
  points: Point[],
  ctx: CongestionContext,
): { crossings: number; reasons: string[] } {
  const sites = listCrossingSites(points, ctx);
  const reasons: string[] = [];
  const start = points[0];
  const goal = points[points.length - 1];
  for (const hit of sites) {
    const report = evaluateBridgeFeasibility({
      bridge: {
        jumperConnectionId: "__candidate__",
        underConnectionId: hit.otherId,
        x: hit.x,
        y: hit.y,
      },
      jumperPoints: points,
      siblingBridges: ctx.bridges.map((p, i) => ({
        jumperConnectionId: `__b${i}`,
        underConnectionId: "__u",
        x: p.x,
        y: p.y,
      })),
      junctions: ctx.junctions,
    });
    reasons.push(...report.reasons);
    const edgeLen =
      Math.abs(hit.b.x - hit.a.x) + Math.abs(hit.b.y - hit.a.y);
    const toA = Math.abs(hit.x - hit.a.x) + Math.abs(hit.y - hit.a.y);
    const toB = Math.abs(hit.b.x - hit.x) + Math.abs(hit.b.y - hit.y);
    if (toA < MIN_BEND_BRIDGE_DISTANCE || toB < MIN_BEND_BRIDGE_DISTANCE) {
      reasons.push("bridge-bend");
    }
    if (edgeLen < MIN_BRIDGE_TO_BRIDGE_DISTANCE) {
      reasons.push("bridge-density");
    }
    if (start && goal) {
      if (
        Math.hypot(hit.x - start.x, hit.y - start.y) < MIN_ENDPOINT_STUB ||
        Math.hypot(hit.x - goal.x, hit.y - goal.y) < MIN_ARROW_APPROACH
      ) {
        reasons.push("unrenderable-bridge");
      }
    }
    for (const j of ctx.junctions) {
      if (Math.hypot(j.x - hit.x, j.y - hit.y) < MIN_JUNCTION_BRIDGE_DISTANCE) {
        reasons.push("bridge-junction");
      }
    }
  }
  return { crossings: sites.length, reasons: [...new Set(reasons)] };
}

function isSafeSingleBridge(
  crossings: number,
  unsafe: string[],
  points: Point[],
  ctx: CongestionContext,
): boolean {
  if (crossings !== PREFERRED_MAX_CROSSINGS) return false;
  if (unsafe.length > 0) return false;
  const sites = listCrossingSites(points, ctx);
  const hit = sites[0];
  if (!hit) return false;
  const edgeLen =
    Math.abs(hit.b.x - hit.a.x) + Math.abs(hit.b.y - hit.a.y);
  const toA = Math.abs(hit.x - hit.a.x) + Math.abs(hit.y - hit.a.y);
  const toB = Math.abs(hit.b.x - hit.x) + Math.abs(hit.b.y - hit.y);
  return (
    edgeLen >= 80 &&
    toA >= MIN_BEND_BRIDGE_DISTANCE &&
    toB >= MIN_BEND_BRIDGE_DISTANCE
  );
}

export function evaluateRouteQuality(input: {
  points: Point[];
  sourcePin: Point;
  targetPin: Point;
  congestion: CongestionContext;
  hardReasons?: string[];
  branchPoint?: Point;
  localityPoints?: Point[];
}): RouteQualityReport {
  const hardReasons = [...(input.hardReasons ?? [])];
  const scored = scoreCongestedRoute(input.points, input.congestion);
  const hops = crossingUnsafeReasons(input.points, input.congestion);
  const crossings = hops.crossings;
  const unsafeBridgeReasons = hops.reasons;
  const length = polylineManhattan(input.points);
  const directLength = semanticDetourBaseline(
    input.sourcePin,
    input.targetPin,
    input.branchPoint,
  );
  const detour = length / Math.max(1, directLength);
  const bends = countBends(input.points);
  const budget = bendBudgetForRoute(input.branchPoint);
  const canvas = crossCanvasMetrics(
    input.localityPoints ?? input.points,
    input.localityPoints
      ? input.localityPoints[0] ?? input.sourcePin
      : input.sourcePin,
    input.localityPoints
      ? input.localityPoints[input.localityPoints.length - 1] ?? input.targetPin
      : input.targetPin,
  );
  const qualityReasons: string[] = [];
  if (crossings > HARD_MAX_CROSSINGS) qualityReasons.push("excessive-crossings");
  if (bends > budget) qualityReasons.push("excessive-bends");
  if (detour > MAX_FINAL_DETOUR_RATIO + 0.001) {
    qualityReasons.push("excessive-detour");
  }
  if (canvas.reject) qualityReasons.push("cross-canvas-detour");
  qualityReasons.push(
    ...unsafeBridgeReasons.filter((r) =>
      [
        "unrenderable-bridge",
        "bridge-bend",
        "bridge-junction",
        "bridge-density",
        "bridge-cluster",
        "a3-boundary-violation",
      ].includes(r),
    ),
  );
  const uniqueQuality = [...new Set(qualityReasons)];
  const legal = hardReasons.length === 0;
  const safeSingle = isSafeSingleBridge(
    crossings,
    uniqueQuality.filter((r) => r.startsWith("bridge") || r === "unrenderable-bridge"),
    input.points,
    input.congestion,
  );
  let cls: QualityClass = "reject";
  if (legal && uniqueQuality.length === 0) {
    if (crossings === 0 && detour <= MAX_REASONABLE_DETOUR_RATIO) {
      cls = 0;
    } else if (crossings === 0 && detour <= MAX_FINAL_DETOUR_RATIO) {
      cls = 1;
    } else if (crossings === 1 && unsafeBridgeReasons.length === 0) {
      cls = 1;
    } else if (crossings === 2 && unsafeBridgeReasons.length === 0) {
      cls = 2;
    } else {
      cls = "reject";
    }
  }
  return {
    legal,
    hardReasons,
    qualityReasons: uniqueQuality,
    class: cls,
    length,
    directLength,
    detourRatio: detour,
    crossings,
    bends,
    bendBudget: budget,
    bridgeCount: crossings,
    unsafeBridgeReasons,
    routeBBox: canvas.routeBBox,
    crossCanvasRatioX: canvas.ratioX,
    crossCanvasRatioY: canvas.ratioY,
    crossCanvasAreaRatio: canvas.areaRatio,
    crossCanvas: canvas.reject,
    safeSingleBridge: safeSingle,
    congestion: scored.congestion,
  };
}

function classRank(cls: QualityClass): number {
  if (cls === 0) return 0;
  if (cls === 1) return 1;
  if (cls === 2) return 2;
  return 9;
}

export function compareQualityReports(
  a: RouteQualityReport,
  b: RouteQualityReport,
): number {
  const ra = classRank(a.class);
  const rb = classRank(b.class);
  if (ra !== rb) return ra - rb;
  if (a.length !== b.length) return a.length - b.length;
  if (a.bends !== b.bends) return a.bends - b.bends;
  if (a.congestion !== b.congestion) return a.congestion - b.congestion;
  return a.detourRatio - b.detourRatio;
}

export function selectQualityCandidate<T>(
  items: T[],
  reportOf: (item: T) => RouteQualityReport,
): T | null {
  if (items.length === 0) return null;
  const scored = items.map((item) => ({ item, report: reportOf(item) }));
  scored.sort((a, b) => compareQualityReports(a.report, b.report));
  const best = scored[0];
  if (!best) return null;
  if (best.report.class === "reject") {
    const legal = scored
      .filter((s) => s.report.legal)
      .sort((a, b) => a.report.length - b.report.length)[0];
    return legal?.item ?? best.item;
  }
  return best.item;
}

export function qualityNeedsFanRelocation(report: RouteQualityReport): boolean {
  if (report.crossings >= HARD_MAX_CROSSINGS) return true;
  if (report.crossCanvas) return true;
  return report.qualityReasons.some((r) =>
    [
      "bridge-density",
      "bridge-bend",
      "bridge-junction",
      "bridge-cluster",
      "cross-canvas-detour",
      "excessive-bends",
      "excessive-crossings",
    ].includes(r),
  );
}

export function siblingWorsenedTooMuch(
  previousLen: number,
  nextLen: number,
  budget = FAN_SIBLING_LENGTH_BUDGET,
): boolean {
  return nextLen > previousLen + budget + 0.001;
}

export function toQualityTrace(
  connectionId: string,
  report: RouteQualityReport,
  extra: {
    fallbackReason?: string;
    lastValidUsed: boolean;
    bpRelocated: boolean;
  },
): RouteQualityTrace {
  return {
    connectionId,
    length: report.length,
    directLength: report.directLength,
    detourRatio: report.detourRatio,
    crossingCount: report.crossings,
    bendCount: report.bends,
    bridgeCount: report.bridgeCount,
    unsafeBridgeReasons: report.unsafeBridgeReasons,
    routeBBox: report.routeBBox,
    crossCanvasRatio: {
      x: report.crossCanvasRatioX,
      y: report.crossCanvasRatioY,
      area: report.crossCanvasAreaRatio,
    },
    selectedClass: report.class,
    fallbackReason: extra.fallbackReason,
    lastValidUsed: extra.lastValidUsed,
    bpRelocated: extra.bpRelocated,
  };
}

export function formatQualityDebug(trace: RouteQualityTrace): string {
  const box = `${Math.round(trace.routeBBox.width)}x${Math.round(trace.routeBBox.height)}`;
  const cc = `${trace.crossCanvasRatio.x.toFixed(1)}/${trace.crossCanvasRatio.y.toFixed(1)}`;
  const bits = [
    `${trace.connectionId}`,
    `L${Math.round(trace.length)}/${Math.round(trace.directLength)}`,
    `d${trace.detourRatio.toFixed(2)}`,
    `x${trace.crossingCount}`,
    `b${trace.bendCount}`,
    `br${trace.bridgeCount}`,
    `bb${box}`,
    `cc${cc}`,
    `c${trace.selectedClass}`,
  ];
  if (trace.fallbackReason) bits.push(trace.fallbackReason);
  if (trace.lastValidUsed) bits.push("lastValid");
  if (trace.bpRelocated) bits.push("bpMove");
  if (trace.unsafeBridgeReasons[0]) bits.push(trace.unsafeBridgeReasons[0]);
  return bits.join(" ");
}
