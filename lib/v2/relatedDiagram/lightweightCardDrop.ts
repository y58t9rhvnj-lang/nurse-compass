/**
 * Phase 2-1 — lightweight card drop.
 * Incident connections only. No scene reseed.
 * Student AUTO pointerup uses decideStudentConnectionRoute (Slice B).
 * Drag preview stays CDP / rubber-band.
 */

import { getA3LegendBounds } from "./a3Legend";
import {
  applyStudentAutoQualityReroute,
  isStudentAutoQualityRerouteTarget,
} from "./autoCardMoveQualityReroute";
import {
  listIncidentConnectionIds,
  rubberBandIncident,
  type CardDragIncidentSnapshot,
  type IncidentRoutePreview,
} from "./cardDragTransient";
import {
  clonePoints,
  type StableRouteState,
  type StoredRouteGeometry,
} from "./incrementalRoutes";
import {
  LIGHTWEIGHT_INITIAL_CANDIDATE_LIMIT,
  pickLightweightAutoRoute,
} from "./lightweightInitialRoute";
import {
  classifyRouteInteractions,
  edgeMidpoint,
  isOrthogonalPolyline,
  type EdgeSide,
  type Point,
  type RoutedConnection,
} from "./orthogonalRouting";
import {
  cardObstacle,
  validateOrthogonalRoute,
} from "./routeHardening";
import {
  isJunctionOwnedConnection,
  isStudentManualRoute,
  type RelatedDiagramRouteTopology,
} from "./routeTopology";
import type {
  RelatedDiagramCard,
  RelatedDiagramConnection,
} from "./types";

const PIN_EPS = 0.51;

export type LightweightCardDropStats = {
  totalMs: number;
  incidentCount: number;
  manualCount: number;
  autoCount: number;
  junctionCount: number;
  qualityCandidateCalls: number;
  qualityPlannerCalls: number;
  pathfindCalls: number;
  qualityEvalCalls: number;
  qualityRerouteCount: number;
  qualityRerouteFailedCount: number;
  priorCrossingChecks: 0;
  classifyCalls: number;
  classifyMs: number;
  bridgeMs: number;
  topologyMs: number;
  candidateCount: number;
  maxCandidatesPerAuto: number;
  adoptedPreviewCount: number;
  lightweightFallbackCount: number;
  changedConnectionIds: string[];
  connectionMs: Record<string, number>;
  seedAllCalls: 0;
  arrangeCalls: 0;
};

export type LightweightCardDropResult = {
  state: StableRouteState;
  topology?: RelatedDiagramRouteTopology;
  stats: LightweightCardDropStats;
};

function near(a: Point, b: Point, eps = PIN_EPS): boolean {
  return Math.abs(a.x - b.x) <= eps && Math.abs(a.y - b.y) <= eps;
}

function livePin(card: RelatedDiagramCard, edge: EdgeSide): Point {
  return edgeMidpoint(card.layout, edge);
}

function makeStored(
  conn: RelatedDiagramConnection,
  source: RelatedDiagramCard,
  target: RelatedDiagramCard,
  sourceEdge: EdgeSide,
  targetEdge: EdgeSide,
  points: Point[],
): StoredRouteGeometry {
  return {
    connectionId: conn.id,
    sourceCardId: source.id,
    targetCardId: target.id,
    sourceEdge,
    targetEdge,
    sourcePin: livePin(source, sourceEdge),
    targetPin: livePin(target, targetEdge),
    points: clonePoints(points),
  };
}

function snapshotFromStored(
  conn: RelatedDiagramConnection,
  stored: StoredRouteGeometry,
  movedCardId: string,
  topology?: RelatedDiagramRouteTopology,
): CardDragIncidentSnapshot {
  const isSource = conn.sourceCardId === movedCardId;
  const bp = topology?.branchPoints.find((row) =>
    row.connectionIds.includes(conn.id),
  );
  return {
    connectionId: conn.id,
    sourceCardId: conn.sourceCardId,
    targetCardId: conn.targetCardId,
    sourceEdge: stored.sourceEdge,
    targetEdge: stored.targetEdge,
    points: clonePoints(stored.points),
    movingEnd: isSource ? "source" : "target",
    junctionAnchor:
      bp && isJunctionOwnedConnection(topology, conn.id)
        ? { x: bp.x, y: bp.y }
        : null,
  };
}

