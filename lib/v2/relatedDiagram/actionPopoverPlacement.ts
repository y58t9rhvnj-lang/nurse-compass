/**
 * Floating action popover placement. Overlay only — never moves A3 / cards.
 */

export type PopoverSide = "top" | "bottom" | "right" | "left";

export type ScreenRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ScreenSize = {
  width: number;
  height: number;
};

export const ACTION_POPOVER_SIDES: readonly PopoverSide[] = [
  "top",
  "bottom",
  "right",
  "left",
];

export const ACTION_POPOVER_GAP_PX = 10;
export const ACTION_POPOVER_MARGIN_PX = 8;

export function cardScreenRect(
  card: { layout: { x: number; y: number; width: number; height: number } },
  viewport: { left: number; top: number },
  transform: { x: number; y: number; scale: number },
): ScreenRect {
  return {
    x: viewport.left + transform.x + card.layout.x * transform.scale,
    y: viewport.top + transform.y + card.layout.y * transform.scale,
    width: card.layout.width * transform.scale,
    height: card.layout.height * transform.scale,
  };
}

function candidateRect(
  side: PopoverSide,
  anchor: ScreenRect,
  popover: ScreenSize,
  gap: number,
): ScreenRect {
  const cx = anchor.x + anchor.width / 2;
  const cy = anchor.y + anchor.height / 2;
  if (side === "top") {
    return {
      x: cx - popover.width / 2,
      y: anchor.y - gap - popover.height,
      width: popover.width,
      height: popover.height,
    };
  }
  if (side === "bottom") {
    return {
      x: cx - popover.width / 2,
      y: anchor.y + anchor.height + gap,
      width: popover.width,
      height: popover.height,
    };
  }
  if (side === "right") {
    return {
      x: anchor.x + anchor.width + gap,
      y: cy - popover.height / 2,
      width: popover.width,
      height: popover.height,
    };
  }
  return {
    x: anchor.x - gap - popover.width,
    y: cy - popover.height / 2,
    width: popover.width,
    height: popover.height,
  };
}

export function rectFitsInViewport(
  rect: ScreenRect,
  viewport: ScreenRect,
  margin = ACTION_POPOVER_MARGIN_PX,
): boolean {
  return (
    rect.x >= viewport.x + margin &&
    rect.y >= viewport.y + margin &&
    rect.x + rect.width <= viewport.x + viewport.width - margin &&
    rect.y + rect.height <= viewport.y + viewport.height - margin
  );
}

export function clampRectToViewport(
  rect: ScreenRect,
  viewport: ScreenRect,
  margin = ACTION_POPOVER_MARGIN_PX,
): ScreenRect {
  const maxX = viewport.x + viewport.width - rect.width - margin;
  const maxY = viewport.y + viewport.height - rect.height - margin;
  const minX = viewport.x + margin;
  const minY = viewport.y + margin;
  return {
    x: Math.min(Math.max(rect.x, minX), Math.max(minX, maxX)),
    y: Math.min(Math.max(rect.y, minY), Math.max(minY, maxY)),
    width: rect.width,
    height: rect.height,
  };
}

/** Dock connection Action Bar to the viewport corner so it never covers the selected line. */
export function connectionActionBarDockRect(viewport: ScreenRect): ScreenRect {
  return {
    x: viewport.x + ACTION_POPOVER_MARGIN_PX,
    y: viewport.y + ACTION_POPOVER_MARGIN_PX,
    width: 1,
    height: 1,
  };
}

export function placeActionPopover(input: {
  anchor: ScreenRect;
  popover: ScreenSize;
  viewport: ScreenRect;
  gap?: number;
  margin?: number;
}): { x: number; y: number; side: PopoverSide } {
  const gap = input.gap ?? ACTION_POPOVER_GAP_PX;
  const margin = input.margin ?? ACTION_POPOVER_MARGIN_PX;
  for (const side of ACTION_POPOVER_SIDES) {
    const candidate = candidateRect(side, input.anchor, input.popover, gap);
    if (rectFitsInViewport(candidate, input.viewport, margin)) {
      return { x: candidate.x, y: candidate.y, side };
    }
  }
  const fallback = clampRectToViewport(
    candidateRect("top", input.anchor, input.popover, gap),
    input.viewport,
    margin,
  );
  return { x: fallback.x, y: fallback.y, side: "top" };
}
