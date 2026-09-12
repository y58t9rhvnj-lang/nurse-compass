/**
 * Slice 1 fixture / scene builder tests (DEV fixtures only).
 * Run: npx tsx lib/v2/relatedDiagram/relatedDiagramSlice1Fixture.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { A3_BODY_PT, A3_HEIGHT_PX, A3_WIDTH_PX, computeFitScale } from "./a3Canvas";
import {
  buildSchizophreniaKnowledgeGraph,
  buildSlice1ReadonlySceneGraph,
  buildSlice1StyleDemoGraph,
  KNOWLEDGE_CARD_HEIGHT_SHORT,
  KNOWLEDGE_CARD_PADDING_X,
  KNOWLEDGE_CARD_PADDING_Y,
  KNOWLEDGE_CARD_WIDTH,
  SCHIZOPHRENIA_FIXTURE_VERSION,
  SLICE1_CANVAS_META,
} from "./fixtures/schizophreniaPathophysiologyFixture";
import {
  analyzeRouteMeetings,
  isOrthogonalPolyline,
  planOrthogonalRoutes,
} from "./orthogonalRouting";
import { resolveConnectionStrokeVisual } from "./visualStyle";
import {
  resolveDevFixtureReadonlyScene,
  resolveReadonlySceneFromKnowledgeBinding,
} from "./resolveReadonlyScene";
import {
  buildSchizophreniaKnowledgeTopology,
  buildSlice1DemoTopology,
  buildSlice1DevRouteTopology,
} from "./fixtures/schizophreniaRouteTopology";

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

test("A3 logical size is landscape", () => {
  assert.ok(A3_WIDTH_PX > A3_HEIGHT_PX);
  assert.ok(A3_WIDTH_PX > 1400);
});

test("fit scale clamps sensibly", () => {
  const s = computeFitScale(800, 600);
  assert.ok(s > 0 && s <= 1);
});

test("schizophrenia knowledge fixture has pathology density", () => {
  const g = buildSchizophreniaKnowledgeGraph();
  assert.ok(g.cards.length >= 10);
  assert.ok(g.connections.length >= 10);
  assert.ok(g.cards.every((c) => c.cardType === "knowledge"));
  assert.ok(g.cards.every((c) => c.state === null));
  assert.ok(g.nursingProblems.length === 0);
});

test("style demo covers card and connection relation types", () => {
  const g = buildSlice1StyleDemoGraph();
  const types = new Set(g.cards.map((c) => c.cardType));
  assert.ok(types.has("information"));
  assert.ok(types.has("understanding"));
  assert.ok(types.has("nursing_problem"));
  const rels = new Set(g.connections.map((c) => c.relationType));
  assert.ok(rels.has("current"));
  assert.ok(rels.has("potential"));
  assert.ok(rels.has("treatment"));
  assert.ok(rels.has("nursing_problem_basis"));
  assert.ok(rels.has("nursing_problem_integration"));
});

test("DEV merged scene keeps knowledge + demo (preview/test only)", () => {
  const scene = buildSlice1ReadonlySceneGraph();
  assert.ok(scene.cards.some((c) => c.id.startsWith("sk_")));
  assert.ok(scene.cards.some((c) => c.id.startsWith("demo_")));
  assert.equal(SLICE1_CANVAS_META.knowledgeVersion, SCHIZOPHRENIA_FIXTURE_VERSION);
  assert.equal(SLICE1_CANVAS_META.source, "dev_fixture");
});

test("student knowledge binding scene never includes style demo", () => {
  const foundation = buildSchizophreniaKnowledgeGraph();
  const scene = resolveReadonlySceneFromKnowledgeBinding({
    foundation,
    knowledgeTitle: "published knowledge",
    knowledgeVersion: "1.0.0",
  });
  assert.equal(scene.source, "knowledge_binding");
  assert.equal(scene.includesStyleDemo, false);
  assert.ok(scene.graph.cards.every((c) => c.cardType === "knowledge"));
  assert.ok(!scene.graph.cards.some((c) => c.id.startsWith("demo_")));
  assert.equal(scene.graph.nursingProblems.length, 0);
});

test("student runtime source never imports development fixture fallback", () => {
  const actionSrc = readFileSync(
    new URL("../../../app/v2/actions/relatedDiagramReadonly.ts", import.meta.url),
    "utf8",
  );
  const workspaceSrc = readFileSync(
    new URL(
      "../../../components/v2/relatedDiagram/RelatedDiagramReadonlyWorkspace.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  for (const [name, src] of [
    ["action", actionSrc],
    ["workspace", workspaceSrc],
  ] as const) {
    assert.equal(
      src.includes("schizophreniaPathophysiologyFixture"),
      false,
      `${name} must not import schizophrenia fixture`,
    );
    assert.equal(
      src.includes("resolveDevFixtureReadonlyScene"),
      false,
      `${name} must not call DEV fixture resolver`,
    );
    assert.equal(
      src.includes("buildSlice1StyleDemoGraph"),
      false,
      `${name} must not merge style demo`,
    );
    assert.equal(
      src.includes("buildSlice1ReadonlySceneGraph"),
      false,
      `${name} must not use merged DEV scene`,
    );
  }
  assert.ok(actionSrc.includes('status: "empty"'));
  assert.ok(actionSrc.includes("load_error"));
  assert.ok(
    actionSrc.includes("この事例には病態関連図が設定されていません。"),
  );
});

test("DEV fixture helper can omit style demo (foundation-only preview)", () => {
  const scene = resolveDevFixtureReadonlyScene({ includeStyleDemo: false });
  assert.equal(scene.source, "dev_fixture");
  assert.equal(scene.includesStyleDemo, false);
  assert.ok(scene.graph.cards.every((c) => c.cardType === "knowledge"));
});

test("all DEV card positions stay within A3 bounds", () => {
  const scene = buildSlice1ReadonlySceneGraph();
  for (const c of scene.cards) {
    assert.ok(c.layout.x >= 0, c.id);
    assert.ok(c.layout.y >= 0, c.id);
    assert.ok(c.layout.x + c.layout.width <= A3_WIDTH_PX + 1, c.id);
    assert.ok(c.layout.y + c.layout.height <= A3_HEIGHT_PX + 1, c.id);
  }
});

test("DEV crossing fixture is one simple solid-H × dashed-V", () => {
  const demo = buildSlice1StyleDemoGraph();
  const h = demo.connections.find((c) => c.id === "demo_c_cross_h");
  const v = demo.connections.find((c) => c.id === "demo_c_cross_v");
  assert.ok(h && v);
  assert.equal(h!.relationType, "current");
  assert.equal(v!.relationType, "potential");
});

test("DEV connections stay monochrome; hop overlay is solid", () => {
  const demo = buildSlice1StyleDemoGraph();
  for (const c of demo.connections) {
    const visual = resolveConnectionStrokeVisual(c.relationType);
    assert.equal(visual.stroke, "#1D1D1F", c.id);
  }
  const layerSrc = readFileSync(
    new URL(
      "../../../components/v2/relatedDiagram/RelatedDiagramConnectionLayer.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.equal(layerSrc.includes("#0A5FCC"), false);
  assert.ok(layerSrc.includes("data-rd-bridge-arc"));
  assert.ok(layerSrc.includes("buildOrthogonalHopArcs"));
});

test("Knowledge topology authors orthogonal shared trunks and branch points", () => {
  const topology = buildSchizophreniaKnowledgeTopology();
  assert.equal(topology.branchPoints.length, 5);
  assert.equal(topology.trunks.length, 5);
  assert.equal(topology.routeGroups.length, 5);
  assert.equal(topology.routes.length, 16);
  for (const route of topology.routes) {
    assert.equal(isOrthogonalPolyline(route.points), true, route.connectionId);
    assert.ok(route.points.length >= 2, route.connectionId);
  }
  assert.deepEqual(
    topology.routeGroups.map((g) => g.id),
    ["rg_patho_core", "rg_nt_imbalance", "rg_positive", "rg_cognitive", "rg_negative"],
  );
  assert.deepEqual(topology.trunks.find((t) => t.id === "tr_patho_core")?.connectionIds, [
    "skc2",
    "skc3",
  ]);
  assert.deepEqual(topology.trunks.find((t) => t.id === "tr_nt_imbalance")?.connectionIds, [
    "skc6",
    "skc7",
    "skc8",
  ]);
  assert.deepEqual(topology.trunks.find((t) => t.id === "tr_positive")?.connectionIds, [
    "skc9",
    "skc10",
    "skc11",
  ]);
  assert.deepEqual(topology.trunks.find((t) => t.id === "tr_cognitive")?.connectionIds, [
    "skc14",
    "skc15",
  ]);
  assert.deepEqual(topology.trunks.find((t) => t.id === "tr_negative")?.connectionIds, [
    "skc12",
    "skc13",
  ]);
  const skc12 = topology.routes.find((r) => r.connectionId === "skc12");
  const negBp = topology.branchPoints.find((b) => b.id === "bp_negative");
  assert.ok(negBp);
  assert.ok(
    skc12?.points.some(
      (p) =>
        Math.abs(p.x - negBp!.x) < 1 && Math.abs(p.y - negBp!.y) < 1,
    ),
  );
  const g = buildSchizophreniaKnowledgeGraph();
  const plan = planOrthogonalRoutes(g.cards, g.connections, { topology });
  const analyzed = analyzeRouteMeetings(plan.routes, g.cards, topology);
  assert.equal(analyzed.intentionalJunctionCount, 5);
  assert.equal(analyzed.independentCrossingCount, analyzed.bridgeCount);
  assert.equal(analyzed.bridgeCount, plan.bridges.length);
  assert.equal(analyzed.independentCrossingCount, 1);
  assert.equal(analyzed.bridgeCount, 1);
  const posIds = new Set(["skc9", "skc10", "skc11"]);
  const negIds = new Set(["skc12", "skc13"]);
  const br = plan.bridges[0]!;
  assert.ok(
    (posIds.has(br.jumperConnectionId) && negIds.has(br.underConnectionId)) ||
      (negIds.has(br.jumperConnectionId) && posIds.has(br.underConnectionId)),
  );
  for (const m of analyzed.meetings) {
    if (m.classifiedAs === "independent") assert.equal(m.hasBridge, true);
    if (m.classifiedAs === "junction") assert.equal(m.hasBridge, false);
  }
  console.log(
    `  knowledge explicitJunctions=${analyzed.intentionalJunctionCount} independent=${analyzed.independentCrossingCount} bridges=${analyzed.bridgeCount}`,
  );
});

test("D6. Knowledge fixture independent crossings all get bridges", () => {
  const g = buildSchizophreniaKnowledgeGraph();
  const topology = buildSchizophreniaKnowledgeTopology();
  const plan = planOrthogonalRoutes(g.cards, g.connections, { topology });
  const analyzed = analyzeRouteMeetings(plan.routes, g.cards, topology);
  assert.equal(analyzed.independentCrossingCount, analyzed.bridgeCount);
  assert.equal(analyzed.bridgeCount, plan.bridges.length);
  for (const m of analyzed.meetings) {
    if (m.classifiedAs === "independent") assert.equal(m.hasBridge, true);
    if (m.classifiedAs === "junction") assert.equal(m.hasBridge, false);
  }
});

test("DEV fixture has junction fan and independent crossing", () => {
  const demo = buildSlice1StyleDemoGraph();
  assert.ok(demo.cards.some((c) => c.id === "demo_junc_a"));
  assert.ok(demo.connections.some((c) => c.id === "demo_c_junc_b"));
  assert.ok(demo.connections.some((c) => c.id === "demo_c_junc_c"));
  assert.ok(demo.connections.some((c) => c.id === "demo_c_junc_d"));
  const topology = buildSlice1DemoTopology();
  const plan = planOrthogonalRoutes(demo.cards, demo.connections, { topology });
  const juncIds = new Set(["demo_c_junc_b", "demo_c_junc_c", "demo_c_junc_d"]);
  assert.equal(
    plan.bridges.filter(
      (b) => juncIds.has(b.jumperConnectionId) && juncIds.has(b.underConnectionId),
    ).length,
    0,
    "junction fan must not hop",
  );
  assert.ok(
    plan.bridges.some(
      (b) =>
        (b.jumperConnectionId === "demo_c_cross_v" &&
          b.underConnectionId === "demo_c_cross_h") ||
        (b.jumperConnectionId === "demo_c_cross_h" &&
          b.underConnectionId === "demo_c_cross_v"),
    ),
    "independent crossing must hop",
  );
});

test("DEV scene attaches merged route topology", () => {
  const scene = resolveDevFixtureReadonlyScene({ includeStyleDemo: true });
  assert.ok(scene.routeTopology);
  const merged = buildSlice1DevRouteTopology();
  assert.equal(scene.routeTopology!.branchPoints.length, merged.branchPoints.length);
  const student = resolveReadonlySceneFromKnowledgeBinding({
    foundation: buildSchizophreniaKnowledgeGraph(),
    knowledgeTitle: "published knowledge",
    knowledgeVersion: "1.0.0",
  });
  assert.equal(student.routeTopology, undefined);
});

test("toolbar stays outside the canvas transform subtree", () => {
  const toolbarSrc = readFileSync(
    new URL(
      "../../../components/v2/relatedDiagram/RelatedDiagramWorkspaceToolbar.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.ok(toolbarSrc.includes("data-rd-toolbar"));
  assert.ok(toolbarSrc.includes("data-rd-toolbar-row"));
  assert.ok(toolbarSrc.includes("h-[52px]"));
  assert.ok(toolbarSrc.includes("sticky top-0 z-50"));
  assert.equal(toolbarSrc.includes("flex-wrap"), false);
  assert.equal(toolbarSrc.includes("translate("), false);
  assert.equal(toolbarSrc.includes("scale("), false);
  for (const rel of [
    "../../../components/v2/relatedDiagram/RelatedDiagramDevFixtureWorkspace.tsx",
    "../../../components/v2/relatedDiagram/RelatedDiagramReadonlyWorkspace.tsx",
  ]) {
    const src = readFileSync(new URL(rel, import.meta.url), "utf8");
    const toolbarAt = src.indexOf("RelatedDiagramWorkspaceToolbar");
    const transformAt = src.indexOf("data-rd-canvas-transform");
    assert.ok(toolbarAt >= 0, rel);
    assert.ok(transformAt > toolbarAt, rel);
    assert.equal(src.includes("pointerHandlers"), false);
  }
  const hook = readFileSync(
    new URL(
      "../../../components/v2/relatedDiagram/useA3Viewport.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.equal(hook.includes("ge.scale"), false);
  assert.equal(hook.includes("safariPinch"), false);
  assert.ok(hook.includes("applyTwoFingerViewportTransform"));
});

test("Knowledge cards stay compact without clipping and keep 10.5pt", () => {
  const g = buildSchizophreniaKnowledgeGraph();
  assert.ok(g.cards.every((c) => c.layout.width === KNOWLEDGE_CARD_WIDTH));
  assert.ok(g.cards.every((c) => c.layout.height >= KNOWLEDGE_CARD_HEIGHT_SHORT));
  const linePx = A3_BODY_PT * (96 / 72) * 1.35;
  const labelPx = 20;
  const chrome =
    KNOWLEDGE_CARD_PADDING_Y * 2 + 3 + labelPx;
  for (const c of g.cards) {
    const inner = c.layout.width - KNOWLEDGE_CARD_PADDING_X * 2 - 3;
    const lines = Math.max(1, Math.ceil((c.text.length * 14) / inner));
    const need = chrome + lines * linePx;
    assert.ok(
      need <= c.layout.height + 1,
      `${c.id} may clip: need ${need.toFixed(1)} have ${c.layout.height}`,
    );
  }
  for (let i = 0; i < g.cards.length; i++) {
    for (let j = i + 1; j < g.cards.length; j++) {
      const a = g.cards[i]!.layout;
      const b = g.cards[j]!.layout;
      const overlap =
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y;
      assert.equal(overlap, false, `${g.cards[i]!.id} overlaps ${g.cards[j]!.id}`);
    }
  }
  const cardSrc = readFileSync(
    new URL(
      "../../../components/v2/relatedDiagram/RelatedDiagramCardNode.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.ok(cardSrc.includes("A3_BODY_PT"));
  assert.ok(cardSrc.includes('"5px 7px"'));
  assert.ok(cardSrc.includes('"6px 8px"'));
  assert.equal(A3_BODY_PT, 10.5);
  assert.equal(cardSrc.includes("transform: scale"), false);
});

test("DEV demo card sizes are unchanged", () => {
  const demo = buildSlice1StyleDemoGraph();
  const byId = new Map(demo.cards.map((c) => [c.id, c.layout]));
  assert.deepEqual(byId.get("demo_info"), {
    x: A3_WIDTH_PX - 360,
    y: 80,
    width: 180,
    height: 72,
    zIndex: 1,
  });
  assert.deepEqual(byId.get("demo_u_cur"), {
    x: A3_WIDTH_PX - 360,
    y: 200,
    width: 180,
    height: 72,
    zIndex: 1,
  });
  assert.deepEqual(byId.get("demo_u_pot"), {
    x: A3_WIDTH_PX - 360,
    y: 320,
    width: 180,
    height: 72,
    zIndex: 1,
  });
  assert.deepEqual(byId.get("demo_np"), {
    x: A3_WIDTH_PX - 360,
    y: 460,
    width: 200,
    height: 78,
    zIndex: 1,
  });
  assert.deepEqual(byId.get("demo_np2"), {
    x: A3_WIDTH_PX - 360,
    y: 580,
    width: 200,
    height: 78,
    zIndex: 1,
  });
  assert.deepEqual(byId.get("demo_treat_src"), {
    x: A3_WIDTH_PX - 620,
    y: 200,
    width: 160,
    height: 64,
    zIndex: 1,
  });
  assert.deepEqual(byId.get("demo_junc_a"), {
    x: 60,
    y: 820,
    width: 88,
    height: 44,
    zIndex: 1,
  });
  assert.deepEqual(byId.get("demo_cross_h1"), {
    x: 860,
    y: 740,
    width: 88,
    height: 44,
    zIndex: 1,
  });
});

console.log(`\n${passed} passed`);
