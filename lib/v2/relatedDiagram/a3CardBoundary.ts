/**
 * A3 hard clamp + Legend drop nudge (Slice 2A).
 * Card-to-card collision lives in cardCollision.ts and runs after this clamp.
 */

import { A3_HEIGHT_PX, A3_WIDTH_PX } from "./a3Canvas";
import {
  getA3LegendBounds,
  rectIntersectsA3Legend,
} from "./a3Legend";

export type CardRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function clampCardToA3(
  rect: CardRect,
  canvasWidth = A3_WIDTH_PX,
  canvasHeight = A3_HEIGHT_PX,
): CardRect {
  const maxX = Math.max(0, canvasWidth - rect.width);
  const maxY = Math.max(0, canvasHeight - rect.height);
  return {
    ...rect,
    x: Math.min(maxX, Math.max(0, rect.x)),
    y: Math.min(maxY, Math.max(0, rect.y)),
  };
}

function overlapAmount(
  a0: number,
  a1: number,
  b0: number,
  b1: number,
): number {
  return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
}

function nudgeAlongX(rect: CardRect, legend: CardRect): CardRect {
  const cardMid = rect.x + rect.width / 2;
  const legendMid = legend.x + legend.width / 2;
  const x =
    cardMid <= legendMid ? legend.x - rect.width : legend.x + legend.width;
  return { ...rect, x };
}

function nudgeAlongY(rect: CardRect, legend: CardRect): CardRect {
  const cardMid = rect.y + rect.height / 2;
  const legendMid = legend.y + legend.height / 2;
  const y =
    cardMid <= legendMid ? legend.y - rect.height : legend.y + legend.height;
  return { ...rect, y };
}

/** Shortest-axis push out of the reserved legend rect. */
export function nudgeCardOffLegend(
  rect: CardRect,
  canvasWidth = A3_WIDTH_PX,
  canvasHeight = A3_HEIGHT_PX,
): CardRect {
  if (!rectIntersectsA3Legend(rect, canvasWidth, canvasHeight)) {
    return rect;
  }
  const legend = getA3LegendBounds(canvasWidth, canvasHeight);
  const overlapX = overlapAmount(
    rect.x,
    rect.x + rect.width,
    legend.x,
    legend.x + legend.width,
  );
  const overlapY = overlapAmount(
    rect.y,
    rect.y + rect.height,
    legend.y,
    legend.y + legend.height,
  );
  const primary =
    overlapX <= overlapY
      ? nudgeAlongX(rect, legend)
      : nudgeAlongY(rect, legend);
  const secondary =
    overlapX <= overlapY
      ? nudgeAlongY(rect, legend)
      : nudgeAlongX(rect, legend);
  if (!rectIntersectsA3Legend(primary, canvasWidth, canvasHeight)) {
    return primary;
  }
  if (!rectIntersectsA3Legend(secondary, canvasWidth, canvasHeight)) {
    return secondary;
  }
  return primary;
}

/** Drop resolution: Legend nudge, then A3 clamp. A3 containment wins. */
export function resolveCardDropPosition(
  rect: CardRect,
  canvasWidth = A3_WIDTH_PX,
  canvasHeight = A3_HEIGHT_PX,
): CardRect {
  const nudged = nudgeCardOffLegend(rect, canvasWidth, canvasHeight);
  const clamped = clampCardToA3(nudged, canvasWidth, canvasHeight);
  if (!rectIntersectsA3Legend(clamped, canvasWidth, canvasHeight)) {
    return clamped;
  }
  const again = clampCardToA3(
    nudgeCardOffLegend(clamped, canvasWidth, canvasHeight),
    canvasWidth,
    canvasHeight,
  );
  return again;
}
