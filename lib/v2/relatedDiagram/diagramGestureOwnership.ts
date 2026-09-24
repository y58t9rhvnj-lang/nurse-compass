/**
 * Diagram vs viewport gesture ownership.
 * 1 pointer on connection/card/route stays with the diagram.
 * 2 pointers always hand off to the viewport.
 */

import type { ScaleClamp } from "./a3Canvas";
import {
  applyTwoFingerViewportTransform,
  pointerCentroid,
  pointerDistance,
  type A3ViewportTransform,
  type TwoFingerGestureStart,
} from "./a3ViewportGesture";

export type DiagramPointerTarget = "blank" | "card" | "connection" | "other";

export type ViewportPointerOwner = "diagram" | "viewport";

export type TrackedViewportPointer = {
  id: number;
  x: number;
  y: number;
  type: string;
  owner: ViewportPointerOwner;
};

export type ViewportOwnershipState = {
  pointers: TrackedViewportPointer[];
  twoFinger: TwoFingerGestureStart | null;
  transform: A3ViewportTransform;
};

export function classifyDiagramPointerTarget(
  target: EventTarget | null,
): DiagramPointerTarget {
  if (target == null || typeof target !== "object") return "blank";
  const el = target as { closest?: (selector: string) => unknown };
  if (typeof el.closest !== "function") return "blank";
  if (
    el.closest("[data-rd-card-id]") ||
    el.closest("[data-rd-knowledge-group-handle]")
  ) {
    return "card";
  }
  if (
    el.closest("[data-rd-connection-hit]") ||
    el.closest("[data-rd-route-trace-capture]")
  ) {
    return "connection";
  }
  return "blank";
}

export function isDiagramOwnedTarget(target: DiagramPointerTarget): boolean {
  return target === "card" || target === "connection";
}

export function activeTouchPointers(
  pointers: TrackedViewportPointer[],
): TrackedViewportPointer[] {
  return pointers
    .filter((pointer) => pointer.type === "touch")
    .sort((a, b) => a.id - b.id);
}

export function viewportShouldApplyTransform(touchCount: number): boolean {
  return touchCount >= 2;
}

export function viewportShouldCapturePointer(input: {
  pointerType: string;
  touchCountAfter: number;
}): boolean {
  return input.pointerType === "touch" && input.touchCountAfter >= 2;
}

export function createIdleViewportOwnership(
  transform: A3ViewportTransform,
): ViewportOwnershipState {
  return {
    pointers: [],
    twoFinger: null,
    transform: { ...transform },
  };
}

function upsertPointer(
  pointers: TrackedViewportPointer[],
  next: TrackedViewportPointer,
): TrackedViewportPointer[] {
  return [...pointers.filter((pointer) => pointer.id !== next.id), next];
}

function beginTwoFinger(
  transform: A3ViewportTransform,
  pointers: TrackedViewportPointer[],
): TwoFingerGestureStart | null {
  const touches = activeTouchPointers(pointers);
  if (touches.length < 2) return null;
  const a = touches[0]!;
  const b = touches[1]!;
  return {
    dist: pointerDistance(a, b),
    scale: transform.scale,
    mid: pointerCentroid(a, b),
    tx: transform.x,
    ty: transform.y,
  };
}

export function applyViewportOwnedPointerDown(
  state: ViewportOwnershipState,
  input: {
    pointerId: number;
    clientX: number;
    clientY: number;
    pointerType: string;
    target: DiagramPointerTarget;
  },
): {
  state: ViewportOwnershipState;
  capture: boolean;
  handoffToViewport: boolean;
} {
  const owner: ViewportPointerOwner =
    input.pointerType === "touch" && isDiagramOwnedTarget(input.target)
      ? "diagram"
      : "viewport";
  const pointers = upsertPointer(state.pointers, {
    id: input.pointerId,
    x: input.clientX,
    y: input.clientY,
    type: input.pointerType,
    owner,
  });
  const touches = activeTouchPointers(pointers);
  if (touches.length >= 2) {
    const owned = pointers.map((pointer) => ({
      ...pointer,
      owner: "viewport" as const,
    }));
    return {
      state: {
        pointers: owned,
        twoFinger: beginTwoFinger(state.transform, owned),
        transform: state.transform,
      },
      capture: true,
      handoffToViewport: true,
    };
  }
  return {
    state: {
      pointers,
      twoFinger: null,
      transform: state.transform,
    },
    capture: false,
    handoffToViewport: false,
  };
}

export function applyViewportOwnedPointerMove(
  state: ViewportOwnershipState,
  input: {
    pointerId: number;
    clientX: number;
    clientY: number;
    viewportLeft?: number;
    viewportTop?: number;
    scaleClamp?: ScaleClamp;
  },
): { state: ViewportOwnershipState; applied: boolean } {
  const current = state.pointers.find((pointer) => pointer.id === input.pointerId);
  if (!current) {
    return { state, applied: false };
  }
  const pointers = upsertPointer(state.pointers, {
    ...current,
    x: input.clientX,
    y: input.clientY,
  });
  const touches = activeTouchPointers(pointers);
  if (!viewportShouldApplyTransform(touches.length)) {
    return {
      state: {
        pointers,
        twoFinger: null,
        transform: state.transform,
      },
      applied: false,
    };
  }
  const twoFinger =
    state.twoFinger ?? beginTwoFinger(state.transform, pointers);
  if (!twoFinger) {
    return {
      state: { pointers, twoFinger: null, transform: state.transform },
      applied: false,
    };
  }
  const a = touches[0]!;
  const b = touches[1]!;
  const transform = applyTwoFingerViewportTransform({
    start: twoFinger,
    currentA: a,
    currentB: b,
    viewportLeft: input.viewportLeft ?? 0,
    viewportTop: input.viewportTop ?? 0,
    scaleClamp: input.scaleClamp,
  });
  return {
    state: { pointers, twoFinger, transform },
    applied: true,
  };
}

export function applyViewportOwnedPointerUp(
  state: ViewportOwnershipState,
  pointerId: number,
): ViewportOwnershipState {
  const pointers = state.pointers.filter((pointer) => pointer.id !== pointerId);
  const touches = activeTouchPointers(pointers);
  if (touches.length >= 2) {
    return {
      pointers,
      twoFinger: beginTwoFinger(state.transform, pointers),
      transform: state.transform,
    };
  }
  return {
    pointers,
    twoFinger: null,
    transform: state.transform,
  };
}

export function isolateDiagramOwnedPointer(event: {
  cancelable?: boolean;
  preventDefault(): void;
  stopPropagation(): void;
}): void {
  if (event.cancelable !== false) event.preventDefault();
  event.stopPropagation();
}
