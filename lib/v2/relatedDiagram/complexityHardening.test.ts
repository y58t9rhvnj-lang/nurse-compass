/**
 * Slice 2A complexity hardening: budget, quality, BP relocation, A3 bounds.
 * Run: npx tsx lib/v2/relatedDiagram/complexityHardening.test.ts
 */

import assert from "node:assert/strict";
import { A3_HEIGHT_PX, A3_WIDTH_PX } from "./a3Canvas";
import { applyCardPositionToGraph } from "./cardInteractionState";
import { resolveCardDropCollision } from "./cardCollision";
import {
  applySceneFragmentToGraph,
  captureSceneFragment,
  emptyDiagramHistory,
  pushDiagramHistory,
  redoDiagramHistory,
  undoDiagramHistory,
} from "./diagramHistory";
import {
  A3_BOUNDARY_REASON,
  A3_ROUTE_MARGIN,
  a3BoundaryViolationReasons,
  bridgeArcLeavesA3,
  clampRoutePointToA3,
  evaluateBridgeFeasibility,
  markerLeavesA3,
} from "./geometryGuard";
import {
  applyIncrementalCardMove,
  oppositeFanHalfPlane,
  pointsDeepEqual,
  seedStableRouteState,
} from "./incrementalRoutes";
import { findRectilinearPath } from "./rectilinearPathfinder";
import { resolveDevFixtureReadonlyScene } from "./resolveReadonlyScene";
import {
  BRIDGE_REROUTE_EXTRA_BUDGET,
  MAX_FINAL_DETOUR_RATIO,
  exceedsFinalDetourRatio,
  extraRouteLength,
  pickWithinBridgeBudget,
  polylineManhattan,
  semanticDetourBaseline,
  withinBridgeRerouteBudget,
} from "./routeCongestion";
import {
  defaultRouteCanvas,
  generateOrthogonalCandidates,
  generatePointToPointCandidates,
  validateOrthogonalRoute,
} from "./routeHardening";

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

function fixture() {
  const scene = resolveDevFixtureReadonlyScene({ includeStyleDemo: true });
  const state = seedStableRouteState(
    scene.graph.cards,
    scene.graph.connections,
    scene.routeTopology,
  );
  return { scene, state };
}

function drop(
  cardId: string,
  x: number,
  y: number,
  scene = fixture().scene,
  state = seedStableRouteState(
    scene.graph.cards,
    scene.graph.connections,
    scene.routeTopology,
  ),
) {
  const card = scene.graph.cards.find((c) => c.id === cardId)!;
  const resolved = resolveCardDropCollision({
    movingCard: card,
    desiredPosition: { x, y },
    otherCards: scene.graph.cards.filter((c) => c.id !== cardId),
    lastLegal: { x: card.layout.x, y: card.layout.y },
  });
  const nextGraph = applyCardPositionToGraph(
    scene.graph,
    cardId,
    resolved.position.x,
    resolved.position.y,
  );
  const moved = applyIncrementalCardMove({
    previous: state,
    cards: nextGraph.cards,
    connections: nextGraph.connections,
    topology: scene.routeTopology,
    movedCardId: cardId,
  });
  return {
    scene,
    nextGraph,
    state: moved.state,
    topology: moved.topology,
    previous: state,
    card,
  };
}

test("bridge budget constant is 320", () => {
  assert.equal(BRIDGE_REROUTE_EXTRA_BUDGET, 320);
  assert.equal(withinBridgeRerouteBudget(201 + 320, 201), true);
  assert.equal(withinBridgeRerouteBudget(201 + 321, 201), false);
});

test("201 vs 615 keeps the short candidate", () => {
  const picked = pickWithinBridgeBudget(
    [
      { id: "short", len: 201 },
      { id: "long", len: 615 },
    ],
    (c) => c.len,
  );
  assert.deepEqual(
    picked.map((c) => c.id),
    ["short"],
  );
  assert.equal(extraRouteLength(615, 201) > BRIDGE_REROUTE_EXTRA_BUDGET, true);
});

