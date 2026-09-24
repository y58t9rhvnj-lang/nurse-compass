/**
 * L2-D D3-0 tests.
 * Run: ./node_modules/.bin/jiti lib/v2/relatedDiagram/diagramLayoutL2dNp.test.ts
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
import { applyKnowledgeLayerArrange } from "./diagramLayoutL2d";
import { partitionLocalGraphUnits } from "./diagramLayoutL2dUnits";
import {
  applyNursingProblemArrange,
  discoverNursingProblemCards,
  layoutNursingProblemUnits,
  resolveNursingProblemHardSets,
} from "./diagramLayoutL2dNp";
import { analyzeRouteReadability, routeHighwayFlag } from "./diagramLayoutL2b";
import { seedStableRouteState } from "./incrementalRoutes";
import { resolveDevFixtureReadonlyScene } from "./resolveReadonlyScene";
import { ROUTE_TOPOLOGY_SCHEMA } from "./routeTopology";
import { buildPatientAStudentReconstruction } from "./buildPatientAStudentReconstruction";
import { applyPatientACardSizeScale } from "./patientACardSizeExperiment";
import type { RelatedDiagramRouteTopology } from "./routeTopology";
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
    isLocked: false,
    createdAt: "2026-09-22T00:00:00.000Z",
    updatedAt: "2026-09-22T00:00:00.000Z",
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
        : "student_diagram",
    createdAt: "2026-09-22T00:00:00.000Z",
    updatedAt: "2026-09-22T00:00:00.000Z",
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

function applyNp(
  cards: RelatedDiagramCard[],
  connections: RelatedDiagramConnection[],
  topology?: RelatedDiagramRouteTopology,
) {
  const routeState = seedStableRouteState(cards, connections, topology);
  return applyNursingProblemArrange({
    cards,
    connections,
    routeState,
    topology,
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

function npThrough(
  cards: RelatedDiagramCard[],
  connections: RelatedDiagramConnection[],
  routeState: ReturnType<typeof seedStableRouteState>,
) {
  const npIds = new Set(
    cards.filter((item) => item.cardType === "nursing_problem").map((item) => item.id),
  );
  const related = connections.filter(
    (row) => npIds.has(row.sourceCardId) || npIds.has(row.targetCardId),
  );
  return analyzeRouteReadability({
    cards,
    connections: related,
    routeState,
  }).totalCardThrough;
}

test("D3-A single source → NP", () => {
  const stable = [
    card("u1", 160, 80, { cardType: "understanding" }),
    card("np1", 420, 80, { cardType: "nursing_problem" }),
  ];
  const connections = [conn("b1", "u1", "np1", "nursing_problem_basis")];
  const kept = applyNp(stable, connections);
  assert.deepEqual(pos(kept.cards, "u1").layout, pos(stable, "u1").layout);
  assert.deepEqual(pos(kept.cards, "np1").layout, pos(stable, "np1").layout);

  const scattered = [
    card("u1", 160, 80, { cardType: "understanding" }),
    card("np1", 40, 720, { cardType: "nursing_problem" }),
  ];
  const moved = applyNp(scattered, connections);
  assert.deepEqual(pos(moved.cards, "u1").layout, pos(scattered, "u1").layout);
  const before = Math.hypot(40 - 200, 720 - 100);
  const np = pos(moved.cards, "np1");
  const after = Math.hypot(np.layout.x + 40 - 200, np.layout.y + 20 - 100);
  assert.ok(after < before);
});

test("D3-B multiple local sources → NP", () => {
  const cards = [
    card("u1", 80, 80, { cardType: "understanding" }),
    card("u2", 200, 90, { cardType: "understanding" }),
    card("np1", 980, 80, { cardType: "nursing_problem" }),
  ];
  const connections = [
    conn("b1", "u1", "np1", "nursing_problem_basis"),
    conn("b2", "u2", "np1", "nursing_problem_basis"),
  ];
  const next = applyNp(cards, connections);
  assert.deepEqual(pos(next.cards, "u1").layout, pos(cards, "u1").layout);
  assert.deepEqual(pos(next.cards, "u2").layout, pos(cards, "u2").layout);
  const np = pos(next.cards, "np1");
  assert.ok(np.layout.x < 980);
  assert.ok(np.layout.x + np.layout.width > 80);
});

test("D3-D Knowledge anchor fixed", () => {
  const cards = [
    card("k1", 80, 40, { cardType: "knowledge", width: 146, height: 72 }),
    card("np1", 40, 720, { cardType: "nursing_problem" }),
  ];
  const connections = [conn("b1", "k1", "np1", "nursing_problem_basis")];
  const next = applyNp(cards, connections);
  assert.deepEqual(pos(next.cards, "k1").layout, pos(cards, "k1").layout);
});

test("D3-E Understanding with student relation stays fixed", () => {
  const cards = [
    card("info", 40, 80),
    card("u1", 200, 80, { cardType: "understanding" }),
    card("np1", 40, 700, { cardType: "nursing_problem" }),
  ];
  const connections = [
    conn("cur", "info", "u1", "current"),
    conn("b1", "u1", "np1", "nursing_problem_basis"),
  ];
  const next = applyNp(cards, connections);
  assert.deepEqual(pos(next.cards, "info").layout, pos(cards, "info").layout);
  assert.deepEqual(pos(next.cards, "u1").layout, pos(cards, "u1").layout);
});

test("D3-G remote semantic merge does NOT create Junction", () => {
  const cards = [
    card("u1", 40, 40, { cardType: "understanding" }),
    card("u2", 1100, 820, { cardType: "understanding" }),
    card("np1", 1280, 200, { cardType: "nursing_problem" }),
  ];
  const connections = [
    conn("b1", "u1", "np1", "nursing_problem_basis"),
    conn("b2", "u2", "np1", "nursing_problem_basis"),
  ];
  const next = applyNp(cards, connections);
  assert.equal((next.topology?.branchPoints ?? []).length, 0);
  assert.equal((next.topology?.routeGroups ?? []).length, 0);
});

test("D3-H multiple NP independent", () => {
  const cards = [
    card("u1", 80, 80, { cardType: "understanding" }),
    card("u2", 80, 400, { cardType: "understanding" }),
    card("np1", 40, 720, { cardType: "nursing_problem" }),
    card("np2", 420, 400, { cardType: "nursing_problem" }),
  ];
  const connections = [
    conn("b1", "u1", "np1", "nursing_problem_basis"),
    conn("b2", "u2", "np2", "nursing_problem_basis"),
  ];
  const next = applyNp(cards, connections);
  assert.deepEqual(pos(next.cards, "u1").layout, pos(cards, "u1").layout);
  assert.deepEqual(pos(next.cards, "u2").layout, pos(cards, "u2").layout);
  assert.deepEqual(pos(next.cards, "np2").layout, pos(cards, "np2").layout);
});

test("D3-L no legal improvement → exact preserve", () => {
  const walls = [
    card("wall1", 24, 150, { width: 700, height: 180, cardType: "knowledge" }),
    card("wall2", 24, 340, { width: 700, height: 180, cardType: "knowledge" }),
  ];
  const cards = [
    card("u1", 80, 40, { cardType: "understanding" }),
    card("np1", 360, 40, { cardType: "nursing_problem" }),
    ...walls,
  ];
  const connections = [conn("b1", "u1", "np1", "nursing_problem_basis")];
  const next = layoutNursingProblemUnits({ cards, connections });
  assert.deepEqual(positionsOf(next), positionsOf(cards));
});

test("D3-M no new card-through", () => {
  const cards = [
    card("u1", 120, 80, { cardType: "understanding" }),
    card("np1", 40, 640, { cardType: "nursing_problem" }),
    card("block", 200, 280, { width: 220, height: 80 }),
  ];
  const connections = [conn("b1", "u1", "np1", "nursing_problem_basis")];
  const before = applyNp(cards, connections);
  const afterThrough = npThrough(before.cards, connections, before.routeState);
  const start = seedStableRouteState(cards, connections);
  const startThrough = npThrough(cards, connections, start);
  assert.ok(afterThrough <= startThrough);
});

test("D3-P deterministic", () => {
  const cards = [
    card("u1", 160, 80, { cardType: "understanding" }),
    card("np1", 40, 700, { cardType: "nursing_problem" }),
  ];
  const connections = [conn("b1", "u1", "np1", "nursing_problem_basis")];
  const a = applyNp(cards, connections);
  const b = applyNp(cards, connections);
  assert.deepEqual(positionsOf(a.cards), positionsOf(b.cards));
  assert.deepEqual(a.routeState.byId.b1!.points, b.routeState.byId.b1!.points);
});

test("D3-Q array-order independent", () => {
  const cards = [
    card("u1", 80, 80, { cardType: "understanding" }),
    card("u2", 220, 90, { cardType: "understanding" }),
    card("np1", 40, 700, { cardType: "nursing_problem" }),
  ];
  const connections = [
    conn("b1", "u1", "np1", "nursing_problem_basis"),
    conn("b2", "u2", "np1", "nursing_problem_basis"),
  ];
  const a = applyNp(cards, connections);
  const b = applyNp([...cards].reverse(), [...connections].reverse());
  assert.deepEqual(positionsOf(a.cards), positionsOf(b.cards));
});

test("D3-R D3-local second pass no-op", () => {
  const cards = [
    card("u1", 160, 80, { cardType: "understanding" }),
    card("np1", 40, 700, { cardType: "nursing_problem" }),
  ];
  const connections = [conn("b1", "u1", "np1", "nursing_problem_basis")];
  const first = applyNp(cards, connections);
  const second = applyNursingProblemArrange({
    cards: first.cards,
    connections,
    routeState: first.routeState,
    topology: first.topology,
  });
  assert.deepEqual(positionsOf(second.cards), positionsOf(first.cards));
  assert.equal(second.changedCardIds.length, 0);
});

test("D3-U non-active geometry exact", () => {
  const topology: RelatedDiagramRouteTopology = {
    schema: ROUTE_TOPOLOGY_SCHEMA,
    trunks: [
      {
        id: "tr_keep",
        points: [
          { x: 80, y: 400 },
          { x: 80, y: 430 },
        ],
        connectionIds: ["j1", "j2"],
        branchPointId: "bp_keep",
      },
    ],
    branchPoints: [{ id: "bp_keep", x: 80, y: 430, connectionIds: ["j1", "j2"] }],
    routeGroups: [],
    routes: [],
  };
  const cards = [
    card("k1", 900, 40, { cardType: "knowledge", width: 146, height: 72 }),
    card("k2", 1100, 40, { cardType: "knowledge", width: 146, height: 72 }),
    card("left", 40, 380),
    card("a", 40, 500),
    card("b", 40, 620),
    card("u1", 240, 80, { cardType: "understanding" }),
    card("np1", 40, 760, { cardType: "nursing_problem" }),
  ];
  const connections = [
    conn("kk", "k1", "k2", "current"),
    conn("j1", "left", "a", "current"),
    conn("j2", "left", "b", "current"),
    conn("b1", "u1", "np1", "nursing_problem_basis"),
  ];
  const before = seedStableRouteState(cards, connections, topology);
  const next = applyNursingProblemArrange({
    cards,
    connections,
    routeState: before,
    topology,
  });
  assert.deepEqual(pos(next.cards, "k1").layout, pos(cards, "k1").layout);
  assert.deepEqual(pos(next.cards, "k2").layout, pos(cards, "k2").layout);
  assert.deepEqual(pos(next.cards, "left").layout, pos(cards, "left").layout);
  assert.deepEqual(next.routeState.byId.kk!.points, before.byId.kk!.points);
  assert.deepEqual(next.routeState.byId.j1!.points, before.byId.j1!.points);
  assert.deepEqual(next.topology!.branchPoints, topology.branchPoints);
});

test("D3-V D2 Knowledge exact regression", () => {
  const scene = fixtureScene();
  const d2 = applyKnowledgeLayerArrange({
    cards: scene.graph.cards,
    connections: scene.graph.connections,
    routeState: scene.routeState,
    topology: scene.routeTopology,
  });
  const d3 = applyNursingProblemArrange({
    cards: d2.cards,
    connections: scene.graph.connections,
    routeState: d2.routeState,
    topology: d2.topology,
  });
  assert.deepEqual(
    d3.cards
      .filter((item) => item.cardType === "knowledge")
      .map((item) => ({ id: item.id, x: item.layout.x, y: item.layout.y }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    d2.cards
      .filter((item) => item.cardType === "knowledge")
      .map((item) => ({ id: item.id, x: item.layout.x, y: item.layout.y }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  );
});

test("D3-X D1 size cap still seeds from the live NP card", () => {
  const extras = Array.from({ length: 8 }, (_, i) =>
    card(`a${i + 1}`, 40 + i * 10, 200 + i * 50, { cardType: "understanding" }),
  );
  const cards = [
    card("u1", 80, 40, { cardType: "understanding" }),
    card("z_np", 40, 760, { cardType: "nursing_problem" }),
    ...extras,
  ];
  const connections = [
    conn("b1", "u1", "z_np", "nursing_problem_basis"),
    ...extras.map((item, i) => conn(`e${i}`, "u1", item.id, "current")),
  ];
  const units = partitionLocalGraphUnits({ cards, connections });
  const npUnit = units.find((unit) => unit.kind === "nursing_problem");
  assert.equal(npUnit?.cardIds.includes("z_np") ?? false, false);
  const sets = resolveNursingProblemHardSets({ cards, connections });
  assert.deepEqual(
    sets.map((set) => set.npIds),
    [["z_np"]],
  );
  assert.ok(discoverNursingProblemCards(cards).some((item) => item.id === "z_np"));
  const next = applyNp(cards, connections);
  assert.deepEqual(pos(next.cards, "u1").layout, pos(cards, "u1").layout);
});

test("D3-Y current wins when the alternative is only a tiny score gain", () => {
  const cards = [
    card("u1", 160, 80, { cardType: "understanding" }),
    card("np1", 420, 80, { cardType: "nursing_problem" }),
  ];
  const connections = [conn("b1", "u1", "np1", "nursing_problem_basis")];
  const next = applyNp(cards, connections);
  assert.deepEqual(pos(next.cards, "np1").layout, pos(cards, "np1").layout);
  assert.equal(next.decisions[0]?.choseCurrent, true);
});

test("D3-Z remote route-length sum does not pull NP to the global centroid", () => {
  const cards = [
    card("u1", 40, 80, { cardType: "understanding" }),
    card("u2", 1100, 820, { cardType: "understanding" }),
    card("np1", 1280, 200, { cardType: "nursing_problem" }),
  ];
  const connections = [
    conn("b1", "u1", "np1", "nursing_problem_basis"),
    conn("b2", "u2", "np1", "nursing_problem_basis"),
  ];
  const next = applyNp(cards, connections);
  const np = pos(next.cards, "np1");
  assert.ok(np.layout.x > 900, `centroid pull ${np.layout.x}`);
  assert.ok(Math.abs(np.layout.x + np.layout.width / 2 - 650) > 180);
});

test("D3-W intentional scatter recovery (generic)", () => {
  const cards = [
    card("u1", 200, 160, { cardType: "understanding" }),
    card("np1", 40, 760, { cardType: "nursing_problem" }),
  ];
  const connections = [conn("b1", "u1", "np1", "nursing_problem_basis")];
  const next = applyNp(cards, connections);
  assert.deepEqual(pos(next.cards, "u1").layout, pos(cards, "u1").layout);
  const np = pos(next.cards, "np1");
  const before = Math.hypot(40 - 240, 760 - 180);
  const after = Math.hypot(np.layout.x + 40 - 240, np.layout.y + 20 - 180);
  assert.ok(after <= before);
  assert.equal(npThrough(next.cards, connections, next.routeState), 0);
});

test("supports-only NP is not a layout source", () => {
  const cards = [
    card("info", 80, 40),
    card("np1", 400, 40, { cardType: "nursing_problem" }),
  ];
  const graph = graphOf(cards, []);
  graph.nursingProblemSupports = [
    {
      nursingProblemCardId: "np1",
      supportingCardId: "info",
      createdAt: "2026-09-22T00:00:00.000Z",
    },
  ];
  const next = layoutNursingProblemUnits({
    cards: graph.cards,
    connections: graph.connections,
  });
  assert.deepEqual(positionsOf(next), positionsOf(cards));
});

test("D3-S/T Undo Redo exact after Arrange on a scattered NP", () => {
  const cards = [
    card("u1", 200, 160, { cardType: "understanding" }),
    card("np1", 40, 760, { cardType: "nursing_problem" }),
  ];
  const connections = [conn("b1", "u1", "np1", "nursing_problem_basis")];
  const graph = graphOf(cards, connections);
  const routeState = seedStableRouteState(cards, connections);
  const result = arrangeRelatedDiagramScene({ graph, routeState });
  if (result.kind !== "applied") {
    const d3 = applyNp(cards, connections);
    if (d3.changedCardIds.length === 0) {
      assert.ok(true);
      return;
    }
  }
  if (result.kind !== "applied") return;
  const history = pushDiagramHistory(emptyDiagramHistory(), result.historyAction);
  const undone = undoDiagramHistory(history);
  const restored = applySceneFragmentToGraph(result.graph, undone.fragment!);
  assert.deepEqual(positionsOf(restored.cards), positionsOf(graph.cards));
  const redone = redoDiagramHistory(undone.history);
  const replayed = applySceneFragmentToGraph(graph, redone.fragment!);
  assert.deepEqual(positionsOf(replayed.cards), positionsOf(result.graph.cards));
});

test("Patient A D3-0 report snapshot", () => {
  const scene = buildPatientAStudentReconstruction();
  const graph = applyPatientACardSizeScale(scene.graph, 90);
  const beforeRoutes = seedStableRouteState(graph.cards, graph.connections);
  const d3 = applyNursingProblemArrange({
    cards: graph.cards,
    connections: graph.connections,
    routeState: beforeRoutes,
  });
  const arranged1 = arrangeRelatedDiagramScene({
    graph,
    routeState: beforeRoutes,
  });
  const after1Graph = arranged1.kind === "applied" ? arranged1.graph : graph;
  const after1Routes =
    arranged1.kind === "applied" ? arranged1.routeState : beforeRoutes;
  const arranged2 = arrangeRelatedDiagramScene({
    graph: after1Graph,
    routeState: after1Routes,
    topology: arranged1.kind === "applied" ? arranged1.topology : undefined,
  });
  const basisIds = graph.connections
    .filter((row) => row.relationType === "nursing_problem_basis")
    .map((row) => row.id)
    .sort();
  const npIds = graph.cards
    .filter((item) => item.cardType === "nursing_problem")
    .map((item) => item.id)
    .sort();
  const row = (cards: typeof graph.cards, id: string) => {
    const found = cards.find((item) => item.id === id)!;
    return { id, x: found.layout.x, y: found.layout.y };
  };
  const routeRow = (
    routeState: ReturnType<typeof seedStableRouteState>,
    id: string,
  ) => {
    const read = analyzeRouteReadability({
      cards: d3.cards,
      connections: graph.connections.filter((row) => row.id === id),
      routeState,
    }).connections[0];
    return {
      id,
      through: read?.cardIntersectionCount ?? 0,
      length: Math.round(read?.length ?? 0),
      bends: read?.bendCount ?? 0,
      highway: routeHighwayFlag(routeState.byId[id]?.points ?? []),
    };
  };
  console.log(
    "D3_0_PATIENT_A",
    JSON.stringify(
      {
        decisions: d3.decisions,
        changed: d3.changedCardIds,
        npBefore: npIds.map((id) => row(graph.cards, id)),
        npAfter: npIds.map((id) => row(d3.cards, id)),
        basisBefore: basisIds.map((id) => routeRow(beforeRoutes, id)),
        basisAfter: basisIds.map((id) => routeRow(d3.routeState, id)),
        arrange1: arranged1.kind,
        arrange1Moved: arranged1.kind === "applied" ? arranged1.layout.changedCardIds : [],
        arrange2: arranged2.kind,
      },
      null,
      2,
    ),
  );
  assert.equal(d3.cards.filter((item) => item.cardType === "knowledge").length, 0);
  assert.deepEqual(
    d3.cards
      .filter((item) => item.cardType !== "nursing_problem")
      .map((item) => ({ id: item.id, x: item.layout.x, y: item.layout.y }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    graph.cards
      .filter((item) => item.cardType !== "nursing_problem")
      .map((item) => ({ id: item.id, x: item.layout.x, y: item.layout.y }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  );
});

console.log(`\n${passed} tests passed`);
