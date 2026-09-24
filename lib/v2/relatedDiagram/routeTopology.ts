/**
 * Explicit route topology (layout/routing metadata).
 * Not part of the semantic graph. Not used for AI evaluation.
 */

import type { EdgeSide, Point, RouteJunction } from "./orthogonalRouting";

export const ROUTE_TOPOLOGY_SCHEMA = "rd.routeTopology.v1" as const;

export type ExplicitBranchPoint = {
  id: string;
  x: number;
  y: number;
  connectionIds: string[];
};

export type ExplicitSharedTrunk = {
  id: string;
  points: Point[];
  connectionIds: string[];
  branchPointId: string;
};

export type ExplicitRouteGroup = {
  id: string;
  sourceCardId: string;
  trunkId: string;
  connectionIds: string[];
};

export type ExplicitConnectionRoute = {
  connectionId: string;
  sourceEdge: EdgeSide;
  targetEdge: EdgeSide;
  points: Point[];
};

export type RelatedDiagramRouteTopology = {
  schema: typeof ROUTE_TOPOLOGY_SCHEMA;
  trunks: ExplicitSharedTrunk[];
  branchPoints: ExplicitBranchPoint[];
  routeGroups: ExplicitRouteGroup[];
  routes: ExplicitConnectionRoute[];
};

export function emptyRouteTopology(): RelatedDiagramRouteTopology {
  return {
    schema: ROUTE_TOPOLOGY_SCHEMA,
    trunks: [],
    branchPoints: [],
    routeGroups: [],
    routes: [],
  };
}

export function mergeRouteTopologies(
  ...parts: RelatedDiagramRouteTopology[]
): RelatedDiagramRouteTopology {
  return {
    schema: ROUTE_TOPOLOGY_SCHEMA,
    trunks: parts.flatMap((p) => p.trunks),
    branchPoints: parts.flatMap((p) => p.branchPoints),
    routeGroups: parts.flatMap((p) => p.routeGroups),
    routes: parts.flatMap((p) => p.routes),
  };
}

/** Explicit junctions only — never inferred from geometry. */
export function junctionsFromTopology(
  topology: RelatedDiagramRouteTopology,
): RouteJunction[] {
  const out: RouteJunction[] = [];
  for (const bp of topology.branchPoints) {
    const ids = [...bp.connectionIds].sort();
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        out.push({
          kind: "branchPoint",
          x: bp.x,
          y: bp.y,
          connectionIds: [ids[i]!, ids[j]!],
        });
        out.push({
          kind: "junctionPoint",
          x: bp.x,
          y: bp.y,
          connectionIds: [ids[i]!, ids[j]!],
        });
      }
    }
  }
  for (const trunk of topology.trunks) {
    const mid = trunk.points[Math.floor(trunk.points.length / 2)];
    if (!mid) continue;
    const ids = [...trunk.connectionIds].sort();
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        out.push({
          kind: "sharedTrunk",
          x: mid.x,
          y: mid.y,
          connectionIds: [ids[i]!, ids[j]!],
        });
      }
    }
  }
  return out;
}

export function junctionOwnedConnectionIds(
  topology?: RelatedDiagramRouteTopology,
): Set<string> {
  const ids = new Set<string>();
  if (!topology) return ids;
  for (const group of topology.routeGroups) {
    for (const id of group.connectionIds) ids.add(id);
  }
  for (const trunk of topology.trunks) {
    for (const id of trunk.connectionIds) ids.add(id);
  }
  for (const bp of topology.branchPoints) {
    for (const id of bp.connectionIds) ids.add(id);
  }
  return ids;
}

export function hasExplicitConnectionRoute(
  topology: RelatedDiagramRouteTopology | undefined,
  connectionId: string,
): boolean {
  return Boolean(topology?.routes.some((row) => row.connectionId === connectionId));
}

export function isJunctionOwnedConnection(
  topology: RelatedDiagramRouteTopology | undefined,
  connectionId: string,
): boolean {
  return junctionOwnedConnectionIds(topology).has(connectionId);
}

/** Student 1:1 authored route. Knowledge / Junction presets stay system-owned. */
export function isStudentManualRoute(
  topology: RelatedDiagramRouteTopology | undefined,
  connection: { id: string; origin: string },
): boolean {
  if (connection.origin !== "student_diagram") return false;
  if (isJunctionOwnedConnection(topology, connection.id)) return false;
  return hasExplicitConnectionRoute(topology, connection.id);
}

export function hitOnExplicitJunction(
  hit: Point,
  aId: string,
  bId: string,
  topology: RelatedDiagramRouteTopology | undefined,
  eps = 1.5,
): boolean {
  if (!topology) return false;
  return topology.branchPoints.some((bp) => {
    if (!bp.connectionIds.includes(aId) || !bp.connectionIds.includes(bId)) {
      return false;
    }
    return Math.abs(hit.x - bp.x) <= eps && Math.abs(hit.y - bp.y) <= eps;
  });
}