test("safe short route wins over long crossing-free detour", () => {
  const picked = pickWithinBridgeBudget(
    [
      { id: "short-bridge", len: 240 },
      { id: "long-clear", len: 900 },
    ],
    (c) => c.len,
  );
  assert.equal(picked.length, 1);
  assert.equal(picked[0]!.id, "short-bridge");
});

test("budget-inside reroute is adopted", () => {
  assert.equal(withinBridgeRerouteBudget(480, 201), true);
});

test("budget-over reroute is rejected", () => {
  assert.equal(withinBridgeRerouteBudget(615, 201), false);
});

test("detour 5.44 is rejected by final quality guard", () => {
  assert.equal(MAX_FINAL_DETOUR_RATIO, 3);
  assert.equal(
    exceedsFinalDetourRatio(615, { x: 0, y: 0 }, { x: 113, y: 0 }),
    true,
  );
});

test("reasonable detour is accepted", () => {
  assert.equal(
    exceedsFinalDetourRatio(180, { x: 0, y: 0 }, { x: 100, y: 0 }),
    false,
  );
});

test("fan semantic baseline does not false-reject a BP path", () => {
  const source = { x: 505, y: 382 };
  const target = { x: 761, y: 460 };
  const bp = { x: 505, y: 430 };
  const via = semanticDetourBaseline(source, target, bp);
  assert.ok(via > 300);
  assert.equal(exceedsFinalDetourRatio(via, source, target, bp), false);
});

test("ordinary fan child move keeps the BP", () => {
  const { scene, state } = fixture();
  const bp = scene.routeTopology!.branchPoints.find((b) => b.id === "bp_cognitive")!;
  const child = scene.graph.cards.find((c) => c.id === "sk_working_memory")!;
  const result = drop(
    "sk_working_memory",
    child.layout.x + 24,
    child.layout.y + 12,
    scene,
    state,
  );
  const next = result.topology!.branchPoints.find((b) => b.id === "bp_cognitive")!;
  assert.equal(next.x, bp.x);
  assert.equal(next.y, bp.y);
});

test("opposite half-plane + far child relocates BP and avoids the 1585 rail", () => {
  const { scene, state } = fixture();
  const before = scene.routeTopology!.branchPoints.find((b) => b.id === "bp_cognitive")!;
  const result = drop("sk_working_memory", 1380, 40, scene, state);
  const after = result.topology!.branchPoints.find((b) => b.id === "bp_cognitive")!;
  const route = result.state.byId.skc15!;
  const xs = route.points.map((p) => p.x);
  const last = route.points[route.points.length - 1]!;
  assert.equal(after.connectionIds.join(","), before.connectionIds.join(","));
  const relocated = after.x !== before.x || after.y !== before.y;
  assert.ok(Math.abs(last.x - route.targetPin.x) <= 0.2, "live target pin");
  assert.ok(Math.abs(last.y - route.targetPin.y) <= 0.2, "live target pin");
  assert.ok(Math.max(...xs) < 1570, `max x ${Math.max(...xs)}`);
  assert.ok(polylineManhattan(route.points) < 1600);
  assert.ok(
    relocated || (result.state.invalidReasons.skc15 ?? []).length === 0,
    `need BP move or a legal fixed-BP route, invalid=${(result.state.invalidReasons.skc15 ?? []).join(",")}`,
  );
  assert.equal(
    oppositeFanHalfPlane(before, state.byId.skc15!.targetPin, route.targetPin),
    true,
  );
});

test("BP relocation clamps to the A3 inner margin", () => {
  const clamped = clampRoutePointToA3({ x: -40, y: 2000 });
  assert.equal(clamped.x, A3_ROUTE_MARGIN);
  assert.equal(clamped.y, A3_HEIGHT_PX - A3_ROUTE_MARGIN);
});

test("BP relocation keeps membership and sibling card", () => {
  const { scene, state } = fixture();
  const sibling = scene.graph.cards.find((c) => c.id === "sk_attention")!;
  const result = drop("sk_working_memory", 1380, 40, scene, state);
  const bp = result.topology!.branchPoints.find((b) => b.id === "bp_cognitive")!;
  assert.deepEqual(bp.connectionIds, ["skc14", "skc15"]);
  const afterSibling = result.nextGraph.cards.find((c) => c.id === "sk_attention")!;
  assert.equal(afterSibling.layout.x, sibling.layout.x);
  assert.equal(afterSibling.layout.y, sibling.layout.y);
});

