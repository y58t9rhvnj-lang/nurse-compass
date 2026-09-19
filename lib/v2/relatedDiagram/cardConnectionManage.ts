/**
 * Slice 2B-2G — Connection Manage domain.
 * 2G-1: selection / hit / halo / popover.
 * 2G-2: student relation change + student/knowledge delete.
 * 2G-3: student direction reverse. No pathfinder / reclassify.
 */

import { getA3LegendBounds } from "./a3Legend";
import {
  cloneConnection,
  isStudentConnectionRelation,
  studentConnectionOverlapsPriorRoutes,
  type StudentConnectionRelation,
} from "./cardConnectionCreate";
import type { ScreenRect } from "./actionPopoverPlacement";
import {
  cardDiagramSelection,
  connectionDiagramSelection,
  emptyDiagramSelection,
  type DiagramSelection,
} from "./diagramSelection";
import { lastSegmentFacesEdge } from "./geometryGuard";
import {
  clonePoints,
  cloneStableRouteState,
  type StableRouteState,
} from "./incrementalRoutes";
import { outwardPoint, type EdgeSide, type Point } from "./orthogonalRouting";
import { dedupeOrthogonalPoints } from "./repairRouteEndpoint";
import {
  cardObstacle,
  lastSegmentLength,
  MIN_ARROW_APPROACH,
  validateRouteGate,
} from "./routeHardening";
import type { RelatedDiagramRouteTopology } from "./routeTopology";
import { deleteConnection } from "./semanticGraph";
import {
  pruneStableRoutesForConnections,
  pruneTopologyForConnections,
} from "./cardDelete";
import type {
  RelatedDiagramCard,
  RelatedDiagramConnection,
  RelatedDiagramSemanticGraph,
} from "./types";

export const CONNECTION_HIT_STROKE_PX = 24;
export const CONNECTION_HIT_RADIUS_PX = CONNECTION_HIT_STROKE_PX / 2;
export const CONNECTION_HALO_EXTRA_PX = 4.5;
export const CONNECTION_HALO_STROKE = "#1D1D1F";
export const CONNECTION_HALO_OPACITY = 0.22;
export const CONNECTION_TAP_ANCHOR_PX = 8;

export type ConnectionTapPhase = "idle" | "pressing" | "cancelled";

export type ConnectionTapState = {
  phase: ConnectionTapPhase;
  pointerId: number | null;
  connectionId: string | null;
  clientX: number;
  clientY: number;
};

export type ConnectionTapCommit = {
  connectionId: string;
  clientX: number;
  clientY: number;
};

export type ConnectionPermissions = {
  selectable: boolean;
  relationEditable: boolean;
  reversible: boolean;
  deletable: boolean;
};

const SELECT_ONLY: ConnectionPermissions = {
  selectable: true,
  relationEditable: false,
  reversible: false,
  deletable: false,
};

export function isStudentManageableConnection(
  connection: Pick<RelatedDiagramConnection, "origin" | "relationType">,
): connection is Pick<RelatedDiagramConnection, "origin" | "relationType"> & {
  origin: "student_diagram";
  relationType: StudentConnectionRelation;
} {
  return (
    connection.origin === "student_diagram" &&
    isStudentConnectionRelation(connection.relationType)
  );
}

export function isKnowledgeLibraryConnection(
  connection: Pick<RelatedDiagramConnection, "origin">,
): boolean {
  return connection.origin === "knowledge_library";
}

export function isSystemIntegrationConnection(
  connection: Pick<RelatedDiagramConnection, "origin" | "relationType">,
): boolean {
  return (
    connection.origin === "system_integration" ||
    connection.relationType === "nursing_problem_integration"
  );
}

