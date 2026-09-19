/**
 * Slice 2B-2B — remove a Card from the Related Diagram only.
 * Incident connections go with it. Sources / Form3 / Knowledge Library stay.
 */

import { cloneStableRouteState, type StableRouteState } from "./incrementalRoutes";
import { cloneCardEntity, removeCardEntity, type CardEntitySnapshot } from "./form3ToUnderstandingCard";
import { compactActiveNursingProblemPriorities } from "./nursingProblemPriority";
import type { RelatedDiagramRouteTopology } from "./routeTopology";
import type {
  RelatedDiagramConnection,
  RelatedDiagramSemanticGraph,
} from "./types";

export function incidentConnections(
  graph: RelatedDiagramSemanticGraph,
  cardId: string,
): RelatedDiagramConnection[] {
  return graph.connections.filter(
    (connection) =>
      connection.sourceCardId === cardId || connection.targetCardId === cardId,
  );
}

export function incidentConnectionCount(
  graph: RelatedDiagramSemanticGraph,
  cardId: string,
): number {
  return incidentConnections(graph, cardId).length;
}

export function snapshotCardForDelete(
  graph: RelatedDiagramSemanticGraph,
  cardId: string,
): CardEntitySnapshot | null {
  const card = graph.cards.find((row) => row.id === cardId);
  if (!card) return null;
  return cloneCardEntity({
    card,
    sources: graph.cardSources.filter((row) => row.cardId === cardId),
    nursingProblem: graph.nursingProblems.find((row) => row.cardId === cardId),
  });
}

export function pruneStableRoutesForConnections(
  state: StableRouteState,
  connectionIds: readonly string[],
): StableRouteState {
  const drop = new Set(connectionIds);
  const next = cloneStableRouteState(state);
  for (const id of drop) {
    delete next.byId[id];
    delete next.lastValidPoints[id];
    delete next.invalidReasons[id];
    if (next.qualityTrace) delete next.qualityTrace[id];
  }
  next.bridges = next.bridges.filter(
    (bridge) =>
      !drop.has(bridge.jumperConnectionId) &&
      !drop.has(bridge.underConnectionId),
  );
  return next;
}

export function pruneTopologyForConnections(
  topology: RelatedDiagramRouteTopology | undefined,
  connectionIds: readonly string[],
): RelatedDiagramRouteTopology | undefined {
  if (!topology) return undefined;
  const drop = new Set(connectionIds);
  return {
    schema: topology.schema,
    routes: topology.routes
      .filter((route) => !drop.has(route.connectionId))
      .map((route) => ({
        ...route,
        points: route.points.map((point) => ({ x: point.x, y: point.y })),
      })),
    routeGroups: topology.routeGroups.map((group) => ({
      ...group,
      connectionIds: group.connectionIds.filter((id) => !drop.has(id)),
    })),
    trunks: topology.trunks.map((trunk) => ({
      ...trunk,
      points: trunk.points.map((point) => ({ x: point.x, y: point.y })),
      connectionIds: trunk.connectionIds.filter((id) => !drop.has(id)),
    })),
    branchPoints: topology.branchPoints.map((point) => ({
      ...point,
      connectionIds: point.connectionIds.filter((id) => !drop.has(id)),
    })),
  };
}

export function removeCardAndIncidentConnections(
  graph: RelatedDiagramSemanticGraph,
  cardId: string,
  now?: string,
): RelatedDiagramSemanticGraph {
  const removed = removeCardEntity(graph, cardId);
  return compactActiveNursingProblemPriorities(removed, now).graph;
}

export function restoreDeletedConnections(
  graph: RelatedDiagramSemanticGraph,
  connections: readonly RelatedDiagramConnection[],
): RelatedDiagramSemanticGraph {
  if (connections.length === 0) return graph;
  const have = new Set(graph.connections.map((row) => row.id));
  return {
    ...graph,
    connections: [
      ...graph.connections,
      ...connections
        .filter((row) => !have.has(row.id))
        .map((row) => ({ ...row })),
    ],
  };
}