test("sibling far-end stays put after BP relocation", () => {
  const { scene, state } = fixture();
  const prev = state.byId.skc14!;
  const result = drop("sk_working_memory", 1380, 40, scene, state);
  const next = result.state.byId.skc14!;
  const prevEnd = prev.points[prev.points.length - 1]!;
  const nextEnd = next.points[next.points.length - 1]!;
  assert.equal(nextEnd.x, prevEnd.x);
  assert.equal(nextEnd.y, prevEnd.y);
});

test("unrelated route is deepEqual after a far fan child move", () => {
  const { scene, state } = fixture();
  const result = drop("sk_working_memory", 1380, 40, scene, state);
  assert.equal(
    pointsDeepEqual(state.byId.skc1!.points, result.state.byId.skc1!.points),
    true,
  );
});

test("x < 0 is an A3 boundary violation", () => {
  const reasons = a3BoundaryViolationReasons([
    { x: 20, y: 40 },
    { x: -4, y: 40 },
    { x: 80, y: 40 },
  ]);
  assert.ok(reasons.includes(A3_BOUNDARY_REASON));
});

test("x > 1587 is an A3 boundary violation", () => {
  const reasons = a3BoundaryViolationReasons([
    { x: 20, y: 40 },
    { x: A3_WIDTH_PX + 8, y: 40 },
    { x: 80, y: 40 },
  ]);
  assert.ok(reasons.includes(A3_BOUNDARY_REASON));
});

test("y < 0 is an A3 boundary violation", () => {
  const reasons = a3BoundaryViolationReasons([
    { x: 40, y: 20 },
    { x: 40, y: -6 },
    { x: 40, y: 80 },
  ]);
  assert.ok(reasons.includes(A3_BOUNDARY_REASON));
});

test("y > 1123 is an A3 boundary violation", () => {
  const reasons = a3BoundaryViolationReasons([
    { x: 40, y: 20 },
    { x: 40, y: A3_HEIGHT_PX + 4 },
    { x: 40, y: 80 },
  ]);
  assert.ok(reasons.includes(A3_BOUNDARY_REASON));
});

test("candidate generator does not emit outside points", () => {
  const source = { id: "s", x: 4, y: 40, width: 40, height: 20 };
  const target = { id: "t", x: 200, y: 40, width: 40, height: 20 };
  const cands = generateOrthogonalCandidates({
    source,
    target,
    sourceEdge: "left",
    targetEdge: "left",
    obstacles: [source, target],
    canvas: defaultRouteCanvas(),
  });
  for (const pts of cands) {
    assert.equal(a3BoundaryViolationReasons(pts).length, 0);
  }
  const p2p = generatePointToPointCandidates(
    { x: 8, y: 8 },
    { x: 80, y: 80 },
    [],
    new Set(),
    defaultRouteCanvas(),
  );
  for (const pts of p2p) {
    assert.equal(a3BoundaryViolationReasons(pts).length, 0);
  }
});

test("pathfinder does not grow an outward edge from the canvas wall", () => {
  const found = findRectilinearPath({
    start: { x: 20, y: 40 },
    goal: { x: 80, y: 40 },
    obstacles: [],
    ignoreIds: new Set(),
    canvas: { x: 0, y: 0, width: A3_WIDTH_PX, height: A3_HEIGHT_PX },
  });
  assert.ok(found);
  for (const p of found!) {
    assert.ok(p.x >= 0 && p.x <= A3_WIDTH_PX);
    assert.ok(p.y >= 0 && p.y <= A3_HEIGHT_PX);
  }
});

test("bridge arc that leaves A3 is rejected", () => {
  assert.equal(bridgeArcLeavesA3(4, 40), true);
  assert.equal(bridgeArcLeavesA3(80, 80), false);
  const report = evaluateBridgeFeasibility({
    bridge: {
      jumperConnectionId: "j",
      underConnectionId: "u",
      x: 4,
      y: 80,
    },
    jumperPoints: [
      { x: 4, y: 20 },
      { x: 4, y: 200 },
    ],
    siblingBridges: [],
    junctions: [],
  });
  assert.equal(report.ok, false);
  assert.ok(report.reasons.includes(A3_BOUNDARY_REASON));
});

