/**
 * Knowledge group bbox / clamp tests.
 * Run: npx tsx lib/v2/relatedDiagram/knowledgeGroupLayout.test.ts
 */

import assert from "node:assert/strict";
import { A3_HEIGHT_PX, A3_WIDTH_PX } from "./a3Canvas";
import { getA3LegendBounds, rectIntersectsA3Legend } from "./a3Legend";
import {
  applyKnowledgeGroupDelta,
  clampGroupDelta,
  knowledgeGroupBounds,
  resolveGroupDropDelta,
} from "./knowledgeGroupLayout";
import { buildSchizophreniaKnowledgeGraph } from "./fixtures/schizophreniaPathophysiologyFixture";
import { buildSlice1StyleDemoGraph } from "./fixtures/schizophreniaPathophysiologyFixture";

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

test("bbox is computed from Knowledge cards only", () => {
  const g = buildSchizophreniaKnowledgeGraph();
  const demo = buildSlice1StyleDemoGraph();
  const merged = { ...g, cards: [...g.cards, ...demo.cards] };
  const box = knowledgeGroupBounds(merged.cards)!;
  const ks = g.cards;
  const minX = Math.min(...ks.map((c) => c.layout.x));
  const minY = Math.min(...ks.map((c) => c.layout.y));
  assert.equal(box.x, minX);
  assert.equal(box.y, minY);
  assert.ok(box.width < A3_WIDTH_PX);
});

test("group A3 clamp keeps the full Knowledge bbox inside", () => {
  const g = buildSchizophreniaKnowledgeGraph();
  const box = knowledgeGroupBounds(g.cards)!;
  const over = clampGroupDelta(box, 4000, 4000);
  assert.equal(box.x + over.dx + box.width, A3_WIDTH_PX);
  assert.equal(box.y + over.dy + box.height, A3_HEIGHT_PX);
});

test("group Legend drop does not fully cover the reserved rect", () => {
  const legend = getA3LegendBounds();
  const box = {
    x: legend.x,
    y: legend.y,
    width: legend.width,
    height: legend.height,
  };
  const delta = resolveGroupDropDelta(box, 0, 0);
  const next = {
    ...box,
    x: box.x + delta.dx,
    y: box.y + delta.dy,
  };
  assert.equal(rectIntersectsA3Legend(next), false);
});

test("group delta moves only Knowledge cards", () => {
  const g = buildSchizophreniaKnowledgeGraph();
  const demo = buildSlice1StyleDemoGraph();
  const merged = { ...g, cards: [...g.cards, ...demo.cards] };
  const info = merged.cards.find((c) => c.id === "demo_info")!;
  const next = applyKnowledgeGroupDelta(merged, 12, -8);
  assert.ok(
    next.cards
      .filter((c) => c.cardType === "knowledge")
      .every((c, i) => {
        const before = merged.cards.filter((x) => x.cardType === "knowledge")[i]!;
        return c.layout.x === before.layout.x + 12 && c.layout.y === before.layout.y - 8;
      }),
  );
  assert.equal(
    next.cards.find((c) => c.id === "demo_info")!.layout.x,
    info.layout.x,
  );
});

console.log(`\n${passed} passed`);
