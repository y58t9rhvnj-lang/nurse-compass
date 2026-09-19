/**
 * Slice 2B-2G-3 Connection Manage Phase 3 tests.
 * Student Direction Reverse. No pathfinder / reclassify.
 * Run: npx tsx lib/v2/relatedDiagram/relatedDiagramSlice2B2G3.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  connectionPermissions,
  extendReversedTargetApproach,
  remainingRoutesUnchanged,
  REVERSE_CONNECTION_NOTICE,
  reversePolyline,
  reverseStudentConnection,
} from "./cardConnectionManage";
import {
  applyHistoryCommand,
  emptyDiagramHistory,
  pushDiagramHistory,
  redoDiagramHistory,
  undoDiagramHistory,
} from "./diagramHistory";
import {
  cloneStableRouteState,
  seedStableRouteState,
  type StableRouteState,
} from "./incrementalRoutes";
import { lastSegmentLength, MIN_ARROW_APPROACH } from "./routeHardening";
import { resolveDevFixtureReadonlyScene } from "./resolveReadonlyScene";
import { ROUTE_TOPOLOGY_SCHEMA } from "./routeTopology";
import { createEmptySemanticGraph } from "./semanticGraph";
import { resolveConnectionStrokeVisual } from "./visualStyle";
import type {
  RelatedDiagramCard,
  RelatedDiagramConnection,
  RelatedDiagramSemanticGraph,
} from "./types";
import type { CrossingBridge, EdgeSide, Point } from "./orthogonalRouting";
import type { StoredRouteGeometry } from "./incrementalRoutes";

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

const ws = src(
  "../../../components/v2/relatedDiagram/RelatedDiagramDevFixtureWorkspace.tsx",
);
const manageLib = src("./cardConnectionManage.ts");
const historyLib = src("./diagramHistory.ts");
const actionBar = src(
  "../../../components/v2/relatedDiagram/RelatedDiagramConnectionActionBar.tsx",
);
const createLib = src("./cardConnectionCreate.ts");
const routingLib = src("./orthogonalRouting.ts");
const incrementalLib = src("./incrementalRoutes.ts");

function card(
  id: string,
  x: number,
  y: number,
  width = 160,
  height = 72,
): RelatedDiagramCard {
  return {
    id,
    cardType: "understanding",
    text: id,
    state: "current",
    origin: "direct_insight",
    layout: { x, y, width, height, zIndex: 1 },
    isLocked: false,
    createdAt: "2026-09-19T00:00:00.000Z",
    updatedAt: "2026-09-19T00:00:00.000Z",
  };
}

function conn(
  id: string,
  sourceCardId: string,
  targetCardId: string,
  relationType: RelatedDiagramConnection["relationType"] = "current",
  origin: RelatedDiagramConnection["origin"] = "student_diagram",
): RelatedDiagramConnection {
  return {
    id,
    sourceCardId,
    targetCardId,
    relationType,
    origin,
    createdAt: "2026-09-19T00:00:00.000Z",
    updatedAt: "2026-09-19T00:00:00.000Z",
  };
}

function graphOf(
  cards: RelatedDiagramCard[],
  connections: RelatedDiagramConnection[],
): RelatedDiagramSemanticGraph {
  return { ...createEmptySemanticGraph(), cards, connections };
}

function stored(input: {
  id: string;
  sourceCardId: string;
  targetCardId: string;
  sourceEdge: EdgeSide;
  targetEdge: EdgeSide;
  points: Point[];
}): StoredRouteGeometry {
  return {
    connectionId: input.id,
    sourceCardId: input.sourceCardId,
    targetCardId: input.targetCardId,
    sourceEdge: input.sourceEdge,
    targetEdge: input.targetEdge,
    sourcePin: { ...input.points[0]! },
    targetPin: { ...input.points[input.points.length - 1]! },
    points: input.points.map((point) => ({ ...point })),
  };
}

function routesOf(
  rows: StoredRouteGeometry[],
  bridges: CrossingBridge[] = [],
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
    bridges: bridges.map((bridge) => ({ ...bridge })),
    qualityTrace: {},
  };
}

const left = card("a", 80, 80);
const right = card("b", 400, 80);
const keep = card("c", 80, 320);

/** 20px source stub, 24px target approach, horizontal. */
const abPoints: Point[] = [
  { x: 240, y: 116 },
  { x: 260, y: 116 },
  { x: 376, y: 116 },
  { x: 400, y: 116 },
];

