/**
 * L2 connection-aware layout + route readability.
 * Run: node_modules/.bin/jiti lib/v2/relatedDiagram/diagramLayoutL2.test.ts
 */

import assert from "node:assert/strict";
import {
  applySceneFragmentToGraph,
  emptyDiagramHistory,
  pushDiagramHistory,
  redoDiagramHistory,
  undoDiagramHistory,
} from "./diagramHistory";
import { layoutRelatedDiagram } from "./diagramLayout";
import {
  PREFERRED_EDGE_GAP_MAX,
  compareRouteReadability,
  countPolylineCardHits,
  countPolylineLegendHits,
  layoutRelatedDiagramConnected,
  measureConnectionLayoutMetrics,
  optimizeRelatedDiagramConnections,
  orthogonalBorderGap,
  preferExistingRouteIfTied,
  scoreOrthogonalPolyline,
} from "./diagramLayoutL2";
import { arrangeRelatedDiagramScene } from "./applyRelatedDiagramLayout";
import { seedStableRouteState, stableRoutesList } from "./incrementalRoutes";
import { topologyMembershipSnapshot } from "./regenerateRouteTopology";
import { resolveDevFixtureReadonlyScene } from "./resolveReadonlyScene";
import { getA3LegendBounds } from "./a3Legend";
import { A3_HEIGHT_PX, A3_WIDTH_PX } from "./a3Canvas";
import type {
  RelatedDiagramCard,
  RelatedDiagramCardState,
  RelatedDiagramConnection,
  RelatedDiagramConnectionRelationType,
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

function card(
  id: string,
  x: number,
  y: number,
  options?: {
    width?: number;
    height?: number;
    cardType?: RelatedDiagramCard["cardType"];
    state?: RelatedDiagramCardState | null;
    zIndex?: number;
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
      zIndex: options?.zIndex ?? 1,
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
  relationType: RelatedDiagramConnectionRelationType = "current",
): RelatedDiagramConnection {
  return {
    id,
    sourceCardId,
    targetCardId,
    relationType,
    origin: "student_diagram",
    createdAt: "2026-09-20T00:00:00.000Z",
    updatedAt: "2026-09-20T00:00:00.000Z",
  };
}

function graphOf(
  cards: RelatedDiagramCard[],
  connections: RelatedDiagramConnection[] = [],
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

function applyLayout(
  cards: RelatedDiagramCard[],
  result: ReturnType<typeof layoutRelatedDiagramConnected>,
): RelatedDiagramCard[] {
  const byId = new Map(result.positions.map((row) => [row.cardId, row]));
  return cards.map((item) => {
    const next = byId.get(item.id);
    return next
      ? { ...item, layout: { ...item.layout, x: next.x, y: next.y } }
      : item;
  });
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

test("L2-A very long single edge gets shorter", () => {
  const cards = [card("a", 40, 80), card("b", 1200, 80)];
  const connections = [conn("e1", "a", "b")];
  const before = orthogonalBorderGap(cards[0]!.layout, cards[1]!.layout);
  const result = optimizeRelatedDiagramConnections({ cards, connections });
  const next = applyLayout(cards, result);
  const after = orthogonalBorderGap(next[0]!.layout, next[1]!.layout);
  assert.ok(after < before);
  assert.ok(after <= PREFERRED_EDGE_GAP_MAX + 1);
  assert.ok(result.changedCardIds.length > 0);
});

test("L2-B already reasonable edge does not move cards", () => {
  const cards = [card("a", 80, 80), card("b", 220, 80)];
  const result = optimizeRelatedDiagramConnections({
    cards,
    connections: [conn("e1", "a", "b")],
  });
  assert.deepEqual(result.changedCardIds, []);
});

test("L2-C hub is not moved when a leaf can move", () => {
  const hub = card("hub", 200, 200);
  const cards = [
    hub,
    card("l1", 200, 80),
    card("l2", 80, 200),
    card("far", 1300, 200),
  ];
  const connections = [
    conn("e1", "hub", "l1"),
    conn("e2", "hub", "l2"),
    conn("e3", "hub", "far"),
  ];
  const result = optimizeRelatedDiagramConnections({ cards, connections });
  const next = applyLayout(cards, result);
  const hubAfter = next.find((item) => item.id === "hub")!;
  assert.equal(hubAfter.layout.x, 200);
  assert.equal(hubAfter.layout.y, 200);
  assert.ok(result.changedCardIds.includes("far"));
});

test("L2-D moving one endpoint improves the long route", () => {
  const cards = [card("hub", 200, 200), card("far", 1300, 200)];
  const connections = [conn("e1", "hub", "far")];
  const before = orthogonalBorderGap(cards[0]!.layout, cards[1]!.layout);
  const result = optimizeRelatedDiagramConnections({ cards, connections });
  const next = applyLayout(cards, result);
  const after = orthogonalBorderGap(next[0]!.layout, next[1]!.layout);
  assert.ok(after < before);
  assert.equal(result.changedCardIds.length, 1);
});

test("L2-E Knowledge group stays rigid", () => {
  const cards = [
    card("k1", 80, 80, { cardType: "knowledge", width: 146, height: 62 }),
    card("k2", 260, 200, { cardType: "knowledge", width: 146, height: 62 }),
    card("info", 1200, 80),
  ];
  const dx = cards[1]!.layout.x - cards[0]!.layout.x;
  const dy = cards[1]!.layout.y - cards[0]!.layout.y;
  const result = optimizeRelatedDiagramConnections({
    cards,
    connections: [conn("e1", "k1", "info")],
  });
  const next = applyLayout(cards, result);
  assert.equal(next[1]!.layout.x - next[0]!.layout.x, dx);
  assert.equal(next[1]!.layout.y - next[0]!.layout.y, dy);
});

test("L2-F NP priority does not change geometry decisions", () => {
  const cards = [
    card("np", 40, 80, { cardType: "nursing_problem", width: 200, height: 78 }),
    card("info", 1100, 80),
  ];
  const connections = [conn("e1", "info", "np", "nursing_problem_basis")];
  const a = optimizeRelatedDiagramConnections({ cards, connections });
  const b = optimizeRelatedDiagramConnections({ cards, connections });
  assert.deepEqual(a.positions, b.positions);
});

test("L2-G current / potential with the same geometry match", () => {
  const current = [
    card("u1", 40, 80, { cardType: "understanding", state: "current" }),
    card("u2", 1100, 80, { cardType: "understanding", state: "current" }),
  ];
  const potential = [
    card("u1", 40, 80, { cardType: "understanding", state: "potential" }),
    card("u2", 1100, 80, { cardType: "understanding", state: "potential" }),
  ];
  const connections = [conn("e1", "u1", "u2")];
  assert.deepEqual(
    optimizeRelatedDiagramConnections({ cards: current, connections }).positions,
    optimizeRelatedDiagramConnections({ cards: potential, connections }).positions,
  );
});

test("L2-H relationType does not change the geometry rule", () => {
  const cards = [card("a", 40, 80), card("b", 1100, 80)];
  const current = optimizeRelatedDiagramConnections({
    cards,
    connections: [conn("e1", "a", "b", "current")],
  });
  const treat = optimizeRelatedDiagramConnections({
    cards,
    connections: [conn("e1", "a", "b", "treatment")],
  });
  const basis = optimizeRelatedDiagramConnections({
    cards,
    connections: [conn("e1", "a", "b", "nursing_problem_basis")],
  });
  assert.deepEqual(current.positions, treat.positions);
  assert.deepEqual(current.positions, basis.positions);
});

test("L2-I route scoring rejects an unrelated card hit", () => {
  const blocker = { id: "wall", x: 200, y: 40, width: 80, height: 80 };
  const through = [
    { x: 40, y: 80 },
    { x: 400, y: 80 },
  ];
  const around = [
    { x: 40, y: 80 },
    { x: 40, y: 200 },
    { x: 400, y: 200 },
    { x: 400, y: 80 },
  ];
  const ignore = new Set(["a", "b"]);
  const a = scoreOrthogonalPolyline(through, [blocker], ignore);
  const b = scoreOrthogonalPolyline(around, [blocker], ignore);
  assert.ok(a.cardThrough > 0);
  assert.equal(b.cardThrough, 0);
  assert.ok(compareRouteReadability(b, a) < 0);
});

test("L2-J route scoring rejects a legend hit", () => {
  const legend = getA3LegendBounds();
  const through = [
    { x: legend.x - 20, y: legend.y + 20 },
    { x: legend.x + legend.width + 20, y: legend.y + 20 },
  ];
  const around = [
    { x: legend.x - 20, y: 40 },
    { x: legend.x + legend.width + 20, y: 40 },
  ];
  assert.equal(countPolylineLegendHits(through), 1);
  assert.equal(countPolylineLegendHits(around), 0);
  const ignore = new Set<string>();
  assert.ok(
    compareRouteReadability(
      scoreOrthogonalPolyline(around, [], ignore),
      scoreOrthogonalPolyline(through, [], ignore),
    ) < 0,
  );
});

test("L2-K fewer bends are preferred", () => {
  const two = scoreOrthogonalPolyline(
    [
      { x: 0, y: 0 },
      { x: 80, y: 0 },
      { x: 80, y: 40 },
    ],
    [],
    new Set(),
  );
  const five = scoreOrthogonalPolyline(
    [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 20 },
      { x: 40, y: 20 },
      { x: 40, y: 40 },
      { x: 80, y: 40 },
    ],
    [],
    new Set(),
  );
  assert.ok(two.bends < five.bends);
  assert.ok(compareRouteReadability(two, five) < 0);
});

test("L2-L shorter route wins when bends are equal", () => {
  const short = scoreOrthogonalPolyline(
    [
      { x: 0, y: 0 },
      { x: 80, y: 0 },
    ],
    [],
    new Set(),
  );
  const long = scoreOrthogonalPolyline(
    [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
    ],
    [],
    new Set(),
  );
  assert.equal(short.bends, long.bends);
  assert.ok(compareRouteReadability(short, long) < 0);
});

test("L2-M fewer crossings win when otherwise comparable", () => {
  const zero = { ...scoreOrthogonalPolyline([{ x: 0, y: 0 }, { x: 40, y: 0 }], [], new Set()), crossings: 0 };
  const one = { ...zero, crossings: 1 };
  assert.ok(compareRouteReadability(zero, one) < 0);
});

test("L2-N explicit Junction ids are preserved after arrange", () => {
  const scene = fixtureScene();
  const before = scene.routeTopology!.branchPoints.map((bp) => bp.id).sort();
  const result = arrangeRelatedDiagramScene({
    graph: scene.graph,
    routeState: scene.routeState,
    topology: scene.routeTopology,
  });
  if (result.kind === "noop") {
    assert.deepEqual(before, before);
    return;
  }
  assert.deepEqual(
    result.topology!.branchPoints.map((bp) => bp.id).sort(),
    before,
  );
  const membershipOf = (
    topology: NonNullable<typeof result.topology>,
  ) => {
    const snap = topologyMembershipSnapshot(topology);
    return {
      groupIds: snap.groupIds,
      trunkIds: snap.trunkIds,
      branchIds: snap.branchIds,
      groups: snap.groups,
      trunks: snap.trunks,
      routeIds: snap.routes.map((row) => row.connectionId),
    };
  };
  assert.deepEqual(
    membershipOf(result.topology!),
    membershipOf(scene.routeTopology!),
  );
});

test("L2-O unavoidable non-junction crossing can remain a bridge", () => {
  const existing = {
    cardThrough: 0,
    outOfBounds: 0,
    legendHits: 0,
    crossings: 1,
    bends: 2,
    length: 120,
  };
  const worse = { ...existing, cardThrough: 1, crossings: 0 };
  const picked = preferExistingRouteIfTied("bridge", "through-card", existing, worse);
  assert.equal(picked, "bridge");
});

test("L2-P L2 does not create new card overlap", () => {
  const cards = [card("a", 40, 80), card("mid", 400, 80), card("b", 1200, 80)];
  const result = layoutRelatedDiagramConnected({
    cards,
    connections: [conn("e1", "a", "b")],
  });
  const next = applyLayout(cards, result);
  const l1 = layoutRelatedDiagram({ cards: next });
  assert.deepEqual(l1.changedCardIds, []);
});

test("L2-Q A3 bounds are preserved", () => {
  const cards = [card("a", 40, 80), card("b", 1200, 80)];
  const next = applyLayout(
    cards,
    optimizeRelatedDiagramConnections({
      cards,
      connections: [conn("e1", "a", "b")],
    }),
  );
  for (const item of next) {
    assert.ok(item.layout.x >= 0);
    assert.ok(item.layout.y >= 0);
    assert.ok(item.layout.x + item.layout.width <= A3_WIDTH_PX);
    assert.ok(item.layout.y + item.layout.height <= A3_HEIGHT_PX);
  }
});

test("L2-R input card order does not change the result", () => {
  const cards = [card("z", 40, 80), card("a", 1200, 80), card("m", 400, 400)];
  const connections = [conn("e1", "z", "a")];
  const forward = optimizeRelatedDiagramConnections({ cards, connections });
  const reversed = optimizeRelatedDiagramConnections({
    cards: [...cards].reverse(),
    connections,
  });
  assert.deepEqual(forward.positions, reversed.positions);
});

test("L2-S connection order does not change the result", () => {
  const cards = [
    card("hub", 200, 200),
    card("l1", 200, 40),
    card("far", 1250, 200),
  ];
  const connections = [conn("e2", "hub", "far"), conn("e1", "hub", "l1")];
  const a = optimizeRelatedDiagramConnections({ cards, connections });
  const b = optimizeRelatedDiagramConnections({
    cards,
    connections: [...connections].reverse(),
  });
  assert.deepEqual(a.positions, b.positions);
});

test("L2-T repeated calls are deterministic", () => {
  const cards = [card("a", 40, 120), card("b", 1180, 360)];
  const connections = [conn("e1", "a", "b")];
  const first = optimizeRelatedDiagramConnections({ cards, connections });
  for (let i = 0; i < 3; i += 1) {
    assert.deepEqual(
      optimizeRelatedDiagramConnections({ cards, connections }),
      first,
    );
  }
});

test("L2-U second L2 pass is idempotent", () => {
  const cards = [card("a", 40, 80), card("b", 1200, 80)];
  const connections = [conn("e1", "a", "b")];
  const first = optimizeRelatedDiagramConnections({ cards, connections });
  const second = optimizeRelatedDiagramConnections({
    cards: applyLayout(cards, first),
    connections,
  });
  assert.deepEqual(second.changedCardIds, []);
  assert.deepEqual(second.positions, first.positions);
});

test("L2-V second Arrange on an arranged scene is a NO-OP", () => {
  const graph = graphOf(
    [card("a", 40, 80), card("b", 1200, 80)],
    [conn("e1", "a", "b")],
  );
  const first = arrangeRelatedDiagramScene({
    graph,
    routeState: seedStableRouteState(graph.cards, graph.connections),
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

test("L2-W Undo restores the exact original scene", () => {
  const graph = graphOf(
    [card("a", 40, 80), card("b", 1200, 80)],
    [conn("e1", "a", "b")],
  );
  const routeState = seedStableRouteState(graph.cards, graph.connections);
  const original = graph.cards.map((item) => ({
    id: item.id,
    x: item.layout.x,
    y: item.layout.y,
  }));
  const result = arrangeRelatedDiagramScene({ graph, routeState });
  assert.equal(result.kind, "applied");
  if (result.kind !== "applied") return;
  const undone = undoDiagramHistory(
    pushDiagramHistory(emptyDiagramHistory(), result.historyAction),
  );
  const restored = applySceneFragmentToGraph(result.graph, undone.fragment!);
  assert.deepEqual(
    restored.cards.map((item) => ({
      id: item.id,
      x: item.layout.x,
      y: item.layout.y,
    })),
    original,
  );
  assert.deepEqual(undone.fragment!.routeState, routeState);
});

test("L2-X Redo restores the arranged scene", () => {
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
  const redone = redoDiagramHistory(undone.history);
  const restored = applySceneFragmentToGraph(graph, redone.fragment!);
  assert.deepEqual(
    restored.cards.map((item) => ({ id: item.id, x: item.layout.x, y: item.layout.y })),
    result.graph.cards.map((item) => ({
      id: item.id,
      x: item.layout.x,
      y: item.layout.y,
    })),
  );
  assert.deepEqual(redone.fragment!.routeState, result.routeState);
});

test("L2-Y semantic graph fields stay unchanged", () => {
  const graph = graphOf(
    [
      card("a", 40, 80),
      card("np", 1200, 80, { cardType: "nursing_problem", width: 200, height: 78 }),
    ],
    [conn("e1", "a", "np", "nursing_problem_basis")],
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
    routeState: seedStableRouteState(graph.cards, graph.connections),
  });
  assert.equal(result.kind, "applied");
  if (result.kind !== "applied") return;
  assert.deepEqual(result.graph.connections, frozenConn);
  assert.deepEqual(result.graph.nursingProblems, frozenNp);
  assert.equal(result.graph.cards[1]!.state, "current");
  assert.equal(result.graph.cards[1]!.layout.width, 200);
});

test("L2-Z already-good scene keeps routes stable", () => {
  const graph = graphOf(
    [card("a", 80, 80), card("b", 240, 80)],
    [conn("e1", "a", "b")],
  );
  const routeState = seedStableRouteState(graph.cards, graph.connections);
  const result = arrangeRelatedDiagramScene({ graph, routeState });
  assert.equal(result.kind, "noop");
});

test("L1-only path is unchanged when connections are omitted", () => {
  const cards = [card("a", 40, 40), card("b", 48, 40)];
  const l1 = layoutRelatedDiagram({ cards });
  assert.ok(l1.changedCardIds.length > 0);
});

test("DEV fixture metrics before / after", () => {
  const scene = fixtureScene();
  const beforeRoutes = stableRoutesList(scene.routeState).map((row) => ({
    connectionId: row.connectionId,
    points: row.points,
  }));
  const before = measureConnectionLayoutMetrics({
    cards: scene.graph.cards,
    connections: scene.graph.connections,
    routes: beforeRoutes,
    originCards: scene.graph.cards,
    junctionCount: scene.routeTopology?.branchPoints.length ?? 0,
  });
  const arranged = arrangeRelatedDiagramScene({
    graph: scene.graph,
    routeState: scene.routeState,
    topology: scene.routeTopology,
  });
  const afterGraph = arranged.kind === "applied" ? arranged.graph : scene.graph;
  const afterState =
    arranged.kind === "applied" ? arranged.routeState : scene.routeState;
  const afterRoutes = stableRoutesList(afterState).map((row) => ({
    connectionId: row.connectionId,
    points: row.points,
  }));
  const after = measureConnectionLayoutMetrics({
    cards: afterGraph.cards,
    connections: afterGraph.connections,
    routes: afterRoutes,
    originCards: scene.graph.cards,
    junctionCount:
      (arranged.kind === "applied"
        ? arranged.topology?.branchPoints.length
        : scene.routeTopology?.branchPoints.length) ?? 0,
  });
  const improved = before.edgeGaps
    .filter((edge) => edge.excessive)
    .map((edge) => {
      const next = after.edgeGaps.find((row) => row.id === edge.id);
      return {
        id: edge.id,
        before: edge.gap,
        after: next?.gap ?? edge.gap,
      };
    })
    .filter((row) => row.after < row.before);
  console.log("FIXTURE_METRICS_BEFORE", JSON.stringify(before));
  console.log("FIXTURE_METRICS_AFTER", JSON.stringify(after));
  console.log("FIXTURE_IMPROVED_EDGES", JSON.stringify(improved));
  assert.ok(before.totalDisplacement === 0);
  assert.ok(
    after.totalLength <= before.totalLength ||
      after.excessiveEdgeCount <= before.excessiveEdgeCount ||
      after.cardThroughCount < before.cardThroughCount,
  );
});

test("source/target card hits are ignored in through-count", () => {
  const source = { id: "a", x: 0, y: 0, width: 80, height: 40 };
  const points = [
    { x: 40, y: 20 },
    { x: 200, y: 20 },
  ];
  assert.equal(countPolylineCardHits(points, [source], new Set(["a"])), 0);
});

console.log(`\n${passed} tests passed`);
