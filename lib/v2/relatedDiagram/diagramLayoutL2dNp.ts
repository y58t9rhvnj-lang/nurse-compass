/**
 * L2-D D3-0: NP-card local placement from live incoming geometry.
 * D0/D1/D2 stay frozen. No AUTO Junction. D4/D5 are not implemented here.
 */

import { A3_HEIGHT_PX, A3_WIDTH_PX } from "./a3Canvas";
import { CARD_MIN_GAP, isLegalCardPlacement } from "./cardCollision";
import {
  collectArrangeAffectedConnectionIds,
  L2D_A3_MARGIN,
  L2D_GAP_MAX,
  L2D_GAP_MIN,
  L2D_GAP_PREFERRED,
  L2D_GAP_SIBLING,
  restitchAffectedRoutes,
} from "./diagramLayoutL2d";
import {
  countPolylineBoundsHits,
  countPolylineCardHits,
  countPolylineLegendHits,
} from "./diagramLayoutL2";
import { routeHighwayFlag } from "./diagramLayoutL2b";
import { knowledgeCardsOf } from "./knowledgeGroupLayout";
import {
  pointsDeepEqual,
  seedStableRouteState,
  type StableRouteState,
} from "./incrementalRoutes";
import {
  countBends,
  polylineLength,
  type EdgeSide,
  type Point,
} from "./orthogonalRouting";
import {
  cardObstacle,
  defaultRouteCanvas,
  selectBestOrthogonalRoute,
} from "./routeHardening";
import type { RelatedDiagramRouteTopology } from "./routeTopology";
import type {
  RelatedDiagramCard,
  RelatedDiagramConnection,
} from "./types";

export const D3_GAP_MIN = L2D_GAP_MIN;
export const D3_GAP_PREFERRED = L2D_GAP_PREFERRED;
export const D3_GAP_MAX = L2D_GAP_MAX;
export const D3_GAP_SIBLING = L2D_GAP_SIBLING;
export const D3_A3_MARGIN = L2D_A3_MARGIN;
export const D3_IMPROVEMENT_THRESHOLD = 56;
export const D3_STABILITY_PENALTY = 72;
export const D3_SPAN_RATIO = 0.35;
export const D3_CLUSTER_JOIN = 280;

const OFFSETS = [0, -48, 48, -96, 96, -24, 24, -72, 72, -144, 144];
const EDGE_PAIRS: Array<[EdgeSide, EdgeSide]> = [
  ["right", "left"],
  ["bottom", "top"],
  ["left", "right"],
  ["top", "bottom"],
];
const NP_RELATIONS = new Set([
  "nursing_problem_basis",
  "nursing_problem_integration",
]);

export type NursingProblemHardSet = {
  unitId: string;
  npIds: string[];
  movableIds: string[];
  anchorIds: string[];
};

export type D3NpDecision = {
  npId: string;
  choseCurrent: boolean;
  reason: string;
  currentScore: number | null;
  bestAltScore: number | null;
  localClusterIds: string[];
  moved: boolean;
};

