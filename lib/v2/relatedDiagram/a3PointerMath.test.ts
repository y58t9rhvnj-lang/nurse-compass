/**
 * Slice 2A client ↔ logical coordinate tests.
 * Run: npx tsx lib/v2/relatedDiagram/a3PointerMath.test.ts
 */

import assert from "node:assert/strict";
import {
  clientDeltaToLogical,
  clientToLogical,
  logicalDragPosition,
} from "./a3PointerMath";

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

test("scale 0.4 / 1 / 1.5 drag delta = Δclient / scale", () => {
  const dx = 30;
  const dy = 12;
  const a = clientDeltaToLogical(dx, dy, 0.4);
  const b = clientDeltaToLogical(dx, dy, 1);
  const c = clientDeltaToLogical(dx, dy, 1.5);
  assert.equal(a.x, 75);
  assert.equal(a.y, 30);
  assert.equal(b.x, 30);
  assert.equal(b.y, 12);
  assert.equal(c.x, 20);
  assert.equal(c.y, 8);
});

test("logical drag does not add viewport translate to card x/y", () => {
  const next = logicalDragPosition(
    { x: 100, y: 80 },
    { x: 400, y: 300 },
    { x: 430, y: 300 },
    1,
  );
  assert.equal(next.x, 130);
  assert.equal(next.y, 80);
  const viaClient = clientToLogical(
    { x: 430, y: 300 },
    { x: 0, y: 0 },
    { scale: 1, x: 40, y: 20 },
  );
  assert.notEqual(viaClient.x, next.x);
});

test("same client delta yields larger logical move when zoomed out", () => {
  const start = { x: 200, y: 200 };
  const cur = { x: 240, y: 200 };
  const origin = { x: 50, y: 50 };
  const at52 = logicalDragPosition(origin, start, cur, 0.52);
  const at100 = logicalDragPosition(origin, start, cur, 1);
  assert.ok(at52.x - origin.x > at100.x - origin.x);
  assert.equal(at100.x, 90);
});

console.log(`\n${passed} passed`);
