/**
 * Slice 2B-1 UI / student-boundary / drawer isolation tests.
 * Run: npx tsx lib/v2/relatedDiagram/relatedDiagramSlice2B1.test.ts
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

test("DEV workspace wires Form3 drawer without replacing the A3 canvas", () => {
  const ws = src("../../../components/v2/relatedDiagram/RelatedDiagramDevFixtureWorkspace.tsx");
  assert.ok(ws.includes("RelatedDiagramForm3Drawer"));
  assert.ok(ws.includes("data-rd-form3-open"));
  assert.ok(ws.includes("handleAddInformation"));
  assert.ok(ws.includes("handleAddAssessmentSelection"));
  assert.ok(ws.includes("editedText: compose.editedText"));
  assert.ok(ws.includes("state: compose.state"));
  assert.ok(ws.includes('type: "addCard"'));
  assert.ok(ws.includes('type: "deleteCard"'));
  assert.ok(ws.includes("selectCard"));
  assert.ok(ws.includes("placeForm3UnderstandingCard"));
  assert.ok(ws.includes("seedStableRouteState"));
  assert.ok(ws.includes("applyIncrementalCardMove") === false);
  assert.ok(ws.includes("data-rd-canvas-transform"));
  assert.ok(ws.includes('style={{ touchAction: "none" }}'));
});

test("Drawer uses pattern tabs, mode switch, and isolates canvas touch", () => {
  const drawer = src("../../../components/v2/relatedDiagram/RelatedDiagramForm3Drawer.tsx");
  assert.ok(drawer.includes('data-rd-form3-drawer'));
  assert.ok(drawer.includes('data-rd-form3-pattern-tabs'));
  assert.ok(drawer.includes('data-rd-form3-mode'));
  assert.ok(drawer.includes("情報"));
  assert.ok(drawer.includes("アセスメント"));
  assert.ok(drawer.includes('width: "min(420px, 42vw)"'));
  assert.ok(drawer.includes('touchAction: "pan-y"'));
  assert.ok(drawer.includes("overscrollBehavior"));
  assert.ok(drawer.includes("isolateDrawerPointer"));
  assert.ok(drawer.includes("stopPropagation"));
  assert.equal(drawer.includes("event.preventDefault"), false);
  assert.ok(drawer.includes("min-h-[44px]"));
  assert.ok(drawer.includes("関連図に追加"));
  assert.ok(drawer.includes("選択部分を関連図に追加"));
  assert.ok(drawer.includes("追加済み"));
  assert.ok(drawer.includes("様式3を閉じる"));
  assert.equal(drawer.includes("space-y-1"), false);
  assert.ok(drawer.includes("data-rd-form3-compose"));
  assert.ok(drawer.includes("カードを作成"));
  assert.ok(drawer.includes("引用した部分"));
  assert.ok(drawer.includes("カードに表示する内容"));
  assert.ok(drawer.includes("createAssessmentComposeDraft"));
  assert.ok(drawer.includes("canCommitAssessmentCompose"));
  assert.ok(drawer.includes("data-rd-form3-compose-cancel"));
  assert.ok(drawer.includes("キャンセル"));
  assert.ok(drawer.includes("顕在"));
  assert.ok(drawer.includes("潜在"));
  assert.ok(drawer.includes("このアセスメントで根拠にした情報"));
  assert.ok(drawer.includes("data-rd-form3-evidence-candidates"));
  assert.ok(drawer.includes("data-rd-form3-add-evidence-candidate"));
  assert.ok(drawer.includes("onAddInformation={onAddInformation}"));
  assert.equal(drawer.includes("upsertConnection"), false);
  assert.equal(drawer.includes("2パターン"), false);
  assert.equal(drawer.includes("patternKeys.length > 1"), false);
});

test("iPad compose textarea is isolated from canvas pan/drag", () => {
  const drawer = src("../../../components/v2/relatedDiagram/RelatedDiagramForm3Drawer.tsx");
  assert.ok(drawer.includes("data-rd-form3-compose-text"));
  assert.ok(drawer.includes("fontSize: 16"));
  assert.ok(drawer.includes("minHeight: 88"));
  assert.ok(drawer.includes('touchAction: "auto"'));
  assert.ok(drawer.includes("isolateDrawerPointer"));
  assert.ok(drawer.includes("setCompose(null)"));
  assert.equal(drawer.includes("preventDefault"), false);
});

test("iPad native selection is enabled on Assessment text", () => {
  const drawer = src("../../../components/v2/relatedDiagram/RelatedDiagramForm3Drawer.tsx");
  assert.ok(drawer.includes('data-rd-native-select="true"'));
  assert.ok(drawer.includes('userSelect: "text"'));
  assert.ok(drawer.includes('WebkitUserSelect: "text"'));
  assert.ok(drawer.includes('touchAction: "auto"'));
  assert.ok(drawer.includes("selectionFromWindow"));
  assert.ok(drawer.includes("selectionchange"));
  assert.ok(drawer.includes("data-rd-form3-selection-highlight"));
});

test("source trace opens the matching pattern / mode and does not route to Form3 edit", () => {
  const trace = src(
    "../../../components/v2/relatedDiagram/RelatedDiagramForm3SourceTrace.tsx",
  );
  const ws = src("../../../components/v2/relatedDiagram/RelatedDiagramDevFixtureWorkspace.tsx");
  assert.ok(trace.includes("元の様式3を見る"));
  assert.ok(trace.includes("状態："));
  assert.ok(trace.includes("引用："));
  assert.ok(trace.includes("カード："));
  assert.ok(ws.includes("form3SourceTrace"));
  assert.ok(ws.includes("handleOpenSource"));
  assert.ok(ws.includes("setDrawerMode(selectedForm3Source.kind)"));
  assert.ok(ws.includes("setHighlightRange"));
  assert.ok(ws.includes("RelatedDiagramCardDeleteConfirm"));
  assert.equal(ws.includes("RelatedDiagramForm3SourceTrace"), false);
  assert.equal(ws.includes("/v2/student"), false);
  assert.equal(ws.includes("Form3PhaseBWorkspace"), false);
});

test("student runtime stays read-only and does not mount the Form3 drawer", () => {
  const student = src(
    "../../../components/v2/relatedDiagram/RelatedDiagramReadonlyWorkspace.tsx",
  );
  const boundary = src("./studentForm3RelatedDiagramBoundary.ts");
  assert.equal(student.includes("RelatedDiagramForm3Drawer"), false);
  assert.equal(student.includes("onUndo"), false);
  assert.equal(student.includes("関連図に追加"), false);
  assert.ok(student.includes("編集不可"));
  assert.ok(boundary.includes("STUDENT_RELATED_DIAGRAM_UNSAVED_EDITING = false"));
});

test("Form3 and Form2 source files are not rewritten by this slice", () => {
  const mapper = src("../../form3/v2/form3V2Mapper.ts");
  const workspace = src("../../../components/v2/form3/Form3PhaseBWorkspace.tsx");
  assert.ok(mapper.includes("rowToForm3SnapshotV2"));
  assert.ok(workspace.includes("Form3PhaseBWorkspace"));
});

console.log(`\n${passed} passed`);