test("negative-fan x=12 rail stays legal", () => {
  const { state } = fixture();
  const route = state.byId.skc12!;
  assert.ok(route.points.some((p) => p.x === 12));
  assert.equal(a3BoundaryViolationReasons(route.points).length, 0);
  assert.equal(state.invalidReasons.skc12, undefined);
  assert.equal(a3BoundaryViolationReasons(state.byId.skc13!.points).length, 0);
});

test("legend and self-card reasons still fire inside A3", () => {
  const source = { id: "a", x: 40, y: 80, width: 80, height: 40 };
  const target = { id: "b", x: 240, y: 80, width: 80, height: 40 };
  const through = [
    { x: 80, y: 100 },
    { x: 40, y: 100 },
    { x: 40, y: 40 },
    { x: 280, y: 40 },
    { x: 280, y: 100 },
  ];
  const rejected = validateOrthogonalRoute({
    points: through,
    sourcePin: { x: 80, y: 100 },
    targetPin: { x: 280, y: 100 },
    obstacles: [source, target],
    sourceCardId: "a",
    targetCardId: "b",
    sourceEdge: "right",
    targetEdge: "left",
  });
  assert.equal(rejected.ok, false);
  assert.ok(rejected.reasons.includes("self-card-penetration"));
});

test("marker tip on a live pin stays inside A3", () => {
  assert.equal(markerLeavesA3({ x: 80, y: 80 }), false);
  assert.equal(markerLeavesA3({ x: -1, y: 80 }), true);
});

test("BP relocation Undo / Redo is exact", () => {
  const { scene, state } = fixture();
  const before = captureSceneFragment({
    cards: scene.graph.cards,
    cardIds: ["sk_working_memory"],
    routeState: state,
    topology: scene.routeTopology,
  });
  const result = drop("sk_working_memory", 1380, 40, scene, state);
  const after = captureSceneFragment({
    cards: result.nextGraph.cards,
    cardIds: ["sk_working_memory"],
    routeState: result.state,
    topology: result.topology,
  });
  let history = emptyDiagramHistory();
  history = pushDiagramHistory(history, {
    type: "moveCard",
    cardIds: ["sk_working_memory"],
    before,
    after,
  });
  const undone = undoDiagramHistory(history);
  assert.ok(undone.fragment);
  const restored = applySceneFragmentToGraph(result.nextGraph, undone.fragment!);
  assert.equal(
    restored.cards.find((c) => c.id === "sk_working_memory")!.layout.x,
    scene.graph.cards.find((c) => c.id === "sk_working_memory")!.layout.x,
  );
  assert.equal(
    pointsDeepEqual(undone.fragment!.routeState.byId.skc15!.points, state.byId.skc15!.points),
    true,
  );
  assert.equal(
    undone.fragment!.topology!.branchPoints.find((b) => b.id === "bp_cognitive")!.x,
    scene.routeTopology!.branchPoints.find((b) => b.id === "bp_cognitive")!.x,
  );
  const redone = redoDiagramHistory(undone.history);
  assert.equal(
    pointsDeepEqual(redone.fragment!.routeState.byId.skc15!.points, result.state.byId.skc15!.points),
    true,
  );
});

test("quality-alternate Undo restores the before fragment", () => {
  const { scene, state } = fixture();
  const before = captureSceneFragment({
    cards: scene.graph.cards,
    cardIds: ["demo_treat_src"],
    routeState: state,
    topology: scene.routeTopology,
  });
  const result = drop("demo_treat_src", 1100, 124, scene, state);
  const after = captureSceneFragment({
    cards: result.nextGraph.cards,
    cardIds: ["demo_treat_src"],
    routeState: result.state,
    topology: result.topology,
  });
  let history = emptyDiagramHistory();
  history = pushDiagramHistory(history, {
    type: "moveCard",
    cardIds: ["demo_treat_src"],
    before,
    after,
  });
  const undone = undoDiagramHistory(history);
  assert.equal(
    pointsDeepEqual(
      undone.fragment!.routeState.byId.demo_c_treat!.points,
      state.byId.demo_c_treat!.points,
    ),
    true,
  );
});

