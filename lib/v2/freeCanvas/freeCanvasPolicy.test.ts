/**
 * Free canvas policy.
 * Run: ./node_modules/.bin/jiti lib/v2/freeCanvas/freeCanvasPolicy.test.ts
 */

import assert from "node:assert/strict";
import {
  canManageFreeCanvas,
  defaultFreeCanvasTitle,
  validateFreeCanvasTitle,
} from "./freeCanvasPolicy";

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

test("only active students can manage free canvases", () => {
  assert.equal(canManageFreeCanvas("student", true), true);
  assert.equal(canManageFreeCanvas("student", false), false);
  assert.equal(canManageFreeCanvas("teacher", true), false);
  assert.equal(canManageFreeCanvas("admin", true), false);
  assert.equal(canManageFreeCanvas(null, true), false);
});

test("title must be non-blank and bounded", () => {
  assert.deepEqual(validateFreeCanvasTitle("  練習  "), { ok: true, title: "練習" });
  assert.equal(validateFreeCanvasTitle("   ").ok, false);
  assert.equal(validateFreeCanvasTitle("x".repeat(81)).ok, false);
  assert.equal(defaultFreeCanvasTitle(), "無題のキャンバス");
});

console.log(`\n${passed} passed`);
