/**
 * Phase 2 pathfinder / dynamic edge / arrow tests.
 * Run: npx tsx lib/v2/relatedDiagram/rectilinearPathfinder.test.ts
 */

import assert from "node:assert/strict";
import { applyCardPositionToGraph } from "./cardInteractionState";
import { chooseEdgesWithHysteresis } from "./dynamicEdgeAttachment";
import {
  applyIncrementalCardMove,
  collectAffectedConnectionIds,
  seedStableRouteState,
} from "./incrementalRoutes";
import { edgeMidpoint } from "./orthogonalRouting";
import { findRectilinearPath } from "./rectilinearPathfinder";
import { resolveDevFixtureReadonlyScene } from "./resolveReadonlyScene";
import {
  CARD_ROUTE_CLEARANCE,
  MIN_ARROW_APPROACH,
  lastSegmentLength,
  polylineViolatesKeepOuts,
  cardObstacle,
  validateRouteGate,
} from "./routeHardening";
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
  height = 48,
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

test("pathfinder detours around a blocking card", () => {
  const source = card("s", 40, 40);
  const target = card("t", 400, 40);
  const wall = card("w", 200, 20, 80, 80);
  const path = findRectilinearPath({
    start: { x: 120, y: 64 },
    goal: { x: 400, y: 64 },
    startStub: { x: 144, y: 64 },
    goalApproach: { x: 376, y: 64 },
    obstacles: [source, target, wall].map(cardObstacle),
    ignoreIds: new Set(["s", "t"]),
  });
  assert.ok(path && path.length >= 2);
  assert.equal(
    polylineViolatesKeepOuts(
      path!,
      [source, target, wall].map(cardObstacle),
      new Set(["s", "t"]),
      0,
    ),
    false,
  );
});

test("pathfinder weaves around multiple card obstacles", () => {
  const source = card("s", 20, 200);
  const target = card("t", 520, 200);
  const a = card("a", 180, 180, 80, 80);
  const b = card("b", 320, 200, 80, 80);
  const path = findRectilinearPath({
    start: { x: 100, y: 224 },
    goal: { x: 520, y: 224 },
    obstacles: [source, target, a, b].map(cardObstacle),
    ignoreIds: new Set(["s", "t"]),
  });
  assert.ok(path);
  assert.equal(
    polylineViolatesKeepOuts(
      path!,
      [source, target, a, b].map(cardObstacle),
      new Set(["s", "t"]),
      0,
    ),
    false,
  );
});

test("opposite-side move flips edges with hysteresis", () => {
  const source = card("s", 200, 80, 80, 48);
  const target = card("t", 400, 80, 80, 48);
  const current = { sourceEdge: "right" as const, targetEdge: "left" as const };
  const kept = chooseEdgesWithHysteresis(source, target, current);
  assert.equal(kept.flipped, false);
  const moved = card("t", 40, 80, 80, 48);
  const flipped = chooseEdgesWithHysteresis(source, moved, current);
  assert.equal(flipped.sourceEdge, "left");
  assert.equal(flipped.targetEdge, "right");
  assert.equal(flipped.flipped, true);
});

test("opposite-side incremental move keeps an arrow approach", () => {
  const scene = resolveDevFixtureReadonlyScene({ includeStyleDemo: true });
  const state = seedStableRouteState(
    scene.graph.cards,
    scene.graph.connections,
    scene.routeTopology,
  );
  const info = scene.graph.cards.find((c) => c.id === "demo_info")!;
  const partner = scene.graph.cards.find((c) => c.id === "demo_u_cur")!;
  const destX = partner.layout.x - info.layout.width - 40;
  const next = applyCardPositionToGraph(
    scene.graph,
    "demo_info",
    destX,
    partner.layout.y,
  );
  const moved = applyIncrementalCardMove({
    previous: state,
    cards: next.cards,
    connections: next.connections,
    topology: scene.routeTopology,
    movedCardId: "demo_info",
  });
  const route = moved.state.byId.demo_c_cur!;
  assert.ok(lastSegmentLength(route.points) >= MIN_ARROW_APPROACH - 0.2);
  const gate = validateRouteGate({
    points: route.points,
    sourcePin: route.sourcePin,
    targetPin: route.targetPin,
    obstacles: next.cards.map(cardObstacle),
    sourceCardId: route.sourceCardId,
    targetCardId: route.targetCardId,
    clearance: 0,
    targetEdge: route.targetEdge,
  });
  assert.equal(gate.reasons.includes("arrow-reversed"), false);
  const tgt = next.cards.find((c) => c.id === route.targetCardId)!;
  const pin = edgeMidpoint(tgt.layout, route.targetEdge);
  const end = route.points[route.points.length - 1]!;
  assert.equal(end.x, pin.x);
  assert.equal(end.y, pin.y);
});