test("demo_c_treat does not keep the 5.44 detour", () => {
  const { scene, state } = fixture();
  const result = drop("demo_treat_src", 1100, 160, scene, state);
  const route = result.state.byId.demo_c_treat!;
  const len = polylineManhattan(route.points);
  const direct =
    Math.abs(route.sourcePin.x - route.targetPin.x) +
    Math.abs(route.sourcePin.y - route.targetPin.y);
  const ratio = len / Math.max(1, direct);
  assert.ok(len < 580 || ratio <= 3, `len=${len} ratio=${ratio.toFixed(2)}`);
  assert.ok(ratio < 5.4);
});

test("A. 1:1 opposite-side move stays local", () => {
  const { scene, state } = fixture();
  const result = drop("demo_treat_src", 40, 700, scene, state);
  const route = result.state.byId.demo_c_treat!;
  const reasons = result.state.invalidReasons.demo_c_treat ?? [];
  assert.equal(a3BoundaryViolationReasons(route.points).length, 0);
  assert.equal(reasons.includes("excessive-crossings"), false);
  assert.ok(polylineManhattan(route.points) < 1600);
});

test("B. fan child opposite half-plane can relocate BP", () => {
  const { scene, state } = fixture();
  const before = scene.routeTopology!.branchPoints.find((b) => b.id === "bp_cognitive")!;
  const result = drop("sk_working_memory", 200, 40, scene, state);
  const after = result.topology!.branchPoints.find((b) => b.id === "bp_cognitive")!;
  assert.deepEqual(after.connectionIds, before.connectionIds);
  assert.equal(after.id, before.id);
});

test("C. fan child to A3 top-right does not take the 1585 rail", () => {
  const { scene, state } = fixture();
  const result = drop("sk_working_memory", 1380, 40, scene, state);
  const xs = result.state.byId.skc15!.points.map((p) => p.x);
  assert.ok(Math.max(...xs) < 1570);
});

test("D. changed route does not rewrite the stable demo crossing", () => {
  const { scene, state } = fixture();
  const beforeH = state.byId.demo_c_cross_h!.points;
  const beforeV = state.byId.demo_c_cross_v!.points;
  const beforeBr = state.bridges.filter(
    (b) =>
      b.jumperConnectionId === "demo_c_cross_v" ||
      b.underConnectionId === "demo_c_cross_h",
  );
  const result = drop("demo_treat_src", 900, 640, scene, state);
  assert.equal(
    pointsDeepEqual(beforeH, result.state.byId.demo_c_cross_h!.points),
    true,
  );
  assert.equal(
    pointsDeepEqual(beforeV, result.state.byId.demo_c_cross_v!.points),
    true,
  );
  const afterBr = result.state.bridges.filter(
    (b) =>
      b.jumperConnectionId === "demo_c_cross_v" ||
      b.underConnectionId === "demo_c_cross_h",
  );
  assert.equal(beforeBr.length, afterBr.length);
});

test("I. BP relocation keeps membership and Junction id", () => {
  const { scene, state } = fixture();
  const before = scene.routeTopology!.branchPoints.find((b) => b.id === "bp_cognitive")!;
  const result = drop("sk_working_memory", 1380, 40, scene, state);
  const after = result.topology!.branchPoints.find((b) => b.id === "bp_cognitive")!;
  assert.equal(after.id, "bp_cognitive");
  assert.deepEqual(after.connectionIds, before.connectionIds);
});

test("J. unrelated demo crossing stays deepEqual", () => {
  const { scene, state } = fixture();
  const result = drop("sk_working_memory", 1380, 40, scene, state);
  assert.equal(
    pointsDeepEqual(state.byId.demo_c_cross_h!.points, result.state.byId.demo_c_cross_h!.points),
    true,
  );
  assert.equal(
    pointsDeepEqual(state.byId.demo_c_cross_v!.points, result.state.byId.demo_c_cross_v!.points),
    true,
  );
});

console.log(`\n${passed} passed`);
