/**
 * Lightweight AUTO router for initial StableRouteState seed.
 * Does not replace the high-quality planner / Arrange / D0–D3.
 */

import { getA3LegendBounds } from "./a3Legend";
import {
  firstSegmentFacesEdge,
  lastSegmentFacesEdge,
} from "./geometryGuard";
import {
  classifyRouteInteractions,
  chooseCardEdges,
  edgeMidpoint,
  isOrthogonalPolyline,
  outwardPoint,
  type EdgeSide,
  type InvalidPlannedRoute,
  type OrthogonalRoutePlan,
  type Point,
  type RoutedConnection,
} from "./orthogonalRouting";
import {
  MIN_ENDPOINT_STUB,
  cardObstacle,
  normalizeOrthogonalPolyline,
  validateOrthogonalRoute,
} from "./routeHardening";
import {
  hasExplicitConnectionRoute,
  isJunctionOwnedConnection,
  isStudentManualRoute,
  type RelatedDiagramRouteTopology,
} from "./routeTopology";
import type {
  RelatedDiagramCard,
  RelatedDiagramConnection,
} from "./types";

export const LIGHTWEIGHT_INITIAL_CANDIDATE_LIMIT = 6;

export type LightweightInitialStats = {
  candidateCount: number;
  autoConnectionCount: number;
  authoredConnectionCount: number;
  legalFacingAdoptedCount: number;
  edgeTangentFallbackCount: number;
  classifyCalls: number;
  qualityPlannerCalls: 0;
  pathfinderCalls: 0;
  priorCrossingChecks: 0;
};

export type LightweightInitialPlan = OrthogonalRoutePlan & {
  stats: LightweightInitialStats;
};

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

function candidateKey(points: Point[]): string {
  return points.map((point) => `${Math.round(point.x)}:${Math.round(point.y)}`).join("|");
}

export function generateLightweightInitialCandidates(
  sourcePin: Point,
  targetPin: Point,
  sourceEdge: EdgeSide,
  targetEdge: EdgeSide,
): Point[][] {
  const a = outwardPoint(sourcePin, sourceEdge, MIN_ENDPOINT_STUB);
  const b = outwardPoint(targetPin, targetEdge, MIN_ENDPOINT_STUB);
  const raw = [
    hvPath(sourcePin, targetPin),
    vhPath(sourcePin, targetPin),
    [sourcePin, a, ...hvPath(a, b).slice(1, -1), b, targetPin],
    [sourcePin, a, ...vhPath(a, b).slice(1, -1), b, targetPin],
    [sourcePin, a, { x: targetPin.x, y: a.y }, targetPin],
    [sourcePin, a, { x: a.x, y: targetPin.y }, targetPin],
  ];
  const seen = new Set<string>();
  const out: Point[][] = [];
  for (const points of raw) {
    if (out.length >= LIGHTWEIGHT_INITIAL_CANDIDATE_LIMIT) break;
    const normalized = normalizeOrthogonalPolyline(points, sourcePin, targetPin);
    if (normalized.length < 2 || !isOrthogonalPolyline(normalized)) continue;
    const key = candidateKey(normalized);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }
  return out;
}

function authoredRoute(
  topology: RelatedDiagramRouteTopology | undefined,
  connection: RelatedDiagramConnection,
): { sourceEdge: EdgeSide; targetEdge: EdgeSide; points: Point[] } | null {
  const preset = topology?.routes.find(
    (route) => route.connectionId === connection.id,
  );
  if (!preset || preset.points.length < 2) return null;
  if (
    isStudentManualRoute(topology, connection) ||
    isJunctionOwnedConnection(topology, connection.id) ||
    hasExplicitConnectionRoute(topology, connection.id)
  ) {
    return {
      sourceEdge: preset.sourceEdge,
      targetEdge: preset.targetEdge,
      points: preset.points.map((point) => ({ x: point.x, y: point.y })),
    };
  }
  return null;
}

export function pickLightweightAutoRoute(input: {
  source: RelatedDiagramCard;
  target: RelatedDiagramCard;
  cards: RelatedDiagramCard[];
  sourceEdge?: EdgeSide;
  targetEdge?: EdgeSide;
}): {
  sourceEdge: EdgeSide;
  targetEdge: EdgeSide;
  points: Point[];
  candidates: number;
  legal: boolean;
  reasons: string[];
} {
  const chosen = chooseCardEdges(input.source, input.target);
  const edges = {
    sourceEdge: input.sourceEdge ?? chosen.sourceEdge,
    targetEdge: input.targetEdge ?? chosen.targetEdge,
  };
  const sourcePin = edgeMidpoint(input.source.layout, edges.sourceEdge);
  const targetPin = edgeMidpoint(input.target.layout, edges.targetEdge);
  const candidates = generateLightweightInitialCandidates(
    sourcePin,
    targetPin,
    edges.sourceEdge,
    edges.targetEdge,
  );
  const obstacles = [
    ...input.cards.map(cardObstacle),
    { id: "__legend", ...getA3LegendBounds() },
  ];
  let fallback = candidates[0] ?? [sourcePin, targetPin];
  for (const points of candidates) {
    const validation = validateOrthogonalRoute({
      points,
      sourcePin,
      targetPin,
      obstacles,
      sourceCardId: input.source.id,
      targetCardId: input.target.id,
      clearance: 0,
      sourceEdge: edges.sourceEdge,
      targetEdge: edges.targetEdge,
    });
    if (validation.ok) {
      return {
        sourceEdge: edges.sourceEdge,
        targetEdge: edges.targetEdge,
        points,
        candidates: candidates.length,
        legal: true,
        reasons: [],
      };
    }
    if (points === candidates[0]) fallback = points;
  }
  const failed = validateOrthogonalRoute({
    points: fallback,
    sourcePin,
    targetPin,
    obstacles,
    sourceCardId: input.source.id,
    targetCardId: input.target.id,
    clearance: 0,
    sourceEdge: edges.sourceEdge,
    targetEdge: edges.targetEdge,
  });
  return {
    sourceEdge: edges.sourceEdge,
    targetEdge: edges.targetEdge,
    points: fallback,
    candidates: candidates.length,
    legal: false,
    reasons: failed.reasons.length ? failed.reasons : ["no-legal-route"],
  };
}