function compareId(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function toPx(value: number): number {
  return Math.round(value);
}

function applyPos(
  card: RelatedDiagramCard,
  x: number,
  y: number,
): RelatedDiagramCard {
  return {
    ...card,
    layout: { ...card.layout, x: toPx(x), y: toPx(y) },
  };
}

function midX(card: RelatedDiagramCard): number {
  return card.layout.x + card.layout.width / 2;
}

function midY(card: RelatedDiagramCard): number {
  return card.layout.y + card.layout.height / 2;
}

function rightOf(card: RelatedDiagramCard): number {
  return card.layout.x + card.layout.width;
}

function bottomOf(card: RelatedDiagramCard): number {
  return card.layout.y + card.layout.height;
}

function centerDist(a: RelatedDiagramCard, b: RelatedDiagramCard): number {
  return Math.hypot(midX(a) - midX(b), midY(a) - midY(b));
}

export function discoverNursingProblemCards(
  cards: RelatedDiagramCard[],
): RelatedDiagramCard[] {
  return cards
    .filter((card) => card.cardType === "nursing_problem")
    .sort((a, b) => compareId(a.id, b.id));
}

function visibleIncoming(
  connections: RelatedDiagramConnection[],
  npId: string,
): RelatedDiagramConnection[] {
  return connections
    .filter(
      (conn) => NP_RELATIONS.has(conn.relationType) && conn.targetCardId === npId,
    )
    .sort((a, b) => compareId(a.id, b.id));
}

function npIncidentConnections(
  connections: RelatedDiagramConnection[],
  npId: string,
): RelatedDiagramConnection[] {
  return connections
    .filter(
      (conn) => conn.sourceCardId === npId || conn.targetCardId === npId,
    )
    .sort((a, b) => compareId(a.id, b.id));
}

export function resolveNursingProblemHardSets(input: {
  cards: RelatedDiagramCard[];
  connections: RelatedDiagramConnection[];
  topology?: RelatedDiagramRouteTopology;
}): NursingProblemHardSet[] {
  void input.topology;
  const cards = new Map(input.cards.map((card) => [card.id, card]));
  return discoverNursingProblemCards(input.cards).map((np) => {
    const anchors = [
      ...new Set(
        visibleIncoming(input.connections, np.id)
          .map((conn) => conn.sourceCardId)
          .filter((id) => cards.has(id)),
      ),
    ].sort(compareId);
    return {
      unitId: `np:${np.id}`,
      npIds: [np.id],
      movableIds: [np.id],
      anchorIds: anchors,
    };
  });
}

function findRoot(parent: Map<string, string>, id: string): string {
  let cur = id;
  while (parent.get(cur) !== cur) {
    const next = parent.get(cur);
    if (!next) break;
    cur = next;
  }
  return cur;
}

function clusterAnchors(anchors: RelatedDiagramCard[]): RelatedDiagramCard[][] {
  const sorted = [...anchors].sort((a, b) => compareId(a.id, b.id));
  const parent = new Map(sorted.map((card) => [card.id, card.id]));
  for (let i = 0; i < sorted.length; i += 1) {
    for (let j = i + 1; j < sorted.length; j += 1) {
      const left = sorted[i]!;
      const right = sorted[j]!;
      if (centerDist(left, right) <= D3_CLUSTER_JOIN) {
        const rootA = findRoot(parent, left.id);
        const rootB = findRoot(parent, right.id);
        if (rootA !== rootB) {
          const keep = compareId(rootA, rootB) < 0 ? rootA : rootB;
          const drop = keep === rootA ? rootB : rootA;
          parent.set(drop, keep);
        }
      }
    }
  }
  const groups = new Map<string, RelatedDiagramCard[]>();
  for (const card of sorted) {
    const root = findRoot(parent, card.id);
    const list = groups.get(root) ?? [];
    list.push(card);
    groups.set(root, list);
  }
  return [...groups.values()]
    .map((group) => [...group].sort((a, b) => compareId(a.id, b.id)))
    .sort((a, b) => compareId(a[0]!.id, b[0]!.id));
}

function clusterBox(cluster: RelatedDiagramCard[]): {
  midX: number;
  midY: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
} {
  const left = Math.min(...cluster.map((card) => card.layout.x));
  const top = Math.min(...cluster.map((card) => card.layout.y));
  const right = Math.max(...cluster.map(rightOf));
  const bottom = Math.max(...cluster.map(bottomOf));
  return {
    left,
    top,
    right,
    bottom,
    midX: (left + right) / 2,
    midY: (top + bottom) / 2,
  };
}

function sourceSpan(anchors: RelatedDiagramCard[]): { spanX: number; spanY: number } {
  if (anchors.length === 0) return { spanX: 0, spanY: 0 };
  const left = Math.min(...anchors.map((card) => card.layout.x));
  const top = Math.min(...anchors.map((card) => card.layout.y));
  const right = Math.max(...anchors.map(rightOf));
  const bottom = Math.max(...anchors.map(bottomOf));
  return { spanX: right - left, spanY: bottom - top };
}

function pickLocalCluster(
  clusters: RelatedDiagramCard[][],
  anchors: RelatedDiagramCard[],
  np: RelatedDiagramCard,
  routeState?: StableRouteState,
  incoming?: RelatedDiagramConnection[],
): RelatedDiagramCard[] {
  if (clusters.length === 0) return [];
  if (clusters.length === 1) return clusters[0]!;
  const span = sourceSpan(anchors);
  const wide =
    span.spanX > A3_WIDTH_PX * D3_SPAN_RATIO ||
    span.spanY > A3_HEIGHT_PX * D3_SPAN_RATIO;
  const scored = clusters.map((cluster) => {
    const box = clusterBox(cluster);
    const affinity = Math.hypot(box.midX - midX(np), box.midY - midY(np));
    const ids = new Set(cluster.map((card) => card.id));
    const localConns = (incoming ?? []).filter((conn) => ids.has(conn.sourceCardId));
    const routeLen = localConns.reduce((sum, conn) => {
      const points = routeState?.byId[conn.id]?.points;
      return sum + (points ? polylineLength(points) : affinity);
    }, 0);
    return { cluster, affinity, routeLen, size: cluster.length };
  });
  scored.sort((a, b) => {
    if (wide) {
      const aKey = a.affinity * 2 + a.routeLen * 0.01 - a.size * 8;
      const bKey = b.affinity * 2 + b.routeLen * 0.01 - b.size * 8;
      if (aKey !== bKey) return aKey - bKey;
    } else if (b.size !== a.size) {
      return b.size - a.size;
    }
    return compareId(a.cluster[0]!.id, b.cluster[0]!.id);
  });
  return scored[0]!.cluster;
}

function clampX(x: number, width: number): number {
  const maxX = A3_WIDTH_PX - D3_A3_MARGIN - width;
  if (maxX < D3_A3_MARGIN) return D3_A3_MARGIN;
  return toPx(Math.min(Math.max(D3_A3_MARGIN, x), maxX));
}

function clampY(y: number, height: number): number {
  const maxY = A3_HEIGHT_PX - D3_A3_MARGIN - height;
  if (maxY < D3_A3_MARGIN) return D3_A3_MARGIN;
  return toPx(Math.min(Math.max(D3_A3_MARGIN, y), maxY));
}

function cardLegal(
  card: RelatedDiagramCard,
  obstacles: RelatedDiagramCard[],
): boolean {
  return isLegalCardPlacement(
    card.layout,
    obstacles.filter((item) => item.id !== card.id),
    { minGap: CARD_MIN_GAP },
  );
}

function columnPeers(
  np: RelatedDiagramCard,
  nps: RelatedDiagramCard[],
): RelatedDiagramCard[] {
  return nps.filter((other) => {
    if (other.id === np.id) return false;
    if (Math.abs(midX(other) - midX(np)) > 100) return false;
    return rectGap(np.layout, other.layout) <= D3_GAP_MAX;
  });
}

function rectGap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): number {
  const dx = Math.max(0, a.x - (b.x + b.width), b.x - (a.x + a.width));
  const dy = Math.max(0, a.y - (b.y + b.height), b.y - (a.y + a.height));
  if (dx === 0) return dy;
  if (dy === 0) return dx;
  return Math.hypot(dx, dy);
}

