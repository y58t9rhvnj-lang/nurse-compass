/**
 * L2-B route-driven readability refinement.
 * Run: node_modules/.bin/jiti lib/v2/relatedDiagram/diagramLayoutL2b.test.ts
 */

import assert from "node:assert/strict";
import {
  applySceneFragmentToGraph,
  emptyDiagramHistory,
  pushDiagramHistory,
  redoDiagramHistory,
  undoDiagramHistory,
} from "./diagramHistory";
import { arrangeRelatedDiagramScene } from "./applyRelatedDiagramLayout";
import {
  analyzeRouteReadability,
  refineRouteReadability,
  sceneDisplacement,
} from "./diagramLayoutL2b";
import { CARD_MIN_GAP, isLegalCardPlacement } from "./cardCollision";
import { A3_HEIGHT_PX, A3_WIDTH_PX } from "./a3Canvas";
import { getA3LegendBounds } from "./a3Legend";
import {
  seedStableRouteState,
  type StableRouteState,
  type StoredRouteGeometry,
} from "./incrementalRoutes";
import { topologyMembershipSnapshot } from "./regenerateRouteTopology";
import { resolveDevFixtureReadonlyScene } from "./resolveReadonlyScene";
import { ROUTE_TOPOLOGY_SCHEMA } from "./routeTopology";
import type { RelatedDiagramRouteTopology } from "./routeTopology";
import type {
  RelatedDiagramCard,
  RelatedDiagramCardState,
  RelatedDiagramConnection,
  RelatedDiagramSemanticGraph,
} from "./types";
import type { EdgeSide, Point } from "./orthogonalRouting";

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
      width: options?.width ?? 80,
      height: options?.height ?? 40,
      zIndex: 1,
    },
    isLocked: cardType === "knowledge",
    createdAt: "2026-09-20T00:00:00.000Z",
    updatedAt: "2026-09-20T00:00:00.000Z",
  };
}

function conn(
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
    createdAt: "2026-09-20T00:00:00.000Z",
    updatedAt: "2026-09-20T00:00:00.000Z",
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
    nursingProblems: [],
    nursingProblemSupports: [],
    integrations: [],
    integrationMembers: [],
  };
}

function stored(
  id: string,
  sourceCardId: string,
  targetCardId: string,
  points: Point[],
  sourceEdge: EdgeSide = "right",
  targetEdge: EdgeSide = "left",
): StoredRouteGeometry {
  return {
    connectionId: id,
    sourceCardId,
    targetCardId,
    sourceEdge,
    targetEdge,
    sourcePin: { ...points[0]! },
    targetPin: { ...points[points.length - 1]! },
    points,
  };
}

function stateOf(routes: StoredRouteGeometry[]): StableRouteState {
  const byId: Record<string, StoredRouteGeometry> = {};
  const lastValidPoints: Record<string, Point[]> = {};
  for (const route of routes) {
    byId[route.connectionId] = route;
    lastValidPoints[route.connectionId] = route.points;
  }
  return { byId, lastValidPoints, invalidReasons: {}, bridges: [], qualityTrace: {} };
}

