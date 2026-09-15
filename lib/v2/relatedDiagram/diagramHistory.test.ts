/**
 * Undo / Redo history tests.
 * Run: npx tsx lib/v2/relatedDiagram/diagramHistory.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  applySceneFragmentToGraph,
  captureSceneFragment,
  DIAGRAM_HISTORY_LIMIT,
  emptyDiagramHistory,
  fragmentsEqual,
  pushDiagramHistory,
  redoDiagramHistory,
  undoDiagramHistory,
} from "./diagramHistory";
import { applyCardPositionToGraph } from "./cardInteractionState";
import {
  applyIncrementalCardMove,
  applyIncrementalGroupMove,
  cloneStableRouteState,
  pointsDeepEqual,
  seedStableRouteState,
} from "./incrementalRoutes";
import {
  applyKnowledgeGroupDelta,
  knowledgeCardsOf,
  knowledgeGroupBounds,
} from "./knowledgeGroupLayout";
import { resolveDevFixtureReadonlyScene } from "./resolveReadonlyScene";
import { resolveCardDropCollision } from "./cardCollision";
import { translateKnowledgeTopology } from "./regenerateRouteTopology";

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

function sceneAndState() {
  const scene = resolveDevFixtureReadonlyScene({ includeStyleDemo: true });
  const state = seedStableRouteState(
    scene.graph.cards,
    scene.graph.connections,
    scene.routeTopology,
  );
  return { scene, state };
}

function moveDemo(dx = 24, dy = -12) {
  const { scene, state } = sceneAndState();
  const card = scene.graph.cards.find((c) => c.id === "demo_info")!;
  const next = applyCardPositionToGraph(
    scene.graph,
    "demo_info",
    card.layout.x + dx,
    card.layout.y + dy,
  );
  const moved = applyIncrementalCardMove({
    previous: state,
    cards: next.cards,
    connections: next.connections,
    topology: scene.routeTopology,
    movedCardId: "demo_info",
  });
  const before = captureSceneFragment({
    cards: scene.graph.cards,
    cardIds: ["demo_info"],
    routeState: state,
    topology: scene.routeTopology,
  });
  const after = captureSceneFragment({
    cards: next.cards,
    cardIds: ["demo_info"],
    routeState: moved.state,
    topology: moved.topology ?? scene.routeTopology,
  });
  return { scene, state, next, moved, before, after, card };
}

test("undo restores the exact card position", () => {
  const { scene, before, after, card } = moveDemo();
  let history = pushDiagramHistory(emptyDiagramHistory(), {
    type: "moveCard",
    cardIds: ["demo_info"],
    before,
    after,
  });
  const undone = undoDiagramHistory(history);
  const restored = applySceneFragmentToGraph(scene.graph, undone.fragment!);
  assert.equal(restored.cards.find((c) => c.id === "demo_info")!.layout.x, card.layout.x);
  assert.equal(restored.cards.find((c) => c.id === "demo_info")!.layout.y, card.layout.y);
});

test("redo restores the exact after position", () => {
  const { next, before, after } = moveDemo();
  let history = pushDiagramHistory(emptyDiagramHistory(), {
    type: "moveCard",
    cardIds: ["demo_info"],
    before,
    after,
  });
  history = undoDiagramHistory(history).history;
  const redone = redoDiagramHistory(history);
  const restored = applySceneFragmentToGraph(next, redone.fragment!);
  const afterCard = after.cards[0]!;
  assert.equal(restored.cards.find((c) => c.id === "demo_info")!.layout.x, afterCard.x);
  assert.equal(restored.cards.find((c) => c.id === "demo_info")!.layout.y, afterCard.y);
});

test("undo restores route geometry by deepEqual", () => {
  const { before, after, state } = moveDemo();
  const history = pushDiagramHistory(emptyDiagramHistory(), {
    type: "moveCard",
    cardIds: ["demo_info"],
    before,
    after,
  });
  const undone = undoDiagramHistory(history);
  assert.ok(
    pointsDeepEqual(
      undone.fragment!.routeState.byId.demo_c_cur!.points,
      state.byId.demo_c_cur!.points,
    ),
  );
});

test("undo restores bridges by deepEqual", () => {
  const { before, after, state } = moveDemo();
  const history = pushDiagramHistory(emptyDiagramHistory(), {
    type: "moveCard",
    cardIds: ["demo_info"],
    before,
    after,
  });
  const undone = undoDiagramHistory(history);
  assert.deepEqual(
    undone.fragment!.routeState.bridges,
    state.bridges,
  );
});

test("collision snap undo returns to the drag-start position", () => {
  const { scene, state } = sceneAndState();
  const hall = scene.graph.cards.find((c) => c.id === "sk_hallucination")!;
  const delusion = scene.graph.cards.find((c) => c.id === "sk_delusion")!;
  const resolved = resolveCardDropCollision({
    movingCard: hall,
    desiredPosition: { x: delusion.layout.x, y: delusion.layout.y },
    otherCards: scene.graph.cards.filter((c) => c.id !== hall.id),
    lastLegal: { x: hall.layout.x, y: hall.layout.y },
  });
  const next = applyCardPositionToGraph(
    scene.graph,
    hall.id,
    resolved.position.x,
    resolved.position.y,
  );
  const moved = applyIncrementalCardMove({
    previous: state,
    cards: next.cards,
    connections: next.connections,
    topology: scene.routeTopology,
    movedCardId: hall.id,
  });
  const before = captureSceneFragment({
    cards: scene.graph.cards,
    cardIds: [hall.id],
    routeState: state,
    topology: scene.routeTopology,
  });
  const after = captureSceneFragment({
    cards: next.cards,
    cardIds: [hall.id],
    routeState: moved.state,
    topology: moved.topology,
  });
  const undone = undoDiagramHistory(
    pushDiagramHistory(emptyDiagramHistory(), {
      type: "moveCard",
      cardIds: [hall.id],
      before,
      after,
    }),
  );
  const restored = applySceneFragmentToGraph(next, undone.fragment!);
  assert.equal(restored.cards.find((c) => c.id === hall.id)!.layout.x, hall.layout.x);
  assert.equal(restored.cards.find((c) => c.id === hall.id)!.layout.y, hall.layout.y);
  const redone = redoDiagramHistory(undone.history);
  const again = applySceneFragmentToGraph(scene.graph, redone.fragment!);
  assert.equal(again.cards.find((c) => c.id === hall.id)!.layout.x, resolved.position.x);
  assert.equal(again.cards.find((c) => c.id === hall.id)!.layout.y, resolved.position.y);
});

test("Knowledge individual undo/redo restores the same fragment", () => {
  const { scene, state } = sceneAndState();
  const hall = scene.graph.cards.find((c) => c.id === "sk_hallucination")!;
  const next = applyCardPositionToGraph(
    scene.graph,
    hall.id,
    hall.layout.x,
    hall.layout.y - 20,
  );
  const moved = applyIncrementalCardMove({
    previous: state,
    cards: next.cards,
    connections: next.connections,
    topology: scene.routeTopology,
    movedCardId: hall.id,
  });
  const before = captureSceneFragment({
    cards: scene.graph.cards,
    cardIds: [hall.id],
    routeState: state,
    topology: scene.routeTopology,
  });
  const after = captureSceneFragment({
    cards: next.cards,
    cardIds: [hall.id],
    routeState: moved.state,
    topology: moved.topology,
  });
  const history = pushDiagramHistory(emptyDiagramHistory(), {
    type: "moveCard",
    cardIds: [hall.id],
    before,
    after,
  });
  const undone = undoDiagramHistory(history);
  assert.equal(fragmentsEqual(undone.fragment!, before), true);
  const redone = redoDiagramHistory(undone.history);
  assert.equal(fragmentsEqual(redone.fragment!, after), true);
});

test("Knowledge group undo restores topology exactly", () => {
  const { scene, state } = sceneAndState();
  const ids = knowledgeCardsOf(scene.graph.cards).map((c) => c.id);
  const bbox = knowledgeGroupBounds(scene.graph.cards)!;
  void bbox;
  const next = applyKnowledgeGroupDelta(scene.graph, 20, 12);
  const topo = translateKnowledgeTopology(
    scene.routeTopology!,
    scene.graph.connections,
    scene.graph.cards,
    20,
    12,
  );
  const moved = applyIncrementalGroupMove({
    previous: state,
    startCards: scene.graph.cards,
    cards: next.cards,
    connections: next.connections,
    topology: topo,
    dx: 20,
    dy: 12,
  });
  const before = captureSceneFragment({
    cards: scene.graph.cards,
    cardIds: ids,
    routeState: state,
    topology: scene.routeTopology,
  });
  const after = captureSceneFragment({
    cards: next.cards,
    cardIds: ids,
    routeState: moved.state,
    topology: topo,
  });
  const undone = undoDiagramHistory(
    pushDiagramHistory(emptyDiagramHistory(), {
      type: "moveGroup",
      cardIds: ids,
      before,
      after,
    }),
  );
  assert.deepEqual(
    undone.fragment!.topology!.branchPoints,
    scene.routeTopology!.branchPoints,
  );
  assert.ok(
    pointsDeepEqual(
      undone.fragment!.routeState.byId.skc2!.points,
      state.byId.skc2!.points,
    ),
  );
});

test("a new action clears the redo stack", () => {
  const first = moveDemo(10, 0);
  let history = pushDiagramHistory(emptyDiagramHistory(), {
    type: "moveCard",
    cardIds: ["demo_info"],
    before: first.before,
    after: first.after,
  });
  history = undoDiagramHistory(history).history;
  assert.equal(history.future.length, 1);
  const second = moveDemo(16, 8);
  history = pushDiagramHistory(history, {
    type: "moveCard",
    cardIds: ["demo_info"],
    before: second.before,
    after: second.after,
  });
  assert.equal(history.future.length, 0);
  assert.equal(history.past.length, 1);
});

test("history caps at 50 actions", () => {
  const { before, after } = moveDemo();
  let history = emptyDiagramHistory();
  for (let i = 0; i < 55; i++) {
    history = pushDiagramHistory(history, {
      type: "moveCard",
      cardIds: ["demo_info"],
      before,
      after,
    });
  }
  assert.equal(history.past.length, DIAGRAM_HISTORY_LIMIT);
});

test("empty history cannot undo or redo", () => {
  const history = emptyDiagramHistory();
  assert.equal(undoDiagramHistory(history).fragment, null);
  assert.equal(redoDiagramHistory(history).fragment, null);
});

test("toolbar exposes undo/redo and keyboard is wired in the DEV workspace", () => {
  const toolbar = readFileSync(
    new URL(
      "../../../components/v2/relatedDiagram/RelatedDiagramWorkspaceToolbar.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const ws = readFileSync(
    new URL(
      "../../../components/v2/relatedDiagram/RelatedDiagramDevFixtureWorkspace.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const student = readFileSync(
    new URL(
      "../../../components/v2/relatedDiagram/RelatedDiagramReadonlyWorkspace.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.ok(toolbar.includes('aria-label="一手戻る"'));
  assert.ok(toolbar.includes('aria-label="一手進む"'));
  assert.ok(toolbar.includes("min-h-[44px]"));
  assert.ok(ws.includes("handleUndo"));
  assert.ok(ws.includes("isTypingTarget"));
  assert.ok(ws.includes('key === "z"'));
  assert.equal(student.includes("onUndo"), false);
});

test("clone keeps route state independent of later mutations", () => {
  const { state } = sceneAndState();
  const cloned = cloneStableRouteState(state);
  cloned.byId.demo_c_cur!.points[0] = { x: -1, y: -1 };
  assert.notEqual(state.byId.demo_c_cur!.points[0]!.x, -1);
});

console.log(`\n${passed} passed`);
