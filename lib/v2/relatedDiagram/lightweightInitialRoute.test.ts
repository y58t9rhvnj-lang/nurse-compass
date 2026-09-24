/**
 * Lightweight initial AUTO seed (LIS).
 * Run: ./node_modules/.bin/jiti lib/v2/relatedDiagram/lightweightInitialRoute.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { buildPatientAStudentReconstruction } from "./buildPatientAStudentReconstruction";
import {
  ROUTE_EDITING_DEMO_CONNECTION_IDS,
  ROUTE_EDITING_DEMO_EXISTING_BEND_POINTS,
  buildRouteEditingDemoPatient,
} from "./buildRouteEditingDemoPatient";
import { analyzeRouteReadability } from "./diagramLayoutL2b";
import {
  firstSegmentFacesEdge,
  lastSegmentFacesEdge,
} from "./geometryGuard";
import {
  seedInitialAutoRouteState,
  seedStableRouteState,
} from "./incrementalRoutes";
import {
  LIGHTWEIGHT_INITIAL_CANDIDATE_LIMIT,
  generateLightweightInitialCandidates,
  pickLightweightAutoRoute,
  planLightweightInitialRoutes,
} from "./lightweightInitialRoute";
import {
  analyzeRouteMeetings,
  isOrthogonalPolyline,
  type EdgeSide,
  type Point,
} from "./orthogonalRouting";
import { applyPatientACardSizeScale } from "./patientACardSizeExperiment";
import { buildPatientAJunctionReconstruction } from "./patientAMergeJunctionTopology";
import { emptyRouteTopology, isStudentManualRoute } from "./routeTopology";
import type {
  RelatedDiagramCard,
  RelatedDiagramConnection,
} from "./types";

const DEMO_AUTO_TANGENT_FIX_IDS = [
  "red_c_i_demo_u_pna",
  "red_c_i_fatigue_u_low_act",
  "red_c_u_low_act_u_adl",
  "red_c_u_adl_np",
  "red_c_u_low_act_np",
  "red_c_i_night_u_sleep",
  "red_c_u_sleep_u_tired",
] as const;

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`ok - ${name}`);
  } catch (e) {
    console.error(`FAIL - ${name}`);
    throw e;
  }
}

function src(rel: string): string {
  return readFileSync(new URL(rel, import.meta.url), "utf8");
}

function card(
  id: string,
  x: number,
  y: number,
): RelatedDiagramCard {
  return {
    id,
    cardType: "understanding",
    text: id,
    state: "current",
    origin: "direct_insight",
    layout: { x, y, width: 160, height: 72, zIndex: 1 },
    isLocked: false,
    createdAt: "2026-09-22T00:00:00.000Z",
    updatedAt: "2026-09-22T00:00:00.000Z",
  };
}

function conn(
  id: string,
  sourceCardId: string,
  targetCardId: string,
): RelatedDiagramConnection {
  return {
    id,
    sourceCardId,
    targetCardId,
    relationType: "current",
    origin: "student_diagram",
    createdAt: "2026-09-22T00:00:00.000Z",
    updatedAt: "2026-09-22T00:00:00.000Z",
  };
}

const JOG = [
  { x: 240, y: 236 },
  { x: 360, y: 236 },
  { x: 360, y: 140 },
  { x: 520, y: 140 },
  { x: 520, y: 236 },
];

const reconstruction = buildPatientAStudentReconstruction();
const graph = applyPatientACardSizeScale(reconstruction.graph, 100);
const t0 = performance.now();
const lightPlan = planLightweightInitialRoutes(graph.cards, graph.connections);
const lightState = seedInitialAutoRouteState(graph.cards, graph.connections);
const lightMs = performance.now() - t0;
const t1 = performance.now();
seedInitialAutoRouteState(graph.cards, graph.connections);
const lightRepeatMs = performance.now() - t1;
const lightRead = analyzeRouteReadability({
  cards: graph.cards,
  connections: graph.connections,
  routeState: lightState,
});
const lightMeet = analyzeRouteMeetings(
  Object.values(lightState.byId),
  graph.cards,
);

const routePointCount = Object.values(lightState.byId).reduce(
  (sum, route) => sum + route.points.length,
  0,
);
const maxRoutePoints = Math.max(
  ...Object.values(lightState.byId).map((route) => route.points.length),
);
const avgCandidates =
  lightPlan.stats.autoConnectionCount === 0
    ? 0
    : lightPlan.stats.candidateCount / lightPlan.stats.autoConnectionCount;

test("LIS-A Patient A seed is fast", () => {
  assert.equal(graph.cards.length, 71);
  assert.equal(graph.connections.length, 64);
  assert.ok(lightMs <= 500, `seed ${lightMs}ms`);
  console.log(
    JSON.stringify({
      seedMs: +lightMs.toFixed(1),
      seedRepeatMs: +lightRepeatMs.toFixed(1),
      candidateCount: lightPlan.stats.candidateCount,
      candidatePerConn: +avgCandidates.toFixed(2),
      classifyCalls: lightPlan.stats.classifyCalls,
    }),
  );
});

test("LIS-B candidate cap", () => {
  assert.ok(avgCandidates <= 6);
  assert.ok(
    generateLightweightInitialCandidates(
      { x: 0, y: 0 },
      { x: 100, y: 80 },
      "right",
      "left",
    ).length <= LIGHTWEIGHT_INITIAL_CANDIDATE_LIMIT,
  );
  assert.equal(lightPlan.stats.qualityPlannerCalls, 0);
  assert.equal(lightPlan.stats.pathfinderCalls, 0);
  assert.equal(lightPlan.stats.priorCrossingChecks, 0);
  assert.equal(
    lightPlan.stats.legalFacingAdoptedCount +
      lightPlan.stats.edgeTangentFallbackCount,
    lightPlan.stats.autoConnectionCount,
  );
});

test("LIS-C 64/64 connections exist and are finite orthogonal", () => {
  assert.equal(Object.keys(lightState.byId).length, 64);
  for (const connection of graph.connections) {
    const route = lightState.byId[connection.id];
    assert.ok(route, connection.id);
    assert.ok(route.points.length >= 2, connection.id);
    assert.equal(isOrthogonalPolyline(route.points), true, connection.id);
    for (const point of route.points) {
      assert.equal(Number.isFinite(point.x), true, connection.id);
      assert.equal(Number.isFinite(point.y), true, connection.id);
    }
    const first = route.points[0]!;
    const last = route.points[route.points.length - 1]!;
    assert.equal(first.x, route.sourcePin.x);
    assert.equal(first.y, route.sourcePin.y);
    assert.equal(last.x, route.targetPin.x);
    assert.equal(last.y, route.targetPin.y);
    for (let i = 1; i < route.points.length; i += 1) {
      const prev = route.points[i - 1]!;
      const cur = route.points[i]!;
      assert.ok(
        Math.abs(prev.x - cur.x) > 0.05 || Math.abs(prev.y - cur.y) > 0.05,
        connection.id,
      );
    }
  }
});

test("LIS-D deterministic SSR/hydrate twin seed", () => {
  const again = seedInitialAutoRouteState(graph.cards, graph.connections);
  assert.deepEqual(again, lightState);
  const moduleSrc = src("./lightweightInitialRoute.ts");
  assert.equal(moduleSrc.includes("Math.random"), false);
  assert.equal(moduleSrc.includes("getBoundingClientRect"), false);
  assert.equal(moduleSrc.includes("document"), false);
});

test("LIS-E MANUAL authored geometry is not overwritten", () => {
  const cards = [card("a", 80, 200), card("b", 520, 200)];
  const connections = [conn("cn_ab", "a", "b")];
  const topology = emptyRouteTopology();
  topology.routes.push({
    connectionId: "cn_ab",
    sourceEdge: "right",
    targetEdge: "left",
    points: JOG.map((point) => ({ ...point })),
  });
  const seeded = seedInitialAutoRouteState(cards, connections, topology);
  assert.deepEqual(seeded.byId.cn_ab!.points, JOG);
});

test("LIS-F Junction authored topology is not overwritten", () => {
  const junction = buildPatientAJunctionReconstruction(90);
  const seeded = seedInitialAutoRouteState(
    junction.graph.cards,
    junction.graph.connections,
    junction.topology,
  );
  for (const route of junction.topology.routes) {
    assert.deepEqual(seeded.byId[route.connectionId]!.points, route.points);
  }
});

test("LIS-G Patient A wiring uses initial AUTO seed only", () => {
  const ws = src(
    "../../../components/v2/relatedDiagram/RelatedDiagramPatientADevWorkspace.tsx",
  );
  const light = src("./lightweightInitialRoute.ts");
  const incr = src("./incrementalRoutes.ts");
  assert.ok(ws.includes("seedInitialAutoRouteState"));
  assert.equal(/\bseedStableRouteState\b/.test(ws), false);
  assert.ok(incr.includes("planOrthogonalRoutes"));
  assert.ok(incr.includes("planLightweightInitialRoutes"));
  assert.equal(light.includes("selectBestOrthogonalRoute"), false);
  assert.equal(light.includes("generateOrthogonalCandidates"), false);
  assert.equal(light.includes("countRouteCrossings"), false);
  assert.equal(light.includes("validateRouteGate"), false);
  assert.equal(light.includes("findRectilinearPath"), false);
  assert.ok(light.includes("hvPath(sourcePin, targetPin)"));
  assert.ok(light.includes("vhPath(sourcePin, targetPin)"));
  assert.ok(light.includes("classifyRouteInteractions"));
  assert.ok(light.includes("pickLightweightAutoRoute"));
  assert.ok(light.includes("pickLightweightInitialSeedRoute"));
});

test("LIS-H geometry metrics for report", () => {
  const quality = seedStableRouteState(graph.cards, graph.connections);
  const qualityRead = analyzeRouteReadability({
    cards: graph.cards,
    connections: graph.connections,
    routeState: quality,
  });
  const qualityMeet = analyzeRouteMeetings(
    Object.values(quality.byId),
    graph.cards,
  );
  const qualityPoints = Object.values(quality.byId).reduce(
    (sum, route) => sum + route.points.length,
    0,
  );
  const qualityMax = Math.max(
    ...Object.values(quality.byId).map((route) => route.points.length),
  );
  console.log(
    JSON.stringify(
      {
        before: {
          seedTotalMs: "3814-5219",
          candidateCount: 25043,
          candidatePerConn: 391.3,
          crossingChecks: 25043,
          accepted: 37,
          invalid: 27,
          cardThrough: qualityRead.connections.reduce(
            (sum, row) => sum + row.cardIntersectionCount,
            0,
          ),
          crossings: qualityMeet.independentCrossingCount,
          bridges: quality.bridges.length,
          routePointCount: qualityPoints,
          maxRoutePoints: qualityMax,
        },
        after: {
          seedTotalMs: +lightMs.toFixed(1),
          candidateCount: lightPlan.stats.candidateCount,
          candidatePerConn: +avgCandidates.toFixed(2),
          crossingChecks: 0,
          accepted: lightPlan.routes.length - lightPlan.invalidRoutes.length,
          invalid: lightPlan.invalidRoutes.length,
          legalFacingAdopted: lightPlan.stats.legalFacingAdoptedCount,
          edgeTangentFallback: lightPlan.stats.edgeTangentFallbackCount,
          cardThrough: lightRead.connections.reduce(
            (sum, row) => sum + row.cardIntersectionCount,
            0,
          ),
          crossings: lightMeet.independentCrossingCount,
          bridges: lightState.bridges.length,
          routePointCount,
          maxRoutePoints,
        },
      },
      null,
      2,
    ),
  );
});

function expectedAxis(edge: EdgeSide): "horizontal" | "vertical" {
  return edge === "left" || edge === "right" ? "horizontal" : "vertical";
}

function segmentOrientation(
  a: Point,
  b: Point,
): "horizontal" | "vertical" | "other" {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  if (dx <= 0.51 && dy > 0.51) return "vertical";
  if (dy <= 0.51 && dx > 0.51) return "horizontal";
  return "other";
}

function assertEdgeTangent(
  connectionId: string,
  points: Point[],
  sourceEdge: EdgeSide,
  targetEdge: EdgeSide,
) {
  assert.ok(points.length >= 2, connectionId);
  const first = segmentOrientation(points[0]!, points[1]!);
  const last = segmentOrientation(
    points[points.length - 2]!,
    points[points.length - 1]!,
  );
  assert.equal(first, expectedAxis(sourceEdge), `${connectionId} source axis`);
  assert.equal(last, expectedAxis(targetEdge), `${connectionId} target axis`);
  assert.equal(
    firstSegmentFacesEdge(points, sourceEdge),
    true,
    `${connectionId} source faces`,
  );
  assert.equal(
    lastSegmentFacesEdge(points, targetEdge),
    true,
    `${connectionId} target faces`,
  );
}

const demo = buildRouteEditingDemoPatient();
const demoPlan = planLightweightInitialRoutes(
  demo.graph.cards,
  demo.graph.connections,
  demo.topology,
);
const demoSeeded = seedInitialAutoRouteState(
  demo.graph.cards,
  demo.graph.connections,
  demo.topology,
);

test("LIS-I Demo AUTO 14 source/target edge-tangent", () => {
  const auto = demo.graph.connections.filter(
    (row) => !isStudentManualRoute(demo.topology, row),
  );
  assert.equal(auto.length, 14);
  for (const connection of auto) {
    const route = demoSeeded.byId[connection.id]!;
    assertEdgeTangent(
      connection.id,
      route.points,
      route.sourceEdge,
      route.targetEdge,
    );
  }
});

test("LIS-J known AUTO 7 adopt legal+faces", () => {
  for (const id of DEMO_AUTO_TANGENT_FIX_IDS) {
    const route = demoSeeded.byId[id]!;
    assert.ok(route, id);
    assertEdgeTangent(id, route.points, route.sourceEdge, route.targetEdge);
  }
  assert.equal(demoPlan.stats.legalFacingAdoptedCount, 12);
  assert.equal(demoPlan.stats.edgeTangentFallbackCount, 2);
});

test("LIS-K authored MANUAL jog is exact", () => {
  const bend = demo.graph.connections.find(
    (row) => row.id === ROUTE_EDITING_DEMO_CONNECTION_IDS.existingBend,
  )!;
  assert.equal(isStudentManualRoute(demo.topology, bend), true);
  assert.deepEqual(
    demoSeeded.byId[bend.id]!.points,
    ROUTE_EDITING_DEMO_EXISTING_BEND_POINTS,
  );
  assert.equal(demoSeeded.byId[bend.id]!.sourceEdge, "right");
  assert.equal(demoSeeded.byId[bend.id]!.targetEdge, "left");
});

test("LIS-L Patient A keeps lightweight fallback when no legal+faces", () => {
  assert.equal(lightPlan.stats.autoConnectionCount, 64);
  assert.ok(lightPlan.stats.legalFacingAdoptedCount >= 1);
  assert.ok(lightPlan.stats.edgeTangentFallbackCount >= 1);
  assert.ok(lightPlan.stats.edgeTangentFallbackCount < 64);
  assert.equal(lightPlan.stats.qualityPlannerCalls, 0);
  assert.equal(lightPlan.stats.pathfinderCalls, 0);
  console.log(
    JSON.stringify({
      patientASeedMs: +lightMs.toFixed(1),
      legalFacingAdopted: lightPlan.stats.legalFacingAdoptedCount,
      edgeTangentFallback: lightPlan.stats.edgeTangentFallbackCount,
      qualityPlannerCalls: lightPlan.stats.qualityPlannerCalls,
      pathfinderCalls: lightPlan.stats.pathfinderCalls,
    }),
  );
});

test("LIS-M shared pick stays first-legal for Card Drop", () => {
  const source = demo.graph.cards.find((row) => row.id === "i_demo")!;
  const target = demo.graph.cards.find((row) => row.id === "u_pna")!;
  const shared = pickLightweightAutoRoute({
    source,
    target,
    cards: demo.graph.cards,
  });
  const seeded = demoSeeded.byId.red_c_i_demo_u_pna!;
  assert.equal(shared.legal, true);
  assert.equal(lastSegmentFacesEdge(shared.points, shared.targetEdge), false);
  assert.equal(lastSegmentFacesEdge(seeded.points, seeded.targetEdge), true);
  assert.equal(
    JSON.stringify(shared.points) === JSON.stringify(seeded.points),
    false,
  );
});

console.log(`\n${passed} passed`);