function onClusterSide(
  np: RelatedDiagramCard,
  box: { left: number; right: number; top: number; bottom: number },
): boolean {
  return (
    np.layout.x >= box.right - 24 ||
    np.layout.y >= box.bottom - 24 ||
    rightOf(np) <= box.left + 24 ||
    bottomOf(np) <= box.top + 24
  );
}

function convergenceGap(
  np: RelatedDiagramCard,
  cluster: RelatedDiagramCard[],
): number {
  if (cluster.length === 0) return 0;
  const box = clusterBox(cluster);
  const gap = rectGap(np.layout, {
    x: box.left,
    y: box.top,
    width: box.right - box.left,
    height: box.bottom - box.top,
  });
  if (onClusterSide(np, box) && gap <= D3_GAP_MAX + D3_GAP_PREFERRED) return 0;
  return gap;
}

function alignedWithCluster(
  np: RelatedDiagramCard,
  cluster: RelatedDiagramCard[],
): boolean {
  return convergenceGap(np, cluster) === 0;
}

type PlannedRoute = {
  connectionId: string;
  sourceId: string;
  targetId: string;
  points: Point[];
  local: boolean;
};

function planOneRoute(
  source: RelatedDiagramCard,
  target: RelatedDiagramCard,
  cards: RelatedDiagramCard[],
  prior: Point[][],
): Point[] | null {
  const obstacles = cards.map(cardObstacle);
  const canvas = defaultRouteCanvas();
  let best: { points: Point[]; score: number } | null = null;
  for (const [sourceEdge, targetEdge] of EDGE_PAIRS) {
    const points = selectBestOrthogonalRoute({
      source: cardObstacle(source),
      target: cardObstacle(target),
      sourceEdge,
      targetEdge,
      obstacles,
      canvas,
      priorRoutes: prior,
    });
    if (!points || points.length < 2) continue;
    const hits = countPolylineCardHits(
      points,
      cards.map((card) => ({ id: card.id, ...card.layout })),
      new Set([source.id, target.id]),
    );
    const score =
      hits * 50_000 +
      polylineLength(points) +
      countBends(points) * 140;
    if (!best || score < best.score) best = { points, score };
  }
  return best?.points ?? null;
}

