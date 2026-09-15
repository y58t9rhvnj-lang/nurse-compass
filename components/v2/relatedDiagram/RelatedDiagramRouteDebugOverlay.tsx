"use client";

/**
 * DEV-only routing overlay. Never shown in student production UI.
 * Enable with ?rdDebug=1 on the Slice 1/2A DEV page.
 */

import { getA3LegendBounds } from "@/lib/v2/relatedDiagram/a3Legend";
import { collidingCards, cardLayoutRect } from "@/lib/v2/relatedDiagram/cardCollision";
import {
  collectUnsafeBridgeJumperIds,
  endpointCorridorRect,
  estimatedArrowMarkerTip,
  expandedLegendRect,
  inferEdgeFromPin,
  legendIntersectionSegments,
  selfCardPenetrationSegments,
  sourceExitCorridor,
  targetEntryCorridor,
} from "@/lib/v2/relatedDiagram/geometryGuard";
import {
  stableRoutesList,
  type StableRouteState,
} from "@/lib/v2/relatedDiagram/incrementalRoutes";
import {
  edgeMidpoint,
  planOrthogonalRoutes,
} from "@/lib/v2/relatedDiagram/orthogonalRouting";
import {
  ROUTE_SOFT_CLEARANCE,
  sameGroupIds,
  scoreCongestedRoute,
} from "@/lib/v2/relatedDiagram/routeCongestion";
import {
  evaluateRouteQuality,
  formatQualityDebug,
  toQualityTrace,
} from "@/lib/v2/relatedDiagram/routeQuality";
import {
  CARD_ROUTE_CLEARANCE,
  cardObstacle,
  debugKeepOuts,
  obstacleViolationSegments,
} from "@/lib/v2/relatedDiagram/routeHardening";
import type { RelatedDiagramRouteTopology } from "@/lib/v2/relatedDiagram/routeTopology";
import type {
  RelatedDiagramCard,
  RelatedDiagramConnection,
} from "@/lib/v2/relatedDiagram/types";

type DebugRoute = {
  connectionId: string;
  sourceCardId: string;
  targetCardId: string;
  sourceEdge: "top" | "right" | "bottom" | "left";
  targetEdge: "top" | "right" | "bottom" | "left";
  points: { x: number; y: number }[];
  reasons?: string[];
};

/**
 * StableRouteState keeps geometry in byId even when invalidReasons has
 * the same connectionId. Concatenating those lists is a debug-view overlap,
 * not a second byId entry.
 */
function partitionDebugRoutes(
  routes: DebugRoute[],
  invalidRoutes: DebugRoute[],
): { valid: DebugRoute[]; invalid: DebugRoute[] } {
  const invalidIds = new Set(invalidRoutes.map((r) => r.connectionId));
  return {
    valid: routes.filter((r) => !invalidIds.has(r.connectionId)),
    invalid: invalidRoutes,
  };
}

function debugRouteKey(
  kind: "valid" | "invalid",
  connectionId: string,
  occurrence: number,
): string {
  const prefix = kind === "valid" ? "dbg-valid" : "dbg-invalid";
  return occurrence > 0
    ? `${prefix}-${connectionId}-${occurrence}`
    : `${prefix}-${connectionId}`;
}

