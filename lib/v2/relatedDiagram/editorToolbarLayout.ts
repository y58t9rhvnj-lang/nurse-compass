/**
 * Editor toolbar fit for iPad landscape. Controls stay visible;
 * title / DEV yield first.
 */

export const IPAD_LANDSCAPE_WIDTHS = [
  1024, 1080, 1112, 1133, 1180, 1194, 1366,
] as const;

export const TOOLBAR_COMPACT_MAX_WIDTH = 1279;

export function toolbarChromeMetrics(clientWidth: number): {
  compact: boolean;
  showDev: boolean;
  paddingX: number;
  gap: number;
  titleMinWidth: number;
} {
  const compact = clientWidth <= TOOLBAR_COMPACT_MAX_WIDTH;
  return {
    compact,
    showDev: !compact,
    paddingX: compact ? 8 : 12,
    gap: compact ? 4 : 8,
    titleMinWidth: 48,
  };
}

/**
 * Conservative required width: shrink-0 chrome + a short title.
 * Dynamic Type on iPad is covered by the compact button paddings.
 */
export function estimatedToolbarRequiredWidth(clientWidth: number): number {
  const m = toolbarChromeMetrics(clientWidth);
  const left = 70 + 88 + 44 + 44 + m.gap * 3;
  const zoom = 36 + 56 + 80;
  const print = 52;
  const dev = m.showDev ? 40 + m.gap : 0;
  const right = dev + zoom + print + m.gap * 3;
  return m.paddingX * 2 + left + m.titleMinWidth + right + m.gap * 2;
}

export function toolbarRowFits(clientWidth: number): boolean {
  return estimatedToolbarRequiredWidth(clientWidth) <= clientWidth;
}

export function toolbarOverflows(input: {
  clientWidth: number;
  scrollWidth: number;
}): boolean {
  return input.scrollWidth > input.clientWidth;
}
