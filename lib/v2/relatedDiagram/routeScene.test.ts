/**
 * Persistence P1 — routeScene v1 serialize / restore.
 * Run: ./node_modules/.bin/jiti lib/v2/relatedDiagram/routeScene.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  bridgesDeepEqual,
  pointsDeepEqual,
  type StableRouteState,
} from "./incrementalRoutes";
import {
  commitManualRouteEdit,
  dragOrthogonalSegment,
  isStudentManualRoute,
} from "./manualRouteEdit";
import { classifyRouteInteractions } from "./orthogonalRouting";
import { emptyRouteTopology } from "./routeTopology";
import {
  restoreRouteScene,
  ROUTE_SCENE_SCHEMA,
  ROUTE_SCENE_SCHEMA_VERSION,
  serializeRouteScene,
  type RelatedDiagramRouteSceneV1,
} from "./routeScene";
import type {
  RelatedDiagramCard,
  RelatedDiagramConnection,
  RelatedDiagramSemanticGraph,
} from "./types";
import { RELATED_DIAGRAM_SEMANTIC_SCHEMA_VERSION } from "./types";

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

const TS = "2026-09-24T00:00:00.000Z";
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

function routeStateOf(
  rows: ReturnType<typeof stored>[],
): StableRouteState {
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
  return {
    byId,
    lastValidPoints,
    invalidReasons: {},
    bridges: [{ jumperConnectionId: "stale", underConnectionId: "stale", x: 1, y: 1, jumperAxis: "h" }],
  };
}

const graphAB = graphOf(
  [card("a", 40, 48), card("b", 400, 48)],
  [connection("cn_ab", "a", "b")],
);
const graphABCD = graphOf(
  [card("a", 40, 48), card("b", 400, 48), card("c", 40, 168), card("d", 400, 168)],
  [connection("cn_ab", "a", "b"), connection("cn_cd", "c", "d")],
);

function expectedBridges(state: StableRouteState, topology = emptyRouteTopology()) {
  return classifyRouteInteractions(
    Object.values(state.byId).map((row) => ({
      connectionId: row.connectionId,
      sourceCardId: row.sourceCardId,
      targetCardId: row.targetCardId,
      sourceEdge: row.sourceEdge,
      targetEdge: row.targetEdge,
      points: row.points,
    })),
    graphABCD.cards,
    topology,
  ).bridges;
}

test("A AUTO serialize → restore exact, still AUTO", () => {
  const before = routeStateOf([stored("cn_ab", "a", "b", JOG)]);
  const payload = serializeRouteScene({
    graph: graphAB,
    routeState: before,
    topology: emptyRouteTopology(),
  });
  assert.equal(payload.schema, ROUTE_SCENE_SCHEMA);
  assert.equal(payload.schemaVersion, ROUTE_SCENE_SCHEMA_VERSION);
  assert.equal(payload.topology.routes.length, 0);
  assert.equal("bridges" in payload, false);
  const restored = restoreRouteScene({ graph: graphAB, routeScene: payload });
  assert.equal(restored.supported, true);
  const storedAfter = restored.routeState.byId.cn_ab!;
  assert.ok(pointsDeepEqual(storedAfter.points, JOG));
  assert.equal(storedAfter.sourceEdge, "right");
  assert.equal(storedAfter.targetEdge, "left");
  assert.deepEqual(storedAfter.sourcePin, JOG[0]);
  assert.deepEqual(storedAfter.targetPin, JOG[JOG.length - 1]);
  assert.ok(pointsDeepEqual(restored.routeState.lastValidPoints.cn_ab!, JOG));
  assert.equal(isStudentManualRoute(restored.topology, graphAB.connections[0]!), false);
  assert.equal(payload.topology.routes.some((row) => row.connectionId === "cn_ab"), false);
});

test("B MANUAL Parallel Move serialize → restore exact, still MANUAL", () => {
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
  const payload = serializeRouteScene({
    graph: graphAB,
    routeState: committed.routeState,
    topology: committed.topology,
  });
  assert.equal(payload.topology.routes.length, 1);
  assert.equal(payload.topology.routes[0]!.connectionId, "cn_ab");
  assert.ok(pointsDeepEqual(payload.topology.routes[0]!.points, moved));
  const restored = restoreRouteScene({ graph: graphAB, routeScene: payload });
  assert.ok(pointsDeepEqual(restored.routeState.byId.cn_ab!.points, moved));
  assert.equal(isStudentManualRoute(restored.topology, graphAB.connections[0]!), true);
  assert.deepEqual(restored.topology.routes[0]!.points, payload.topology.routes[0]!.points);
});

test("C AUTO + MANUAL mix keeps both geometry and identity", () => {
  const auto = stored("cn_cd", "c", "d", OTHER);
  const before = routeStateOf([stored("cn_ab", "a", "b", OPEN), auto]);
  const moved = dragOrthogonalSegment({
    points: OPEN,
    segmentIndex: 2,
    deltaX: 0,
    deltaY: 80,
  });
  const committed = commitManualRouteEdit({
    connection: graphABCD.connections[0]!,
    routeState: before,
    topology: emptyRouteTopology(),
    points: moved,
  });
  const payload = serializeRouteScene({
    graph: graphABCD,
    routeState: committed.routeState,
    topology: committed.topology,
  });
  assert.equal(payload.topology.routes.map((row) => row.connectionId).join(","), "cn_ab");
  const restored = restoreRouteScene({ graph: graphABCD, routeScene: payload });
  assert.ok(pointsDeepEqual(restored.routeState.byId.cn_ab!.points, moved));
  assert.ok(pointsDeepEqual(restored.routeState.byId.cn_cd!.points, OTHER));
  assert.equal(isStudentManualRoute(restored.topology, graphABCD.connections[0]!), true);
  assert.equal(isStudentManualRoute(restored.topology, graphABCD.connections[1]!), false);
});

test("D crossing: payload has no bridges; restore classifies; points exact", () => {
  const before = routeStateOf([
    stored("cn_ab", "a", "b", CROSSED),
    stored("cn_cd", "c", "d", OTHER),
  ]);
  const payload = serializeRouteScene({
    graph: graphABCD,
    routeState: before,
    topology: emptyRouteTopology(),
  });
  const raw = JSON.stringify(payload);
  assert.equal(raw.includes("bridges"), false);
  assert.equal(raw.includes("jumperConnectionId"), false);
  const restored = restoreRouteScene({ graph: graphABCD, routeScene: payload });
  assert.ok(pointsDeepEqual(restored.routeState.byId.cn_ab!.points, CROSSED));
  assert.ok(pointsDeepEqual(restored.routeState.byId.cn_cd!.points, OTHER));
  const expected = expectedBridges(restored.routeState, restored.topology);
  assert.ok(expected.length >= 1);
  assert.ok(bridgesDeepEqual(restored.routeState.bridges, expected));
});

test("E no crossing → restore bridges 0", () => {
  const before = routeStateOf([
    stored("cn_ab", "a", "b", OPEN),
    stored("cn_cd", "c", "d", OTHER),
  ]);
  const payload = serializeRouteScene({
    graph: graphABCD,
    routeState: before,
    topology: emptyRouteTopology(),
  });
  const restored = restoreRouteScene({ graph: graphABCD, routeScene: payload });
  assert.equal(restored.routeState.bridges.length, 0);
});

test("F missing route: others exact, missing diagnostic, no router", () => {
  const payload = serializeRouteScene({
    graph: graphABCD,
    routeState: routeStateOf([stored("cn_ab", "a", "b", JOG)]),
    topology: emptyRouteTopology(),
  });
  assert.equal(payload.routes.length, 1);
  const restored = restoreRouteScene({ graph: graphABCD, routeScene: payload });
  assert.ok(pointsDeepEqual(restored.routeState.byId.cn_ab!.points, JOG));
  assert.equal(restored.routeState.byId.cn_cd, undefined);
  assert.deepEqual(restored.diagnostics.missingRouteIds, ["cn_cd"]);
  assert.deepEqual(restored.diagnostics.invalidRouteIds, []);
});

test("G invalid route: others exact, invalid diagnostic, no router", () => {
  const payload = serializeRouteScene({
    graph: graphABCD,
    routeState: routeStateOf([
      stored("cn_ab", "a", "b", JOG),
      stored("cn_cd", "c", "d", OTHER),
    ]),
    topology: emptyRouteTopology(),
  });
  const broken: RelatedDiagramRouteSceneV1 = {
    ...payload,
    routes: payload.routes.map((row) =>
      row.connectionId === "cn_cd"
        ? {
            ...row,
            points: [
              { x: 40, y: 200 },
              { x: 120, y: 260 },
              { x: 480, y: 200 },
            ],
          }
        : row,
    ),
  };
  const restored = restoreRouteScene({ graph: graphABCD, routeScene: broken });
  assert.ok(pointsDeepEqual(restored.routeState.byId.cn_ab!.points, JOG));
  assert.equal(restored.routeState.byId.cn_cd, undefined);
  assert.deepEqual(restored.diagnostics.invalidRouteIds, ["cn_cd"]);
  assert.ok(restored.diagnostics.invalidReasons.cn_cd?.includes("non-orthogonal"));
  assert.deepEqual(restored.diagnostics.missingRouteIds, []);
});

test("H orphan persisted route ignored; others unchanged", () => {
  const payload = serializeRouteScene({
    graph: graphAB,
    routeState: routeStateOf([stored("cn_ab", "a", "b", JOG)]),
    topology: emptyRouteTopology(),
  });
  const withOrphan: RelatedDiagramRouteSceneV1 = {
    ...payload,
    routes: [
      ...payload.routes,
      stored("cn_ghost", "x", "y", OTHER),
    ],
  };
  const restored = restoreRouteScene({ graph: graphAB, routeScene: withOrphan });
  assert.ok(pointsDeepEqual(restored.routeState.byId.cn_ab!.points, JOG));
  assert.equal(restored.routeState.byId.cn_ghost, undefined);
  assert.deepEqual(restored.diagnostics.orphanRouteIds, ["cn_ghost"]);
});

test("I unknown schema is not guessed; no restore", () => {
  const v1 = serializeRouteScene({
    graph: graphAB,
    routeState: routeStateOf([stored("cn_ab", "a", "b", JOG)]),
    topology: emptyRouteTopology(),
  });
  const unknown = {
    schema: "rd.routeScene.v2",
    schemaVersion: 2,
    routes: v1.routes,
    topology: v1.topology,
  };
  const restored = restoreRouteScene({ graph: graphAB, routeScene: unknown });
  assert.equal(restored.supported, false);
  assert.equal(restored.diagnostics.unsupportedSchema, true);
  assert.equal(restored.routeState.byId.cn_ab, undefined);
  assert.equal(restored.topology.routes.length, 0);
  assert.deepEqual(restored.diagnostics.restoredRouteIds, []);
});

test("J serialize → restore → serialize canonical deep equal", () => {
  const before = routeStateOf([
    stored("cn_ab", "a", "b", CROSSED),
    stored("cn_cd", "c", "d", OTHER),
  ]);
  const first = serializeRouteScene({
    graph: graphABCD,
    routeState: before,
    topology: emptyRouteTopology(),
  });
  const restored = restoreRouteScene({ graph: graphABCD, routeScene: first });
  const second = serializeRouteScene({
    graph: graphABCD,
    routeState: restored.routeState,
    topology: restored.topology,
  });
  assert.deepEqual(second, first);
});

test("P1 does not call routers / persist bridges / lastValidPoints", () => {
  const domain = src("./routeScene.ts");
  for (const name of [
    "decideStudentConnectionRoute",
    "selectBestOrthogonalRoute",
    "findRectilinearPath",
    "planOrthogonalRoutes",
    "planLightweightInitialRoutes",
    "seedInitialAutoRouteState",
    "seedStableRouteState",
    "applyLightweightCardDrop",
    "applyStudentAutoQualityReroute",
  ]) {
    assert.equal(domain.includes(name), false, name);
  }
  assert.ok(domain.includes("classifyRouteInteractions"));
  assert.ok(domain.includes("rebuilds it from restored points"));
  assert.equal(domain.includes("lastValidPoints:"), true);
  const editor = src("../../../components/v2/relatedDiagram/RelatedDiagramDevFixtureWorkspace.tsx");
  assert.equal(editor.includes("serializeRouteScene"), false);
  assert.equal(editor.includes("restoreRouteScene"), false);
  assert.equal(src("./relatedDiagramRepository.ts").includes("restoreRouteScene"), false);
  assert.equal(src("./relatedDiagramRepository.ts").includes("serializeRouteScene"), false);
});

console.log(`\n${passed} passed`);