export function isUsableAutoPreview(
  preview: { sourceEdge: EdgeSide; targetEdge: EdgeSide; points: Point[] },
  source: RelatedDiagramCard,
  target: RelatedDiagramCard,
  cards: RelatedDiagramCard[],
): boolean {
  if (preview.points.length < 2) return false;
  if (!isOrthogonalPolyline(preview.points)) return false;
  const sourcePin = livePin(source, preview.sourceEdge);
  const targetPin = livePin(target, preview.targetEdge);
  const first = preview.points[0]!;
  const last = preview.points[preview.points.length - 1]!;
  if (!near(first, sourcePin) || !near(last, targetPin)) return false;
  return validateOrthogonalRoute({
    points: preview.points,
    sourcePin,
    targetPin,
    obstacles: [...cards.map(cardObstacle), { id: "__legend", ...getA3LegendBounds() }],
    sourceCardId: source.id,
    targetCardId: target.id,
    clearance: 0,
    sourceEdge: preview.sourceEdge,
    targetEdge: preview.targetEdge,
  }).ok;
}

function adoptLightweightAutoIncident(input: {
  conn: RelatedDiagramConnection;
  source: RelatedDiagramCard;
  target: RelatedDiagramCard;
  cards: RelatedDiagramCard[];
  prev?: StoredRouteGeometry;
  preview?: IncidentRoutePreview;
  movedCardId: string;
  topology?: RelatedDiagramRouteTopology;
}): {
  stored: StoredRouteGeometry;
  adoptedPreview: boolean;
  lightweightFallback: boolean;
  candidates: number;
} {
  const storedEdges = {
    sourceEdge: input.preview?.sourceEdge ?? input.prev?.sourceEdge ?? "right",
    targetEdge: input.preview?.targetEdge ?? input.prev?.targetEdge ?? "left",
  };
  const moved =
    input.cards.find((card) => card.id === input.movedCardId) ?? input.source;
  const rubber = input.prev
    ? rubberBandIncident(
        snapshotFromStored(
          input.conn,
          input.prev,
          input.movedCardId,
          input.topology,
        ),
        moved,
      )
    : null;
  const previewCandidate = input.preview ?? rubber;
  if (
    previewCandidate &&
    isUsableAutoPreview(previewCandidate, input.source, input.target, input.cards)
  ) {
    return {
      stored: makeStored(
        input.conn,
        input.source,
        input.target,
        previewCandidate.sourceEdge,
        previewCandidate.targetEdge,
        previewCandidate.points,
      ),
      adoptedPreview: true,
      lightweightFallback: false,
      candidates: 0,
    };
  }
  const picked = pickLightweightAutoRoute({
    source: input.source,
    target: input.target,
    cards: input.cards,
    sourceEdge: storedEdges.sourceEdge,
    targetEdge: storedEdges.targetEdge,
  });
  return {
    stored: makeStored(
      input.conn,
      input.source,
      input.target,
      picked.sourceEdge,
      picked.targetEdge,
      picked.points,
    ),
    adoptedPreview: false,
    lightweightFallback: true,
    candidates: Math.min(picked.candidates, LIGHTWEIGHT_INITIAL_CANDIDATE_LIMIT),
  };
}

function updateManualTopologyRoutes(
  topology: RelatedDiagramRouteTopology,
  byId: Record<string, StoredRouteGeometry>,
  manualIds: Set<string>,
): RelatedDiagramRouteTopology {
  if (manualIds.size === 0) return topology;
  let changed = false;
  const routes = topology.routes.map((route) => {
    if (!manualIds.has(route.connectionId)) return route;
    const stored = byId[route.connectionId];
    if (!stored) return route;
    changed = true;
    return {
      ...route,
      sourceEdge: stored.sourceEdge,
      targetEdge: stored.targetEdge,
      points: clonePoints(stored.points),
    };
  });
  return changed ? { ...topology, routes } : topology;
}