function renderRouteDebugGroup(input: {
  route: DebugRoute;
  kind: "valid" | "invalid";
  occurrence: number;
  byId: Map<string, RelatedDiagramCard>;
  obstacles: ReturnType<typeof cardObstacle>[];
  cluster: ReturnType<typeof collectUnsafeBridgeJumperIds>;
  routeCost: boolean;
  allRoutes: DebugRoute[];
  bridges: { x: number; y: number }[];
  routeTopology?: RelatedDiagramRouteTopology;
  qualityLabel?: string;
}) {
  const { route, kind, occurrence, byId } = input;
  const source = byId.get(route.sourceCardId);
  const target = byId.get(route.targetCardId);
  if (!source || !target) return null;
  const sourcePin = edgeMidpoint(source.layout, route.sourceEdge);
  const targetPin = edgeMidpoint(target.layout, route.targetEdge);
  const start = route.points[0];
  const end = route.points[route.points.length - 1];
  const sourceMismatch =
    !start ||
    Math.abs(start.x - sourcePin.x) > 0.2 ||
    Math.abs(start.y - sourcePin.y) > 0.2;
  const targetMismatch =
    !end ||
    Math.abs(end.x - targetPin.x) > 0.2 ||
    Math.abs(end.y - targetPin.y) > 0.2;
  const hits = obstacleViolationSegments(route.points, input.obstacles, new Set(), 0);
  const sourceEdge =
    route.sourceEdge ?? inferEdgeFromPin(source.layout, sourcePin);
  const targetEdge =
    route.targetEdge ?? inferEdgeFromPin(target.layout, targetPin);
  const sourceCorridor = sourceExitCorridor(source.id, sourcePin, sourceEdge);
  const targetCorridor = targetEntryCorridor(target.id, targetPin, targetEdge);
  const sourceCorridorBox = endpointCorridorRect(sourceCorridor);
  const targetCorridorBox = endpointCorridorRect(targetCorridor);
  const selfHits = selfCardPenetrationSegments(
    route.points,
    source.layout,
    target.layout,
    sourceCorridor,
    targetCorridor,
  );
  const legendHits = legendIntersectionSegments(route.points);
  const prev = route.points[route.points.length - 2];
  const tip = end && prev ? estimatedArrowMarkerTip(end, prev) : end;
  const clusterInvalid = input.cluster.jumperIds.has(route.connectionId);
  const invalid = route.reasons ?? [];
  const intraDup = occurrence > 0;
  return (
    <g
      key={debugRouteKey(kind, route.connectionId, occurrence)}
      data-rd-debug-route={route.connectionId}
      data-rd-debug-kind={kind}
      data-rd-debug-dup={intraDup ? "1" : undefined}
    >
      <rect
        x={source.layout.x}
        y={source.layout.y}
        width={source.layout.width}
        height={source.layout.height}
        fill="rgba(88, 86, 214, 0.06)"
        stroke="#5856D6"
        strokeWidth={1}
        data-rd-debug="source-card-solid"
      />
      <rect
        x={target.layout.x}
        y={target.layout.y}
        width={target.layout.width}
        height={target.layout.height}
        fill="rgba(88, 86, 214, 0.06)"
        stroke="#5856D6"
        strokeWidth={1}
        data-rd-debug="target-card-solid"
      />
      <rect
        x={sourceCorridorBox.x}
        y={sourceCorridorBox.y}
        width={sourceCorridorBox.width}
        height={sourceCorridorBox.height}
        fill="rgba(52, 199, 89, 0.16)"
        stroke="#34C759"
        strokeWidth={1}
        data-rd-debug="endpoint-corridor"
      />
      <rect
        x={targetCorridorBox.x}
        y={targetCorridorBox.y}
        width={targetCorridorBox.width}
        height={targetCorridorBox.height}
        fill="rgba(52, 199, 89, 0.16)"
        stroke="#34C759"
        strokeWidth={1}
        data-rd-debug="endpoint-corridor"
      />
      <circle
        cx={sourcePin.x}
        cy={sourcePin.y}
        r={3}
        fill="none"
        stroke="#1D1D1F"
        data-rd-debug="live-source-pin"
      />
      <circle
        cx={targetPin.x}
        cy={targetPin.y}
        r={3}
        fill="none"
        stroke="#1D1D1F"
        data-rd-debug="arrow-target-pin"
      />
      {tip ? (
        <circle
          cx={tip.x}
          cy={tip.y}
          r={2.5}
          fill="#FF9500"
          data-rd-debug="marker-tip"
        />
      ) : null}
      {start ? (
        <circle
          cx={start.x}
          cy={start.y}
          r={2}
          fill={sourceMismatch ? "#FF3B30" : "#1D1D1F"}
          data-rd-debug="route-start"
        />
      ) : null}
      {end ? (
        <circle
          cx={end.x}
          cy={end.y}
          r={2}
          fill={targetMismatch ? "#FF3B30" : "#1D1D1F"}
          data-rd-debug="route-end"
        />
      ) : null}
      {hits.map((seg, i) => (
        <line
          key={`hit-${i}`}
          x1={seg.a.x}
          y1={seg.a.y}
          x2={seg.b.x}
          y2={seg.b.y}
          stroke="#FF3B30"
          strokeWidth={2}
          data-rd-debug="obstacle-violation"
        />
      ))}
      {selfHits.map((seg, i) => (
        <line
          key={`self-${i}`}
          x1={seg.a.x}
          y1={seg.a.y}
          x2={seg.b.x}
          y2={seg.b.y}
          stroke="#AF52DE"
          strokeWidth={2.5}
          data-rd-debug="self-card-penetration"
        />
      ))}
      {legendHits.map((seg, i) => (
        <line
          key={`lg-${i}`}
          x1={seg.a.x}
          y1={seg.a.y}
          x2={seg.b.x}
          y2={seg.b.y}
          stroke="#FF9500"
          strokeWidth={2}
          data-rd-debug="legend-intersection"
        />
      ))}
      {clusterInvalid ? (
        <circle
          cx={(sourcePin.x + targetPin.x) / 2}
          cy={(sourcePin.y + targetPin.y) / 2}
          r={6}
          fill="none"
          stroke="#FF3B30"
          strokeDasharray="2 2"
          data-rd-debug="bridge-cluster-invalid"
        />
      ) : null}
      {invalid.length > 0 ? (
        <text
          x={sourcePin.x + 6}
          y={sourcePin.y - 6}
          fill="#FF3B30"
          fontSize={9}
          data-rd-debug="invalid-reason"
        >
          {invalid.join(",")}
        </text>
      ) : null}
      {intraDup ? (
        <text
          x={sourcePin.x + 6}
          y={sourcePin.y + 8}
          fill="#FF3B30"
          fontSize={9}
          data-rd-debug="duplicate-id"
        >
          dup {kind} {route.connectionId}
        </text>
      ) : null}
      {input.qualityLabel ? (
        <text
          x={sourcePin.x + 6}
          y={sourcePin.y + 20}
          fill="#007AFF"
          fontSize={7}
          data-rd-debug="route-quality"
        >
          {input.qualityLabel}
        </text>
      ) : null}
      {input.routeCost ? (
        <text
          x={sourcePin.x + 6}
          y={sourcePin.y + 12}
          fill="#007AFF"
          fontSize={8}
          data-rd-debug="route-cost"
        >
          {(() => {
            const scored = scoreCongestedRoute(route.points, {
              routes: input.allRoutes.map((r) => ({
                connectionId: r.connectionId,
                points: r.points,
              })),
              exemptIds: sameGroupIds(
                input.routeTopology?.routeGroups,
                route.connectionId,
              ),
              bridges: input.bridges,
              junctions: (input.routeTopology?.branchPoints ?? []).map((b) => ({
                x: b.x,
                y: b.y,
              })),
            });
            return `x${scored.crossings} c${Math.round(scored.score)} gap${ROUTE_SOFT_CLEARANCE}${
              scored.infeasible ? " badHop" : ""
            }`;
          })()}
        </text>
      ) : null}
    </g>
  );
}

