/**
 * Student Editor Real-DB persist adapter (mock ops only — no live DB write).
 * Run: ./node_modules/.bin/jiti lib/v2/relatedDiagram/relatedDiagramRepositoryDraftStore.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isStudentAutoQualityRerouteTarget } from "./autoCardMoveQualityReroute";
import { commitManualRouteEdit } from "./manualRouteEdit";
import { emptyRouteTopology, isStudentManualRoute } from "./routeTopology";
import {
  cloneStableRouteState,
  pointsDeepEqual,
  type StableRouteState,
} from "./incrementalRoutes";
import { classifyRouteInteractions } from "./orthogonalRouting";
import {
  loadRelatedDiagramDraft,
  saveRelatedDiagramDraft,
} from "./relatedDiagramDraftPersistence";
import {
  createRelatedDiagramRepositoryDraftStore,
  SERVER_OWNED_PERSIST_IDENTITY,
} from "./relatedDiagramRepositoryDraftStore";
import { createMemoryRelatedDiagramDraftStore } from "./relatedDiagramMemoryDraftStore";
import { inspectRouteSceneSchema } from "./routeScene";
import type {
  RelatedDiagramCard,
  RelatedDiagramConnection,
  RelatedDiagramSemanticGraph,
} from "./types";
import { RELATED_DIAGRAM_SEMANTIC_SCHEMA_VERSION } from "./types";
import type { RelatedDiagramRow } from "./relatedDiagramRecord";

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
const JOG = [
  { x: 80, y: 80 },
  { x: 200, y: 80 },
  { x: 200, y: 160 },
  { x: 320, y: 160 },
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

function fakeRepo(seed?: RelatedDiagramRow) {
  const memory = createMemoryRelatedDiagramDraftStore();
  const writes = { insert: 0, update: 0, get: 0 };
  const received: { insertUser?: string; updateUser?: string } = {};
  if (seed) {
    memory.rows.set("server:SP-001", structuredClone(seed));
  }
  const store = createRelatedDiagramRepositoryDraftStore({
    async get() {
      writes.get += 1;
      return memory.get("server-user", "SP-001");
    },
    async insert(input) {
      writes.insert += 1;
      const result = await memory.insert({
        user_id: "server-user",
        organization_id: "server-org",
        academic_year: 2026,
        case_id: "SP-001",
        semantic_graph: input.semanticGraph,
        route_scene: input.routeScene,
      });
      return result;
    },
    async update(input) {
      writes.update += 1;
      return memory.update({
        userId: "server-user",
        caseId: "SP-001",
        expectedVersion: input.expectedVersion,
        semanticGraph: input.semanticGraph,
        routeScene: input.routeScene,
      });
    },
  });
  const wrapped = {
    ...store,
    async insert(values: Parameters<typeof store.insert>[0]) {
      received.insertUser = values.user_id;
      return store.insert(values);
    },
    async update(params: Parameters<typeof store.update>[0]) {
      received.updateUser = params.userId;
      return store.update(params);
    },
  };
  return { store: wrapped, writes, received, memory };
}

await test("A no record → seed, insert 0", async () => {
  const { store, writes } = fakeRepo();
  const loaded = await loadRelatedDiagramDraft({
    store,
    identity: SERVER_OWNED_PERSIST_IDENTITY,
    seed: {
      graph: graphAB,
      routeState: routeStateOf([stored("cn_ab", "a", "b", JOG)]),
      topology: emptyRouteTopology(),
    },
  });
  assert.equal(loaded.ok, true);
  if (!loaded.ok) return;
  assert.equal(loaded.kind, "empty");
  assert.equal(writes.insert, 0);
  assert.equal(writes.update, 0);
  assert.equal(writes.get, 1);
});

await test("B first explicit save → insert semantic + route scene", async () => {
  const { store, writes, memory } = fakeRepo();
  const snapshot = {
    graph: graphAB,
    routeState: routeStateOf([stored("cn_ab", "a", "b", JOG)]),
    topology: emptyRouteTopology(),
  };
  const saved = await saveRelatedDiagramDraft({
    store,
    identity: { userId: "client-forged", organizationId: "forged-org", academicYear: 1999, caseId: "FORGED" },
    expectedVersion: null,
    snapshot,
  });
  assert.equal(saved.ok, true);
  assert.equal(writes.insert, 1);
  const row = (await memory.get("server-user", "SP-001")).row;
  assert.ok(row);
  assert.equal(row!.user_id, "server-user");
  assert.equal(row!.case_id, "SP-001");
  assert.notEqual(row!.organization_id, "forged-org");
  const parsed = inspectRouteSceneSchema(row!.route_scene);
  assert.equal(parsed.ok, true);
});

await test("C/D existing v1 exact restore / reload equivalent", async () => {
  const { store } = fakeRepo();
  const snapshot = {
    graph: graphAB,
    routeState: routeStateOf([stored("cn_ab", "a", "b", JOG)]),
    topology: emptyRouteTopology(),
  };
  await saveRelatedDiagramDraft({
    store,
    identity: SERVER_OWNED_PERSIST_IDENTITY,
    expectedVersion: null,
    snapshot,
  });
  const loaded = await loadRelatedDiagramDraft({
    store,
    identity: SERVER_OWNED_PERSIST_IDENTITY,
    seed: snapshot,
  });
  assert.equal(loaded.ok, true);
  if (!loaded.ok || loaded.kind !== "restored") return;
  assert.ok(pointsDeepEqual(loaded.routeState.byId.cn_ab!.points, JOG));
  assert.equal(loaded.graph.cards[0]!.layout.x, 40);
});

await test("E AUTO remains AUTO", async () => {
  const { store } = fakeRepo();
  const snapshot = {
    graph: graphAB,
    routeState: routeStateOf([stored("cn_ab", "a", "b", JOG)]),
    topology: emptyRouteTopology(),
  };
  await saveRelatedDiagramDraft({
    store,
    identity: SERVER_OWNED_PERSIST_IDENTITY,
    expectedVersion: null,
    snapshot,
  });
  const loaded = await loadRelatedDiagramDraft({
    store,
    identity: SERVER_OWNED_PERSIST_IDENTITY,
    seed: snapshot,
  });
  assert.equal(loaded.ok, true);
  if (!loaded.ok || loaded.kind !== "restored") return;
  assert.equal(isStudentManualRoute(loaded.topology, graphAB.connections[0]!), false);
  assert.equal(
    isStudentAutoQualityRerouteTarget(loaded.topology, graphAB.connections[0]!),
    true,
  );
});

await test("F MANUAL remains MANUAL", async () => {
  const { store } = fakeRepo();
  const committed = commitManualRouteEdit({
    connection: graphAB.connections[0]!,
    routeState: routeStateOf([stored("cn_ab", "a", "b", CROSSED)]),
    topology: emptyRouteTopology(),
    points: CROSSED,
  });
  await saveRelatedDiagramDraft({
    store,
    identity: SERVER_OWNED_PERSIST_IDENTITY,
    expectedVersion: null,
    snapshot: {
      graph: graphAB,
      routeState: committed.routeState,
      topology: committed.topology,
    },
  });
  const loaded = await loadRelatedDiagramDraft({
    store,
    identity: SERVER_OWNED_PERSIST_IDENTITY,
    seed: {
      graph: graphAB,
      routeState: committed.routeState,
      topology: committed.topology,
    },
  });
  assert.equal(loaded.ok, true);
  if (!loaded.ok || loaded.kind !== "restored") return;
  assert.ok(pointsDeepEqual(loaded.routeState.byId.cn_ab!.points, CROSSED));
  assert.equal(isStudentManualRoute(loaded.topology, graphAB.connections[0]!), true);
  assert.equal(
    isStudentAutoQualityRerouteTarget(loaded.topology, graphAB.connections[0]!),
    false,
  );
});

await test("G bridge reconstructed, not in payload", async () => {
  const { store, memory } = fakeRepo();
  const snapshot = {
    graph: graphABCD,
    routeState: routeStateOf([
      stored("cn_ab", "a", "b", CROSSED),
      stored("cn_cd", "c", "d", OTHER),
    ]),
    topology: emptyRouteTopology(),
  };
  await saveRelatedDiagramDraft({
    store,
    identity: SERVER_OWNED_PERSIST_IDENTITY,
    expectedVersion: null,
    snapshot,
  });
  const raw = JSON.stringify((await memory.get("server-user", "SP-001")).row!.route_scene);
  assert.equal(raw.includes("jumperConnectionId"), false);
  const loaded = await loadRelatedDiagramDraft({
    store,
    identity: SERVER_OWNED_PERSIST_IDENTITY,
    seed: snapshot,
  });
  assert.equal(loaded.ok, true);
  if (!loaded.ok || loaded.kind !== "restored") return;
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

await test("H history not restored", async () => {
  const { store } = fakeRepo();
  const snapshot = {
    graph: graphAB,
    routeState: routeStateOf([stored("cn_ab", "a", "b", JOG)]),
    topology: emptyRouteTopology(),
  };
  await saveRelatedDiagramDraft({
    store,
    identity: SERVER_OWNED_PERSIST_IDENTITY,
    expectedVersion: null,
    snapshot,
  });
  const loaded = await loadRelatedDiagramDraft({
    store,
    identity: SERVER_OWNED_PERSIST_IDENTITY,
    seed: snapshot,
  });
  assert.equal(loaded.ok, true);
  if (!loaded.ok || !("history" in loaded)) return;
  assert.equal(loaded.history.past.length, 0);
  assert.equal(loaded.history.future.length, 0);
});

await test("I optimistic update increments version", async () => {
  const { store } = fakeRepo();
  const snapshot = {
    graph: graphAB,
    routeState: routeStateOf([stored("cn_ab", "a", "b", JOG)]),
    topology: emptyRouteTopology(),
  };
  const first = await saveRelatedDiagramDraft({
    store,
    identity: SERVER_OWNED_PERSIST_IDENTITY,
    expectedVersion: null,
    snapshot,
  });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const second = await saveRelatedDiagramDraft({
    store,
    identity: SERVER_OWNED_PERSIST_IDENTITY,
    expectedVersion: first.version,
    snapshot: {
      graph: graphOf([card("a", 64, 72), card("b", 400, 48)], graphAB.connections),
      routeState: routeStateOf([stored("cn_ab", "a", "b", JOG)]),
      topology: emptyRouteTopology(),
    },
  });
  assert.equal(second.ok, true);
  if (!second.ok) return;
  assert.equal(second.version, first.version + 1);
});

await test("J stale conflict keeps local state", async () => {
  const { store, memory } = fakeRepo();
  const snapshot = {
    graph: graphAB,
    routeState: routeStateOf([stored("cn_ab", "a", "b", JOG)]),
    topology: emptyRouteTopology(),
  };
  const first = await saveRelatedDiagramDraft({
    store,
    identity: SERVER_OWNED_PERSIST_IDENTITY,
    expectedVersion: null,
    snapshot,
  });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  await memory.update({
    userId: "server-user",
    caseId: "SP-001",
    expectedVersion: first.version,
    semanticGraph: graphAB,
    routeScene: (await memory.get("server-user", "SP-001")).row!.route_scene,
  });
  const local = cloneStableRouteState(
    routeStateOf([stored("cn_ab", "a", "b", CROSSED)]),
  );
  const conflicted = await saveRelatedDiagramDraft({
    store,
    identity: SERVER_OWNED_PERSIST_IDENTITY,
    expectedVersion: first.version,
    snapshot: {
      graph: graphAB,
      routeState: local,
      topology: emptyRouteTopology(),
    },
  });
  assert.equal(conflicted.ok, false);
  if (conflicted.ok) return;
  assert.equal(conflicted.kind, "conflict");
  assert.ok(pointsDeepEqual(local.byId.cn_ab!.points, CROSSED));
});

await test("K unsupported blocks save", async () => {
  const { store, memory } = fakeRepo();
  const unknown = { schema: "rd.routeScene.v2", schemaVersion: 2, routes: [] };
  await memory.insert({
    user_id: "server-user",
    organization_id: "server-org",
    academic_year: 2026,
    case_id: "SP-001",
    semantic_graph: graphAB,
    route_scene: unknown,
  });
  const loaded = await loadRelatedDiagramDraft({
    store,
    identity: SERVER_OWNED_PERSIST_IDENTITY,
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
    identity: SERVER_OWNED_PERSIST_IDENTITY,
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
  assert.deepEqual((await memory.get("server-user", "SP-001")).row!.route_scene, unknown);
});

await test("L editor open only → DB write 0", async () => {
  const { store, writes } = fakeRepo();
  await loadRelatedDiagramDraft({
    store,
    identity: SERVER_OWNED_PERSIST_IDENTITY,
    seed: {
      graph: graphAB,
      routeState: routeStateOf([stored("cn_ab", "a", "b", JOG)]),
      topology: emptyRouteTopology(),
    },
  });
  assert.equal(writes.insert, 0);
  assert.equal(writes.update, 0);
});

await test("adapter ignores client ownership keys", async () => {
  const { store, received, memory } = fakeRepo();
  await saveRelatedDiagramDraft({
    store,
    identity: {
      userId: "client-forged",
      organizationId: "forged",
      academicYear: 1999,
      caseId: "FORGED",
    },
    expectedVersion: null,
    snapshot: {
      graph: graphAB,
      routeState: routeStateOf([stored("cn_ab", "a", "b", JOG)]),
      topology: emptyRouteTopology(),
    },
  });
  assert.equal(received.insertUser, "client-forged");
  assert.equal((await memory.get("server-user", "SP-001")).row!.user_id, "server-user");
});

await test("wiring: workspace uses adapter, not DEV identity / memory / hooks", () => {
  const ws = src("../../../components/v2/relatedDiagram/RelatedDiagramDevFixtureWorkspace.tsx");
  const action = src("../../../app/v2/actions/relatedDiagramDraft.ts");
  const hook = src("../../../components/v2/relatedDiagram/useCardInteraction.ts");
  const routeHook = src("../../../components/v2/relatedDiagram/useConnectionRouteInteraction.ts");
  const readonly = src("../../../components/v2/relatedDiagram/RelatedDiagramReadonlyWorkspace.tsx");
  const persist = src("./relatedDiagramDraftPersistence.ts");
  assert.ok(ws.includes("createRelatedDiagramRepositoryDraftStore"));
  assert.ok(ws.includes("readRelatedDiagramDraftRowAction"));
  assert.ok(ws.includes("SERVER_OWNED_PERSIST_IDENTITY"));
  assert.equal(ws.includes("DEV_SLICE1_PERSIST_IDENTITY"), false);
  assert.equal(ws.includes("devSlice1DraftStore"), false);
  assert.equal(ws.includes("route_scene"), false);
  assert.equal(ws.includes("getRelatedDiagram"), false);
  assert.equal(hook.includes("saveRelatedDiagramDraft"), false);
  assert.equal(routeHook.includes("saveRelatedDiagramDraft"), false);
  assert.equal(readonly.includes("readRelatedDiagramDraftRowAction"), false);
  assert.ok(action.includes("getCurrentProfile"));
  assert.ok(action.includes("caseIdForPatient"));
  assert.ok(action.includes("createServerSupabaseClient"));
  assert.equal(action.includes("createAdminSupabaseClient"), false);
  assert.equal(action.includes("SERVICE_ROLE"), false);
  assert.equal(action.includes("DEV_SLICE1_PERSIST_IDENTITY"), false);
  assert.equal(action.includes("decideStudentConnectionRoute"), false);
  assert.equal(persist.includes("decideStudentConnectionRoute"), false);
});

console.log(`\n${passed} passed`);
