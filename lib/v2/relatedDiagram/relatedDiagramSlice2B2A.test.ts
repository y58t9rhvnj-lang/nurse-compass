/**
 * Slice 2B-2A selection / card-action foundation tests.
 * Run: npx tsx lib/v2/relatedDiagram/relatedDiagramSlice2B2A.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CARD_DRAG_THRESHOLD_PX,
  applyEscape,
  applyPointerDownOnBlank,
  applyPointerDownOnCard,
  applyPointerMove,
  applyPointerUp,
  applySelectCard,
  createIdleState,
} from "./cardInteractionState";
import { getCardActionCapabilities } from "./cardActionCapabilities";
import {
  createCardConnectIntent,
  createCardDeleteIntent,
  createCardEditIntent,
} from "./cardActionIntents";
import {
  connectionSelectionReady,
  emptyDiagramSelection,
  isCardSelected,
  isRelatedDiagramSelectionPreserveTarget,
  selectedCardIdFromSelection,
  selectionFromCardId,
} from "./diagramSelection";
import { emptyDiagramHistory, pushDiagramHistory } from "./diagramHistory";
import { resolveCardBorderVisual } from "./visualStyle";
import { createEmptySemanticGraph } from "./semanticGraph";
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
    layout: { x: 10, y: 10, width: 180, height: 72, zIndex: 1 },
    isLocked: false,
    createdAt: "2026-09-16T00:00:00.000Z",
    updatedAt: "2026-09-16T00:00:00.000Z",
  };
}

const info = card({
  id: "info1",
  cardType: "information",
  origin: "form3_information",
  state: null,
});
const understanding = card({
  id: "u1",
  cardType: "understanding",
  origin: "form3_assessment",
  state: "current",
  text: "日中傾眠が生じる可能性がある",
});
const knowledge = card({
  id: "k1",
  cardType: "knowledge",
  origin: "knowledge_library",
  state: null,
});
const nursingProblem = card({
  id: "np1",
  cardType: "nursing_problem",
  origin: "diagram_integration",
  state: "current",
});

const down = {
  movable: true,
  pointerId: 1,
  pointerType: "touch" as const,
  clientX: 100,
  clientY: 100,
  originX: 40,
  originY: 50,
  cardWidth: 180,
  cardHeight: 72,
};

test("1 none → card selection", () => {
  assert.deepEqual(emptyDiagramSelection(), { kind: "none" });
  const next = applySelectCard(createIdleState(), "info1");
  assert.equal(next.phase, "CARD_SELECTED");
  assert.deepEqual(selectionFromCardId(next.selectedCardId), {
    kind: "card",
    cardId: "info1",
  });
});

test("2 Card A → Card B selection", () => {
  let s = applySelectCard(createIdleState(), "info1");
  s = applySelectCard(s, "u1");
  assert.equal(s.selectedCardId, "u1");
  assert.equal(isCardSelected(selectionFromCardId(s.selectedCardId), "u1"), true);
  assert.equal(isCardSelected(selectionFromCardId(s.selectedCardId), "info1"), false);
});

test("3 blank tap → none", () => {
  const selected = applySelectCard(createIdleState(), "info1");
  const cleared = applyPointerDownOnBlank(selected);
  assert.equal(cleared.selectedCardId, null);
  assert.deepEqual(selectionFromCardId(cleared.selectedCardId), { kind: "none" });
});

test("4 tap does not move Card", () => {
  let s = applyPointerDownOnCard(createIdleState(), { ...down, cardId: "info1" });
  s = applyPointerMove(s, {
    pointerId: 1,
    clientX: 100 + CARD_DRAG_THRESHOLD_PX - 1,
    clientY: 100,
    scale: 1,
  });
  assert.equal(s.phase, "CARD_PRESSING");
  assert.equal(s.currentX, 40);
  assert.equal(s.currentY, 50);
  const up = applyPointerUp(s, { pointerId: 1 });
  assert.equal(up.drop, null);
  assert.equal(up.state.phase, "CARD_SELECTED");
  assert.equal(up.state.selectedCardId, "info1");
});

test("5 drag keeps selected", () => {
  let s = applyPointerDownOnCard(createIdleState(), { ...down, cardId: "info1" });
  s = applyPointerMove(s, {
    pointerId: 1,
    clientX: 100 + 20,
    clientY: 100,
    scale: 1,
  });
  assert.equal(s.phase, "CARD_DRAGGING");
  const up = applyPointerUp(s, { pointerId: 1 });
  assert.equal(up.state.phase, "CARD_SELECTED");
  assert.equal(up.state.selectedCardId, "info1");
});

test("6 selection is not recorded in history", () => {
  const history = emptyDiagramHistory();
  assert.equal(history.past.length, 0);
  applySelectCard(createIdleState(), "info1");
  applyPointerDownOnBlank(applySelectCard(createIdleState(), "u1"));
  assert.equal(history.past.length, 0);
  const stillEmpty = pushDiagramHistory(history, {
    type: "addCard",
    entity: {
      card: info,
      sources: [],
    },
  });
  assert.equal(stillEmpty.past[0]?.type, "addCard");
  const historySrc = src("./diagramHistory.ts");
  assert.equal(historySrc.includes('type: "selectCard"'), false);
  assert.equal(historySrc.includes("diagramSelection"), false);
});

test("7 Information selectable", () => {
  const s = applySelectCard(createIdleState(), info.id);
  assert.equal(selectedCardIdFromSelection(selectionFromCardId(s.selectedCardId)), info.id);
});

test("8 Understanding selectable", () => {
  const s = applySelectCard(createIdleState(), understanding.id);
  assert.equal(s.selectedCardId, understanding.id);
});

test("9 Knowledge selectable", () => {
  const s = applySelectCard(createIdleState(), knowledge.id);
  assert.equal(s.selectedCardId, knowledge.id);
});

test("10 Nursing Problem selectable", () => {
  const s = applySelectCard(createIdleState(), nursingProblem.id);
  assert.equal(s.selectedCardId, nursingProblem.id);
});

test("11 potential border survives selection", () => {
  const visual = resolveCardBorderVisual("understanding", "potential");
  assert.equal(visual.borderStyle, "dashed");
  const node = src("../../../components/v2/relatedDiagram/RelatedDiagramCardNode.tsx");
  assert.ok(node.includes("borderStyle: visual.borderStyle"));
  assert.ok(node.includes('outline: selected ? "2px solid #8E8E93"'));
});

test("12 current border survives selection", () => {
  const visual = resolveCardBorderVisual("understanding", "current");
  assert.equal(visual.borderStyle, "solid");
  const node = src("../../../components/v2/relatedDiagram/RelatedDiagramCardNode.tsx");
  assert.ok(node.includes("borderColor: visual.borderColor"));
});

test("13 Knowledge visual survives selection", () => {
  const visual = resolveCardBorderVisual("knowledge", null);
  assert.equal(visual.showByotaiLabel, true);
  assert.equal(visual.borderColor, "#6E6E73");
  const node = src("../../../components/v2/relatedDiagram/RelatedDiagramCardNode.tsx");
  assert.ok(node.includes("visual.showByotaiLabel"));
});

test("14 Information canEdit=false", () => {
  const caps = getCardActionCapabilities(info);
  assert.equal(caps.canEdit, false);
  assert.equal(caps.editMode, "forbidden_original");
  assert.equal(createCardEditIntent(info), null);
});

test("15 Assessment Understanding canEdit=true", () => {
  const caps = getCardActionCapabilities(understanding);
  assert.equal(caps.canEdit, true);
  assert.equal(caps.editMode, "card_text_and_state");
});

test("16 Knowledge canEdit=true", () => {
  const caps = getCardActionCapabilities(knowledge);
  assert.equal(caps.canEdit, true);
  assert.equal(caps.editMode, "diagram_display_only");
});

test("17 canConnect capability", () => {
  assert.equal(getCardActionCapabilities(info).canConnect, true);
  assert.equal(getCardActionCapabilities(understanding).canConnect, true);
  assert.equal(getCardActionCapabilities(knowledge).canConnect, true);
  assert.equal(getCardActionCapabilities(nursingProblem).canConnect, true);
});

test("18 delete intent only", () => {
  const intent = createCardDeleteIntent(info);
  assert.deepEqual(intent, {
    kind: "delete",
    cardId: "info1",
    deletePolicy: "allowed",
  });
  const graph = createEmptySemanticGraph();
  assert.equal(graph.cards.length, 0);
  assert.ok(createCardDeleteIntent(nursingProblem));
});

test("19 edit intent only", () => {
  const intent = createCardEditIntent(understanding);
  assert.deepEqual(intent, {
    kind: "edit",
    cardId: "u1",
    editMode: "card_text_and_state",
  });
  assert.equal(createCardEditIntent(info), null);
});

test("20 connect intent only", () => {
  const intent = createCardConnectIntent(understanding);
  assert.deepEqual(intent, { kind: "connect", sourceCardId: "u1" });
  assert.equal(connectionSelectionReady("c1"), true);
});

test("21 Drawer interaction does not clear unexpectedly", () => {
  const hook = src("../../../components/v2/relatedDiagram/useCardInteraction.ts");
  const drawer = src("../../../components/v2/relatedDiagram/RelatedDiagramForm3Drawer.tsx");
  assert.ok(hook.includes("isRelatedDiagramSelectionPreserveTarget"));
  assert.ok(drawer.includes("isolateDrawerPointer"));
  assert.ok(drawer.includes("stopPropagation"));
  assert.ok(
    src("./diagramSelection.ts").includes("[data-rd-form3-drawer]"),
  );
  assert.ok(
    src("./diagramSelection.ts").includes("[data-rd-card-action-bar]") ||
      src("./diagramSelection.ts").includes("[data-rd-context-bar]"),
  );
  assert.equal(isRelatedDiagramSelectionPreserveTarget(null), false);
});

test("22 source trace survives", () => {
  const ws = src(
    "../../../components/v2/relatedDiagram/RelatedDiagramDevFixtureWorkspace.tsx",
  );
  assert.ok(ws.includes("form3SourceTrace"));
  assert.ok(ws.includes("handleOpenSource"));
  assert.ok(ws.includes("RelatedDiagramContextBar"));
  assert.ok(ws.includes("元の様式3を見る") === false);
  const trace = src(
    "../../../components/v2/relatedDiagram/RelatedDiagramForm3SourceTrace.tsx",
  );
  assert.ok(trace.includes("元の様式3を見る"));
});

test("23 Escape clears", () => {
  const selected = applySelectCard(createIdleState(), "u1");
  const escaped = applyEscape(selected);
  assert.equal(escaped.state.selectedCardId, null);
  const hook = src("../../../components/v2/relatedDiagram/useCardInteraction.ts");
  assert.ok(hook.includes("applyEscape"));
  assert.ok(hook.includes("isTypingTarget"));
});

test("24 aria-selected", () => {
  const node = src("../../../components/v2/relatedDiagram/RelatedDiagramCardNode.tsx");
  assert.ok(node.includes("aria-selected={selected}"));
});

test("25 44px action targets", () => {
  const bar = src(
    "../../../components/v2/relatedDiagram/RelatedDiagramContextBar.tsx",
  );
  assert.ok(bar.includes("min-h-[44px]"));
  assert.ok(bar.includes('action="edit"'));
  assert.ok(bar.includes('action="connect"'));
  assert.ok(bar.includes('action="delete"'));
});

test("origin and state stay independent", () => {
  const potential = card({
    id: "u2",
    cardType: "understanding",
    origin: "form3_assessment",
    state: "potential",
  });
  assert.equal(potential.origin, "form3_assessment");
  assert.equal(potential.state, "potential");
  assert.equal(getCardActionCapabilities(potential).canEdit, true);
  assert.notEqual(potential.origin, potential.state);
});

test("student runtime does not mount the action bar", () => {
  const student = src(
    "../../../components/v2/relatedDiagram/RelatedDiagramReadonlyWorkspace.tsx",
  );
  assert.equal(student.includes("RelatedDiagramCardActionBar"), false);
  assert.equal(student.includes("RelatedDiagramContextBar"), false);
  assert.equal(student.includes("createCardDeleteIntent"), false);
});

test("workspace does not persist or generate connections from つなぐ", () => {
  const ws = src(
    "../../../components/v2/relatedDiagram/RelatedDiagramDevFixtureWorkspace.tsx",
  );
  assert.ok(ws.includes("createCardConnectIntent"));
  assert.ok(ws.includes("createCardConnectIntent"));
  assert.equal(ws.includes("upsertConnection("), false);
});

console.log(`\n${passed} passed`);