test("fan child pathfind changes only the child leg", () => {
  const scene = resolveDevFixtureReadonlyScene({ includeStyleDemo: true });
  const state = seedStableRouteState(
    scene.graph.cards,
    scene.graph.connections,
    scene.routeTopology,
  );
  const hall = scene.graph.cards.find((c) => c.id === "sk_hallucination")!;
  const next = applyCardPositionToGraph(
    scene.graph,
    "sk_hallucination",
    hall.layout.x,
    hall.layout.y - 40,
  );
  const moved = applyIncrementalCardMove({
    previous: state,
    cards: next.cards,
    connections: next.connections,
    topology: scene.routeTopology,
    movedCardId: "sk_hallucination",
  });
  const affected = collectAffectedConnectionIds({
    movedCardId: "sk_hallucination",
    cards: next.cards,
    connections: next.connections,
    topology: scene.routeTopology,
    previous: state,
  });
  assert.equal(affected.includes("skc10"), false);
  assert.deepEqual(moved.state.byId.skc10!.points, state.byId.skc10!.points);
  assert.deepEqual(moved.state.byId.skc11!.points, state.byId.skc11!.points);
  const bp = moved.topology!.branchPoints.find((b) => b.id === "bp_positive")!;
  const before = scene.routeTopology!.branchPoints.find((b) => b.id === "bp_positive")!;
  assert.deepEqual({ x: bp.x, y: bp.y }, { x: before.x, y: before.y });
});

test("fan source keeps the BP when a trunk can reach it", () => {
  const scene = resolveDevFixtureReadonlyScene({ includeStyleDemo: true });
  const state = seedStableRouteState(
    scene.graph.cards,
    scene.graph.connections,
    scene.routeTopology,
  );
  const patho = scene.graph.cards.find((c) => c.id === "sk_patho_core")!;
  const next = applyCardPositionToGraph(
    scene.graph,
    "sk_patho_core",
    patho.layout.x + 24,
    patho.layout.y,
  );
  const moved = applyIncrementalCardMove({
    previous: state,
    cards: next.cards,
    connections: next.connections,
    topology: scene.routeTopology,
    movedCardId: "sk_patho_core",
  });
  const before = scene.routeTopology!.branchPoints.find((b) => b.id === "bp_patho_core")!;
  const after = moved.topology!.branchPoints.find((b) => b.id === "bp_patho_core")!;
  assert.deepEqual({ x: after.x, y: after.y }, { x: before.x, y: before.y });
  assert.deepEqual(moved.state.byId.skc9!.points, state.byId.skc9!.points);
});

test("moved card that covers a route does not pierce unrelated cards", () => {
  const source = card("s", 40, 40, 80, 48);
  const target = card("t", 520, 40, 80, 48);
  const mover = card("m", 40, 300, 80, 80);
  const graph = {
    schemaVersion: "1" as const,
    cards: [source, target, mover],
    connections: [
      {
        id: "c1",
        sourceCardId: "s",
        targetCardId: "t",
        relationType: "current" as const,
        origin: "student_diagram" as const,
        createdAt: source.createdAt,
        updatedAt: source.updatedAt,
      },
    ],
    sources: [],
    nursingProblems: [],
    integrations: [],
  };
  const seeded = seedStableRouteState(graph.cards, graph.connections);
  const next = applyCardPositionToGraph(graph, "m", 240, 20);
  const moved = applyIncrementalCardMove({
    previous: seeded,
    cards: next.cards,
    connections: next.connections,
    movedCardId: "m",
  });
  const route = moved.state.byId.c1!;
  assert.equal(
    polylineViolatesKeepOuts(
      route.points,
      next.cards.map(cardObstacle),
      new Set(["s", "t"]),
      0,
    ),
    false,
  );
  assert.ok(lastSegmentLength(route.points) >= MIN_ARROW_APPROACH - 0.2);
  void CARD_ROUTE_CLEARANCE;
});

console.log(`\n${passed} passed`);
