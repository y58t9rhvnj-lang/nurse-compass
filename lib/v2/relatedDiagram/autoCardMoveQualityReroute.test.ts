/**
 * Slice B — AUTO card-move pointerup quality reroute.
 * Run: ./node_modules/.bin/jiti lib/v2/relatedDiagram/autoCardMoveQualityReroute.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import {
  applyStudentAutoQualityReroute,
  isStudentAutoQualityRerouteTarget,
} from "./autoCardMoveQualityReroute";
import { applyCardPositionToGraph } from "./cardInteractionState";
import {
  commitStudentConnectionCreate,
} from "./cardConnectionCreate";
import { deleteManagedConnection } from "./cardConnectionManage";
import { countPolylineCardHits } from "./diagramLayoutL2";
import {
  captureSceneFragment,
  emptyDiagramHistory,
  pushDiagramHistory,
  redoDiagramHistory,
  undoDiagramHistory,
  applySceneFragmentToGraph,
} from "./diagramHistory";
import {
  firstSegmentFacesEdge,
  lastSegmentFacesEdge,
} from "./geometryGuard";
import { applyLightweightCardDrop } from "./lightweightCardDrop";
import { commitManualRouteEdit } from "./manualRouteEdit";
import {
  cloneStableRouteState,
  pointsDeepEqual,
  type StableRouteState,
  type StoredRouteGeometry,
} from "./incrementalRoutes";
import { isOrthogonalPolyline, type Point } from "./orthogonalRouting";
import {
  emptyRouteTopology,
  isStudentManualRoute,
  type RelatedDiagramRouteTopology,
} from "./routeTopology";
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
    createdAt: "2026-09-23T00:00:00.000Z",
    updatedAt: "2026-09-23T00:00:00.000Z",
  };
}

function conn(
  id: string,
  sourceCardId: string,
  targetCardId: string,
  origin: RelatedDiagramConnection["origin"] = "student_diagram",
): RelatedDiagramConnection {
  return {
    id,
    sourceCardId,
    targetCardId,
    relationType: "current",
    origin,
    createdAt: "2026-09-23T00:00:00.000Z",
    updatedAt: "2026-09-23T00:00:00.000Z",
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

function emptyState(): StableRouteState {
  return {
    byId: {},
    lastValidPoints: {},
    invalidReasons: {},
    bridges: [],
    qualityTrace: {},
  };
}

function geometryOf(stored: StoredRouteGeometry) {
  const points = stored.points;
  const first = points[0]!;
  const second = points[1]!;
  const last = points[points.length - 1]!;
  const prev = points[points.length - 2]!;
  return {
    sourceEdge: stored.sourceEdge,
    targetEdge: stored.targetEdge,
    sourcePin: { ...stored.sourcePin },
    targetPin: { ...stored.targetPin },
    firstTangent: { dx: second.x - first.x, dy: second.y - first.y },
    lastTangent: { dx: last.x - prev.x, dy: last.y - prev.y },
    orthogonal: isOrthogonalPolyline(points),
    points: points.map((point) => ({ ...point })),
  };
}

function near(a: Point, b: Point, eps = 0.51): boolean {
  return Math.abs(a.x - b.x) <= eps && Math.abs(a.y - b.y) <= eps;
}

function pinSetKey(pin: Point): string {
  return `${Math.round(pin.x)}:${Math.round(pin.y)}`;
}

const decideSrc = src("./cardConnectionCreate.ts");
const dropSrc = src("./lightweightCardDrop.ts");
const helperSrc = src("./autoCardMoveQualityReroute.ts");
const hookSrc = src("../../../components/v2/relatedDiagram/useCardInteraction.ts");
const transientSrc = src("./cardDragTransient.ts");

test("SliceB-0 decideStudentConnectionRoute本体とdrag経路は未変更", () => {
  assert.equal(helperSrc.includes("decideStudentConnectionRoute"), true);
  assert.equal(helperSrc.includes("upsertManualRoute"), false);
  assert.equal(dropSrc.includes("applyStudentAutoQualityReroute"), true);
  assert.equal(transientSrc.includes("decideStudentConnectionRoute"), false);
  assert.equal(hookSrc.includes("decideStudentConnectionRoute"), false);
  assert.equal(decideSrc.includes("export function decideStudentConnectionRoute"), true);
});

test("SliceB-1 AUTO判定 / MANUAL / Junction / Knowledge 除外", () => {
  const student = conn("cn_ab", "a", "b");
  const knowledge = conn("cn_k", "a", "b", "knowledge_library");
  const form3 = conn("cn_f", "a", "b", "system_integration");
  const topologyManual: RelatedDiagramRouteTopology = {
    ...emptyRouteTopology(),
    routes: [
      {
        connectionId: "cn_ab",
        sourceEdge: "right",
        targetEdge: "left",
        points: [
          { x: 240, y: 236 },
          { x: 520, y: 236 },
        ],
      },
    ],
  };
  const topologyJunction: RelatedDiagramRouteTopology = {
    ...emptyRouteTopology(),
    branchPoints: [{ id: "bp", x: 400, y: 200, connectionIds: ["cn_ab"] }],
    routeGroups: [
      {
        id: "rg",
        sourceCardId: "a",
        trunkId: "tr",
        connectionIds: ["cn_ab"],
      },
    ],
  };
  assert.equal(isStudentAutoQualityRerouteTarget(emptyRouteTopology(), student), true);
  assert.equal(isStudentManualRoute(topologyManual, student), true);
  assert.equal(isStudentAutoQualityRerouteTarget(topologyManual, student), false);
  assert.equal(isStudentAutoQualityRerouteTarget(topologyJunction, student), false);
  assert.equal(isStudentAutoQualityRerouteTarget(emptyRouteTopology(), knowledge), false);
  assert.equal(isStudentAutoQualityRerouteTarget(emptyRouteTopology(), form3), false);
});

test("SliceB-2 C vs 再接続F geometry同等 + identity維持", () => {
  const cards = [card("a", 80, 200), card("b", 520, 200)];
  const created = commitStudentConnectionCreate({
    graph: graphOf(cards, []),
    routeState: emptyState(),
    topology: emptyRouteTopology(),
    sourceCardId: "a",
    targetCardId: "b",
    relationType: "current",
    connectionId: "cn_ab",
    now: "2026-09-23T00:00:00.000Z",
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const movedGraph = applyCardPositionToGraph(created.graph, "b", 520, 80);
  const dropped = applyLightweightCardDrop({
    previous: created.routeState,
    cards: movedGraph.cards,
    connections: movedGraph.connections,
    topology: created.topology,
    movedCardId: "b",
  });
  const afterMove = dropped.state.byId.cn_ab!;
  assert.ok(afterMove);
  assert.equal(dropped.stats.qualityRerouteCount, 1);
  assert.equal(dropped.stats.qualityPlannerCalls, 1);
  assert.equal(
    movedGraph.connections.find((row) => row.id === "cn_ab")?.origin,
    "student_diagram",
  );
  assert.equal(afterMove.connectionId, "cn_ab");
  assert.equal(afterMove.sourceCardId, "a");
  assert.equal(afterMove.targetCardId, "b");
  assert.equal(
    movedGraph.connections.find((row) => row.id === "cn_ab")?.relationType,
    "current",
  );
  assert.equal(
    (dropped.topology ?? created.topology)?.routes.some(
      (row) => row.connectionId === "cn_ab",
    ),
    false,
  );

  const deleted = deleteManagedConnection({
    graph: movedGraph,
    routeState: dropped.state,
    topology: dropped.topology ?? created.topology,
    connectionId: "cn_ab",
  });
  assert.equal(deleted.ok, true);
  if (!deleted.ok) return;
  const reconnected = commitStudentConnectionCreate({
    graph: deleted.graph,
    routeState: deleted.routeState,
    topology: deleted.topology,
    sourceCardId: "a",
    targetCardId: "b",
    relationType: "current",
    connectionId: "cn_ab_re",
    now: "2026-09-23T00:00:01.000Z",
  });
  assert.equal(reconnected.ok, true);
  if (!reconnected.ok) return;
  const fresh = reconnected.routeState.byId.cn_ab_re!;
  const c = geometryOf(afterMove);
  const f = geometryOf(fresh);
  assert.equal(c.sourceEdge, f.sourceEdge);
  assert.equal(c.targetEdge, f.targetEdge);
  assert.equal(near(c.sourcePin, f.sourcePin), true);
  assert.equal(near(c.targetPin, f.targetPin), true);
  assert.deepEqual(c.firstTangent, f.firstTangent);
  assert.deepEqual(c.lastTangent, f.lastTangent);
  assert.equal(c.orthogonal, true);
  assert.equal(f.orthogonal, true);
  assert.equal(pointsDeepEqual(c.points, f.points), true);
  assert.equal(
    firstSegmentFacesEdge(c.points, c.sourceEdge),
    firstSegmentFacesEdge(f.points, f.sourceEdge),
  );
  assert.equal(
    lastSegmentFacesEdge(c.points, c.targetEdge),
    lastSegmentFacesEdge(f.points, f.targetEdge),
  );
  const ignore = new Set(["a", "b"]);
  const rects = movedGraph.cards.map((row) => ({ id: row.id, ...row.layout }));
  assert.equal(
    countPolylineCardHits(c.points, rects, ignore),
    countPolylineCardHits(f.points, rects, ignore),
  );
});

test("SliceB-3 大きく反対側へ移動してもedgeが再評価される", () => {
  const cards = [card("a", 80, 200), card("b", 520, 200)];
  const created = commitStudentConnectionCreate({
    graph: graphOf(cards, []),
    routeState: emptyState(),
    topology: emptyRouteTopology(),
    sourceCardId: "a",
    targetCardId: "b",
    relationType: "current",
    connectionId: "cn_ab",
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const before = created.routeState.byId.cn_ab!;
  const movedGraph = applyCardPositionToGraph(created.graph, "b", 80, 520);
  const dropped = applyLightweightCardDrop({
    previous: created.routeState,
    cards: movedGraph.cards,
    connections: movedGraph.connections,
    topology: created.topology,
    movedCardId: "b",
  });
  const after = dropped.state.byId.cn_ab!;
  assert.equal(isOrthogonalPolyline(after.points), true);
  assert.equal(firstSegmentFacesEdge(after.points, after.sourceEdge), true);
  assert.equal(lastSegmentFacesEdge(after.points, after.targetEdge), true);
  assert.equal(
    after.sourceEdge === before.sourceEdge && after.targetEdge === before.targetEdge,
    false,
  );
});

test("SliceB-4 同一source 3本のpinはmidpointへ潰れない", () => {
  let graph = graphOf(
    [card("a", 80, 240), card("b", 520, 80), card("c", 520, 240), card("d", 520, 400)],
    [],
  );
  let routeState = emptyState();
  let topology: RelatedDiagramRouteTopology | undefined = emptyRouteTopology();
  for (const [id, target] of [
    ["cn_ab", "b"],
    ["cn_ac", "c"],
    ["cn_ad", "d"],
  ] as const) {
    const created = commitStudentConnectionCreate({
      graph,
      routeState,
      topology,
      sourceCardId: "a",
      targetCardId: target,
      relationType: "current",
      connectionId: id,
    });
    assert.equal(created.ok, true, id);
    if (!created.ok) return;
    graph = created.graph;
    routeState = created.routeState;
    topology = created.topology;
  }
  const movedGraph = applyCardPositionToGraph(graph, "a", 40, 240);
  const dropped = applyLightweightCardDrop({
    previous: routeState,
    cards: movedGraph.cards,
    connections: movedGraph.connections,
    topology,
    movedCardId: "a",
  });
  assert.equal(dropped.stats.qualityRerouteCount, 3);
  const ids = ["cn_ab", "cn_ac", "cn_ad"] as const;
  const pins = ids.map((id) => dropped.state.byId[id]!.sourcePin);
  const unique = new Set(pins.map(pinSetKey));
  assert.ok(unique.size >= 2, `pins=${JSON.stringify(pins)}`);
  for (const id of ids) {
    const stored = dropped.state.byId[id]!;
    assert.equal(isOrthogonalPolyline(stored.points), true, id);
    assert.equal(firstSegmentFacesEdge(stored.points, stored.sourceEdge), true, id);
    assert.equal(lastSegmentFacesEdge(stored.points, stored.targetEdge), true, id);
    assert.equal(stored.connectionId, id);
  }
  assert.equal(
    (dropped.topology ?? topology)?.routes.length ?? 0,
    0,
  );
});

test("SliceB-5 MANUALはquality rerouteされない", () => {
  const cards = [card("a", 80, 200), card("b", 520, 200)];
  const created = commitStudentConnectionCreate({
    graph: graphOf(cards, []),
    routeState: emptyState(),
    topology: emptyRouteTopology(),
    sourceCardId: "a",
    targetCardId: "b",
    relationType: "current",
    connectionId: "cn_ab",
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const authored = commitManualRouteEdit({
    connection: created.connection,
    routeState: created.routeState,
    topology: created.topology,
    points: [
      { x: 240, y: 236 },
      { x: 360, y: 236 },
      { x: 360, y: 140 },
      { x: 520, y: 140 },
      { x: 520, y: 236 },
    ],
  });
  assert.equal(isStudentManualRoute(authored.topology, created.connection), true);
  const beforePoints = authored.routeState.byId.cn_ab!.points.map((p) => ({ ...p }));
  const movedGraph = applyCardPositionToGraph(created.graph, "b", 520, 80);
  const dropped = applyLightweightCardDrop({
    previous: authored.routeState,
    cards: movedGraph.cards,
    connections: movedGraph.connections,
    topology: authored.topology,
    movedCardId: "b",
  });
  assert.equal(dropped.stats.qualityRerouteCount, 0);
  assert.equal(dropped.stats.qualityPlannerCalls, 0);
  assert.equal(dropped.stats.manualCount, 1);
  assert.equal(isStudentManualRoute(dropped.topology, created.connection), true);
  assert.equal(
    dropped.state.byId.cn_ab!.points.some(
      (point) => point.x === 360 && point.y === 140,
    ),
    true,
  );
  assert.equal(beforePoints.some((point) => point.x === 360 && point.y === 140), true);
});

test("SliceB-6 Junction所有はquality rerouteされない", () => {
  const cards = [card("a", 80, 200), card("b", 520, 200), card("c", 520, 400)];
  const connections = [conn("cn_ab", "a", "b"), conn("cn_ac", "a", "c")];
  const pointsAb = [
    { x: 240, y: 236 },
    { x: 400, y: 236 },
    { x: 400, y: 236 },
    { x: 520, y: 236 },
  ];
  const pointsAc = [
    { x: 240, y: 236 },
    { x: 400, y: 236 },
    { x: 400, y: 436 },
    { x: 520, y: 436 },
  ];
  const topology: RelatedDiagramRouteTopology = {
    ...emptyRouteTopology(),
    branchPoints: [{ id: "bp", x: 400, y: 236, connectionIds: ["cn_ab", "cn_ac"] }],
    trunks: [
      {
        id: "tr",
        branchPointId: "bp",
        connectionIds: ["cn_ab", "cn_ac"],
        points: [
          { x: 400, y: 236 },
          { x: 400, y: 236 },
        ],
      },
    ],
    routeGroups: [
      {
        id: "rg",
        sourceCardId: "a",
        trunkId: "tr",
        connectionIds: ["cn_ab", "cn_ac"],
      },
    ],
    routes: [
      { connectionId: "cn_ab", sourceEdge: "right", targetEdge: "left", points: pointsAb },
      { connectionId: "cn_ac", sourceEdge: "right", targetEdge: "left", points: pointsAc },
    ],
  };
  const graph = graphOf(cards, connections);
  const routeState = {
    byId: {
      cn_ab: {
        connectionId: "cn_ab",
        sourceCardId: "a",
        targetCardId: "b",
        sourceEdge: "right" as const,
        targetEdge: "left" as const,
        sourcePin: { ...pointsAb[0]! },
        targetPin: { ...pointsAb[pointsAb.length - 1]! },
        points: pointsAb.map((point) => ({ ...point })),
      },
      cn_ac: {
        connectionId: "cn_ac",
        sourceCardId: "a",
        targetCardId: "c",
        sourceEdge: "right" as const,
        targetEdge: "left" as const,
        sourcePin: { ...pointsAc[0]! },
        targetPin: { ...pointsAc[pointsAc.length - 1]! },
        points: pointsAc.map((point) => ({ ...point })),
      },
    },
    lastValidPoints: {
      cn_ab: pointsAb.map((point) => ({ ...point })),
      cn_ac: pointsAc.map((point) => ({ ...point })),
    },
    invalidReasons: {},
    bridges: [],
    qualityTrace: {},
  };
  assert.equal(isStudentAutoQualityRerouteTarget(topology, connections[0]!), false);
  const next = applyCardPositionToGraph(graph, "a", 40, 216);
  const dropped = applyLightweightCardDrop({
    previous: routeState,
    cards: next.cards,
    connections: next.connections,
    topology,
    movedCardId: "a",
  });
  assert.equal(dropped.stats.qualityRerouteCount, 0);
  assert.equal(dropped.stats.qualityPlannerCalls, 0);
  assert.equal(dropped.stats.junctionCount, 2);
  assert.equal(dropped.topology!.branchPoints, topology.branchPoints);
  assert.equal(dropped.topology!.trunks, topology.trunks);
});

test("SliceB-7 history moveCard 1件 + Undo/Redo exact", () => {
  const cards = [card("a", 80, 200), card("b", 520, 200)];
  const created = commitStudentConnectionCreate({
    graph: graphOf(cards, []),
    routeState: emptyState(),
    topology: emptyRouteTopology(),
    sourceCardId: "a",
    targetCardId: "b",
    relationType: "current",
    connectionId: "cn_ab",
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const movedGraph = applyCardPositionToGraph(created.graph, "b", 520, 80);
  const dropped = applyLightweightCardDrop({
    previous: created.routeState,
    cards: movedGraph.cards,
    connections: movedGraph.connections,
    topology: created.topology,
    movedCardId: "b",
  });
  const before = captureSceneFragment({
    cards: created.graph.cards,
    cardIds: ["b"],
    routeState: created.routeState,
    topology: created.topology,
  });
  const after = captureSceneFragment({
    cards: movedGraph.cards,
    cardIds: ["b"],
    routeState: dropped.state,
    topology: dropped.topology ?? created.topology,
  });
  let history = emptyDiagramHistory();
  history = pushDiagramHistory(history, {
    type: "moveCard",
    cardIds: ["b"],
    before,
    after,
  });
  assert.equal(history.past.length, 1);
  assert.equal(history.past[0]!.type, "moveCard");
  const undone = undoDiagramHistory(history);
  assert.equal(undone.command.kind, "applyFragment");
  if (undone.command.kind !== "applyFragment") return;
  assert.deepEqual(undone.command.fragment.routeState.byId.cn_ab, created.routeState.byId.cn_ab);
  assert.deepEqual(undone.command.fragment.cards, [{ id: "b", x: 520, y: 200 }]);
  const restoredGraph = applySceneFragmentToGraph(movedGraph, undone.command.fragment);
  assert.equal(restoredGraph.cards.find((row) => row.id === "b")?.layout.y, 200);
  const redone = redoDiagramHistory(undone.history);
  assert.equal(redone.command.kind, "applyFragment");
  if (redone.command.kind !== "applyFragment") return;
  assert.deepEqual(redone.command.fragment.routeState.byId.cn_ab, dropped.state.byId.cn_ab);
  assert.deepEqual(redone.command.fragment.cards, [{ id: "b", x: 520, y: 80 }]);
});

test("SliceB-8 drag中helperはqualityを呼ばない / pointerupだけ", () => {
  assert.equal(transientSrc.includes("applyStudentAutoQualityReroute"), false);
  assert.equal(hookSrc.includes("applyLightweightCardDrop"), true);
  assert.ok(hookSrc.includes("finalizeDrop"));
});

test("SliceB-9 performance 1本 / 3本 / 密なcard", () => {
  const oneCards = [card("a", 80, 200), card("b", 520, 200)];
  const oneCreated = commitStudentConnectionCreate({
    graph: graphOf(oneCards, []),
    routeState: emptyState(),
    topology: emptyRouteTopology(),
    sourceCardId: "a",
    targetCardId: "b",
    relationType: "current",
    connectionId: "cn_ab",
  });
  assert.equal(oneCreated.ok, true);
  if (!oneCreated.ok) return;
  const oneMoved = applyCardPositionToGraph(oneCreated.graph, "b", 520, 120);
  const t1 = performance.now();
  const oneDrop = applyLightweightCardDrop({
    previous: oneCreated.routeState,
    cards: oneMoved.cards,
    connections: oneMoved.connections,
    topology: oneCreated.topology,
    movedCardId: "b",
  });
  const oneWall = performance.now() - t1;

  let graph = graphOf(
    [card("a", 80, 240), card("b", 520, 80), card("c", 520, 240), card("d", 520, 400)],
    [],
  );
  let routeState = emptyState();
  let topology: RelatedDiagramRouteTopology | undefined = emptyRouteTopology();
  for (const [id, target] of [
    ["cn_ab", "b"],
    ["cn_ac", "c"],
    ["cn_ad", "d"],
  ] as const) {
    const created = commitStudentConnectionCreate({
      graph,
      routeState,
      topology,
      sourceCardId: "a",
      targetCardId: target,
      relationType: "current",
      connectionId: id,
    });
    assert.equal(created.ok, true, id);
    if (!created.ok) return;
    graph = created.graph;
    routeState = created.routeState;
    topology = created.topology;
  }
  const threeMoved = applyCardPositionToGraph(graph, "a", 48, 248);
  const t3 = performance.now();
  const threeDrop = applyLightweightCardDrop({
    previous: routeState,
    cards: threeMoved.cards,
    connections: threeMoved.connections,
    topology,
    movedCardId: "a",
  });
  const threeWall = performance.now() - t3;

  const denseCards = [
    card("src", 80, 280),
    card("t0", 560, 40),
    card("t1", 560, 160),
    card("t2", 560, 280),
    card("t3", 560, 400),
    card("t4", 560, 520),
    card("t5", 300, 520),
  ];
  let denseGraph = graphOf(denseCards, []);
  let denseState = emptyState();
  let denseTopo: RelatedDiagramRouteTopology | undefined = emptyRouteTopology();
  for (const target of ["t0", "t1", "t2", "t3", "t4", "t5"] as const) {
    const created = commitStudentConnectionCreate({
      graph: denseGraph,
      routeState: denseState,
      topology: denseTopo,
      sourceCardId: "src",
      targetCardId: target,
      relationType: "current",
      connectionId: `cn_src_${target}`,
    });
    assert.equal(created.ok, true, target);
    if (!created.ok) return;
    denseGraph = created.graph;
    denseState = created.routeState;
    denseTopo = created.topology;
  }
  const busyMoved = applyCardPositionToGraph(denseGraph, "src", 48, 300);
  const tBusy = performance.now();
  const busyDrop = applyLightweightCardDrop({
    previous: denseState,
    cards: busyMoved.cards,
    connections: busyMoved.connections,
    topology: denseTopo,
    movedCardId: "src",
  });
  const busyWall = performance.now() - tBusy;

  console.log(
    JSON.stringify(
      {
        one: {
          totalMs: +oneDrop.stats.totalMs.toFixed(2),
          wallMs: +oneWall.toFixed(2),
          planner: oneDrop.stats.qualityPlannerCalls,
          pathfind: oneDrop.stats.pathfindCalls,
          perConnection: oneDrop.stats.connectionMs,
        },
        three: {
          totalMs: +threeDrop.stats.totalMs.toFixed(2),
          wallMs: +threeWall.toFixed(2),
          planner: threeDrop.stats.qualityPlannerCalls,
          pathfind: threeDrop.stats.pathfindCalls,
          perConnection: threeDrop.stats.connectionMs,
        },
        dense: {
          cardId: "src",
          incidents: 6,
          totalMs: +busyDrop.stats.totalMs.toFixed(2),
          wallMs: +busyWall.toFixed(2),
          planner: busyDrop.stats.qualityPlannerCalls,
          pathfind: busyDrop.stats.pathfindCalls,
          qualityReroute: busyDrop.stats.qualityRerouteCount,
          perConnection: busyDrop.stats.connectionMs,
        },
      },
      null,
      2,
    ),
  );
  assert.equal(oneDrop.stats.qualityPlannerCalls, 1);
  assert.equal(threeDrop.stats.qualityPlannerCalls, 3);
});

test("SliceB-10 clone helperは他connectionを壊さない", () => {
  const cards = [card("a", 80, 200), card("b", 520, 200), card("c", 80, 480)];
  let graph = graphOf(cards, []);
  let routeState = emptyState();
  const first = commitStudentConnectionCreate({
    graph,
    routeState,
    topology: emptyRouteTopology(),
    sourceCardId: "a",
    targetCardId: "b",
    relationType: "current",
    connectionId: "cn_ab",
  });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const second = commitStudentConnectionCreate({
    graph: first.graph,
    routeState: first.routeState,
    topology: first.topology,
    sourceCardId: "a",
    targetCardId: "c",
    relationType: "current",
    connectionId: "cn_ac",
  });
  assert.equal(second.ok, true);
  if (!second.ok) return;
  const untouched = cloneStableRouteState(second.routeState);
  const quality = applyStudentAutoQualityReroute({
    cards: applyCardPositionToGraph(second.graph, "b", 560, 80).cards,
    connections: second.graph.connections,
    topology: second.topology,
    routeState: second.routeState,
    connectionIds: ["cn_ab"],
  });
  assert.equal(quality.reroutedIds[0], "cn_ab");
  assert.deepEqual(quality.routeState.byId.cn_ac, untouched.byId.cn_ac);
});

console.log(`\n${passed} passed`);
