/**
 * A3 landscape logical canvas constants (Related Diagram V1 Slice 1).
 * Screen zoom/pan is viewport-only and must not be persisted.
 */

/** ISO A3 landscape */
export const A3_WIDTH_MM = 420;
export const A3_HEIGHT_MM = 297;

/** Screen/print baseline body size for card text */
export const A3_BODY_PT = 10.5;

/**
 * Logical pixel grid for layout authoring (≈96dpi).
 * Positions in semantic graph use these units.
 */
export const A3_PX_PER_MM = 96 / 25.4;
export const A3_WIDTH_PX = Math.round(A3_WIDTH_MM * A3_PX_PER_MM);
export const A3_HEIGHT_PX = Math.round(A3_HEIGHT_MM * A3_PX_PER_MM);

export const A3_FIT_PADDING_PX = 24;
/** Absolute floor — never treat 1.0 as minimum zoom. */
export const A3_MIN_SCALE = 0.25;
export const A3_MAX_SCALE = 2.5;

export type ScaleClamp = {
  min: number;
  max: number;
};

/** Raw fit (A3 inside viewport). Not clamped to 1.0. */
export function computeFitScaleUnclamped(
  viewportWidth: number,
  viewportHeight: number,
  contentWidth = A3_WIDTH_PX,
  contentHeight = A3_HEIGHT_PX,
  padding = A3_FIT_PADDING_PX,
): number {
  const availW = Math.max(1, viewportWidth - padding * 2);
  const availH = Math.max(1, viewportHeight - padding * 2);
  return Math.min(availW / contentWidth, availH / contentHeight);
}

/**
 * Pinch / wheel minimum. Always ≤ current fitScale.
 * If A3_MIN_SCALE were 1.0, this still returns fitScale when fit < 1.
 */
export function computeMinScale(
  viewportWidth: number,
  viewportHeight: number,
  contentWidth = A3_WIDTH_PX,
  contentHeight = A3_HEIGHT_PX,
  padding = A3_FIT_PADDING_PX,
): number {
  const fit = computeFitScaleUnclamped(
    viewportWidth,
    viewportHeight,
    contentWidth,
    contentHeight,
    padding,
  );
  return Math.min(A3_MIN_SCALE, fit);
}

export function computeScaleClamp(
  viewportWidth: number,
  viewportHeight: number,
): ScaleClamp {
  return {
    min: computeMinScale(viewportWidth, viewportHeight),
    max: A3_MAX_SCALE,
  };
}

export function clampScale(
  scale: number,
  limits?: Partial<ScaleClamp>,
): number {
  const min = limits?.min ?? A3_MIN_SCALE;
  const max = limits?.max ?? A3_MAX_SCALE;
  return Math.min(max, Math.max(min, scale));
}

export function computeFitScale(
  viewportWidth: number,
  viewportHeight: number,
  contentWidth = A3_WIDTH_PX,
  contentHeight = A3_HEIGHT_PX,
  padding = A3_FIT_PADDING_PX,
): number {
  const raw = computeFitScaleUnclamped(
    viewportWidth,
    viewportHeight,
    contentWidth,
    contentHeight,
    padding,
  );
  return clampScale(raw, computeScaleClamp(viewportWidth, viewportHeight));
}

export function computeFitTranslate(
  viewportWidth: number,
  viewportHeight: number,
  scale: number,
  contentWidth = A3_WIDTH_PX,
  contentHeight = A3_HEIGHT_PX,
): { x: number; y: number } {
  return {
    x: (viewportWidth - contentWidth * scale) / 2,
    y: (viewportHeight - contentHeight * scale) / 2,
  };
}
