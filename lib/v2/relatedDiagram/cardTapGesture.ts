/**
 * Card tap vs drag release policy.
 * Reuses CARD_DRAG_THRESHOLD_PX — do not define a second threshold.
 * Drag is decided by pointer movement, not by whether card x/y changed.
 */

import {
  CARD_DRAG_THRESHOLD_PX,
  type CardInteractionState,
  type InteractionPhase,
} from "./cardInteractionState";

export { CARD_DRAG_THRESHOLD_PX };

export type CardPointerReleaseKind = "tap" | "drag" | "ignored";

export type PointerSample = {
  clientX: number;
  clientY: number;
};

export function pointerScreenDistance(
  from: PointerSample,
  to: PointerSample,
): number {
  return Math.hypot(to.clientX - from.clientX, to.clientY - from.clientY);
}

export function isCardDragMovement(
  from: PointerSample,
  to: PointerSample,
): boolean {
  return pointerScreenDistance(from, to) >= CARD_DRAG_THRESHOLD_PX;
}

export function cardPointerReleaseKind(input: {
  pointerMatches: boolean;
  phase: InteractionPhase;
  pointerCount?: number;
}): CardPointerReleaseKind {
  if (!input.pointerMatches) return "ignored";
  if ((input.pointerCount ?? 1) >= 2) return "ignored";
  if (input.phase === "VIEWPORT_GESTURE") return "ignored";
  if (input.phase === "CARD_DRAGGING" || input.phase === "GROUP_DRAGGING") {
    return "drag";
  }
  if (
    input.phase === "CARD_PRESSING" ||
    input.phase === "CARD_SELECTED" ||
    input.phase === "GROUP_SELECTED"
  ) {
    return "tap";
  }
  return "ignored";
}

export function cardPointerReleaseKindFromState(
  state: CardInteractionState,
  pointerId: number,
  pointerCount = 1,
): CardPointerReleaseKind {
  return cardPointerReleaseKind({
    pointerMatches: state.pointerId === pointerId,
    phase: state.phase,
    pointerCount,
  });
}

export function shouldRevealCardActionsAfterRelease(
  kind: CardPointerReleaseKind,
): boolean {
  return kind === "tap";
}

export function shouldArmClickSuppression(
  kind: CardPointerReleaseKind,
): boolean {
  return kind === "drag";
}

export type CardTapSuppression = {
  armed: boolean;
  pointerId: number | null;
  pointerType: string | null;
};

export function idleTapSuppression(): CardTapSuppression {
  return { armed: false, pointerId: null, pointerType: null };
}

export function armCardTapSuppression(
  pointerId: number,
  pointerType?: string,
): CardTapSuppression {
  return {
    armed: true,
    pointerId,
    pointerType: pointerType ?? null,
  };
}

/**
 * Next real pointerdown is a new interaction — never inherit a previous arm.
 * iPad Safari also emits a compatibility mouse pointerdown after touch;
 * that is not a new tap and must not clear the pending synthetic click.
 */
export function suppressionAfterPointerDown(
  current: CardTapSuppression,
  input: { pointerId: number; pointerType: string } | number,
): CardTapSuppression {
  if (!current.armed) return current;
  const pointerType =
    typeof input === "number" ? "" : input.pointerType;
  if (current.pointerType === "touch" && pointerType === "mouse") {
    return current;
  }
  return idleTapSuppression();
}

/**
 * Consume only the synthetic click of the same drag interaction.
 * A click that carries a different pointerId is not eaten.
 */
export function consumeSyntheticClickAfterDrag(
  current: CardTapSuppression,
  clickPointerId?: number | null,
): { consume: boolean; next: CardTapSuppression } {
  if (!current.armed) {
    return { consume: false, next: current };
  }
  if (
    clickPointerId != null &&
    current.pointerId != null &&
    clickPointerId !== current.pointerId
  ) {
    return { consume: false, next: idleTapSuppression() };
  }
  return { consume: true, next: idleTapSuppression() };
}
