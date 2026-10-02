/**
 * Free canvas persist labels.
 * Run: ./node_modules/.bin/jiti lib/v2/freeCanvas/freeCanvasDisplay.test.ts
 */

import assert from "node:assert/strict";
import { freeCanvasPersistLabel } from "./freeCanvasDisplay";

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

test("persist labels cover save states", () => {
  assert.equal(freeCanvasPersistLabel("unsaved"), "未保存");
  assert.equal(freeCanvasPersistLabel("saving"), "保存中…");
  assert.equal(freeCanvasPersistLabel("saved"), "保存済み");
  assert.equal(freeCanvasPersistLabel("conflict"), "他の場所で更新されています");
  assert.equal(freeCanvasPersistLabel("error"), "保存できませんでした");
});

console.log(`\n${passed} passed`);