function qualityDebugLabel(
  route: DebugRoute,
  stableRouteState: StableRouteState | undefined,
  plan: { routes: DebugRoute[]; bridges: { x: number; y: number }[] },
  routeTopology?: RelatedDiagramRouteTopology,
): string | undefined {
  const stored = stableRouteState?.qualityTrace?.[route.connectionId];
  if (stored) return formatQualityDebug(stored);
  if (!route.reasons?.length) return undefined;
  const report = evaluateRouteQuality({
    points: route.points,
    sourcePin: route.points[0] ?? { x: 0, y: 0 },
    targetPin: route.points[route.points.length - 1] ?? { x: 0, y: 0 },
    congestion: {
      routes: plan.routes.map((r) => ({
        connectionId: r.connectionId,
        points: r.points,
      })),
      exemptIds: sameGroupIds(routeTopology?.routeGroups, route.connectionId),
      bridges: plan.bridges,
      junctions: (routeTopology?.branchPoints ?? []).map((b) => ({
        x: b.x,
        y: b.y,
      })),
    },
    hardReasons: route.reasons,
  });
  return formatQualityDebug(
    toQualityTrace(route.connectionId, report, {
      fallbackReason: route.reasons[0],
      lastValidUsed: false,
      bpRelocated: false,
    }),
  );
}

