/**
 * Related Diagram Persistence P1 — routeScene v1 contract.
 * Pure serialize / restore. No DB, no Editor wiring, no routers.
 *
 * lastValidPoints is a session fallback for incremental repair
 * (see incrementalRoutes). It is not authored geometry. Restore
 * rebuilds it from restored points.
 */

import {
  clonePoints,
  type StableRouteState,
  type StoredRouteGeometry,
} from "./incrementalRoutes";
import {
  classifyRouteInteractions,
  isOrthogonalPolyline,
  type EdgeSide,
  type Point,
} from "./orthogonalRouting";
import {
  emptyRouteTopology,
  ROUTE_TOPOLOGY_SCHEMA,
  type ExplicitBranchPoint,
  type ExplicitConnectionRoute,
  type ExplicitRouteGroup,
  type ExplicitSharedTrunk,
  type RelatedDiagramRouteTopology,
} from "./routeTopology";
import type {
  RelatedDiagramConnection,
  RelatedDiagramSemanticGraph,
} from "./types";

export const ROUTE_SCENE_SCHEMA = "rd.routeScene.v1" as const;
export const ROUTE_SCENE_SCHEMA_VERSION = 1 as const;

const EDGE_SIDES = new Set<EdgeSide>(["top", "right", "bottom", "left"]);

export type RouteScenePersistedRoute = {
  connectionId: string;
  sourceCardId: string;
  targetCardId: string;
  sourceEdge: EdgeSide;
  targetEdge: EdgeSide;
  sourcePin: Point;
  targetPin: Point;
  points: Point[];
};

export type RelatedDiagramRouteSceneV1 = {
  schema: typeof ROUTE_SCENE_SCHEMA;
  schemaVersion: typeof ROUTE_SCENE_SCHEMA_VERSION;
  routes: RouteScenePersistedRoute[];
  topology: RelatedDiagramRouteTopology;
};

export type RouteSceneDiagnostics = {
  unsupportedSchema: boolean;
  schema?: string;
  schemaVersion?: unknown;
  restoredRouteIds: string[];
  missingRouteIds: string[];
  invalidRouteIds: string[];
  orphanRouteIds: string[];
  invalidReasons: Record<string, string[]>;
};

export type RestoreRouteSceneResult = {
  supported: boolean;
  routeState: StableRouteState;
  topology: RelatedDiagramRouteTopology;
  diagnostics: RouteSceneDiagnostics;
};

function clonePoint(point: Point): Point {
  return { x: point.x, y: point.y };
}

function clonePersistedRoute(route: RouteScenePersistedRoute): RouteScenePersistedRoute {
  return {
    connectionId: route.connectionId,
    sourceCardId: route.sourceCardId,
    targetCardId: route.targetCardId,
    sourceEdge: route.sourceEdge,
    targetEdge: route.targetEdge,
    sourcePin: clonePoint(route.sourcePin),
    targetPin: clonePoint(route.targetPin),
    points: clonePoints(route.points),
  };
}

