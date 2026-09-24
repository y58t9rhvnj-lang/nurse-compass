/**
 * Popover vs A3 gesture split.
 * Never steal viewport pointer events for pinch / pan.
 */

export type ActionPopoverKind =
  | "card"
  | "relation"
  | "card_type"
  | "connection"
  | "priority";

export type ActionPopoverPointerDecision =
  | "ignore"
  | "dismiss-gesture"
  | "dismiss-outside";

export function isActionPopoverSurface(target: EventTarget | null): boolean {
  if (target == null || typeof target !== "object") return false;
  const el = target as { closest?: (selector: string) => unknown };
  if (typeof el.closest !== "function") return false;
  return Boolean(el.closest("[data-rd-action-popover]"));
}

export function isAddCardControl(target: EventTarget | null): boolean {
  if (target == null || typeof target !== "object") return false;
  const el = target as { closest?: (selector: string) => unknown };
  if (typeof el.closest !== "function") return false;
  return Boolean(el.closest("[data-rd-add-card]"));
}

export function classifyActionPopoverPointer(input: {
  kind: ActionPopoverKind;
  pointerCount: number;
  targetIsPopover: boolean;
  targetIsConnectionHit?: boolean;
}): ActionPopoverPointerDecision {
  if (input.pointerCount >= 2) return "dismiss-gesture";
  if (input.kind === "relation" && !input.targetIsPopover) {
    return "dismiss-outside";
  }
  if (input.kind === "card_type" && !input.targetIsPopover) {
    return "dismiss-outside";
  }
  if (input.kind === "connection" && input.targetIsConnectionHit) {
    return "ignore";
  }
  if (input.kind === "connection" && !input.targetIsPopover) {
    return "dismiss-outside";
  }
  if (input.kind === "priority" && !input.targetIsPopover) {
    return "dismiss-outside";
  }
  return "ignore";
}

export function trackPointerDown(
  ids: Set<number>,
  pointerId: number,
): number {
  ids.add(pointerId);
  return ids.size;
}

export function trackPointerUp(ids: Set<number>, pointerId: number): number {
  ids.delete(pointerId);
  return ids.size;
}
