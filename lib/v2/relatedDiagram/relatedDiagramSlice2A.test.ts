/**
 * Slice 2A routing / fixture / Frozen topology tests.
 * Run: npx tsx lib/v2/relatedDiagram/relatedDiagramSlice2A.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { A3_HEIGHT_PX, A3_WIDTH_PX } from "./a3Canvas";
import {
  applyCardPositionToGraph,
  isCardLayoutMovable,
  isCardSemanticLocked,
} from "./cardInteractionState";
import {
  overlayPreviewRoutes,
  previewIncidentOrthogonalRoutes,
} from "./dragRoutePreview";
import {
  SLICE2A_MOVABLE_DEMO_CARD_IDS,
  buildSchizophreniaKnowledgeGraph,
  buildSlice1StyleDemoGraph,
} from "./fixtures/schizophreniaPathophysiologyFixture";
import { buildSlice1DevRouteTopology } from "./fixtures/schizophreniaRouteTopology";
import {
  isOrthogonalPolyline,
  planOrthogonalRoutes,
} from "./orthogonalRouting";
import { resolveDevFixtureReadonlyScene } from "./resolveReadonlyScene";
import { junctionsFromTopology } from "./routeTopology";
import { getA3LegendBounds } from "./a3Legend";

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

test("DEV demo unlocks stay; Knowledge is layout-movable and semantically locked", () => {
  const demo = buildSlice1StyleDemoGraph();
  const knowledge = buildSchizophreniaKnowledgeGraph();
  assert.ok(SLICE2A_MOVABLE_DEMO_CARD_IDS.length >= 1);
  for (const id of SLICE2A_MOVABLE_DEMO_CARD_IDS) {
    const card = demo.cards.find((c) => c.id === id);
    assert.ok(card, id);
    assert.equal(isCardLayoutMovable(card!), true, id);
  }
  assert.ok(knowledge.cards.every((c) => isCardLayoutMovable(c)));
  assert.ok(knowledge.cards.every((c) => isCardSemanticLocked(c)));
  assert.ok(knowledge.cards.every((c) => c.isLocked));
  const lockedDemo = demo.cards.filter((c) => !isCardLayoutMovable(c));
  assert.ok(lockedDemo.some((c) => c.id.startsWith("demo_junc_")));
  assert.ok(lockedDemo.some((c) => c.id.startsWith("demo_cross_")));
});

test("drag preview only covers incident connections and stays orthogonal", () => {
  const demo = buildSlice1StyleDemoGraph();
  const moved = applyCardPositionToGraph(demo, "demo_info", 900, 120);
  const previews = previewIncidentOrthogonalRoutes(
    moved.cards,
    moved.connections,
    "demo_info",
  );
  assert.ok(previews.length >= 1);
  assert.ok(previews.every((r) => r.connectionId.startsWith("demo_")));
  assert.ok(
    previews.every(
      (r) => r.sourceCardId === "demo_info" || r.targetCardId === "demo_info",
    ),
  );
  assert.ok(previews.every((r) => isOrthogonalPolyline(r.points)));
  const knowledgeIds = new Set(
    buildSchizophreniaKnowledgeGraph().connections.map((c) => c.id),
  );
  assert.ok(previews.every((r) => !knowledgeIds.has(r.connectionId)));
});

test("drop後 orthogonal route follows the moved card; Knowledge authored unchanged", () => {
  const scene = resolveDevFixtureReadonlyScene({ includeStyleDemo: true });
  const before = planOrthogonalRoutes(scene.graph.cards, scene.graph.connections, {
    canvas: { x: 0, y: 0, width: A3_WIDTH_PX, height: A3_HEIGHT_PX },
    extraObstacles: [getA3LegendBounds()],
    topology: scene.routeTopology,
  });
  const moved = applyCardPositionToGraph(scene.graph, "demo_info", 980, 140);
  const after = planOrthogonalRoutes(moved.cards, moved.connections, {
    canvas: { x: 0, y: 0, width: A3_WIDTH_PX, height: A3_HEIGHT_PX },
    extraObstacles: [getA3LegendBounds()],
    topology: scene.routeTopology,
  });
  const beforeSkc20 = before.routes.find((r) => r.connectionId === "skc1");
  const afterSkc20 = after.routes.find((r) => r.connectionId === "skc1");
  assert.ok(beforeSkc20 && afterSkc20);
  assert.deepEqual(afterSkc20!.points, beforeSkc20!.points);

  const demoRoute = after.routes.find((r) => r.connectionId === "demo_c_cur");
  assert.ok(demoRoute);
  assert.ok(isOrthogonalPolyline(demoRoute!.points));
  const info = moved.cards.find((c) => c.id === "demo_info")!;
  const start = demoRoute!.points[0]!;
  const touchesInfo =
    Math.abs(start.x - info.layout.x) < 1 ||
    Math.abs(start.x - (info.layout.x + info.layout.width)) < 1 ||
    Math.abs(start.y - info.layout.y) < 1 ||
    Math.abs(start.y - (info.layout.y + info.layout.height)) < 1;
  assert.equal(touchesInfo, true);
});

test("Junction is not inferred from new geometry after a student card move", () => {
  const scene = resolveDevFixtureReadonlyScene({ includeStyleDemo: true });
  const topology = scene.routeTopology ?? buildSlice1DevRouteTopology();
  const explicit = junctionsFromTopology(topology);
  const moved = applyCardPositionToGraph(scene.graph, "demo_info", 400, 700);
  const plan = planOrthogonalRoutes(moved.cards, moved.connections, {
    canvas: { x: 0, y: 0, width: A3_WIDTH_PX, height: A3_HEIGHT_PX },
    extraObstacles: [getA3LegendBounds()],
    topology,
  });
  const keys = (list: { x: number; y: number; connectionIds: string[] }[]) =>
    list
      .map(
        (j) =>
          `${Math.round(j.x)}:${Math.round(j.y)}:${[...j.connectionIds].sort().join(",")}`,
      )
      .sort();
  assert.deepEqual(keys(plan.junctions), keys(explicit));
});

test("overlay preview does not rewrite Knowledge routes", () => {
  const scene = resolveDevFixtureReadonlyScene({ includeStyleDemo: true });
  const base = planOrthogonalRoutes(scene.graph.cards, scene.graph.connections, {
    canvas: { x: 0, y: 0, width: A3_WIDTH_PX, height: A3_HEIGHT_PX },
    topology: scene.routeTopology,
  });
  const moved = applyCardPositionToGraph(scene.graph, "demo_u_cur", 1100, 260);
  const previews = previewIncidentOrthogonalRoutes(
    moved.cards,
    moved.connections,
    "demo_u_cur",
  );
  const overlaid = overlayPreviewRoutes(base.routes, previews);
  const before = base.routes.find((r) => r.connectionId === "skc2");
  const after = overlaid.find((r) => r.connectionId === "skc2");
  assert.ok(before && after);
  assert.deepEqual(after!.points, before!.points);
});

test("selection ring is monochrome and not a semantic dashed/blue border", () => {
  const src = readFileSync(
    new URL(
      "../../../components/v2/relatedDiagram/RelatedDiagramCardNode.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.ok(src.includes('outline: selected ? "2px solid #8E8E93"'));
  assert.equal(src.includes("outline: selected ? \"2px dashed"), false);
  assert.equal(src.includes("outline: selected ? \"2px solid #0A5FCC"), false);
});

test("planner and preview use live cards; snapshot routingCards is gone", () => {
  const layer = readFileSync(
    new URL(
      "../../../components/v2/relatedDiagram/RelatedDiagramConnectionLayer.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const surface = readFileSync(
    new URL(
      "../../../components/v2/relatedDiagram/RelatedDiagramA3Surface.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const hook = readFileSync(
    new URL(
      "../../../components/v2/relatedDiagram/useCardInteraction.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.equal(layer.includes("routingCards"), false);
  assert.equal(surface.includes("routingCards"), false);
  assert.equal(hook.includes("routeBaseCards"), false);
  assert.equal(hook.includes("regenerateExplicitTopologyGeometry"), false);
  assert.ok(layer.includes("stableRouteState"));
  const demo = buildSlice1StyleDemoGraph();
  const moved = applyCardPositionToGraph(demo, "demo_info", 900, 120);
  const previews = previewIncidentOrthogonalRoutes(
    moved.cards,
    moved.connections,
    "demo_info",
  );
  const info = moved.cards.find((c) => c.id === "demo_info")!;
  assert.ok(previews.length >= 1);
  for (const route of previews) {
    const start = route.points[0]!;
    const end = route.points[route.points.length - 1]!;
    const src = moved.cards.find((c) => c.id === route.sourceCardId)!;
    const tgt = moved.cards.find((c) => c.id === route.targetCardId)!;
    const startOnSrc =
      Math.abs(start.x - src.layout.x) < 0.6 ||
      Math.abs(start.x - (src.layout.x + src.layout.width)) < 0.6 ||
      Math.abs(start.y - src.layout.y) < 0.6 ||
      Math.abs(start.y - (src.layout.y + src.layout.height)) < 0.6;
    const endOnTgt =
      Math.abs(end.x - tgt.layout.x) < 0.6 ||
      Math.abs(end.x - (tgt.layout.x + tgt.layout.width)) < 0.6 ||
      Math.abs(end.y - tgt.layout.y) < 0.6 ||
      Math.abs(end.y - (tgt.layout.y + tgt.layout.height)) < 0.6;
    assert.equal(startOnSrc, true, route.connectionId);
    assert.equal(endOnTgt, true, route.connectionId);
    assert.ok(route.sourceCardId === info.id || route.targetCardId === info.id);
  }
});

test("route debug overlay is DEV-gated and absent from student workspace", () => {
  const surface = readFileSync(
    new URL(
      "../../../components/v2/relatedDiagram/RelatedDiagramA3Surface.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const student = readFileSync(
    new URL(
      "../../../components/v2/relatedDiagram/RelatedDiagramReadonlyWorkspace.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const dev = readFileSync(
    new URL(
      "../../../components/v2/relatedDiagram/RelatedDiagramDevFixtureWorkspace.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.ok(surface.includes("RelatedDiagramRouteDebugOverlay"));
  assert.ok(surface.includes("routeDebug || routeCost"));
  assert.ok(dev.includes('rdDebug'));
  assert.equal(student.includes("RelatedDiagramRouteDebugOverlay"), false);
  assert.equal(student.includes("routeDebug"), false);
  const overlay = readFileSync(
    new URL(
      "../../../components/v2/relatedDiagram/RelatedDiagramRouteDebugOverlay.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.ok(overlay.includes("endpoint-corridor"));
  assert.ok(overlay.includes("legend-obstacle"));
  assert.ok(overlay.includes("self-card-penetration"));
  assert.ok(dev.includes("rdRouteCost") || overlay.includes("route-cost"));
  assert.ok(overlay.includes("partitionDebugRoutes"));
  assert.ok(overlay.includes("dbg-valid-"));
  assert.ok(overlay.includes("dbg-invalid-"));
  assert.ok(overlay.includes("data-rd-debug-kind"));
  assert.ok(overlay.includes("route-quality"));
  assert.ok(overlay.includes("formatQualityDebug"));
  assert.equal(overlay.includes("r={10}"), false);
  assert.equal(overlay.includes("[...plan.routes, ...plan.invalidRoutes].map((route)"), false);
  assert.equal(overlay.includes("key={`dbg-${route.connectionId}`}"), false);
});

test("Slice 1 bridge renderer source is unchanged", () => {
  const src = readFileSync(
    new URL("./orthogonalRouting.ts", import.meta.url),
    "utf8",
  );
  assert.ok(src.includes("BRIDGE_RADIUS_PX = 10"));
  assert.ok(src.includes("buildOrthogonalHopArcs"));
  const layer = readFileSync(
    new URL(
      "../../../components/v2/relatedDiagram/RelatedDiagramConnectionLayer.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.ok(layer.includes("buildOrthogonalHopArcs"));
  assert.ok(layer.includes("data-rd-bridge-arc"));
  assert.ok(layer.includes("planConnectionBridgeVisual"));
  assert.equal(layer.includes("mask"), false);
});

console.log(`\n${passed} passed`);
