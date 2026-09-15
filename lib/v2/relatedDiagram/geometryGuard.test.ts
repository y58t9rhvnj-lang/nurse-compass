/**
 * Final Geometry Guard tests.
 * Run: npx tsx lib/v2/relatedDiagram/geometryGuard.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getA3LegendBounds } from "./a3Legend";
import { applyCardPositionToGraph } from "./cardInteractionState";
import {
  applySceneFragmentToGraph,
  captureSceneFragment,
  emptyDiagramHistory,
  pushDiagramHistory,
  redoDiagramHistory,
  undoDiagramHistory,
} from "./diagramHistory";
import {
  ARROW_MARKER_REF_X,
  ENDPOINT_CORRIDOR_WIDTH,
  LEGEND_ROUTE_CLEARANCE,
  MIN_BEND_BRIDGE_DISTANCE,
  MIN_BRIDGE_TO_BRIDGE_DISTANCE,
  MIN_JUNCTION_BRIDGE_DISTANCE,
  endpointCorridorRect,
  estimatedArrowMarkerTip,
  evaluateBridgeFeasibility,
  expandedLegendRect,
  firstSegmentFacesEdge,
  lastSegmentFacesEdge,
  pinsExact,
  polylineHitsExpandedLegend,
  requiredBridgeSpan,
  segmentInEndpointCorridor,
  selfCardPenetrationSegments,
  sourceExitCorridor,
  targetEntryCorridor,
} from "./geometryGuard";
import {
  applyIncrementalCardMove,
  collectAffectedConnectionIds,
  pointsDeepEqual,
  seedStableRouteState,
} from "./incrementalRoutes";
import { canRenderBridgeHop } from "./orthogonalRouting";
import {
  MIN_ARROW_APPROACH,
  MIN_ENDPOINT_STUB,
  cardObstacle,
  validateOrthogonalRoute,
  validateRouteGate,
} from "./routeHardening";
import { resolveDevFixtureReadonlyScene } from "./resolveReadonlyScene";
import type { RelatedDiagramCard } from "./types";

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

function card(
  id: string,
  x: number,
  y: number,
  width = 80,
  height = 40,
): RelatedDiagramCard {
  return {
    id,
    cardType: "information",
    text: id,
    state: null,
    origin: "patient_information",
    layout: { x, y, width, height, zIndex: 1 },
    isLocked: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

const source = card("a", 0, 80);
const target = card("b", 280, 80);
const sourcePin = { x: 80, y: 100 };
const targetPin = { x: 280, y: 100 };
const sourceCorridor = sourceExitCorridor("a", sourcePin, "right");
const targetCorridor = targetEntryCorridor("b", targetPin, "left");

test("source Card interior is not a legal route", () => {
  const wrap = [
    { x: 80, y: 100 },
    { x: 40, y: 100 },
    { x: 40, y: 40 },
    { x: 280, y: 40 },
    { x: 280, y: 100 },
  ];
  const hits = selfCardPenetrationSegments(
    wrap,
    source.layout,
    target.layout,
    sourceCorridor,
    targetCorridor,
  );
  assert.ok(hits.length > 0);
  const rejected = validateOrthogonalRoute({
    points: wrap,
    sourcePin,
    targetPin,
    obstacles: [source, target].map(cardObstacle),
    sourceCardId: "a",
    targetCardId: "b",
    sourceEdge: "right",
    targetEdge: "left",
  });
  assert.equal(rejected.ok, false);
  assert.ok(rejected.reasons.includes("self-card-penetration"));
});

test("target Card interior is not a legal route", () => {
  const wrap = [
    { x: 80, y: 100 },
    { x: 180, y: 100 },
    { x: 180, y: 40 },
    { x: 320, y: 40 },
    { x: 320, y: 100 },
    { x: 280, y: 100 },
  ];
  const hits = selfCardPenetrationSegments(
    wrap,
    source.layout,
    target.layout,
    sourceCorridor,
    targetCorridor,
  );
  assert.ok(hits.length > 0);
});

test("source exit corridor is the only legal source passage", () => {
  const exit = [
    { x: 80, y: 100 },
    { x: 100, y: 100 },
  ];
  assert.equal(segmentInEndpointCorridor(exit[0]!, exit[1]!, sourceCorridor), true);
  const alongFace = [
    { x: 80, y: 100 },
    { x: 80, y: 70 },
  ];
  assert.equal(
    segmentInEndpointCorridor(alongFace[0]!, alongFace[1]!, sourceCorridor),
    false,
  );
  const box = endpointCorridorRect(sourceCorridor);
  assert.ok(box.width >= MIN_ENDPOINT_STUB - 0.2);
  assert.ok(box.height <= ENDPOINT_CORRIDOR_WIDTH + 0.2);
});

test("target entry corridor is the only legal target passage", () => {
  const entry = [
    { x: 256, y: 100 },
    { x: 280, y: 100 },
  ];
  assert.equal(segmentInEndpointCorridor(entry[0]!, entry[1]!, targetCorridor), true);
  const fromBack = [
    { x: 320, y: 100 },
    { x: 280, y: 100 },
  ];
  assert.equal(
    segmentInEndpointCorridor(fromBack[0]!, fromBack[1]!, targetCorridor),
    false,
  );
});

test("first segment must go outward from the source edge", () => {
  assert.equal(
    firstSegmentFacesEdge(
      [
        { x: 80, y: 100 },
        { x: 100, y: 100 },
      ],
      "right",
    ),
    true,
  );
  assert.equal(
    firstSegmentFacesEdge(
      [
        { x: 80, y: 100 },
        { x: 60, y: 100 },
      ],
      "right",
    ),
    false,
  );
});

test("last segment must go inward to the target edge", () => {
  assert.equal(
    lastSegmentFacesEdge(
      [
        { x: 240, y: 100 },
        { x: 280, y: 100 },
      ],
      "left",
    ),
    true,
  );
  assert.equal(
    lastSegmentFacesEdge(
      [
        { x: 320, y: 100 },
        { x: 280, y: 100 },
      ],
      "left",
    ),
    false,
  );
});

test("target and source pins stay exact", () => {
  const legal = [
    { x: 80, y: 100 },
    { x: 180, y: 100 },
    { x: 180, y: 40 },
    { x: 256, y: 40 },
    { x: 256, y: 100 },
    { x: 280, y: 100 },
  ];
  assert.equal(pinsExact(legal, sourcePin, targetPin), true);
  const gate = validateRouteGate({
    points: legal,
    sourcePin,
    targetPin,
    obstacles: [source, target].map(cardObstacle),
    sourceCardId: "a",
    targetCardId: "b",
    sourceEdge: "right",
    targetEdge: "left",
  });
  assert.equal(gate.reasons.includes("source-endpoint-mismatch"), false);
  assert.equal(gate.reasons.includes("target-endpoint-mismatch"), false);
});

test("arrow marker tip coincides with the target pin", () => {
  const prev = { x: 256, y: 100 };
  const tip = estimatedArrowMarkerTip(targetPin, prev);
  assert.deepEqual(tip, targetPin);
  const old = estimatedArrowMarkerTip(targetPin, prev, 9, 10);
  assert.equal(old.x > targetPin.x, true);
  const layer = readFileSync(
    new URL(
      "../../../components/v2/relatedDiagram/RelatedDiagramConnectionLayer.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.ok(layer.includes('refX="10"'));
  assert.ok(layer.includes('markerUnits="userSpaceOnUse"'));
  assert.equal(ARROW_MARKER_REF_X, 10);
});

test("opposite-side move updates corridors with the new edges", () => {
  const scene = resolveDevFixtureReadonlyScene({ includeStyleDemo: true });
  const state = seedStableRouteState(
    scene.graph.cards,
    scene.graph.connections,
    scene.routeTopology,
  );
  const info = scene.graph.cards.find((c) => c.id === "demo_info")!;
  const partner = scene.graph.cards.find((c) => c.id === "demo_u_cur")!;
  const destX = partner.layout.x - info.layout.width - 48;
  const next = applyCardPositionToGraph(scene.graph, "demo_info", destX, partner.layout.y);
  const moved = applyIncrementalCardMove({
    previous: state,
    cards: next.cards,
    connections: next.connections,
    topology: scene.routeTopology,
    movedCardId: "demo_info",
  });
  const route = moved.state.byId.demo_c_cur!;
  const before = state.byId.demo_c_cur!;
  assert.ok(
    route.sourceEdge !== before.sourceEdge || route.targetEdge !== before.targetEdge,
  );
  assert.equal(firstSegmentFacesEdge(route.points, route.sourceEdge), true);
  assert.equal(lastSegmentFacesEdge(route.points, route.targetEdge), true);
  const src = next.cards.find((c) => c.id === route.sourceCardId)!;
  const tgt = next.cards.find((c) => c.id === route.targetCardId)!;
  assert.equal(
    selfCardPenetrationSegments(
      route.points,
      src.layout,
      tgt.layout,
      sourceExitCorridor(src.id, route.sourcePin, route.sourceEdge),
      targetEntryCorridor(tgt.id, route.targetPin, route.targetEdge),
    ).length,
    0,
  );
});

test("Legend intersection is zero against the expanded rect", () => {
  const legend = getA3LegendBounds();
  const through = [
    { x: legend.x - 40, y: legend.y + 20 },
    { x: legend.x + legend.width + 40, y: legend.y + 20 },
  ];
  assert.equal(polylineHitsExpandedLegend(through), true);
  const around = [
    { x: legend.x - 40, y: legend.y - 40 },
    { x: legend.x + legend.width + 40, y: legend.y - 40 },
  ];
  assert.equal(polylineHitsExpandedLegend(around), false);
  const rejected = validateOrthogonalRoute({
    points: [
      { x: 80, y: 100 },
      { x: legend.x - 40, y: 100 },
      { x: legend.x - 40, y: legend.y + 20 },
      { x: legend.x + 20, y: legend.y + 20 },
      { x: 280, y: 100 },
    ],
    sourcePin,
    targetPin,
    obstacles: [source, target].map(cardObstacle),
    sourceCardId: "a",
    targetCardId: "b",
  });
  assert.ok(rejected.reasons.includes("legend-violation"));
});

test("Legend clearance is 12", () => {
  const legend = getA3LegendBounds();
  const expanded = expandedLegendRect(legend);
  assert.equal(LEGEND_ROUTE_CLEARANCE, 12);
  assert.equal(expanded.x, legend.x - 12);
  assert.equal(expanded.y, legend.y - 12);
  assert.equal(expanded.width, legend.width + 24);
  assert.equal(expanded.height, legend.height + 24);
});

test("complex crossing detects a bridge cluster", () => {
  const jumper = [
    { x: 0, y: 40 },
    { x: 200, y: 40 },
  ];
  const clustered = evaluateBridgeFeasibility({
    bridge: { jumperConnectionId: "j", underConnectionId: "u1", x: 80, y: 40 },
    jumperPoints: jumper,
    siblingBridges: [
      { jumperConnectionId: "j", underConnectionId: "u1", x: 80, y: 40 },
      { jumperConnectionId: "j", underConnectionId: "u2", x: 96, y: 40 },
    ],
    junctions: [],
  });
  assert.equal(clustered.ok, false);
  assert.ok(clustered.reasons.includes("bridge-cluster"));
});

test("bridge spacing / density shortage is invalid", () => {
  const short = [
    { x: 0, y: 10 },
    { x: 50, y: 10 },
  ];
  const dense = evaluateBridgeFeasibility({
    bridge: { jumperConnectionId: "j", underConnectionId: "u1", x: 20, y: 10 },
    jumperPoints: short,
    siblingBridges: [
      { jumperConnectionId: "j", underConnectionId: "u1", x: 20, y: 10 },
      { jumperConnectionId: "j", underConnectionId: "u2", x: 36, y: 10 },
    ],
    junctions: [],
  });
  assert.equal(dense.ok, false);
  assert.ok(
    dense.reasons.includes("bridge-density") ||
      dense.reasons.includes("unrenderable-bridge") ||
      dense.reasons.includes("bridge-cluster"),
  );
  assert.ok(requiredBridgeSpan(2) > MIN_BRIDGE_TO_BRIDGE_DISTANCE);
});

test("Junction-adjacent Independent Crossing is forbidden", () => {
  const jumper = [
    { x: 0, y: 40 },
    { x: 200, y: 40 },
  ];
  const near = evaluateBridgeFeasibility({
    bridge: { jumperConnectionId: "j", underConnectionId: "u", x: 100, y: 40 },
    jumperPoints: jumper,
    siblingBridges: [],
    junctions: [{ x: 110, y: 40 }],
  });
  assert.equal(near.ok, false);
  assert.ok(near.reasons.includes("bridge-junction"));
  assert.equal(MIN_JUNCTION_BRIDGE_DISTANCE, 24);
});

test("bend-adjacent Independent Crossing is forbidden", () => {
  const jumper = [
    { x: 0, y: 40 },
    { x: 40, y: 40 },
    { x: 40, y: 120 },
  ];
  const nearBend = evaluateBridgeFeasibility({
    bridge: { jumperConnectionId: "j", underConnectionId: "u", x: 40, y: 52 },
    jumperPoints: jumper,
    siblingBridges: [],
    junctions: [],
  });
  assert.equal(nearBend.ok, false);
  assert.ok(
    nearBend.reasons.includes("bridge-bend") ||
      nearBend.reasons.includes("unrenderable-bridge"),
  );
  assert.equal(MIN_BEND_BRIDGE_DISTANCE, 20);
});

test("unsafe Independent Crossing is not kept as a plain hop skip", () => {
  const jumper = [
    { x: 0, y: 10 },
    { x: 30, y: 10 },
  ];
  const bridge = {
    jumperConnectionId: "j",
    underConnectionId: "u",
    x: 15,
    y: 10,
    jumperAxis: "h" as const,
  };
  assert.equal(canRenderBridgeHop(jumper, bridge), false);
  const report = evaluateBridgeFeasibility({
    bridge,
    jumperPoints: jumper,
    siblingBridges: [],
    junctions: [],
  });
  assert.equal(report.ok, false);
  assert.ok(report.reasons.includes("unrenderable-bridge"));
});

test("unrelated routes stay deepEqual after a distant 1:1 move", () => {
  const scene = resolveDevFixtureReadonlyScene({ includeStyleDemo: true });
  const state = seedStableRouteState(
    scene.graph.cards,
    scene.graph.connections,
    scene.routeTopology,
  );
  const info = scene.graph.cards.find((c) => c.id === "demo_info")!;
  const next = applyCardPositionToGraph(
    scene.graph,
    "demo_info",
    info.layout.x + 20,
    info.layout.y - 10,
  );
  const moved = applyIncrementalCardMove({
    previous: state,
    cards: next.cards,
    connections: next.connections,
    topology: scene.routeTopology,
    movedCardId: "demo_info",
  });
  const affected = new Set(
    collectAffectedConnectionIds({
      movedCardId: "demo_info",
      cards: next.cards,
      connections: next.connections,
      topology: scene.routeTopology,
      previous: state,
    }),
  );
  for (const id of Object.keys(state.byId)) {
    if (affected.has(id)) continue;
    assert.equal(moved.state.byId[id], state.byId[id], id);
    assert.deepEqual(moved.state.byId[id]!.points, state.byId[id]!.points, id);
  }
});

test("Undo / Redo restore edge metadata and do not re-pathfind", () => {
  const scene = resolveDevFixtureReadonlyScene({ includeStyleDemo: true });
  const state = seedStableRouteState(
    scene.graph.cards,
    scene.graph.connections,
    scene.routeTopology,
  );
  const info = scene.graph.cards.find((c) => c.id === "demo_info")!;
  const next = applyCardPositionToGraph(
    scene.graph,
    "demo_info",
    info.layout.x + 24,
    info.layout.y - 12,
  );
  const moved = applyIncrementalCardMove({
    previous: state,
    cards: next.cards,
    connections: next.connections,
    topology: scene.routeTopology,
    movedCardId: "demo_info",
  });
  const before = captureSceneFragment({
    cards: scene.graph.cards,
    cardIds: ["demo_info"],
    routeState: state,
    topology: scene.routeTopology,
  });
  const after = captureSceneFragment({
    cards: next.cards,
    cardIds: ["demo_info"],
    routeState: moved.state,
    topology: moved.topology ?? scene.routeTopology,
  });
  let history = pushDiagramHistory(emptyDiagramHistory(), {
    type: "moveCard",
    cardIds: ["demo_info"],
    before,
    after,
  });
  const undone = undoDiagramHistory(history);
  assert.equal(
    undone.fragment!.routeState.byId.demo_c_cur!.sourceEdge,
    state.byId.demo_c_cur!.sourceEdge,
  );
  assert.equal(
    undone.fragment!.routeState.byId.demo_c_cur!.targetEdge,
    state.byId.demo_c_cur!.targetEdge,
  );
  assert.ok(
    pointsDeepEqual(
      undone.fragment!.routeState.byId.demo_c_cur!.points,
      state.byId.demo_c_cur!.points,
    ),
  );
  const restored = applySceneFragmentToGraph(next, undone.fragment!);
  assert.equal(restored.cards.find((c) => c.id === "demo_info")!.layout.x, info.layout.x);
  history = undone.history;
  const redone = redoDiagramHistory(history);
  assert.equal(
    redone.fragment!.routeState.byId.demo_c_cur!.sourceEdge,
    moved.state.byId.demo_c_cur!.sourceEdge,
  );
  assert.ok(
    pointsDeepEqual(
      redone.fragment!.routeState.byId.demo_c_cur!.points,
      moved.state.byId.demo_c_cur!.points,
    ),
  );
  const ws = readFileSync(
    new URL(
      "../../../components/v2/relatedDiagram/RelatedDiagramDevFixtureWorkspace.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.ok(ws.includes("undoDiagramHistory"));
  assert.ok(ws.includes("applySceneFragmentToGraph"));
  assert.ok(ws.includes("setRouteState(fragment.routeState)"));
  assert.equal(ws.includes("applyIncrementalCardMove(undone"), false);
});

test("debug overlay exposes Final Geometry Guard primitives", () => {
  const overlay = readFileSync(
    new URL(
      "../../../components/v2/relatedDiagram/RelatedDiagramRouteDebugOverlay.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  for (const token of [
    "source-card-solid",
    "target-card-solid",
    "endpoint-corridor",
    "legend-obstacle",
    "arrow-target-pin",
    "marker-tip",
    "bridge-safe-zone",
    "bridge-cluster-invalid",
    "self-card-penetration",
  ]) {
    assert.ok(overlay.includes(token), token);
  }
});

console.log(`\n${passed} passed`);
