/**
 * Slice 2B-2H-2 Nursing Problem Priority UX.
 * Action Popover + Picker wired to 2H-1 domain helper.
 * Run: npx tsx lib/v2/relatedDiagram/relatedDiagramSlice2B2H2.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { classifyActionPopoverPointer } from "./actionPopoverGesture";
import { commitDirectNursingProblemCreate } from "./cardDirectCreate";
import {
  applyHistoryCommand,
  emptyDiagramHistory,
  pushDiagramHistory,
  redoDiagramHistory,
  undoDiagramHistory,
} from "./diagramHistory";
import { visibleContextActions } from "./editorContextBar";
import { getCardActionCapabilities } from "./cardActionCapabilities";
import { EDITOR_TOUCH_TARGET_PX } from "./editorUiState";
import { seedStableRouteState } from "./incrementalRoutes";
import {
  formatNursingProblemPriorityBadge,
  resolveNursingProblemPriority,
} from "./nursingProblemPriority";
import {
  canSetNursingProblemPriority,
  commitNursingProblemPriorityPickerSelection,
  nursingProblemPriorityPickerOptions,
} from "./nursingProblemPriorityUi";
import { resolveDevFixtureReadonlyScene } from "./resolveReadonlyScene";
import { cardObstacle } from "./routeHardening";
import { createEmptySemanticGraph } from "./semanticGraph";
import type {
  RelatedDiagramCard,
  RelatedDiagramCardState,
  RelatedDiagramNursingProblem,
  RelatedDiagramNursingProblemStatus,
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

const uiLib = src("./nursingProblemPriorityUi.ts");
const domainLib = src("./nursingProblemPriority.ts");
const ws = src(
  "../../../components/v2/relatedDiagram/RelatedDiagramDevFixtureWorkspace.tsx",
);
const bar = src(
  "../../../components/v2/relatedDiagram/RelatedDiagramContextBar.tsx",
);
const picker = src(
  "../../../components/v2/relatedDiagram/RelatedDiagramPriorityPicker.tsx",
);
const popover = src(
  "../../../components/v2/relatedDiagram/RelatedDiagramActionPopover.tsx",
);
const gestureLib = src("./actionPopoverGesture.ts");
const connectionBar = src(
  "../../../components/v2/relatedDiagram/RelatedDiagramConnectionActionBar.tsx",
);
const cardNode = src(
  "../../../components/v2/relatedDiagram/RelatedDiagramCardNode.tsx",
);
const contextModel = src("./editorContextBar.ts");

const T0 = "2026-09-19T10:00:00.000Z";
const T1 = "2026-09-19T10:01:00.000Z";

function npCard(
  id: string,
  state: RelatedDiagramCardState = "current",
): RelatedDiagramCard {
  return {
    id,
    cardType: "nursing_problem",
    text: id,
    state,
    origin: "direct_insight",
    layout: { x: 40, y: 40, width: 200, height: 78, zIndex: 1 },
    isLocked: false,
    createdAt: T0,
    updatedAt: T0,
  };
}

function otherCard(
  id: string,
  cardType: RelatedDiagramCard["cardType"],
  state: RelatedDiagramCard["state"] = "current",
): RelatedDiagramCard {
  return {
    id,
    cardType,
    text: id,
    state,
    origin: cardType === "knowledge" ? "knowledge_library" : "direct_insight",
    layout: { x: 280, y: 40, width: 180, height: 72, zIndex: 1 },
    isLocked: false,
    createdAt: T0,
    updatedAt: T0,
  };
}

function npRow(
  cardId: string,
  priority: number | null,
  status: RelatedDiagramNursingProblemStatus = "active",
): RelatedDiagramNursingProblem {
  return { cardId, status, priority, createdAt: T0, updatedAt: T0 };
}

function graphOf(
  cards: RelatedDiagramCard[],
  rows: RelatedDiagramNursingProblem[],
): RelatedDiagramSemanticGraph {
  return { ...createEmptySemanticGraph(), cards, nursingProblems: rows };
}

function abcGraph(): RelatedDiagramSemanticGraph {
  return graphOf(
    [npCard("A"), npCard("B"), npCard("C")],
    [npRow("A", 1), npRow("B", 2), npRow("C", 3)],
  );
}

function labels(graph: RelatedDiagramSemanticGraph, cardId: string) {
  return nursingProblemPriorityPickerOptions(graph, cardId)?.map(
    (option) => option.label,
  );
}

function ranks(graph: RelatedDiagramSemanticGraph) {
  return Object.fromEntries(
    graph.nursingProblems.map((row) => [row.cardId, row.priority]),
  );
}

function badges(graph: RelatedDiagramSemanticGraph) {
  return Object.fromEntries(
    graph.cards
      .filter((card) => card.cardType === "nursing_problem")
      .map((card) => [
        card.id,
        formatNursingProblemPriorityBadge(
          resolveNursingProblemPriority(graph, card.id),
        ),
      ]),
  );
}

test("A active NPにPriority Action", () => {
  const graph = abcGraph();
  assert.equal(canSetNursingProblemPriority(graph, "A"), true);
  assert.deepEqual(
    visibleContextActions(getCardActionCapabilities(npCard("A")), false, true),
    ["edit", "connect", "priority", "delete"],
  );
  assert.ok(bar.includes('label="優先順位"'));
  assert.ok(bar.includes('action="priority"'));
});

test("B potential activeにも表示", () => {
  const graph = graphOf(
    [npCard("A"), npCard("P", "potential")],
    [npRow("A", 1), npRow("P", 2)],
  );
  assert.equal(canSetNursingProblemPriority(graph, "P"), true);
  assert.equal(graph.cards.find((card) => card.id === "P")?.state, "potential");
  assert.deepEqual(labels(graph, "P"), ["#1", "#2", "未設定"]);
});

test("C D E F Information / Understanding / Knowledge / integratedなし", () => {
  const graph = graphOf(
    [
      otherCard("I", "information", null),
      otherCard("U", "understanding"),
      otherCard("K", "knowledge"),
      npCard("N"),
    ],
    [npRow("N", null, "integrated")],
  );
  assert.equal(canSetNursingProblemPriority(graph, "I"), false);
  assert.equal(canSetNursingProblemPriority(graph, "U"), false);
  assert.equal(canSetNursingProblemPriority(graph, "K"), false);
  assert.equal(canSetNursingProblemPriority(graph, "N"), false);
  assert.equal(nursingProblemPriorityPickerOptions(graph, "I"), null);
  assert.equal(nursingProblemPriorityPickerOptions(graph, "N"), null);
  assert.deepEqual(
    visibleContextActions(getCardActionCapabilities(otherCard("I", "information", null)), false),
    ["connect", "delete"],
  );
  assert.deepEqual(
    visibleContextActions(getCardActionCapabilities(otherCard("U", "understanding")), false),
    ["edit", "connect", "delete"],
  );
  assert.deepEqual(
    visibleContextActions(getCardActionCapabilities(otherCard("K", "knowledge")), false),
    ["edit", "connect", "delete"],
  );
});

test("G null + K=2 → #1 #2 #3 + 未設定", () => {
  const graph = graphOf(
    [npCard("A"), npCard("B"), npCard("C")],
    [npRow("A", 1), npRow("B", 2), npRow("C", null)],
  );
  assert.deepEqual(labels(graph, "C"), ["#1", "#2", "#3", "未設定"]);
});

test("H assigned K=3 → #1 #2 #3 + 未設定", () => {
  assert.deepEqual(labels(abcGraph(), "B"), ["#1", "#2", "#3", "未設定"]);
});

test("I K=0 null → #1 + 未設定", () => {
  const graph = graphOf([npCard("C")], [npRow("C", null)]);
  assert.deepEqual(labels(graph, "C"), ["#1", "未設定"]);
});

test("J K current selected表示", () => {
  const options = nursingProblemPriorityPickerOptions(abcGraph(), "B");
  assert.equal(options?.find((option) => option.priority === 2)?.selected, true);
  assert.equal(options?.find((option) => option.priority === 1)?.selected, false);
});

test("K null selected表示", () => {
  const graph = graphOf([npCard("C")], [npRow("C", null)]);
  const options = nursingProblemPriorityPickerOptions(graph, "C");
  assert.equal(options?.find((option) => option.priority == null)?.selected, true);
  assert.equal(options?.find((option) => option.priority === 1)?.selected, false);
});

test("L #N表記", () => {
  const options = nursingProblemPriorityPickerOptions(abcGraph(), "A");
  assert.deepEqual(
    options?.filter((option) => option.priority != null).map((option) => option.label),
    ["#1", "#2", "#3"],
  );
  assert.equal(picker.includes("優先 1"), false);
  assert.equal(picker.includes("優先1"), false);
  assert.ok(picker.includes("option.label"));
});

test("M N O P Q R S mutation via domain helper", () => {
  const nullGraph = graphOf(
    [npCard("A"), npCard("B"), npCard("C")],
    [npRow("A", 1), npRow("B", 2), npRow("C", null)],
  );
  const toFirst = commitNursingProblemPriorityPickerSelection({
    graph: nullGraph,
    cardId: "C",
    priority: 1,
    now: T1,
  });
  assert.equal(toFirst.ok && toFirst.changed, true);
  if (!toFirst.ok || !toFirst.changed) return;
  assert.deepEqual(ranks(toFirst.graph), { A: 2, B: 3, C: 1 });
  assert.deepEqual(badges(toFirst.graph), { A: "#2", B: "#3", C: "#1" });

  const toLast = commitNursingProblemPriorityPickerSelection({
    graph: nullGraph,
    cardId: "C",
    priority: 3,
    now: T1,
  });
  assert.equal(toLast.ok && toLast.changed, true);
  if (!toLast.ok || !toLast.changed) return;
  assert.deepEqual(ranks(toLast.graph), { A: 1, B: 2, C: 3 });

  const up = commitNursingProblemPriorityPickerSelection({
    graph: abcGraph(),
    cardId: "C",
    priority: 1,
    now: T1,
  });
  assert.equal(up.ok && up.changed, true);
  if (!up.ok || !up.changed) return;
  assert.deepEqual(ranks(up.graph), { A: 2, B: 3, C: 1 });

  const down = commitNursingProblemPriorityPickerSelection({
    graph: abcGraph(),
    cardId: "A",
    priority: 3,
    now: T1,
  });
  assert.equal(down.ok && down.changed, true);
  if (!down.ok || !down.changed) return;
  assert.deepEqual(ranks(down.graph), { A: 3, B: 1, C: 2 });

  const unset = commitNursingProblemPriorityPickerSelection({
    graph: abcGraph(),
    cardId: "B",
    priority: null,
    now: T1,
  });
  assert.equal(unset.ok && unset.changed, true);
  if (!unset.ok || !unset.changed) return;
  assert.deepEqual(ranks(unset.graph), { A: 1, B: null, C: 2 });
  assert.deepEqual(badges(unset.graph), { A: "#1", B: null, C: "#2" });
  assert.ok(uiLib.includes("assignNursingProblemPriority"));
  assert.equal(uiLib.includes("applyRankedOrder"), false);
  assert.ok(domainLib.includes("export function assignNursingProblemPriority"));
});

test("T U V same priority = NO-OP", () => {
  const graph = abcGraph();
  const history = emptyDiagramHistory();
  const next = commitNursingProblemPriorityPickerSelection({
    graph,
    cardId: "B",
    priority: 2,
    now: T1,
  });
  assert.equal(next.ok, true);
  if (!next.ok) return;
  assert.equal(next.changed, false);
  assert.equal(next.graph, graph);
  assert.equal(history.past.length, 0);
  assert.equal(
    next.graph.nursingProblems.find((row) => row.cardId === "B")?.updatedAt,
    T0,
  );
});

test("W X Y Z 1 selection = 1 history + badge Undo/Redo", () => {
  const before = abcGraph();
  const selected = commitNursingProblemPriorityPickerSelection({
    graph: before,
    cardId: "C",
    priority: 1,
    now: T1,
  });
  assert.equal(selected.ok && selected.changed, true);
  if (!selected.ok || !selected.changed) return;
  let history = pushDiagramHistory(emptyDiagramHistory(), selected.action);
  assert.equal(history.past.length, 1);
  assert.equal(history.past[0]?.type, "setNursingProblemPriorities");
  let graph = selected.graph;
  assert.deepEqual(badges(graph), { A: "#2", B: "#3", C: "#1" });
  const undone = undoDiagramHistory(history);
  graph = applyHistoryCommand(graph, undone.command);
  assert.deepEqual(ranks(graph), { A: 1, B: 2, C: 3 });
  assert.deepEqual(badges(graph), { A: "#1", B: "#2", C: "#3" });
  history = undone.history;
  const redone = redoDiagramHistory(history);
  graph = applyHistoryCommand(graph, redone.command);
  assert.deepEqual(badges(graph), { A: "#2", B: "#3", C: "#1" });
});

test("AA AB AC Direct Create null then Picker can set", () => {
  const created = commitDirectNursingProblemCreate({
    draft: { text: "新規看護問題", state: "current" },
    graph: abcGraph(),
    cardId: "dnp_h2",
    now: T1,
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  assert.equal(created.graph.nursingProblems.find((row) => row.cardId === "dnp_h2")?.priority, null);
  assert.equal(resolveNursingProblemPriority(created.graph, "dnp_h2"), null);
  assert.equal(formatNursingProblemPriorityBadge(null), null);
  assert.deepEqual(labels(created.graph, "dnp_h2"), ["#1", "#2", "#3", "#4", "未設定"]);
  const set = commitNursingProblemPriorityPickerSelection({
    graph: created.graph,
    cardId: "dnp_h2",
    priority: 1,
    now: T1,
  });
  assert.equal(set.ok && set.changed, true);
  if (!set.ok || !set.changed) return;
  assert.equal(resolveNursingProblemPriority(set.graph, "dnp_h2"), 1);
  assert.equal(formatNursingProblemPriorityBadge(1), "#1");
});

test("AD AE AF AG AH AI interaction / overflow", () => {
  assert.equal(EDITOR_TOUCH_TARGET_PX, 44);
  assert.ok(picker.includes("min-h-[44px]"));
  assert.ok(picker.includes("EDITOR_TOUCH_TARGET_PX"));
  assert.ok(bar.includes("min-h-[44px]"));
  assert.ok(ws.includes('kind="priority"'));
  assert.ok(ws.includes("setPriorityPickerOpen(false)"));
  assert.ok(ws.includes("if (priorityPickerOpen) return"));
  assert.ok(ws.includes("onDismiss={() => setPriorityPickerOpen(false)}"));
  assert.equal(
    classifyActionPopoverPointer({
      kind: "priority",
      pointerCount: 1,
      targetIsPopover: false,
    }),
    "dismiss-outside",
  );
  assert.equal(
    classifyActionPopoverPointer({
      kind: "priority",
      pointerCount: 2,
      targetIsPopover: true,
    }),
    "dismiss-gesture",
  );
  assert.equal(
    classifyActionPopoverPointer({
      kind: "priority",
      pointerCount: 1,
      targetIsPopover: true,
    }),
    "ignore",
  );
  assert.ok(picker.includes("overflow-y-auto"));
  assert.ok(picker.includes("data-rd-priority-picker-scroll"));
  assert.ok(ws.includes("window.innerWidth"));
  assert.ok(ws.includes("window.innerHeight"));
  assert.ok(popover.includes("placeActionPopover"));
});

test("AJ AK AL AM AN geometry 不変", () => {
  const scene = resolveDevFixtureReadonlyScene();
  const layoutSnap = JSON.stringify(
    scene.graph.cards.map((card) => ({ id: card.id, ...card.layout })),
  );
  const obstacleSnap = JSON.stringify(scene.graph.cards.map(cardObstacle));
  const seeded = seedStableRouteState(scene.graph.cards, scene.graph.connections);
  const routeSnap = JSON.stringify(seeded);
  const topologySnap = JSON.stringify(scene.routeTopology);
  const next = commitNursingProblemPriorityPickerSelection({
    graph: scene.graph,
    cardId: "demo_np2",
    priority: 1,
    now: T1,
  });
  assert.equal(next.ok && next.changed, true);
  if (!next.ok || !next.changed) return;
  assert.equal(
    JSON.stringify(next.graph.cards.map((card) => ({ id: card.id, ...card.layout }))),
    layoutSnap,
  );
  assert.equal(JSON.stringify(next.graph.cards.map(cardObstacle)), obstacleSnap);
  assert.equal(
    JSON.stringify(seedStableRouteState(next.graph.cards, next.graph.connections)),
    routeSnap,
  );
  assert.equal(JSON.stringify(scene.routeTopology), topologySnap);
  assert.equal(
    JSON.stringify(next.graph.connections),
    JSON.stringify(scene.graph.connections),
  );
  assert.deepEqual(badges(next.graph), {
    demo_np: "#2",
    demo_np2: "#1",
  });
});

test("AO AP AQ print", () => {
  assert.equal(cardNode.includes("rd-no-print"), false);
  assert.ok(cardNode.includes("data-rd-np-priority-badge"));
  assert.ok(picker.includes("rd-no-print"));
  assert.ok(bar.includes("rd-no-print"));
  assert.ok(popover.includes("rd-no-print"));
  assert.ok(bar.includes("優先順位"));
});

test("AR AS AT protected 2G / Card actions", () => {
  assert.ok(ws.includes('kind="connection"'));
  assert.ok(ws.includes("handleStudentConnectionReverse"));
  assert.ok(ws.includes("handleStudentConnectionRelationChange"));
  assert.ok(connectionBar.includes("onReverse"));
  assert.ok(bar.includes('label="編集"'));
  assert.ok(bar.includes('label="つなぐ"'));
  assert.ok(bar.includes('label="削除"'));
  assert.ok(ws.includes("handleCardEdit"));
  assert.ok(ws.includes("handleCardConnect"));
  assert.ok(ws.includes("requestDeleteSelected"));
  assert.ok(gestureLib.includes('"connection"'));
  assert.ok(contextModel.includes('"priority"'));
  assert.equal(ws.includes("suggestPriority"), false);
  assert.equal(picker.includes("auto rank"), false);
});

test("workspace wires Picker to 2H-1 helper", () => {
  assert.ok(ws.includes("commitNursingProblemPriorityPickerSelection"));
  assert.ok(ws.includes("nursingProblemPriorityPickerOptions"));
  assert.ok(ws.includes("canSetNursingProblemPriority"));
  assert.ok(ws.includes("RelatedDiagramPriorityPicker"));
  assert.ok(ws.includes("setNursingProblemPriorities") || uiLib.includes("setNursingProblemPriorities"));
  assert.equal(ws.includes("setNursingProblemPriority("), false);
});

console.log(`\n${passed} tests passed`);
