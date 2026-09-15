/**
 * Orthogonal visibility graph + A* for a single affected route.
 * Never used on the full connection set.
 */

import { A3_HEIGHT_PX, A3_WIDTH_PX } from "./a3Canvas";
import {
  countRouteCrossings,
  type Point,
  type Rect,
} from "./orthogonalRouting";
import {
  A3_ROUTE_MARGIN,
  corridorForBox,
  endpointCorridorRect,
  obstacleKeepOut,
  pointInA3Hard,
  pointInA3RouteInner,
  pointInRect,
  segmentHitsSolidObstacle,
  type EndpointCorridor,
} from "./geometryGuard";
import {
  offsetRails,
  visibilityEdgeCongestionCost,
  type CongestionContext,
} from "./routeCongestion";
import {
  BEND_PENALTY,
  CARD_ROUTE_CLEARANCE,
  NEAR_CARD_PENALTY,
  type RouteObstacle,
} from "./routeHardening";

const STABILITY_BONUS = 16;
const SNAP = 1;

export type PathfinderInput = {
  start: Point;
  goal: Point;
  startStub?: Point;
  goalApproach?: Point;
  obstacles: RouteObstacle[];
  ignoreIds: Set<string>;
  corridors?: EndpointCorridor[];
  canvas?: Rect;
  extraNodes?: Point[];
  priorRoute?: Point[];
  priorRoutes?: Point[][];
  congestion?: CongestionContext;
  clearance?: number;
};

function snap(n: number): number {
  return Math.round(n / SNAP) * SNAP;
}

function snapPoint(p: Point): Point {
  return { x: snap(p.x), y: snap(p.y) };
}

function uniq(values: number[]): number[] {
  return [...new Set(values.map(snap))].sort((a, b) => a - b);
}

function insideKeepOut(
  p: Point,
  obstacles: RouteObstacle[],
  ignoreIds: Set<string>,
  clearance: number,
  corridors?: EndpointCorridor[],
): boolean {
  for (const box of obstacles) {
    if (ignoreIds.has(box.id)) continue;
    const r = obstacleKeepOut(box, clearance);
    if (
      p.x > r.x + 0.51 &&
      p.x < r.x + r.width - 0.51 &&
      p.y > r.y + 0.51 &&
      p.y < r.y + r.height - 0.51
    ) {
      const corridor = corridorForBox(box.id, corridors);
      if (corridor && pointInRect(p, endpointCorridorRect(corridor))) {
        continue;
      }
      return true;
    }
  }
  return false;
}

function segmentBlocked(
  a: Point,
  b: Point,
  obstacles: RouteObstacle[],
  ignoreIds: Set<string>,
  clearance: number,
  corridors?: EndpointCorridor[],
): boolean {
  for (const box of obstacles) {
    if (ignoreIds.has(box.id)) continue;
    if (segmentHitsSolidObstacle(a, b, box, clearance, corridorForBox(box.id, corridors))) {
      return true;
    }
  }
  return false;
}

function manhattan(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function nearObstaclePenalty(
  a: Point,
  b: Point,
  obstacles: RouteObstacle[],
  ignoreIds: Set<string>,
): number {
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  for (const box of obstacles) {
    if (ignoreIds.has(box.id)) continue;
    const r = obstacleKeepOut(box, CARD_ROUTE_CLEARANCE);
    const dx = Math.max(r.x - mid.x, 0, mid.x - (r.x + r.width));
    const dy = Math.max(r.y - mid.y, 0, mid.y - (r.y + r.height));
    if (Math.hypot(dx, dy) < 18) return NEAR_CARD_PENALTY;
  }
  return 0;
}

function distToPolyline(p: Point, line: Point[]): number {
  let best = Infinity;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1]!;
    const b = line[i]!;
    if (Math.abs(a.y - b.y) <= 0.51) {
      const lo = Math.min(a.x, b.x);
      const hi = Math.max(a.x, b.x);
      const x = Math.min(hi, Math.max(lo, p.x));
      best = Math.min(best, Math.hypot(p.x - x, p.y - a.y));
    } else if (Math.abs(a.x - b.x) <= 0.51) {
      const lo = Math.min(a.y, b.y);
      const hi = Math.max(a.y, b.y);
      const y = Math.min(hi, Math.max(lo, p.y));
      best = Math.min(best, Math.hypot(p.x - a.x, p.y - y));
    }
  }
  return best;
}

