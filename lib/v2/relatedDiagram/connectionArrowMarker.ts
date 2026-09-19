/**
 * Shared Connection arrow-marker contract.
 * Live canvas and print portal must each own unique marker ids
 * so url(#…) does not resolve to the hidden print SVG.
 */

import type { RelatedDiagramConnectionRelationType } from "./types";
import { resolveConnectionStrokeVisual } from "./visualStyle";

export const CONNECTION_ARROW_MARKER_BASE_ID = "rd-arrow";
export const CONNECTION_ARROW_THICK_MARKER_BASE_ID = "rd-arrow-thick";

export function sanitizeSvgIdToken(value: string): string {
  const cleaned = value.replace(/[^A-Za-z0-9_-]/g, "");
  return cleaned.length > 0 ? cleaned : "0";
}

export function connectionArrowMarkerBaseId(
  relation: RelatedDiagramConnectionRelationType,
):
  | typeof CONNECTION_ARROW_MARKER_BASE_ID
  | typeof CONNECTION_ARROW_THICK_MARKER_BASE_ID {
  return resolveConnectionStrokeVisual(relation).marker === "arrow-thick"
    ? CONNECTION_ARROW_THICK_MARKER_BASE_ID
    : CONNECTION_ARROW_MARKER_BASE_ID;
}

export function scopedConnectionArrowMarkerId(
  relation: RelatedDiagramConnectionRelationType,
  scope: string,
): string {
  return `${connectionArrowMarkerBaseId(relation)}-${sanitizeSvgIdToken(scope)}`;
}

export function connectionPathMarkerAttrs(markerId: string): {
  markerEnd: string;
  markerStart: undefined;
} {
  return {
    markerEnd: `url(#${markerId})`,
    markerStart: undefined,
  };
}

export function connectionArrowRenderContract(
  relation: RelatedDiagramConnectionRelationType,
  scope: string,
) {
  const stroke = resolveConnectionStrokeVisual(relation);
  const markerId = scopedConnectionArrowMarkerId(relation, scope);
  const attrs = connectionPathMarkerAttrs(markerId);
  return {
    relation,
    stroke: stroke.stroke,
    strokeWidth: stroke.strokeWidthPx,
    dasharray: stroke.dasharray,
    marker: stroke.marker,
    markerId,
    markerEnd: attrs.markerEnd,
    markerStart: null,
    markerUrl: attrs.markerEnd,
  };
}
