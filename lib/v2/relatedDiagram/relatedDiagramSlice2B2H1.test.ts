/**
 * Slice 2B-2H-1 Nursing Problem Priority Domain + Badge.
 * Reorder / history / delete compact / #N overlay. No picker UI.
 * Run: npx tsx lib/v2/relatedDiagram/relatedDiagramSlice2B2H1.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { removeCardAndIncidentConnections, snapshotCardForDelete } from "./cardDelete";
import { deleteManagedConnection } from "./cardConnectionManage";
import { commitDirectNursingProblemCreate } from "./cardDirectCreate";
import {
  applyHistoryCommand,
  emptyDiagramHistory,
  pushDiagramHistory,
  redoDiagramHistory,
  undoDiagramHistory,
} from "./diagramHistory";
import { seedStableRouteState } from "./incrementalRoutes";
import {
  assignNursingProblemPriority,
  cloneNursingProblems,
  compactActiveNursingProblemPriorities,
  formatNursingProblemPriorityBadge,
  resolveNursingProblemPriority,
} from "./nursingProblemPriority";
import { resolveDevFixtureReadonlyScene } from "./resolveReadonlyScene";
import { cardObstacle } from "./routeHardening";
import { createEmptySemanticGraph, deleteConnection } from "./semanticGraph";
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

const helperLib = src("./nursingProblemPriority.ts");
const historyLib = src("./diagramHistory.ts");
const deleteLib = src("./cardDelete.ts");
const cardNode = src(
  "../../../components/v2/relatedDiagram/RelatedDiagramCardNode.tsx",
);
const surface = src(
  "../../../components/v2/relatedDiagram/RelatedDiagramA3Surface.tsx",
);
const ws = src(
  "../../../components/v2/relatedDiagram/RelatedDiagramDevFixtureWorkspace.tsx",
);
const actionPopover = src(
  "../../../components/v2/relatedDiagram/RelatedDiagramActionPopover.tsx",
);
const contextBarModel = src("./editorContextBar.ts");
const capabilities = src("./cardActionCapabilities.ts");
const printPortal = src(
  "../../../components/v2/relatedDiagram/RelatedDiagramPrintPortal.tsx",
);
const semanticLib = src("./semanticGraph.ts");

const T0 = "2026-09-19T10:00:00.000Z";
const T1 = "2026-09-19T10:01:00.000Z";
const T2 = "2026-09-19T10:02:00.000Z";

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

function understandingCard(id: string): RelatedDiagramCard {
  return {
    id,
    cardType: "understanding",
    text: id,
    state: "current",
    origin: "direct_insight",
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
  updatedAt = T0,
): RelatedDiagramNursingProblem {
  return {
    cardId,
    status,
    priority,
    createdAt: T0,
    updatedAt,
  };
}

function graphOf(
  cards: RelatedDiagramCard[],
  rows: RelatedDiagramNursingProblem[],
): RelatedDiagramSemanticGraph {
  return {
    ...createEmptySemanticGraph(),
    cards,
    nursingProblems: rows,
  };
}

function abcGraph(): RelatedDiagramSemanticGraph {
  return graphOf(
    [npCard("A"), npCard("B"), npCard("C")],
    [npRow("A", 1), npRow("B", 2), npRow("C", 3)],
  );
}

function pri(
  graph: RelatedDiagramSemanticGraph,
  cardId: string,
): number | null | undefined {
  return graph.nursingProblems.find((row) => row.cardId === cardId)?.priority;
}

function updatedAtOf(
  graph: RelatedDiagramSemanticGraph,
  cardId: string,
): string | undefined {
  return graph.nursingProblems.find((row) => row.cardId === cardId)?.updatedAt;
}

function ranks(
  graph: RelatedDiagramSemanticGraph,
): Record<string, number | null> {
  return Object.fromEntries(
    graph.nursingProblems.map((row) => [row.cardId, row.priority]),
  );
}

function assertContinuousRanks(graph: RelatedDiagramSemanticGraph) {
  const ranked = graph.nursingProblems
    .filter((row) => row.status === "active" && row.priority != null)
    .map((row) => row.priority as number)
    .sort((a, b) => a - b);
  assert.deepEqual(
    ranked,
    ranked.map((_, index) => index + 1),
  );
  assert.equal(new Set(ranked).size, ranked.length);
}

test("A priority型 number|null", () => {
  const graph = abcGraph();
  const nullGraph = graphOf([npCard("D")], [npRow("D", null)]);
  assert.equal(typeof pri(graph, "A"), "number");
  assert.equal(pri(nullGraph, "D"), null);
  assert.ok(src("./types.ts").includes("priority: number | null"));
});

test("B activeのみ対象", () => {
  const graph = graphOf(
    [npCard("A"), understandingCard("U")],
    [npRow("A", 1)],
  );
  const rejected = assignNursingProblemPriority(graph, "U", 1, T1);
  assert.equal(rejected.ok, false);
  if (!rejected.ok) assert.equal(rejected.code, "not_nursing_problem");
  assert.equal(pri(graph, "A"), 1);
});

test("C potential activeも対象", () => {
  const graph = graphOf(
    [npCard("A"), npCard("P", "potential")],
    [npRow("A", 1), npRow("P", null)],
  );
  const next = assignNursingProblemPriority(graph, "P", 1, T1);
  assert.equal(next.ok, true);
  if (!next.ok) return;
  assert.deepEqual(ranks(next.graph), { A: 2, P: 1 });
  assert.equal(next.graph.cards.find((card) => card.id === "P")?.state, "potential");
});

test("D integrated対象外", () => {
  const graph = graphOf(
    [npCard("A"), npCard("I")],
    [npRow("A", 1), npRow("I", null, "integrated")],
  );
  const rejected = assignNursingProblemPriority(graph, "I", 1, T1);
  assert.equal(rejected.ok, false);
  if (!rejected.ok) assert.equal(rejected.code, "not_active");
  assert.equal(pri(graph, "I"), null);
  assert.equal(formatNursingProblemPriorityBadge(resolveNursingProblemPriority(graph, "I")), null);
});

test("E null許可", () => {
  const graph = graphOf([npCard("A"), npCard("B")], [npRow("A", 1), npRow("B", null)]);
  assert.equal(pri(graph, "B"), null);
  assert.equal(formatNursingProblemPriorityBadge(pri(graph, "B")), null);
});

test("F C3 → 1 = C1 A2 B3", () => {
  const next = assignNursingProblemPriority(abcGraph(), "C", 1, T1);
  assert.equal(next.ok && next.changed, true);
  if (!next.ok) return;
  assert.deepEqual(ranks(next.graph), { A: 2, B: 3, C: 1 });
  assertContinuousRanks(next.graph);
});

test("G A1 → 3 = B1 C2 A3", () => {
  const next = assignNursingProblemPriority(abcGraph(), "A", 3, T1);
  assert.equal(next.ok && next.changed, true);
  if (!next.ok) return;
  assert.deepEqual(ranks(next.graph), { A: 3, B: 1, C: 2 });
  assertContinuousRanks(next.graph);
});

test("H null → 1", () => {
  const graph = graphOf(
    [npCard("A"), npCard("B"), npCard("C")],
    [npRow("A", 1), npRow("B", 2), npRow("C", null)],
  );
  const next = assignNursingProblemPriority(graph, "C", 1, T1);
  assert.equal(next.ok && next.changed, true);
  if (!next.ok) return;
  assert.deepEqual(ranks(next.graph), { A: 2, B: 3, C: 1 });
});

test("I null → K+1", () => {
  const graph = graphOf(
    [npCard("A"), npCard("B"), npCard("C")],
    [npRow("A", 1), npRow("B", 2), npRow("C", null)],
  );
  const next = assignNursingProblemPriority(graph, "C", 3, T1);
  assert.equal(next.ok && next.changed, true);
  if (!next.ok) return;
  assert.deepEqual(ranks(next.graph), { A: 1, B: 2, C: 3 });
  assert.equal(updatedAtOf(next.graph, "A"), T0);
  assert.equal(updatedAtOf(next.graph, "B"), T0);
});

test("J priority → null compact", () => {
  const next = assignNursingProblemPriority(abcGraph(), "B", null, T1);
  assert.equal(next.ok && next.changed, true);
  if (!next.ok) return;
  assert.deepEqual(ranks(next.graph), { A: 1, B: null, C: 2 });
  assertContinuousRanks(next.graph);
});

test("K L duplicateなし gapなし", () => {
  const moved = assignNursingProblemPriority(abcGraph(), "C", 1, T1);
  assert.equal(moved.ok, true);
  if (!moved.ok) return;
  assertContinuousRanks(moved.graph);
  const values = moved.graph.nursingProblems.map((row) => row.priority);
  assert.equal(new Set(values).size, values.length);
});

test("M stable reorder", () => {
  const next = assignNursingProblemPriority(abcGraph(), "C", 2, T1);
  assert.equal(next.ok, true);
  if (!next.ok) return;
  assert.deepEqual(ranks(next.graph), { A: 1, B: 3, C: 2 });
});

test("N O P same priority = NO-OP", () => {
  const graph = abcGraph();
  const history = emptyDiagramHistory();
  const next = assignNursingProblemPriority(graph, "B", 2, T1);
  assert.equal(next.ok, true);
  if (!next.ok) return;
  assert.equal(next.changed, false);
  assert.equal(next.graph, graph);
  assert.equal(updatedAtOf(next.graph, "B"), T0);
  assert.equal(history.past.length, 0);
});

test("Q R changed rowsのみupdatedAt更新", () => {
  const next = assignNursingProblemPriority(abcGraph(), "C", 1, T1);
  assert.equal(next.ok, true);
  if (!next.ok) return;
  assert.equal(updatedAtOf(next.graph, "C"), T1);
  assert.equal(updatedAtOf(next.graph, "A"), T1);
  assert.equal(updatedAtOf(next.graph, "B"), T1);
  const append = assignNursingProblemPriority(
    graphOf(
      [npCard("A"), npCard("B"), npCard("C")],
      [npRow("A", 1), npRow("B", 2), npRow("C", null)],
    ),
    "C",
    3,
    T1,
  );
  assert.equal(append.ok, true);
  if (!append.ok) return;
  assert.equal(updatedAtOf(append.graph, "C"), T1);
  assert.equal(updatedAtOf(append.graph, "A"), T0);
  assert.equal(updatedAtOf(append.graph, "B"), T0);
});

test("S T U V reorder = 1 history action exact Undo/Redo", () => {
  const beforeGraph = abcGraph();
  const assigned = assignNursingProblemPriority(beforeGraph, "C", 1, T1);
  assert.equal(assigned.ok && assigned.changed, true);
  if (!assigned.ok) return;
  let history = pushDiagramHistory(emptyDiagramHistory(), {
    type: "setNursingProblemPriorities",
    before: cloneNursingProblems(beforeGraph.nursingProblems),
    after: cloneNursingProblems(assigned.graph.nursingProblems),
  });
  assert.equal(history.past.length, 1);
  assert.equal(history.past[0]?.type, "setNursingProblemPriorities");
  let graph = assigned.graph;
  const undone = undoDiagramHistory(history);
  graph = applyHistoryCommand(graph, undone.command);
  assert.deepEqual(ranks(graph), { A: 1, B: 2, C: 3 });
  assert.equal(updatedAtOf(graph, "A"), T0);
  assert.equal(updatedAtOf(graph, "C"), T0);
  history = undone.history;
  const redone = redoDiagramHistory(history);
  graph = applyHistoryCommand(graph, redone.command);
  assert.deepEqual(ranks(graph), { A: 2, B: 3, C: 1 });
  assert.equal(updatedAtOf(graph, "C"), T1);
  assert.equal(historyLib.includes("assignNursingProblemPriority"), false);
  assert.ok(historyLib.includes('kind: "restoreNursingProblems"'));
});

test("W Direct Create priority null維持", () => {
  const created = commitDirectNursingProblemCreate({
    draft: { text: "新規看護問題", state: "current" },
    graph: createEmptySemanticGraph(),
    cardId: "dnp_h1",
    now: T1,
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  assert.equal(created.graph.nursingProblems[0]?.priority, null);
  assert.equal(created.entity.nursingProblem?.priority, null);
});

test("X priority付きNP deleteでcompact", () => {
  const deleted = removeCardAndIncidentConnections(abcGraph(), "B", T1);
  assert.equal(deleted.cards.some((card) => card.id === "B"), false);
  assert.deepEqual(ranks(deleted), { A: 1, C: 2 });
  assert.equal(updatedAtOf(deleted, "A"), T0);
  assert.equal(updatedAtOf(deleted, "C"), T1);
});

test("Y null NP deleteで順位不変", () => {
  const graph = graphOf(
    [npCard("A"), npCard("B"), npCard("C")],
    [npRow("A", 1), npRow("B", 2), npRow("C", null)],
  );
  const deleted = removeCardAndIncidentConnections(graph, "C", T1);
  assert.deepEqual(ranks(deleted), { A: 1, B: 2 });
  assert.equal(updatedAtOf(deleted, "A"), T0);
  assert.equal(updatedAtOf(deleted, "B"), T0);
});

test("Z Connection deleteでpriority不変", () => {
  const scene = resolveDevFixtureReadonlyScene();
  const before = JSON.stringify(scene.graph.nursingProblems);
  const student = scene.graph.connections.find(
    (row) => row.origin === "student_diagram",
  );
  assert.ok(student);
  const removed = deleteConnection(scene.graph, student!.id);
  assert.equal(removed.ok, true);
  if (!removed.ok) return;
  assert.equal(JSON.stringify(removed.graph.nursingProblems), before);
  const seeded = seedStableRouteState(scene.graph.cards, scene.graph.connections);
  const managed = deleteManagedConnection({
    graph: scene.graph,
    routeState: seeded,
    topology: scene.routeTopology,
    connectionId: student!.id,
  });
  assert.equal(managed.ok, true);
  if (!managed.ok) return;
  assert.equal(JSON.stringify(managed.graph.nursingProblems), before);
});

test("AA AB AC Card Delete = 1 history action exact Undo/Redo", () => {
  const beforeGraph = abcGraph();
  const entity = snapshotCardForDelete(beforeGraph, "B");
  assert.ok(entity);
  const afterGraph = removeCardAndIncidentConnections(beforeGraph, "B", T1);
  let history = pushDiagramHistory(emptyDiagramHistory(), {
    type: "deleteCard",
    entity: entity!,
    nursingProblemsBefore: cloneNursingProblems(beforeGraph.nursingProblems),
    nursingProblemsAfter: cloneNursingProblems(afterGraph.nursingProblems),
  });
  assert.equal(history.past.length, 1);
  assert.equal(history.past[0]?.type, "deleteCard");
  let graph = afterGraph;
  const undone = undoDiagramHistory(history);
  graph = applyHistoryCommand(graph, undone.command);
  assert.equal(graph.cards.some((card) => card.id === "B"), true);
  assert.deepEqual(ranks(graph), { A: 1, B: 2, C: 3 });
  assert.equal(updatedAtOf(graph, "B"), T0);
  assert.equal(updatedAtOf(graph, "C"), T0);
  history = undone.history;
  const redone = redoDiagramHistory(history);
  graph = applyHistoryCommand(graph, redone.command);
  assert.equal(graph.cards.some((card) => card.id === "B"), false);
  assert.deepEqual(ranks(graph), { A: 1, C: 2 });
  assert.equal(updatedAtOf(graph, "C"), T1);
});

test("AD AE AF AG AH badge #N", () => {
  assert.equal(formatNursingProblemPriorityBadge(1), "#1");
  assert.equal(formatNursingProblemPriorityBadge(2), "#2");
  assert.equal(formatNursingProblemPriorityBadge(3), "#3");
  assert.equal(formatNursingProblemPriorityBadge(null), null);
  const scene = resolveDevFixtureReadonlyScene();
  assert.equal(resolveNursingProblemPriority(scene.graph, "demo_np"), 1);
  assert.equal(resolveNursingProblemPriority(scene.graph, "demo_np2"), 2);
  assert.equal(
    formatNursingProblemPriorityBadge(
      resolveNursingProblemPriority(scene.graph, "demo_np"),
    ),
    "#1",
  );
  assert.equal(
    formatNursingProblemPriorityBadge(
      resolveNursingProblemPriority(scene.graph, "demo_np2"),
    ),
    "#2",
  );
  const integrated = graphOf(
    [npCard("I")],
    [npRow("I", 1, "integrated")],
  );
  assert.equal(resolveNursingProblemPriority(integrated, "I"), null);
  assert.equal(scene.graph.cards.find((card) => card.id === "demo_np2")?.state, "potential");
  assert.ok(cardNode.includes("data-rd-np-priority-badge"));
  assert.ok(cardNode.includes("formatNursingProblemPriorityBadge"));
  assert.equal(cardNode.includes("優先 1"), false);
  assert.equal(cardNode.includes("優先1"), false);
});

test("AI AJ AK AL AM geometry / routing 不変", () => {
  const scene = resolveDevFixtureReadonlyScene();
  const layoutSnap = JSON.stringify(
    scene.graph.cards.map((card) => ({
      id: card.id,
      ...card.layout,
    })),
  );
  const obstacleSnap = JSON.stringify(scene.graph.cards.map(cardObstacle));
  const seeded = seedStableRouteState(scene.graph.cards, scene.graph.connections);
  const routeSnap = JSON.stringify(seeded);
  const topologySnap = JSON.stringify(scene.routeTopology);
  const assigned = assignNursingProblemPriority(scene.graph, "demo_np2", 1, T1);
  assert.equal(assigned.ok, true);
  if (!assigned.ok) return;
  assert.equal(
    JSON.stringify(
      assigned.graph.cards.map((card) => ({
        id: card.id,
        ...card.layout,
      })),
    ),
    layoutSnap,
  );
  assert.equal(
    JSON.stringify(assigned.graph.cards.map(cardObstacle)),
    obstacleSnap,
  );
  assert.equal(
    JSON.stringify(
      seedStableRouteState(assigned.graph.cards, assigned.graph.connections),
    ),
    routeSnap,
  );
  assert.equal(JSON.stringify(scene.routeTopology), topologySnap);
  assert.equal(
    JSON.stringify(assigned.graph.connections),
    JSON.stringify(scene.graph.connections),
  );
});

test("AN AO print対象 / 2H-1 domainはPickerを持たない", () => {
  assert.ok(surface.includes("resolveNursingProblemPriority"));
  assert.ok(ws.includes("RelatedDiagramPrintPortal"));
  assert.ok(ws.includes("RelatedDiagramA3Surface"));
  assert.equal(cardNode.includes("rd-no-print"), false);
  assert.equal(helperLib.includes("assignNursingProblemPriority"), true);
  assert.equal(helperLib.includes("優先順位"), false);
  assert.equal(actionPopover.includes("優先順位"), false);
  assert.equal(contextBarModel.includes("優先順位"), false);
  assert.equal(capabilities.includes("優先順位"), false);
  assert.equal(printPortal.includes("data-rd-np-priority"), false);
  assert.ok(ws.includes("nursingProblemsBefore"));
  assert.ok(ws.includes("nursingProblemsAfter"));
  assert.ok(deleteLib.includes("compactActiveNursingProblemPriorities"));
  assert.equal(helperLib.includes("setNursingProblemPriority"), false);
  assert.ok(semanticLib.includes("export function setNursingProblemPriority"));
});

test("helper rejects invalid rank and leaves graph", () => {
  const graph = abcGraph();
  const tooHigh = assignNursingProblemPriority(graph, "A", 4, T1);
  assert.equal(tooHigh.ok, false);
  const nullInsert = assignNursingProblemPriority(
    graphOf([npCard("A"), npCard("C")], [npRow("A", 1), npRow("C", null)]),
    "C",
    3,
    T1,
  );
  assert.equal(nullInsert.ok, false);
  assert.equal(pri(graph, "A"), 1);
});

test("compact no-op keeps timestamps", () => {
  const graph = abcGraph();
  const next = compactActiveNursingProblemPriorities(graph, T2);
  assert.equal(next.changed, false);
  assert.equal(next.graph, graph);
});

test("2H-1 does not add picker / AI ranking", () => {
  assert.equal(helperLib.includes("auto rank"), false);
  assert.equal(helperLib.includes("suggestPriority"), false);
  assert.equal(ws.includes("Priority Picker"), false);
  assert.equal(cardNode.includes("absolute right-[5px] top-[4px]"), true);
});

console.log(`\n${passed} tests passed`);
