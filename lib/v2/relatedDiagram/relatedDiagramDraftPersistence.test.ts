/**
 * Persistence P3 — Editor draft load/save.
 * Run: ./node_modules/.bin/jiti lib/v2/relatedDiagram/relatedDiagramDraftPersistence.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  isStudentAutoQualityRerouteTarget,
} from "./autoCardMoveQualityReroute";
import {
  commitManualRouteEdit,
  dragOrthogonalSegment,
  isStudentManualRoute,
} from "./manualRouteEdit";
import { applyLightweightCardDrop } from "./lightweightCardDrop";
import {
  cloneStableRouteState,
  pointsDeepEqual,
  type StableRouteState,
} from "./incrementalRoutes";
import { classifyRouteInteractions } from "./orthogonalRouting";
import { emptyRouteTopology } from "./routeTopology";
import {
  DEV_SLICE1_PERSIST_IDENTITY,
  loadRelatedDiagramDraft,
  saveRelatedDiagramDraft,
} from "./relatedDiagramDraftPersistence";
import { createMemoryRelatedDiagramDraftStore } from "./relatedDiagramMemoryDraftStore";
import { inspectRouteSceneSchema } from "./routeScene";
import type {
  RelatedDiagramCard,
  RelatedDiagramConnection,
  RelatedDiagramSemanticGraph,
} from "./types";
import { RELATED_DIAGRAM_SEMANTIC_SCHEMA_VERSION } from "./types";

let passed = 0;
function test(name: string, fn: () => void | Promise<void>) {
  const run = async () => {
    try {
      await fn();
      passed += 1;
      console.log(`ok - ${name}`);
    } catch (e) {
      console.error(`FAIL - ${name}`);
      throw e;
    }
  };
  return run();
}

function src(rel: string): string {
  return readFileSync(new URL(rel, import.meta.url), "utf8");
}

const TS = "2026-09-24T00:00:00.000Z";
const IDENTITY = DEV_SLICE1_PERSIST_IDENTITY;
const OPEN = [
  { x: 80, y: 80 },
  { x: 200, y: 80 },
  { x: 200, y: 160 },
  { x: 400, y: 160 },
  { x: 400, y: 80 },
];
const CROSSED = [
  { x: 80, y: 80 },
  { x: 200, y: 80 },
  { x: 200, y: 240 },
  { x: 400, y: 240 },
  { x: 400, y: 80 },
];
const OTHER = [
  { x: 40, y: 200 },
  { x: 480, y: 200 },
];
const JOG = [
  { x: 80, y: 80 },
  { x: 200, y: 80 },
  { x: 200, y: 160 },
  { x: 320, y: 160 },
];

function card(id: string, x: number, y: number): RelatedDiagramCard {
  return {
    id,
    cardType: "understanding",
    text: id,
    state: "current",
    origin: "direct_insight",
    layout: { x, y, width: 120, height: 64, zIndex: 0 },
    isLocked: false,
    createdAt: TS,
    updatedAt: TS,
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
    createdAt: TS,
    updatedAt: TS,
  };
}

function graphOf(
  cards: RelatedDiagramCard[],
  connections: RelatedDiagramConnection[],
): RelatedDiagramSemanticGraph {
  return {
    semanticSchemaVersion: RELATED_DIAGRAM_SEMANTIC_SCHEMA_VERSION,
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
  points: { x: number; y: number }[],
) {
  return {
    connectionId: id,
    sourceCardId,
    targetCardId,
    sourceEdge: "right" as const,
    targetEdge: "left" as const,
    sourcePin: { ...points[0]! },
    targetPin: { ...points[points.length - 1]! },
    points: points.map((point) => ({ ...point })),
  };
}

function routeStateOf(rows: ReturnType<typeof stored>[]): StableRouteState {
  const byId: StableRouteState["byId"] = {};
  const lastValidPoints: StableRouteState["lastValidPoints"] = {};
  for (const row of rows) {
    byId[row.connectionId] = {
      ...row,
      sourcePin: { ...row.sourcePin },
      targetPin: { ...row.targetPin },
      points: row.points.map((point) => ({ ...point })),
    };
    lastValidPoints[row.connectionId] = row.points.map((point) => ({ ...point }));
  }
  return { byId, lastValidPoints, invalidReasons: {}, bridges: [] };
}

const graphAB = graphOf(
  [card("a", 40, 48), card("b", 400, 48)],
  [connection("cn_ab", "a", "b")],
);
const graphABCD = graphOf(
  [card("a", 40, 48), card("b", 400, 48), card("c", 40, 168), card("d", 400, 168)],
  [connection("cn_ab", "a", "b"), connection("cn_cd", "c", "d")],
);

async function roundTrip(snapshot: {
  graph: RelatedDiagramSemanticGraph;
  routeState: StableRouteState;
  topology?: ReturnType<typeof emptyRouteTopology>;
}) {
  const store = createMemoryRelatedDiagramDraftStore();
  const saved = await saveRelatedDiagramDraft({
    store,
    identity: IDENTITY,
    expectedVersion: null,
    snapshot,
  });
  assert.equal(saved.ok, true);
  if (!saved.ok) return saved;
  return loadRelatedDiagramDraft({
    store,
    identity: IDENTITY,
    seed: snapshot,
  });
}

await test("A AUTO save → reload exact, still AUTO", async () => {
  const snapshot = {
    graph: graphAB,
    routeState: routeStateOf([stored("cn_ab", "a", "b", JOG)]),
    topology: emptyRouteTopology(),
  };
  const loaded = await roundTrip(snapshot);
  assert.equal(loaded.ok, true);
  if (!loaded.ok) return;
  assert.equal(loaded.kind, "restored");
  assert.ok(pointsDeepEqual(loaded.routeState.byId.cn_ab!.points, JOG));
  assert.equal(isStudentManualRoute(loaded.topology, graphAB.connections[0]!), false);
  assert.equal(
    isStudentAutoQualityRerouteTarget(loaded.topology, graphAB.connections[0]!),
    true,
  );
});

await test("B MANUAL Parallel Move save → reload exact, still MANUAL", async () => {
  const before = routeStateOf([stored("cn_ab", "a", "b", OPEN)]);
  const moved = dragOrthogonalSegment({
    points: OPEN,
    segmentIndex: 2,
    deltaX: 0,
    deltaY: 80,
  });
  const committed = commitManualRouteEdit({
    connection: graphAB.connections[0]!,
    routeState: before,
    topology: emptyRouteTopology(),
    points: moved,
  });
  const loaded = await roundTrip({
    graph: graphAB,
    routeState: committed.routeState,
    topology: committed.topology,
  });
  assert.equal(loaded.ok, true);
  if (!loaded.ok || loaded.kind !== "restored") return;
  assert.ok(pointsDeepEqual(loaded.routeState.byId.cn_ab!.points, moved));
  assert.equal(isStudentManualRoute(loaded.topology, graphAB.connections[0]!), true);
  assert.equal(
    isStudentAutoQualityRerouteTarget(loaded.topology, graphAB.connections[0]!),
    false,
  );
});

await test("C card-moved AUTO save → reload quality geometry exact", async () => {
  const start = routeStateOf([stored("cn_ab", "a", "b", JOG)]);
  const movedCards = graphAB.cards.map((row) =>
    row.id === "a" ? { ...row, layout: { ...row.layout, x: 80, y: 160 } } : row,
  );
  const dropped = applyLightweightCardDrop({
    previous: start,
    cards: movedCards,
    connections: graphAB.connections,
    topology: emptyRouteTopology(),
    movedCardId: "a",
  });
  const graph = graphOf(movedCards, graphAB.connections);
  const loaded = await roundTrip({
    graph,
    routeState: dropped.state,
    topology: dropped.topology ?? emptyRouteTopology(),
  });
  assert.equal(loaded.ok, true);
  if (!loaded.ok || loaded.kind !== "restored") return;
  assert.ok(
    pointsDeepEqual(loaded.routeState.byId.cn_ab!.points, dropped.state.byId.cn_ab!.points),
  );
  assert.equal(graph.cards[0]!.layout.x, 80);
  assert.equal(loaded.graph.cards[0]!.layout.x, 80);
  assert.equal(
    isStudentAutoQualityRerouteTarget(loaded.topology, graph.connections[0]!),
    true,
  );
});

await test("D multiple connections save → reload all exact", async () => {
  const snapshot = {
    graph: graphABCD,
    routeState: routeStateOf([
      stored("cn_ab", "a", "b", JOG),
      stored("cn_cd", "c", "d", OTHER),
    ]),
    topology: emptyRouteTopology(),
  };
  const loaded = await roundTrip(snapshot);
  assert.equal(loaded.ok, true);
  if (!loaded.ok || loaded.kind !== "restored") return;
  assert.ok(pointsDeepEqual(loaded.routeState.byId.cn_ab!.points, JOG));
  assert.ok(pointsDeepEqual(loaded.routeState.byId.cn_cd!.points, OTHER));
});

await test("E crossing: payload has no bridges; reload classifies", async () => {
  const store = createMemoryRelatedDiagramDraftStore();
  const snapshot = {
    graph: graphABCD,
    routeState: routeStateOf([
      stored("cn_ab", "a", "b", CROSSED),
      stored("cn_cd", "c", "d", OTHER),
    ]),
    topology: emptyRouteTopology(),
  };
  const saved = await saveRelatedDiagramDraft({
    store,
    identity: IDENTITY,
    expectedVersion: null,
    snapshot,
  });
  assert.equal(saved.ok, true);
  const raw = (await store.get(IDENTITY.userId, IDENTITY.caseId)).row!.route_scene;
  const text = JSON.stringify(raw);
  assert.equal(text.includes("jumperConnectionId"), false);
  const loaded = await loadRelatedDiagramDraft({ store, identity: IDENTITY, seed: snapshot });
  assert.equal(loaded.ok, true);
  if (!loaded.ok || loaded.kind !== "restored") return;
  assert.ok(pointsDeepEqual(loaded.routeState.byId.cn_ab!.points, CROSSED));
  const expected = classifyRouteInteractions(
    Object.values(loaded.routeState.byId).map((row) => ({
      connectionId: row.connectionId,
      sourceCardId: row.sourceCardId,
      targetCardId: row.targetCardId,
      sourceEdge: row.sourceEdge,
      targetEdge: row.targetEdge,
      points: row.points,
    })),
    graphABCD.cards,
    loaded.topology,
  ).bridges;
  assert.ok(expected.length >= 1);
  assert.equal(loaded.routeState.bridges.length, expected.length);
});

await test("F card layout save → reload exact", async () => {
  const moved = graphOf(
    [card("a", 220, 300), card("b", 500, 80)],
    graphAB.connections,
  );
  const loaded = await roundTrip({
    graph: moved,
    routeState: routeStateOf([stored("cn_ab", "a", "b", JOG)]),
    topology: emptyRouteTopology(),
  });
  assert.equal(loaded.ok, true);
  if (!loaded.ok) return;
  assert.equal(loaded.graph.cards[0]!.layout.x, 220);
  assert.equal(loaded.graph.cards[0]!.layout.y, 300);
  assert.equal(loaded.graph.cards[1]!.layout.x, 500);
});

await test("G history is not in payload; reload history empty", async () => {
  const store = createMemoryRelatedDiagramDraftStore();
  const snapshot = {
    graph: graphAB,
    routeState: routeStateOf([stored("cn_ab", "a", "b", JOG)]),
    topology: emptyRouteTopology(),
  };
  await saveRelatedDiagramDraft({
    store,
    identity: IDENTITY,
    expectedVersion: null,
    snapshot,
  });
  const raw = JSON.stringify(
    (await store.get(IDENTITY.userId, IDENTITY.caseId)).row!.route_scene,
  );
  assert.equal(raw.includes("past"), false);
  assert.equal(raw.includes("future"), false);
  const loaded = await loadRelatedDiagramDraft({ store, identity: IDENTITY, seed: snapshot });
  assert.equal(loaded.ok, true);
  if (!loaded.ok || !("history" in loaded)) return;
  assert.equal(loaded.history.past.length, 0);
  assert.equal(loaded.history.future.length, 0);
});

await test("H route_scene null → initial routing, save, next reload exact", async () => {
  const store = createMemoryRelatedDiagramDraftStore();
  const seed = {
    graph: graphAB,
    routeState: routeStateOf([stored("cn_ab", "a", "b", JOG)]),
    topology: emptyRouteTopology(),
  };
  await store.insert({
    user_id: IDENTITY.userId,
    organization_id: IDENTITY.organizationId,
    academic_year: IDENTITY.academicYear,
    case_id: IDENTITY.caseId,
    semantic_graph: graphAB,
    route_scene: null,
  });
  const first = await loadRelatedDiagramDraft({ store, identity: IDENTITY, seed });
  assert.equal(first.ok, true);
  if (!first.ok || first.kind !== "geometry_missing") return;
  assert.ok(first.routeState.byId.cn_ab);
  const saved = await saveRelatedDiagramDraft({
    store,
    identity: IDENTITY,
    expectedVersion: first.version,
    snapshot: {
      graph: first.graph,
      routeState: first.routeState,
      topology: first.topology,
    },
  });
  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  const second = await loadRelatedDiagramDraft({ store, identity: IDENTITY, seed });
  assert.equal(second.ok, true);
  if (!second.ok || second.kind !== "restored") return;
  assert.ok(
    pointsDeepEqual(second.routeState.byId.cn_ab!.points, first.routeState.byId.cn_ab!.points),
  );
});

await test("I optimistic conflict keeps local state / no overwrite", async () => {
  const store = createMemoryRelatedDiagramDraftStore();
  const snapshot = {
    graph: graphAB,
    routeState: routeStateOf([stored("cn_ab", "a", "b", JOG)]),
    topology: emptyRouteTopology(),
  };
  const first = await saveRelatedDiagramDraft({
    store,
    identity: IDENTITY,
    expectedVersion: null,
    snapshot,
  });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  await store.update({
    userId: IDENTITY.userId,
    caseId: IDENTITY.caseId,
    expectedVersion: first.version,
    semanticGraph: graphAB,
    routeScene: (await store.get(IDENTITY.userId, IDENTITY.caseId)).row!.route_scene,
  });
  const local = cloneStableRouteState(snapshot.routeState);
  const conflicted = await saveRelatedDiagramDraft({
    store,
    identity: IDENTITY,
    expectedVersion: first.version,
    snapshot: {
      ...snapshot,
      routeState: routeStateOf([stored("cn_ab", "a", "b", CROSSED)]),
    },
  });
  assert.equal(conflicted.ok, false);
  if (conflicted.ok) return;
  assert.equal(conflicted.kind, "conflict");
  assert.ok(pointsDeepEqual(local.byId.cn_ab!.points, JOG));
  const storedRow = (await store.get(IDENTITY.userId, IDENTITY.caseId)).row!;
  const parsed = inspectRouteSceneSchema(storedRow.route_scene);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.ok(pointsDeepEqual(parsed.scene.routes[0]!.points, JOG));
});

await test("J save error keeps local state", async () => {
  const local = routeStateOf([stored("cn_ab", "a", "b", CROSSED)]);
  const store = {
    async get() {
      return { row: null, error: null };
    },
    async insert() {
      return { row: null, error: { message: "unavailable" } };
    },
    async update() {
      return { row: null, error: { message: "unavailable" } };
    },
  };
  const result = await saveRelatedDiagramDraft({
    store,
    identity: IDENTITY,
    expectedVersion: null,
    snapshot: {
      graph: graphAB,
      routeState: local,
      topology: emptyRouteTopology(),
    },
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.kind, "error");
  assert.ok(pointsDeepEqual(local.byId.cn_ab!.points, CROSSED));
});

await test("K unsupported schema does not overwrite route_scene", async () => {
  const store = createMemoryRelatedDiagramDraftStore();
  const unknown = {
    schema: "rd.routeScene.v2",
    schemaVersion: 2,
    routes: [],
  };
  await store.insert({
    user_id: IDENTITY.userId,
    organization_id: IDENTITY.organizationId,
    academic_year: IDENTITY.academicYear,
    case_id: IDENTITY.caseId,
    semantic_graph: graphAB,
    route_scene: unknown,
  });
  const loaded = await loadRelatedDiagramDraft({
    store,
    identity: IDENTITY,
    seed: {
      graph: graphAB,
      routeState: routeStateOf([stored("cn_ab", "a", "b", JOG)]),
      topology: emptyRouteTopology(),
    },
  });
  assert.equal(loaded.ok, false);
  if (loaded.ok) return;
  assert.equal(loaded.kind, "unsupported_schema");
  const blocked = await saveRelatedDiagramDraft({
    store,
    identity: IDENTITY,
    expectedVersion: loaded.version,
    snapshot: {
      graph: graphAB,
      routeState: routeStateOf([stored("cn_ab", "a", "b", CROSSED)]),
      topology: emptyRouteTopology(),
    },
    allowRouteSceneWrite: false,
  });
  assert.equal(blocked.ok, false);
  if (blocked.ok) return;
  assert.equal(blocked.kind, "unsupported_schema");
  assert.deepEqual(
    (await store.get(IDENTITY.userId, IDENTITY.caseId)).row!.route_scene,
    unknown,
  );
});

await test("P3 does not change P1/P2 or wire hooks to DB", () => {
  const persist = src("./relatedDiagramDraftPersistence.ts");
  const ws = src("../../../components/v2/relatedDiagram/RelatedDiagramDevFixtureWorkspace.tsx");
  const hook = src("../../../components/v2/relatedDiagram/useCardInteraction.ts");
  const routeHook = src("../../../components/v2/relatedDiagram/useConnectionRouteInteraction.ts");
  assert.ok(persist.includes("serializeRouteScene"));
  assert.ok(persist.includes("restoreRouteScene"));
  assert.equal(persist.includes("decideStudentConnectionRoute"), false);
  assert.equal(persist.includes("applyStudentAutoQualityReroute"), false);
  assert.equal(hook.includes("saveRelatedDiagramDraft"), false);
  assert.equal(routeHook.includes("saveRelatedDiagramDraft"), false);
  assert.ok(ws.includes("saveRelatedDiagramDraft"));
  assert.ok(ws.includes("loadRelatedDiagramDraft"));
  assert.equal(ws.includes("from(\"related_diagram_records\")"), false);
  assert.equal(src("./semanticGraph.ts").includes("diagram_snapshot"), false);
});

console.log(`\n${passed} passed`);
