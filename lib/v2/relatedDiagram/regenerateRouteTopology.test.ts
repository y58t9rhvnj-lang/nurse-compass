/**
 * Explicit topology geometry regeneration tests (Slice 2A Knowledge move).
 * Run: npx tsx lib/v2/relatedDiagram/regenerateRouteTopology.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { A3_HEIGHT_PX, A3_WIDTH_PX } from "./a3Canvas";
import { applyCardPositionToGraph } from "./cardInteractionState";
import { applyKnowledgeGroupDelta } from "./knowledgeGroupLayout";
import { getA3LegendBounds } from "./a3Legend";
import {
  isOrthogonalPolyline,
  planOrthogonalRoutes,
} from "./orthogonalRouting";
import {
  captureTopologyGeometryParams,
  regenerateExplicitTopologyGeometry,
  topologyMembershipSnapshot,
  translateKnowledgeTopology,
} from "./regenerateRouteTopology";
import { junctionsFromTopology } from "./routeTopology";
import { resolveDevFixtureReadonlyScene } from "./resolveReadonlyScene";
import { buildSchizophreniaKnowledgeGraph } from "./fixtures/schizophreniaPathophysiologyFixture";

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

function scene() {
  const s = resolveDevFixtureReadonlyScene({ includeStyleDemo: true });
  assert.ok(s.routeTopology);
  const params = captureTopologyGeometryParams(
    s.routeTopology!,
    s.graph.cards,
    s.graph.connections,
  );
  return { ...s, params, topology: s.routeTopology! };
}

function regen(
  s: ReturnType<typeof scene>,
  cards = s.graph.cards,
  topology = s.topology,
) {
  return regenerateExplicitTopologyGeometry({
    topology,
    cards,
    connections: s.graph.connections,
    geometryParams: s.params,
  });
}

function keys(
  list: { x: number; y: number; connectionIds: string[] }[],
) {
  return list
    .map(
      (j) =>
        `${j.connectionIds.slice().sort().join(",")}`,
    )
    .sort();
}

test("identity regen keeps membership, edges, and orthogonal routes", () => {
  const s = scene();
  const next = regen(s);
  assert.deepEqual(
    topologyMembershipSnapshot(next),
    topologyMembershipSnapshot(s.topology),
  );
  for (const route of next.routes) {
    assert.ok(isOrthogonalPolyline(route.points), route.connectionId);
  }
});

test("source move follows standard-fan branch point; other cards stay", () => {
  const s = scene();
  const before = s.graph.cards.find((c) => c.id === "sk_da")!;
  const moved = applyCardPositionToGraph(s.graph, "sk_patho_core", 360, 80);
  assert.equal(
    moved.cards.find((c) => c.id === "sk_da")!.layout.x,
    before.layout.x,
  );
  assert.equal(
    moved.cards.find((c) => c.id === "demo_info")!.layout.x,
    A3_WIDTH_PX - 360,
  );
  const next = regen(s, moved.cards);
  const src = moved.cards.find((c) => c.id === "sk_patho_core")!;
  const fan = s.params.fans.find((f) => f.groupId === "rg_patho_core")!;
  const bp = next.branchPoints.find((b) => b.id === "bp_patho_core")!;
  const pinX = src.layout.x + src.layout.width / 2;
  const pinY = src.layout.y + src.layout.height;
  const expectedX = pinX + fan.branchOffsetFromSourcePin.x;
  const expectedY = pinY + fan.branchOffsetFromSourcePin.y;
  const followed =
    Math.abs(bp.x - expectedX) < 0.6 && Math.abs(bp.y - expectedY) < 0.6;
  const pushedOutward = bp.y >= expectedY - 0.6;
  assert.ok(followed || pushedOutward, "branch follows source or clears cards");
  assert.ok(Math.abs(bp.x - expectedX) < 48);
});

test("child move leaves standard-fan branch point in place", () => {
  const s = scene();
  const bp0 = s.topology.branchPoints.find((b) => b.id === "bp_positive")!;
  const moved = applyCardPositionToGraph(s.graph, "sk_hallucination", 20, 500);
  const next = regen(s, moved.cards);
  const bp1 = next.branchPoints.find((b) => b.id === "bp_positive")!;
  assert.ok(Math.abs(bp1.x - bp0.x) < 0.6);
  assert.ok(Math.abs(bp1.y - bp0.y) < 0.6);
  const route = next.routes.find((r) => r.connectionId === "skc9")!;
  const card = moved.cards.find((c) => c.id === "sk_hallucination")!;
  const end = route.points[route.points.length - 1]!;
  assert.ok(Math.abs(end.x - (card.layout.x + card.layout.width / 2)) < 1);
  assert.ok(Math.abs(end.y - card.layout.y) < 1);
});

test("1:1 route endpoints follow both cards; membership unchanged", () => {
  const s = scene();
  const moved = applyCardPositionToGraph(s.graph, "sk_disease", 40, 30);
  const next = regen(s, moved.cards);
  const route = next.routes.find((r) => r.connectionId === "skc1")!;
  assert.equal(route.sourceEdge, "right");
  assert.equal(route.targetEdge, "left");
  const src = moved.cards.find((c) => c.id === "sk_disease")!;
  const start = route.points[0]!;
  assert.ok(Math.abs(start.x - (src.layout.x + src.layout.width)) < 1);
  assert.deepEqual(
    topologyMembershipSnapshot(next).routes.find((r) => r.connectionId === "skc1"),
    topologyMembershipSnapshot(s.topology).routes.find(
      (r) => r.connectionId === "skc1",
    ),
  );
});

test("negative fan keeps crossing interior and does not reset rail to 12 after translate", () => {
  const s = scene();
  const translated = translateKnowledgeTopology(
    s.topology,
    s.graph.connections,
    s.graph.cards,
    40,
    0,
  );
  const movedGraph = applyKnowledgeGroupDelta(s.graph, 40, 0);
  const childMoved = applyCardPositionToGraph(
    movedGraph,
    "sk_avolition",
    260,
    600,
  );
  const next = regen(s, childMoved.cards, translated);
  const trunk = next.trunks.find((t) => t.id === "tr_negative")!;
  const railX = Math.min(...trunk.points.map((p) => p.x));
  assert.ok(railX > 20, `rail should follow group, got ${railX}`);
  const pos = childMoved.cards.find((c) => c.id === "sk_positive")!;
  const posX = pos.layout.x + pos.layout.width / 2;
  const horiz = [];
  for (let i = 1; i < trunk.points.length; i++) {
    const a = trunk.points[i - 1]!;
    const b = trunk.points[i]!;
    if (Math.abs(a.y - b.y) <= 0.6) horiz.push([a, b]);
  }
  assert.ok(horiz.length >= 1);
  const [h0, h1] = horiz[0]!;
  const lo = Math.min(h0.x, h1.x);
  const hi = Math.max(h0.x, h1.x);
  assert.ok(posX > lo + 1 && posX < hi - 1);
});

test("drop plan keeps explicit junctions; no geometry-inferred extras", () => {
  const s = scene();
  const moved = applyCardPositionToGraph(s.graph, "sk_nt_imbalance", 450, 190);
  const next = regen(s, moved.cards);
  const plan = planOrthogonalRoutes(moved.cards, moved.connections, {
    canvas: { x: 0, y: 0, width: A3_WIDTH_PX, height: A3_HEIGHT_PX },
    extraObstacles: [getA3LegendBounds()],
    topology: next,
  });
  assert.deepEqual(keys(plan.junctions), keys(junctionsFromTopology(next)));
  assert.ok(plan.bridges.length >= 1);
});

test("group translate applies one delta to Knowledge cards and topology points", () => {
  const s = scene();
  const dx = 18;
  const dy = 10;
  const g2 = applyKnowledgeGroupDelta(s.graph, dx, dy);
  const t2 = translateKnowledgeTopology(
    s.topology,
    s.graph.connections,
    s.graph.cards,
    dx,
    dy,
  );
  for (const c of s.graph.cards.filter((x) => x.cardType === "knowledge")) {
    const after = g2.cards.find((x) => x.id === c.id)!;
    assert.equal(after.layout.x, c.layout.x + dx);
    assert.equal(after.layout.y, c.layout.y + dy);
  }
  const patient = s.graph.cards.find((c) => c.id === "demo_info")!;
  assert.equal(g2.cards.find((c) => c.id === "demo_info")!.layout.x, patient.layout.x);
  const bp0 = s.topology.branchPoints.find((b) => b.id === "bp_nt_imbalance")!;
  const bp1 = t2.branchPoints.find((b) => b.id === "bp_nt_imbalance")!;
  assert.equal(bp1.x, bp0.x + dx);
  assert.equal(bp1.y, bp0.y + dy);
  const demoBp = t2.branchPoints.find((b) => b.id === "bp_demo_junc")!;
  const demoBp0 = s.topology.branchPoints.find((b) => b.id === "bp_demo_junc")!;
  assert.equal(demoBp.x, demoBp0.x);
  const r0 = s.topology.routes.find((r) => r.connectionId === "skc2")!;
  const r1 = t2.routes.find((r) => r.connectionId === "skc2")!;
  assert.equal(r1.points[0]!.x, r0.points[0]!.x + dx);
});

test("Knowledge semantic fields stay frozen after layout regen", () => {
  const g = buildSchizophreniaKnowledgeGraph();
  const card = g.cards[0]!;
  const moved = applyCardPositionToGraph(g, card.id, card.layout.x + 5, card.layout.y);
  const after = moved.cards.find((c) => c.id === card.id)!;
  assert.equal(after.text, card.text);
  assert.equal(after.cardType, card.cardType);
  assert.equal(after.state, card.state);
  assert.equal(after.origin, card.origin);
  assert.equal(after.isLocked, true);
  assert.deepEqual(moved.connections, g.connections);
});

test("group handle / outline visuals are monochrome and not dashed", () => {
  const src = readFileSync(
    new URL(
      "../../../components/v2/relatedDiagram/RelatedDiagramA3Surface.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.ok(src.includes("data-rd-knowledge-group-handle"));
  assert.ok(src.includes("data-rd-knowledge-group-outline"));
  assert.ok(src.includes("2px solid #8E8E93"));
  assert.equal(src.includes("2px dashed"), false);
  assert.equal(src.includes("#0A5FCC"), false);
});

console.log(`\n${passed} passed`);
