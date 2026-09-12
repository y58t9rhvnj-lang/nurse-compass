/**
 * A3 legend bounds / non-semantic aid tests.
 * Run: npx tsx lib/v2/relatedDiagram/a3Legend.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { A3_HEIGHT_PX, A3_WIDTH_PX } from "./a3Canvas";
import {
  a3LegendAreaRatio,
  getA3LegendBounds,
  rectIntersectsA3Legend,
} from "./a3Legend";
import {
  buildSlice1ReadonlySceneGraph,
  buildSlice1StyleDemoGraph,
  buildSchizophreniaKnowledgeGraph,
} from "./fixtures/schizophreniaPathophysiologyFixture";
import { resolveReadonlySceneFromKnowledgeBinding } from "./resolveReadonlyScene";

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

test("Legend is not in semantic graph", () => {
  const scene = buildSlice1ReadonlySceneGraph();
  assert.ok(!scene.cards.some((c) => c.id.includes("legend")));
  assert.ok(!scene.connections.some((c) => c.id.includes("legend")));
  const student = resolveReadonlySceneFromKnowledgeBinding({
    foundation: buildSchizophreniaKnowledgeGraph(),
    knowledgeTitle: "k",
    knowledgeVersion: "1",
  });
  assert.ok(!student.graph.cards.some((c) => c.id.includes("legend")));
  assert.equal(student.includesStyleDemo, false);
});

test("Legend bounds stay inside A3 with margin and do not clip", () => {
  const b = getA3LegendBounds();
  assert.ok(b.x > A3_WIDTH_PX * 0.6);
  assert.ok(b.y > A3_HEIGHT_PX * 0.6);
  assert.ok(b.x >= 14);
  assert.ok(b.y >= 14);
  assert.ok(b.x + b.width <= A3_WIDTH_PX - 14);
  assert.ok(b.y + b.height <= A3_HEIGHT_PX - 14);
  assert.ok(a3LegendAreaRatio() < 0.04);
  assert.ok(b.width * b.height < 236 * 268);
  const src = readFileSync(
    new URL(
      "../../../components/v2/relatedDiagram/RelatedDiagramLegend.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.ok(src.includes("width: bounds.width"));
  assert.ok(src.includes("height: bounds.height"));
  assert.ok(src.includes("overflow"));
  assert.ok(src.includes("治療"));
  assert.ok(src.includes('kind="current"'));
  assert.ok(src.includes('kind="potential"'));
  assert.ok(src.includes('kind="treatment"'));
});

test("Legend reserved rect helper", () => {
  const b = getA3LegendBounds();
  assert.equal(rectIntersectsA3Legend(b), true);
  assert.equal(rectIntersectsA3Legend({ x: 0, y: 0, width: 10, height: 10 }), false);
});

test("Legend UI is A3-local, not screen-fixed", () => {
  const src = readFileSync(
    new URL(
      "../../../components/v2/relatedDiagram/RelatedDiagramLegend.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.ok(src.includes('data-rd-legend'));
  assert.ok(src.includes("absolute"));
  assert.equal(src.includes("fixed"), false);
  assert.ok(src.includes("data-rd-legend-card-sample"));
  assert.ok(src.includes("data-rd-legend-line-sample"));
  assert.ok(src.includes("関連図の見方"));
  assert.ok(src.includes('kind="current"'));
  assert.ok(src.includes('kind="potential"'));
  assert.ok(src.includes('kind="treatment"'));
  assert.ok(src.includes("顕在"));
  assert.ok(src.includes("潜在"));
  assert.ok(src.includes("看護問題"));
  assert.ok(src.includes("治療"));
  assert.equal(src.includes('kind="basis"'), false);
  assert.equal(src.includes('kind="integration"'), false);
  assert.equal(src.includes('data-rd-legend-integration-mark="diamond"'), false);
  assert.equal(src.includes('kind="bridge"'), false);
  assert.equal(src.includes("交差は接続を意味しません"), false);
  assert.equal(src.includes("交差＝接続ではない"), false);
  assert.equal(src.includes("患者情報"), false);
  assert.equal(src.includes("病態"), false);
  assert.ok(src.includes("data-rd-legend-print"));
});

test("Legend is mounted on A3 surface (print + pan/zoom)", () => {
  const src = readFileSync(
    new URL(
      "../../../components/v2/relatedDiagram/RelatedDiagramA3Surface.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.ok(src.includes("RelatedDiagramLegend"));
  assert.equal(src.includes("position: fixed"), false);
});

test("DEV style demo includes crossing pair; student path does not", () => {
  const demo = buildSlice1StyleDemoGraph();
  assert.ok(demo.cards.some((c) => c.id === "demo_cross_h1"));
  assert.ok(demo.connections.some((c) => c.id === "demo_c_cross_v"));
  assert.ok(demo.cards.some((c) => c.id === "demo_junc_a"));
  const student = resolveReadonlySceneFromKnowledgeBinding({
    foundation: buildSchizophreniaKnowledgeGraph(),
    knowledgeTitle: "k",
    knowledgeVersion: "1",
  });
  assert.ok(!student.graph.cards.some((c) => c.id.startsWith("demo_")));
});

console.log(`\n${passed} passed`);