export function connectionPermissions(
  connection: Pick<RelatedDiagramConnection, "origin" | "relationType">,
): ConnectionPermissions {
  if (isSystemIntegrationConnection(connection)) {
    return { ...SELECT_ONLY };
  }
  if (isKnowledgeLibraryConnection(connection)) {
    return {
      selectable: true,
      relationEditable: false,
      reversible: false,
      deletable: true,
    };
  }
  if (isStudentManageableConnection(connection)) {
    return {
      selectable: true,
      relationEditable: true,
      reversible: true,
      deletable: true,
    };
  }
  // nursing_problem_basis and any residual semantic line:
  // selectable for hit, not student-editable/deletable in 2G-1.
  return { ...SELECT_ONLY };
}

export function connectionHasManageActions(
  permissions: ConnectionPermissions,
): boolean {
  return (
    permissions.relationEditable ||
    permissions.reversible ||
    permissions.deletable
  );
}

export const PROTECTED_CONNECTION_NOTICE =
  "この関係は自動的に管理されています";

export function isProtectedConnection(
  connection: Pick<RelatedDiagramConnection, "origin" | "relationType">,
): boolean {
  const permissions = connectionPermissions(connection);
  return permissions.selectable && !connectionHasManageActions(permissions);
}

export function connectionHaloStrokeWidth(visibleStrokeWidthPx: number): number {
  return visibleStrokeWidthPx + CONNECTION_HALO_EXTRA_PX;
}

export function connectionTapAnchorRect(
  clientX: number,
  clientY: number,
  size = CONNECTION_TAP_ANCHOR_PX,
): ScreenRect {
  return {
    x: clientX - size / 2,
    y: clientY - size / 2,
    width: size,
    height: size,
  };
}

export function exclusiveDiagramSelection(input: {
  cardId?: string | null;
  connectionId?: string | null;
}): DiagramSelection {
  if (input.connectionId) return connectionDiagramSelection(input.connectionId);
  if (input.cardId) return cardDiagramSelection(input.cardId);
  return emptyDiagramSelection();
}

export function createIdleConnectionTap(): ConnectionTapState {
  return {
    phase: "idle",
    pointerId: null,
    connectionId: null,
    clientX: 0,
    clientY: 0,
  };
}

export function applyConnectionTapPointerDown(
  _state: ConnectionTapState,
  input: {
    pointerId: number;
    connectionId: string;
    clientX: number;
    clientY: number;
    isPrimary?: boolean;
    pointerCount?: number;
  },
): ConnectionTapState {
  if (input.isPrimary === false) return createIdleConnectionTap();
  if ((input.pointerCount ?? 1) >= 2) return createIdleConnectionTap();
  return {
    phase: "pressing",
    pointerId: input.pointerId,
    connectionId: input.connectionId,
    clientX: input.clientX,
    clientY: input.clientY,
  };
}

export function applyConnectionTapSecondPointer(
  state: ConnectionTapState,
): ConnectionTapState {
  if (state.phase !== "pressing") return state;
  return { ...state, phase: "cancelled" };
}

export function applyConnectionTapPointerUp(
  state: ConnectionTapState,
  pointerId: number,
): { state: ConnectionTapState; commit: ConnectionTapCommit | null } {
  if (state.pointerId !== pointerId) {
    return { state, commit: null };
  }
  if (state.phase === "pressing" && state.connectionId) {
    return {
      state: createIdleConnectionTap(),
      commit: {
        connectionId: state.connectionId,
        clientX: state.clientX,
        clientY: state.clientY,
      },
    };
  }
  return { state: createIdleConnectionTap(), commit: null };
}

export function applyConnectionTapCancel(
  _state: ConnectionTapState,
): ConnectionTapState {
  return createIdleConnectionTap();
}

export function pointToSegmentDistance(
  point: Point,
  a: Point,
  b: Point,
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(point.x - a.x, point.y - a.y);
  const t = Math.max(
    0,
    Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / len2),
  );
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