function seedObstacles(cards: RelatedDiagramCard[]) {
  return [...cards.map(cardObstacle), { id: "__legend", ...getA3LegendBounds() }];
}

/** Initial seed only. Shared Card Drop pick stays first-legal. */
function pickLightweightInitialSeedRoute(input: {
  source: RelatedDiagramCard;
  target: RelatedDiagramCard;
  cards: RelatedDiagramCard[];
}): ReturnType<typeof pickLightweightAutoRoute> & {
  adoptedLegalFacing: boolean;
} {
  const chosen = chooseCardEdges(input.source, input.target);
  const sourcePin = edgeMidpoint(input.source.layout, chosen.sourceEdge);
  const targetPin = edgeMidpoint(input.target.layout, chosen.targetEdge);
  const candidates = generateLightweightInitialCandidates(
    sourcePin,
    targetPin,
    chosen.sourceEdge,
    chosen.targetEdge,
  );
  const obstacles = seedObstacles(input.cards);
  for (const points of candidates) {
    const validation = validateOrthogonalRoute({
      points,
      sourcePin,
      targetPin,
      obstacles,
      sourceCardId: input.source.id,
      targetCardId: input.target.id,
      clearance: 0,
      sourceEdge: chosen.sourceEdge,
      targetEdge: chosen.targetEdge,
    });
    if (
      validation.ok &&
      firstSegmentFacesEdge(points, chosen.sourceEdge) &&
      lastSegmentFacesEdge(points, chosen.targetEdge)
    ) {
      return {
        sourceEdge: chosen.sourceEdge,
        targetEdge: chosen.targetEdge,
        points,
        candidates: candidates.length,
        legal: true,
        reasons: [],
        adoptedLegalFacing: true,
      };
    }
  }
  return {
    ...pickLightweightAutoRoute(input),
    adoptedLegalFacing: false,
  };
}

export function planLightweightInitialRoutes(
  cards: RelatedDiagramCard[],
  connections: RelatedDiagramConnection[],
  topology?: RelatedDiagramRouteTopology,
): LightweightInitialPlan {
  const byId = new Map(cards.map((card) => [card.id, card]));
  const ordered = [...connections].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );
  const routes: RoutedConnection[] = [];
  const invalidRoutes: InvalidPlannedRoute[] = [];
  let candidateCount = 0;
  let autoConnectionCount = 0;
  let authoredConnectionCount = 0;
  let legalFacingAdoptedCount = 0;
  let edgeTangentFallbackCount = 0;

  for (const connection of ordered) {
    const source = byId.get(connection.sourceCardId);
    const target = byId.get(connection.targetCardId);
    if (!source || !target || source.id === target.id) continue;
    const preset = authoredRoute(topology, connection);
    if (preset) {
      authoredConnectionCount += 1;
      routes.push({
        connectionId: connection.id,
        sourceCardId: source.id,
        targetCardId: target.id,
        sourceEdge: preset.sourceEdge,
        targetEdge: preset.targetEdge,
        points: preset.points,
      });
      continue;
    }
    const picked = pickLightweightInitialSeedRoute({ source, target, cards });
    autoConnectionCount += 1;
    candidateCount += picked.candidates;
    if (picked.adoptedLegalFacing) legalFacingAdoptedCount += 1;
    else edgeTangentFallbackCount += 1;
    const routed: RoutedConnection = {
      connectionId: connection.id,
      sourceCardId: source.id,
      targetCardId: target.id,
      sourceEdge: picked.sourceEdge,
      targetEdge: picked.targetEdge,
      points: picked.points,
    };
    routes.push(routed);
    if (!picked.legal) {
      invalidRoutes.push({
        ...routed,
        reasons: picked.reasons,
      });
    }
  }

  const classified = classifyRouteInteractions(routes, cards, topology);
  return {
    routes,
    bridges: classified.bridges,
    junctions: classified.junctions,
    invalidRoutes,
    stats: {
      candidateCount,
      autoConnectionCount,
      authoredConnectionCount,
      legalFacingAdoptedCount,
      edgeTangentFallbackCount,
      classifyCalls: 1,
      qualityPlannerCalls: 0,
      pathfinderCalls: 0,
      priorCrossingChecks: 0,
    },
  };
}
