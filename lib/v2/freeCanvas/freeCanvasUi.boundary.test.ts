/**
 * Free canvas UI contract (source scan).
 * Run: ./node_modules/.bin/jiti lib/v2/freeCanvas/freeCanvasUi.boundary.test.ts
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

const nav = src("../../../components/SideNav.tsx");
const listPage = src("../../../app/v2/student/canvases/page.tsx");
const editorPage = src("../../../app/v2/student/canvases/[id]/page.tsx");
const list = src("../../../components/v2/freeCanvas/FreeCanvasListClient.tsx");
const deleteConfirm = src("../../../components/v2/freeCanvas/FreeCanvasDeleteConfirm.tsx");
const workspace = src("../../../components/v2/freeCanvas/FreeCanvasWorkspace.tsx");
const relatedWs = src(
  "../../../components/v2/relatedDiagram/RelatedDiagramDevFixtureWorkspace.tsx",
);
const relatedPage = src("../../../app/v2/student/related-diagram/page.tsx");

test("left menu places 自由キャンバス immediately under 関連図", () => {
  const start = nav.indexOf("export const STUDENT_NAV_ITEMS");
  const items = nav.slice(start, nav.indexOf("export default function SideNav"));
  const related = items.indexOf('label: "関連図"');
  const free = items.indexOf('label: "自由キャンバス"');
  const submissions = items.indexOf('label: "提出"');
  assert.ok(related >= 0);
  assert.ok(free > related);
  assert.ok(submissions > free);
  assert.ok(items.includes('view: "free-canvas"'));
  assert.ok(items.includes('href: "/v2/student/canvases"'));
  const between = items.slice(related, free);
  assert.equal(between.includes('label: "提出"'), false);
  assert.equal(between.includes('label: "フィードバック"'), false);
  assert.equal(items.split('label: "自由キャンバス"').length - 1, 1);
});

test("student pages are list / new / re-edit only", () => {
  assert.ok(listPage.includes('requireRole("student")'));
  assert.ok(listPage.includes("FreeCanvasListClient"));
  assert.ok(editorPage.includes('requireRole("student")'));
  assert.ok(editorPage.includes("<FreeCanvasWorkspace canvasId={id} />"));
  assert.ok(list.includes("createFreeCanvasAction"));
  assert.ok(list.includes("renameFreeCanvasAction"));
  assert.ok(list.includes("deleteFreeCanvasAction"));
  assert.ok(list.includes("listFreeCanvasesAction"));
  assert.ok(list.includes("`/v2/student/canvases/${res.canvas.id}`"));
  assert.ok(list.includes("削除"));
  assert.ok(list.includes("FreeCanvasDeleteConfirm"));
  assert.ok(deleteConfirm.includes("「{title}」を削除します。"));
  assert.ok(deleteConfirm.includes("削除する"));
  assert.ok(deleteConfirm.includes("キャンセル"));
  assert.ok(deleteConfirm.includes('aria-label="閉じる"'));
  assert.ok(deleteConfirm.includes('if (event.key === "Escape")'));
  assert.ok(deleteConfirm.includes("onCancel"));
  assert.ok(deleteConfirm.includes("onConfirm"));
  assert.ok(workspace.includes("saveFreeCanvasAction"));
  assert.ok(workspace.includes("renameFreeCanvasAction"));
  assert.ok(workspace.includes("getFreeCanvasAction"));
  assert.ok(editorPage.includes("getFreeCanvasAction"));
  assert.ok(editorPage.includes("data-free-canvas-missing"));
  assert.ok(editorPage.includes("一覧へ戻る"));
  const missingPage = editorPage.slice(
    editorPage.indexOf("if (!loaded.ok)"),
    editorPage.indexOf("return <FreeCanvasWorkspace"),
  );
  assert.ok(missingPage.includes("data-free-canvas-missing"));
  assert.equal(missingPage.includes("FreeCanvasWorkspace"), false);
  assert.equal(missingPage.includes("RelatedDiagramA3Surface"), false);
  assert.ok(workspace.includes("data-free-canvas-missing"));
  assert.ok(workspace.includes("一覧へ戻る"));
  assert.equal(deleteConfirm.includes("deleteFreeCanvasAction"), false);
  const handleDelete = list.slice(
    list.indexOf("async function handleDelete()"),
    list.indexOf("return (", list.indexOf("async function handleDelete()")),
  );
  assert.ok(handleDelete.includes("if (deleteInFlightRef.current) return"));
  assert.ok(handleDelete.includes("deleteInFlightRef.current = true"));
  assert.ok(
    handleDelete.indexOf("deleteInFlightRef.current = true") <
      handleDelete.indexOf("await deleteFreeCanvasAction"),
  );
  assert.equal(handleDelete.split("deleteFreeCanvasAction").length - 1, 1);
  assert.ok(handleDelete.includes("} finally {"));
  assert.ok(handleDelete.includes("deleteInFlightRef.current = false"));
  const successTail = handleDelete.slice(handleDelete.indexOf("if (!res.ok)"));
  assert.ok(successTail.includes("setError(res.message)"));
  assert.equal(successTail.includes("setItems("), false);
  assert.ok(successTail.includes("await load()"));
  assert.equal(listPage.includes("requireRole(\"teacher\")"), false);
  assert.equal(editorPage.includes("requireRole(\"teacher\")"), false);
});

test("editor starts blank and reuses Patient A operation UI", () => {
  assert.ok(workspace.includes("createEmptySemanticGraph"));
  assert.ok(workspace.includes("RelatedDiagramA3Surface"));
  assert.ok(workspace.includes("useA3Viewport"));
  assert.ok(workspace.includes("useCardInteraction"));
  assert.ok(workspace.includes("useConnectionRouteInteraction"));
  assert.ok(workspace.includes("RelatedDiagramCardTypeChooser"));
  assert.ok(workspace.includes("RelatedDiagramDirectInsightDrawer"));
  assert.ok(workspace.includes("RelatedDiagramContextBar"));
  assert.ok(workspace.includes("RelatedDiagramRelationComposeBar"));
  assert.ok(workspace.includes("RelatedDiagramConnectionActionBar"));
  assert.ok(workspace.includes("commitDirectUnderstandingCreate"));
  assert.ok(workspace.includes("commitStudentConnectionCreate"));
  assert.ok(workspace.includes("undoDiagramHistory"));
  assert.ok(workspace.includes("redoDiagramHistory"));
  assert.ok(workspace.includes("showForm3={false}"));
  assert.ok(workspace.includes("onStartRename"));
  assert.ok(workspace.includes("白紙です"));
  const missingStart = workspace.indexOf("if (loadError)");
  const missing = workspace.slice(missingStart, workspace.indexOf("if (!hydrated)"));
  assert.ok(missingStart >= 0);
  assert.ok(missing.includes("data-free-canvas-missing"));
  assert.equal(missing.includes("RelatedDiagramA3Surface"), false);
  assert.equal(workspace.includes("getForm3"), false);
  assert.equal(workspace.includes("relatedDiagramDraft"), false);
  assert.equal(workspace.includes("SCHIZOPHRENIA"), false);
  assert.equal(workspace.includes("includeStyleDemo"), false);
  assert.equal(workspace.includes("caseIdForPatient"), false);
  assert.equal(workspace.includes("loadRelatedDiagramDraft"), false);
  assert.equal(workspace.includes("RelatedDiagramForm3Drawer"), false);
  assert.equal(workspace.includes("aria-label=\"キャンバス名\""), false);
});

test("Patient A related-diagram editor and page stay on their own save path", () => {
  assert.ok(relatedWs.includes("loadRelatedDiagramDraft"));
  assert.ok(relatedWs.includes("saveRelatedDiagramDraft"));
  assert.ok(relatedPage.includes("RelatedDiagramStudentEditor"));
  assert.ok(relatedPage.includes("getForm3"));
  assert.equal(relatedWs.includes("free_canvas_records"), false);
  assert.equal(relatedWs.includes("saveFreeCanvasAction"), false);
  assert.equal(relatedWs.includes("onStartRename"), false);
  assert.equal(relatedPage.includes("FreeCanvasWorkspace"), false);
});

console.log(`\n${passed} passed`);