export function distanceToRoute(point: Point, points: readonly Point[]): number {
  if (points.length === 0) return Number.POSITIVE_INFINITY;
  if (points.length === 1) {
    return Math.hypot(point.x - points[0]!.x, point.y - points[0]!.y);
  }
  let best = Number.POSITIVE_INFINITY;
  for (let i = 1; i < points.length; i++) {
    const distance = pointToSegmentDistance(point, points[i - 1]!, points[i]!);
    if (distance < best) best = distance;
  }
  return best;
}

export function cardIdAtPoint(
  point: Point,
  cards: readonly RelatedDiagramCard[],
): string | null {
  for (const card of cards) {
    const { x, y, width, height } = card.layout;
    if (
      point.x >= x &&
      point.x <= x + width &&
      point.y >= y &&
      point.y <= y + height
    ) {
      return card.id;
    }
  }
  return null;
}

export function pickSelectableConnectionAtPoint(input: {
  point: Point;
  cards: readonly RelatedDiagramCard[];
  connections: readonly RelatedDiagramConnection[];
  routes: readonly { connectionId: string; points: Point[] }[];
  radius?: number;
}): { connectionId: string; distance: number } | null {
  if (cardIdAtPoint(input.point, input.cards)) return null;
  const radius = input.radius ?? CONNECTION_HIT_RADIUS_PX;
  const byId = new Map(input.connections.map((row) => [row.id, row]));
  let best: { connectionId: string; distance: number } | null = null;
  for (const route of input.routes) {
    const connection = byId.get(route.connectionId);
    if (!connection || !connectionPermissions(connection).selectable) continue;
    if (route.points.length < 2) continue;
    const distance = distanceToRoute(input.point, route.points);
    if (distance > radius) continue;
    if (
      !best ||
      distance < best.distance - 1e-6 ||
      (Math.abs(distance - best.distance) <= 1e-6 &&
        route.connectionId < best.connectionId)
    ) {
      best = { connectionId: route.connectionId, distance };
    }
  }
  return best;
}

/** @deprecated 2G-1 used student-only pick; now all selectable routed lines. */
export function pickManageableConnectionAtPoint(
  input: Parameters<typeof pickSelectableConnectionAtPoint>[0],
): ReturnType<typeof pickSelectableConnectionAtPoint> {
  return pickSelectableConnectionAtPoint(input);
}

export type ConnectionHitCoverageRow = {
  id: string;
  origin: RelatedDiagramConnection["origin"];
  relationType: RelatedDiagramConnection["relationType"];
  hasRoute: boolean;
  visible: boolean;
  hit: boolean;
  permissions: ConnectionPermissions;
};

export function listConnectionHitCoverage(input: {
  connections: readonly RelatedDiagramConnection[];
  routes: readonly { connectionId: string; points: Point[] }[];
}): ConnectionHitCoverageRow[] {
  const routed = new Set(
    input.routes
      .filter((route) => route.points.length >= 2)
      .map((route) => route.connectionId),
  );
  return input.connections.map((connection) => {
    const permissions = connectionPermissions(connection);
    const hasRoute = routed.has(connection.id);
    return {
      id: connection.id,
      origin: connection.origin,
      relationType: connection.relationType,
      hasRoute,
      visible: hasRoute,
      hit: hasRoute && permissions.selectable,
      permissions,
    };
  });
}

export function isRelatedDiagramConnectionHitTarget(
  target: EventTarget | null,
): boolean {
  if (target == null || typeof target !== "object") return false;
  const el = target as { closest?: (selector: string) => unknown };
  if (typeof el.closest !== "function") return false;
  return Boolean(el.closest("[data-rd-connection-hit]"));
}

export function replaceConnectionExact(
  graph: RelatedDiagramSemanticGraph,
  connection: RelatedDiagramConnection,
): RelatedDiagramSemanticGraph {
  const next = cloneConnection(connection);
  const exists = graph.connections.some((row) => row.id === next.id);
  return {
    ...graph,
    connections: exists
      ? graph.connections.map((row) => (row.id === next.id ? next : row))
      : [...graph.connections, next],
  };
}

