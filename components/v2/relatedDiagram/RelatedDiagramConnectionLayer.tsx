"use client";

import type {
  RelatedDiagramCard,
  RelatedDiagramConnection,
} from "@/lib/v2/relatedDiagram/types";
import { getA3LegendBounds } from "@/lib/v2/relatedDiagram/a3Legend";
import {
  BRIDGE_RADIUS_PX,
  buildOrthogonalHopArcs,
  buildOrthogonalSpineD,
  dedupeBridgesForVisual,
  planOrthogonalRoutes,
  polylineCarriesBridge,
} from "@/lib/v2/relatedDiagram/orthogonalRouting";
import type { RelatedDiagramRouteTopology } from "@/lib/v2/relatedDiagram/routeTopology";
import { resolveConnectionStrokeVisual } from "@/lib/v2/relatedDiagram/visualStyle";

export default function RelatedDiagramConnectionLayer({
  cards,
  connections,
  width,
  height,
  routeTopology,
}: {
  cards: RelatedDiagramCard[];
  connections: RelatedDiagramConnection[];
  width: number;
  height: number;
  routeTopology?: RelatedDiagramRouteTopology;
}) {
  const legend = getA3LegendBounds(width, height);
  const plan = planOrthogonalRoutes(cards, connections, {
    canvas: { x: 0, y: 0, width, height },
    extraObstacles: [legend],
    topology: routeTopology,
  });
  const byConn = new Map(connections.map((c) => [c.id, c]));
  const visualBridges = dedupeBridgesForVisual(plan.bridges);

  const renderRoute = (route: (typeof plan.routes)[number]) => {
    const conn = byConn.get(route.connectionId);
    if (!conn) return null;
    const visual = resolveConnectionStrokeVisual(conn.relationType);
    const markerId = visual.marker === "arrow-thick" ? "rd-arrow-thick" : "rd-arrow";
    const ownBridges = visualBridges.filter((b) =>
      polylineCarriesBridge(route.points, b),
    );
    const d = buildOrthogonalSpineD(route.points, ownBridges, BRIDGE_RADIUS_PX);
    return (
      <g
        key={conn.id}
        data-rd-connection={conn.id}
        data-rd-route="orthogonal"
        data-rd-bridge={ownBridges.length > 0 ? "hop" : undefined}
      >
        <path
          d={d}
          stroke={visual.stroke}
          strokeWidth={visual.strokeWidthPx}
          strokeDasharray={visual.dasharray ?? undefined}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          markerEnd={`url(#${markerId})`}
        />
        {buildOrthogonalHopArcs(route.points, ownBridges, BRIDGE_RADIUS_PX).map(
          (hop, i) => (
            <path
              key={`${conn.id}-hop-${i}`}
              data-rd-bridge-arc
              d={hop.d}
              stroke={visual.stroke}
              strokeWidth={visual.strokeWidthPx}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ),
        )}
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
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#1D1D1F" />
        </marker>
        <marker
          id="rd-arrow-thick"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="9"
          markerHeight="9"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#1D1D1F" />
        </marker>
      </defs>
      {plan.routes.map((route) => renderRoute(route))}
    </svg>
  );
}