function planIncident(
  np: RelatedDiagramCard,
  cards: RelatedDiagramCard[],
  connections: RelatedDiagramConnection[],
  localIds: Set<string>,
  previous?: StableRouteState,
  reuseExisting?: boolean,
): PlannedRoute[] | null {
  const byId = new Map(cards.map((card) => [card.id, card]));
  const incident = npIncidentConnections(connections, np.id);
  const out: PlannedRoute[] = [];
  const prior: Point[][] = [];
  for (const conn of incident) {
    const source = byId.get(conn.sourceCardId);
    const target = byId.get(conn.targetCardId);
    if (!source || !target) return null;
    const existing = previous?.byId[conn.id]?.points;
    const points =
      reuseExisting && existing && existing.length >= 2
        ? existing
        : planOneRoute(source, target, cards, prior);
    if (!points) return null;
    prior.push(points);
    out.push({
      connectionId: conn.id,
      sourceId: source.id,
      targetId: target.id,
      points,
      local:
        localIds.has(conn.sourceCardId) || localIds.has(conn.targetCardId),
    });
  }
  return out;
}

function routeMetrics(
  routes: PlannedRoute[],
  cards: RelatedDiagramCard[],
  np: RelatedDiagramCard,
) {
  const rects = cards.map((card) => ({ id: card.id, ...card.layout }));
  let through = 0;
  let localLen = 0;
  let remoteLen = 0;
  let bends = 0;
  let highway = 0;
  let rail = 0;
  let giant = 0;
  let bounds = 0;
  let legend = 0;
  for (const route of routes) {
    through += countPolylineCardHits(
      route.points,
      rects,
      new Set([route.sourceId, route.targetId, np.id]),
    );
    const length = polylineLength(route.points);
    if (route.local) localLen += length;
    else remoteLen += length;
    bends += countBends(route.points);
    highway += routeHighwayFlag(route.points);
    if (route.points.some((point) => point.x <= 16 || point.x >= A3_WIDTH_PX - 16)) {
      rail += 1;
    }
    bounds += countPolylineBoundsHits(route.points);
    legend += countPolylineLegendHits(route.points);
    const first = route.points[0];
    const last = route.points[route.points.length - 1];
    if (first && last) {
      const direct = Math.abs(first.x - last.x) + Math.abs(first.y - last.y);
      if (direct > 0 && length > 2.8 * direct) giant += 1;
    }
  }
  return { through, localLen, remoteLen, bends, highway, rail, giant, bounds, legend };
}