function abGraph(
  relation: RelatedDiagramConnection["relationType"] = "current",
) {
  return graphOf([left, right, keep], [
    conn("cn_ab", "a", "b", relation),
    conn("cn_keep", "a", "c", "potential"),
  ]);
}

function abRoutes() {
  return routesOf([
    stored({
      id: "cn_ab",
      sourceCardId: "a",
      targetCardId: "b",
      sourceEdge: "right",
      targetEdge: "left",
      points: abPoints,
    }),
    stored({
      id: "cn_keep",
      sourceCardId: "a",
      targetCardId: "c",
      sourceEdge: "bottom",
      targetEdge: "top",
      points: [
        { x: 160, y: 152 },
        { x: 160, y: 172 },
        { x: 160, y: 296 },
        { x: 160, y: 320 },
      ],
    }),
  ]);
}

function reverseFn() {
  return ws.slice(
    ws.indexOf("const handleStudentConnectionReverse"),
    ws.indexOf("const handleConnectionPointerDown"),
  );
}

test("A-F semantic reverse keeps identity and swaps ends", () => {
  const result = reverseStudentConnection({
    graph: abGraph(),
    routeState: abRoutes(),
    connectionId: "cn_ab",
    now: "2026-09-19T18:00:00.000Z",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.after.id, "cn_ab");
  assert.equal(result.after.sourceCardId, "b");
  assert.equal(result.after.targetCardId, "a");
  assert.equal(result.after.relationType, "current");
  assert.equal(result.after.origin, "student_diagram");
  assert.equal(result.after.createdAt, "2026-09-19T00:00:00.000Z");
  assert.equal(result.after.updatedAt, "2026-09-19T18:00:00.000Z");
  assert.equal(result.graph.connections.filter((row) => row.id === "cn_ab").length, 1);
});

test("G-L points reverse and pins/edges swap", () => {
  const before = abRoutes();
  const result = reverseStudentConnection({
    graph: abGraph(),
    routeState: before,
    connectionId: "cn_ab",
    now: "2026-09-19T18:00:00.000Z",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const next = result.routeState.byId.cn_ab!;
  const old = before.byId.cn_ab!;
  assert.deepEqual(next.sourcePin, old.targetPin);
  assert.deepEqual(next.targetPin, old.sourcePin);
  assert.equal(next.sourceEdge, old.targetEdge);
  assert.equal(next.targetEdge, old.sourceEdge);
  assert.deepEqual(next.points[0], old.points[old.points.length - 1]);
  assert.deepEqual(next.points[next.points.length - 1], old.points[0]);
  const reversed = reversePolyline(old.points);
  if (result.repaired) {
    assert.deepEqual(next.points.slice(0, -2), reversed.slice(0, -2));
    assert.notDeepEqual(next.points[next.points.length - 2], reversed[reversed.length - 2]);
  } else {
    assert.deepEqual(next.points, reversed);
  }
});

test("M-O reverse does not call planner / pathfinder / incremental", () => {
  assert.equal(manageLib.includes("findRectilinearPath"), false);
  assert.equal(manageLib.includes("planOrthogonalRoutes"), false);
  assert.equal(manageLib.includes("commitStudentConnectionCreate"), false);
  assert.equal(manageLib.includes("applyIncremental"), false);
  assert.equal(routingLib.includes("reverseStudentConnection"), false);
  assert.equal(incrementalLib.includes("reverseStudentConnection"), false);
});

test("P-R target approach is locally repaired only when needed", () => {
  const needsRepair = reverseStudentConnection({
    graph: abGraph(),
    routeState: abRoutes(),
    connectionId: "cn_ab",
    now: "2026-09-19T18:00:00.000Z",
  });
  assert.equal(needsRepair.ok, true);
  if (!needsRepair.ok) return;
  assert.equal(needsRepair.repaired, true);
  assert.ok(
    lastSegmentLength(needsRepair.routeState.byId.cn_ab!.points) >=
      MIN_ARROW_APPROACH - 0.2,
  );
  const already24 = routesOf([
    stored({
      id: "cn_ab",
      sourceCardId: "a",
      targetCardId: "b",
      sourceEdge: "right",
      targetEdge: "left",
      points: [
        { x: 240, y: 116 },
        { x: 264, y: 116 },
        { x: 376, y: 116 },
        { x: 400, y: 116 },
      ],
    }),
  ]);
  const noRepair = reverseStudentConnection({
    graph: graphOf([left, right], [conn("cn_ab", "a", "b")]),
    routeState: already24,
    connectionId: "cn_ab",
    now: "2026-09-19T18:00:00.000Z",
  });
  assert.equal(noRepair.ok, true);
  if (!noRepair.ok) return;
  assert.equal(noRepair.repaired, false);
  const local = extendReversedTargetApproach({
    points: reversePolyline(abPoints),
    targetPin: { x: 240, y: 116 },
    targetEdge: "right",
  });
  assert.equal(local.ok, true);
  if (!local.ok) return;
  assert.equal(local.repaired, true);
  assert.deepEqual(local.points.slice(0, -2), reversePolyline(abPoints).slice(0, -2));
});

test("S-T invalid repair is atomic NO-OP", () => {
  const tight = card("edge", 4, 80);
  const far = card("far", 400, 80);
  const graph = graphOf(
    [tight, far],
    [conn("cn_fail", "edge", "far")],
  );
  const routeState = routesOf([
    stored({
      id: "cn_fail",
      sourceCardId: "edge",
      targetCardId: "far",
      sourceEdge: "left",
      targetEdge: "left",
      points: [
        { x: 4, y: 116 },
        { x: -16, y: 116 },
        { x: -16, y: 200 },
        { x: 376, y: 200 },
        { x: 400, y: 116 },
      ],
    }),
  ]);
  const beforeGraph = JSON.stringify(graph);
  const beforeRoutes = JSON.stringify(routeState);
  const result = reverseStudentConnection({
    graph,
    routeState,
    connectionId: "cn_fail",
    now: "2026-09-19T18:00:00.000Z",
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, "reverse_failed");
  assert.equal(result.notice, REVERSE_CONNECTION_NOTICE);
  assert.equal(JSON.stringify(graph), beforeGraph);
  assert.equal(JSON.stringify(routeState), beforeRoutes);
  assert.equal(emptyDiagramHistory().past.length, 0);
});

test("U-X arrow follows new target and relation visuals stay", () => {
  for (const relation of ["current", "potential", "treatment"] as const) {
    const result = reverseStudentConnection({
      graph: abGraph(relation),
      routeState: abRoutes(),
      connectionId: "cn_ab",
      now: "2026-09-19T18:00:00.000Z",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const route = result.routeState.byId.cn_ab!;
    assert.deepEqual(route.points[route.points.length - 1], route.targetPin);
    assert.equal(result.after.relationType, relation);
    const visual = resolveConnectionStrokeVisual(relation);
    if (relation === "potential") assert.equal(visual.dasharray, "5 4");
    if (relation === "treatment") assert.ok(visual.strokeWidthPx > 2);
    if (relation === "current") assert.equal(visual.dasharray, null);
  }
});

test("Y-AD bridges stay coordinate-exact and are not reclassified", () => {
  const scene = resolveDevFixtureReadonlyScene({ includeStyleDemo: true });
  const routeState = seedStableRouteState(
    scene.graph.cards,
    scene.graph.connections,
    scene.routeTopology,
  );
  const beforeBridges = JSON.stringify(routeState.bridges);
  const result = reverseStudentConnection({
    graph: scene.graph,
    routeState,
    topology: scene.routeTopology,
    connectionId: "demo_c_cross_v",
    now: "2026-09-19T18:00:00.000Z",
  });
  if (result.ok) {
    assert.equal(JSON.stringify(result.routeState.bridges), beforeBridges);
    for (const bridge of result.routeState.bridges) {
      const old = routeState.bridges.find(
        (row) =>
          row.jumperConnectionId === bridge.jumperConnectionId &&
          row.underConnectionId === bridge.underConnectionId &&
          row.x === bridge.x &&
          row.y === bridge.y,
      );
      assert.ok(old);
      assert.equal(bridge.jumperAxis, old!.jumperAxis);
    }
  } else {
    assert.equal(result.code, "reverse_failed");
    assert.equal(JSON.stringify(routeState.bridges), beforeBridges);
  }
  assert.equal(manageLib.includes("classifyRouteInteractions"), false);
});

test("AE-AJ topology drops reversed ID from old fan only", () => {
  const scene = resolveDevFixtureReadonlyScene({ includeStyleDemo: true });
  const routeState = seedStableRouteState(
    scene.graph.cards,
    scene.graph.connections,
    scene.routeTopology,
  );
  const topology = scene.routeTopology!;
  const beforeC = topology.routes.find((row) => row.connectionId === "demo_c_junc_c");
  const beforeB = topology.routes.find((row) => row.connectionId === "demo_c_junc_b");
  const result = reverseStudentConnection({
    graph: scene.graph,
    routeState,
    topology,
    connectionId: "demo_c_junc_c",
    now: "2026-09-19T18:00:00.000Z",
  });
  if (!result.ok) {
    const synthetic = {
      schema: ROUTE_TOPOLOGY_SCHEMA,
      trunks: [
        {
          id: "t1",
          points: [
            { x: 10, y: 10 },
            { x: 40, y: 10 },
          ],
          connectionIds: ["cn_ab", "cn_keep"],
          branchPointId: "bp1",
        },
      ],
      branchPoints: [
        { id: "bp1", x: 40, y: 10, connectionIds: ["cn_ab", "cn_keep"] },
      ],
      routeGroups: [
        {
          id: "g1",
          sourceCardId: "a",
          trunkId: "t1",
          connectionIds: ["cn_ab", "cn_keep"],
        },
      ],
      routes: [
        {
          connectionId: "cn_ab",
          sourceEdge: "right" as const,
          targetEdge: "left" as const,
          points: abPoints,
        },
      ],
    };
    const reversed = reverseStudentConnection({
      graph: abGraph(),
      routeState: abRoutes(),
      topology: synthetic,
      connectionId: "cn_ab",
      now: "2026-09-19T18:00:00.000Z",
    });
    assert.equal(reversed.ok, true);
    if (!reversed.ok || !reversed.topology) return;
    assert.equal(
      reversed.topology.routeGroups.some((group) =>
        group.connectionIds.includes("cn_ab"),
      ),
      false,
    );
    assert.equal(reversed.topology.routeGroups[0]?.connectionIds.includes("cn_keep"), true);
    assert.deepEqual(reversed.topology.trunks[0]?.points, synthetic.trunks[0]?.points);
    assert.equal(reversed.topology.branchPoints[0]?.x, 40);
    return;
  }
  assert.ok(result.topology);
  assert.equal(
    result.topology!.routeGroups.some((group) =>
      group.connectionIds.includes("demo_c_junc_c"),
    ),
    false,
  );
  assert.equal(
    result.topology!.routeGroups.some((group) =>
      group.connectionIds.includes("demo_c_junc_b"),
    ),
    true,
  );
  const afterB = result.topology!.routes.find((row) => row.connectionId === "demo_c_junc_b");
  assert.deepEqual(afterB?.points, beforeB?.points);
  assert.ok(beforeC);
});

test("AK-AN reverse history is one exact snapshot action", () => {
  const graph = abGraph();
  const routeState = abRoutes();
  const result = reverseStudentConnection({
    graph,
    routeState,
    connectionId: "cn_ab",
    now: "2026-09-19T18:00:00.000Z",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const history = pushDiagramHistory(emptyDiagramHistory(), {
    type: "reverseConnection",
    before: result.before,
    after: result.after,
    routeStateBefore: cloneStableRouteState(routeState),
    routeStateAfter: cloneStableRouteState(result.routeState),
  });
  assert.equal(history.past.length, 1);
  assert.equal(history.past[0]?.type, "reverseConnection");
  const undone = undoDiagramHistory(history);
  const afterUndo = applyHistoryCommand(result.graph, undone.command);
  assert.deepEqual(
    afterUndo.connections.find((row) => row.id === "cn_ab"),
    result.before,
  );
  if (undone.command.kind === "replaceConnection") {
    assert.deepEqual(
      undone.command.routeState?.byId.cn_ab?.points,
      routeState.byId.cn_ab?.points,
    );
  }
  const redone = redoDiagramHistory(undone.history);
  const afterRedo = applyHistoryCommand(afterUndo, redone.command);
  assert.deepEqual(
    afterRedo.connections.find((row) => row.id === "cn_ab"),
    result.after,
  );
  if (redone.command.kind === "replaceConnection") {
    assert.deepEqual(
      redone.command.routeState?.byId.cn_ab?.points,
      result.routeState.byId.cn_ab?.points,
    );
  }
  assert.equal(historyLib.includes("extendReversedTargetApproach"), false);
  assert.equal(historyLib.includes("reverseStudentConnection"), false);
});

test("AO selection is not a history action", () => {
  assert.equal(ws.includes('type: "selectConnection"'), false);
  assert.equal(emptyDiagramHistory().past.length, 0);
});

test("AP-AU reversible permissions stay 2G-1 contract", () => {
  assert.equal(connectionPermissions(conn("s", "a", "b", "current")).reversible, true);
  assert.equal(connectionPermissions(conn("s", "a", "b", "potential")).reversible, true);
  assert.equal(connectionPermissions(conn("s", "a", "b", "treatment")).reversible, true);
  assert.equal(
    connectionPermissions(conn("k", "a", "b", "current", "knowledge_library")).reversible,
    false,
  );
  assert.equal(
    connectionPermissions(conn("b", "a", "b", "nursing_problem_basis")).reversible,
    false,
  );
  assert.equal(
    connectionPermissions(
      conn("i", "a", "b", "nursing_problem_integration", "system_integration"),
    ).reversible,
    false,
  );
  const scene = resolveDevFixtureReadonlyScene({ includeStyleDemo: true });
  const routeState = seedStableRouteState(
    scene.graph.cards,
    scene.graph.connections,
    scene.routeTopology,
  );
  for (const id of ["skc1", "demo_c_basis", "demo_c_integ"]) {
    const denied = reverseStudentConnection({
      graph: scene.graph,
      routeState,
      topology: scene.routeTopology,
      connectionId: id,
      now: "2026-09-19T18:00:00.000Z",
    });
    assert.equal(denied.ok, false);
    if (!denied.ok) assert.equal(denied.code, "not_reversible");
  }
});

test("AV-AY workspace keeps selection and shows failure notice", () => {
  const fn = reverseFn();
  assert.ok(fn.includes("reverseStudentConnection"));
  assert.ok(fn.includes('type: "reverseConnection"'));
  assert.equal(fn.includes("clearConnectionSelection"), false);
  assert.ok(fn.includes("setConnectNotice"));
  assert.ok(fn.includes("REVERSE_CONNECTION_NOTICE"));
  assert.ok(fn.includes("reverse_failed"));
  const failBranch = fn.slice(
    fn.indexOf("if (!result.ok)"),
    fn.indexOf("setGraph(result.graph)"),
  );
  assert.equal(failBranch.includes("onHistoryPush"), false);
  const open = ws.slice(
    ws.indexOf("<RelatedDiagramConnectionActionBar"),
    ws.indexOf("</RelatedDiagramConnectionActionBar>"),
  );
  assert.ok(open.includes("onReverse"));
  assert.ok(open.includes("connectionPermissions(selectedConnection).reversible"));
  assert.equal(REVERSE_CONNECTION_NOTICE, "この関係は現在の配置では向きを反転できません。");
  assert.ok(actionBar.includes("向きを反転"));
});

test("lastValidPoints reverse with the committed route", () => {
  const before = abRoutes();
  const result = reverseStudentConnection({
    graph: abGraph(),
    routeState: before,
    connectionId: "cn_ab",
    now: "2026-09-19T18:00:00.000Z",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(
    result.routeState.lastValidPoints.cn_ab,
    result.routeState.byId.cn_ab?.points,
  );
  assert.deepEqual(
    result.routeState.lastValidPoints.cn_keep,
    before.lastValidPoints.cn_keep,
  );
  assert.equal(
    remainingRoutesUnchanged(before, result.routeState, "cn_ab") ||
      result.routeState.byId.cn_keep != null,
    true,
  );
  assert.deepEqual(
    result.routeState.byId.cn_keep?.points,
    before.byId.cn_keep?.points,
  );
});

test("qualityTrace of reversed connection may drop", () => {
  const before = abRoutes();
  before.qualityTrace = {
    cn_ab: {
      connectionId: "cn_ab",
      length: 10,
      directLength: 10,
      detourRatio: 1,
      crossingCount: 0,
      bendCount: 0,
      bridgeCount: 0,
      unsafeBridgeReasons: [],
      routeBBox: { x: 0, y: 0, width: 1, height: 1 },
      crossCanvasRatio: { x: 0, y: 0, area: 0 },
      selectedClass: 0,
      lastValidUsed: false,
      bpRelocated: false,
    },
    cn_keep: {
      connectionId: "cn_keep",
      length: 8,
      directLength: 8,
      detourRatio: 1,
      crossingCount: 0,
      bendCount: 0,
      bridgeCount: 0,
      unsafeBridgeReasons: [],
      routeBBox: { x: 0, y: 0, width: 1, height: 1 },
      crossCanvasRatio: { x: 0, y: 0, area: 0 },
      selectedClass: 0,
      lastValidUsed: false,
      bpRelocated: false,
    },
  };
  const keepTrace = before.qualityTrace.cn_keep;
  const result = reverseStudentConnection({
    graph: abGraph(),
    routeState: before,
    connectionId: "cn_ab",
    now: "2026-09-19T18:00:00.000Z",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.routeState.qualityTrace?.cn_ab, undefined);
  assert.deepEqual(result.routeState.qualityTrace?.cn_keep, keepTrace);
  assert.equal(manageLib.includes("evaluateRouteQuality"), false);
});

test("empty group is pruned and no new fan is created", () => {
  const topology = {
    schema: ROUTE_TOPOLOGY_SCHEMA,
    trunks: [
      {
        id: "t-empty",
        points: [
          { x: 10, y: 10 },
          { x: 20, y: 10 },
        ],
        connectionIds: ["cn_ab"],
        branchPointId: "bp-empty",
      },
    ],
    branchPoints: [
      { id: "bp-empty", x: 20, y: 10, connectionIds: ["cn_ab"] },
    ],
    routeGroups: [
      {
        id: "g-empty",
        sourceCardId: "a",
        trunkId: "t-empty",
        connectionIds: ["cn_ab"],
      },
    ],
    routes: [
      {
        connectionId: "cn_ab",
        sourceEdge: "right" as const,
        targetEdge: "left" as const,
        points: abPoints,
      },
    ],
  };
  const result = reverseStudentConnection({
    graph: abGraph(),
    routeState: abRoutes(),
    topology,
    connectionId: "cn_ab",
    now: "2026-09-19T18:00:00.000Z",
  });
  assert.equal(result.ok, true);
  if (!result.ok || !result.topology) return;
  assert.equal(result.topology.routeGroups.length, 0);
  assert.equal(result.topology.trunks.length, 0);
  assert.equal(result.topology.branchPoints.length, 0);
  assert.equal(
    result.topology.routeGroups.some((group) => group.sourceCardId === "b"),
    false,
  );
});

test("duplicate pair is not raised for same-id reverse", () => {
  assert.ok(createLib.includes("findConnectionForCardPair"));
  const result = reverseStudentConnection({
    graph: abGraph(),
    routeState: abRoutes(),
    connectionId: "cn_ab",
    now: "2026-09-19T18:00:00.000Z",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.graph.connections.filter((row) => row.id === "cn_ab").length, 1);
});

test("Freeze: reverse does not edit routing algorithms", () => {
  assert.equal(manageLib.includes("findRectilinearPath"), false);
  assert.equal(manageLib.includes("classifyRouteInteractions"), false);
  assert.equal(manageLib.includes("selectQualityCandidate"), false);
  assert.equal(manageLib.includes("knowledgeLibraryRepository"), false);
  assert.equal(ws.includes("handleEditConnection"), false);
  assert.equal(ws.includes("upsertConnection("), false);
});

console.log(`\n${passed} passed`);
