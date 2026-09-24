/**
 * Arrange Preservation Gate.
 * Run: node_modules/.bin/jiti lib/v2/relatedDiagram/arrangePreservation.test.ts
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
  arrangeRelatedDiagramScene,
} from "./applyRelatedDiagramLayout";
import {
  acceptArrangeCandidate,
  compareArrangeCandidate,
  evaluateArrangeScene,
} from "./arrangePreservation";
import { routeHighwayFlag } from "./diagramLayoutL2b";
import { A3_WIDTH_PX } from "./a3Canvas";
import { seedStableRouteState } from "./incrementalRoutes";
import { resolveDevFixtureReadonlyScene } from "./resolveReadonlyScene";
import { STUDENT_RELATED_DIAGRAM_UNSAVED_EDITING } from "./studentForm3RelatedDiagramBoundary";
import type {
  RelatedDiagramCard,
  RelatedDiagramCardState,
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

function card(
  id: string,
  x: number,
  y: number,
  options?: {
    width?: number;
    height?: number;
    cardType?: RelatedDiagramCard["cardType"];
    state?: RelatedDiagramCardState | null;
  },
): RelatedDiagramCard {
  const cardType = options?.cardType ?? "information";
  return {
    id,
    cardType,
    text: id,
    state:
      options?.state !== undefined
        ? options.state
        : cardType === "understanding" || cardType === "nursing_problem"
          ? "current"
          : null,
    origin: cardType === "knowledge" ? "knowledge_library" : "patient_information",
    layout: {
      x,
      y,
      width: options?.width ?? 146,
      height: options?.height ?? 72,
      zIndex: 1,
    },
    isLocked: false,
    createdAt: "2026-09-21T00:00:00.000Z",
    updatedAt: "2026-09-21T00:00:00.000Z",
  };
}

function conn(
  id: string,
  sourceCardId: string,
  targetCardId: string,
  relationType: RelatedDiagramConnection["relationType"] = "current",
): RelatedDiagramConnection {
  return {
    id,
    sourceCardId,
    targetCardId,
    relationType,
    origin:
      relationType === "nursing_problem_integration"
        ? "system_integration"
        : sourceCardId.startsWith("k")
          ? "knowledge_library"
          : "student_diagram",
    createdAt: "2026-09-21T00:00:00.000Z",
    updatedAt: "2026-09-21T00:00:00.000Z",
  };
}

function graphOf(
  cards: RelatedDiagramCard[],
  connections: RelatedDiagramConnection[],
): RelatedDiagramSemanticGraph {
  return {
    semanticSchemaVersion: "1",
    cards,
    cardSources: [],
    connections,
    nursingProblems: cards
      .filter((item) => item.cardType === "nursing_problem")
      .map((item) => ({
        cardId: item.id,
        status: "active" as const,
        priority: null,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
    nursingProblemSupports: [],
    integrations: [],
    integrationMembers: [],
  };
}

function sceneOf(cards: RelatedDiagramCard[], connections: RelatedDiagramConnection[]) {
  const graph = graphOf(cards, connections);
  return {
    graph,
    routeState: seedStableRouteState(graph.cards, graph.connections),
  };
}

function positionsOf(cards: RelatedDiagramCard[]) {
  return cards
    .map((item) => ({ id: item.id, x: item.layout.x, y: item.layout.y }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function pos(cards: RelatedDiagramCard[], id: string) {
  const found = cards.find((item) => item.id === id);
  assert.ok(found, id);
  return found;
}

function goodKnowledgeCards() {
  return [
    card("k_root", 80, 40, { cardType: "knowledge" }),
    card("k_a", 80, 176, { cardType: "knowledge" }),
    card("k_b", 80, 312, { cardType: "knowledge" }),
  ];
}

function goodKnowledgeConns() {
  return [conn("e1", "k_root", "k_a"), conn("e2", "k_a", "k_b")];
}

function goodNpCards() {
  return [
    card("u1", 980, 80, { cardType: "understanding", width: 160, height: 64 }),
    card("np1", 990, 220, { cardType: "nursing_problem", width: 180, height: 72 }),
    card("np2", 990, 380, { cardType: "nursing_problem", width: 180, height: 72 }),
  ];
}

function goodNpConns() {
  return [
    conn("b1", "u1", "np1", "nursing_problem_basis"),
    conn("i1", "np1", "np2", "nursing_problem_integration"),
  ];
}

function goodManualScene() {
  return sceneOf([...goodKnowledgeCards(), ...goodNpCards()], [
    ...goodKnowledgeConns(),
    ...goodNpConns(),
  ]);
}

function fixtureScene() {
  const scene = resolveDevFixtureReadonlyScene({ includeStyleDemo: true });
  return {
    ...scene,
    routeState: seedStableRouteState(
      scene.graph.cards,
      scene.graph.connections,
      scene.routeTopology,
    ),
  };
}

function farLeftScene() {
  const scene = fixtureScene();
  let graph = applyCardPositionToGraph(scene.graph, "demo_np", 40, 40);
  graph = applyCardPositionToGraph(graph, "demo_np2", 40, 200);
  return {
    ...scene,
    graph,
    routeState: seedStableRouteState(graph.cards, graph.connections, scene.routeTopology),
  };
}

test("PRES-A. good Knowledge layout is position-exact after Arrange", () => {
  const scene = sceneOf(goodKnowledgeCards(), goodKnowledgeConns());
  const quality = evaluateArrangeScene({
    cards: scene.graph.cards,
    connections: scene.graph.connections,
    routeState: scene.routeState,
  });
  assert.equal(quality.cardThrough, 0);
  assert.equal(quality.highwayCount, 0);
  assert.equal(quality.overlapCount, 0);
  assert.equal(quality.boundsHits, 0);
  assert.equal(quality.goodEnough, true);
  const result = arrangeRelatedDiagramScene({
    graph: scene.graph,
    routeState: scene.routeState,
  });
  const after = result.kind === "applied" ? result.graph.cards : scene.graph.cards;
  assert.deepEqual(
    positionsOf(after.filter((item) => item.cardType === "knowledge")),
    positionsOf(scene.graph.cards.filter((item) => item.cardType === "knowledge")),
  );
});

test("PRES-B. good NP layout is position-exact after Arrange", () => {
  const scene = sceneOf(goodNpCards(), goodNpConns());
  const quality = evaluateArrangeScene({
    cards: scene.graph.cards,
    connections: scene.graph.connections,
    routeState: scene.routeState,
  });
  assert.equal(quality.goodEnough, true);
  const result = arrangeRelatedDiagramScene({
    graph: scene.graph,
    routeState: scene.routeState,
  });
  const after = result.kind === "applied" ? result.graph.cards : scene.graph.cards;
  assert.deepEqual(
    positionsOf(after.filter((item) => item.cardType === "nursing_problem")),
    positionsOf(scene.graph.cards.filter((item) => item.cardType === "nursing_problem")),
  );
});

test("PRES-C. separated Knowledge / NP clusters stay separated", () => {
  const scene = goodManualScene();
  const beforeK = bboxRight(scene.graph.cards.filter((item) => item.cardType === "knowledge"));
  const beforeNp = bboxLeft(scene.graph.cards.filter((item) => item.cardType === "nursing_problem"));
  assert.ok(beforeK < beforeNp);
  const result = arrangeRelatedDiagramScene({
    graph: scene.graph,
    routeState: scene.routeState,
  });
  const after = result.kind === "applied" ? result.graph.cards : scene.graph.cards;
  const afterK = bboxRight(after.filter((item) => item.cardType === "knowledge"));
  const afterNp = bboxLeft(after.filter((item) => item.cardType === "nursing_problem"));
  assert.ok(afterK <= afterNp);
  assert.deepEqual(positionsOf(after), positionsOf(scene.graph.cards));
});

test("PRES-D. the same graph still repairs after an intentional scatter", () => {
  const scene = goodManualScene();
  const scatteredCards = scene.graph.cards.map((item) => {
    if (item.id === "k_b") return { ...item, layout: { ...item.layout, x: 40, y: 40 } };
    if (item.id === "np1") return { ...item, layout: { ...item.layout, x: 40, y: 520 } };
    if (item.id === "np2") return { ...item, layout: { ...item.layout, x: 40, y: 40 } };
    return item;
  });
  const scattered = {
    graph: { ...scene.graph, cards: scatteredCards },
    routeState: seedStableRouteState(scatteredCards, scene.graph.connections),
  };
  const before = evaluateArrangeScene({
    cards: scattered.graph.cards,
    connections: scattered.graph.connections,
    routeState: scattered.routeState,
  });
  assert.equal(before.goodEnough, false);
  const result = arrangeRelatedDiagramScene({
    graph: scattered.graph,
    routeState: scattered.routeState,
  });
  assert.equal(result.kind, "applied");
  if (result.kind !== "applied") return;
  const u = pos(result.graph.cards, "u1");
  const np1 = pos(result.graph.cards, "np1");
  const np2 = pos(result.graph.cards, "np2");
  assert.ok(np1.layout.y >= u.layout.y + u.layout.height + 24);
  assert.ok(np2.layout.y >= np1.layout.y + np1.layout.height + 24);
  const after = evaluateArrangeScene({
    cards: result.graph.cards,
    connections: result.graph.connections,
    routeState: result.routeState,
  });
  assert.ok(after.hardDefects.length <= before.hardDefects.length);
});

test("PRES-E. card-through is not preserved", () => {
  const scene = fixtureScene();
  const before = evaluateArrangeScene({
    cards: scene.graph.cards,
    connections: scene.graph.connections,
    routeState: scene.routeState,
    topology: scene.routeTopology,
  });
  assert.ok(before.cardThrough > 0);
  const result = arrangeRelatedDiagramScene({
    graph: scene.graph,
    routeState: scene.routeState,
    topology: scene.routeTopology,
  });
  assert.equal(result.kind, "applied");
  if (result.kind !== "applied") return;
  const after = evaluateArrangeScene({
    cards: result.graph.cards,
    connections: scene.graph.connections,
    routeState: result.routeState,
    topology: result.topology,
  });
  assert.ok(after.cardThrough < before.cardThrough);
  assert.equal(after.cardThrough, 0);
});

test("PRES-F. highway / outer rail is not preserved", () => {
  const cards = [
    card("k_a", 24, 40, { cardType: "knowledge" }),
    card("k_b", 980, 40, { cardType: "knowledge" }),
  ];
  const connections = [conn("e1", "k_a", "k_b")];
  const routeState = seedStableRouteState(cards, connections);
  routeState.byId.e1 = {
    ...routeState.byId.e1!,
    points: [
      { x: 8, y: 76 },
      { x: 8, y: 200 },
      { x: A3_WIDTH_PX - 8, y: 200 },
      { x: A3_WIDTH_PX - 8, y: 76 },
      { x: 1053, y: 76 },
    ],
  };
  const before = evaluateArrangeScene({ cards, connections, routeState });
  assert.ok(before.highwayCount > 0 || before.outerRailCount > 0);
  assert.equal(routeHighwayFlag(routeState.byId.e1!.points) > 0, true);
  const result = arrangeRelatedDiagramScene({
    graph: graphOf(cards, connections),
    routeState,
  });
  assert.equal(result.kind, "applied");
  if (result.kind !== "applied") return;
  const after = evaluateArrangeScene({
    cards: result.graph.cards,
    connections,
    routeState: result.routeState,
  });
  assert.ok(after.highwayCount + after.outerRailCount < before.highwayCount + before.outerRailCount);
});

test("PRES-G. a slightly shorter candidate with large displacement is rejected", () => {
  const scene = goodManualScene();
  const current = {
    cards: scene.graph.cards,
    connections: scene.graph.connections,
    routeState: scene.routeState,
  };
  const candidateCards = scene.graph.cards.map((item) =>
    item.cardType === "knowledge"
      ? { ...item, layout: { ...item.layout, x: item.layout.x + 220, y: item.layout.y + 40 } }
      : item,
  );
  const candidate = {
    cards: candidateCards,
    connections: scene.graph.connections,
    routeState: seedStableRouteState(candidateCards, scene.graph.connections),
  };
  assert.equal(compareArrangeCandidate({ current, candidate }), "keep_current");
});

test("PRES-H. a candidate that worsens cluster separation is rejected", () => {
  const scene = goodManualScene();
  const current = {
    cards: scene.graph.cards,
    connections: scene.graph.connections,
    routeState: scene.routeState,
  };
  const candidateCards = scene.graph.cards.map((item) =>
    item.id === "k_b"
      ? { ...item, layout: { ...item.layout, x: 1000, y: 220 } }
      : item,
  );
  const candidate = {
    cards: candidateCards,
    connections: scene.graph.connections,
    routeState: seedStableRouteState(candidateCards, scene.graph.connections),
  };
  assert.equal(compareArrangeCandidate({ current, candidate }), "keep_current");
  assert.equal(acceptArrangeCandidate({ current, candidate }), false);
});

test("PRES-I. far-left scatter is stable after one Arrange", () => {
  const scene = farLeftScene();
  const first = arrangeRelatedDiagramScene({
    graph: scene.graph,
    routeState: scene.routeState,
    topology: scene.routeTopology,
  });
  assert.equal(first.kind, "applied");
  if (first.kind !== "applied") return;
  const second = arrangeRelatedDiagramScene({
    graph: first.graph,
    routeState: first.routeState,
    topology: first.topology,
  });
  assert.equal(second.kind, "noop");
});

test("PRES-J. good manual layout is a first-Arrange NO-OP", () => {
  const scene = goodManualScene();
  const result = arrangeRelatedDiagramScene({
    graph: scene.graph,
    routeState: scene.routeState,
  });
  assert.equal(result.kind, "noop");
  const history = emptyDiagramHistory();
  assert.equal(history.past.length, 0);
});

test("PRES-K. applied Arrange stays one moveGroup with exact Undo/Redo", () => {
  const scene = farLeftScene();
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
  const undone = undoDiagramHistory(history);
  const restored = applySceneFragmentToGraph(result.graph, undone.fragment!);
  assert.deepEqual(positionsOf(restored.cards), positionsOf(scene.graph.cards));
  const redone = redoDiagramHistory(undone.history);
  const replayed = applySceneFragmentToGraph(scene.graph, redone.fragment!);
  assert.deepEqual(positionsOf(replayed.cards), positionsOf(result.graph.cards));
});

test("PRES-L. preservation ignores card and connection array order", () => {
  const scene = goodManualScene();
  const current = {
    cards: scene.graph.cards,
    connections: scene.graph.connections,
    routeState: scene.routeState,
  };
  const reversed = {
    cards: [...scene.graph.cards].reverse(),
    connections: [...scene.graph.connections].reverse(),
    routeState: scene.routeState,
  };
  assert.deepEqual(evaluateArrangeScene(current), evaluateArrangeScene(reversed));
  const scattered = scene.graph.cards.map((item) =>
    item.id === "np2" ? { ...item, layout: { ...item.layout, x: 40, y: 40 } } : item,
  );
  const broken = {
    cards: scattered,
    connections: scene.graph.connections,
    routeState: seedStableRouteState(scattered, scene.graph.connections),
  };
  const brokenRev = {
    cards: [...scattered].reverse(),
    connections: [...scene.graph.connections].reverse(),
    routeState: broken.routeState,
  };
  assert.equal(
    compareArrangeCandidate({ current, candidate: broken }),
    compareArrangeCandidate({ current: reversed, candidate: brokenRev }),
  );
});

test("gate does not hardcode fixture ids and student editing stays off", () => {
  const impl = src("./arrangePreservation.ts");
  assert.equal(impl.includes("demo_np"), false);
  assert.equal(impl.includes("sk_disease"), false);
  assert.equal(STUDENT_RELATED_DIAGRAM_UNSAVED_EDITING, false);
  const apply = src("./applyRelatedDiagramLayout.ts");
  assert.ok(apply.includes("gateArrangeCandidate"));
  assert.ok(apply.includes("evaluateArrangeScene"));
});

function bboxRight(cards: RelatedDiagramCard[]) {
  return Math.max(...cards.map((item) => item.layout.x + item.layout.width));
}

function bboxLeft(cards: RelatedDiagramCard[]) {
  return Math.min(...cards.map((item) => item.layout.x));
}

console.log(`\n${passed} tests passed`);
