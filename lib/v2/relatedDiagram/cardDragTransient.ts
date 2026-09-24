/**
 * Phase 2-0 — card drag transient + incident rubber-band.
 * Committed graph / topology / StableRouteState stay frozen during move.
 */

import { isJunctionOwnedConnection } from "./routeTopology";
import { edgeMidpoint, type EdgeSide, type Point } from "./orthogonalRouting";
import {
  repairRouteAroundAnchor,
  repairRouteEndpoint,
} from "./repairRouteEndpoint";
import type { StableRouteState } from "./incrementalRoutes";
import type { RelatedDiagramRouteTopology } from "./routeTopology";
import type {
  RelatedDiagramCard,
  RelatedDiagramConnection,
  RelatedDiagramSemanticGraph,
} from "./types";

export type IncidentRoutePreview = {
  connectionId: string;
  sourceCardId: string;
  targetCardId: string;
  sourceEdge: EdgeSide;
  targetEdge: EdgeSide;
  points: Point[];
};

export type CardDragIncidentSnapshot = {
  connectionId: string;
  sourceCardId: string;
  targetCardId: string;
  sourceEdge: EdgeSide;
  targetEdge: EdgeSide;
  points: Point[];
  movingEnd: "source" | "target";
  junctionAnchor: Point | null;
};

export type CardDragSnapshot = {
  card: RelatedDiagramCard;
  originX: number;
  originY: number;
  incidents: CardDragIncidentSnapshot[];
};

export type CardDragTransient = {
  cardId: string;
  x: number;
  y: number;
  incidentRoutePreviews: IncidentRoutePreview[];
};

export type CardDragSession = {
  snapshot: CardDragSnapshot;
  committedGraph: RelatedDiagramSemanticGraph;
  committedTopology?: RelatedDiagramRouteTopology;
  committedRouteState?: StableRouteState;
  transient: CardDragTransient;
};

function clonePoints(points: Point[]): Point[] {
  return points.map((point) => ({ x: point.x, y: point.y }));
}

function pin(card: RelatedDiagramCard, edge: EdgeSide): Point {
  return edgeMidpoint(card.layout, edge);
}

export function cardWithTransientPosition(
  card: RelatedDiagramCard,
  transient: CardDragTransient | null,
): RelatedDiagramCard {
  if (!transient || card.id !== transient.cardId) return card;
  if (card.layout.x === transient.x && card.layout.y === transient.y) return card;
  return {
    ...card,
    layout: { ...card.layout, x: transient.x, y: transient.y },
  };
}

export function cardsWithTransientPosition(
  cards: RelatedDiagramCard[],
  transient: CardDragTransient | null,
): RelatedDiagramCard[] {
  if (!transient) return cards;
  let changed = false;
  const next = cards.map((card) => {
    const live = cardWithTransientPosition(card, transient);
    if (live !== card) changed = true;
    return live;
  });
  return changed ? next : cards;
}

/** rAF contract: many pointer samples collapse to one last transient. */
export function applyCoalescedCardDragMove(
  session: CardDragSession,
  pending: ReadonlyArray<{ x: number; y: number }>,
): CardDragSession {
  if (pending.length === 0) return session;
  const last = pending[pending.length - 1]!;
  return moveCardDragSession(session, last.x, last.y);
}

export function listIncidentConnectionIds(
  connections: RelatedDiagramConnection[],
  cardId: string,
): string[] {
  return connections
    .filter(
      (connection) =>
        connection.sourceCardId === cardId || connection.targetCardId === cardId,
    )
    .map((connection) => connection.id)
    .sort();
}

