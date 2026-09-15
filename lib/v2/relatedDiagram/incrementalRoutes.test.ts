/**
 * Incremental route stability + collision-then-route tests.
 * Run: npx tsx lib/v2/relatedDiagram/incrementalRoutes.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CARD_MIN_GAP,
  collidingCards,
  otherCardsUnchanged,
  resolveCardDropCollision,
  resolveGroupDropCollision,
} from "./cardCollision";
import { applyCardPositionToGraph } from "./cardInteractionState";
import { edgeMidpoint } from "./orthogonalRouting";
import {
  applyIncrementalCardMove,
  applyIncrementalGroupMove,
  bridgesDeepEqual,
  collectAffectedConnectionIds,
  membershipSnapshot,
  pointsDeepEqual,
  seedStableRouteState,
} from "./incrementalRoutes";
import {
  applyKnowledgeGroupDelta,
  knowledgeGroupBounds,
} from "./knowledgeGroupLayout";
import { resolveDevFixtureReadonlyScene } from "./resolveReadonlyScene";
import { repairRouteEndpoint } from "./repairRouteEndpoint";
import { CARD_ROUTE_CLEARANCE } from "./routeHardening";
import { translateKnowledgeTopology } from "./regenerateRouteTopology";

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

function dropCard(
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
    previous: state,
    resolved,
    nextGraph,
    state: moved.state,
    topology: moved.topology,
    card,
  };
}

function pinExact(
  cards: { id: string; layout: { x: number; y: number; width: number; height: number } }[],
  route: { sourceCardId: string; targetCardId: string; sourceEdge: string; targetEdge: string; points: { x: number; y: number }[] },
) {
  const source = cards.find((c) => c.id === route.sourceCardId)!;
  const target = cards.find((c) => c.id === route.targetCardId)!;
  const start = route.points[0]!;
  const end = route.points[route.points.length - 1]!;
  const sourcePin = edgeMidpoint(source.layout, route.sourceEdge as "top" | "right" | "bottom" | "left");
  const targetPin = edgeMidpoint(target.layout, route.targetEdge as "top" | "right" | "bottom" | "left");
  assert.equal(start.x, sourcePin.x, route.sourceCardId);
  assert.equal(start.y, sourcePin.y, route.sourceCardId);
  assert.equal(end.x, targetPin.x, route.targetCardId);
  assert.equal(end.y, targetPin.y, route.targetCardId);
}

function unchangedIds(
  before: ReturnType<typeof seedStableRouteState>,
  after: ReturnType<typeof seedStableRouteState>,
  changed: Set<string>,
) {
  for (const id of Object.keys(before.byId)) {
    if (changed.has(id)) continue;
    assert.equal(after.byId[id], before.byId[id], id);
    assert.deepEqual(after.byId[id]!.points, before.byId[id]!.points, id);
  }
}

test("endpoint tail repair keeps the opposite side and matches the live pin", () => {
  const points = [
    { x: 10, y: 10 },
    { x: 10, y: 80 },
    { x: 40, y: 80 },
  ];
  const repaired = repairRouteEndpoint({
    existingPoints: points,
    movingEnd: "target",
    livePin: { x: 90, y: 120 },
  });
  assert.deepEqual(repaired[0], { x: 10, y: 10 });
  assert.deepEqual(repaired[repaired.length - 1], { x: 90, y: 120 });
  assert.ok(repaired.length <= points.length + 1);
});

test("1:1 card move changes only that connection", () => {
  const { scene, state } = fixture();
  const before = state.byId.demo_c_cur;
  assert.ok(before);
  const result = dropCard("demo_info", 1180, 60, scene, state);
  const affected = new Set(
    collectAffectedConnectionIds({
      movedCardId: "demo_info",
      cards: result.nextGraph.cards,
      connections: result.nextGraph.connections,
      topology: scene.routeTopology,
      previous: state,
    }),
  );
  assert.ok(affected.has("demo_c_cur"));
  assert.equal(affected.has("skc1"), false);
  assert.equal(pointsDeepEqual(result.state.byId.skc1!.points, state.byId.skc1!.points), true);
  assert.equal(result.state.byId.skc1, state.byId.skc1);
  assert.equal(
    pointsDeepEqual(result.state.byId.demo_c_cur!.points, before!.points),
    false,
  );
  pinExact(result.nextGraph.cards, result.state.byId.demo_c_cur!);
});

test("fan child move changes only that child leg", () => {
  const { scene, state } = fixture();
  const hall = scene.graph.cards.find((c) => c.id === "sk_hallucination")!;
  const result = dropCard(
    "sk_hallucination",
    hall.layout.x,
    hall.layout.y - 24,
    scene,
    state,
  );
  const affected = collectAffectedConnectionIds({
    movedCardId: "sk_hallucination",
    cards: result.nextGraph.cards,
    connections: result.nextGraph.connections,
    topology: scene.routeTopology,
    previous: state,
  });
  assert.ok(affected.includes("skc9"));
  assert.equal(affected.includes("skc10"), false);
  assert.equal(affected.includes("skc11"), false);
  assert.equal(pointsDeepEqual(result.state.byId.skc9!.points, state.byId.skc9!.points), false);
  assert.deepEqual(result.state.byId.skc10!.points, state.byId.skc10!.points);
  assert.deepEqual(result.state.byId.skc11!.points, state.byId.skc11!.points);
  assert.equal(result.state.byId.skc10, state.byId.skc10);
  assert.equal(result.state.byId.skc11, state.byId.skc11);
});

test("sibling A/B routes stay deepEqual after a child move", () => {
  const { scene, state } = fixture();
  const hall = scene.graph.cards.find((c) => c.id === "sk_hallucination")!;
  const result = dropCard(
    "sk_hallucination",
    hall.layout.x,
    hall.layout.y - 20,
    scene,
    state,
  );
  assert.deepEqual(result.state.byId.skc10!.points, state.byId.skc10!.points);
  assert.deepEqual(result.state.byId.skc11!.points, state.byId.skc11!.points);
});

test("fan source move repairs the trunk side only and keeps the BP", () => {
  const { scene, state } = fixture();
  const patho = scene.graph.cards.find((c) => c.id === "sk_patho_core")!;
  const bpBefore = scene.routeTopology!.branchPoints.find((b) => b.id === "bp_patho_core")!;
  const result = dropCard("sk_patho_core", patho.layout.x + 18, patho.layout.y, scene, state);
  const bpAfter = result.topology!.branchPoints.find((b) => b.id === "bp_patho_core")!;
  assert.deepEqual({ x: bpAfter.x, y: bpAfter.y }, { x: bpBefore.x, y: bpBefore.y });
  const before2 = state.byId.skc2!.points;
  const after2 = result.state.byId.skc2!.points;
  const atBp = (p: { x: number; y: number }) =>
    p.x === bpBefore.x && p.y === bpBefore.y;
  const beforeIdx = before2.findIndex(atBp);
  const afterIdx = after2.findIndex(atBp);
  assert.ok(beforeIdx >= 0);
  assert.ok(afterIdx >= 0);
  assert.deepEqual(after2.slice(afterIdx), before2.slice(beforeIdx));
  assert.deepEqual(result.state.byId.skc9!.points, state.byId.skc9!.points);
  pinExact(result.nextGraph.cards, result.state.byId.skc2!);
  pinExact(result.nextGraph.cards, result.state.byId.skc1!);
});

test("BP stays put for a child move", () => {
  const { scene, state } = fixture();
  const hall = scene.graph.cards.find((c) => c.id === "sk_hallucination")!;
  const bpBefore = scene.routeTopology!.branchPoints.find((b) => b.id === "bp_positive")!;
  const result = dropCard(
    "sk_hallucination",
    hall.layout.x + 6,
    hall.layout.y - 18,
    scene,
    state,
  );
  const bpAfter = result.topology!.branchPoints.find((b) => b.id === "bp_positive")!;
  assert.deepEqual({ x: bpAfter.x, y: bpAfter.y }, { x: bpBefore.x, y: bpBefore.y });
});

test("unrelated fan deepEqual after a distant 1:1 move", () => {
  const { scene, state } = fixture();
  const result = dropCard("demo_info", 1200, 70, scene, state);
  assert.deepEqual(result.state.byId.skc2!.points, state.byId.skc2!.points);
  assert.deepEqual(result.state.byId.skc9!.points, state.byId.skc9!.points);
  assert.deepEqual(result.state.byId.skc12!.points, state.byId.skc12!.points);
  assert.equal(result.state.byId.skc9, state.byId.skc9);
});

test("unrelated 1:1 deepEqual after a Knowledge child move", () => {
  const { scene, state } = fixture();
  const hall = scene.graph.cards.find((c) => c.id === "sk_hallucination")!;
  const result = dropCard(
    "sk_hallucination",
    hall.layout.x,
    hall.layout.y - 22,
    scene,
    state,
  );
  assert.deepEqual(result.state.byId.demo_c_cur!.points, state.byId.demo_c_cur!.points);
  assert.deepEqual(result.state.byId.skc1!.points, state.byId.skc1!.points);
});

test("unrelated bridge positions stay deepEqual", () => {
  const { scene, state } = fixture();
  const hall = scene.graph.cards.find((c) => c.id === "sk_hallucination")!;
  const result = dropCard(
    "sk_hallucination",
    hall.layout.x,
    hall.layout.y - 16,
    scene,
    state,
  );
  const beforeUnrelated = state.bridges.filter(
    (b) => b.jumperConnectionId !== "skc9" && b.underConnectionId !== "skc9",
  );
  const afterUnrelated = result.state.bridges.filter(
    (b) => b.jumperConnectionId !== "skc9" && b.underConnectionId !== "skc9",
  );
  assert.equal(bridgesDeepEqual(beforeUnrelated, afterUnrelated), true);
});

test("moved card overlapping an existing route affects only that route", () => {
  const { scene, state } = fixture();
  const route = state.byId.skc16;
  assert.ok(route && route.points.length >= 2);
  const mid = route.points[Math.floor(route.points.length / 2)]!;
  const info = scene.graph.cards.find((c) => c.id === "demo_info")!;
  const result = dropCard(
    "demo_info",
    mid.x - info.layout.width / 2,
    mid.y - info.layout.height / 2,
    scene,
    state,
  );
  const affected = new Set(
    collectAffectedConnectionIds({
      movedCardId: "demo_info",
      cards: result.nextGraph.cards,
      connections: result.nextGraph.connections,
      topology: scene.routeTopology,
      previous: state,
    }),
  );
  assert.ok(affected.has("demo_c_cur"));
  if (affected.has("skc16")) {
    unchangedIds(state, result.state, affected);
  }
  assert.deepEqual(result.state.byId.skc12!.points, state.byId.skc12!.points);
});

test("unrelated obstacle-free routes stay deepEqual", () => {
  const { scene, state } = fixture();
  const hall = scene.graph.cards.find((c) => c.id === "sk_hallucination")!;
  const result = dropCard(
    "sk_hallucination",
    hall.layout.x + 6,
    hall.layout.y - 14,
    scene,
    state,
  );
  unchangedIds(state, result.state, new Set(["skc9"]));
});

test("reroute failure does not drop the connection", () => {
  const { scene, state } = fixture();
  const broken = {
    ...state,
    byId: {
      ...state.byId,
      demo_c_cur: {
        ...state.byId.demo_c_cur!,
        points: [state.byId.demo_c_cur!.points[0]!],
      },
    },
  };
  const info = scene.graph.cards.find((c) => c.id === "demo_info")!;
  const result = applyIncrementalCardMove({
    previous: broken,
    cards: applyCardPositionToGraph(scene.graph, "demo_info", info.layout.x + 30, info.layout.y)
      .cards,
    connections: scene.graph.connections,
    topology: scene.routeTopology,
    movedCardId: "demo_info",
  });
  assert.ok(result.state.byId.demo_c_cur);
  assert.ok(result.state.byId.demo_c_cur.points.length >= 2);
});

test("lastValidRoute is kept on success and reused as the failure base", () => {
  const { scene, state } = fixture();
  const hall = scene.graph.cards.find((c) => c.id === "sk_hallucination")!;
  const result = dropCard(
    "sk_hallucination",
    hall.layout.x,
    hall.layout.y - 18,
    scene,
    state,
  );
  assert.deepEqual(
    result.state.lastValidPoints.skc9,
    result.state.byId.skc9!.points,
  );
  assert.ok(state.lastValidPoints.skc10);
  assert.equal(result.state.lastValidPoints.skc10, state.lastValidPoints.skc10);
});

test("collision then incremental keeps live pins exact", () => {
  const { scene, state } = fixture();
  const hall = scene.graph.cards.find((c) => c.id === "sk_hallucination")!;
  const delusion = scene.graph.cards.find((c) => c.id === "sk_delusion")!;
  const result = dropCard(
    "sk_hallucination",
    delusion.layout.x,
    delusion.layout.y,
    scene,
    state,
  );
  assert.ok(result.resolved.collided);
  pinExact(result.nextGraph.cards, result.state.byId.skc9!);
  assert.equal(
    collidingCards(
      result.nextGraph.cards.find((c) => c.id === hall.id)!.layout,
      result.nextGraph.cards
        .filter((c) => c.id !== hall.id)
        .map((c) => ({ id: c.id, ...c.layout })),
      CARD_MIN_GAP,
    ).length,
    0,
  );
});

test("collision then incremental changes only the affected routes", () => {
  const { scene, state } = fixture();
  const delusion = scene.graph.cards.find((c) => c.id === "sk_delusion")!;
  const result = dropCard(
    "sk_hallucination",
    delusion.layout.x,
    delusion.layout.y,
    scene,
    state,
  );
  const affected = new Set(
    collectAffectedConnectionIds({
      movedCardId: "sk_hallucination",
      cards: result.nextGraph.cards,
      connections: result.nextGraph.connections,
      topology: scene.routeTopology,
      previous: state,
    }),
  );
  unchangedIds(state, result.state, affected);
  assert.ok(affected.has("skc9"));
  assert.equal(affected.has("skc10"), false);
  assert.equal(affected.has("skc11"), false);
});

test("group drag translates Knowledge geometry by the same delta", () => {
  const { scene, state } = fixture();
  const start = scene.graph;
  const bbox = knowledgeGroupBounds(start.cards)!;
  const resolved = resolveGroupDropCollision({
    groupBounds: bbox,
    desiredDelta: { dx: 20, dy: 12 },
    externalCards: start.cards.filter((c) => c.cardType !== "knowledge"),
  });
  const nextGraph = applyKnowledgeGroupDelta(start, resolved.dx, resolved.dy);
  const nextTopo = translateKnowledgeTopology(
    scene.routeTopology!,
    start.connections,
    start.cards,
    resolved.dx,
    resolved.dy,
  );
  const moved = applyIncrementalGroupMove({
    previous: state,
    startCards: start.cards,
    cards: nextGraph.cards,
    connections: nextGraph.connections,
    topology: nextTopo,
    dx: resolved.dx,
    dy: resolved.dy,
  });
  const skc2 = moved.state.byId.skc2!;
  assert.deepEqual(
    skc2.points.map((p) => ({
      x: p.x - resolved.dx,
      y: p.y - resolved.dy,
    })),
    state.byId.skc2!.points,
  );
  assert.deepEqual(moved.state.byId.demo_c_cur!.points, state.byId.demo_c_cur!.points);
  assert.deepEqual(
    membershipSnapshot(nextTopo),
    membershipSnapshot(scene.routeTopology!),
  );
});

test("group drag keeps Knowledge shape and leaves other cards still", () => {
  const { scene } = fixture();
  const bbox = knowledgeGroupBounds(scene.graph.cards)!;
  const resolved = resolveGroupDropCollision({
    groupBounds: bbox,
    desiredDelta: { dx: 16, dy: -8 },
    externalCards: scene.graph.cards.filter((c) => c.cardType !== "knowledge"),
  });
  const next = applyKnowledgeGroupDelta(scene.graph, resolved.dx, resolved.dy);
  assert.equal(
    otherCardsUnchanged(
      scene.graph.cards,
      next.cards,
      new Set(scene.graph.cards.filter((c) => c.cardType === "knowledge").map((c) => c.id)),
    ),
    true,
  );
  const nextBbox = knowledgeGroupBounds(next.cards)!;
  assert.equal(nextBbox.width, bbox.width);
  assert.equal(nextBbox.height, bbox.height);
});

test("Junction membership is unchanged after an individual move", () => {
  const { scene, state } = fixture();
  const hall = scene.graph.cards.find((c) => c.id === "sk_hallucination")!;
  const result = dropCard(
    "sk_hallucination",
    hall.layout.x + 8,
    hall.layout.y - 12,
    scene,
    state,
  );
  assert.deepEqual(
    membershipSnapshot(result.topology!),
    membershipSnapshot(scene.routeTopology!),
  );
});

test("demo crossing geometry stays put when a Knowledge child moves", () => {
  const { scene, state } = fixture();
  const hall = scene.graph.cards.find((c) => c.id === "sk_hallucination")!;
  const result = dropCard(
    "sk_hallucination",
    hall.layout.x,
    hall.layout.y - 18,
    scene,
    state,
  );
  for (const id of Object.keys(state.byId).filter((key) => key.startsWith("demo_"))) {
    assert.deepEqual(result.state.byId[id]!.points, state.byId[id]!.points, id);
  }
});

test("route clearance stays a separate constant from card gap", () => {
  assert.equal(CARD_ROUTE_CLEARANCE, 12);
  assert.equal(CARD_MIN_GAP, 12);
});

test("DEV fixture workspace holds stable route state and does not regen fans", () => {
  const hook = readFileSync(
    new URL(
      "../../../components/v2/relatedDiagram/useCardInteraction.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const layer = readFileSync(
    new URL(
      "../../../components/v2/relatedDiagram/RelatedDiagramConnectionLayer.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const ws = readFileSync(
    new URL(
      "../../../components/v2/relatedDiagram/RelatedDiagramDevFixtureWorkspace.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.equal(hook.includes("regenerateExplicitTopologyGeometry"), false);
  assert.equal(hook.includes("geometryParams"), false);
  assert.ok(hook.includes("applyIncrementalCardMove"));
  assert.ok(hook.includes("resolveCardDropCollision"));
  assert.ok(layer.includes("stableRouteState"));
  assert.ok(layer.includes("stableRouteState"));
  assert.ok(ws.includes("seedStableRouteState"));
  assert.equal(ws.includes("captureTopologyGeometryParams"), false);
});

console.log(`\n${passed} passed`);