function withOccurrences<T extends { connectionId: string }>(
  routes: T[],
): Array<{ route: T; occurrence: number }> {
  const seen = new Map<string, number>();
  return routes.map((route) => {
    const n = seen.get(route.connectionId) ?? 0;
    seen.set(route.connectionId, n + 1);
    return { route, occurrence: n };
  });
}

export default function RelatedDiagramRouteDebugOverlay({
  cards,
  connections,
  width,
  height,
  routeTopology,
  stableRouteState,
  routeCost = false,
}: {
  cards: RelatedDiagramCard[];
  connections: RelatedDiagramConnection[];
  width: number;
  height: number;
  routeTopology?: RelatedDiagramRouteTopology;
  stableRouteState?: StableRouteState;
  routeCost?: boolean;
}) {
  const keepOuts = debugKeepOuts(cards, CARD_ROUTE_CLEARANCE);
  const plan = stableRouteState
    ? {
        routes: stableRoutesList(stableRouteState),
        bridges: stableRouteState.bridges,
        junctions: routeTopology
          ? routeTopology.branchPoints.map((bp) => ({
              kind: "branchPoint" as const,
              x: bp.x,
              y: bp.y,
              connectionIds: [bp.connectionIds[0] ?? "", bp.connectionIds[1] ?? ""],
            }))
          : [],
        invalidRoutes: Object.entries(stableRouteState.invalidReasons).map(
          ([connectionId, reasons]) => {
            const route = stableRouteState.byId[connectionId];
            return {
              connectionId,
              sourceCardId: route?.sourceCardId ?? "",
              targetCardId: route?.targetCardId ?? "",
              sourceEdge: route?.sourceEdge ?? "right",
              targetEdge: route?.targetEdge ?? "left",
              points: route?.points ?? [],
              reasons,
            };
          },
        ),
      }
    : planOrthogonalRoutes(cards, connections, {
        canvas: { x: 0, y: 0, width, height },
        extraObstacles: [getA3LegendBounds(width, height)],
        topology: routeTopology,
      });
  const overlapCards = cards.filter((card) =>
    collidingCards(
      cardLayoutRect(card),
      cards.filter((c) => c.id !== card.id).map(cardLayoutRect),
      0,
    ).length > 0,
  );
  const byId = new Map(cards.map((c) => [c.id, c]));
  const obstacles = cards.map(cardObstacle);
  const legendExpanded = expandedLegendRect(getA3LegendBounds(width, height));
  const cluster = collectUnsafeBridgeJumperIds({
    bridges: plan.bridges,
    routes: Object.fromEntries(
      [...plan.routes, ...plan.invalidRoutes].map((r) => [r.connectionId, r]),
    ),
    junctions: (routeTopology?.branchPoints ?? []).map((bp) => ({
      x: bp.x,
      y: bp.y,
    })),
    changedIds: new Set(
      [...plan.routes, ...plan.invalidRoutes].map((r) => r.connectionId),
    ),
  });
  const { valid: validRoutes, invalid: invalidRoutes } = partitionDebugRoutes(
    plan.routes,
    plan.invalidRoutes,
  );
  const validDebugRoutes = withOccurrences(validRoutes);
  const invalidDebugRoutes = withOccurrences(invalidRoutes);

  return (
    <svg
      className="pointer-events-none absolute inset-0"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
      data-rd-route-debug
    >
      {overlapCards.map((card) => (
        <rect
          key={`ov-${card.id}`}
          x={card.layout.x}
          y={card.layout.y}
          width={card.layout.width}
          height={card.layout.height}
          fill="rgba(255,59,48,0.12)"
          stroke="#FF3B30"
          strokeWidth={1}
          data-rd-debug="card-overlap"
        />
      ))}
      {keepOuts.map((box) => (
        <rect
          key={`ko-${box.id}`}
          x={box.x}
          y={box.y}
          width={box.width}
          height={box.height}
          fill="none"
          stroke="#AEAEB2"
          strokeDasharray="3 3"
          strokeWidth={1}
          data-rd-debug="keep-out"
        />
      ))}
      <rect
        x={legendExpanded.x}
        y={legendExpanded.y}
        width={legendExpanded.width}
        height={legendExpanded.height}
        fill="rgba(255, 149, 0, 0.08)"
        stroke="#FF9500"
        strokeWidth={1}
        data-rd-debug="legend-obstacle"
      />
      {(routeTopology?.branchPoints ?? []).map((bp) => (
        <circle
          key={`bp-${bp.id}`}
          cx={bp.x}
          cy={bp.y}
          r={4}
          fill="none"
          stroke="#6E6E73"
          strokeWidth={1.5}
          data-rd-debug="branch-point"
        />
      ))}
      {plan.junctions.map((j, i) => (
        <rect
          key={`jn-${i}`}
          x={j.x - 3}
          y={j.y - 3}
          width={6}
          height={6}
          fill="none"
          stroke="#1D1D1F"
          strokeWidth={1}
          data-rd-debug="junction"
        />
      ))}
      {plan.bridges.map((br, i) => (
        <g key={`br-${i}`} data-rd-debug="bridge-safe-zone">
          <line
            x1={br.x - 3}
            y1={br.y}
            x2={br.x + 3}
            y2={br.y}
            stroke="#C7C7CC"
            strokeWidth={1}
          />
          <line
            x1={br.x}
            y1={br.y - 3}
            x2={br.x}
            y2={br.y + 3}
            stroke="#C7C7CC"
            strokeWidth={1}
          />
        </g>
      ))}
      {validDebugRoutes.map(({ route, occurrence }) =>
        renderRouteDebugGroup({
          route,
          kind: "valid",
          occurrence,
          byId,
          obstacles,
          cluster,
          routeCost,
          allRoutes: plan.routes,
          bridges: plan.bridges.map((b) => ({ x: b.x, y: b.y })),
          routeTopology,
          qualityLabel: qualityDebugLabel(route, stableRouteState, plan, routeTopology),
        }),
      )}
      {invalidDebugRoutes.map(({ route, occurrence }) =>
        renderRouteDebugGroup({
          route,
          kind: "invalid",
          occurrence,
          byId,
          obstacles,
          cluster,
          routeCost,
          allRoutes: plan.routes,
          bridges: plan.bridges.map((b) => ({ x: b.x, y: b.y })),
          routeTopology,
          qualityLabel: qualityDebugLabel(route, stableRouteState, plan, routeTopology),
        }),
      )}
      {validRoutes.flatMap((route) =>
        route.points.map((p, i) => (
          <circle
            key={`dbg-valid-${route.connectionId}-v-${i}`}
            cx={p.x}
            cy={p.y}
            r={2}
            fill="#1D1D1F"
            data-rd-debug="vertex"
          />
        )),
      )}
      {invalidRoutes.flatMap((route) =>
        route.points.map((p, i) => (
          <circle
            key={`dbg-invalid-${route.connectionId}-v-${i}`}
            cx={p.x}
            cy={p.y}
            r={2}
            fill="#FF3B30"
            data-rd-debug="vertex-invalid"
          />
        )),
      )}
    </svg>
  );
}