type ScoredCandidate = {
  x: number;
  y: number;
  current: boolean;
  score: number;
  metrics: ReturnType<typeof routeMetrics>;
};

function generateCandidates(
  np: RelatedDiagramCard,
  cluster: RelatedDiagramCard[],
): Array<{ x: number; y: number; current: boolean }> {
  const found = new Map<string, { x: number; y: number; current: boolean }>();
  const add = (x: number, y: number, current = false) => {
    const nextX = clampX(x, np.layout.width);
    const nextY = clampY(y, np.layout.height);
    const key = `${nextX}:${nextY}`;
    if (found.has(key)) return;
    found.set(key, { x: nextX, y: nextY, current });
  };
  add(np.layout.x, np.layout.y, true);
  if (cluster.length > 0) {
    const box = clusterBox(cluster);
    add(box.midX - np.layout.width / 2, box.bottom + D3_GAP_PREFERRED);
    add(box.right + D3_GAP_PREFERRED, box.midY - np.layout.height / 2);
    add(np.layout.x, box.bottom + D3_GAP_PREFERRED);
    add(box.midX - np.layout.width / 2, np.layout.y);
  }
  for (const dx of OFFSETS) {
    add(np.layout.x + dx, np.layout.y);
    add(np.layout.x, np.layout.y + dx);
  }
  if (cluster.length > 0) {
    const box = clusterBox(cluster);
    for (const dx of [0, -48, 48, -96, 96]) {
      add(box.midX - np.layout.width / 2 + dx, box.bottom + D3_GAP_PREFERRED);
    }
  }
  return [...found.values()];
}

function scoreCandidate(input: {
  np: RelatedDiagramCard;
  placed: RelatedDiagramCard;
  cluster: RelatedDiagramCard[];
  peers: RelatedDiagramCard[];
  metrics: ReturnType<typeof routeMetrics>;
  current: boolean;
}): number {
  const affinity = convergenceGap(input.placed, input.cluster);
  const columnBreak =
    input.peers.length === 0
      ? 0
      : Math.max(0, Math.abs(midX(input.placed) - midX(input.np)) - 80);
  const displacement = Math.hypot(
    input.placed.layout.x - input.np.layout.x,
    input.placed.layout.y - input.np.layout.y,
  );
  return (
    affinity * 1.6 +
    input.metrics.localLen * 0.12 +
    input.metrics.bends * 8 +
    input.metrics.through * 400 +
    columnBreak * 4.5 +
    displacement * 0.35 +
    input.metrics.remoteLen * 0.02
  );
}