function edgeLeavesCanvas(a: Point, b: Point, canvas: Rect): boolean {
  const left = canvas.x;
  const right = canvas.x + canvas.width;
  const top = canvas.y;
  const bottom = canvas.y + canvas.height;
  if (a.x <= left + 0.1 && b.x < a.x - 0.1) return true;
  if (a.x >= right - 0.1 && b.x > a.x + 0.1) return true;
  if (a.y <= top + 0.1 && b.y < a.y - 0.1) return true;
  if (a.y >= bottom - 0.1 && b.y > a.y + 0.1) return true;
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);
  return minX < left - 0.1 || minY < top - 0.1 || maxX > right + 0.1 || maxY > bottom + 0.1;
}

function collapseColinear(points: Point[]): Point[] {
  if (points.length < 3) return points.map((p) => ({ ...p }));
  const out = [{ ...points[0]! }];
  for (let i = 1; i < points.length - 1; i++) {
    const a = out[out.length - 1]!;
    const b = points[i]!;
    const c = points[i + 1]!;
    const col =
      (Math.abs(a.x - b.x) <= 0.51 && Math.abs(b.x - c.x) <= 0.51) ||
      (Math.abs(a.y - b.y) <= 0.51 && Math.abs(b.y - c.y) <= 0.51);
    if (col) continue;
    out.push({ ...b });
  }
  out.push({ ...points[points.length - 1]! });
  return out;
}

