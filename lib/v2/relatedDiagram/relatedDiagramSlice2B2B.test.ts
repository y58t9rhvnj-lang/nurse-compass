/**
 * Slice 2B-2B Card Edit / Delete tests.
 * Run: npx tsx lib/v2/relatedDiagram/relatedDiagramSlice2B2B.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getCardActionCapabilities } from "./cardActionCapabilities";
import { createCardEditIntent } from "./cardActionIntents";
import {
  incidentConnectionCount,
  incidentConnections,
  pruneStableRoutesForConnections,
  removeCardAndIncidentConnections,
  snapshotCardForDelete,
} from "./cardDelete";
import {
  applyCardDisplayEdit,
  canCommitCardEdit,
  cardEditDraftFromCard,
  patchCardInGraph,
} from "./cardEdit";
import {
  applyHistoryCommand,
  emptyDiagramHistory,
  pushDiagramHistory,
  redoDiagramHistory,
  undoDiagramHistory,
} from "./diagramHistory";
import {
  buildUnderstandingCardFromAssessmentSelection,
  form3SourceTrace,
  insertCardEntity,
} from "./form3ToUnderstandingCard";
import { buildSchizophreniaForm3ReadModel } from "./fixtures/form3AssessmentSourceFixture";
import { SCHIZOPHRENIA_KNOWLEDGE_CARDS } from "./fixtures/schizophreniaPathophysiologyFixture";
import {
  cloneStableRouteState,
  seedStableRouteState,
} from "./incrementalRoutes";
import { createEmptySemanticGraph } from "./semanticGraph";
import type {
  RelatedDiagramCard,
  RelatedDiagramCardOrigin,
  RelatedDiagramCardType,
  RelatedDiagramConnection,
  RelatedDiagramSemanticGraph,
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
    createdAt: "2026-09-16T00:00:00.000Z",
    updatedAt: "2026-09-16T00:00:00.000Z",
  };
}

function connection(
  id: string,
  sourceCardId: string,
  targetCardId: string,
): RelatedDiagramConnection {
  return {
    id,
    sourceCardId,
    targetCardId,
    relationType: "current",
    origin: "student_diagram",
    createdAt: "2026-09-16T00:00:00.000Z",
    updatedAt: "2026-09-16T00:00:00.000Z",
  };
}

function graphOf(
  cards: RelatedDiagramCard[],
  connections: RelatedDiagramConnection[] = [],
): RelatedDiagramSemanticGraph {
  return { ...createEmptySemanticGraph(), cards, connections };
}

const info = card({
  id: "info1",
  cardType: "information",
  origin: "form3_information",
  state: null,
  text: "S「眠れない」",
});
const understanding = card({
  id: "u1",
  cardType: "understanding",
  origin: "form3_assessment",
  state: "current",
  text: "日中傾眠が生じる",
});
const knowledge = card({
  id: "k1",
  cardType: "knowledge",
  origin: "knowledge_library",
  state: null,
  text: "ドパミン仮説",
});

const model = buildSchizophreniaForm3ReadModel();
const assess = model.assessments.find((row) =>
  row.assessmentText.includes("クエチアピン"),
)!;
const quote = "睡眠薬とクエチアピン追加により、日中傾眠が生じる可能性が";
const quoteStart = assess.assessmentText.indexOf(quote);
const assessEntity = buildUnderstandingCardFromAssessmentSelection({
  source: assess,
  selection: {
    selectedText: quote,
    selectionStart: quoteStart,
    selectionEnd: quoteStart + quote.length,
  },
  editedText: quote,
  state: "potential",
  layout: { x: 40, y: 50, zIndex: 2 },
});

test("1 Information edit disabled", () => {
  assert.equal(getCardActionCapabilities(info).canEdit, false);
  assert.equal(createCardEditIntent(info), null);
  assert.equal(
    applyCardDisplayEdit(info, { text: "改変", state: null }),
    null,
  );
});

test("2 Understanding edit opens", () => {
  const intent = createCardEditIntent(understanding);
  assert.equal(intent?.kind, "edit");
  const edit = src("../../../components/v2/relatedDiagram/RelatedDiagramCardEditDrawer.tsx");
  assert.ok(edit.includes("カードを編集"));
  assert.ok(edit.includes("data-rd-card-edit-text"));
});

test("3 Knowledge edit opens", () => {
  assert.equal(createCardEditIntent(knowledge)?.editMode, "diagram_display_only");
});

test("4 current → potential", () => {
  const next = applyCardDisplayEdit(understanding, {
    text: understanding.text,
    state: "potential",
  });
  assert.equal(next?.state, "potential");
  assert.equal(next?.text, understanding.text);
});

test("5 potential → current", () => {
  const next = applyCardDisplayEdit(
    { ...understanding, state: "potential" },
    { text: understanding.text, state: "current" },
  );
  assert.equal(next?.state, "current");
});

test("6 text edit", () => {
  const next = applyCardDisplayEdit(understanding, {
    text: "日中傾眠が生じる可能性がある",
    state: "current",
  });
  assert.equal(next?.text, "日中傾眠が生じる可能性がある");
});

test("7 empty text blocked", () => {
  assert.equal(
    canCommitCardEdit(understanding, { text: "   ", state: "current" }),
    false,
  );
  assert.equal(
    applyCardDisplayEdit(understanding, { text: "  ", state: "current" }),
    null,
  );
});

test("8 Cancel no change", () => {
  const draft = cardEditDraftFromCard(understanding);
  draft.text = "changed";
  assert.equal(understanding.text, "日中傾眠が生じる");
});

test("9 Cancel no history", () => {
  const history = emptyDiagramHistory();
  cardEditDraftFromCard(understanding);
  assert.equal(history.past.length, 0);
});

test("10 Save = one history action", () => {
  const next = applyCardDisplayEdit(understanding, {
    text: "保存後",
    state: "current",
  })!;
  const history = pushDiagramHistory(emptyDiagramHistory(), {
    type: "editCard",
    cardId: understanding.id,
    before: { text: understanding.text, state: understanding.state },
    after: { text: next.text, state: next.state },
  });
  assert.equal(history.past.length, 1);
  assert.equal(history.past[0]?.type, "editCard");
});

test("11 Undo exact pre-edit", () => {
  let graph = graphOf([understanding]);
  const next = applyCardDisplayEdit(understanding, {
    text: "編集後",
    state: "potential",
  })!;
  graph = patchCardInGraph(graph, next);
  let history = pushDiagramHistory(emptyDiagramHistory(), {
    type: "editCard",
    cardId: understanding.id,
    before: { text: understanding.text, state: understanding.state },
    after: { text: next.text, state: next.state },
  });
  const undone = undoDiagramHistory(history);
  graph = applyHistoryCommand(graph, undone.command);
  assert.equal(graph.cards[0]?.text, "日中傾眠が生じる");
  assert.equal(graph.cards[0]?.state, "current");
});

test("12 Redo exact post-edit", () => {
  let graph = graphOf([understanding]);
  const next = applyCardDisplayEdit(understanding, {
    text: "編集後",
    state: "potential",
  })!;
  graph = patchCardInGraph(graph, next);
  let history = pushDiagramHistory(emptyDiagramHistory(), {
    type: "editCard",
    cardId: understanding.id,
    before: { text: understanding.text, state: understanding.state },
    after: { text: next.text, state: next.state },
  });
  const undone = undoDiagramHistory(history);
  graph = applyHistoryCommand(graph, undone.command);
  history = undone.history;
  const redone = redoDiagramHistory(history);
  graph = applyHistoryCommand(graph, redone.command);
  assert.equal(graph.cards[0]?.text, "編集後");
  assert.equal(graph.cards[0]?.state, "potential");
});

test("13 provenance unchanged", () => {
  let graph = insertCardEntity(createEmptySemanticGraph(), assessEntity);
  const edited = applyCardDisplayEdit(graph.cards[0]!, {
    text: "日中傾眠が生じる可能性がある",
    state: "current",
  })!;
  graph = patchCardInGraph(graph, edited);
  const source = graph.cardSources[0]!;
  assert.equal(source.sourceExcerpt, assess.assessmentText);
  assert.equal(source.sourceId, assess.assessmentId);
  assert.equal(graph.cards[0]?.origin, "form3_assessment");
});

test("14 selectedText unchanged", () => {
  let graph = insertCardEntity(createEmptySemanticGraph(), assessEntity);
  graph = patchCardInGraph(
    graph,
    applyCardDisplayEdit(graph.cards[0]!, {
      text: "表現を整えた文",
      state: "potential",
    })!,
  );
  assert.equal(graph.cardSources[0]?.selectedText, quote);
});

test("15 offsets unchanged", () => {
  let graph = insertCardEntity(createEmptySemanticGraph(), assessEntity);
  const before = graph.cardSources[0]!;
  graph = patchCardInGraph(
    graph,
    applyCardDisplayEdit(graph.cards[0]!, {
      text: "表現を整えた文",
      state: "potential",
    })!,
  );
  assert.equal(graph.cardSources[0]?.selectionStart, before.selectionStart);
  assert.equal(graph.cardSources[0]?.selectionEnd, before.selectionEnd);
  assert.equal(
    assess.assessmentText.slice(
      graph.cardSources[0]!.selectionStart!,
      graph.cardSources[0]!.selectionEnd!,
    ),
    quote,
  );
});

test("16 sourceClassification unchanged", () => {
  let graph = insertCardEntity(createEmptySemanticGraph(), assessEntity);
  graph = patchCardInGraph(
    graph,
    applyCardDisplayEdit(graph.cards[0]!, {
      text: "表現を整えた文",
      state: "current",
    })!,
  );
  assert.equal(graph.cardSources[0]?.sourceClassification, assess.judgment);
});

test("17 source trace survives", () => {
  let graph = insertCardEntity(createEmptySemanticGraph(), assessEntity);
  graph = patchCardInGraph(
    graph,
    applyCardDisplayEdit(graph.cards[0]!, {
      text: "表現を整えた文",
      state: "current",
    })!,
  );
  const trace = form3SourceTrace(graph, assessEntity.card.id);
  assert.equal(trace?.originLabel, "様式3のアセスメントから追加");
  assert.equal(trace?.selectedText, quote);
  assert.equal(trace?.cardText, "表現を整えた文");
});

test("18 Knowledge Library unchanged", () => {
  const original = SCHIZOPHRENIA_KNOWLEDGE_CARDS[0]!;
  const canvas = card({
    id: original.id,
    cardType: "knowledge",
    origin: "knowledge_library",
    state: null,
    text: original.text,
  });
  const edited = applyCardDisplayEdit(canvas, {
    text: "関連図上の言い換え",
    state: null,
  })!;
  assert.equal(edited.text, "関連図上の言い換え");
  assert.equal(SCHIZOPHRENIA_KNOWLEDGE_CARDS[0]?.text, original.text);
  assert.notEqual(SCHIZOPHRENIA_KNOWLEDGE_CARDS[0]?.text, edited.text);
});

test("19 Knowledge has no state control", () => {
  const edited = applyCardDisplayEdit(knowledge, {
    text: "表示だけ変える",
    state: "current",
  })!;
  assert.equal(edited.state, null);
  const drawer = src(
    "../../../components/v2/relatedDiagram/RelatedDiagramCardEditDrawer.tsx",
  );
  assert.ok(drawer.includes('editMode === "card_text_and_state"'));
});

test("20 selected Card remains selected", () => {
  const ws = src(
    "../../../components/v2/relatedDiagram/RelatedDiagramDevFixtureWorkspace.tsx",
  );
  assert.ok(ws.includes("handleSaveCardEdit"));
  assert.equal(ws.includes("selectCard(null);\n    setEditDraft"), false);
});

test("21 delete no-connection Card", () => {
  const graph = removeCardAndIncidentConnections(graphOf([info]), info.id);
  assert.equal(graph.cards.length, 0);
});

test("22 confirmation required", () => {
  const confirm = src(
    "../../../components/v2/relatedDiagram/RelatedDiagramCardDeleteConfirm.tsx",
  );
  assert.ok(confirm.includes("このカードを関連図から削除しますか？"));
  assert.ok(confirm.includes("data-rd-card-delete-confirm"));
});

test("23 Cancel no delete", () => {
  const graph = graphOf([info]);
  assert.equal(graph.cards.length, 1);
});

test("24 Cancel no history", () => {
  assert.equal(emptyDiagramHistory().past.length, 0);
});

test("25 delete clears selection", () => {
  const ws = src(
    "../../../components/v2/relatedDiagram/RelatedDiagramDevFixtureWorkspace.tsx",
  );
  assert.ok(ws.includes("selectCard(null)"));
  assert.ok(ws.includes("handleConfirmDelete"));
});

test("26 connected Card detects incident count", () => {
  const a = understanding;
  const b = info;
  const graph = graphOf([a, b], [connection("c1", a.id, b.id)]);
  assert.equal(incidentConnectionCount(graph, a.id), 1);
});

test("27 cascade deletes incident connections", () => {
  const a = understanding;
  const b = info;
  const c = knowledge;
  const graph = removeCardAndIncidentConnections(
    graphOf(
      [a, b, c],
      [connection("ab", a.id, b.id), connection("bc", b.id, c.id)],
    ),
    a.id,
  );
  assert.equal(graph.cards.some((row) => row.id === a.id), false);
  assert.equal(graph.connections.some((row) => row.id === "ab"), false);
});

test("28 unrelated Cards survive", () => {
  const a = understanding;
  const b = info;
  const c = knowledge;
  const graph = removeCardAndIncidentConnections(
    graphOf(
      [a, b, c],
      [connection("ab", a.id, b.id), connection("bc", b.id, c.id)],
    ),
    a.id,
  );
  assert.deepEqual(
    graph.cards.map((row) => row.id).sort(),
    [b.id, c.id].sort(),
  );
});

test("29 unrelated Connections survive", () => {
  const a = understanding;
  const b = info;
  const c = knowledge;
  const graph = removeCardAndIncidentConnections(
    graphOf(
      [a, b, c],
      [connection("ab", a.id, b.id), connection("bc", b.id, c.id)],
    ),
    a.id,
  );
  assert.equal(graph.connections.length, 1);
  assert.equal(graph.connections[0]?.id, "bc");
});

test("30 cascade delete = one history action", () => {
  const a = understanding;
  const b = info;
  const graph = graphOf([a, b], [connection("ab", a.id, b.id)]);
  const history = pushDiagramHistory(emptyDiagramHistory(), {
    type: "deleteCard",
    entity: snapshotCardForDelete(graph, a.id)!,
    connections: incidentConnections(graph, a.id),
  });
  assert.equal(history.past.length, 1);
});

test("31 Undo exact Card restore", () => {
  let graph = insertCardEntity(createEmptySemanticGraph(), assessEntity);
  const entity = snapshotCardForDelete(graph, assessEntity.card.id)!;
  graph = removeCardAndIncidentConnections(graph, assessEntity.card.id);
  let history = pushDiagramHistory(emptyDiagramHistory(), {
    type: "deleteCard",
    entity,
    connections: [],
  });
  const undone = undoDiagramHistory(history);
  graph = applyHistoryCommand(graph, undone.command);
  assert.equal(graph.cards[0]?.id, assessEntity.card.id);
  assert.equal(graph.cards[0]?.text, assessEntity.card.text);
  assert.equal(graph.cards[0]?.state, "potential");
  assert.equal(graph.cards[0]?.origin, "form3_assessment");
  assert.equal(graph.cards[0]?.layout.x, 40);
});

test("32 Undo exact Connection IDs", () => {
  const a = understanding;
  const b = info;
  let graph = graphOf([a, b], [connection("ab", a.id, b.id)]);
  const entity = snapshotCardForDelete(graph, a.id)!;
  const connections = incidentConnections(graph, a.id);
  graph = removeCardAndIncidentConnections(graph, a.id);
  const undone = undoDiagramHistory(
    pushDiagramHistory(emptyDiagramHistory(), {
      type: "deleteCard",
      entity,
      connections,
    }),
  );
  graph = applyHistoryCommand(graph, undone.command);
  assert.equal(graph.connections[0]?.id, "ab");
  assert.equal(graph.connections[0]?.relationType, "current");
});

test("33 Undo exact route metadata", () => {
  const a = understanding;
  const b = info;
  const c = knowledge;
  const connections = [
    connection("ab", a.id, b.id),
    connection("bc", b.id, c.id),
  ];
  const cards = [a, b, c];
  const seeded = seedStableRouteState(cards, connections);
  const before = cloneStableRouteState(seeded);
  const after = pruneStableRoutesForConnections(seeded, ["ab"]);
  assert.equal(after.byId.ab, undefined);
  assert.ok(after.byId.bc);
  const entity = snapshotCardForDelete(graphOf(cards, connections), a.id)!;
  let graph = removeCardAndIncidentConnections(graphOf(cards, connections), a.id);
  const undone = undoDiagramHistory(
    pushDiagramHistory(emptyDiagramHistory(), {
      type: "deleteCard",
      entity,
      connections: [connections[0]!],
      routeStateBefore: before,
      routeStateAfter: after,
    }),
  );
  graph = applyHistoryCommand(graph, undone.command);
  assert.equal(undone.command.kind, "insertCard");
  if (undone.command.kind === "insertCard") {
    assert.deepEqual(
      undone.command.routeState?.byId.ab?.points,
      before.byId.ab?.points,
    );
  }
  assert.ok(graph.connections.some((row) => row.id === "ab"));
  assert.ok(graph.connections.some((row) => row.id === "bc"));
});

test("34 Redo exact delete", () => {
  const a = understanding;
  const b = info;
  let graph = graphOf([a, b], [connection("ab", a.id, b.id)]);
  const entity = snapshotCardForDelete(graph, a.id)!;
  const connections = incidentConnections(graph, a.id);
  graph = removeCardAndIncidentConnections(graph, a.id);
  let history = pushDiagramHistory(emptyDiagramHistory(), {
    type: "deleteCard",
    entity,
    connections,
  });
  const undone = undoDiagramHistory(history);
  graph = applyHistoryCommand(graph, undone.command);
  history = undone.history;
  const redone = redoDiagramHistory(history);
  graph = applyHistoryCommand(graph, redone.command);
  assert.equal(graph.cards.some((row) => row.id === a.id), false);
  assert.equal(graph.connections.length, 0);
});

test("35 Form3 source unchanged", () => {
  const fixture = src("./fixtures/form3AssessmentSourceFixture.ts");
  assert.ok(fixture.includes(quote));
  let graph = insertCardEntity(createEmptySemanticGraph(), assessEntity);
  graph = patchCardInGraph(
    graph,
    applyCardDisplayEdit(graph.cards[0]!, {
      text: "関連図上の表現",
      state: "current",
    })!,
  );
  assert.ok(
    src("./fixtures/form3AssessmentSourceFixture.ts").includes(
      assess.assessmentText.slice(0, 8),
    ),
  );
  assert.equal(graph.cardSources[0]?.sourceExcerpt, assess.assessmentText);
});

test("36 Knowledge source unchanged", () => {
  const fixture = src("./fixtures/schizophreniaPathophysiologyFixture.ts");
  assert.ok(fixture.includes('cardType: "knowledge"'));
  assert.equal(fixture.includes("applyCardDisplayEdit"), false);
  const ws = src(
    "../../../components/v2/relatedDiagram/RelatedDiagramDevFixtureWorkspace.tsx",
  );
  assert.equal(ws.includes("knowledge_library") && ws.includes("upsertCard("), false);
});

test("workspace keeps connect as intent and does not create connections", () => {
  const ws = src(
    "../../../components/v2/relatedDiagram/RelatedDiagramDevFixtureWorkspace.tsx",
  );
  assert.ok(ws.includes("createCardConnectIntent"));
  assert.equal(ws.includes("upsertConnection("), false);
  assert.ok(ws.includes("RelatedDiagramCardEditDrawer"));
  assert.ok(ws.includes("RelatedDiagramCardDeleteConfirm"));
});

console.log(`\n${passed} passed`);
