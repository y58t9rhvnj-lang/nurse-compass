/**
 * L3-A arrange apply + history + route regeneration.
 * Run: node_modules/.bin/jiti lib/v2/relatedDiagram/applyRelatedDiagramLayout.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyCardPositionToGraph } from "./cardInteractionState";
import {
  applySceneFragmentToGraph,
  emptyDiagramHistory,
  pushDiagramHistory,
  redoDiagramHistory,
  undoDiagramHistory,
} from "./diagramHistory";
import {
  ARRANGE_IMPOSSIBLE_MESSAGE,
  applyLayoutPositionsToGraph,
  arrangeNoticeMessage,
  arrangeRelatedDiagramScene,
  arrangeRelatedDiagramUiLocked,
} from "./applyRelatedDiagramLayout";
import { layoutRelatedDiagram } from "./diagramLayout";
import { seedStableRouteState } from "./incrementalRoutes";
import { topologyMembershipSnapshot } from "./regenerateRouteTopology";
import { resolveDevFixtureReadonlyScene } from "./resolveReadonlyScene";
import { STUDENT_RELATED_DIAGRAM_UNSAVED_EDITING } from "./studentForm3RelatedDiagramBoundary";
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

function card(
  id: string,
  x: number,
  y: number,
  width = 80,
  height = 40,
): RelatedDiagramCard {
  return {
    id,
    cardType: "information",
    text: id,
    state: null,
    origin: "patient_information",
    layout: { x, y, width, height, zIndex: 1 },
    isLocked: false,
    createdAt: "2026-09-20T00:00:00.000Z",
    updatedAt: "2026-09-20T00:00:00.000Z",
  };
}

function emptyGraph(cards: RelatedDiagramCard[]): RelatedDiagramSemanticGraph {
  return {
    semanticSchemaVersion: "1",
    cards,
    cardSources: [],
    connections: [],
    nursingProblems: [],
    nursingProblemSupports: [],
    integrations: [],
    integrationMembers: [],
  };
}

function fixtureScene() {
  const scene = resolveDevFixtureReadonlyScene({ includeStyleDemo: true });
  const routeState = seedStableRouteState(
    scene.graph.cards,
    scene.graph.connections,
    scene.routeTopology,
  );
  return { ...scene, routeState };
}

function overlapFixture() {
  const scene = fixtureScene();
  const target = scene.graph.cards.find((item) => item.id === "demo_u_cur");
  assert.ok(target);
  const graph = applyCardPositionToGraph(
    scene.graph,
    "demo_info",
    target.layout.x,
    target.layout.y,
  );
  return {
    ...scene,
    graph,
    routeState: seedStableRouteState(
      graph.cards,
      graph.connections,
      scene.routeTopology,
    ),
  };
}

function positionsOf(graph: RelatedDiagramSemanticGraph) {
  return graph.cards
    .map((item) => ({ id: item.id, x: item.layout.x, y: item.layout.y }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

test("A. already arranged is a no-op without history", () => {
  const graph = emptyGraph([card("solo-a", 40, 40), card("solo-b", 240, 40)]);
  const frozen = structuredClone(graph);
  const routeState = seedStableRouteState(graph.cards, graph.connections);
  const result = arrangeRelatedDiagramScene({ graph, routeState });
  assert.equal(result.kind, "noop");
  assert.deepEqual(result.layout.changedCardIds, []);
  assert.deepEqual(graph, frozen);
});

test("B. overlap applies new card positions", () => {
  const scene = overlapFixture();
  const result = arrangeRelatedDiagramScene({
    graph: scene.graph,
    routeState: scene.routeState,
    topology: scene.routeTopology,
  });
  assert.equal(result.kind, "applied");
  if (result.kind !== "applied") return;
  assert.ok(result.layout.changedCardIds.length > 0);
  const info = result.graph.cards.find((item) => item.id === "demo_info")!;
  const und = result.graph.cards.find((item) => item.id === "demo_u_cur")!;
  assert.ok(info.layout.x !== und.layout.x || info.layout.y !== und.layout.y);
});

test("C. one arrange is one moveGroup history entry", () => {
  const scene = overlapFixture();
  const result = arrangeRelatedDiagramScene({
    graph: scene.graph,
    routeState: scene.routeState,
    topology: scene.routeTopology,
  });
  assert.equal(result.kind, "applied");
  if (result.kind !== "applied") return;
  assert.equal(result.historyAction.type, "moveGroup");
  const history = pushDiagramHistory(emptyDiagramHistory(), result.historyAction);
  assert.equal(history.past.length, 1);
  assert.equal(history.future.length, 0);
});

test("D. Undo restores card x/y exactly", () => {
  const scene = overlapFixture();
  const original = positionsOf(scene.graph);
  const result = arrangeRelatedDiagramScene({
    graph: scene.graph,
    routeState: scene.routeState,
    topology: scene.routeTopology,
  });
  assert.equal(result.kind, "applied");
  if (result.kind !== "applied") return;
  const undone = undoDiagramHistory(
    pushDiagramHistory(emptyDiagramHistory(), result.historyAction),
  );
  const restored = applySceneFragmentToGraph(result.graph, undone.fragment!);
  assert.deepEqual(positionsOf(restored), original);
});

test("E. Undo restores routeState exactly", () => {
  const scene = overlapFixture();
  const result = arrangeRelatedDiagramScene({
    graph: scene.graph,
    routeState: scene.routeState,
    topology: scene.routeTopology,
  });
  assert.equal(result.kind, "applied");
  if (result.kind !== "applied") return;
  const undone = undoDiagramHistory(
    pushDiagramHistory(emptyDiagramHistory(), result.historyAction),
  );
  assert.deepEqual(undone.fragment!.routeState, scene.routeState);
});

test("F. Undo restores topology exactly", () => {
  const scene = overlapFixture();
  const result = arrangeRelatedDiagramScene({
    graph: scene.graph,
    routeState: scene.routeState,
    topology: scene.routeTopology,
  });
  assert.equal(result.kind, "applied");
  if (result.kind !== "applied") return;
  const undone = undoDiagramHistory(
    pushDiagramHistory(emptyDiagramHistory(), result.historyAction),
  );
  assert.deepEqual(undone.fragment!.topology, scene.routeTopology);
});

test("G. Redo restores arranged card positions", () => {
  const scene = overlapFixture();
  const result = arrangeRelatedDiagramScene({
    graph: scene.graph,
    routeState: scene.routeState,
    topology: scene.routeTopology,
  });
  assert.equal(result.kind, "applied");
  if (result.kind !== "applied") return;
  let history = pushDiagramHistory(emptyDiagramHistory(), result.historyAction);
  const undone = undoDiagramHistory(history);
  const redone = redoDiagramHistory(undone.history);
  const restored = applySceneFragmentToGraph(scene.graph, redone.fragment!);
  assert.deepEqual(positionsOf(restored), positionsOf(result.graph));
});

test("H. Redo restores arranged routeState", () => {
  const scene = overlapFixture();
  const result = arrangeRelatedDiagramScene({
    graph: scene.graph,
    routeState: scene.routeState,
    topology: scene.routeTopology,
  });
  assert.equal(result.kind, "applied");
  if (result.kind !== "applied") return;
  const undone = undoDiagramHistory(
    pushDiagramHistory(emptyDiagramHistory(), result.historyAction),
  );
  const redone = redoDiagramHistory(undone.history);
  assert.deepEqual(redone.fragment!.routeState, result.routeState);
});

test("I. Redo restores arranged topology", () => {
  const scene = overlapFixture();
  const result = arrangeRelatedDiagramScene({
    graph: scene.graph,
    routeState: scene.routeState,
    topology: scene.routeTopology,
  });
  assert.equal(result.kind, "applied");
  if (result.kind !== "applied") return;
  const undone = undoDiagramHistory(
    pushDiagramHistory(emptyDiagramHistory(), result.historyAction),
  );
  const redone = redoDiagramHistory(undone.history);
  assert.deepEqual(redone.fragment!.topology, result.topology);
});

test("J. Junction IDs are unchanged", () => {
  const scene = overlapFixture();
  const before = scene.routeTopology!.branchPoints.map((bp) => bp.id).sort();
  const result = arrangeRelatedDiagramScene({
    graph: scene.graph,
    routeState: scene.routeState,
    topology: scene.routeTopology,
  });
  assert.equal(result.kind, "applied");
  if (result.kind !== "applied") return;
  const after = result.topology!.branchPoints.map((bp) => bp.id).sort();
  assert.deepEqual(after, before);
});

test("K. Junction membership is unchanged", () => {
  const scene = overlapFixture();
  const result = arrangeRelatedDiagramScene({
    graph: scene.graph,
    routeState: scene.routeState,
    topology: scene.routeTopology,
  });
  assert.equal(result.kind, "applied");
  if (result.kind !== "applied") return;
  const before = topologyMembershipSnapshot(scene.routeTopology!);
  const after = topologyMembershipSnapshot(result.topology!);
  assert.deepEqual(
    {
      groupIds: after.groupIds,
      trunkIds: after.trunkIds,
      branchIds: after.branchIds,
      groups: after.groups,
      trunks: after.trunks,
      routeIds: after.routes.map((row) => row.connectionId),
    },
    {
      groupIds: before.groupIds,
      trunkIds: before.trunkIds,
      branchIds: before.branchIds,
      groups: before.groups,
      trunks: before.trunks,
      routeIds: before.routes.map((row) => row.connectionId),
    },
  );
});

test("L. connection semantics are unchanged", () => {
  const scene = overlapFixture();
  const result = arrangeRelatedDiagramScene({
    graph: scene.graph,
    routeState: scene.routeState,
    topology: scene.routeTopology,
  });
  assert.equal(result.kind, "applied");
  if (result.kind !== "applied") return;
  assert.deepEqual(result.graph.connections, scene.graph.connections);
});

test("M. priority rows are unchanged", () => {
  const scene = overlapFixture();
  const result = arrangeRelatedDiagramScene({
    graph: scene.graph,
    routeState: scene.routeState,
    topology: scene.routeTopology,
  });
  assert.equal(result.kind, "applied");
  if (result.kind !== "applied") return;
  assert.deepEqual(result.graph.nursingProblems, scene.graph.nursingProblems);
});

test("N. current / potential states are unchanged", () => {
  const scene = overlapFixture();
  const before = scene.graph.cards.map((item) => ({ id: item.id, state: item.state }));
  const result = arrangeRelatedDiagramScene({
    graph: scene.graph,
    routeState: scene.routeState,
    topology: scene.routeTopology,
  });
  assert.equal(result.kind, "applied");
  if (result.kind !== "applied") return;
  assert.deepEqual(
    result.graph.cards.map((item) => ({ id: item.id, state: item.state })),
    before,
  );
});

test("O. width / height / zIndex are unchanged", () => {
  const scene = overlapFixture();
  const before = scene.graph.cards.map((item) => ({
    id: item.id,
    width: item.layout.width,
    height: item.layout.height,
    zIndex: item.layout.zIndex,
  }));
  const result = arrangeRelatedDiagramScene({
    graph: scene.graph,
    routeState: scene.routeState,
    topology: scene.routeTopology,
  });
  assert.equal(result.kind, "applied");
  if (result.kind !== "applied") return;
  assert.deepEqual(
    result.graph.cards.map((item) => ({
      id: item.id,
      width: item.layout.width,
      height: item.layout.height,
      zIndex: item.layout.zIndex,
    })),
    before,
  );
});

test("P. apply helper does not drop cards so selection identity can stay", () => {
  const scene = overlapFixture();
  const ids = scene.graph.cards.map((item) => item.id).sort();
  const result = arrangeRelatedDiagramScene({
    graph: scene.graph,
    routeState: scene.routeState,
    topology: scene.routeTopology,
  });
  assert.equal(result.kind, "applied");
  if (result.kind !== "applied") return;
  assert.deepEqual(result.graph.cards.map((item) => item.id).sort(), ids);
  const ws = src("../../../components/v2/relatedDiagram/RelatedDiagramDevFixtureWorkspace.tsx");
  const start = ws.indexOf("const handleArrange");
  assert.ok(start >= 0);
  const block = ws.slice(start, ws.indexOf("}, [", start));
  assert.equal(block.includes("selectCard("), false);
});

test("Q. arrange does not change viewport", () => {
  const ws = src("../../../components/v2/relatedDiagram/RelatedDiagramDevFixtureWorkspace.tsx");
  const start = ws.indexOf("const handleArrange");
  assert.ok(start >= 0);
  const block = ws.slice(start, ws.indexOf("}, [", start));
  assert.equal(block.includes("fitToView"), false);
  assert.equal(block.includes("resetTo100"), false);
  assert.equal(block.includes("setTransform"), false);
});

test("R. second arrange on an arranged scene is a NO-OP", () => {
  const scene = overlapFixture();
  const first = arrangeRelatedDiagramScene({
    graph: scene.graph,
    routeState: scene.routeState,
    topology: scene.routeTopology,
  });
  assert.equal(first.kind, "applied");
  if (first.kind !== "applied") return;
  let history = pushDiagramHistory(emptyDiagramHistory(), first.historyAction);
  const second = arrangeRelatedDiagramScene({
    graph: first.graph,
    routeState: first.routeState,
    topology: first.topology,
  });
  assert.equal(second.kind, "noop");
  assert.deepEqual(second.layout.changedCardIds, []);
  assert.equal(history.past.length, 1);
});

test("S. impossible partial apply returns a notice", () => {
  const graph = emptyGraph(
    Array.from({ length: 10 }, (_, i) =>
      card(`d${String(i).padStart(2, "0")}`, 20, 20, 700, 500),
    ),
  );
  const routeState = seedStableRouteState(graph.cards, graph.connections);
  const result = arrangeRelatedDiagramScene({ graph, routeState });
  assert.equal(result.kind, "applied");
  if (result.kind !== "applied") return;
  assert.equal(result.notice, "impossible_to_fit");
  assert.equal(result.layout.fullyArranged, false);
  assert.equal(arrangeNoticeMessage(result), ARRANGE_IMPOSSIBLE_MESSAGE);
  assert.ok(result.layout.changedCardIds.length >= 0);
});

test("T. Undo of impossible partial restores the original exactly", () => {
  const graph = emptyGraph(
    Array.from({ length: 10 }, (_, i) =>
      card(`d${String(i).padStart(2, "0")}`, 20, 20, 700, 500),
    ),
  );
  const routeState = seedStableRouteState(graph.cards, graph.connections);
  const original = positionsOf(graph);
  const result = arrangeRelatedDiagramScene({ graph, routeState });
  assert.equal(result.kind, "applied");
  if (result.kind !== "applied") return;
  const undone = undoDiagramHistory(
    pushDiagramHistory(emptyDiagramHistory(), result.historyAction),
  );
  const restored = applySceneFragmentToGraph(result.graph, undone.fragment!);
  assert.deepEqual(positionsOf(restored), original);
  assert.deepEqual(undone.fragment!.routeState, routeState);
});

test("UI lock covers editing surfaces and not idle selection", () => {
  assert.equal(
    arrangeRelatedDiagramUiLocked({
      connecting: false,
      editOpen: false,
      composeOpen: false,
      chooserOpen: false,
      deleteConfirmOpen: false,
      priorityPickerOpen: false,
      dragging: false,
    }),
    false,
  );
  assert.equal(
    arrangeRelatedDiagramUiLocked({
      connecting: true,
      editOpen: false,
      composeOpen: false,
      chooserOpen: false,
      deleteConfirmOpen: false,
      priorityPickerOpen: false,
      dragging: false,
    }),
    true,
  );
  assert.equal(
    arrangeRelatedDiagramUiLocked({
      connecting: false,
      editOpen: true,
      composeOpen: false,
      chooserOpen: false,
      deleteConfirmOpen: false,
      priorityPickerOpen: false,
      dragging: false,
    }),
    true,
  );
});

test("input graph is not mutated", () => {
  const scene = overlapFixture();
  const frozen = structuredClone(scene.graph);
  arrangeRelatedDiagramScene({
    graph: scene.graph,
    routeState: scene.routeState,
    topology: scene.routeTopology,
  });
  assert.deepEqual(scene.graph, frozen);
});

test("applyLayoutPositionsToGraph only writes x/y", () => {
  const graph = emptyGraph([card("a", 10, 10, 180, 72)]);
  graph.cards[0]!.layout.zIndex = 4;
  const next = applyLayoutPositionsToGraph(graph, [{ cardId: "a", x: 40, y: 50 }]);
  assert.equal(next.cards[0]!.layout.x, 40);
  assert.equal(next.cards[0]!.layout.y, 50);
  assert.equal(next.cards[0]!.layout.width, 180);
  assert.equal(next.cards[0]!.layout.height, 72);
  assert.equal(next.cards[0]!.layout.zIndex, 4);
});

test("DEV toolbar wires arrange; student runtime does not", () => {
  const toolbar = src("../../../components/v2/relatedDiagram/RelatedDiagramEditorToolbar.tsx");
  const ws = src("../../../components/v2/relatedDiagram/RelatedDiagramDevFixtureWorkspace.tsx");
  const student = src("../../../components/v2/relatedDiagram/RelatedDiagramReadonlyWorkspace.tsx");
  const studentBar = src("../../../components/v2/relatedDiagram/RelatedDiagramWorkspaceToolbar.tsx");
  const boundary = src("./studentForm3RelatedDiagramBoundary.ts");
  assert.ok(toolbar.includes("関連図を整える"));
  assert.ok(toolbar.includes("data-rd-arrange"));
  assert.ok(toolbar.includes("rd-no-print"));
  assert.ok(toolbar.includes("min-h-[44px]"));
  assert.ok(ws.includes("onArrange={handleArrange}"));
  assert.ok(ws.includes("data-rd-arrange-notice"));
  assert.equal(student.includes("関連図を整える"), false);
  assert.equal(studentBar.includes("関連図を整える"), false);
  assert.equal(STUDENT_RELATED_DIAGRAM_UNSAVED_EDITING, false);
  assert.ok(boundary.includes("STUDENT_RELATED_DIAGRAM_UNSAVED_EDITING = false"));
});

test("arrange uses L1+L2 then L2-D incremental Knowledge layer", () => {
  const apply = src("./applyRelatedDiagramLayout.ts");
  assert.ok(apply.includes("layoutRelatedDiagramConnected"));
  assert.ok(apply.includes("applyKnowledgeLayerArrange"));
  assert.ok(apply.includes("applyNursingProblemArrange"));
  assert.ok(apply.includes("ARRANGE_STABILIZE_MAX_PASSES"));
  assert.ok(apply.includes("restitchAffectedRoutes"));
  assert.equal(apply.includes("regenerateExplicitTopologyGeometry"), false);
  assert.equal(apply.includes("refineRouteReadability"), false);
  assert.equal(apply.includes("force-directed"), false);
  const engine = layoutRelatedDiagram({
    cards: [card("a", 40, 40), card("b", 400, 40)],
  });
  assert.deepEqual(engine.changedCardIds, []);
});

console.log(`\n${passed} tests passed`);