export function changeStudentConnectionRelation(input: {
  graph: RelatedDiagramSemanticGraph;
  connectionId: string;
  relationType: StudentConnectionRelation;
  now: string;
}):
  | {
      ok: true;
      kind: "unchanged";
      connection: RelatedDiagramConnection;
      graph: RelatedDiagramSemanticGraph;
    }
  | {
      ok: true;
      kind: "changed";
      before: RelatedDiagramConnection;
      after: RelatedDiagramConnection;
      graph: RelatedDiagramSemanticGraph;
    }
  | { ok: false; code: "not_found" | "not_editable" } {
  const existing = input.graph.connections.find(
    (row) => row.id === input.connectionId,
  );
  if (!existing) return { ok: false, code: "not_found" };
  if (!connectionPermissions(existing).relationEditable) {
    return { ok: false, code: "not_editable" };
  }
  if (existing.relationType === input.relationType) {
    return {
      ok: true,
      kind: "unchanged",
      connection: cloneConnection(existing),
      graph: input.graph,
    };
  }
  const after: RelatedDiagramConnection = {
    ...existing,
    relationType: input.relationType,
    updatedAt: input.now,
  };
  return {
    ok: true,
    kind: "changed",
    before: cloneConnection(existing),
    after: cloneConnection(after),
    graph: replaceConnectionExact(input.graph, after),
  };
}

export function deleteManagedConnection(input: {
  graph: RelatedDiagramSemanticGraph;
  routeState: StableRouteState;
  topology?: RelatedDiagramRouteTopology;
  connectionId: string;
}):
  | { ok: false; code: "not_found" | "not_deletable" }
  | {
      ok: true;
      connection: RelatedDiagramConnection;
      graph: RelatedDiagramSemanticGraph;
      routeState: StableRouteState;
      topology?: RelatedDiagramRouteTopology;
    } {
  const existing = input.graph.connections.find(
    (row) => row.id === input.connectionId,
  );
  if (!existing) return { ok: false, code: "not_found" };
  if (!connectionPermissions(existing).deletable) {
    return { ok: false, code: "not_deletable" };
  }
  const removed = deleteConnection(input.graph, existing.id);
  if (!removed.ok) return { ok: false, code: "not_found" };
  return {
    ok: true,
    connection: cloneConnection(existing),
    graph: removed.graph,
    routeState: pruneStableRoutesForConnections(input.routeState, [existing.id]),
    topology: pruneTopologyForConnections(input.topology, [existing.id]),
  };
}

export function remainingRoutesUnchanged(
  before: StableRouteState,
  after: StableRouteState,
  deletedId: string,
): boolean {
  for (const [id, route] of Object.entries(before.byId)) {
    if (id === deletedId) continue;
    const next = after.byId[id];
    if (!next) return false;
    if (next.sourceCardId !== route.sourceCardId) return false;
    if (next.targetCardId !== route.targetCardId) return false;
    if (next.sourceEdge !== route.sourceEdge) return false;
    if (next.targetEdge !== route.targetEdge) return false;
    if (next.sourcePin.x !== route.sourcePin.x || next.sourcePin.y !== route.sourcePin.y) {
      return false;
    }
    if (next.targetPin.x !== route.targetPin.x || next.targetPin.y !== route.targetPin.y) {
      return false;
    }
    if (next.points.length !== route.points.length) return false;
    for (let i = 0; i < route.points.length; i++) {
      if (
        next.points[i]!.x !== route.points[i]!.x ||
        next.points[i]!.y !== route.points[i]!.y
      ) {
        return false;
      }
    }
    const beforeValid = before.lastValidPoints[id];
    const afterValid = after.lastValidPoints[id];
    if (beforeValid) {
      if (!afterValid || afterValid.length !== beforeValid.length) return false;
      for (let i = 0; i < beforeValid.length; i++) {
        if (
          afterValid[i]!.x !== beforeValid[i]!.x ||
          afterValid[i]!.y !== beforeValid[i]!.y
        ) {
          return false;
        }
      }
    }
  }
  return after.byId[deletedId] == null && after.lastValidPoints[deletedId] == null;
}

