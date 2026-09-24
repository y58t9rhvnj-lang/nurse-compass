/**
 * Route Trace V1 gesture — 1 finger paints a replacement interval.
 * 2 pointers cancel. Raw points stay local; rAF coalesces UI preview.
 */

import { CARD_DRAG_THRESHOLD_PX } from "./cardInteractionState";
import { canTraceConnectionRoute, TRACE_SAMPLE_MIN_DIST_PX } from "./routeTrace";
import type { Point } from "./orthogonalRouting";
import type { RelatedDiagramRouteTopology } from "./routeTopology";
import type { RelatedDiagramConnection } from "./types";

export const ROUTE_TRACE_DRAG_THRESHOLD_PX = CARD_DRAG_THRESHOLD_PX;

export type RouteTraceGesturePhase = "idle" | "tracing" | "cancelled";

export type RouteTraceGestureState = {
  phase: RouteTraceGesturePhase;
  pointerId: number | null;
  connectionId: string | null;
  raw: Point[];
};

export function createIdleRouteTraceGesture(): RouteTraceGestureState {
  return {
    phase: "idle",
    pointerId: null,
    connectionId: null,
    raw: [],
  };
}

export function canStartRouteTrace(input: {
  connection: RelatedDiagramConnection | null;
  topology?: RelatedDiagramRouteTopology;
  pointerCount: number;
  cardDragging: boolean;
  traceArmed: boolean;
}): boolean {
  if (!input.traceArmed) return false;
  if (input.cardDragging) return false;
  if (input.pointerCount >= 2) return false;
  if (!input.connection) return false;
  return canTraceConnectionRoute(input.topology, input.connection);
}

export function applyRouteTracePointerDown(input: {
  pointerId: number;
  pointerCount: number;
  isPrimary: boolean;
  connectionId: string;
  logical: Point;
  connection: RelatedDiagramConnection;
  topology?: RelatedDiagramRouteTopology;
  cardDragging: boolean;
  traceArmed: boolean;
}): RouteTraceGestureState {
  if (
    !canStartRouteTrace({
      connection: input.connection,
      topology: input.topology,
      pointerCount: input.pointerCount,
      cardDragging: input.cardDragging,
      traceArmed: input.traceArmed,
    }) ||
    !input.isPrimary
  ) {
    return createIdleRouteTraceGesture();
  }
  return {
    phase: "tracing",
    pointerId: input.pointerId,
    connectionId: input.connectionId,
    raw: [{ ...input.logical }],
  };
}

export function applyRouteTraceSecondPointer(
  state: RouteTraceGestureState,
): RouteTraceGestureState {
  if (state.phase === "idle") return state;
  return { ...createIdleRouteTraceGesture(), phase: "cancelled" };
}

export function applyRouteTracePointerMove(
  state: RouteTraceGestureState,
  input: {
    pointerId: number;
    pointerCount: number;
    logical: Point;
  },
): RouteTraceGestureState {
  if (state.pointerId !== input.pointerId) return state;
  if (state.phase !== "tracing") return state;
  if (input.pointerCount >= 2) return applyRouteTraceSecondPointer(state);
  const last = state.raw[state.raw.length - 1];
  if (
    last &&
    Math.hypot(input.logical.x - last.x, input.logical.y - last.y) <
      TRACE_SAMPLE_MIN_DIST_PX
  ) {
    return state;
  }
  return { ...state, raw: [...state.raw, { ...input.logical }] };
}

export function applyRouteTracePointerUp(
  state: RouteTraceGestureState,
  pointerId: number,
  logical: Point,
): {
  state: RouteTraceGestureState;
  commit: { connectionId: string; raw: Point[] } | null;
} {
  if (state.phase === "cancelled") {
    return { state: createIdleRouteTraceGesture(), commit: null };
  }
  if (state.pointerId !== pointerId || state.phase !== "tracing" || !state.connectionId) {
    return { state: createIdleRouteTraceGesture(), commit: null };
  }
  const raw = [...state.raw];
  const last = raw[raw.length - 1];
  if (!last || last.x !== logical.x || last.y !== logical.y) {
    raw.push({ ...logical });
  }
  return {
    state: createIdleRouteTraceGesture(),
    commit: { connectionId: state.connectionId, raw },
  };
}

export function applyRouteTraceCancel(): RouteTraceGestureState {
  return createIdleRouteTraceGesture();
}
