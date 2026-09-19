/**
 * Slice 2B-2D Direct Insight / 「新しい気づき」 tests.
 * Run: npx tsx lib/v2/relatedDiagram/relatedDiagramSlice2B2D.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { A3_HEIGHT_PX, A3_WIDTH_PX } from "./a3Canvas";
import { rectIntersectsA3Legend } from "./a3Legend";
import { getCardActionCapabilities } from "./cardActionCapabilities";
import { CARD_MIN_GAP } from "./cardCollision";
import {
  applyCardDisplayEdit,
  canCommitCardEdit,
  cardEditDraftFromCard,
} from "./cardEdit";
import {
  DIRECT_INSIGHT_LABEL,
  DIRECT_INSIGHT_ORIGIN,
  buildDirectInsightCard,
  canCommitDirectInsightCompose,
  emptyDirectInsightComposeDraft,
} from "./cardDirectInsight";
import { snapshotCardForDelete } from "./cardDelete";
import { cardShowsSourceAction, getCardSourceCapabilities } from "./cardSourceCapabilities";
import {
  applyHistoryCommand,
  emptyDiagramHistory,
  pushDiagramHistory,
  redoDiagramHistory,
  undoDiagramHistory,
} from "./diagramHistory";
import { editorModeIsDrawer, resolveRelatedDiagramEditorMode } from "./editorUiState";
import {
  UNDERSTANDING_CARD_HEIGHT,
  UNDERSTANDING_CARD_WIDTH,
  cloneCardEntity,
  form3SourceTrace,
  insertCardEntity,
  nextCardZIndex,
} from "./form3ToUnderstandingCard";
import { placeForm3UnderstandingCard } from "./placeForm3UnderstandingCard";
import { createEmptySemanticGraph } from "./semanticGraph";
import { emptyDiagramSelection, selectionFromCardId } from "./diagramSelection";
import { resolveCardBorderVisual } from "./visualStyle";
import type { RelatedDiagramCard, RelatedDiagramSemanticGraph } from "./types";

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

const ws = src(
  "../../../components/v2/relatedDiagram/RelatedDiagramDevFixtureWorkspace.tsx",
);
const toolbar = src(
  "../../../components/v2/relatedDiagram/RelatedDiagramEditorToolbar.tsx",
);
const drawer = src(
  "../../../components/v2/relatedDiagram/RelatedDiagramDirectInsightDrawer.tsx",
);
const bar = src(
  "../../../components/v2/relatedDiagram/RelatedDiagramContextBar.tsx",
);
const edit = src(
  "../../../components/v2/relatedDiagram/RelatedDiagramCardEditDrawer.tsx",
);
const place = src("./placeForm3UnderstandingCard.ts");
const insightLib = src("./cardDirectInsight.ts");

const FORM3_PROVENANCE_KEYS = [
  "form3RecordId",
  "assessmentId",
  "informationId",
  "patternId",
  "sourceExcerpt",
  "selectedText",
  "selectionStart",
  "selectionEnd",
  "sourceClassification",
  "sourceVersion",
] as const;

function insightCard(input: {
  text: string;
  state: "current" | "potential";
  cardId?: string;
  x?: number;
  y?: number;
}): ReturnType<typeof buildDirectInsightCard> {
  return buildDirectInsightCard({
    text: input.text,
    state: input.state,
    cardId: input.cardId ?? "di_test_1",
    layout: {
      x: input.x ?? 40,
      y: input.y ?? 50,
      zIndex: 3,
    },
    now: "2026-09-17T00:00:00.000Z",
  });
}

function addInsight(
  graph: RelatedDiagramSemanticGraph,
  input: {
    text: string;
    state: "current" | "potential";
    cardId?: string;
    desiredCenter?: { x: number; y: number };
  },
) {
  const placed = placeForm3UnderstandingCard({
    desiredCenter: input.desiredCenter ?? {
      x: A3_WIDTH_PX / 2,
      y: A3_HEIGHT_PX / 2,
    },
    otherCards: graph.cards,
  });
  const entity = buildDirectInsightCard({
    text: input.text,
    state: input.state,
    cardId: input.cardId,
    layout: {
      x: placed.x,
      y: placed.y,
      zIndex: nextCardZIndex(graph),
    },
  });
  return {
    graph: insertCardEntity(graph, entity),
    entity,
    placed,
  };
}

test("1 ＋カードでDirect Insight Composeが開く", () => {
  assert.ok(toolbar.includes("＋カード"));
  assert.ok(toolbar.includes('aria-label="カードを追加"'));
  assert.ok(ws.includes("onAddCard={openCardTypeChooser}"));
  assert.ok(ws.includes("openDirectInsightCompose"));
  assert.ok(ws.includes("emptyDirectInsightComposeDraft()"));
  assert.ok(ws.includes("RelatedDiagramDirectInsightDrawer"));
  assert.ok(drawer.includes("新しい気づきを追加"));
  assert.equal(
    resolveRelatedDiagramEditorMode({
      selection: emptyDiagramSelection(),
      form3Open: false,
      editOpen: false,
      connecting: false,
      directInsightOpen: true,
    }),
    "direct_insight_compose",
  );
  assert.equal(editorModeIsDrawer("direct_insight_compose"), true);
});

test("2 Information / Knowledge はChooserに出ない", () => {
  assert.equal(toolbar.includes("カードの種類"), false);
  assert.equal(toolbar.includes("Information"), false);
  assert.equal(toolbar.includes("Knowledge"), false);
  assert.equal(drawer.includes("カードの種類"), false);
  assert.equal(drawer.includes("看護問題"), false);
  assert.equal(drawer.includes("Information"), false);
  assert.equal(ws.includes("card type chooser"), false);
});

test("3 textarea空では追加不可", () => {
  assert.equal(
    canCommitDirectInsightCompose({ text: "", state: "current" }),
    false,
  );
  assert.equal(
    canCommitDirectInsightCompose({ text: "   ", state: "potential" }),
    false,
  );
  assert.ok(drawer.includes("disabled={!canAdd}"));
  assert.ok(ws.includes("canCommitDirectInsightCompose(insightDraft)"));
});

test("4 state未選択では追加不可", () => {
  assert.equal(emptyDirectInsightComposeDraft().state, null);
  assert.equal(
    canCommitDirectInsightCompose({ text: "傾眠が日中も続く", state: null }),
    false,
  );
  assert.ok(drawer.includes('data-rd-insight-state="current"'));
  assert.ok(drawer.includes('data-rd-insight-state="potential"'));
});

test("5 text + currentで追加可能", () => {
  assert.equal(
    canCommitDirectInsightCompose({
      text: "  日中の傾眠が生活に影響する  ",
      state: "current",
    }),
    true,
  );
  const added = addInsight(createEmptySemanticGraph(), {
    text: "  日中の傾眠が生活に影響する  ",
    state: "current",
    cardId: "di_current",
  });
  assert.equal(added.entity.card.text, "日中の傾眠が生活に影響する");
  assert.equal(added.entity.card.state, "current");
  assert.equal(added.graph.cards.length, 1);
});

test("6 text + potentialで追加可能", () => {
  assert.equal(
    canCommitDirectInsightCompose({
      text: "将来的に服薬自己管理が不安定になる",
      state: "potential",
    }),
    true,
  );
  const added = addInsight(createEmptySemanticGraph(), {
    text: "将来的に服薬自己管理が不安定になる",
    state: "potential",
    cardId: "di_potential",
  });
  assert.equal(added.entity.card.state, "potential");
});

test("7 type=Understanding", () => {
  const entity = insightCard({
    text: "新しい気づき",
    state: "current",
  });
  assert.equal(entity.card.cardType, "understanding");
});

test("8 origin=direct_insight", () => {
  const entity = insightCard({
    text: "新しい気づき",
    state: "potential",
  });
  assert.equal(entity.card.origin, DIRECT_INSIGHT_ORIGIN);
  assert.equal(entity.card.origin, "direct_insight");
  assert.equal(insightLib.includes("state: input.state"), true);
  assert.equal(insightLib.includes('state: "current"'), false);
});

test("9 current visual semantics維持", () => {
  const visual = resolveCardBorderVisual("understanding", "current");
  assert.equal(visual.borderStyle, "solid");
  assert.equal(visual.borderWidthPx, 1.5);
  assert.equal(visual.borderColor, "#1D1D1F");
});

test("10 potential visual semantics維持", () => {
  const visual = resolveCardBorderVisual("understanding", "potential");
  assert.equal(visual.borderStyle, "dashed");
  assert.equal(visual.borderWidthPx, 2);
  assert.equal(visual.borderColor, "#1D1D1F");
});

test("11 Form3 provenanceを持たない", () => {
  const entity = insightCard({
    text: "関連図上で言語化した理解",
    state: "current",
  });
  assert.equal(entity.sources.length, 0);
  for (const key of FORM3_PROVENANCE_KEYS) {
    assert.equal(Object.hasOwn(entity.card, key), false);
  }
  const graph = insertCardEntity(createEmptySemanticGraph(), entity);
  assert.equal(graph.cardSources.length, 0);
});

test("12 元データactionなし", () => {
  const entity = insightCard({
    text: "関連図上で言語化した理解",
    state: "current",
  });
  assert.equal(getCardSourceCapabilities(entity.card).canOpenSource, false);
  assert.equal(getCardSourceCapabilities(entity.card).sourceKind, "direct_insight");
  assert.equal(cardShowsSourceAction(entity.card), false);
  assert.ok(bar.includes("{model.canOpenSource ? ("));
  assert.ok(ws.includes("canOpenSource: selectedSourceCaps?.canOpenSource === true"));
});

test("13 Form3 source traceなし", () => {
  const entity = insightCard({
    text: "関連図上で言語化した理解",
    state: "current",
  });
  const graph = insertCardEntity(createEmptySemanticGraph(), entity);
  assert.equal(form3SourceTrace(graph, entity.card.id), null);
  assert.equal(DIRECT_INSIGHT_LABEL, "関連図での新しい気づき");
  assert.ok(drawer.includes("関連図での新しい気づき"));
  assert.equal(drawer.includes("様式3のアセスメントから追加"), false);
  assert.equal(drawer.includes("様式3の情報から追加"), false);
});

test("14 viewport付近にplacement", () => {
  assert.ok(ws.includes("desiredCenter: viewportCenter()"));
  assert.ok(ws.includes("placeForm3UnderstandingCard"));
  const viewport = { x: 420, y: 310 };
  const placed = placeForm3UnderstandingCard({
    desiredCenter: viewport,
    otherCards: [],
  });
  const cx = placed.x + UNDERSTANDING_CARD_WIDTH / 2;
  const cy = placed.y + UNDERSTANDING_CARD_HEIGHT / 2;
  assert.ok(Math.abs(cx - viewport.x) < 80);
  assert.ok(Math.abs(cy - viewport.y) < 80);
});

test("15 A3 boundary内", () => {
  const placed = placeForm3UnderstandingCard({
    desiredCenter: { x: A3_WIDTH_PX / 2, y: A3_HEIGHT_PX / 2 },
    otherCards: [],
  });
  assert.ok(placed.x >= 0);
  assert.ok(placed.y >= 0);
  assert.ok(placed.x + UNDERSTANDING_CARD_WIDTH <= A3_WIDTH_PX);
  assert.ok(placed.y + UNDERSTANDING_CARD_HEIGHT <= A3_HEIGHT_PX);
});

test("16 Legend侵入なし", () => {
  const placed = placeForm3UnderstandingCard({
    desiredCenter: { x: A3_WIDTH_PX / 2, y: A3_HEIGHT_PX / 2 },
    otherCards: [],
  });
  assert.equal(
    rectIntersectsA3Legend({
      x: placed.x,
      y: placed.y,
      width: UNDERSTANDING_CARD_WIDTH,
      height: UNDERSTANDING_CARD_HEIGHT,
    }),
    false,
  );
});

test("17 collision resolver使用", () => {
  assert.ok(place.includes("resolveCardDropCollision"));
  assert.ok(place.includes("resolveCardDropPosition"));
  assert.ok(ws.includes("placeForm3UnderstandingCard"));
  const blocker: RelatedDiagramCard = {
    id: "blocker",
    cardType: "understanding",
    text: "既存",
    state: "current",
    origin: "form3_assessment",
    layout: {
      x: A3_WIDTH_PX / 2 - UNDERSTANDING_CARD_WIDTH / 2,
      y: A3_HEIGHT_PX / 2 - UNDERSTANDING_CARD_HEIGHT / 2,
      width: UNDERSTANDING_CARD_WIDTH,
      height: UNDERSTANDING_CARD_HEIGHT,
      zIndex: 1,
    },
    isLocked: false,
    createdAt: "2026-09-17T00:00:00.000Z",
    updatedAt: "2026-09-17T00:00:00.000Z",
  };
  const placed = placeForm3UnderstandingCard({
    desiredCenter: { x: A3_WIDTH_PX / 2, y: A3_HEIGHT_PX / 2 },
    otherCards: [blocker],
  });
  const dx = Math.abs(placed.x - blocker.layout.x);
  const dy = Math.abs(placed.y - blocker.layout.y);
  assert.equal(
    dx >= UNDERSTANDING_CARD_WIDTH + CARD_MIN_GAP ||
      dy >= UNDERSTANDING_CARD_HEIGHT + CARD_MIN_GAP,
    true,
  );
  assert.equal(placed.collided, true);
});

test("18 add後selected", () => {
  assert.ok(ws.includes("selectCard(entity.card.id)"));
  const added = addInsight(createEmptySemanticGraph(), {
    text: "選択される気づき",
    state: "current",
    cardId: "di_selected",
  });
  const selection = selectionFromCardId(added.entity.card.id);
  assert.equal(selection.kind, "card");
  assert.equal(selection.kind === "card" ? selection.cardId : null, "di_selected");
});

test("19 selectionはhistory非対象", () => {
  assert.equal(ws.includes('type: "selectCard"'), false);
  assert.equal(ws.includes("onHistoryPush({ type: \"select"), false);
  const added = addInsight(createEmptySemanticGraph(), {
    text: "選択は履歴に残さない",
    state: "current",
    cardId: "di_sel_hist",
  });
  const history = pushDiagramHistory(emptyDiagramHistory(), {
    type: "addCard",
    entity: cloneCardEntity(added.entity),
  });
  assert.equal(history.past.length, 1);
  assert.equal(history.past[0]?.type, "addCard");
});

test("20 add=1 history action", () => {
  assert.ok(ws.includes('onHistoryPush({ type: "addCard", entity: cloneCardEntity(entity) })'));
  const added = addInsight(createEmptySemanticGraph(), {
    text: "一手で追加",
    state: "current",
    cardId: "di_one_action",
  });
  const history = pushDiagramHistory(emptyDiagramHistory(), {
    type: "addCard",
    entity: cloneCardEntity(added.entity),
  });
  assert.equal(history.past.length, 1);
  assert.equal(history.future.length, 0);
});

test("21 Undoで削除", () => {
  const added = addInsight(createEmptySemanticGraph(), {
    text: "取り消す気づき",
    state: "current",
    cardId: "di_undo",
  });
  let graph = added.graph;
  const history = pushDiagramHistory(emptyDiagramHistory(), {
    type: "addCard",
    entity: cloneCardEntity(added.entity),
  });
  const undone = undoDiagramHistory(history);
  graph = applyHistoryCommand(graph, undone.command);
  assert.equal(graph.cards.some((card) => card.id === "di_undo"), false);
});

test("22 Redo same ID", () => {
  const added = addInsight(createEmptySemanticGraph(), {
    text: "復元される気づき",
    state: "potential",
    cardId: "di_redo_id",
    desiredCenter: { x: 380, y: 260 },
  });
  let graph = added.graph;
  let history = pushDiagramHistory(emptyDiagramHistory(), {
    type: "addCard",
    entity: cloneCardEntity(added.entity),
  });
  const undone = undoDiagramHistory(history);
  graph = applyHistoryCommand(graph, undone.command);
  history = undone.history;
  const redone = redoDiagramHistory(history);
  graph = applyHistoryCommand(graph, redone.command);
  assert.equal(graph.cards[0]?.id, "di_redo_id");
});

test("23 Redo same text", () => {
  const added = addInsight(createEmptySemanticGraph(), {
    text: "復元される気づき",
    state: "potential",
    cardId: "di_redo_text",
  });
  let graph = added.graph;
  let history = pushDiagramHistory(emptyDiagramHistory(), {
    type: "addCard",
    entity: cloneCardEntity(added.entity),
  });
  const undone = undoDiagramHistory(history);
  graph = applyHistoryCommand(graph, undone.command);
  const redone = redoDiagramHistory(undone.history);
  graph = applyHistoryCommand(graph, redone.command);
  assert.equal(graph.cards[0]?.text, "復元される気づき");
});

test("24 Redo same state", () => {
  const added = addInsight(createEmptySemanticGraph(), {
    text: "復元される気づき",
    state: "potential",
    cardId: "di_redo_state",
  });
  let graph = added.graph;
  let history = pushDiagramHistory(emptyDiagramHistory(), {
    type: "addCard",
    entity: cloneCardEntity(added.entity),
  });
  const undone = undoDiagramHistory(history);
  graph = applyHistoryCommand(graph, undone.command);
  const redone = redoDiagramHistory(undone.history);
  graph = applyHistoryCommand(graph, redone.command);
  assert.equal(graph.cards[0]?.state, "potential");
});

test("25 Redo same origin", () => {
  const added = addInsight(createEmptySemanticGraph(), {
    text: "復元される気づき",
    state: "current",
    cardId: "di_redo_origin",
  });
  let graph = added.graph;
  let history = pushDiagramHistory(emptyDiagramHistory(), {
    type: "addCard",
    entity: cloneCardEntity(added.entity),
  });
  const undone = undoDiagramHistory(history);
  graph = applyHistoryCommand(graph, undone.command);
  const redone = redoDiagramHistory(undone.history);
  graph = applyHistoryCommand(graph, redone.command);
  assert.equal(graph.cards[0]?.origin, "direct_insight");
});

test("26 Redo same position", () => {
  const added = addInsight(createEmptySemanticGraph(), {
    text: "復元される気づき",
    state: "current",
    cardId: "di_redo_pos",
    desiredCenter: { x: 380, y: 260 },
  });
  const before = added.entity.card.layout;
  let graph = added.graph;
  let history = pushDiagramHistory(emptyDiagramHistory(), {
    type: "addCard",
    entity: cloneCardEntity(added.entity),
  });
  const undone = undoDiagramHistory(history);
  graph = applyHistoryCommand(graph, undone.command);
  const redone = redoDiagramHistory(undone.history);
  graph = applyHistoryCommand(graph, redone.command);
  assert.equal(graph.cards[0]?.layout.x, before.x);
  assert.equal(graph.cards[0]?.layout.y, before.y);
  assert.equal(graph.cards[0]?.layout.zIndex, before.zIndex);
});

test("27 RedoでCompose再表示なし", () => {
  assert.ok(ws.includes("setInsightDraft(null)"));
  assert.equal(ws.includes("setInsightDraft(emptyDirectInsightComposeDraft())"), true);
  const undoFn = ws.slice(ws.indexOf("const handleUndo"), ws.indexOf("const handleRedo"));
  const redoFn = ws.slice(ws.indexOf("const handleRedo"), ws.indexOf("} = useCardInteraction"));
  assert.equal(undoFn.includes("setInsightDraft"), false);
  assert.equal(redoFn.includes("setInsightDraft"), false);
  assert.equal(redoFn.includes("openDirectInsightCompose"), false);
});

test("28 edit可能", () => {
  const entity = insightCard({
    text: "編集できる気づき",
    state: "current",
  });
  const caps = getCardActionCapabilities(entity.card);
  assert.equal(caps.canEdit, true);
  assert.equal(caps.editMode, "card_text_and_state");
  assert.ok(ws.includes("RelatedDiagramCardEditDrawer"));
  assert.ok(edit.includes("カードを編集"));
});

test("29 text編集可能", () => {
  const entity = insightCard({
    text: "編集前の気づき",
    state: "current",
  });
  const next = applyCardDisplayEdit(entity.card, {
    text: "  編集後の気づき  ",
    state: "current",
  });
  assert.equal(next?.text, "編集後の気づき");
  assert.equal(next?.origin, "direct_insight");
  assert.equal(canCommitCardEdit(entity.card, { text: "変更", state: "current" }), true);
});

test("30 state変更可能", () => {
  const entity = insightCard({
    text: "状態を変える気づき",
    state: "current",
  });
  const next = applyCardDisplayEdit(entity.card, {
    text: entity.card.text,
    state: "potential",
  });
  assert.equal(next?.state, "potential");
  assert.equal(next?.origin, "direct_insight");
  assert.equal(cardEditDraftFromCard(entity.card).state, "current");
});

test("31 delete可能", () => {
  const entity = insightCard({
    text: "削除できる気づき",
    state: "current",
  });
  assert.equal(getCardActionCapabilities(entity.card).canDelete, true);
  const graph = insertCardEntity(createEmptySemanticGraph(), entity);
  const snap = snapshotCardForDelete(graph, entity.card.id);
  assert.equal(snap?.card.id, entity.card.id);
  assert.ok(ws.includes("removeCardAndIncidentConnections"));
});

test("32 canConnect=true", () => {
  const entity = insightCard({
    text: "つなげる気づき",
    state: "potential",
  });
  assert.equal(getCardActionCapabilities(entity.card).canConnect, true);
  assert.ok(ws.includes("createCardConnectIntent"));
  assert.equal(ws.includes("upsertConnection("), false);
});

test("33 Information直接作成なし", () => {
  const addInsightFn = ws.slice(
    ws.indexOf("const handleAddDirectInsight"),
    ws.indexOf("const handleAddInformation"),
  );
  assert.equal(addInsightFn.includes("buildInformationCardFromForm3"), false);
  assert.equal(addInsightFn.includes('cardType: "information"'), false);
  assert.ok(ws.includes("commitDirectUnderstandingCreate"));
  assert.equal(drawer.includes("情報を追加"), false);
});

test("34 Knowledge直接作成なし", () => {
  const addInsightFn = ws.slice(
    ws.indexOf("const handleAddDirectInsight"),
    ws.indexOf("const handleAddInformation"),
  );
  assert.equal(addInsightFn.includes("knowledge"), false);
  assert.equal(toolbar.includes("知識を追加"), false);
  assert.equal(drawer.includes("Knowledge"), false);
});

test("35 Nursing Problem直接作成なし", () => {
  assert.equal(ws.includes("buildNursingProblem"), false);
  assert.equal(ws.includes("upsertNursingProblem"), false);
  assert.equal(drawer.includes("看護問題"), false);
  assert.equal(toolbar.includes("看護問題"), false);
});

test("36 Connection作成なし", () => {
  assert.equal(ws.includes("upsertConnection("), false);
  assert.equal(ws.includes("insertConnection"), false);
  assert.equal(drawer.includes("関係の種類"), false);
  assert.equal(
    resolveRelatedDiagramEditorMode({
      selection: selectionFromCardId("di_1"),
      form3Open: false,
      editOpen: false,
      connecting: true,
      directInsightOpen: true,
    }),
    "connecting",
  );
});

test("37 CancelでCard生成なし", () => {
  assert.ok(ws.includes("onCancel={closeDirectInsightCompose}"));
  const closeFn = ws.slice(
    ws.indexOf("const closeDirectInsightCompose"),
    ws.indexOf("const handleAddDirectInsight"),
  );
  assert.equal(closeFn.includes("insertCardEntity"), false);
  assert.equal(closeFn.includes("buildDirectInsightCard"), false);
  assert.ok(closeFn.includes("setInsightDraft(null)"));
});

test("38 Cancelでhistory変更なし", () => {
  const closeFn = ws.slice(
    ws.indexOf("const closeDirectInsightCompose"),
    ws.indexOf("const handleAddDirectInsight"),
  );
  assert.equal(closeFn.includes("onHistoryPush"), false);
  assert.equal(closeFn.includes("pushDiagramHistory"), false);
  assert.ok(drawer.includes("キャンセル"));
  assert.equal(drawer.includes("メモを追加"), false);
  assert.equal(drawer.includes("自由カード"), false);
  assert.equal(toolbar.includes("メモを追加"), false);
  assert.equal(ws.includes("メモを追加"), false);
});

console.log(`\n${passed} passed`);