export function applyLightweightCardDrop(input: {
  previous: StableRouteState;
  cards: RelatedDiagramCard[];
  connections: RelatedDiagramConnection[];
  topology?: RelatedDiagramRouteTopology;
  movedCardId: string;
  previews?: IncidentRoutePreview[];
}): LightweightCardDropResult {
  const started = performance.now();
  const moved = input.cards.find((card) => card.id === input.movedCardId);
  const incidentIds = listIncidentConnectionIds(
    input.connections,
    input.movedCardId,
  );
  const previewById = new Map(
    (input.previews ?? []).map((row) => [row.connectionId, row]),
  );
  const cardById = new Map(input.cards.map((card) => [card.id, card]));
  const nextById: Record<string, StoredRouteGeometry> = { ...input.previous.byId };
  const lastValidPoints = { ...input.previous.lastValidPoints };
  const invalidReasons = { ...input.previous.invalidReasons };
  const manualChanged = new Set<string>();
  const changedConnectionIds: string[] = [];
  const connectionMs: Record<string, number> = {};
  let manualCount = 0;
  let autoCount = 0;
  let junctionCount = 0;
  let candidateCount = 0;
  let maxCandidatesPerAuto = 0;
  let adoptedPreviewCount = 0;
  let lightweightFallbackCount = 0;
  let qualityPlannerCalls = 0;
  let qualityCandidateCalls = 0;
  let pathfindCalls = 0;
  let qualityEvalCalls = 0;
  let qualityRerouteCount = 0;
  let qualityRerouteFailedCount = 0;
  const studentAutoIds: string[] = [];

  if (moved) {
    for (const connectionId of incidentIds) {
      const connT0 = performance.now();
      const conn = input.connections.find((row) => row.id === connectionId);
      if (!conn) continue;
      const source = cardById.get(conn.sourceCardId);
      const target = cardById.get(conn.targetCardId);
      if (!source || !target) continue;
      const prev = input.previous.byId[connectionId];
      const preview = previewById.get(connectionId);
      const junctionOwned = isJunctionOwnedConnection(
        input.topology,
        connectionId,
      );
      const manual = isStudentManualRoute(input.topology, conn);

      if (junctionOwned) {
        junctionCount += 1;
        const storedEdges = {
          sourceEdge: preview?.sourceEdge ?? prev?.sourceEdge ?? "right",
          targetEdge: preview?.targetEdge ?? prev?.targetEdge ?? "left",
        };
        const points = preview
          ? clonePoints(preview.points)
          : prev
            ? rubberBandIncident(
                snapshotFromStored(conn, prev, input.movedCardId, input.topology),
                moved,
              ).points
            : [
                livePin(source, storedEdges.sourceEdge),
                livePin(target, storedEdges.targetEdge),
              ];
        nextById[connectionId] = makeStored(
          conn,
          source,
          target,
          storedEdges.sourceEdge,
          storedEdges.targetEdge,
          points,
        );
        lastValidPoints[connectionId] = clonePoints(points);
        delete invalidReasons[connectionId];
        changedConnectionIds.push(connectionId);
        connectionMs[connectionId] = performance.now() - connT0;
        continue;
      }

      if (manual) {
        manualCount += 1;
        const storedEdges = {
          sourceEdge: preview?.sourceEdge ?? prev?.sourceEdge ?? "right",
          targetEdge: preview?.targetEdge ?? prev?.targetEdge ?? "left",
        };
        const points = preview
          ? clonePoints(preview.points)
          : prev
            ? rubberBandIncident(
                snapshotFromStored(conn, prev, input.movedCardId, input.topology),
                moved,
              ).points
            : [
                livePin(source, storedEdges.sourceEdge),
                livePin(target, storedEdges.targetEdge),
              ];
        nextById[connectionId] = makeStored(
          conn,
          source,
          target,
          storedEdges.sourceEdge,
          storedEdges.targetEdge,
          points,
        );
        lastValidPoints[connectionId] = clonePoints(points);
        delete invalidReasons[connectionId];
        manualChanged.add(connectionId);
        changedConnectionIds.push(connectionId);
        if (preview) adoptedPreviewCount += 1;
        connectionMs[connectionId] = performance.now() - connT0;
        continue;
      }

      if (isStudentAutoQualityRerouteTarget(input.topology, conn)) {
        studentAutoIds.push(connectionId);
        connectionMs[connectionId] = performance.now() - connT0;
        continue;
      }

      autoCount += 1;
      const adopted = adoptLightweightAutoIncident({
        conn,
        source,
        target,
        cards: input.cards,
        prev,
        preview,
        movedCardId: input.movedCardId,
        topology: input.topology,
      });
      nextById[connectionId] = adopted.stored;
      lastValidPoints[connectionId] = clonePoints(adopted.stored.points);
      delete invalidReasons[connectionId];
      if (adopted.adoptedPreview) adoptedPreviewCount += 1;
      if (adopted.lightweightFallback) {
        lightweightFallbackCount += 1;
        candidateCount += adopted.candidates;
        maxCandidatesPerAuto = Math.max(maxCandidatesPerAuto, adopted.candidates);
      }
      changedConnectionIds.push(connectionId);
      connectionMs[connectionId] = performance.now() - connT0;
    }

    if (studentAutoIds.length > 0) {
      const quality = applyStudentAutoQualityReroute({
        cards: input.cards,
        connections: input.connections,
        topology: input.topology,
        routeState: {
          byId: nextById,
          lastValidPoints,
          invalidReasons,
          bridges: input.previous.bridges,
          qualityTrace: input.previous.qualityTrace,
        },
        connectionIds: studentAutoIds,
      });
      qualityPlannerCalls += quality.stats.qualityPlannerCalls;
      qualityCandidateCalls += quality.stats.qualityCandidateCalls;
      pathfindCalls += quality.stats.pathfindCalls;
      qualityEvalCalls += quality.stats.qualityEvalCalls;
      qualityRerouteCount += quality.stats.qualityRerouteCount;
      qualityRerouteFailedCount += quality.stats.qualityRerouteFailedCount;
      for (const connectionId of quality.reroutedIds) {
        const stored = quality.storedById[connectionId];
        if (!stored) continue;
        const conn = input.connections.find((row) => row.id === connectionId);
        if (conn) autoCount += 1;
        nextById[connectionId] = stored;
        lastValidPoints[connectionId] = clonePoints(stored.points);
        delete invalidReasons[connectionId];
        changedConnectionIds.push(connectionId);
        connectionMs[connectionId] =
          (connectionMs[connectionId] ?? 0) +
          (quality.stats.connectionMs[connectionId] ?? 0);
      }
      for (const connectionId of quality.failedIds) {
        const conn = input.connections.find((row) => row.id === connectionId);
        const source = conn ? cardById.get(conn.sourceCardId) : undefined;
        const target = conn ? cardById.get(conn.targetCardId) : undefined;
        if (!conn || !source || !target) continue;
        autoCount += 1;
        const adopted = adoptLightweightAutoIncident({
          conn,
          source,
          target,
          cards: input.cards,
          prev: input.previous.byId[connectionId],
          preview: previewById.get(connectionId),
          movedCardId: input.movedCardId,
          topology: input.topology,
        });
        nextById[connectionId] = adopted.stored;
        lastValidPoints[connectionId] = clonePoints(adopted.stored.points);
        delete invalidReasons[connectionId];
        if (adopted.adoptedPreview) adoptedPreviewCount += 1;
        if (adopted.lightweightFallback) {
          lightweightFallbackCount += 1;
          candidateCount += adopted.candidates;
          maxCandidatesPerAuto = Math.max(
            maxCandidatesPerAuto,
            adopted.candidates,
          );
        }
        changedConnectionIds.push(connectionId);
        connectionMs[connectionId] =
          (connectionMs[connectionId] ?? 0) +
          (quality.stats.connectionMs[connectionId] ?? 0);
      }
    }
  }

  const classifyT0 = performance.now();
  const routed: RoutedConnection[] = Object.values(nextById)
    .map((row) => ({
      connectionId: row.connectionId,
      sourceCardId: row.sourceCardId,
      targetCardId: row.targetCardId,
      sourceEdge: row.sourceEdge,
      targetEdge: row.targetEdge,
      points: row.points,
    }))
    .sort((a, b) => (a.connectionId < b.connectionId ? -1 : 1));
  const classified = classifyRouteInteractions(
    routed,
    input.cards,
    input.topology,
  );
  const classifyMs = performance.now() - classifyT0;

  const topologyT0 = performance.now();
  const nextTopology = input.topology
    ? updateManualTopologyRoutes(input.topology, nextById, manualChanged)
    : input.topology;
  const topologyMs = performance.now() - topologyT0;

  const state: StableRouteState = {
    byId: nextById,
    lastValidPoints,
    invalidReasons,
    bridges: classified.bridges,
    qualityTrace: input.previous.qualityTrace,
  };

  return {
    state,
    topology: nextTopology,
    stats: {
      totalMs: performance.now() - started,
      incidentCount: incidentIds.length,
      manualCount,
      autoCount,
      junctionCount,
      qualityCandidateCalls,
      qualityPlannerCalls,
      pathfindCalls,
      qualityEvalCalls,
      qualityRerouteCount,
      qualityRerouteFailedCount,
      priorCrossingChecks: 0,
      classifyCalls: 1,
      classifyMs,
      bridgeMs: classifyMs,
      topologyMs,
      candidateCount,
      maxCandidatesPerAuto,
      adoptedPreviewCount,
      lightweightFallbackCount,
      changedConnectionIds,
      connectionMs,
      seedAllCalls: 0,
      arrangeCalls: 0,
    },
  };
}