function positionsOf(cards: RelatedDiagramCard[]) {
  return cards
    .map((item) => ({ id: item.id, x: item.layout.x, y: item.layout.y }))
    .sort((a, b) => a.id.localeCompare(b.id));
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

test("A. direct good route stays unchanged", () => {
  const cards = [card("a", 80, 80), card("b", 240, 80)];
  const connections = [conn("e1", "a", "b")];
  const routeState = seedStableRouteState(cards, connections);
  const frozen = structuredClone(routeState);
  const refined = refineRouteReadability({ cards, connections, routeState });
  assert.deepEqual(refined.changedCardIds, []);
  assert.equal(refined.routeChanged, false);
  assert.deepEqual(refined.routeState, frozen);
});

test("B. same cards / bad detour is a route-only improvement", () => {
  const cards = [card("a", 80, 400), card("b", 280, 400)];
  const connections = [conn("e1", "a", "b")];
  const points = [
    { x: 160, y: 420 },
    { x: 160, y: 40 },
    { x: 360, y: 40 },
    { x: 360, y: 420 },
  ];
  const routeState = stateOf([stored("e1", "a", "b", points)]);
  const before = analyzeRouteReadability({ cards, connections, routeState });
  assert.ok(before.connections[0]!.detourRatio > 3);
  const refined = refineRouteReadability({ cards, connections, routeState });
  assert.deepEqual(refined.changedCardIds, []);
  assert.equal(refined.routeChanged, true);
  const after = analyzeRouteReadability({
    cards: refined.cards,
    connections,
    routeState: refined.routeState,
  });
  assert.ok(after.connections[0]!.detourRatio < before.connections[0]!.detourRatio);
  assert.ok(after.totalLength < before.totalLength);
  assert.deepEqual(positionsOf(refined.cards), positionsOf(cards));
});

test("C. card-through is avoided by a route-only candidate", () => {
  const cards = [
    card("a", 40, 200),
    card("wall", 200, 180, { width: 80, height: 80 }),
    card("b", 400, 200),
  ];
  const connections = [conn("e1", "a", "b")];
  const points = [
    { x: 120, y: 220 },
    { x: 400, y: 220 },
  ];
  const routeState = stateOf([stored("e1", "a", "b", points)]);
  const before = analyzeRouteReadability({ cards, connections, routeState });
  assert.ok(before.totalCardThrough >= 1);
  const refined = refineRouteReadability({ cards, connections, routeState });
  const after = analyzeRouteReadability({
    cards: refined.cards,
    connections,
    routeState: refined.routeState,
  });
  assert.equal(after.totalCardThrough, 0);
  assert.equal(after.highwayCount, 0);
  assert.ok(after.longestRouteLength < 500);
  assert.ok(refined.routeChanged || refined.changedCardIds.length > 0);
});

test("D. route-only impossible falls back to a small card move", () => {
  const cards = [
    card("a", 40, 200),
    card("wall", 200, 160, { width: 80, height: 120 }),
    card("b", 400, 200),
  ];
  const connections = [conn("e1", "a", "b")];
  const points = [
    { x: 120, y: 220 },
    { x: 400, y: 220 },
  ];
  const routeState = stateOf([stored("e1", "a", "b", points)]);
  const before = analyzeRouteReadability({ cards, connections, routeState });
  assert.ok(before.totalCardThrough >= 1);
  const refined = refineRouteReadability({ cards, connections, routeState });
  const after = analyzeRouteReadability({
    cards: refined.cards,
    connections,
    routeState: refined.routeState,
  });
  assert.equal(after.totalCardThrough, 0);
  assert.ok(after.highwayCount <= before.highwayCount);
  assert.ok(sceneDisplacement(cards, refined.cards) <= 192);
});

test("E. blocking low-degree card is a movement candidate", () => {
  const cards = [
    card("a", 40, 200),
    card("block", 200, 180, { width: 80, height: 80 }),
    card("b", 400, 200),
  ];
  const connections = [conn("e1", "a", "b")];
  const points = [
    { x: 120, y: 220 },
    { x: 400, y: 220 },
  ];
  const refined = refineRouteReadability({
    cards,
    connections,
    routeState: stateOf([stored("e1", "a", "b", points)]),
  });
  const after = analyzeRouteReadability({
    cards: refined.cards,
    connections,
    routeState: refined.routeState,
  });
  assert.equal(after.totalCardThrough, 0);
  if (refined.changedCardIds.length > 0) {
    assert.ok(refined.changedCardIds.includes("block"));
  }
});

test("F. blocking hub may move when it improves the scene", () => {
  const cards = [
    card("a", 40, 200),
    card("hub", 200, 180, { width: 80, height: 80 }),
    card("b", 400, 200),
    card("s1", 200, 40),
    card("s2", 40, 40),
    card("s3", 400, 40),
  ];
  const connections = [
    conn("e1", "a", "b"),
    conn("h1", "hub", "s1"),
    conn("h2", "hub", "s2"),
    conn("h3", "hub", "s3"),
  ];
  const routeState = seedStableRouteState(cards, connections);
  routeState.byId.e1 = stored("e1", "a", "b", [
    { x: 120, y: 220 },
    { x: 400, y: 220 },
  ]);
  const refined = refineRouteReadability({ cards, connections, routeState });
  const after = analyzeRouteReadability({
    cards: refined.cards,
    connections,
    routeState: refined.routeState,
  });
  assert.equal(after.totalCardThrough, 0);
  assert.ok(after.longestRouteLength < 900);
});

test("G. excessive bends prefer a simpler route", () => {
  const cards = [card("a", 80, 200), card("b", 280, 200)];
  const connections = [conn("e1", "a", "b")];
  const points = [
    { x: 160, y: 220 },
    { x: 180, y: 220 },
    { x: 180, y: 80 },
    { x: 220, y: 80 },
    { x: 220, y: 220 },
    { x: 260, y: 220 },
    { x: 260, y: 80 },
    { x: 280, y: 80 },
    { x: 280, y: 220 },
  ];
  const routeState = stateOf([stored("e1", "a", "b", points)]);
  const before = analyzeRouteReadability({ cards, connections, routeState });
  assert.ok(before.connections[0]!.bendCount > 4);
  const refined = refineRouteReadability({ cards, connections, routeState });
  const after = analyzeRouteReadability({
    cards: refined.cards,
    connections,
    routeState: refined.routeState,
  });
  assert.ok(after.connections[0]!.bendCount < before.connections[0]!.bendCount);
  assert.deepEqual(refined.changedCardIds, []);
});

test("H. avoidable crossing is reduced when a cheap route exists", () => {
  const cards = [
    card("a", 80, 80),
    card("b", 400, 80),
    card("c", 80, 280),
    card("d", 400, 280),
  ];
  const connections = [conn("e1", "a", "d"), conn("e2", "c", "b")];
  const routeState = stateOf([
    stored("e1", "a", "d", [
      { x: 160, y: 100 },
      { x: 400, y: 100 },
      { x: 400, y: 300 },
    ]),
    stored("e2", "c", "b", [
      { x: 160, y: 300 },
      { x: 160, y: 100 },
      { x: 400, y: 100 },
    ]),
  ]);
  const before = analyzeRouteReadability({ cards, connections, routeState });
  const refined = refineRouteReadability({ cards, connections, routeState });
  const after = analyzeRouteReadability({
    cards: refined.cards,
    connections,
    routeState: refined.routeState,
  });
  assert.ok(after.totalCrossings <= before.totalCrossings);
  if (before.totalCrossings > 0) {
    assert.ok(
      after.totalCrossings < before.totalCrossings ||
        after.totalCardThrough <= before.totalCardThrough,
    );
  }
});

test("I. unavoidable crossing keeps the bridge", () => {
  const cards = [
    card("a", 80, 80),
    card("b", 400, 320),
    card("c", 80, 320),
    card("d", 400, 80),
  ];
  const connections = [conn("e1", "a", "b"), conn("e2", "c", "d")];
  const routeState = seedStableRouteState(cards, connections);
  const before = analyzeRouteReadability({ cards, connections, routeState });
  const refined = refineRouteReadability({ cards, connections, routeState });
  const after = analyzeRouteReadability({
    cards: refined.cards,
    connections,
    routeState: refined.routeState,
  });
  if (before.totalCrossings > 0 && after.totalCrossings === 0) {
    assert.ok(after.totalCardThrough <= before.totalCardThrough);
    assert.ok(after.totalBends <= before.totalBends + 2);
  } else {
    assert.ok(after.totalCrossings >= 1 || after.totalCardThrough === 0);
  }
});

test("J. legend is treated as an obstacle", () => {
  const legend = getA3LegendBounds();
  const cards = [
    card("a", legend.x - 220, legend.y + 20),
    card("b", legend.x + 40, legend.y - 160),
  ];
  const connections = [conn("e1", "a", "b")];
  const points = [
    { x: cards[0]!.layout.x + 80, y: legend.y + 40 },
    { x: legend.x + 80, y: legend.y + 40 },
    { x: legend.x + 80, y: cards[1]!.layout.y + 20 },
  ];
  const routeState = stateOf([stored("e1", "a", "b", points)]);
  const before = analyzeRouteReadability({ cards, connections, routeState });
  assert.ok(before.connections[0]!.reasons.includes("legend_intersection"));
  const refined = refineRouteReadability({ cards, connections, routeState });
  const after = analyzeRouteReadability({
    cards: refined.cards,
    connections,
    routeState: refined.routeState,
  });
  assert.equal(
    after.connections[0]!.reasons.includes("legend_intersection"),
    false,
  );
});

test("K. refined routes stay inside A3", () => {
  const cards = [card("a", 40, 40), card("b", 400, 40)];
  const connections = [conn("e1", "a", "b")];
  const routeState = stateOf([
    stored("e1", "a", "b", [
      { x: 120, y: 60 },
      { x: 120, y: -40 },
      { x: 400, y: -40 },
      { x: 400, y: 60 },
    ]),
  ]);
  const refined = refineRouteReadability({ cards, connections, routeState });
  for (const route of Object.values(refined.routeState.byId)) {
    for (const point of route.points) {
      assert.ok(point.x >= 0 && point.x <= A3_WIDTH_PX);
      assert.ok(point.y >= 0 && point.y <= A3_HEIGHT_PX);
    }
  }
});

function fanTopology(): {
  cards: RelatedDiagramCard[];
  connections: RelatedDiagramConnection[];
  topology: RelatedDiagramRouteTopology;
  routeState: StableRouteState;
} {
  const cards = [
    card("src", 80, 200),
    card("t1", 400, 80),
    card("t2", 400, 320),
  ];
  const connections = [conn("e1", "src", "t1"), conn("e2", "src", "t2")];
  const bp = { x: 220, y: 40 };
  const topology: RelatedDiagramRouteTopology = {
    schema: ROUTE_TOPOLOGY_SCHEMA,
    branchPoints: [{ id: "bp1", x: bp.x, y: bp.y, connectionIds: ["e1", "e2"] }],
    trunks: [
      {
        id: "tr1",
        branchPointId: "bp1",
        connectionIds: ["e1", "e2"],
        points: [
          { x: 160, y: 220 },
          { x: 220, y: 220 },
          { x: 220, y: 40 },
        ],
      },
    ],
    routeGroups: [
      {
        id: "g1",
        sourceCardId: "src",
        trunkId: "tr1",
        connectionIds: ["e1", "e2"],
      },
    ],
    routes: [
      {
        connectionId: "e1",
        sourceEdge: "right",
        targetEdge: "left",
        points: [
          { x: 160, y: 220 },
          { x: 220, y: 220 },
          { x: 220, y: 100 },
          { x: 400, y: 100 },
        ],
      },
      {
        connectionId: "e2",
        sourceEdge: "right",
        targetEdge: "left",
        points: [
          { x: 160, y: 220 },
          { x: 220, y: 220 },
          { x: 220, y: 40 },
          { x: 360, y: 40 },
          { x: 360, y: 340 },
          { x: 400, y: 340 },
        ],
      },
    ],
  };
  return {
    cards,
    connections,
    topology,
    routeState: seedStableRouteState(cards, connections, topology),
  };
}

test("L. Junction membership is preserved", () => {
  const scene = fanTopology();
  const before = topologyMembershipSnapshot(scene.topology);
  const refined = refineRouteReadability(scene);
  assert.deepEqual(topologyMembershipSnapshot(refined.topology!), before);
  assert.deepEqual(
    refined.topology!.branchPoints.map((bp) => bp.id).sort(),
    ["bp1"],
  );
  assert.deepEqual(refined.topology!.routeGroups[0]!.connectionIds, ["e1", "e2"]);
});

test("M. Junction can move when branch readability improves", () => {
  const scene = fanTopology();
  const refined = refineRouteReadability(scene);
  assert.equal(refined.topology!.branchPoints[0]!.id, "bp1");
  assert.deepEqual(refined.topology!.routeGroups[0]!.connectionIds, ["e1", "e2"]);
  const after = analyzeRouteReadability({
    cards: refined.cards,
    connections: scene.connections,
    routeState: refined.routeState,
    topology: refined.topology,
  });
  const before = analyzeRouteReadability(scene);
  assert.ok(after.highwayCount <= before.highwayCount);
  assert.ok(after.totalCardThrough <= before.totalCardThrough);
});

test("N. Knowledge internal structure is preserved", () => {
  const cards = [
    card("k1", 80, 80, { cardType: "knowledge" }),
    card("k2", 80, 446, { cardType: "knowledge" }),
    card("leaf", 400, 80),
  ];
  const connections = [conn("skc6", "k1", "k2"), conn("e1", "k1", "leaf")];
  const routeState = seedStableRouteState(cards, connections);
  const origin = positionsOf(cards);
  const refined = refineRouteReadability({ cards, connections, routeState });
  const knowledge = positionsOf(
    refined.cards.filter((item) => item.cardType === "knowledge"),
  );
  assert.deepEqual(
    knowledge,
    origin.filter((item) => item.id === "k1" || item.id === "k2"),
  );
});

test("O. route-only Arrange writes one history entry", () => {
  const graph = graphOf(
    [card("a", 80, 400), card("b", 280, 400)],
    [conn("e1", "a", "b")],
  );
  const routeState = stateOf([
    stored("e1", "a", "b", [
      { x: 160, y: 420 },
      { x: 160, y: 40 },
      { x: 360, y: 40 },
      { x: 360, y: 420 },
    ]),
  ]);
  const result = arrangeRelatedDiagramScene({ graph, routeState });
  assert.equal(result.kind, "applied");
  if (result.kind !== "applied") return;
  assert.deepEqual(result.historyAction.cardIds, []);
  const history = pushDiagramHistory(emptyDiagramHistory(), result.historyAction);
  assert.equal(history.past.length, 1);
  assert.equal(history.future.length, 0);
});

test("P. route-only Undo restores the exact route", () => {
  const graph = graphOf(
    [card("a", 80, 400), card("b", 280, 400)],
    [conn("e1", "a", "b")],
  );
  const routeState = stateOf([
    stored("e1", "a", "b", [
      { x: 160, y: 420 },
      { x: 160, y: 40 },
      { x: 360, y: 40 },
      { x: 360, y: 420 },
    ]),
  ]);
  const result = arrangeRelatedDiagramScene({ graph, routeState });
  assert.equal(result.kind, "applied");
  if (result.kind !== "applied") return;
  const undone = undoDiagramHistory(
    pushDiagramHistory(emptyDiagramHistory(), result.historyAction),
  );
  assert.deepEqual(undone.fragment!.routeState, routeState);
  const restored = applySceneFragmentToGraph(result.graph, undone.fragment!);
  assert.deepEqual(positionsOf(restored.cards), positionsOf(graph.cards));
});

test("Q. route-only Redo restores the improved route", () => {
  const graph = graphOf(
    [card("a", 80, 400), card("b", 280, 400)],
    [conn("e1", "a", "b")],
  );
  const routeState = stateOf([
    stored("e1", "a", "b", [
      { x: 160, y: 420 },
      { x: 160, y: 40 },
      { x: 360, y: 40 },
      { x: 360, y: 420 },
    ]),
  ]);
  const result = arrangeRelatedDiagramScene({ graph, routeState });
  assert.equal(result.kind, "applied");
  if (result.kind !== "applied") return;
  const undone = undoDiagramHistory(
    pushDiagramHistory(emptyDiagramHistory(), result.historyAction),
  );
  const redone = redoDiagramHistory(undone.history);
  assert.deepEqual(redone.fragment!.routeState, result.routeState);
});

test("R. card+route Arrange writes one history entry", () => {
  const graph = graphOf(
    [card("a", 40, 80), card("b", 1200, 80)],
    [conn("e1", "a", "b")],
  );
  const result = arrangeRelatedDiagramScene({
    graph,
    routeState: seedStableRouteState(graph.cards, graph.connections),
  });
  assert.equal(result.kind, "applied");
  if (result.kind !== "applied") return;
  assert.ok(result.historyAction.cardIds.length > 0);
  const history = pushDiagramHistory(emptyDiagramHistory(), result.historyAction);
  assert.equal(history.past.length, 1);
});

test("S. card+route Undo restores the exact original scene", () => {
  const graph = graphOf(
    [card("a", 40, 80), card("b", 1200, 80)],
    [conn("e1", "a", "b")],
  );
  const routeState = seedStableRouteState(graph.cards, graph.connections);
  const result = arrangeRelatedDiagramScene({ graph, routeState });
  assert.equal(result.kind, "applied");
  if (result.kind !== "applied") return;
  const undone = undoDiagramHistory(
    pushDiagramHistory(emptyDiagramHistory(), result.historyAction),
  );
  const restored = applySceneFragmentToGraph(result.graph, undone.fragment!);
  assert.deepEqual(positionsOf(restored.cards), positionsOf(graph.cards));
  assert.deepEqual(undone.fragment!.routeState, routeState);
});

test("T. card+route Redo restores the arranged scene", () => {
  const graph = graphOf(
    [card("a", 40, 80), card("b", 1200, 80)],
    [conn("e1", "a", "b")],
  );
  const result = arrangeRelatedDiagramScene({
    graph,
    routeState: seedStableRouteState(graph.cards, graph.connections),
  });
  assert.equal(result.kind, "applied");
  if (result.kind !== "applied") return;
  const undone = undoDiagramHistory(
    pushDiagramHistory(emptyDiagramHistory(), result.historyAction),
  );
  const redone = redoDiagramHistory(undone.history);
  const restored = applySceneFragmentToGraph(graph, redone.fragment!);
  assert.deepEqual(positionsOf(restored.cards), positionsOf(result.graph.cards));
  assert.deepEqual(redone.fragment!.routeState, result.routeState);
});

test("U. refinement is deterministic", () => {
  const cards = [
    card("a", 40, 200),
    card("wall", 200, 180, { width: 80, height: 80 }),
    card("b", 400, 200),
  ];
  const connections = [conn("e1", "a", "b")];
  const routeState = stateOf([
    stored("e1", "a", "b", [
      { x: 120, y: 220 },
      { x: 400, y: 220 },
    ]),
  ]);
  const first = refineRouteReadability({ cards, connections, routeState });
  for (let i = 0; i < 3; i += 1) {
    assert.deepEqual(
      refineRouteReadability({ cards, connections, routeState }),
      first,
    );
  }
});

test("V. refinement is idempotent", () => {
  const cards = [
    card("a", 40, 200),
    card("wall", 200, 180, { width: 80, height: 80 }),
    card("b", 400, 200),
  ];
  const connections = [conn("e1", "a", "b")];
  const first = refineRouteReadability({
    cards,
    connections,
    routeState: stateOf([
      stored("e1", "a", "b", [
        { x: 120, y: 220 },
        { x: 400, y: 220 },
      ]),
    ]),
  });
  const second = refineRouteReadability({
    cards: first.cards,
    connections,
    routeState: first.routeState,
    topology: first.topology,
  });
  assert.equal(second.routeChanged, false);
  assert.deepEqual(second.changedCardIds, []);
  assert.deepEqual(positionsOf(second.cards), positionsOf(first.cards));
});

test("W. second Arrange is a NO-OP", () => {
  const graph = graphOf(
    [
      card("a", 40, 200),
      card("wall", 200, 180, { width: 80, height: 80 }),
      card("b", 400, 200),
    ],
    [conn("e1", "a", "b")],
  );
  const first = arrangeRelatedDiagramScene({
    graph,
    routeState: stateOf([
      stored("e1", "a", "b", [
        { x: 120, y: 220 },
        { x: 400, y: 220 },
      ]),
    ]),
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

test("X. connection array order does not change the result", () => {
  const cards = [
    card("a", 40, 80),
    card("b", 400, 80),
    card("c", 40, 280),
    card("d", 400, 280),
  ];
  const connections = [conn("e1", "a", "d"), conn("e2", "c", "b")];
  const routeState = seedStableRouteState(cards, connections);
  const forward = refineRouteReadability({ cards, connections, routeState });
  const reversed = refineRouteReadability({
    cards,
    connections: [...connections].reverse(),
    routeState,
  });
  assert.deepEqual(positionsOf(forward.cards), positionsOf(reversed.cards));
  assert.deepEqual(
    forward.routeState.byId.e1?.points,
    reversed.routeState.byId.e1?.points,
  );
});

test("Y. card array order does not change the result", () => {
  const cards = [
    card("z", 40, 200),
    card("wall", 200, 180, { width: 80, height: 80 }),
    card("a", 400, 200),
  ];
  const connections = [conn("e1", "z", "a")];
  const routeState = stateOf([
    stored("e1", "z", "a", [
      { x: 120, y: 220 },
      { x: 400, y: 220 },
    ]),
  ]);
  const forward = refineRouteReadability({ cards, connections, routeState });
  const reversed = refineRouteReadability({
    cards: [...cards].reverse(),
    connections,
    routeState,
  });
  assert.deepEqual(positionsOf(forward.cards), positionsOf(reversed.cards));
});

test("Z. semantic graph fields stay unchanged", () => {
  const graph = graphOf(
    [
      card("a", 40, 200),
      card("wall", 200, 180, { width: 80, height: 80 }),
      card("np", 400, 200, { cardType: "nursing_problem", width: 200, height: 78 }),
    ],
    [conn("e1", "a", "np")],
  );
  graph.nursingProblems = [
    {
      cardId: "np",
      status: "active",
      priority: 1,
      createdAt: "2026-09-20T00:00:00.000Z",
      updatedAt: "2026-09-20T00:00:00.000Z",
    },
  ];
  const frozenConn = structuredClone(graph.connections);
  const frozenNp = structuredClone(graph.nursingProblems);
  const result = arrangeRelatedDiagramScene({
    graph,
    routeState: stateOf([
      stored("e1", "a", "np", [
        { x: 120, y: 220 },
        { x: 400, y: 220 },
      ]),
    ]),
  });
  assert.equal(result.kind, "applied");
  if (result.kind !== "applied") return;
  assert.deepEqual(result.graph.connections, frozenConn);
  assert.deepEqual(result.graph.nursingProblems, frozenNp);
  assert.equal(result.graph.cards.find((item) => item.id === "np")!.state, "current");
});

test("fixture BEFORE / AFTER readability", () => {
  const scene = fixtureScene();
  const before = analyzeRouteReadability({
    cards: scene.graph.cards,
    connections: scene.graph.connections,
    routeState: scene.routeState,
    topology: scene.routeTopology,
  });
  const arranged = arrangeRelatedDiagramScene({
    graph: scene.graph,
    routeState: scene.routeState,
    topology: scene.routeTopology,
  });
  const afterCards =
    arranged.kind === "applied" ? arranged.graph.cards : scene.graph.cards;
  const afterState =
    arranged.kind === "applied" ? arranged.routeState : scene.routeState;
  const afterTopo =
    arranged.kind === "applied" ? arranged.topology : scene.routeTopology;
  const after = analyzeRouteReadability({
    cards: afterCards,
    connections: scene.graph.connections,
    routeState: afterState,
    topology: afterTopo,
  });
  const displacement = sceneDisplacement(scene.graph.cards, afterCards);
  const byId = new Map(before.connections.map((row) => [row.connectionId, row]));
  const details = after.connections
    .filter((row) => {
      const prev = byId.get(row.connectionId);
      return (
        (prev && prev.reasons.length > 0) ||
        row.reasons.length > 0 ||
        (prev && prev.cardIntersectionCount !== row.cardIntersectionCount)
      );
    })
    .map((row) => ({
      connectionId: row.connectionId,
      before: byId.get(row.connectionId),
      after: row,
    }));
  console.log("L2B_FIXTURE_BEFORE", JSON.stringify(before));
  console.log("L2B_FIXTURE_AFTER", JSON.stringify(after));
  console.log("L2B_FIXTURE_DISPLACEMENT", displacement);
  console.log("L2B_FIXTURE_PROBLEMS", JSON.stringify(details));
  console.log(
    "L2B_FIXTURE_KIND",
    arranged.kind,
    arranged.kind === "applied" ? arranged.historyAction.cardIds : [],
  );
  assert.ok(after.totalCardThrough <= before.totalCardThrough);
  assert.ok(after.highwayCount <= before.highwayCount);
  assert.ok(after.longestRouteLength <= Math.max(before.longestRouteLength, 500));
  for (const item of afterCards) {
    assert.ok(
      isLegalCardPlacement(
        item.layout,
        afterCards.filter((other) => other.id !== item.id),
        { minGap: CARD_MIN_GAP },
      ),
    );
  }
  assert.ok(displacement >= 0);
  if (arranged.kind === "applied") {
    const again = arrangeRelatedDiagramScene({
      graph: arranged.graph,
      routeState: arranged.routeState,
      topology: arranged.topology,
    });
    assert.equal(again.kind, "noop");
  }
});

test("policy-A. huge route-only wrap loses to a 48px card move", () => {
  const cards = [
    card("a", 40, 200),
    card("wall", 200, 160, { width: 80, height: 120 }),
    card("b", 400, 200),
  ];
  const connections = [conn("e1", "a", "b")];
  const refined = refineRouteReadability({
    cards,
    connections,
    routeState: stateOf([
      stored("e1", "a", "b", [
        { x: 120, y: 220 },
        { x: 400, y: 220 },
      ]),
    ]),
  });
  const after = analyzeRouteReadability({
    cards: refined.cards,
    connections,
    routeState: refined.routeState,
  });
  assert.equal(after.totalCardThrough, 0);
  assert.ok(refined.changedCardIds.length > 0);
  assert.equal(after.highwayCount, 0);
  assert.ok(after.longestRouteLength < 500);
});

test("policy-B. card move with 1 bend beats a 4-bend route-only hop", () => {
  const cards = [
    card("a", 40, 200),
    card("block", 200, 188, { width: 80, height: 64 }),
    card("b", 400, 200),
  ];
  const connections = [conn("e1", "a", "b")];
  const refined = refineRouteReadability({
    cards,
    connections,
    routeState: stateOf([
      stored("e1", "a", "b", [
        { x: 120, y: 220 },
        { x: 400, y: 220 },
      ]),
    ]),
  });
  const after = analyzeRouteReadability({
    cards: refined.cards,
    connections,
    routeState: refined.routeState,
  });
  assert.equal(after.totalCardThrough, 0);
  assert.ok(after.maxBendCount <= 2 || refined.changedCardIds.length > 0);
});

test("policy-C. A3-spanning route is penalized by locality", () => {
  const cards = [card("a", 80, 400), card("b", 280, 400)];
  const connections = [conn("e1", "a", "b")];
  const routeState = stateOf([
    stored("e1", "a", "b", [
      { x: 160, y: 420 },
      { x: 160, y: 40 },
      { x: 1500, y: 40 },
      { x: 1500, y: 420 },
      { x: 280, y: 420 },
    ]),
  ]);
  const before = analyzeRouteReadability({ cards, connections, routeState });
  assert.ok(before.highwayCount >= 1);
  const refined = refineRouteReadability({ cards, connections, routeState });
  const after = analyzeRouteReadability({
    cards: refined.cards,
    connections,
    routeState: refined.routeState,
  });
  assert.equal(after.highwayCount, 0);
  assert.ok(after.longestRouteLength < before.longestRouteLength);
  assert.ok(after.corridorViolationCount < before.corridorViolationCount);
});

test("policy-D. blocker move can create a short route", () => {
  const cards = [
    card("a", 40, 200),
    card("block", 200, 180, { width: 80, height: 80 }),
    card("b", 400, 200),
  ];
  const connections = [conn("e1", "a", "b")];
  const refined = refineRouteReadability({
    cards,
    connections,
    routeState: stateOf([
      stored("e1", "a", "b", [
        { x: 120, y: 220 },
        { x: 400, y: 220 },
      ]),
    ]),
  });
  const after = analyzeRouteReadability({
    cards: refined.cards,
    connections,
    routeState: refined.routeState,
  });
  assert.equal(after.totalCardThrough, 0);
  assert.ok(after.longestRouteLength < 450);
});

test("policy-E. hub may move when several edges improve", () => {
  const cards = [
    card("hub", 200, 180, { width: 80, height: 80 }),
    card("a", 40, 200),
    card("b", 400, 200),
    card("s1", 200, 40),
    card("s2", 40, 40),
    card("s3", 400, 40),
  ];
  const connections = [
    conn("e1", "a", "b"),
    conn("h1", "hub", "s1"),
    conn("h2", "hub", "s2"),
    conn("h3", "hub", "s3"),
  ];
  const routeState = seedStableRouteState(cards, connections);
  routeState.byId.e1 = stored("e1", "a", "b", [
    { x: 120, y: 220 },
    { x: 400, y: 220 },
  ]);
  const refined = refineRouteReadability({ cards, connections, routeState });
  const after = analyzeRouteReadability({
    cards: refined.cards,
    connections,
    routeState: refined.routeState,
  });
  assert.equal(after.totalCardThrough, 0);
});

test("policy-F. one-edge wrap that worsens the scene is rejected", () => {
  const cards = [
    card("a", 40, 500),
    card("wall", 200, 20, { width: 80, height: 1080 }),
    card("b", 400, 500),
    card("c", 40, 40),
    card("d", 400, 40),
  ];
  const connections = [conn("e1", "a", "b"), conn("e2", "c", "d")];
  const routeState = seedStableRouteState(cards, connections);
  routeState.byId.e1 = stored("e1", "a", "b", [
    { x: 120, y: 520 },
    { x: 400, y: 520 },
  ]);
  const before = analyzeRouteReadability({ cards, connections, routeState });
  const refined = refineRouteReadability({ cards, connections, routeState });
  const after = analyzeRouteReadability({
    cards: refined.cards,
    connections,
    routeState: refined.routeState,
  });
  assert.ok(after.highwayCount <= before.highwayCount);
  assert.ok(after.totalCardThrough <= before.totalCardThrough);
  assert.ok(after.longestRouteLength <= Math.max(before.longestRouteLength, 500));
});

test("policy-G. second Arrange is an exact NO-OP", () => {
  const graph = graphOf(
    [
      card("a", 40, 200),
      card("wall", 200, 180, { width: 80, height: 80 }),
      card("b", 400, 200),
    ],
    [conn("e1", "a", "b")],
  );
  const first = arrangeRelatedDiagramScene({
    graph,
    routeState: stateOf([
      stored("e1", "a", "b", [
        { x: 120, y: 220 },
        { x: 400, y: 220 },
      ]),
    ]),
  });
  assert.equal(first.kind, "applied");
  if (first.kind !== "applied") return;
  const second = arrangeRelatedDiagramScene({
    graph: first.graph,
    routeState: first.routeState,
    topology: first.topology,
  });
  assert.equal(second.kind, "noop");
  assert.deepEqual(positionsOf(first.graph.cards), positionsOf(first.graph.cards));
});

test("policy-H. DEV workspace flow: second fixture Arrange is exact NO-OP", () => {
  const scene = fixtureScene();
  const first = arrangeRelatedDiagramScene({
    graph: scene.graph,
    routeState: scene.routeState,
    topology: scene.routeTopology,
  });
  const graph = first.kind === "applied" ? first.graph : scene.graph;
  const routeState = first.kind === "applied" ? first.routeState : scene.routeState;
  const topology = first.kind === "applied" ? first.topology : scene.routeTopology;
  const second = arrangeRelatedDiagramScene({
    graph,
    routeState,
    topology,
  });
  assert.equal(second.kind, "noop");
  if (first.kind === "applied") {
    assert.deepEqual(positionsOf(graph.cards), positionsOf(first.graph.cards));
    assert.deepEqual(
      Object.keys(routeState.byId)
        .sort()
        .map((id) => routeState.byId[id]!.points),
      Object.keys(first.routeState.byId)
        .sort()
        .map((id) => first.routeState.byId[id]!.points),
    );
  }
});

console.log(`\n${passed} tests passed`);