function evaluateNp(input: {
  np: RelatedDiagramCard;
  cards: RelatedDiagramCard[];
  connections: RelatedDiagramConnection[];
  nps: RelatedDiagramCard[];
  routeState: StableRouteState;
  topology?: RelatedDiagramRouteTopology;
  allowIntegrationLayout?: boolean;
}): { placed: RelatedDiagramCard; decision: D3NpDecision } {
  const incoming = visibleIncoming(input.connections, input.np.id);
  const basisIncoming = incoming.filter(
    (conn) => conn.relationType === "nursing_problem_basis",
  );
  if (incoming.length === 0) {
    return {
      placed: input.np,
      decision: {
        npId: input.np.id,
        choseCurrent: true,
        reason: "no_visible_incoming",
        currentScore: null,
        bestAltScore: null,
        localClusterIds: [],
        moved: false,
      },
    };
  }
  if (basisIncoming.length === 0 && !input.allowIntegrationLayout) {
    return {
      placed: input.np,
      decision: {
        npId: input.np.id,
        choseCurrent: true,
        reason: "integration_source_unmoved",
        currentScore: null,
        bestAltScore: null,
        localClusterIds: [],
        moved: false,
      },
    };
  }
  const byId = new Map(input.cards.map((card) => [card.id, card]));
  const anchors = (basisIncoming.length > 0 ? basisIncoming : incoming)
    .map((conn) => byId.get(conn.sourceCardId))
    .filter((card): card is RelatedDiagramCard => card != null);
  if (anchors.length === 0) {
    return {
      placed: input.np,
      decision: {
        npId: input.np.id,
        choseCurrent: true,
        reason: "no_live_anchors",
        currentScore: null,
        bestAltScore: null,
        localClusterIds: [],
        moved: false,
      },
    };
  }
  const clusters = clusterAnchors(anchors);
  const clusterIncoming = basisIncoming.length > 0 ? basisIncoming : incoming;
  const local = pickLocalCluster(
    clusters,
    anchors,
    input.np,
    input.routeState,
    clusterIncoming,
  );
  if (local.length === 0) {
    return {
      placed: input.np,
      decision: {
        npId: input.np.id,
        choseCurrent: true,
        reason: "no_local_cluster",
        currentScore: null,
        bestAltScore: null,
        localClusterIds: [],
        moved: false,
      },
    };
  }
  const localIds = new Set(local.map((card) => card.id));
  const peers = columnPeers(input.np, input.nps);
  const obstacles = input.cards.filter((card) => card.id !== input.np.id);
  const existingRoutes = planIncident(
    input.np,
    input.cards,
    input.connections,
    localIds,
    input.routeState,
    true,
  );
  const plannedCurrent = planIncident(
    input.np,
    input.cards,
    input.connections,
    localIds,
    input.routeState,
    false,
  );
  const existingMetrics = existingRoutes
    ? routeMetrics(existingRoutes, input.cards, input.np)
    : null;
  const currentHardSafe =
    existingMetrics != null &&
    cardLegal(input.np, obstacles) &&
    existingMetrics.through === 0 &&
    existingMetrics.bounds === 0 &&
    existingMetrics.legend === 0;
  const currentAligned =
    alignedWithCluster(input.np, local) || peers.length > 0;
  const rejectBaseline = existingMetrics ?? (plannedCurrent
    ? routeMetrics(plannedCurrent, input.cards, input.np)
    : null);
  const candidates: ScoredCandidate[] = [];
  for (const raw of generateCandidates(input.np, local)) {
    const placed = applyPos(input.np, raw.x, raw.y);
    if (!cardLegal(placed, obstacles)) continue;
    const nextCards = input.cards.map((card) =>
      card.id === placed.id ? placed : card,
    );
    const routes = planIncident(
      placed,
      nextCards,
      input.connections,
      localIds,
      input.routeState,
      false,
    );
    if (!routes) continue;
    const metrics = routeMetrics(routes, nextCards, placed);
    if (metrics.bounds > 0 || metrics.legend > 0) continue;
    if (rejectBaseline) {
      if (metrics.through > rejectBaseline.through) continue;
      if (metrics.rail > rejectBaseline.rail) continue;
      if (metrics.giant > rejectBaseline.giant) continue;
      if (metrics.highway > rejectBaseline.highway) continue;
    } else if (
      metrics.through > 0 ||
      metrics.rail > 0 ||
      metrics.giant > 0
    ) {
      continue;
    }
    candidates.push({
      x: placed.layout.x,
      y: placed.layout.y,
      current: raw.current,
      score: scoreCandidate({
        np: input.np,
        placed,
        cluster: local,
        peers,
        metrics,
        current: raw.current,
      }),
      metrics,
    });
  }
  const current = candidates.find((row) => row.current);
  const alts = candidates
    .filter((row) => !row.current)
    .sort((a, b) => a.score - b.score || a.x - b.x || a.y - b.y);
  const bestAlt = alts[0];
  const stability =
    currentHardSafe && currentAligned
      ? D3_STABILITY_PENALTY
      : currentHardSafe
        ? 24
        : 0;
  const currentAffinity = convergenceGap(input.np, local);
  const altPlaced = bestAlt
    ? applyPos(input.np, bestAlt.x, bestAlt.y)
    : null;
  const altAffinity = altPlaced ? convergenceGap(altPlaced, local) : currentAffinity;
  const affinityGain = currentAffinity - altAffinity;
  const throughGain =
    (current?.metrics.through ?? rejectBaseline?.through ?? 99) -
    (bestAlt?.metrics.through ?? 99);
  const meaningful =
    affinityGain >= D3_GAP_MAX ||
    throughGain > 0 ||
    (altAffinity === 0 && currentAffinity > D3_GAP_PREFERRED);
  const scoreGain =
    current != null && bestAlt != null
      ? current.score - (bestAlt.score + (currentHardSafe ? stability : 0))
      : null;
  const adoptAlt =
    bestAlt != null && meaningful
      ? current == null
        ? true
        : (scoreGain ?? 0) >= D3_IMPROVEMENT_THRESHOLD
      : false;
  if (!adoptAlt) {
    return {
      placed: input.np,
      decision: {
        npId: input.np.id,
        choseCurrent: true,
        reason:
          incoming.length === 0
            ? "no_visible_incoming"
            : !currentHardSafe && !bestAlt
              ? "no_legal_improvement"
              : currentHardSafe
                ? "current_wins_gate"
                : "preserve_current",
        currentScore: current?.score ?? null,
        bestAltScore: bestAlt?.score ?? null,
        localClusterIds: local.map((card) => card.id).sort(compareId),
        moved: false,
      },
    };
  }
  const placed = applyPos(input.np, bestAlt.x, bestAlt.y);
  return {
    placed,
    decision: {
      npId: input.np.id,
      choseCurrent: false,
      reason: "improved_local_convergence",
      currentScore: current?.score ?? null,
      bestAltScore: bestAlt.score,
      localClusterIds: local.map((card) => card.id).sort(compareId),
      moved:
        placed.layout.x !== input.np.layout.x ||
        placed.layout.y !== input.np.layout.y,
    },
  };
}

