/**
 * Slice 2B-2G-2 Connection Manage Phase 2 tests.
 * Student relation change + student/knowledge delete + exact undo/redo.
 * No reverse. No reroute.
 * Run: npx tsx lib/v2/relatedDiagram/relatedDiagramSlice2B2G2.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cloneConnection } from "./cardConnectionCreate";
import {
  changeStudentConnectionRelation,
  connectionPermissions,
  deleteManagedConnection,
  remainingRoutesUnchanged,
  replaceConnectionExact,
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
} from "./incrementalRoutes";
import { resolveDevFixtureReadonlyScene } from "./resolveReadonlyScene";
import { createEmptySemanticGraph } from "./semanticGraph";
import { SCHIZOPHRENIA_KNOWLEDGE_CONNECTIONS } from "./fixtures/schizophreniaPathophysiologyFixture";
import { resolveConnectionStrokeVisual } from "./visualStyle";
import type {
  RelatedDiagramCard,
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

const ws = src(
  "../../../components/v2/relatedDiagram/RelatedDiagramDevFixtureWorkspace.tsx",
);
const manageLib = src("./cardConnectionManage.ts");
const historyLib = src("./diagramHistory.ts");
const actionBar = src(
  "../../../components/v2/relatedDiagram/RelatedDiagramConnectionActionBar.tsx",
);

function fixtureScene() {
  return resolveDevFixtureReadonlyScene({ includeStyleDemo: true });
}

function seededFixture() {
  const scene = fixtureScene();
  return {
    scene,
    graph: scene.graph,
    topology: scene.routeTopology,
    routeState: seedStableRouteState(
      scene.graph.cards,
      scene.graph.connections,
      scene.routeTopology,
    ),
  };
}

function card(id: string, x: number, y: number): RelatedDiagramCard {
  return {
    id,
    cardType: "understanding",
    text: id,
    state: "current",
    origin: "direct_insight",
    layout: { x, y, width: 160, height: 72, zIndex: 1 },
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

function relationFn() {
  return ws.slice(
    ws.indexOf("const handleStudentConnectionRelationChange"),
    ws.indexOf("const handleManagedConnectionDelete"),
  );
}

function deleteFn() {
  return ws.slice(
    ws.indexOf("const handleManagedConnectionDelete"),
    ws.indexOf("const handleConnectionPointerDown"),
  );
}

test("student relation change keeps identity fields", () => {
  const graph = graphOf(
    [card("a", 40, 40), card("b", 400, 40)],
    [conn("cn_rel", "a", "b", "current")],
  );
  const now = "2026-09-19T12:00:00.000Z";
  const result = changeStudentConnectionRelation({
    graph,
    connectionId: "cn_rel",
    relationType: "potential",
    now,
  });
  assert.equal(result.ok, true);
  if (!result.ok || result.kind !== "changed") {
    assert.fail("expected changed relation");
    return;
  }
  assert.equal(result.after.id, "cn_rel");
  assert.equal(result.after.sourceCardId, "a");
  assert.equal(result.after.targetCardId, "b");
  assert.equal(result.after.origin, "student_diagram");
  assert.equal(result.after.createdAt, "2026-09-19T00:00:00.000Z");
  assert.equal(result.after.relationType, "potential");
  assert.equal(result.after.updatedAt, now);
  assert.equal(result.before.relationType, "current");
  assert.equal(result.before.updatedAt, "2026-09-19T00:00:00.000Z");
});

test("student relation change cycles current/potential/treatment", () => {
  let graph = graphOf(
    [card("a", 40, 40), card("b", 400, 40)],
    [conn("cn_rel", "a", "b", "current")],
  );
  for (const [from, to] of [
    ["current", "potential"],
    ["potential", "treatment"],
    ["treatment", "current"],
  ] as const) {
    const result = changeStudentConnectionRelation({
      graph,
      connectionId: "cn_rel",
      relationType: to,
      now: `2026-09-19T12:00:0${to.length}.000Z`,
    });
    assert.equal(result.ok, true);
    if (!result.ok || result.kind !== "changed") {
      assert.fail(`${from}→${to}`);
      return;
    }
    assert.equal(result.before.relationType, from);
    assert.equal(result.after.relationType, to);
    graph = result.graph;
  }
});

test("same relation tap is NO-OP", () => {
  const graph = graphOf(
    [card("a", 40, 40), card("b", 400, 40)],
    [conn("cn_rel", "a", "b", "current")],
  );
  const result = changeStudentConnectionRelation({
    graph,
    connectionId: "cn_rel",
    relationType: "current",
    now: "2026-09-19T12:00:00.000Z",
  });
  assert.equal(result.ok, true);
  if (!result.ok || result.kind !== "unchanged") {
    assert.fail("expected unchanged relation");
    return;
  }
  assert.equal(result.graph, graph);
  assert.equal(result.connection.updatedAt, "2026-09-19T00:00:00.000Z");
});

test("knowledge / protected relation change is not_editable", () => {
  const graph = graphOf(
    [card("a", 40, 40), card("b", 400, 40)],
    [
      conn("cn_know", "a", "b", "current", "knowledge_library"),
      conn("cn_basis", "a", "b", "nursing_problem_basis"),
      conn(
        "cn_integ",
        "a",
        "b",
        "nursing_problem_integration",
        "system_integration",
      ),
    ],
  );
  for (const id of ["cn_know", "cn_basis", "cn_integ"]) {
    const result = changeStudentConnectionRelation({
      graph,
      connectionId: id,
      relationType: "potential",
      now: "2026-09-19T12:00:00.000Z",
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "not_editable");
  }
});

test("relation change does not touch route geometry", () => {
  const { graph, routeState, topology } = seededFixture();
  const routeBefore = JSON.stringify(routeState);
  const topologyBefore = JSON.stringify(topology);
  const result = changeStudentConnectionRelation({
    graph,
    connectionId: "demo_c_cur",
    relationType: "treatment",
    now: "2026-09-19T12:00:00.000Z",
  });
  assert.equal(result.ok, true);
  if (!result.ok || result.kind !== "changed") {
    assert.fail("expected fixture current to change");
    return;
  }
  const afterRoute = seedStableRouteState(
    result.graph.cards,
    result.graph.connections,
    topology,
  );
  assert.equal(JSON.stringify(afterRoute.byId), JSON.stringify(routeState.byId));
  assert.equal(JSON.stringify(afterRoute.bridges), JSON.stringify(routeState.bridges));
  assert.equal(JSON.stringify(topology), topologyBefore);
  assert.equal(routeBefore, JSON.stringify(routeState));
});

test("relation change only updates renderer stroke style", () => {
  const current = resolveConnectionStrokeVisual("current");
  const potential = resolveConnectionStrokeVisual("potential");
  const treatment = resolveConnectionStrokeVisual("treatment");
  assert.equal(current.dasharray, null);
  assert.equal(potential.dasharray, "5 4");
  assert.ok(treatment.strokeWidthPx > current.strokeWidthPx);
  assert.equal(manageLib.includes("resolveConnectionStrokeVisual"), false);
});

test("1 relation change = 1 history action", () => {
  const graph = graphOf(
    [card("a", 40, 40), card("b", 400, 40)],
    [conn("cn_rel", "a", "b", "current")],
  );
  const result = changeStudentConnectionRelation({
    graph,
    connectionId: "cn_rel",
    relationType: "potential",
    now: "2026-09-19T12:00:00.000Z",
  });
  assert.equal(result.ok && result.kind === "changed", true);
  if (!result.ok || result.kind !== "changed") return;
  const history = pushDiagramHistory(emptyDiagramHistory(), {
    type: "editConnectionRelation",
    before: result.before,
    after: result.after,
  });
  assert.equal(history.past.length, 1);
  assert.equal(history.past[0]?.type, "editConnectionRelation");
});

test("same relation tap adds no history", () => {
  const graph = graphOf(
    [card("a", 40, 40), card("b", 400, 40)],
    [conn("cn_rel", "a", "b", "potential")],
  );
  const result = changeStudentConnectionRelation({
    graph,
    connectionId: "cn_rel",
    relationType: "potential",
    now: "2026-09-19T12:00:00.000Z",
  });
  assert.equal(result.ok && result.kind === "unchanged", true);
  const rel = relationFn();
  assert.ok(rel.includes('result.kind === "unchanged"'));
  assert.ok(rel.includes("return;"));
  const failBranch = rel.slice(
    rel.indexOf('result.kind === "unchanged"'),
    rel.indexOf("setGraph(result.graph)"),
  );
  assert.equal(failBranch.includes("onHistoryPush"), false);
});

test("relation undo/redo restores exact snapshots", () => {
  const graph = graphOf(
    [card("a", 40, 40), card("b", 400, 40)],
    [conn("cn_rel", "a", "b", "current")],
  );
  const result = changeStudentConnectionRelation({
    graph,
    connectionId: "cn_rel",
    relationType: "treatment",
    now: "2026-09-19T12:00:00.000Z",
  });
  assert.equal(result.ok && result.kind === "changed", true);
  if (!result.ok || result.kind !== "changed") return;
  const history = pushDiagramHistory(emptyDiagramHistory(), {
    type: "editConnectionRelation",
    before: result.before,
    after: result.after,
  });
  const undone = undoDiagramHistory(history);
  assert.equal(undone.command.kind, "replaceConnection");
  const afterUndo = applyHistoryCommand(result.graph, undone.command);
  assert.deepEqual(afterUndo.connections.find((row) => row.id === "cn_rel"), result.before);
  const redone = redoDiagramHistory(undone.history);
  const afterRedo = applyHistoryCommand(afterUndo, redone.command);
  assert.deepEqual(afterRedo.connections.find((row) => row.id === "cn_rel"), result.after);
  if (undone.command.kind === "replaceConnection") {
    assert.equal(undone.command.routeState, undefined);
  }
});

test("relation undo does not regenerate updatedAt", () => {
  const graph = graphOf(
    [card("a", 40, 40), card("b", 400, 40)],
    [conn("cn_rel", "a", "b", "current")],
  );
  const result = changeStudentConnectionRelation({
    graph,
    connectionId: "cn_rel",
    relationType: "potential",
    now: "2026-09-19T12:00:00.000Z",
  });
  if (!result.ok || result.kind !== "changed") {
    assert.fail("expected change");
    return;
  }
  const undone = undoDiagramHistory(
    pushDiagramHistory(emptyDiagramHistory(), {
      type: "editConnectionRelation",
      before: result.before,
      after: result.after,
    }),
  );
  const restored = applyHistoryCommand(result.graph, undone.command).connections.find(
    (row) => row.id === "cn_rel",
  );
  assert.equal(restored?.updatedAt, "2026-09-19T00:00:00.000Z");
  assert.equal(historyLib.includes("replaceConnectionExact"), true);
});

test("student delete removes connection + route only", () => {
  const { graph, routeState, topology } = seededFixture();
  const cardCount = graph.cards.length;
  const result = deleteManagedConnection({
    graph,
    routeState,
    topology,
    connectionId: "demo_c_cur",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.graph.connections.some((row) => row.id === "demo_c_cur"), false);
  assert.equal(result.routeState.byId.demo_c_cur, undefined);
  assert.equal(result.routeState.lastValidPoints.demo_c_cur, undefined);
  assert.equal(result.graph.cards.length, cardCount);
  assert.equal(
    remainingRoutesUnchanged(routeState, result.routeState, "demo_c_cur"),
    true,
  );
});

test("knowledge delete is diagram adoption only", () => {
  const { graph, routeState, topology } = seededFixture();
  const cardsBefore = JSON.stringify(graph.cards);
  const knowledgeBefore = JSON.stringify(SCHIZOPHRENIA_KNOWLEDGE_CONNECTIONS);
  const result = deleteManagedConnection({
    graph,
    routeState,
    topology,
    connectionId: "skc1",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.graph.connections.some((row) => row.id === "skc1"), false);
  assert.equal(result.graph.cards.length, graph.cards.length);
  assert.equal(JSON.stringify(result.graph.cards), cardsBefore);
  assert.equal(JSON.stringify(SCHIZOPHRENIA_KNOWLEDGE_CONNECTIONS), knowledgeBefore);
  assert.ok(result.graph.connections.some((row) => row.id === "skc2"));
  assert.equal(manageLib.includes("knowledgeLibraryRepository"), false);
  assert.equal(manageLib.includes("knowledgeGroupLayout"), false);
});

test("protected connections are not deletable", () => {
  const { graph, routeState, topology } = seededFixture();
  for (const id of ["demo_c_basis", "demo_c_integ"]) {
    const result = deleteManagedConnection({
      graph,
      routeState,
      topology,
      connectionId: id,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "not_deletable");
    assert.ok(graph.connections.some((row) => row.id === id));
  }
});

test("delete prunes only bridges that include the deleted id", () => {
  const { graph, routeState, topology } = seededFixture();
  const involved = routeState.bridges.filter(
    (bridge) =>
      bridge.jumperConnectionId === "demo_c_cross_v" ||
      bridge.underConnectionId === "demo_c_cross_v",
  );
  assert.ok(involved.length > 0);
  const unrelatedBefore = routeState.bridges.filter(
    (bridge) =>
      bridge.jumperConnectionId !== "demo_c_cross_v" &&
      bridge.underConnectionId !== "demo_c_cross_v",
  );
  const result = deleteManagedConnection({
    graph,
    routeState,
    topology,
    connectionId: "demo_c_cross_v",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(
    result.routeState.bridges.some(
      (bridge) =>
        bridge.jumperConnectionId === "demo_c_cross_v" ||
        bridge.underConnectionId === "demo_c_cross_v",
    ),
    false,
  );
  assert.deepEqual(
    result.routeState.bridges.map(
      (bridge) =>
        `${bridge.jumperConnectionId}:${bridge.underConnectionId}:${bridge.x}:${bridge.y}:${bridge.jumperAxis}`,
    ),
    unrelatedBefore.map(
      (bridge) =>
        `${bridge.jumperConnectionId}:${bridge.underConnectionId}:${bridge.x}:${bridge.y}:${bridge.jumperAxis}`,
    ),
  );
  assert.equal(
    remainingRoutesUnchanged(routeState, result.routeState, "demo_c_cross_v"),
    true,
  );
});

test("delete prunes topology membership without regenerating other routes", () => {
  const { graph, routeState, topology } = seededFixture();
  assert.ok(topology);
  const beforeSkc13 = topology!.routes.find((row) => row.connectionId === "skc13");
  const beforeBp = topology!.branchPoints.find((row) =>
    row.connectionIds.includes("skc12"),
  );
  const result = deleteManagedConnection({
    graph,
    routeState,
    topology,
    connectionId: "skc12",
  });
  assert.equal(result.ok, true);
  if (!result.ok || !result.topology) {
    assert.fail("expected topology prune");
    return;
  }
  assert.equal(
    result.topology.routes.some((row) => row.connectionId === "skc12"),
    false,
  );
  const afterSkc13 = result.topology.routes.find((row) => row.connectionId === "skc13");
  assert.deepEqual(afterSkc13?.points, beforeSkc13?.points);
  const afterBp = result.topology.branchPoints.find((row) => row.id === beforeBp?.id);
  assert.equal(afterBp?.x, beforeBp?.x);
  assert.equal(afterBp?.y, beforeBp?.y);
  assert.equal(afterBp?.connectionIds.includes("skc12"), false);
  assert.equal(afterBp?.connectionIds.includes("skc13"), true);
});

test("1 delete = 1 history action", () => {
  const { graph, routeState, topology } = seededFixture();
  const result = deleteManagedConnection({
    graph,
    routeState,
    topology,
    connectionId: "demo_c_pot",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const history = pushDiagramHistory(emptyDiagramHistory(), {
    type: "deleteConnection",
    connection: result.connection,
    routeStateBefore: cloneStableRouteState(routeState),
    routeStateAfter: cloneStableRouteState(result.routeState),
    topologyBefore: topology,
    topologyAfter: result.topology,
  });
  assert.equal(history.past.length, 1);
  assert.equal(history.past[0]?.type, "deleteConnection");
});

test("delete undo/redo restores exact connection and routes", () => {
  const { graph, routeState, topology } = seededFixture();
  const result = deleteManagedConnection({
    graph,
    routeState,
    topology,
    connectionId: "demo_c_treat",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const history = pushDiagramHistory(emptyDiagramHistory(), {
    type: "deleteConnection",
    connection: result.connection,
    routeStateBefore: cloneStableRouteState(routeState),
    routeStateAfter: cloneStableRouteState(result.routeState),
    topologyBefore: topology,
    topologyAfter: result.topology,
  });
  const undone = undoDiagramHistory(history);
  assert.equal(undone.command.kind, "replaceConnection");
  const afterUndo = applyHistoryCommand(result.graph, undone.command);
  assert.deepEqual(
    afterUndo.connections.find((row) => row.id === "demo_c_treat"),
    result.connection,
  );
  if (undone.command.kind === "replaceConnection") {
    assert.deepEqual(
      undone.command.routeState?.byId.demo_c_treat?.points,
      routeState.byId.demo_c_treat?.points,
    );
    assert.equal(undone.command.connection.updatedAt, result.connection.updatedAt);
    assert.equal(undone.command.connection.createdAt, result.connection.createdAt);
  }
  const redone = redoDiagramHistory(undone.history);
  const afterRedo = applyHistoryCommand(afterUndo, redone.command);
  assert.equal(
    afterRedo.connections.some((row) => row.id === "demo_c_treat"),
    false,
  );
  if (redone.command.kind === "removeConnection") {
    assert.equal(redone.command.routeState?.byId.demo_c_treat, undefined);
  } else {
    assert.fail(redone.command.kind);
  }
});

test("workspace keeps selection after relation change", () => {
  const rel = relationFn();
  assert.ok(rel.includes("setGraph(result.graph)"));
  assert.ok(rel.includes('type: "editConnectionRelation"'));
  assert.equal(rel.includes("clearConnectionSelection"), false);
  assert.equal(rel.includes("setRouteState"), false);
  assert.equal(rel.includes("setTopology"), false);
  assert.equal(rel.includes("planOrthogonal"), false);
});

test("workspace clears selection after delete", () => {
  const del = deleteFn();
  assert.ok(del.includes("deleteManagedConnection"));
  assert.ok(del.includes('type: "deleteConnection"'));
  assert.ok(del.includes("clearConnectionSelection"));
  assert.ok(del.includes("setRouteState(result.routeState)"));
  assert.equal(del.includes("planOrthogonal"), false);
  assert.equal(del.includes("classifyRouteInteractions"), false);
});

test("protected delete callback stays disconnected", () => {
  const open = ws.slice(
    ws.indexOf("<RelatedDiagramConnectionActionBar"),
    ws.indexOf("</RelatedDiagramConnectionActionBar>"),
  );
  assert.ok(open.includes("connectionPermissions(selectedConnection).deletable"));
  assert.ok(open.includes("handleManagedConnectionDelete"));
  assert.ok(open.includes(": undefined"));
  assert.ok(open.includes("onReverse"));
  assert.ok(open.includes("connectionPermissions(selectedConnection).reversible"));
});

test("reverse stays permission-gated", () => {
  assert.ok(ws.includes("handleStudentConnectionReverse"));
  assert.ok(actionBar.includes("向きを反転"));
  assert.ok(actionBar.includes("permissions.reversible"));
});

test("2E-1 forbidden names stay unused", () => {
  assert.equal(ws.includes("handleEditConnection"), false);
  assert.equal(ws.includes("handleDeleteConnection"), false);
  assert.equal(ws.includes("upsertConnection("), false);
});

test("manage does not reroute or reclassify bridges", () => {
  assert.equal(manageLib.includes("planOrthogonalRoutes"), false);
  assert.equal(manageLib.includes("findRectilinearPath"), false);
  assert.equal(manageLib.includes("classifyRouteInteractions"), false);
  assert.equal(manageLib.includes("applyIncremental"), false);
  assert.ok(manageLib.includes("pruneStableRoutesForConnections"));
  assert.ok(manageLib.includes("pruneTopologyForConnections"));
  assert.ok(manageLib.includes("deleteConnection"));
});

test("replaceConnectionExact does not rewrite timestamps", () => {
  const graph = graphOf(
    [card("a", 40, 40), card("b", 400, 40)],
    [conn("cn_rel", "a", "b", "current")],
  );
  const snapshot = cloneConnection({
    ...graph.connections[0]!,
    relationType: "potential",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
  const next = replaceConnectionExact(graph, snapshot);
  assert.deepEqual(next.connections[0], snapshot);
});

test("permissions stay 2G-1 contract", () => {
  assert.deepEqual(connectionPermissions(conn("s", "a", "b", "current")), {
    selectable: true,
    relationEditable: true,
    reversible: true,
    deletable: true,
  });
  assert.deepEqual(
    connectionPermissions(conn("k", "a", "b", "current", "knowledge_library")),
    {
      selectable: true,
      relationEditable: false,
      reversible: false,
      deletable: true,
    },
  );
  assert.deepEqual(
    connectionPermissions(conn("b", "a", "b", "nursing_problem_basis")),
    {
      selectable: true,
      relationEditable: false,
      reversible: false,
      deletable: false,
    },
  );
});

console.log(`\n${passed} passed`);
