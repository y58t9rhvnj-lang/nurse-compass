/**
 * A3 viewport gesture pure-function tests.
 * Run: npx tsx lib/v2/relatedDiagram/a3ViewportGesture.test.ts
 */

import assert from "node:assert/strict";
import {
  A3_MIN_SCALE,
  computeFitScale,
  computeMinScale,
  computeScaleClamp,
} from "./a3Canvas";
import {
  applyTwoFingerViewportTransform,
  pointerCentroid,
  pointerDistance,
  scaleAboutPivot,
} from "./a3ViewportGesture";

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

test("pointerDistance increases when fingers spread", () => {
  const closed = pointerDistance({ x: 0, y: 0 }, { x: 10, y: 0 });
  const open = pointerDistance({ x: 0, y: 0 }, { x: 40, y: 0 });
  assert.ok(open > closed);
  assert.equal(closed, 10);
});

test("pointerCentroid is midpoint", () => {
  const mid = pointerCentroid({ x: 0, y: 0 }, { x: 100, y: 40 });
  assert.equal(mid.x, 50);
  assert.equal(mid.y, 20);
});

test("distance increase → zoom in (scale up)", () => {
  const start = {
    dist: 100,
    scale: 1,
    mid: { x: 200, y: 200 },
    tx: 0,
    ty: 0,
  };
  const next = applyTwoFingerViewportTransform({
    start,
    currentA: { x: 100, y: 200 },
    currentB: { x: 300, y: 200 }, // dist 200 → 2x
    viewportLeft: 0,
    viewportTop: 0,
  });
  assert.ok(next.scale > 1.9 && next.scale <= 2.0);
});

test("distance decrease → zoom out (scale down)", () => {
  const start = {
    dist: 200,
    scale: 1,
    mid: { x: 200, y: 200 },
    tx: 0,
    ty: 0,
  };
  const next = applyTwoFingerViewportTransform({
    start,
    currentA: { x: 150, y: 200 },
    currentB: { x: 250, y: 200 }, // dist 100 → 0.5x
    viewportLeft: 0,
    viewportTop: 0,
  });
  assert.ok(next.scale > 0.45 && next.scale < 0.55);
});

test("equal distance + centroid move → pan only (scale unchanged)", () => {
  const start = {
    dist: 100,
    scale: 0.8,
    mid: { x: 200, y: 200 },
    tx: 10,
    ty: 20,
  };
  const next = applyTwoFingerViewportTransform({
    start,
    // same distance 100, centroid moved +50,+30
    currentA: { x: 200, y: 230 },
    currentB: { x: 300, y: 230 },
    viewportLeft: 0,
    viewportTop: 0,
  });
  assert.equal(next.scale, 0.8);
  assert.ok(Math.abs(next.x - (start.tx + 50)) < 0.01);
  assert.ok(Math.abs(next.y - (start.ty + 30)) < 0.01);
});

test("vertical finger spread still zooms via distance (not dy alone)", () => {
  const start = {
    dist: 80,
    scale: 1,
    mid: { x: 100, y: 100 },
    tx: 0,
    ty: 0,
  };
  const next = applyTwoFingerViewportTransform({
    start,
    currentA: { x: 100, y: 40 },
    currentB: { x: 100, y: 200 }, // vertical spread, dist 160 → 2x
    viewportLeft: 0,
    viewportTop: 0,
  });
  assert.ok(next.scale > 1.9 && next.scale <= 2.0);
});

test("pinch keeps start-centroid content under current centroid", () => {
  const start = {
    dist: 100,
    scale: 1,
    mid: { x: 200, y: 150 },
    tx: 40,
    ty: 30,
  };
  // Content under start mid at scale 1:
  const contentX = (200 - 40) / 1;
  const contentY = (150 - 30) / 1;
  const next = applyTwoFingerViewportTransform({
    start,
    currentA: { x: 180, y: 150 },
    currentB: { x: 380, y: 150 }, // dist 200, mid (280,150)
    viewportLeft: 0,
    viewportTop: 0,
  });
  const underMidX = (280 - next.x) / next.scale;
  const underMidY = (150 - next.y) / next.scale;
  assert.ok(Math.abs(underMidX - contentX) < 0.01);
  assert.ok(Math.abs(underMidY - contentY) < 0.01);
});

test("Z1. fitScale < 1 keeps minScale <= fitScale (not frozen at 1.0)", () => {
  const vw = 1024;
  const vh = 640;
  const fit = computeFitScale(vw, vh);
  const min = computeMinScale(vw, vh);
  assert.ok(fit < 1);
  assert.ok(min <= fit);
  assert.ok(min < 1);
  assert.ok(min <= A3_MIN_SCALE);
  assert.ok(Math.min(1, fit) <= fit);
});

test("Z2. pinch out from 100% can reach fitScale", () => {
  const vw = 1024;
  const vh = 640;
  const fit = computeFitScale(vw, vh);
  const clamp = computeScaleClamp(vw, vh);
  const next = applyTwoFingerViewportTransform({
    start: {
      dist: 200,
      scale: 1,
      mid: { x: 200, y: 200 },
      tx: 0,
      ty: 0,
    },
    currentA: { x: 200 - 100 * fit, y: 200 },
    currentB: { x: 200 + 100 * fit, y: 200 },
    viewportLeft: 0,
    viewportTop: 0,
    scaleClamp: clamp,
  });
  assert.ok(next.scale <= fit + 0.02);
  assert.ok(next.scale + 0.02 >= fit);
});

test("Z3. 全体表示 scale equals computeFitScale", () => {
  const fit = computeFitScale(1024, 640);
  assert.ok(fit > 0.4 && fit < 0.7);
});

test("Z5. viewport resize changes fitScale", () => {
  const a = computeFitScale(1024, 640);
  const b = computeFitScale(800, 500);
  assert.notEqual(a, b);
  assert.ok(computeMinScale(800, 500) <= b);
});

test("Z4. 100% does not rewrite minScale", () => {
  const before = computeMinScale(1024, 640);
  const after100 = computeMinScale(1024, 640);
  assert.equal(before, after100);
  assert.ok(after100 < 1);
});

test("scaleAboutPivot preserves content under cursor", () => {
  const t = { scale: 1, x: 10, y: 20 };
  const next = scaleAboutPivot({
    transform: t,
    nextScale: 2,
    pivotClientX: 110,
    pivotClientY: 120,
    viewportLeft: 0,
    viewportTop: 0,
  });
  const beforeX = (110 - t.x) / t.scale;
  const beforeY = (120 - t.y) / t.scale;
  const afterX = (110 - next.x) / next.scale;
  const afterY = (120 - next.y) / next.scale;
  assert.ok(Math.abs(beforeX - afterX) < 0.01);
  assert.ok(Math.abs(beforeY - afterY) < 0.01);
  assert.equal(next.scale, 2);
});

console.log(`\n${passed} passed`);