function sortById<T extends { id: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function sortIds(ids: string[]): string[] {
  return [...ids].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function cloneTopologyCanonical(
  topology: RelatedDiagramRouteTopology | undefined,
): RelatedDiagramRouteTopology {
  const base = topology ?? emptyRouteTopology();
  return {
    schema: ROUTE_TOPOLOGY_SCHEMA,
    trunks: sortById(base.trunks).map((row) => ({
      id: row.id,
      branchPointId: row.branchPointId,
      points: clonePoints(row.points),
      connectionIds: sortIds(row.connectionIds),
    })),
    branchPoints: sortById(base.branchPoints).map((row) => ({
      id: row.id,
      x: row.x,
      y: row.y,
      connectionIds: sortIds(row.connectionIds),
    })),
    routeGroups: sortById(base.routeGroups).map((row) => ({
      id: row.id,
      sourceCardId: row.sourceCardId,
      trunkId: row.trunkId,
      connectionIds: sortIds(row.connectionIds),
    })),
    routes: [...base.routes]
      .sort((a, b) =>
        a.connectionId < b.connectionId
          ? -1
          : a.connectionId > b.connectionId
            ? 1
            : 0,
      )
      .map((row) => ({
        connectionId: row.connectionId,
        sourceEdge: row.sourceEdge,
        targetEdge: row.targetEdge,
        points: clonePoints(row.points),
      })),
  };
}

function emptyRouteState(): StableRouteState {
  return {
    byId: {},
    lastValidPoints: {},
    invalidReasons: {},
    bridges: [],
    qualityTrace: {},
  };
}

function emptyDiagnostics(): RouteSceneDiagnostics {
  return {
    unsupportedSchema: false,
    restoredRouteIds: [],
    missingRouteIds: [],
    invalidRouteIds: [],
    orphanRouteIds: [],
    invalidReasons: {},
  };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isPoint(value: unknown): value is Point {
  if (!value || typeof value !== "object") return false;
  const row = value as { x?: unknown; y?: unknown };
  return isFiniteNumber(row.x) && isFiniteNumber(row.y);
}

function isEdgeSide(value: unknown): value is EdgeSide {
  return typeof value === "string" && EDGE_SIDES.has(value as EdgeSide);
}

function connectionById(
  graph: RelatedDiagramSemanticGraph,
): Map<string, RelatedDiagramConnection> {
  return new Map(graph.connections.map((row) => [row.id, row]));
}

function cardIdsOf(graph: RelatedDiagramSemanticGraph): Set<string> {
  return new Set(graph.cards.map((row) => row.id));
}

export function validatePersistedRoute(
  route: RouteScenePersistedRoute,
  graph: RelatedDiagramSemanticGraph,
): string[] {
  const reasons: string[] = [];
  const connection = connectionById(graph).get(route.connectionId);
  if (!connection) {
    reasons.push("orphan-connection");
    return reasons;
  }
  const cards = cardIdsOf(graph);
  if (!cards.has(connection.sourceCardId) || !cards.has(connection.targetCardId)) {
    reasons.push("missing-card");
  }
  if (
    route.sourceCardId !== connection.sourceCardId ||
    route.targetCardId !== connection.targetCardId
  ) {
    reasons.push("endpoint-mismatch");
  }
  if (!isEdgeSide(route.sourceEdge) || !isEdgeSide(route.targetEdge)) {
    reasons.push("invalid-edge");
  }
  if (!isPoint(route.sourcePin) || !isPoint(route.targetPin)) {
    reasons.push("invalid-pin");
  }
  if (!Array.isArray(route.points) || route.points.length < 2) {
    reasons.push("invalid-points");
  } else if (!route.points.every(isPoint)) {
    reasons.push("invalid-points");
  } else if (!isOrthogonalPolyline(route.points)) {
    reasons.push("non-orthogonal");
  }
  return reasons;
}

function readPersistedRoute(value: unknown): RouteScenePersistedRoute | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<RouteScenePersistedRoute>;
  if (typeof row.connectionId !== "string" || row.connectionId.length === 0) {
    return null;
  }
  if (typeof row.sourceCardId !== "string" || typeof row.targetCardId !== "string") {
    return null;
  }
  if (!isEdgeSide(row.sourceEdge) || !isEdgeSide(row.targetEdge)) return null;
  if (!isPoint(row.sourcePin) || !isPoint(row.targetPin)) return null;
  if (!Array.isArray(row.points) || !row.points.every(isPoint)) return null;
  return {
    connectionId: row.connectionId,
    sourceCardId: row.sourceCardId,
    targetCardId: row.targetCardId,
    sourceEdge: row.sourceEdge,
    targetEdge: row.targetEdge,
    sourcePin: clonePoint(row.sourcePin),
    targetPin: clonePoint(row.targetPin),
    points: clonePoints(row.points),
  };
}

function readTopology(value: unknown): RelatedDiagramRouteTopology | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<RelatedDiagramRouteTopology>;
  if (row.schema !== ROUTE_TOPOLOGY_SCHEMA) return null;
  if (
    !Array.isArray(row.trunks) ||
    !Array.isArray(row.branchPoints) ||
    !Array.isArray(row.routeGroups) ||
    !Array.isArray(row.routes)
  ) {
    return null;
  }
  const trunks: ExplicitSharedTrunk[] = [];
  for (const trunk of row.trunks) {
    if (!trunk || typeof trunk.id !== "string") return null;
    if (typeof trunk.branchPointId !== "string") return null;
    if (!Array.isArray(trunk.points) || !trunk.points.every(isPoint)) return null;
    if (!Array.isArray(trunk.connectionIds) || !trunk.connectionIds.every((id) => typeof id === "string")) {
      return null;
    }
    trunks.push({
      id: trunk.id,
      branchPointId: trunk.branchPointId,
      points: clonePoints(trunk.points),
      connectionIds: [...trunk.connectionIds],
    });
  }
  const branchPoints: ExplicitBranchPoint[] = [];
  for (const point of row.branchPoints) {
    if (!point || typeof point.id !== "string") return null;
    if (!isFiniteNumber(point.x) || !isFiniteNumber(point.y)) return null;
    if (!Array.isArray(point.connectionIds) || !point.connectionIds.every((id) => typeof id === "string")) {
      return null;
    }
    branchPoints.push({
      id: point.id,
      x: point.x,
      y: point.y,
      connectionIds: [...point.connectionIds],
    });
  }
  const routeGroups: ExplicitRouteGroup[] = [];
  for (const group of row.routeGroups) {
    if (!group || typeof group.id !== "string") return null;
    if (typeof group.sourceCardId !== "string" || typeof group.trunkId !== "string") {
      return null;
    }
    if (!Array.isArray(group.connectionIds) || !group.connectionIds.every((id) => typeof id === "string")) {
      return null;
    }
    routeGroups.push({
      id: group.id,
      sourceCardId: group.sourceCardId,
      trunkId: group.trunkId,
      connectionIds: [...group.connectionIds],
    });
  }
  const routes: ExplicitConnectionRoute[] = [];
  for (const route of row.routes) {
    if (!route || typeof route.connectionId !== "string") return null;
    if (!isEdgeSide(route.sourceEdge) || !isEdgeSide(route.targetEdge)) return null;
    if (!Array.isArray(route.points) || !route.points.every(isPoint)) return null;
    routes.push({
      connectionId: route.connectionId,
      sourceEdge: route.sourceEdge,
      targetEdge: route.targetEdge,
      points: clonePoints(route.points),
    });
  }
  return cloneTopologyCanonical({
    schema: ROUTE_TOPOLOGY_SCHEMA,
    trunks,
    branchPoints,
    routeGroups,
    routes,
  });
}

export function inspectRouteSceneSchema(
  input: unknown,
):
  | { ok: true; scene: RelatedDiagramRouteSceneV1 }
  | {
      ok: false;
      code: "unsupported_schema";
      schema?: string;
      schemaVersion?: unknown;
    } {
  if (!input || typeof input !== "object") {
    return { ok: false, code: "unsupported_schema" };
  }
  const row = input as { schema?: unknown; schemaVersion?: unknown };
  if (row.schema !== ROUTE_SCENE_SCHEMA || row.schemaVersion !== ROUTE_SCENE_SCHEMA_VERSION) {
    return {
      ok: false,
      code: "unsupported_schema",
      schema: typeof row.schema === "string" ? row.schema : undefined,
      schemaVersion: row.schemaVersion,
    };
  }
  const raw = input as {
    routes?: unknown;
    topology?: unknown;
  };
  if (!Array.isArray(raw.routes)) {
    return {
      ok: false,
      code: "unsupported_schema",
      schema: ROUTE_SCENE_SCHEMA,
      schemaVersion: row.schemaVersion,
    };
  }
  const topology =
    raw.topology == null
      ? emptyRouteTopology()
      : readTopology(raw.topology) ?? emptyRouteTopology();
  const routes: RouteScenePersistedRoute[] = [];
  for (const item of raw.routes) {
    const parsed = readPersistedRoute(item);
    if (parsed) routes.push(parsed);
  }
  return {
    ok: true,
    scene: {
      schema: ROUTE_SCENE_SCHEMA,
      schemaVersion: ROUTE_SCENE_SCHEMA_VERSION,
      routes: routes
        .map(clonePersistedRoute)
        .sort((a, b) =>
          a.connectionId < b.connectionId
            ? -1
            : a.connectionId > b.connectionId
              ? 1
              : 0,
        ),
      topology,
    },
  };
}

/**
 * Persist resolved geometry for every graph connection that has a
 * finite orthogonal route. Does not write AUTO into topology.routes.
 */
export function serializeRouteScene(input: {
  graph: RelatedDiagramSemanticGraph;
  routeState: StableRouteState;
  topology?: RelatedDiagramRouteTopology;
}): RelatedDiagramRouteSceneV1 {
  const connections = [...input.graph.connections].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );
  const routes: RouteScenePersistedRoute[] = [];
  for (const connection of connections) {
    const stored = input.routeState.byId[connection.id];
    if (!stored) continue;
    const candidate: RouteScenePersistedRoute = {
      connectionId: connection.id,
      sourceCardId: connection.sourceCardId,
      targetCardId: connection.targetCardId,
      sourceEdge: stored.sourceEdge,
      targetEdge: stored.targetEdge,
      sourcePin: clonePoint(stored.sourcePin),
      targetPin: clonePoint(stored.targetPin),
      points: clonePoints(stored.points),
    };
    if (validatePersistedRoute(candidate, input.graph).length > 0) continue;
    routes.push(candidate);
  }
  return {
    schema: ROUTE_SCENE_SCHEMA,
    schemaVersion: ROUTE_SCENE_SCHEMA_VERSION,
    routes,
    topology: cloneTopologyCanonical(input.topology),
  };
}

