/**
 * Card interaction state machine (Slice 2A).
 * Pure functions — no DOM, no persistence.
 */

import { A3_HEIGHT_PX, A3_WIDTH_PX } from "./a3Canvas";
import { clampCardToA3 } from "./a3CardBoundary";
import { clampGroupDelta } from "./knowledgeGroupLayout";
import { logicalDragPosition } from "./a3PointerMath";
import type {
  RelatedDiagramCard,
  RelatedDiagramCardOrigin,
  RelatedDiagramCardType,
} from "./types";

/** Screen / CSS px. Not A3 logical px. */
export const CARD_DRAG_THRESHOLD_PX = 6;

export type InteractionPhase =
  | "IDLE"
  | "CARD_SELECTED"
  | "CARD_DRAGGING"
  | "GROUP_SELECTED"
  | "GROUP_DRAGGING"
  | "VIEWPORT_GESTURE";

export type CardInteractionState = {
  phase: InteractionPhase;
  selectedCardId: string | null;
  selectedGroup: boolean;
  pointerId: number | null;
  pointerType: string | null;
  movable: boolean;
  startClientX: number;
  startClientY: number;
  lastClientX: number;
  lastClientY: number;
  originX: number;
  originY: number;
  currentX: number;
  currentY: number;
  cardWidth: number;
  cardHeight: number;
  groupStartX: number;
  groupStartY: number;
};

export type CardPositionCommit = {
  kind: "card";
  cardId: string;
  x: number;
  y: number;
};

export type GroupPositionCommit = {
  kind: "group";
  dx: number;
  dy: number;
};

export type DragCommit = CardPositionCommit | GroupPositionCommit;

export function isCardSemanticLocked(card: {
  cardType: RelatedDiagramCardType;
  origin?: RelatedDiagramCardOrigin;
}): boolean {
  return (
    card.cardType === "knowledge" || card.origin === "knowledge_library"
  );
}

/** Layout may move even when `isLocked` (Knowledge semantic lock). */
export function isCardLayoutMovable(card: {
  isLocked: boolean;
  cardType: RelatedDiagramCardType;
}): boolean {
  if (card.cardType === "knowledge") return true;
  return !card.isLocked;
}

/** @deprecated Use isCardLayoutMovable. Kept for call-site compatibility. */
export function isCardMovable(card: {
  isLocked: boolean;
  cardType: RelatedDiagramCardType;
}): boolean {
  return isCardLayoutMovable(card);
}

export function isRelatedDiagramCardTarget(
  target: EventTarget | null,
): boolean {
  return target instanceof Element && Boolean(target.closest("[data-rd-card-id]"));
}

export function isRelatedDiagramInteractionTarget(
  target: EventTarget | null,
): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest("[data-rd-card-id]") ||
      target.closest("[data-rd-knowledge-group-handle]"),
  );
}

export function shouldBeginViewportMousePan(input: {
  pointerType: string;
  targetIsCard: boolean;
}): boolean {
  if (input.pointerType !== "mouse") return false;
  return !input.targetIsCard;
}

export function createIdleState(): CardInteractionState {
  return {
    phase: "IDLE",
    selectedCardId: null,
    selectedGroup: false,
    pointerId: null,
    pointerType: null,
    movable: false,
    startClientX: 0,
    startClientY: 0,
    lastClientX: 0,
    lastClientY: 0,
    originX: 0,
    originY: 0,
    currentX: 0,
    currentY: 0,
    cardWidth: 0,
    cardHeight: 0,
    groupStartX: 0,
    groupStartY: 0,
  };
}

function withPointerSample(
  state: CardInteractionState,
  input: {
    pointerId: number;
    pointerType: string;
    clientX: number;
    clientY: number;
  },
  extra: Partial<CardInteractionState> = {},
): CardInteractionState {
  return {
    ...state,
    ...extra,
    pointerId: input.pointerId,
    pointerType: input.pointerType,
    startClientX: input.clientX,
    startClientY: input.clientY,
    lastClientX: input.clientX,
    lastClientY: input.clientY,
  };
}

