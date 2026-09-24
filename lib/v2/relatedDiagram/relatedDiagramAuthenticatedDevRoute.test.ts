/**
 * Authenticated DEV Student Editor route — source-scan only.
 * Run: ./node_modules/.bin/jiti lib/v2/relatedDiagram/relatedDiagramAuthenticatedDevRoute.test.ts
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

test("authenticated DEV page reuses the Student Editor workspace after requireRole", () => {
  const page = src("../../../app/v2/dev/related-diagram-slice1/page.tsx");
  assert.ok(page.includes('from "@/lib/v2/auth/currentUser"'));
  assert.ok(page.includes('requireRole("student")'));
  assert.ok(page.includes("await requireRole"));
  assert.ok(page.includes("process.env.NODE_ENV !== \"development\""));
  assert.ok(page.includes("notFound()"));
  assert.ok(
    page.includes(
      'from "@/components/v2/relatedDiagram/RelatedDiagramDevFixtureWorkspace"',
    ),
  );
  assert.ok(page.includes("<RelatedDiagramDevFixtureWorkspace />"));
  assert.equal(page.includes("RelatedDiagramReadonlyWorkspace"), false);
  assert.equal(page.includes("DEV_SLICE1_PERSIST_IDENTITY"), false);
  assert.equal(page.includes("createAdminSupabaseClient"), false);
  assert.equal(page.includes("SERVICE_ROLE"), false);
  assert.equal(page.includes("insertRelatedDiagram"), false);
  assert.equal(page.includes("updateRelatedDiagram"), false);
  assert.equal(page.includes("saveRelatedDiagramDraft"), false);
});

test("unauthenticated DEV page stays outside /v2 and is unchanged in role", () => {
  const page = src("../../../app/dev/related-diagram-slice1/page.tsx");
  assert.ok(
    page.includes(
      'from "@/components/v2/relatedDiagram/RelatedDiagramDevFixtureWorkspace"',
    ),
  );
  assert.ok(page.includes("<RelatedDiagramDevFixtureWorkspace />"));
  assert.equal(page.includes("requireRole"), false);
  assert.equal(page.includes("getCurrentProfile"), false);
});

test("proxy matcher, LoginForm, and Production readonly stay unchanged", () => {
  const proxy = src("../../../proxy.ts");
  assert.ok(proxy.includes('matcher: ["/v2", "/v2/:path*"]'));
  const login = src("../../../app/v2/login/LoginForm.tsx");
  assert.ok(login.includes('window.location.assign("/v2")'));
  assert.equal(login.includes("related-diagram-slice1"), false);
  const shell = src("../../../components/AppShell.tsx");
  assert.ok(shell.includes("RelatedDiagramReadonlyWorkspace"));
  assert.equal(shell.includes("RelatedDiagramDevFixtureWorkspace"), false);
  const student = src("../../../app/v2/student/page.tsx");
  assert.ok(student.includes('requireRole("student")'));
  assert.equal(student.includes("RelatedDiagramDevFixtureWorkspace"), false);
});

console.log(`\n${passed} passed`);