function positionsEqual(
  a: RelatedDiagramCard[],
  b: RelatedDiagramCard[],
): boolean {
  if (a.length !== b.length) return false;
  const left = new Map(a.map((card) => [card.id, card]));
  for (const card of b) {
    const prev = left.get(card.id);
    if (!prev) return false;
    if (prev.layout.x !== card.layout.x || prev.layout.y !== card.layout.y) {
      return false;
    }
  }
  return true;
}

function routesEqual(a: StableRouteState, b: StableRouteState): boolean {
  const ids = [...new Set([...Object.keys(a.byId), ...Object.keys(b.byId)])].sort();
  for (const id of ids) {
    const left = a.byId[id];
    const right = b.byId[id];
    if (!left || !right) return false;
    if (!pointsDeepEqual(left.points, right.points)) return false;
    if (left.sourceEdge !== right.sourceEdge || left.targetEdge !== right.targetEdge) {
      return false;
    }
  }
  return true;
}

export function layoutNursingProblemUnits(input: {
  cards: RelatedDiagramCard[];
  connections: RelatedDiagramConnection[];
  topology?: RelatedDiagramRouteTopology;
  routeState?: StableRouteState;
}): RelatedDiagramCard[] {
  return applyNursingProblemArrange({
    cards: input.cards,
    connections: input.connections,
    topology: input.topology,
    routeState:
      input.routeState ??
      seedStableRouteState(input.cards, input.connections, input.topology),
  }).cards;
}