export function applyPointerDownOnCard(
  state: CardInteractionState,
  input: {
    cardId: string;
    movable: boolean;
    pointerId: number;
    pointerType: string;
    clientX: number;
    clientY: number;
    originX: number;
    originY: number;
    cardWidth: number;
    cardHeight: number;
  },
): CardInteractionState {
  if (state.phase === "VIEWPORT_GESTURE") {
    return state;
  }
  return withPointerSample(state, input, {
    phase: "CARD_SELECTED",
    selectedCardId: input.cardId,
    selectedGroup: false,
    movable: input.movable,
    originX: input.originX,
    originY: input.originY,
    currentX: input.originX,
    currentY: input.originY,
    cardWidth: input.cardWidth,
    cardHeight: input.cardHeight,
  });
}

export function applyPointerDownOnGroupHandle(
  state: CardInteractionState,
  input: {
    pointerId: number;
    pointerType: string;
    clientX: number;
    clientY: number;
    bboxX: number;
    bboxY: number;
    bboxWidth: number;
    bboxHeight: number;
  },
): CardInteractionState {
  if (state.phase === "VIEWPORT_GESTURE") {
    return state;
  }
  return withPointerSample(state, input, {
    phase: "GROUP_SELECTED",
    selectedCardId: null,
    selectedGroup: true,
    movable: true,
    originX: 0,
    originY: 0,
    currentX: 0,
    currentY: 0,
    cardWidth: input.bboxWidth,
    cardHeight: input.bboxHeight,
    groupStartX: input.bboxX,
    groupStartY: input.bboxY,
  });
}

export function applyPointerDownOnBlank(
  state: CardInteractionState,
): CardInteractionState {
  if (
    state.phase === "VIEWPORT_GESTURE" ||
    state.phase === "CARD_DRAGGING" ||
    state.phase === "GROUP_DRAGGING"
  ) {
    return state;
  }
  return createIdleState();
}

export function applyPointerMove(
  state: CardInteractionState,
  input: {
    pointerId: number;
    clientX: number;
    clientY: number;
    scale: number;
    canvasWidth?: number;
    canvasHeight?: number;
  },
): CardInteractionState {
  if (state.pointerId !== input.pointerId) return state;
  if (state.phase === "VIEWPORT_GESTURE" || state.phase === "IDLE") {
    return state;
  }
  const dist = Math.hypot(
    input.clientX - state.startClientX,
    input.clientY - state.startClientY,
  );
  let phase = state.phase;
  if (
    phase === "CARD_SELECTED" &&
    state.movable &&
    dist >= CARD_DRAG_THRESHOLD_PX
  ) {
    phase = "CARD_DRAGGING";
  }
  if (phase === "GROUP_SELECTED" && dist >= CARD_DRAG_THRESHOLD_PX) {
    phase = "GROUP_DRAGGING";
  }
  if (phase !== "CARD_DRAGGING" && phase !== "GROUP_DRAGGING") {
    return {
      ...state,
      lastClientX: input.clientX,
      lastClientY: input.clientY,
    };
  }
  const next = logicalDragPosition(
    { x: state.originX, y: state.originY },
    { x: state.startClientX, y: state.startClientY },
    { x: input.clientX, y: input.clientY },
    input.scale,
  );
  const canvasWidth = input.canvasWidth ?? A3_WIDTH_PX;
  const canvasHeight = input.canvasHeight ?? A3_HEIGHT_PX;
  if (phase === "GROUP_DRAGGING") {
    const clamped = clampGroupDelta(
      {
        x: state.groupStartX,
        y: state.groupStartY,
        width: state.cardWidth,
        height: state.cardHeight,
      },
      next.x,
      next.y,
      canvasWidth,
      canvasHeight,
    );
    return {
      ...state,
      phase,
      lastClientX: input.clientX,
      lastClientY: input.clientY,
      currentX: clamped.dx,
      currentY: clamped.dy,
    };
  }
  const clamped = clampCardToA3(
    {
      x: next.x,
      y: next.y,
      width: state.cardWidth,
      height: state.cardHeight,
    },
    canvasWidth,
    canvasHeight,
  );
  return {
    ...state,
    phase,
    lastClientX: input.clientX,
    lastClientY: input.clientY,
    currentX: clamped.x,
    currentY: clamped.y,
  };
}

