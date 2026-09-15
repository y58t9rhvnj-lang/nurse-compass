"use client";

import type {
  RelatedDiagramCard,
  RelatedDiagramConnection,
} from "@/lib/v2/relatedDiagram/types";
import { getA3LegendBounds } from "@/lib/v2/relatedDiagram/a3Legend";
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
import { resolveConnectionStrokeVisual } from "@/lib/v2/relatedDiagram/visualStyle";

export default function RelatedDiagramConnectionLayer({
  cards,
  connections,
  width,
  height,
  routeTopology,
  previewCardId,
  stableRouteState,
}: {
  cards: RelatedDiagramCard[];
  connections: RelatedDiagramConnection[];
  width: number;
  height: number;
  routeTopology?: RelatedDiagramRouteTopology;
  previewCardId?: string | null;
  stableRouteState?: StableRouteState;
}) {
  const legend = getA3LegendBounds(width, height);
  const plan = stableRouteState
    ? {
        routes: stableRoutesList(stableRouteState),
        bridges: stableRouteState.bridges,
      }
    : planOrthogonalRoutes(cards, connections, {
        canvas: { x: 0, y: 0, width, height },
        extraObstacles: [legend],
        topology: routeTopology,
      });
  const previewRoutes =
    previewCardId != null
      ? previewIncidentOrthogonalRoutes(
          cards,
          connections,
          previewCardId,
          routeTopology,
          stableRouteState,
        )
      : [];
  const previewIds = new Set(previewRoutes.map((r) => r.connectionId));
  const routes = previewRoutes.length
    ? overlayPreviewRoutes(plan.routes, previewRoutes)
    : plan.routes;
  const byConn = new Map(connections.map((c) => [c.id, c]));
  const visual = planConnectionBridgeVisual({
    routes,
    bridges: plan.bridges,
    previewIds,
  });
  const sharedHops = visual.hops.map((entry) => entry.hop);
  const hopOwners = new Set(visual.hops.map((entry) => entry.connectionId));

  const renderRoute = (route: (typeof visual.adoptedRoutes)[number]) => {
    const conn = byConn.get(route.connectionId);
    if (!conn) return null;
    const stroke = resolveConnectionStrokeVisual(conn.relationType);
    const markerId = stroke.marker === "arrow-thick" ? "rd-arrow-thick" : "rd-arrow";
    const isPreview = previewIds.has(conn.id);
    const d =
      sharedHops.length > 0
        ? buildOrthogonalSpineDFromHops(route.points, sharedHops)
        : buildOrthogonalSpineD(route.points, [], BRIDGE_RADIUS_PX);
    return (
      <g
        key={conn.id}
        data-rd-connection={conn.id}
        data-rd-route={isPreview ? "preview" : "orthogonal"}
        data-rd-bridge={hopOwners.has(conn.id) ? "hop" : undefined}
      >
        <path
          d={d}
          stroke={stroke.stroke}
          strokeWidth={stroke.strokeWidthPx}
          strokeDasharray={stroke.dasharray ?? undefined}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          markerEnd={`url(#${markerId})`}
        />
      </g>
    );
  };

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
          id="rd-arrow"
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
          id="rd-arrow-thick"
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
      {visual.adoptedRoutes.map((route) => renderRoute(route))}
      <g data-rd-bridge-arcs>
        {visual.hops.map((entry) => {
          const conn = byConn.get(entry.connectionId);
          if (!conn) return null;
          const stroke = resolveConnectionStrokeVisual(conn.relationType);
          return (
            <path
              key={entry.key}
              data-rd-bridge-arc
              data-rd-bridge-owner={entry.connectionId}
              d={hopArcPathD(entry.hop)}
              stroke={stroke.stroke}
              strokeWidth={stroke.strokeWidthPx}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          );
        })}
      </g>
    </svg>
  );
}