export const REVERSE_CONNECTION_NOTICE =
  "この関係は現在の配置では向きを反転できません。";

const REVERSE_ORTHO_EPS = 0.51;

export function reversePolyline(points: readonly Point[]): Point[] {
  return points
    .slice()
    .reverse()
    .map((point) => ({ x: point.x, y: point.y }));
}

function colinearPoints(a: Point, b: Point, c: Point): boolean {
  const horizontal =
    Math.abs(a.y - b.y) <= REVERSE_ORTHO_EPS &&
    Math.abs(b.y - c.y) <= REVERSE_ORTHO_EPS;
  const vertical =
    Math.abs(a.x - b.x) <= REVERSE_ORTHO_EPS &&
    Math.abs(b.x - c.x) <= REVERSE_ORTHO_EPS;
  return horizontal || vertical;
}

export function extendReversedTargetApproach(input: {
  points: readonly Point[];
  targetPin: Point;
  targetEdge: EdgeSide;
}): { ok: true; points: Point[]; repaired: boolean } | { ok: false } {
  if (input.points.length < 2) return { ok: false };
  const points = input.points.map((point) => ({ x: point.x, y: point.y }));
  points[points.length - 1] = { x: input.targetPin.x, y: input.targetPin.y };
  if (!lastSegmentFacesEdge(points, input.targetEdge)) return { ok: false };
  if (lastSegmentLength(points) >= MIN_ARROW_APPROACH - 0.2) {
    return { ok: true, points: dedupeOrthogonalPoints(points), repaired: false };
  }
  const desired = outwardPoint(input.targetPin, input.targetEdge, MIN_ARROW_APPROACH);
  const approachIndex = points.length - 2;
  const approach = points[approachIndex]!;
  const prev = points[approachIndex - 1];
  if (prev && colinearPoints(prev, approach, desired)) {
    points[approachIndex] = desired;
  } else {
    points.splice(points.length - 1, 0, desired);
  }
  const next = dedupeOrthogonalPoints(points);
  if (lastSegmentLength(next) < MIN_ARROW_APPROACH - 0.2) return { ok: false };
  if (!lastSegmentFacesEdge(next, input.targetEdge)) return { ok: false };
  return { ok: true, points: next, repaired: true };
}

function topologyAfterReverse(
  topology: RelatedDiagramRouteTopology | undefined,
  connectionId: string,
  route: { sourceEdge: EdgeSide; targetEdge: EdgeSide; points: Point[] },
): RelatedDiagramRouteTopology | undefined {
  if (!topology) return undefined;
  const drop = (ids: readonly string[]) =>
    ids.filter((id) => id !== connectionId);
  return {
    schema: topology.schema,
    routes: topology.routes.map((row) =>
      row.connectionId === connectionId
        ? {
            connectionId,
            sourceEdge: route.sourceEdge,
            targetEdge: route.targetEdge,
            points: clonePoints(route.points),
          }
        : {
            ...row,
            points: clonePoints(row.points),
          },
    ),
    routeGroups: topology.routeGroups
      .map((group) => ({
        ...group,
        connectionIds: drop(group.connectionIds),
      }))
      .filter((group) => group.connectionIds.length > 0),
    trunks: topology.trunks
      .map((trunk) => ({
        ...trunk,
        points: clonePoints(trunk.points),
        connectionIds: drop(trunk.connectionIds),
      }))
      .filter((trunk) => trunk.connectionIds.length > 0),
    branchPoints: topology.branchPoints
      .map((point) => ({
        ...point,
        connectionIds: drop(point.connectionIds),
      }))
      .filter((point) => point.connectionIds.length > 0),
  };
}