export function applyNursingProblemArrange(input: {
  cards: RelatedDiagramCard[];
  connections: RelatedDiagramConnection[];
  routeState: StableRouteState;
  topology?: RelatedDiagramRouteTopology;
}): {
  cards: RelatedDiagramCard[];
  routeState: StableRouteState;
  topology?: RelatedDiagramRouteTopology;
  changedCardIds: string[];
  routeChanged: boolean;
  decisions: D3NpDecision[];
} {
  const nps = discoverNursingProblemCards(input.cards);
  const basisNps = nps.filter((np) =>
    visibleIncoming(input.connections, np.id).some(
      (conn) => conn.relationType === "nursing_problem_basis",
    ),
  );
  const integrationNps = nps.filter((np) => !basisNps.some((item) => item.id === np.id));
  let cards = input.cards;
  let routeState = input.routeState;
  let topology = input.topology;
  const decisions: D3NpDecision[] = [];
  const movedNpIds = new Set<string>();
  const knowledgeIds = new Set(knowledgeCardsOf(input.cards).map((card) => card.id));

  const placeOne = (seed: RelatedDiagramCard, allowIntegrationLayout: boolean) => {
    const live = cards.find((card) => card.id === seed.id) ?? seed;
    const liveNps = discoverNursingProblemCards(cards);
    const { placed, decision } = evaluateNp({
      np: live,
      cards,
      connections: input.connections,
      nps: liveNps,
      routeState,
      topology,
      allowIntegrationLayout,
    });
    decisions.push(decision);
    if (!decision.moved) return;
    const nextCards = cards.map((card) => (card.id === placed.id ? placed : card));
    if (nextCards.some((card) => {
      if (!knowledgeIds.has(card.id)) return false;
      const prev = input.cards.find((item) => item.id === card.id);
      return (
        !!prev &&
        (prev.layout.x !== card.layout.x || prev.layout.y !== card.layout.y)
      );
    })) {
      return;
    }
    const affected = collectArrangeAffectedConnectionIds({
      previousCards: cards,
      nextCards,
      connections: input.connections,
      topology,
      previousTopology: topology,
      activeUnitCardIds: [],
    });
    const stitched =
      affected.length > 0
        ? restitchAffectedRoutes({
            previous: routeState,
            previousTopology: topology,
            cards: nextCards,
            connections: input.connections,
            topology,
            affectedIds: affected,
          })
        : { routeState, topology };
    cards = nextCards;
    routeState = stitched.routeState;
    topology = stitched.topology;
    movedNpIds.add(placed.id);
  };

  for (const seed of basisNps) {
    placeOne(seed, false);
  }
  for (const seed of integrationNps) {
    const sources = visibleIncoming(input.connections, seed.id).map(
      (conn) => conn.sourceCardId,
    );
    placeOne(
      seed,
      sources.some((id) => movedNpIds.has(id)),
    );
  }

  const changedCardIds = cards
    .filter((card) => {
      const prev = input.cards.find((item) => item.id === card.id);
      return !prev || prev.layout.x !== card.layout.x || prev.layout.y !== card.layout.y;
    })
    .map((card) => card.id)
    .sort(compareId);
  if (changedCardIds.some((id) => knowledgeIds.has(id))) {
    return {
      cards: input.cards,
      routeState: input.routeState,
      topology: input.topology,
      changedCardIds: [],
      routeChanged: false,
      decisions,
    };
  }
  const routeChanged = !routesEqual(input.routeState, routeState);
  if (positionsEqual(input.cards, cards) && !routeChanged) {
    return {
      cards: input.cards,
      routeState: input.routeState,
      topology: input.topology,
      changedCardIds: [],
      routeChanged: false,
      decisions,
    };
  }
  return {
    cards,
    routeState,
    topology,
    changedCardIds,
    routeChanged,
    decisions,
  };
}
