/**
 * Slice 2A A3 clamp + Legend nudge tests.
 * Run: npx tsx lib/v2/relatedDiagram/a3CardBoundary.test.ts
 */

import assert from "node:assert/strict";
import { A3_HEIGHT_PX, A3_WIDTH_PX } from "./a3Canvas";
import {
  clampCardToA3,
  nudgeCardOffLegend,
  resolveCardDropPosition,
} from "./a3CardBoundary";
import { getA3LegendBounds, rectIntersectsA3Legend } from "./a3Legend";

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

test("A3 clamp keeps the full card inside the canvas", () => {
  const w = 180;
  const h = 72;
  const left = clampCardToA3({ x: -40, y: 10, width: w, height: h });
  assert.equal(left.x, 0);
  assert.equal(left.y, 10);
  const right = clampCardToA3({
    x: A3_WIDTH_PX + 80,
    y: A3_HEIGHT_PX + 40,
    width: w,
    height: h,
  });
  assert.equal(right.x, A3_WIDTH_PX - w);
  assert.equal(right.y, A3_HEIGHT_PX - h);
});

test("Legend drop nudge pushes the card off the reserved rect", () => {
  const legend = getA3LegendBounds();
  const covering = {
    x: legend.x + 8,
    y: legend.y + 8,
    width: 180,
    height: 72,
  };
  assert.equal(rectIntersectsA3Legend(covering), true);
  const nudged = nudgeCardOffLegend(covering);
  assert.equal(rectIntersectsA3Legend(nudged), false);
});

test("drop resolve never leaves a card fully covering the legend", () => {
  const legend = getA3LegendBounds();
  const covering = {
    x: legend.x,
    y: legend.y,
    width: legend.width,
    height: legend.height,
  };
  const dropped = resolveCardDropPosition(covering);
  assert.equal(rectIntersectsA3Legend(dropped), false);
  assert.ok(dropped.x >= 0);
  assert.ok(dropped.y >= 0);
  assert.ok(dropped.x + dropped.width <= A3_WIDTH_PX);
  assert.ok(dropped.y + dropped.height <= A3_HEIGHT_PX);
});

console.log(`\n${passed} passed`);
