/**
 * Slice 2B-2C Editor UI / UX foundation tests.
 * Run: npx tsx lib/v2/relatedDiagram/relatedDiagramSlice2B2C.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { A3_HEIGHT_PX, A3_WIDTH_PX } from "./a3Canvas";
import { getCardActionCapabilities } from "./cardActionCapabilities";
import { getCardSourceCapabilities } from "./cardSourceCapabilities";
import {
  contextBarKindFromMode,
  truncateContextTitle,
} from "./editorContextBar";
import {
  EDITOR_ADD_CARD_PLACEHOLDER,
  EDITOR_CONTEXT_BAR_HEIGHT_PX,
  EDITOR_DRAWER_WIDTH,
  EDITOR_TOUCH_TARGET_PX,
  resolveRelatedDiagramEditorMode,
} from "./editorUiState";
import { emptyDiagramHistory, pushDiagramHistory } from "./diagramHistory";
import { buildSchizophreniaForm3ReadModel } from "./fixtures/form3AssessmentSourceFixture";
import {
  buildUnderstandingCardFromAssessmentSelection,
  form3SourceTrace,
  insertCardEntity,
} from "./form3ToUnderstandingCard";
import { createEmptySemanticGraph } from "./semanticGraph";
import { emptyDiagramSelection, selectionFromCardId } from "./diagramSelection";
import type {
  RelatedDiagramCard,
  RelatedDiagramCardOrigin,
  RelatedDiagramCardType,
} from "./types";

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

function card(input: {
  id: string;
  cardType: RelatedDiagramCardType;
  origin: RelatedDiagramCardOrigin;
  state: RelatedDiagramCard["state"];
  text?: string;
}): RelatedDiagramCard {
  return {
    id: input.id,
    cardType: input.cardType,
    text: input.text ?? input.id,
    state: input.state,
    origin: input.origin,
    layout: { x: 20, y: 30, width: 180, height: 72, zIndex: 1 },
    isLocked: false,
    createdAt: "2026-09-16T12:00:00.000Z",
    updatedAt: "2026-09-16T12:00:00.000Z",
  };
}

const info = card({
  id: "info1",
  cardType: "information",
  origin: "form3_information",
  state: null,
  text: "朝夕の服薬を看護師の声かけで内服できている。",
});
const understanding = card({
  id: "u1",
  cardType: "understanding",
  origin: "form3_assessment",
  state: "current",
  text: "作業記憶の低下",
});
const knowledge = card({
  id: "k1",
  cardType: "knowledge",
  origin: "knowledge_library",
  state: null,
  text: "ドパミン神経系の関与",
});
const noSource = card({
  id: "d1",
  cardType: "understanding",
  origin: "patient_information",
  state: "current",
  text: "直接メモ",
});

const ws = src(
  "../../../components/v2/relatedDiagram/RelatedDiagramDevFixtureWorkspace.tsx",
);
const toolbar = src(
  "../../../components/v2/relatedDiagram/RelatedDiagramEditorToolbar.tsx",
);
const bar = src(
  "../../../components/v2/relatedDiagram/RelatedDiagramContextBar.tsx",
);
const edit = src(
  "../../../components/v2/relatedDiagram/RelatedDiagramCardEditDrawer.tsx",
);
const form3 = src(
  "../../../components/v2/relatedDiagram/RelatedDiagramForm3Drawer.tsx",
);
const del = src(
  "../../../components/v2/relatedDiagram/RelatedDiagramCardDeleteConfirm.tsx",
);
const viewport = src("../../../components/v2/relatedDiagram/useA3Viewport.ts");

test("1 idle toolbar", () => {
  assert.equal(
    resolveRelatedDiagramEditorMode({
      selection: emptyDiagramSelection(),
      form3Open: false,
      editOpen: false,
      connecting: false,
    }),
    "idle",
  );
  assert.ok(toolbar.includes("様式3"));
  assert.ok(toolbar.includes("＋カード"));
  assert.ok(toolbar.includes("data-rd-undo"));
  assert.ok(toolbar.includes("data-rd-zoom-percent"));
  assert.ok(toolbar.includes("100%"));
  assert.ok(toolbar.includes("全体表示"));
  assert.ok(toolbar.includes("印刷"));
  assert.ok(toolbar.includes("関連図") === false || ws.includes('title="関連図"'));
  assert.ok(ws.includes('title="関連図"'));
  assert.ok(ws.includes("統合失調症の事例"));
});

test("2 Card selected Context Bar", () => {
  assert.equal(
    resolveRelatedDiagramEditorMode({
      selection: selectionFromCardId("u1"),
      form3Open: false,
      editOpen: false,
      connecting: false,
    }),
    "card_selected",
  );
  assert.ok(bar.includes('action="edit"'));
  assert.ok(bar.includes('action="connect"'));
  assert.ok(bar.includes('action="delete"'));
  assert.ok(ws.includes("RelatedDiagramContextBar"));
  assert.ok(ws.includes("RelatedDiagramActionPopover"));
});

test("3 Context Bar is overlay not document flow", () => {
  assert.equal(EDITOR_CONTEXT_BAR_HEIGHT_PX, 52);
  assert.ok(bar.includes("flex-nowrap"));
  const chrome = ws.slice(
    ws.indexOf("<RelatedDiagramEditorToolbar"),
    ws.indexOf("data-rd-viewport"),
  );
  assert.equal(chrome.includes("RelatedDiagramContextBar"), false);
  assert.equal(chrome.includes("RelatedDiagramRelationComposeBar"), false);
  assert.equal(bar.includes("basis-full"), false);
  assert.equal(ws.includes("RelatedDiagramForm3SourceTrace"), false);
});

test("4 long Card text truncation", () => {
  const long = "あ".repeat(80);
  assert.ok(truncateContextTitle(long, 40).endsWith("…"));
  assert.equal(truncateContextTitle(long, 40).length, 41);
  assert.ok(bar.includes("truncate"));
});

test("5 blank selection clears context", () => {
  assert.equal(
    contextBarKindFromMode("idle", false),
    "none",
  );
  assert.ok(bar.includes('if (model.kind === "none") return null'));
});

test("6 Information edit disabled", () => {
  assert.equal(getCardActionCapabilities(info).canEdit, false);
  assert.ok(ws.includes("forbidden_original"));
  assert.ok(ws.includes("様式3の情報は原文のまま使用します"));
  assert.ok(bar.includes("visibleContextActions"));
  assert.ok(bar.includes('actions.includes("edit")'));
  assert.equal(bar.includes("basis-full"), false);
});

test("7 source Card shows 元データ", () => {
  assert.equal(getCardSourceCapabilities(info).canOpenSource, true);
  assert.equal(getCardSourceCapabilities(understanding).canOpenSource, true);
  assert.ok(bar.includes("元データ"));
});

test("8 direct/no-source hides 元データ", () => {
  assert.equal(getCardSourceCapabilities(noSource).canOpenSource, false);
  assert.equal(getCardSourceCapabilities(knowledge).canOpenSource, false);
  assert.equal(getCardSourceCapabilities(knowledge).sourceKind, "knowledge_library");
  assert.ok(ws.includes("canOpenSource: selectedSourceCaps?.canOpenSource === true"));
});

test("9 source trace standalone row absent", () => {
  assert.equal(ws.includes("RelatedDiagramForm3SourceTrace"), false);
  assert.equal(ws.includes("data-rd-form3-source-trace"), false);
  assert.equal(ws.includes("元の様式3を見る"), false);
});

test("10 delete action not duplicated", () => {
  const deletes = ws.split("onDelete={requestDeleteSelected}").length - 1;
  assert.equal(deletes, 1);
  assert.equal(ws.includes("data-rd-form3-delete"), false);
});

test("11 Form3 source navigation survives", () => {
  assert.ok(ws.includes("handleOpenSource"));
  assert.ok(ws.includes("setDrawerMode(selectedForm3Source.kind)"));
  assert.ok(ws.includes("setSelectedPatternId"));
  assert.ok(ws.includes("form3SourceTrace"));
});

test("12 Assessment highlight survives", () => {
  assert.ok(ws.includes("setHighlightRange"));
  assert.ok(ws.includes("selectedForm3Source.selectionStart"));
  assert.ok(form3.includes("data-rd-form3-selection-highlight"));
});

test("13 Form3 Drawer opens", () => {
  assert.equal(
    resolveRelatedDiagramEditorMode({
      selection: emptyDiagramSelection(),
      form3Open: true,
      editOpen: false,
      connecting: false,
    }),
    "form3_reference",
  );
  assert.ok(ws.includes("RelatedDiagramForm3Drawer"));
  assert.ok(form3.includes('data-rd-form3-drawer'));
});

test("14 Edit Drawer opens", () => {
  assert.equal(
    resolveRelatedDiagramEditorMode({
      selection: selectionFromCardId("u1"),
      form3Open: false,
      editOpen: true,
      connecting: false,
    }),
    "card_edit",
  );
  assert.ok(edit.includes("カードを編集"));
  assert.ok(edit.includes("RelatedDiagramEditorDrawerShell"));
});

test("15 Drawer exclusivity", () => {
  assert.ok(ws.includes("setDrawerOpen(false)"));
  assert.ok(ws.includes("handleCardEdit"));
  assert.ok(ws.includes("openForm3Drawer"));
  assert.ok(ws.includes("if (actionIntent?.kind === \"connect\") return"));
  assert.ok(ws.includes("setEditDraft(null)"));
});

test("16 Drawer pointer isolation", () => {
  assert.ok(form3.includes("isolateDrawerPointer"));
  assert.ok(edit.includes("stopPropagation"));
  const shell = src(
    "../../../components/v2/relatedDiagram/RelatedDiagramEditorDrawerShell.tsx",
  );
  assert.ok(shell.includes("onPointerDown={isolate}"));
  assert.equal(EDITOR_DRAWER_WIDTH, "min(420px, 42vw)");
});

test("17 connect intent → Connecting Context", () => {
  assert.equal(
    resolveRelatedDiagramEditorMode({
      selection: selectionFromCardId("u1"),
      form3Open: false,
      editOpen: false,
      connecting: true,
    }),
    "connecting",
  );
  assert.ok(bar.includes("接続元："));
  assert.ok(bar.includes("接続先のカードを選択"));
  assert.equal(bar.includes("からつなぐ"), false);
  assert.equal(bar.includes("接続先のカードをタップしてください"), false);
  assert.ok(bar.includes('data-rd-connect-source'));
  assert.ok(bar.includes('minWidth: 0'));
  assert.ok(bar.includes('textOverflow: "ellipsis"'));
  assert.ok(bar.includes('whiteSpace: "nowrap"'));
  assert.ok(bar.includes("shrink-0"));
  assert.ok(bar.includes('action="connect-cancel"'));
});

test("18 source Card retained while connecting", () => {
  assert.ok(ws.includes("actionIntent.sourceCardId"));
  assert.ok(ws.includes("selectCard(actionIntent.sourceCardId)"));
});

test("19 connecting cancel", () => {
  assert.ok(ws.includes("handleCancelConnect"));
  assert.ok(bar.includes("キャンセル"));
});

test("20 no Connection created", () => {
  assert.equal(ws.includes("upsertConnection("), false);
  assert.ok(ws.includes("createCardConnectIntent"));
});

test("21 selection not history", () => {
  const history = emptyDiagramHistory();
  assert.equal(history.past.length, 0);
  assert.equal(ws.includes('type: "selectCard"'), false);
  assert.equal(ws.includes("onHistoryPush({ type: \"select"), false);
});

test("22 Drawer state not history", () => {
  assert.equal(ws.includes('type: "openDrawer"'), false);
  assert.equal(ws.includes("onHistoryPush({ type: \"editCard\"") || ws.includes('type: "editCard"'), true);
  const idle = emptyDiagramHistory();
  const next = pushDiagramHistory(idle, {
    type: "editCard",
    cardId: "u1",
    before: { text: "a", state: "current" },
    after: { text: "b", state: "current" },
  });
  assert.equal(next.past.length, 1);
});

test("23 provenance unchanged", () => {
  const assess = buildSchizophreniaForm3ReadModel().assessments.find((row) =>
    row.assessmentText.includes("クエチアピン"),
  )!;
  const entity = buildUnderstandingCardFromAssessmentSelection({
    source: assess,
    selection: {
      selectedText: "クエチアピン",
      selectionStart: assess.assessmentText.indexOf("クエチアピン"),
      selectionEnd:
        assess.assessmentText.indexOf("クエチアピン") + "クエチアピン".length,
    },
    editedText: "日中傾眠が生じる",
    state: "potential",
    layout: { x: 40, y: 40, zIndex: 1 },
  });
  const graph = insertCardEntity(createEmptySemanticGraph(), entity);
  const trace = form3SourceTrace(graph, entity.card.id);
  assert.equal(trace?.selectedText, "クエチアピン");
  assert.equal(graph.cardSources[0]?.sourceExcerpt, assess.assessmentText);
  assert.equal(ws.includes("cardSources"), true);
});

test("24 zoom semantics unchanged", () => {
  assert.ok(viewport.includes("resetTo100"));
  assert.ok(viewport.includes("fitToView"));
  assert.ok(viewport.includes("scale: 1"));
  assert.ok(toolbar.includes("実際の100%表示"));
  assert.ok(toolbar.includes("A3全体を画面に合わせる"));
  assert.ok(toolbar.includes("data-rd-zoom-group"));
  assert.ok(toolbar.includes("data-rd-history-group"));
});

test("25 100% works", () => {
  assert.ok(ws.includes("onReset100={resetTo100}"));
  assert.ok(viewport.includes("scale: 1"));
});

test("26 fit works", () => {
  assert.ok(ws.includes("onFit={fitToView}"));
  assert.ok(viewport.includes("setTransform({ scale: fit"));
});

test("27 toolbar touch targets", () => {
  assert.equal(EDITOR_TOUCH_TARGET_PX, 44);
  assert.ok(toolbar.includes("min-h-[44px]"));
  assert.ok(toolbar.includes("flex-nowrap"));
  assert.ok(toolbar.includes("data-rd-toolbar-overflow"));
});

test("28 context touch targets", () => {
  assert.ok(bar.includes("min-h-[44px]"));
  assert.ok(bar.includes("h-[44px]"));
});

test("29 Edit Drawer touch targets", () => {
  assert.ok(edit.includes("min-h-[44px]"));
  assert.ok(edit.includes("fontSize: 16"));
});

test("30 Delete modal behavior unchanged", () => {
  assert.ok(del.includes("このカードを関連図から削除しますか？"));
  assert.ok(del.includes("カードと接続を関連図から削除しますか？"));
  assert.ok(del.includes("カードと接続を削除"));
  assert.ok(del.includes('role="dialog"'));
  assert.ok(del.includes("aria-modal"));
  assert.equal(A3_WIDTH_PX, 1587);
  assert.equal(A3_HEIGHT_PX, 1123);
});

test("placeholder add card does not create a Card", () => {
  assert.equal(EDITOR_ADD_CARD_PLACEHOLDER, "カード追加は次のSliceで実装します");
  assert.ok(toolbar.includes("＋カード"));
  assert.ok(ws.includes("onAddCard={openDirectInsightCompose}"));
  assert.equal(toolbar.includes("カードの種類"), false);
  assert.equal(ws.includes("upsertConnection("), false);
});

test("student runtime stays outside the editor chrome", () => {
  const student = src(
    "../../../components/v2/relatedDiagram/RelatedDiagramReadonlyWorkspace.tsx",
  );
  assert.equal(student.includes("RelatedDiagramEditorToolbar"), false);
  assert.equal(student.includes("RelatedDiagramContextBar"), false);
  assert.equal(student.includes("＋カード"), false);
});

console.log(`\n${passed} passed`);
