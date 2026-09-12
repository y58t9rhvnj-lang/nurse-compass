/**
 * Pure A3 viewport gesture math (Slice 1).
 * Touch navigation: 2-finger centroid = pan, 2-finger distance = zoom.
 * 1-finger canvas pan is intentionally not modeled here (reserved for future editing).
 */

import { clampScale, type ScaleClamp } from "./a3Canvas";

export type ViewportPoint = { x: number; y: number };

export type A3ViewportTransform = {
  scale: number;
  x: number;
  y: number;
};

export type TwoFingerGestureStart = {
  /** Finger distance at gesture start (client px). */
  dist: number;
  scale: number;
  /** Centroid in client coordinates at gesture start. */
  mid: ViewportPoint;
  tx: number;
  ty: number;
};

export function pointerDistance(a: ViewportPoint, b: ViewportPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function pointerCentroid(
  a: ViewportPoint,
  b: ViewportPoint,
): ViewportPoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * Apply simultaneous 2-finger pan + pinch-zoom.
 * - distance change → scale (pinch)
 * - centroid movement → pan
 * Content under the start centroid stays under the current centroid.
 */
export function applyTwoFingerViewportTransform(input: {
  start: TwoFingerGestureStart;
  currentA: ViewportPoint;
  currentB: ViewportPoint;
  viewportLeft: number;
  viewportTop: number;
  scaleClamp?: ScaleClamp;
}): A3ViewportTransform {
  const { start, currentA, currentB, viewportLeft, viewportTop } = input;
  const dist = pointerDistance(currentA, currentB);
  const mid = pointerCentroid(currentA, currentB);
  const ratio = dist / Math.max(1, start.dist);
  const nextScale = clampScale(start.scale * ratio, input.scaleClamp);

  const startPx = start.mid.x - viewportLeft;
  const startPy = start.mid.y - viewportTop;
  const px = mid.x - viewportLeft;
  const py = mid.y - viewportTop;

  const contentX = (startPx - start.tx) / start.scale;
  const contentY = (startPy - start.ty) / start.scale;

  return {
    scale: nextScale,
    x: px - contentX * nextScale,
    y: py - contentY * nextScale,
  };
}

/** Scale about a viewport-local pivot (desktop wheel / 100% helpers). */
export function scaleAboutPivot(input: {
  transform: A3ViewportTransform;
  nextScale: number;
  pivotClientX: number;
  pivotClientY: number;
  viewportLeft: number;
  viewportTop: number;
  scaleClamp?: ScaleClamp;
}): A3ViewportTransform {
  const scale = clampScale(input.nextScale, input.scaleClamp);
  const px = input.pivotClientX - input.viewportLeft;
  const py = input.pivotClientY - input.viewportTop;
  const t = input.transform;
  const contentX = (px - t.x) / t.scale;
  const contentY = (py - t.y) / t.scale;
  return {
    scale,
    x: px - contentX * scale,
    y: py - contentY * scale,
  };
}