export function restoreRouteScene(input: {
  graph: RelatedDiagramSemanticGraph;
  routeScene: unknown;
}): RestoreRouteSceneResult {
  const inspected = inspectRouteSceneSchema(input.routeScene);
  if (!inspected.ok) {
    const diagnostics = emptyDiagnostics();
    diagnostics.unsupportedSchema = true;
    diagnostics.schema = inspected.schema;
    diagnostics.schemaVersion = inspected.schemaVersion;
    return {
      supported: false,
      routeState: emptyRouteState(),
      topology: emptyRouteTopology(),
      diagnostics,
    };
  }

  const diagnostics = emptyDiagnostics();
  const connections = connectionById(input.graph);
  const restored: Record<string, StoredRouteGeometry> = {};
  const lastValidPoints: Record<string, Point[]> = {};
  const seen = new Set<string>();

  for (const route of inspected.scene.routes) {
    if (seen.has(route.connectionId)) continue;
    seen.add(route.connectionId);
    const connection = connections.get(route.connectionId);
    if (!connection) {
      diagnostics.orphanRouteIds.push(route.connectionId);
      continue;
    }
    const reasons = validatePersistedRoute(route, input.graph).filter(
      (reason) => reason !== "orphan-connection",
    );
    if (reasons.length > 0) {
      diagnostics.invalidRouteIds.push(route.connectionId);
      diagnostics.invalidReasons[route.connectionId] = reasons;
      continue;
    }
    restored[route.connectionId] = {
      connectionId: route.connectionId,
      sourceCardId: connection.sourceCardId,
      targetCardId: connection.targetCardId,
      sourceEdge: route.sourceEdge,
      targetEdge: route.targetEdge,
      sourcePin: clonePoint(route.sourcePin),
      targetPin: clonePoint(route.targetPin),
      points: clonePoints(route.points),
    };
    lastValidPoints[route.connectionId] = clonePoints(route.points);
    diagnostics.restoredRouteIds.push(route.connectionId);
  }

  for (const connection of input.graph.connections) {
    if (!restored[connection.id] && !diagnostics.invalidRouteIds.includes(connection.id)) {
      diagnostics.missingRouteIds.push(connection.id);
    }
  }
  diagnostics.restoredRouteIds.sort();
  diagnostics.missingRouteIds.sort();
  diagnostics.invalidRouteIds.sort();
  diagnostics.orphanRouteIds.sort();

  const topology = cloneTopologyCanonical(inspected.scene.topology);
  const classified = classifyRouteInteractions(
    Object.values(restored)
      .map((row) => ({
        connectionId: row.connectionId,
        sourceCardId: row.sourceCardId,
        targetCardId: row.targetCardId,
        sourceEdge: row.sourceEdge,
        targetEdge: row.targetEdge,
        points: row.points,
      }))
      .sort((a, b) =>
        a.connectionId < b.connectionId ? -1 : a.connectionId > b.connectionId ? 1 : 0,
      ),
    input.graph.cards,
    topology,
  );

  return {
    supported: true,
    routeState: {
      byId: restored,
      lastValidPoints,
      invalidReasons: {},
      bridges: classified.bridges.map((bridge) => ({ ...bridge })),
      qualityTrace: {},
    },
    topology,
    diagnostics,
  };
}
