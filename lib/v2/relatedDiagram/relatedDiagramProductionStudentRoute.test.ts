/**
 * Production Student Editor connection — source-scan only.
 * Run: ./node_modules/.bin/jiti lib/v2/relatedDiagram/relatedDiagramProductionStudentRoute.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  SCHIZOPHRENIA_FIXTURE_VERSION,
  SCHIZOPHRENIA_KNOWLEDGE_CARDS,
  SCHIZOPHRENIA_KNOWLEDGE_CONNECTIONS,
} from "./fixtures/schizophreniaPathophysiologyFixture";
import { buildSchizophreniaKnowledgeTopology } from "./fixtures/schizophreniaRouteTopology";

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

test("A Production page reuses Student Editor after requireRole(student)", () => {
  const page = src("../../../app/v2/student/related-diagram/page.tsx");
  const editor = src(
    "../../../components/v2/relatedDiagram/RelatedDiagramStudentEditor.tsx",
  );
  assert.ok(page.includes('from "@/lib/v2/auth/currentUser"'));
  assert.ok(page.includes('requireRole("student")'));
  assert.ok(page.includes("await requireRole"));
  assert.ok(
    page.includes(
      'from "@/components/v2/relatedDiagram/RelatedDiagramStudentEditor"',
    ),
  );
  assert.ok(page.includes("<RelatedDiagramStudentEditor form3Model={form3Model} />"));
  assert.ok(page.includes("getForm3"));
  assert.ok(page.includes("studentForm3ReadModelFromRecord"));
  assert.ok(page.includes("caseIdForPatient"));
  assert.ok(page.includes("createServerSupabaseClient"));
  assert.ok(page.includes('export const dynamic = "force-dynamic"'));
  assert.equal(page.includes("RelatedDiagramReadonlyWorkspace"), false);
  assert.equal(page.includes("RelatedDiagramDevFixtureWorkspace"), false);
  assert.equal(page.includes("buildSchizophreniaForm3ReadModel"), false);
  assert.equal(page.includes("notFound()"), false);
  assert.equal(page.includes("NODE_ENV"), false);
  assert.equal(editor.includes('from "./RelatedDiagramDevFixtureWorkspace"'), true);
  assert.ok(editor.includes("form3Model"));
  assert.equal(editor.includes("buildSchizophreniaForm3ReadModel"), false);
  assert.equal(
    /export \{ default \} from "\.\/RelatedDiagramDevFixtureWorkspace"/.test(editor),
    false,
  );
});

test("B unauthenticated cannot open Production Editor", () => {
  const page = src("../../../app/v2/student/related-diagram/page.tsx");
  const auth = src("../auth/currentUser.ts");
  const proxy = src("../../../proxy.ts");
  assert.ok(page.includes('requireRole("student")'));
  assert.ok(auth.includes("export async function requireRole"));
  assert.ok(auth.includes("const profile = await requireUser()"));
  assert.ok(auth.includes('if (!profile || !profile.isActive) redirect("/v2/login")'));
  assert.ok(proxy.includes('matcher: ["/v2", "/v2/:path*"]'));
});

test("C non-student cannot open Production Editor", () => {
  const page = src("../../../app/v2/student/related-diagram/page.tsx");
  const auth = src("../auth/currentUser.ts");
  assert.ok(page.includes('requireRole("student")'));
  assert.ok(auth.includes('if (!roles.includes(profile.role)) redirect("/v2")'));
  assert.equal(page.includes("requireRole(\"teacher\")"), false);
  assert.equal(page.includes("requireRole(\"admin\")"), false);
});

test("D left-menu 関連図 points at Production route, not DEV", () => {
  const nav = src("../../../components/SideNav.tsx");
  const shell = src("../../../components/AppShell.tsx");
  assert.ok(nav.includes('href: "/v2/student/related-diagram"'));
  assert.ok(shell.includes('router.push("/v2/student/related-diagram")'));
  assert.ok(shell.includes("?.href"));
  assert.equal(nav.includes("/v2/dev/related-diagram"), false);
  assert.equal(nav.includes("/dev/related-diagram"), false);
  assert.equal(shell.includes("/v2/dev/related-diagram"), false);
});

test("E 関連図 is immediately under 様式3 and not duplicated", () => {
  const nav = src("../../../components/SideNav.tsx");
  const studentBlock = nav.slice(
    nav.indexOf("export const STUDENT_NAV_ITEMS"),
    nav.indexOf("export default function SideNav"),
  );
  const form3 = studentBlock.indexOf('label: "様式3"');
  const related = studentBlock.indexOf('label: "関連図"');
  const submissions = studentBlock.indexOf('label: "提出"');
  assert.ok(form3 >= 0);
  assert.ok(related > form3);
  assert.ok(submissions > related);
  assert.equal(studentBlock.split('label: "関連図"').length - 1, 1);
  const between = studentBlock.slice(form3, related);
  assert.equal(between.includes('label: "提出"'), false);
  assert.equal(between.includes('label: "フィードバック"'), false);
});

test("F empty record seeds Frozen Initial Knowledge V1 (no style demo)", () => {
  const ws = src(
    "../../../components/v2/relatedDiagram/RelatedDiagramDevFixtureWorkspace.tsx",
  );
  const persist = src("./relatedDiagramDraftPersistence.ts");
  assert.ok(ws.includes("includeStyleDemo: false"));
  assert.ok(ws.includes("loadRelatedDiagramDraft"));
  assert.ok(ws.includes('if (result.kind === "empty")'));
  assert.ok(ws.includes('setPersistSource("seed")'));
  assert.ok(persist.includes('kind: "empty"'));
  assert.ok(persist.includes('source: "seed"'));
  assert.ok(persist.includes("graph: input.seed.graph"));
});

test("G existing record restores saved semanticGraph + routeScene", () => {
  const ws = src(
    "../../../components/v2/relatedDiagram/RelatedDiagramDevFixtureWorkspace.tsx",
  );
  const persist = src("./relatedDiagramDraftPersistence.ts");
  assert.ok(ws.includes("setGraph(result.graph)"));
  assert.ok(ws.includes("setRouteState(result.routeState)"));
  assert.ok(ws.includes("setTopology(result.topology)"));
  assert.ok(persist.includes('kind: "restored"'));
  assert.ok(persist.includes("restoreRouteScene"));
});

test("H seed does not overwrite a saved record", () => {
  const persist = src("./relatedDiagramDraftPersistence.ts");
  const persistTest = src("./relatedDiagramDraftPersistence.test.ts");
  const loadStart = persist.indexOf("export async function loadRelatedDiagramDraft");
  const saveStart = persist.indexOf("export async function saveRelatedDiagramDraft");
  const loadBody = persist.slice(loadStart, saveStart);
  assert.ok(loadBody.includes("if (!got.row)"));
  assert.ok(loadBody.includes("graph: input.seed.graph"));
  assert.equal(loadBody.includes("store.insert"), false);
  assert.equal(loadBody.includes("store.update"), false);
  assert.ok(persistTest.includes("I optimistic conflict keeps local state / no overwrite"));
});

test("I Initial Knowledge V1 is unchanged", () => {
  const fixture = src("./fixtures/schizophreniaPathophysiologyFixture.ts");
  const topology = buildSchizophreniaKnowledgeTopology();
  assert.equal(SCHIZOPHRENIA_FIXTURE_VERSION, "dev.fixture.2026.3");
  assert.equal(SCHIZOPHRENIA_KNOWLEDGE_CARDS.length, 16);
  assert.equal(SCHIZOPHRENIA_KNOWLEDGE_CONNECTIONS.length, 15);
  assert.equal(topology.routes.length, 15);
  assert.equal(
    SCHIZOPHRENIA_KNOWLEDGE_CONNECTIONS.some((c) => c.id === "skc1"),
    true,
  );
  assert.ok(SCHIZOPHRENIA_KNOWLEDGE_CARDS.some((c) => c.id === "sk_disease"));
  assert.ok(fixture.includes('cardType: "knowledge"'));
  assert.equal(fixture.includes("includeStyleDemo: true"), false);
});

test("J Persistence contract files are the frozen student path", () => {
  const action = src("../../../app/v2/actions/relatedDiagramDraft.ts");
  const persist = src("./relatedDiagramDraftPersistence.ts");
  const repo = src("./relatedDiagramRepository.ts");
  const page = src("../../../app/v2/student/related-diagram/page.tsx");
  assert.ok(action.includes("async function requireStudentContext"));
  assert.ok(action.includes("getCurrentProfile"));
  assert.ok(action.includes("createServerSupabaseClient"));
  assert.ok(action.includes("insertRelatedDiagram"));
  assert.ok(action.includes("updateRelatedDiagramWithVersion"));
  assert.ok(persist.includes("export async function loadRelatedDiagramDraft"));
  assert.ok(repo.includes("export async function getRelatedDiagram"));
  assert.equal(action.includes("createAdminSupabaseClient"), false);
  assert.equal(action.includes("SERVICE_ROLE"), false);
  assert.equal(page.includes("insertRelatedDiagram"), false);
  assert.equal(page.includes("updateRelatedDiagram"), false);
  assert.equal(page.includes("saveRelatedDiagramDraft"), false);
  assert.equal(page.includes("DEV_SLICE1_PERSIST_IDENTITY"), false);
  assert.equal(page.includes("createAdminSupabaseClient"), false);
  assert.equal(page.includes("SERVICE_ROLE"), false);
});

test("K readonly architecture remains; menu destination is Production Editor", () => {
  const readonly = src(
    "../../../components/v2/relatedDiagram/RelatedDiagramReadonlyWorkspace.tsx",
  );
  const shell = src("../../../components/AppShell.tsx");
  const student = src("../../../app/v2/student/page.tsx");
  const devAuth = src("../../../app/v2/dev/related-diagram-slice1/page.tsx");
  const devUnauth = src("../../../app/dev/related-diagram-slice1/page.tsx");
  const preview = src("../../../app/dev/related-diagram-knowledge-preview/page.tsx");
  assert.ok(readonly.includes("RelatedDiagramReadonlyWorkspace"));
  assert.ok(shell.includes("RelatedDiagramReadonlyWorkspace"));
  assert.ok(shell.includes("activeView === \"related-diagram\""));
  assert.equal(shell.includes("RelatedDiagramDevFixtureWorkspace"), false);
  assert.equal(shell.includes("RelatedDiagramStudentEditor"), false);
  assert.ok(student.includes('requireRole("student")'));
  assert.equal(student.includes("RelatedDiagramDevFixtureWorkspace"), false);
  assert.ok(devAuth.includes("RelatedDiagramDevFixtureWorkspace"));
  assert.ok(devAuth.includes('process.env.NODE_ENV !== "development"'));
  assert.ok(devUnauth.includes("RelatedDiagramDevFixtureWorkspace"));
  assert.ok(preview.length > 0);
});

test("back A-I toolbar 戻る matches Form2/3 and goes to /v2/student", () => {
  const toolbar = src(
    "../../../components/v2/relatedDiagram/RelatedDiagramEditorToolbar.tsx",
  );
  const ws = src(
    "../../../components/v2/relatedDiagram/RelatedDiagramDevFixtureWorkspace.tsx",
  );
  const formShell = src("../../../components/v2/workspace/FormWorkspaceShell.tsx");
  const form2 = src("../../../components/v2/workspace/Form2Workspace.tsx");
  const form3 = src("../../../components/v2/form3/Form3PhaseBWorkspace.tsx");
  const left = toolbar.slice(
    toolbar.indexOf("data-rd-toolbar-left"),
    toolbar.indexOf("data-rd-toolbar-title"),
  );
  assert.ok(left.includes('data-rd-back'));
  assert.ok(left.includes('aria-label="戻る"'));
  assert.ok(left.includes(">戻る<"));
  assert.ok(left.indexOf("data-rd-back") < left.indexOf("data-rd-form3-open"));
  assert.ok(left.indexOf("data-rd-form3-open") < left.indexOf("data-rd-add-card"));
  assert.ok(left.includes("data-rd-undo"));
  assert.ok(left.includes("data-rd-redo"));
  assert.ok(left.includes("data-rd-save"));
  assert.ok(toolbar.includes("data-rd-zoom-percent"));
  assert.ok(toolbar.includes("全体表示"));
  assert.ok(toolbar.includes("印刷"));
  const formBackClass =
    'inline-flex h-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center gap-0.5 rounded-xl px-2 text-[15px] font-semibold text-[#0A6CD6] hover:bg-[#F2F2F7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A6CD6]';
  assert.ok(formShell.includes(formBackClass));
  assert.ok(toolbar.includes(formBackClass));
  assert.ok(formShell.includes("ChevronLeft"));
  assert.ok(toolbar.includes("ChevronLeft"));
  assert.ok(form2.includes("requestWorkspaceBack"));
  assert.ok(form3.includes("requestWorkspaceBack"));
  assert.ok(ws.includes("requestWorkspaceBack"));
  assert.ok(ws.includes('router.push("/v2/student")'));
  assert.ok(ws.includes('persistStatus === "unsaved"'));
  assert.ok(ws.includes('kind: "draft"'));
  assert.ok(ws.includes('kind: "saved"'));
  assert.ok(ws.includes("onBack={handleBack}"));
  assert.equal(ws.includes("history.back"), false);
  assert.equal(ws.includes("location.assign"), false);
  assert.equal(toolbar.includes("/v2/dev/related-diagram"), false);
  assert.equal(ws.includes('router.push("/v2/dev'), false);
  assert.equal(ws.includes('router.push("/v2")'), false);
});

console.log(`\n${passed} passed`);
