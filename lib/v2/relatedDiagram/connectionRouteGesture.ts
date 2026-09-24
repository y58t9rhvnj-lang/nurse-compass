/**
 * Connection tap vs 1:1 route-segment drag.
 * Reuses the card drag threshold. 2 pointers never start route edit.
 */

import { CARD_DRAG_THRESHOLD_PX } from "./cardInteractionState";
import {
  canEditConnectionRoute,
  pickEditableSegment,
  type EditableSegment,
} from "./manualRouteEdit";
import type { Point } from "./orthogonalRouting";
import type { RelatedDiagramRouteTopology } from "./routeTopology";
import type { RelatedDiagramConnection } from "./types";

export const CONNECTION_ROUTE_DRAG_THRESHOLD_PX = CARD_DRAG_THRESHOLD_PX;

export type ConnectionRouteGesturePhase =
  | "idle"
  | "pressing"
  | "dragging"
  | "cancelled";

export type ConnectionRouteGestureState = {
  phase: ConnectionRouteGesturePhase;
  pointerId: number | null;
  connectionId: string | null;
  selectedAlready: boolean;
  startClientX: number;
  startClientY: number;
  lastClientX: number;
  lastClientY: number;
  segment: EditableSegment | null;
  startLogical: Point | null;
};

export type ConnectionRouteTapCommit = {
  kind: "tap";
  connectionId: string;
  clientX: number;
  clientY: number;
};

export type ConnectionRouteDragCommit = {
  kind: "drag";
  connectionId: string;
  segmentIndex: number;
  deltaX: number;
  deltaY: number;
  grab: Point | null;
};

export function createIdleConnectionRouteGesture(): ConnectionRouteGestureState {
  return {
    phase: "idle",
    pointerId: null,
    connectionId: null,
    selectedAlready: false,
    startClientX: 0,
    startClientY: 0,
    lastClientX: 0,
    lastClientY: 0,
    segment: null,
    startLogical: null,
  };
}

export function canStartConnectionRouteDrag(input: {
  selectedConnectionId: string | null;
  connection: RelatedDiagramConnection | null;
  topology?: RelatedDiagramRouteTopology;
  pointerCount: number;
  cardDragging: boolean;
}): boolean {
  if (input.cardDragging) return false;
  if (input.pointerCount >= 2) return false;
  if (!input.connection) return false;
  if (input.selectedConnectionId !== input.connection.id) return false;
  return canEditConnectionRoute(input.topology, input.connection);
}

export function applyConnectionRoutePointerDown(input: {
  pointerId: number;
  pointerCount: number;
  isPrimary: boolean;
  connectionId: string;
  selectedConnectionId: string | null;
  clientX: number;
  clientY: number;
  logicalPoint: Point;
  points: Point[];
  connection: RelatedDiagramConnection;
  topology?: RelatedDiagramRouteTopology;
  cardDragging: boolean;
}): ConnectionRouteGestureState {
  if (!input.isPrimary || input.pointerCount >= 2 || input.cardDragging) {
    return createIdleConnectionRouteGesture();
  }
  const selectedAlready = input.selectedConnectionId === input.connectionId;
  const segment =
    selectedAlready && canEditConnectionRoute(input.topology, input.connection)
      ? pickEditableSegment(input.points, input.logicalPoint)
      : null;
  return {
    phase: "pressing",
    pointerId: input.pointerId,
    connectionId: input.connectionId,
    selectedAlready,
    startClientX: input.clientX,
    startClientY: input.clientY,
    lastClientX: input.clientX,
    lastClientY: input.clientY,
    segment,
    startLogical: { ...input.logicalPoint },
  };
}

export function applyConnectionRouteSecondPointer(
  state: ConnectionRouteGestureState,
): ConnectionRouteGestureState {
  if (state.phase === "idle") return state;
  return { ...createIdleConnectionRouteGesture(), phase: "cancelled" };
}

export function applyConnectionRoutePointerMove(
  state: ConnectionRouteGestureState,
  input: {
    pointerId: number;
    clientX: number;
    clientY: number;
    pointerCount: number;
  },
): ConnectionRouteGestureState {
  if (state.pointerId !== input.pointerId) return state;
  if (state.phase !== "pressing" && state.phase !== "dragging") return state;
  if (input.pointerCount >= 2) return applyConnectionRouteSecondPointer(state);
  const next = {
    ...state,
    lastClientX: input.clientX,
    lastClientY: input.clientY,
  };
  if (state.phase === "dragging") return next;
  const distance = Math.hypot(
    input.clientX - state.startClientX,
    input.clientY - state.startClientY,
  );
  if (
    state.selectedAlready &&
    state.segment &&
    distance >= CONNECTION_ROUTE_DRAG_THRESHOLD_PX
  ) {
    return { ...next, phase: "dragging" };
  }
  return next;
}

export function applyConnectionRoutePointerUp(
  state: ConnectionRouteGestureState,
  pointerId: number,
  scale = 1,
): {
  state: ConnectionRouteGestureState;
  commit: ConnectionRouteTapCommit | ConnectionRouteDragCommit | null;
} {
  if (state.phase === "cancelled") {
    return { state: createIdleConnectionRouteGesture(), commit: null };
  }
  if (state.pointerId !== pointerId) {
    return { state, commit: null };
  }
  if (state.phase === "dragging" && state.connectionId && state.segment) {
    const safeScale = scale === 0 ? 1 : scale;
    return {
      state: createIdleConnectionRouteGesture(),
      commit: {
        kind: "drag",
        connectionId: state.connectionId,
        segmentIndex: state.segment.index,
        deltaX: (state.lastClientX - state.startClientX) / safeScale,
        deltaY: (state.lastClientY - state.startClientY) / safeScale,
        grab: state.startLogical ? { ...state.startLogical } : null,
      },
    };
  }
  if (state.phase === "pressing" && state.connectionId) {
    return {
      state: createIdleConnectionRouteGesture(),
      commit: {
        kind: "tap",
        connectionId: state.connectionId,
        clientX: state.startClientX,
        clientY: state.startClientY,
      },
    };
  }
  return { state: createIdleConnectionRouteGesture(), commit: null };
}

export function applyConnectionRouteCancel(): ConnectionRouteGestureState {
  return createIdleConnectionRouteGesture();
}

export function connectionRouteDragDelta(
  state: ConnectionRouteGestureState,
  scale = 1,
): { deltaX: number; deltaY: number } {
  const safeScale = scale === 0 ? 1 : scale;
  return {
    deltaX: (state.lastClientX - state.startClientX) / safeScale,
    deltaY: (state.lastClientY - state.startClientY) / safeScale,
  };
}