export function reverseStudentConnection(input: {
  graph: RelatedDiagramSemanticGraph;
  routeState: StableRouteState;
  topology?: RelatedDiagramRouteTopology;
  connectionId: string;
  now: string;
}):
  | {
      ok: false;
      code: "not_found" | "not_reversible" | "reverse_failed";
      notice?: string;
    }
  | {
      ok: true;
      before: RelatedDiagramConnection;
      after: RelatedDiagramConnection;
      graph: RelatedDiagramSemanticGraph;
      routeState: StableRouteState;
      topology?: RelatedDiagramRouteTopology;
      repaired: boolean;
    } {
  const existing = input.graph.connections.find(
    (row) => row.id === input.connectionId,
  );
  if (!existing) return { ok: false, code: "not_found" };
  if (!connectionPermissions(existing).reversible) {
    return { ok: false, code: "not_reversible" };
  }
  const route = input.routeState.byId[existing.id];
  if (!route || route.points.length < 2) {
    return {
      ok: false,
      code: "reverse_failed",
      notice: REVERSE_CONNECTION_NOTICE,
    };
  }
  const reversedPoints = reversePolyline(route.points);
  const sourcePin = { ...route.targetPin };
  const targetPin = { ...route.sourcePin };
  const sourceEdge = route.targetEdge;
  const targetEdge = route.sourceEdge;
  const approached = extendReversedTargetApproach({
    points: reversedPoints,
    targetPin,
    targetEdge,
  });
  if (!approached.ok) {
    return {
      ok: false,
      code: "reverse_failed",
      notice: REVERSE_CONNECTION_NOTICE,
    };
  }
  const source = input.graph.cards.find(
    (card) => card.id === existing.targetCardId,
  );
  const target = input.graph.cards.find(
    (card) => card.id === existing.sourceCardId,
  );
  if (!source || !target) {
    return {
      ok: false,
      code: "reverse_failed",
      notice: REVERSE_CONNECTION_NOTICE,
    };
  }
  const validation = validateRouteGate({
    points: approached.points,
    sourcePin,
    targetPin,
    obstacles: [
      ...input.graph.cards.map(cardObstacle),
      { id: "__legend__", ...getA3LegendBounds() },
    ],
    sourceCardId: source.id,
    targetCardId: target.id,
    clearance: 0,
    sourceEdge,
    targetEdge,
  });
  if (
    !validation.ok ||
    studentConnectionOverlapsPriorRoutes(
      approached.points,
      input.routeState,
      existing.id,
    )
  ) {
    return {
      ok: false,
      code: "reverse_failed",
      notice: REVERSE_CONNECTION_NOTICE,
    };
  }
  const after: RelatedDiagramConnection = {
    ...existing,
    sourceCardId: existing.targetCardId,
    targetCardId: existing.sourceCardId,
    updatedAt: input.now,
  };
  const nextState = cloneStableRouteState(input.routeState);
  nextState.byId[existing.id] = {
    connectionId: existing.id,
    sourceCardId: after.sourceCardId,
    targetCardId: after.targetCardId,
    sourceEdge,
    targetEdge,
    sourcePin,
    targetPin,
    points: clonePoints(approached.points),
  };
  if (nextState.lastValidPoints[existing.id]) {
    nextState.lastValidPoints[existing.id] = clonePoints(approached.points);
  }
  delete nextState.invalidReasons[existing.id];
  if (nextState.qualityTrace) delete nextState.qualityTrace[existing.id];
  return {
    ok: true,
    before: cloneConnection(existing),
    after: cloneConnection(after),
    graph: replaceConnectionExact(input.graph, after),
    routeState: nextState,
    topology: topologyAfterReverse(input.topology, existing.id, {
      sourceEdge,
      targetEdge,
      points: approached.points,
    }),
    repaired: approached.repaired,
  };
}
