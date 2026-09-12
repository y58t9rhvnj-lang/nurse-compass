/**
 * A3 logical reserved bounds for the Related Diagram legend.
 * Legend is a print/UI aid — not part of the semantic graph.
 * Slice 2 can use these bounds to avoid placing student cards on the legend.
 */

import { A3_HEIGHT_PX, A3_WIDTH_PX } from "./a3Canvas";

export const A3_LEGEND_MARGIN_PX = 14;
export const A3_LEGEND_WIDTH_PX = 190;
export const A3_LEGEND_HEIGHT_PX = 204;

export type A3LegendBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function getA3LegendBounds(
  canvasWidth = A3_WIDTH_PX,
  canvasHeight = A3_HEIGHT_PX,
): A3LegendBounds {
  return {
    x: canvasWidth - A3_LEGEND_MARGIN_PX - A3_LEGEND_WIDTH_PX,
    y: canvasHeight - A3_LEGEND_MARGIN_PX - A3_LEGEND_HEIGHT_PX,
    width: A3_LEGEND_WIDTH_PX,
    height: A3_LEGEND_HEIGHT_PX,
  };
}

export function a3LegendAreaRatio(
  canvasWidth = A3_WIDTH_PX,
  canvasHeight = A3_HEIGHT_PX,
): number {
  const bounds = getA3LegendBounds(canvasWidth, canvasHeight);
  return (bounds.width * bounds.height) / (canvasWidth * canvasHeight);
}

/** True if a card rect intersects the reserved legend area (future placement). */
export function rectIntersectsA3Legend(
  rect: { x: number; y: number; width: number; height: number },
  canvasWidth = A3_WIDTH_PX,
  canvasHeight = A3_HEIGHT_PX,
): boolean {
  const b = getA3LegendBounds(canvasWidth, canvasHeight);
  return (
    rect.x < b.x + b.width &&
    rect.x + rect.width > b.x &&
    rect.y < b.y + b.height &&
    rect.y + rect.height > b.y
  );
}