export function beginCardDragSnapshot(input: {
  card: RelatedDiagramCard;
  connections: RelatedDiagramConnection[];
  routeState?: StableRouteState;
  topology?: RelatedDiagramRouteTopology;
}): CardDragSnapshot {
  const incidents: CardDragIncidentSnapshot[] = [];
  for (const connection of input.connections) {
    const isSource = connection.sourceCardId === input.card.id;
    const isTarget = connection.targetCardId === input.card.id;
    if (!isSource && !isTarget) continue;
    const stored = input.routeState?.byId[connection.id];
    const authored = input.topology?.routes.find(
      (route) => route.connectionId === connection.id,
    );
    const points = stored?.points ?? authored?.points;
    if (!points || points.length < 2) continue;
    const sourceEdge = stored?.sourceEdge ?? authored?.sourceEdge ?? "right";
    const targetEdge = stored?.targetEdge ?? authored?.targetEdge ?? "left";
    const bp = input.topology?.branchPoints.find((row) =>
      row.connectionIds.includes(connection.id),
    );
    incidents.push({
      connectionId: connection.id,
      sourceCardId: connection.sourceCardId,
      targetCardId: connection.targetCardId,
      sourceEdge,
      targetEdge,
      points: clonePoints(points),
      movingEnd: isSource ? "source" : "target",
      junctionAnchor:
        bp && isJunctionOwnedConnection(input.topology, connection.id)
          ? { x: bp.x, y: bp.y }
          : null,
    });
  }
  incidents.sort((a, b) =>
    a.connectionId < b.connectionId ? -1 : a.connectionId > b.connectionId ? 1 : 0,
  );
  return {
    card: input.card,
    originX: input.card.layout.x,
    originY: input.card.layout.y,
    incidents,
  };
}

export function rubberBandIncident(
  incident: CardDragIncidentSnapshot,
  liveCard: RelatedDiagramCard,
): IncidentRoutePreview {
  const edge =
    incident.movingEnd === "source" ? incident.sourceEdge : incident.targetEdge;
  const live = pin(liveCard, edge);
  const points = incident.junctionAnchor
    ? repairRouteAroundAnchor({
        existingPoints: incident.points,
        anchor: incident.junctionAnchor,
        movingEnd: incident.movingEnd,
        livePin: live,
      })
    : repairRouteEndpoint({
        existingPoints: incident.points,
        movingEnd: incident.movingEnd,
        livePin: live,
      });
  return {
    connectionId: incident.connectionId,
    sourceCardId: incident.sourceCardId,
    targetCardId: incident.targetCardId,
    sourceEdge: incident.sourceEdge,
    targetEdge: incident.targetEdge,
    points,
  };
}

export function updateCardDragTransient(
  snapshot: CardDragSnapshot,
  x: number,
  y: number,
): CardDragTransient {
  const liveCard = cardWithTransientPosition(snapshot.card, {
    cardId: snapshot.card.id,
    x,
    y,
    incidentRoutePreviews: [],
  });
  return {
    cardId: snapshot.card.id,
    x,
    y,
    incidentRoutePreviews: snapshot.incidents.map((incident) =>
      rubberBandIncident(incident, liveCard),
    ),
  };
}

export function beginCardDragSession(input: {
  graph: RelatedDiagramSemanticGraph;
  cardId: string;
  routeState?: StableRouteState;
  topology?: RelatedDiagramRouteTopology;
}): CardDragSession | null {
  const card = input.graph.cards.find((row) => row.id === input.cardId);
  if (!card) return null;
  const snapshot = beginCardDragSnapshot({
    card,
    connections: input.graph.connections,
    routeState: input.routeState,
    topology: input.topology,
  });
  return {
    snapshot,
    committedGraph: input.graph,
    committedTopology: input.topology,
    committedRouteState: input.routeState,
    transient: updateCardDragTransient(
      snapshot,
      card.layout.x,
      card.layout.y,
    ),
  };
}

export function moveCardDragSession(
  session: CardDragSession,
  x: number,
  y: number,
): CardDragSession {
  return {
    ...session,
    transient: updateCardDragTransient(session.snapshot, x, y),
  };
}

export function cancelCardDragSession(
  session: CardDragSession,
): {
  graph: RelatedDiagramSemanticGraph;
  topology?: RelatedDiagramRouteTopology;
  routeState?: StableRouteState;
  transient: null;
} {
  return {
    graph: session.committedGraph,
    topology: session.committedTopology,
    routeState: session.committedRouteState,
    transient: null,
  };
}

export function overlayIncidentRoutePreviews<T extends { connectionId: string }>(
  routes: T[],
  previews: IncidentRoutePreview[] | undefined,
): T[] {
  if (!previews || previews.length === 0) return routes;
  const map = new Map(previews.map((preview) => [preview.connectionId, preview]));
  return routes.map((route) => {
    const preview = map.get(route.connectionId);
    if (!preview) return route;
    return { ...route, points: preview.points };
  });
}

export function internalRoutePoints(points: Point[]): Point[] {
  if (points.length <= 2) return [];
  return points.slice(1, -1);
}