export function findRectilinearPath(input: PathfinderInput): Point[] | null {
  const clearance = input.clearance ?? CARD_ROUTE_CLEARANCE;
  const canvas = input.canvas ?? {
    x: 0,
    y: 0,
    width: A3_WIDTH_PX,
    height: A3_HEIGHT_PX,
  };
  const start = snapPoint(input.start);
  const goal = snapPoint(input.goal);
  const stub = input.startStub ? snapPoint(input.startStub) : null;
  const approach = input.goalApproach ? snapPoint(input.goalApproach) : null;
  const forced = [start, goal, stub, approach, ...(input.extraNodes ?? []).map(snapPoint)].filter(
    (p): p is Point => Boolean(p),
  );

  const rails = input.congestion
    ? offsetRails(input.congestion.routes, input.congestion.exemptIds)
    : [];
  const xs = uniq([
    canvas.x + A3_ROUTE_MARGIN,
    canvas.x + canvas.width - A3_ROUTE_MARGIN,
    ...forced.map((p) => p.x),
    ...rails.map((p) => p.x),
    ...input.obstacles.flatMap((o) => {
      const r = obstacleKeepOut(o, clearance);
      return [r.x, r.x + r.width];
    }),
  ]);
  const ys = uniq([
    canvas.y + A3_ROUTE_MARGIN,
    canvas.y + canvas.height - A3_ROUTE_MARGIN,
    ...forced.map((p) => p.y),
    ...rails.map((p) => p.y),
    ...input.obstacles.flatMap((o) => {
      const r = obstacleKeepOut(o, clearance);
      return [r.y, r.y + r.height];
    }),
  ]);

  const nodes: Point[] = [];
  const index = new Map<string, number>();
  const add = (p: Point) => {
    const q = snapPoint(p);
    if (!pointInA3Hard(q, canvas.width, canvas.height)) {
      return;
    }
    const k = `${q.x}:${q.y}`;
    if (index.has(k)) return;
    const forcedHere = forced.some((f) => f.x === q.x && f.y === q.y);
    if (
      !forcedHere &&
      !pointInA3RouteInner(q, canvas.width, canvas.height, A3_ROUTE_MARGIN)
    ) {
      return;
    }
    if (!forcedHere && insideKeepOut(q, input.obstacles, input.ignoreIds, clearance, input.corridors)) {
      return;
    }
    index.set(k, nodes.length);
    nodes.push(q);
  };
  for (const x of xs) {
    for (const y of ys) add({ x, y });
  }
  for (const p of forced) add(p);

  const startI = index.get(`${start.x}:${start.y}`);
  const goalI = index.get(`${goal.x}:${goal.y}`);
  if (startI == null || goalI == null) return null;
  const stubI = stub ? index.get(`${stub.x}:${stub.y}`) : undefined;
  const approachI = approach ? index.get(`${approach.x}:${approach.y}`) : undefined;

  const adj: Array<Array<{ to: number; dir: number; cost: number }>> = nodes.map(
    () => [],
  );
  const link = (a: number, b: number) => {
    const pa = nodes[a]!;
    const pb = nodes[b]!;
    if (edgeLeavesCanvas(pa, pb, canvas)) return;
    if (segmentBlocked(pa, pb, input.obstacles, input.ignoreIds, clearance, input.corridors)) return;
    const dir = pa.x === pb.x ? (pb.y < pa.y ? 1 : 3) : pb.x > pa.x ? 2 : 4;
    const dist = manhattan(pa, pb);
    if (dist <= 0.2) return;
    let cost = dist + nearObstaclePenalty(pa, pb, input.obstacles, input.ignoreIds);
    if (input.congestion) {
      cost += visibilityEdgeCongestionCost(pa, pb, input.congestion, {
        start,
        goal,
      });
    } else if (input.priorRoutes?.length) {
      cost += 320 * countRouteCrossings([pa, pb], input.priorRoutes);
    }
    if (input.priorRoute && distToPolyline(pb, input.priorRoute) <= 20) {
      cost = Math.max(1, cost - STABILITY_BONUS);
    }
    adj[a]!.push({ to: b, dir, cost });
  };

  const byY = new Map<number, number[]>();
  const byX = new Map<number, number[]>();
  nodes.forEach((p, i) => {
    const row = byY.get(p.y) ?? [];
    row.push(i);
    byY.set(p.y, row);
    const col = byX.get(p.x) ?? [];
    col.push(i);
    byX.set(p.x, col);
  });
  for (const row of byY.values()) {
    row.sort((a, b) => nodes[a]!.x - nodes[b]!.x);
    for (let i = 0; i < row.length - 1; i++) link(row[i]!, row[i + 1]!);
    for (let i = row.length - 1; i > 0; i--) link(row[i]!, row[i - 1]!);
  }
  for (const col of byX.values()) {
    col.sort((a, b) => nodes[a]!.y - nodes[b]!.y);
    for (let i = 0; i < col.length - 1; i++) link(col[i]!, col[i + 1]!);
    for (let i = col.length - 1; i > 0; i--) link(col[i]!, col[i - 1]!);
  }

  if (stubI != null && stub) {
    adj[startI] = adj[startI]!.filter((e) => e.to === stubI);
    if (adj[startI]!.length === 0 && !segmentBlocked(start, stub, input.obstacles, input.ignoreIds, clearance, input.corridors)) {
      adj[startI]!.push({
        to: stubI,
        dir: start.x === stub.x ? (stub.y < start.y ? 1 : 3) : stub.x > start.x ? 2 : 4,
        cost: manhattan(start, stub),
      });
    }
  }
  if (approachI != null && approach) {
    for (let i = 0; i < adj.length; i++) {
      if (i === approachI) continue;
      adj[i] = adj[i]!.filter((e) => e.to !== goalI);
    }
    if (
      !adj[approachI]!.some((e) => e.to === goalI) &&
      !segmentBlocked(approach, goal, input.obstacles, input.ignoreIds, clearance, input.corridors)
    ) {
      adj[approachI]!.push({
        to: goalI,
        dir: approach.x === goal.x ? (goal.y < approach.y ? 1 : 3) : goal.x > approach.x ? 2 : 4,
        cost: manhattan(approach, goal),
      });
    }
  }

  const stateN = nodes.length * 5;
  const gScore = new Float64Array(stateN).fill(Infinity);
  const parent = new Int32Array(stateN).fill(-1);
  const heap: number[] = [];
  const startState = startI * 5;
  gScore[startState] = 0;
  heap.push(startState);
  const hOf = (node: number) => manhattan(nodes[node]!, goal);

  const pop = (): number => {
    let best = 0;
    let bestF = Infinity;
    for (let i = 0; i < heap.length; i++) {
      const s = heap[i]!;
      const f = gScore[s]! + hOf(Math.floor(s / 5));
      if (f < bestF) {
        bestF = f;
        best = i;
      }
    }
    const s = heap[best]!;
    heap[best] = heap[heap.length - 1]!;
    heap.pop();
    return s;
  };

  let found = -1;
  while (heap.length) {
    const s = pop();
    const node = Math.floor(s / 5);
    const dir = s % 5;
    if (node === goalI) {
      found = s;
      break;
    }
    for (const edge of adj[node]!) {
      const bend = dir !== 0 && dir !== edge.dir ? BEND_PENALTY : 0;
      const next = edge.to * 5 + edge.dir;
      const ng = gScore[s]! + edge.cost + bend;
      if (ng + 0.01 < gScore[next]!) {
        gScore[next] = ng;
        parent[next] = s;
        heap.push(next);
      }
    }
  }
  if (found < 0) return null;

  const rev: Point[] = [];
  let cur = found;
  while (cur >= 0) {
    rev.push(nodes[Math.floor(cur / 5)]!);
    cur = parent[cur]!;
  }
  rev.reverse();
  if (rev.length < 2) return null;
  const path = collapseColinear(rev);
  path[0] = { x: input.start.x, y: input.start.y };
  path[path.length - 1] = { x: input.goal.x, y: input.goal.y };
  return path;
}
