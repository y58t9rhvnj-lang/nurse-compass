/**
 * Slice B — AUTO card-move pointerup quality reroute.
 * Reuses decideStudentConnectionRoute. Does not write topology.routes.
 */

import {
  decideStudentConnectionRoute,
  studentConnectionRouteAccepted,
} from "./cardConnectionCreate";
import {
  clonePoints,
  cloneStableRouteState,
  type StableRouteState,
  type StoredRouteGeometry,
} from "./incrementalRoutes";
import {
  isJunctionOwnedConnection,
  isStudentManualRoute,
  type RelatedDiagramRouteTopology,
} from "./routeTopology";
import type {
  RelatedDiagramCard,
  RelatedDiagramConnection,
} from "./types";

export type StudentAutoQualityRerouteStats = {
  qualityPlannerCalls: number;
  qualityCandidateCalls: number;
  pathfindCalls: number;
  qualityEvalCalls: number;
  qualityRerouteCount: number;
  qualityRerouteFailedCount: number;
  connectionMs: Record<string, number>;
};

export type StudentAutoQualityRerouteResult = {
  routeState: StableRouteState;
  storedById: Record<string, StoredRouteGeometry>;
  reroutedIds: string[];
  failedIds: string[];
  stats: StudentAutoQualityRerouteStats;
};

export function isStudentAutoQualityRerouteTarget(
  topology: RelatedDiagramRouteTopology | undefined,
  connection: { id: string; origin: string },
): boolean {
  if (connection.origin !== "student_diagram") return false;
  if (isJunctionOwnedConnection(topology, connection.id)) return false;
  if (isStudentManualRoute(topology, connection)) return false;
  return true;
}

function cloneStored(stored: StoredRouteGeometry): StoredRouteGeometry {
  return {
    ...stored,
    sourcePin: { ...stored.sourcePin },
    targetPin: { ...stored.targetPin },
    points: clonePoints(stored.points),
  };
}

export function applyStudentAutoQualityReroute(input: {
  cards: RelatedDiagramCard[];
  connections: RelatedDiagramConnection[];
  topology?: RelatedDiagramRouteTopology;
  routeState: StableRouteState;
  connectionIds: readonly string[];
}): StudentAutoQualityRerouteResult {
  const byId = new Map(input.connections.map((row) => [row.id, row]));
  const next = cloneStableRouteState(input.routeState);
  const storedById: Record<string, StoredRouteGeometry> = {};
  const reroutedIds: string[] = [];
  const failedIds: string[] = [];
  const connectionMs: Record<string, number> = {};
  let qualityPlannerCalls = 0;
  let qualityCandidateCalls = 0;
  let pathfindCalls = 0;
  let qualityEvalCalls = 0;

  for (const connectionId of input.connectionIds) {
    const connection = byId.get(connectionId);
    if (!connection || !isStudentAutoQualityRerouteTarget(input.topology, connection)) {
      continue;
    }
    const started = performance.now();
    const decision = decideStudentConnectionRoute({
      cards: input.cards,
      connection,
      topology: input.topology,
      routeState: next,
    });
    qualityPlannerCalls += 1;
    qualityCandidateCalls += decision.normalGeneratedCount;
    pathfindCalls += decision.pathfinderCalls;
    qualityEvalCalls += decision.evaluateCount;
    connectionMs[connectionId] = performance.now() - started;
    if (
      !decision.stored ||
      !studentConnectionRouteAccepted(decision.plan, connection.id)
    ) {
      failedIds.push(connectionId);
      continue;
    }
    const stored = cloneStored(decision.stored);
    next.byId[connection.id] = stored;
    next.lastValidPoints[connection.id] = clonePoints(stored.points);
    delete next.invalidReasons[connection.id];
    storedById[connection.id] = stored;
    reroutedIds.push(connectionId);
  }

  return {
    routeState: next,
    storedById,
    reroutedIds,
    failedIds,
    stats: {
      qualityPlannerCalls,
      qualityCandidateCalls,
      pathfindCalls,
      qualityEvalCalls,
      qualityRerouteCount: reroutedIds.length,
      qualityRerouteFailedCount: failedIds.length,
      connectionMs,
    },
  };
}