export function applyPointerUp(
  state: CardInteractionState,
  input: { pointerId: number },
): { state: CardInteractionState; drop: DragCommit | null } {
  if (state.pointerId !== input.pointerId) {
    return { state, drop: null };
  }
  if (state.phase === "VIEWPORT_GESTURE") {
    return { state: { ...state, pointerId: null }, drop: null };
  }
  if (state.phase === "GROUP_DRAGGING" && state.selectedGroup) {
    return {
      state: {
        ...state,
        phase: "GROUP_SELECTED",
        pointerId: null,
        pointerType: null,
      },
      drop: { kind: "group", dx: state.currentX, dy: state.currentY },
    };
  }
  if (state.phase === "CARD_DRAGGING" && state.selectedCardId) {
    return {
      state: {
        ...state,
        phase: "CARD_SELECTED",
        pointerId: null,
        pointerType: null,
      },
      drop: {
        kind: "card",
        cardId: state.selectedCardId,
        x: state.currentX,
        y: state.currentY,
      },
    };
  }
  return {
    state: {
      ...state,
      phase: state.selectedGroup
        ? "GROUP_SELECTED"
        : state.selectedCardId
          ? "CARD_SELECTED"
          : "IDLE",
      pointerId: null,
      pointerType: null,
    },
    drop: null,
  };
}

/**
 * Second touch while a card gesture is active, or 2-finger start from idle.
 * Commits the current legal card position; does not revert to origin.
 */
export function applySecondTouch(
  state: CardInteractionState,
): { state: CardInteractionState; commit: DragCommit | null } {
  if (state.phase === "GROUP_DRAGGING" && state.selectedGroup) {
    return {
      state: {
        ...state,
        phase: "VIEWPORT_GESTURE",
        pointerId: null,
        pointerType: null,
      },
      commit: { kind: "group", dx: state.currentX, dy: state.currentY },
    };
  }
  if (state.phase === "CARD_DRAGGING" && state.selectedCardId) {
    return {
      state: {
        ...state,
        phase: "VIEWPORT_GESTURE",
        pointerId: null,
        pointerType: null,
      },
      commit: {
        kind: "card",
        cardId: state.selectedCardId,
        x: state.currentX,
        y: state.currentY,
      },
    };
  }
  return {
    state: {
      ...state,
      phase: "VIEWPORT_GESTURE",
      pointerId: null,
      pointerType: null,
    },
    commit: null,
  };
}

export function applyViewportGestureEnd(
  state: CardInteractionState,
): CardInteractionState {
  if (state.phase !== "VIEWPORT_GESTURE") return state;
  if (state.selectedGroup) {
    return {
      ...state,
      phase: "GROUP_SELECTED",
      pointerId: null,
      pointerType: null,
    };
  }
  if (state.selectedCardId) {
    return {
      ...state,
      phase: "CARD_SELECTED",
      pointerId: null,
      pointerType: null,
    };
  }
  return createIdleState();
}

export function applyEscape(
  state: CardInteractionState,
): { state: CardInteractionState; drop: DragCommit | null } {
  if (state.phase === "GROUP_DRAGGING" && state.selectedGroup) {
    return {
      state: createIdleState(),
      drop: { kind: "group", dx: state.currentX, dy: state.currentY },
    };
  }
  if (state.phase === "CARD_DRAGGING" && state.selectedCardId) {
    return {
      state: createIdleState(),
      drop: {
        kind: "card",
        cardId: state.selectedCardId,
        x: state.currentX,
        y: state.currentY,
      },
    };
  }
  return { state: createIdleState(), drop: null };
}

export function applyCardPositionToGraph<
  T extends { cards: RelatedDiagramCard[] },
>(graph: T, cardId: string, x: number, y: number): T {
  return {
    ...graph,
    cards: graph.cards.map((card) =>
      card.id === cardId
        ? { ...card, layout: { ...card.layout, x, y } }
        : card,
    ),
  };
}
