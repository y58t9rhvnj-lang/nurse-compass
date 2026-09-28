/**
 * Patient-top center links: 様式2 card removed; other Form2 entries stay.
 * Run: ./node_modules/.bin/jiti components/v2/student-shell/studentPatientTopLinks.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

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

function src(rel: string): string {
  return readFileSync(new URL(rel, import.meta.url), "utf8");
}

test("patient top center no longer offers 様式2", () => {
  const top = src("./StudentPatientTop.tsx");
  assert.equal(top.includes('title="様式2"'), false);
  assert.equal(top.includes("集めた情報を様式2へ整理する"), false);
  assert.ok(top.includes('title="電子カルテ"'));
  assert.ok(top.includes('title="会話"'));
});

test("left-menu 様式2 and Form2 workspace stay", () => {
  const nav = src("../../SideNav.tsx");
  const start = nav.indexOf("export const STUDENT_NAV_ITEMS");
  const items = nav.slice(start, nav.indexOf("export default function SideNav"));
  assert.ok(items.includes('label: "様式2"'));
  assert.ok(items.includes('view: "clinical-workspace"'));
  assert.ok(items.includes('label: "患者トップ"'));
  const ws = src("../workspace/Form2Workspace.tsx");
  assert.ok(ws.includes("export default function Form2Workspace"));
});

console.log(`\n${passed} passed`);
