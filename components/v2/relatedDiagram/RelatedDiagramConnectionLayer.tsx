"use client";

import {
  memo,
  useId,
  useMemo,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { bumpCardDragPerf } from "@/lib/v2/relatedDiagram/cardDragPerf";
import {
  overlayIncidentRoutePreviews,
  type IncidentRoutePreview,
} from "@/lib/v2/relatedDiagram/cardDragTransient";
import type {
  RelatedDiagramCard,
  RelatedDiagramConnection,
} from "@/lib/v2/relatedDiagram/types";
import { getA3LegendBounds } from "@/lib/v2/relatedDiagram/a3Legend";
import {
  CONNECTION_HALO_OPACITY,
  CONNECTION_HALO_STROKE,
  CONNECTION_HIT_STROKE_PX,
  connectionHaloStrokeWidth,
  connectionPermissions,
} from "@/lib/v2/relatedDiagram/cardConnectionManage";
import {
  CONNECTION_ARROW_MARKER_BASE_ID,
  CONNECTION_ARROW_THICK_MARKER_BASE_ID,
  connectionPathMarkerAttrs,
  sanitizeSvgIdToken,
  scopedConnectionArrowMarkerId,
} from "@/lib/v2/relatedDiagram/connectionArrowMarker";
import {
  stableRoutesList,
  type StableRouteState,
} from "@/lib/v2/relatedDiagram/incrementalRoutes";
import {
  BRIDGE_RADIUS_PX,
  buildOrthogonalHopArcs,
  buildOrthogonalSpineD,
  buildOrthogonalSpineDFromHops,
  hopArcPathD,
  planConnectionBridgeVisual,
  planOrthogonalRoutes,
} from "@/lib/v2/relatedDiagram/orthogonalRouting";
import type { RelatedDiagramRouteTopology } from "@/lib/v2/relatedDiagram/routeTopology";
import {
  overlayPreviewRoutes,
  previewIncidentOrthogonalRoutes,
} from "@/lib/v2/relatedDiagram/dragRoutePreview";
import {
  resolveConnectionStrokeVisual,
  type ConnectionStrokeVisual,
} from "@/lib/v2/relatedDiagram/visualStyle";

function freehandPathD(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`)
    .join(" ");
}

const ConnectionRouteGroup = memo(function ConnectionRouteGroup({
  connectionId,
  d,
  stroke,
  markerEnd,
  isPreview,
  selected,
  faded = false,
  bridgeHop = false,
  showHit,
  onConnectionPointerDown,
}: {
  connectionId: string;
  d: string;
  stroke: ConnectionStrokeVisual;
  markerEnd: string | undefined;
  isPreview: boolean;
  selected: boolean;
  faded?: boolean;
  bridgeHop?: boolean;
  showHit: boolean;
  onConnectionPointerDown?: (event: ReactPointerEvent<SVGPathElement>) => void;
}) {
  if (process.env.NODE_ENV !== "production" && !isPreview) {
    bumpCardDragPerf("nonIncidentConnectionRenders");
  }
  return (
    <g
      data-rd-connection={connectionId}
      data-rd-route={isPreview ? "preview" : "orthogonal"}
      data-rd-bridge={bridgeHop ? "hop" : undefined}
      data-rd-connection-selected={selected ? "true" : undefined}
    >
      {selected ? (
        <path
          className="rd-no-print"
          data-rd-connection-halo
          d={d}
          stroke={CONNECTION_HALO_STROKE}
          strokeOpacity={CONNECTION_HALO_OPACITY}
          strokeWidth={connectionHaloStrokeWidth(stroke.strokeWidthPx)}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          pointerEvents="none"
        />
      ) : null}
      <path
        d={d}
        stroke={stroke.stroke}
        strokeWidth={stroke.strokeWidthPx}
        strokeDasharray={stroke.dasharray ?? undefined}
        strokeOpacity={faded ? 0.28 : undefined}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        markerEnd={faded ? undefined : markerEnd}
      />
      {showHit ? (
        <path
          className="rd-no-print"
          data-rd-connection-hit={connectionId}
          d={d}
          stroke="transparent"
          strokeWidth={CONNECTION_HIT_STROKE_PX}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          pointerEvents="stroke"
          style={{ touchAction: "none" }}
          onPointerDown={onConnectionPointerDown}
        />
      ) : null}
    </g>
  );
});

export default function RelatedDiagramConnectionLayer({
  cards,
  connections,
  width,
  height,
  routeTopology,
  previewCardId,
  incidentRoutePreviews,
  stableRouteState,
  selectedConnectionId = null,
  routeEditPreview = null,
  routeTracePreview = null,
  onConnectionPointerDown,
}: {
  cards: RelatedDiagramCard[];
  connections: RelatedDiagramConnection[];
  width: number;
  height: number;
  routeTopology?: RelatedDiagramRouteTopology;
  previewCardId?: string | null;
  incidentRoutePreviews?: IncidentRoutePreview[];
  stableRouteState?: StableRouteState;
  selectedConnectionId?: string | null;
  routeEditPreview?: { connectionId: string; points: { x: number; y: number }[] } | null;
  routeTracePreview?: { connectionId: string; raw: { x: number; y: number }[] } | null;
  onConnectionPointerDown?: (event: ReactPointerEvent<SVGPathElement>) => void;
}) {
  const markerScope = sanitizeSvgIdToken(useId());
  const arrowMarkerId = `${CONNECTION_ARROW_MARKER_BASE_ID}-${markerScope}`;
  const thickMarkerId = `${CONNECTION_ARROW_THICK_MARKER_BASE_ID}-${markerScope}`;
  const plan = useMemo(
    () =>
      stableRouteState
        ? {
            routes: stableRoutesList(stableRouteState),
            bridges: stableRouteState.bridges,
          }
        : planOrthogonalRoutes(cards, connections, {
            canvas: { x: 0, y: 0, width, height },
            extraObstacles: [getA3LegendBounds(width, height)],
            topology: routeTopology,
          }),
    [cards, connections, height, routeTopology, stableRouteState, width],
  );
  const rubberBandPreviews = incidentRoutePreviews ?? null;
  const fallbackPreviewRoutes =
    rubberBandPreviews == null && previewCardId != null
      ? previewIncidentOrthogonalRoutes(
          cards,
          connections,
          previewCardId,
          routeTopology,
          stableRouteState,
        )
      : [];
  const previewRoutes = rubberBandPreviews ?? fallbackPreviewRoutes;
  const previewKey = previewRoutes
    .map((route) => route.connectionId)
    .sort()
    .join(",");
  const previewIds = useMemo(
    () => new Set(previewKey ? previewKey.split(",") : []),
    [previewKey],
  );
  const byConn = new Map(connections.map((c) => [c.id, c]));
  const visual = useMemo(
    () =>
      planConnectionBridgeVisual({
        routes: plan.routes,
        bridges: plan.bridges,
        previewIds: rubberBandPreviews != null ? new Set() : previewIds,
      }),
    [plan, previewIds, rubberBandPreviews],
  );
  const sharedHops = visual.hops.map((entry) => entry.hop);
  const hopOwners = new Set(visual.hops.map((entry) => entry.connectionId));
  const editPreviewId = routeEditPreview?.connectionId ?? null;
  const tracePreviewId = routeTracePreview?.connectionId ?? null;
  const committedDrawRoutes = (
    rubberBandPreviews != null
      ? visual.adoptedRoutes.filter((route) => !previewIds.has(route.connectionId))
      : overlayPreviewRoutes(
          visual.adoptedRoutes,
          fallbackPreviewRoutes,
        )
  ).filter((route) => route.connectionId !== editPreviewId);
  const rubberBandDrawRoutes =
    rubberBandPreviews != null
      ? overlayIncidentRoutePreviews(
          visual.adoptedRoutes.filter((route) =>
            previewIds.has(route.connectionId),
          ),
          rubberBandPreviews,
        )
      : [];

  return (
    <svg
      className="pointer-events-none absolute inset-0"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
    >
      <defs>
        <marker
          id={arrowMarkerId}
          viewBox="0 0 10 10"
          refX="10"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          markerUnits="userSpaceOnUse"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#1D1D1F" />
        </marker>
        <marker
          id={thickMarkerId}
          viewBox="0 0 10 10"
          refX="10"
          refY="5"
          markerWidth="9"
          markerHeight="9"
          markerUnits="userSpaceOnUse"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#1D1D1F" />
        </marker>
      </defs>
      {committedDrawRoutes.map((route) => {
        const conn = byConn.get(route.connectionId);
        if (!conn) return null;
        const stroke = resolveConnectionStrokeVisual(conn.relationType);
        const { markerEnd } = connectionPathMarkerAttrs(
          scopedConnectionArrowMarkerId(conn.relationType, markerScope),
        );
        const isPreview =
          rubberBandPreviews == null && previewIds.has(conn.id);
        const d =
          isPreview || sharedHops.length === 0
            ? buildOrthogonalSpineD(route.points, [], BRIDGE_RADIUS_PX)
            : buildOrthogonalSpineDFromHops(route.points, sharedHops);
        return (
          <ConnectionRouteGroup
            key={conn.id}
            connectionId={conn.id}
            d={d}
            stroke={stroke}
            markerEnd={markerEnd}
            isPreview={isPreview}
            bridgeHop={!isPreview && hopOwners.has(conn.id)}
            selected={selectedConnectionId === conn.id}
            faded={tracePreviewId === conn.id}
            showHit={
              Boolean(onConnectionPointerDown) &&
              connectionPermissions(conn).selectable
            }
            onConnectionPointerDown={onConnectionPointerDown}
          />
        );
      })}
      {routeEditPreview
        ? (() => {
            const conn = byConn.get(routeEditPreview.connectionId);
            if (!conn) return null;
            const stroke = resolveConnectionStrokeVisual(conn.relationType);
            const { markerEnd } = connectionPathMarkerAttrs(
              scopedConnectionArrowMarkerId(conn.relationType, markerScope),
            );
            return (
              <ConnectionRouteGroup
                key={`edit-preview-${routeEditPreview.connectionId}`}
                connectionId={routeEditPreview.connectionId}
                d={buildOrthogonalSpineD(
                  routeEditPreview.points,
                  [],
                  BRIDGE_RADIUS_PX,
                )}
                stroke={stroke}
                markerEnd={markerEnd}
                isPreview
                selected={selectedConnectionId === conn.id}
                showHit={false}
              />
            );
          })()
        : null}
      {routeTracePreview ? (
        <g data-rd-route-trace-preview pointerEvents="none">
          <path
            d={freehandPathD(routeTracePreview.raw)}
            stroke="#007AFF"
            strokeWidth={2}
            strokeDasharray="6 5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </g>
      ) : null}
      {rubberBandDrawRoutes.map((preview) => {
            const conn = byConn.get(preview.connectionId);
            if (!conn) return null;
            const stroke = resolveConnectionStrokeVisual(conn.relationType);
            const { markerEnd } = connectionPathMarkerAttrs(
              scopedConnectionArrowMarkerId(conn.relationType, markerScope),
            );
            return (
              <ConnectionRouteGroup
                key={`preview-${preview.connectionId}`}
                connectionId={preview.connectionId}
                d={buildOrthogonalSpineD(preview.points, [], BRIDGE_RADIUS_PX)}
                stroke={stroke}
                markerEnd={markerEnd}
                isPreview
                selected={selectedConnectionId === conn.id}
                showHit={
                  Boolean(onConnectionPointerDown) &&
                  connectionPermissions(conn).selectable
                }
                onConnectionPointerDown={onConnectionPointerDown}
              />
            );
          })}
      <g data-rd-bridge-arcs>
        {visual.hops.map((entry) => {
          if (rubberBandPreviews != null && previewIds.has(entry.connectionId)) {
            return null;
          }
          const conn = byConn.get(entry.connectionId);
          if (!conn) return null;
          const stroke = resolveConnectionStrokeVisual(conn.relationType);
          const selected = selectedConnectionId === conn.id;
          return (
            <g key={entry.key}>
              {selected ? (
                <path
                  className="rd-no-print"
                  data-rd-connection-halo
                  data-rd-bridge-halo
                  d={hopArcPathD(entry.hop)}
                  stroke={CONNECTION_HALO_STROKE}
                  strokeOpacity={CONNECTION_HALO_OPACITY}
                  strokeWidth={connectionHaloStrokeWidth(stroke.strokeWidthPx)}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  pointerEvents="none"
                />
              ) : null}
              <path
                data-rd-bridge-arc
                data-rd-bridge-owner={entry.connectionId}
                d={hopArcPathD(entry.hop)}
                stroke={stroke.stroke}
                strokeWidth={stroke.strokeWidthPx}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
              {onConnectionPointerDown &&
              connectionPermissions(conn).selectable ? (
                <path
                  className="rd-no-print"
                  data-rd-connection-hit={conn.id}
                  data-rd-bridge-hit
                  d={hopArcPathD(entry.hop)}
                  stroke="transparent"
                  strokeWidth={CONNECTION_HIT_STROKE_PX}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  pointerEvents="stroke"
                  style={{ touchAction: "none" }}
                  onPointerDown={onConnectionPointerDown}
                />
              ) : null}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
