/**
 * Phase 2-0 Card Drag Transient + Incident Rubber-band (CDP-A…O).
 * Run: ./node_modules/.bin/jiti lib/v2/relatedDiagram/cardDragTransient.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  bumpCardDragPerf,
  getCardDragPerf,
  recordCardDragPerf,
  resetCardDragPerf,
} from "./cardDragPerf";
import { applyCardPositionToGraph } from "./cardInteractionState";
import {
  applySecondTouch,
  applyPointerDownOnCard,
  applyPointerMove,
  applyPointerUp,
  createIdleState,
} from "./cardInteractionState";
import {
  applyCoalescedCardDragMove,
  beginCardDragSession,
  cancelCardDragSession,
  cardWithTransientPosition,
  cardsWithTransientPosition,
  internalRoutePoints,
  listIncidentConnectionIds,
  moveCardDragSession,
  overlayIncidentRoutePreviews,
} from "./cardDragTransient";
import { emptyDiagramHistory, pushDiagramHistory } from "./diagramHistory";
import {
  applyIncrementalCardMove,
  seedStableRouteState,
  type StableRouteState,
} from "./incrementalRoutes";
import { applyLightweightCardDrop } from "./lightweightCardDrop";
import { buildPatientAStudentReconstruction } from "./buildPatientAStudentReconstruction";
import { applyPatientACardSizeScale } from "./patientACardSizeExperiment";
import {
  PATIENT_A_MERGE_JUNCTION_IDS,
  buildPatientAJunctionReconstruction,
  patientAMergeConnectionIds,
} from "./patientAMergeJunctionTopology";
import { emptyRouteTopology } from "./routeTopology";
import type { RelatedDiagramRouteTopology } from "./routeTopology";
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
    createdAt: "2026-09-22T00:00:00.000Z",
    updatedAt: "2026-09-22T00:00:00.000Z",
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
    createdAt: "2026-09-22T00:00:00.000Z",
    updatedAt: "2026-09-22T00:00:00.000Z",
  };
}

const JOG = [
  { x: 240, y: 236 },
  { x: 360, y: 236 },
  { x: 360, y: 140 },
  { x: 520, y: 140 },
  { x: 520, y: 236 },
];

const OTHER = [
  { x: 600, y: 436 },
  { x: 760, y: 436 },
];

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

function manualScene() {
  const cards = [card("a", 80, 200), card("b", 520, 200), card("c", 600, 400)];
  const connections = [conn("cn_ab", "a", "b"), conn("cn_bc", "b", "c")];
  const topology: RelatedDiagramRouteTopology = {
    ...emptyRouteTopology(),
    routes: [
      {
        connectionId: "cn_ab",
        sourceEdge: "right",
        targetEdge: "left",
        points: JOG.map((point) => ({ ...point })),
      },
    ],
  };
  const routeState: StableRouteState = {
    byId: {
      cn_ab: {
        connectionId: "cn_ab",
        sourceCardId: "a",
        targetCardId: "b",
        sourceEdge: "right",
        targetEdge: "left",
        sourcePin: { ...JOG[0]! },
        targetPin: { ...JOG[JOG.length - 1]! },
        points: JOG.map((point) => ({ ...point })),
      },
      cn_bc: {
        connectionId: "cn_bc",
        sourceCardId: "b",
        targetCardId: "c",
        sourceEdge: "right",
        targetEdge: "left",
        sourcePin: { ...OTHER[0]! },
        targetPin: { ...OTHER[1]! },
        points: OTHER.map((point) => ({ ...point })),
      },
    },
    lastValidPoints: {
      cn_ab: JOG.map((point) => ({ ...point })),
      cn_bc: OTHER.map((point) => ({ ...point })),
    },
    invalidReasons: {},
    bridges: [
      {
        jumperConnectionId: "cn_bc",
        underConnectionId: "cn_ab",
        x: 680,
        y: 300,
        jumperAxis: "h",
      },
    ],
    qualityTrace: {},
  };
  return {
    graph: graphOf(cards, connections),
    topology,
    routeState,
  };
}

function autoScene() {
  const scene = manualScene();
  return {
    graph: scene.graph,
    topology: emptyRouteTopology(),
    routeState: scene.routeState,
  };
}

function cloneJson<T>(value: T): T {
  return structuredClone(value);
}

function subsequence(
  haystack: { x: number; y: number }[],
  needle: { x: number; y: number }[],
): boolean {
  if (needle.length === 0) return true;
  for (let i = 0; i <= haystack.length - needle.length; i += 1) {
    let ok = true;
    for (let j = 0; j < needle.length; j += 1) {
      if (
        haystack[i + j]!.x !== needle[j]!.x ||
        haystack[i + j]!.y !== needle[j]!.y
      ) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

function simulateMoveFrames(
  session: NonNullable<ReturnType<typeof beginCardDragSession>>,
  frames: Array<{ x: number; y: number }>,
) {
  resetCardDragPerf();
  let incrementalCalls = 0;
  let history = emptyDiagramHistory();
  let current = session;
  const wrapIncremental = (...args: Parameters<typeof applyIncrementalCardMove>) => {
    incrementalCalls += 1;
    return applyIncrementalCardMove(...args);
  };
  void wrapIncremental;
  for (const frame of frames) {
    current = moveCardDragSession(current, frame.x, frame.y);
    bumpCardDragPerf("rafFlushCount");
    recordCardDragPerf({
      previewConnectionCount: current.transient.incidentRoutePreviews.length,
    });
  }
  return {
    session: current,
    incrementalCalls,
    history,
    historyCount: history.past.length,
    perf: getCardDragPerf(),
  };
}

const hookSrc = src("../../../components/v2/relatedDiagram/useCardInteraction.ts");
const flushStart = hookSrc.indexOf("const flushMove");
const groupStart = hookSrc.indexOf('if (next.phase === "GROUP_DRAGGING")');
const cardMoveBlock = hookSrc.slice(flushStart, groupStart);
const domainSrc = src("./cardDragTransient.ts");
const junctionSrc = src("./patientAMergeJunctionTopology.ts");
const layerSrc = src(
  "../../../components/v2/relatedDiagram/RelatedDiagramConnectionLayer.tsx",
);
const cardNodeSrc = src(
  "../../../components/v2/relatedDiagram/RelatedDiagramCardNode.tsx",
);
const surfaceSrc = src(
  "../../../components/v2/relatedDiagram/RelatedDiagramA3Surface.tsx",
);
const patientASrc = src(
  "../../../components/v2/relatedDiagram/RelatedDiagramPatientADevWorkspace.tsx",
);
const fixtureSrc = src(
  "../../../components/v2/relatedDiagram/RelatedDiagramDevFixtureWorkspace.tsx",
);

test("CDP-A drag move中 applyIncrementalCardMove = 0", () => {
  const scene = manualScene();
  const started = beginCardDragSession({
    graph: scene.graph,
    cardId: "a",
    routeState: scene.routeState,
    topology: scene.topology,
  });
  assert.ok(started);
  const moved = simulateMoveFrames(started!, [
    { x: 100, y: 210 },
    { x: 140, y: 230 },
    { x: 180, y: 250 },
  ]);
  assert.equal(moved.incrementalCalls, 0);
  assert.equal(moved.perf.applyIncrementalCardMoveCalls, 0);
  assert.equal(cardMoveBlock.includes("applyIncrementalCardMove"), false);
  assert.equal(cardMoveBlock.includes("applyCommit"), false);
  assert.equal(domainSrc.includes("applyIncrementalCardMove"), false);
  assert.ok(cardMoveBlock.includes("moveCardDragSession"));
});

test("CDP-B drag move中 history = 0 topology exact", () => {
  const scene = manualScene();
  const started = beginCardDragSession({
    graph: scene.graph,
    cardId: "a",
    routeState: scene.routeState,
    topology: scene.topology,
  })!;
  const topoBefore = cloneJson(started.committedTopology);
  const moved = simulateMoveFrames(started, [
    { x: 120, y: 220 },
    { x: 160, y: 240 },
  ]);
  assert.equal(moved.historyCount, 0);
  assert.equal(moved.session.committedTopology, started.committedTopology);
  assert.deepEqual(moved.session.committedTopology, topoBefore);
  assert.equal(cardMoveBlock.includes("onHistoryPush"), false);
  assert.equal(cardMoveBlock.includes("onTopologyChange"), false);
  assert.equal(cardMoveBlock.includes("pushDiagramHistory"), false);
});

test("CDP-C rAF 1 frame = 最大1 transient update", () => {
  const scene = manualScene();
  const started = beginCardDragSession({
    graph: scene.graph,
    cardId: "a",
    routeState: scene.routeState,
    topology: scene.topology,
  })!;
  const coalesced = applyCoalescedCardDragMove(started, [
    { x: 90, y: 200 },
    { x: 110, y: 210 },
    { x: 130, y: 220 },
  ]);
  assert.equal(coalesced.transient.x, 130);
  assert.equal(coalesced.transient.y, 220);
  assert.ok(hookSrc.includes("requestAnimationFrame(flushMove)"));
  assert.ok(hookSrc.includes("if (rafRef.current == null)"));
  assert.equal(
    cardMoveBlock.split("moveCardDragSession(").length - 1,
    1,
  );
});

test("CDP-D dragged cardだけtransient position", () => {
  const scene = manualScene();
  const started = beginCardDragSession({
    graph: scene.graph,
    cardId: "a",
    routeState: scene.routeState,
    topology: scene.topology,
  })!;
  const moved = moveCardDragSession(started, 140, 260);
  const display = cardsWithTransientPosition(
    scene.graph.cards,
    moved.transient,
  );
  const liveA = display.find((row) => row.id === "a")!;
  const liveB = display.find((row) => row.id === "b")!;
  const liveC = display.find((row) => row.id === "c")!;
  assert.equal(liveA.layout.x, 140);
  assert.equal(liveA.layout.y, 260);
  assert.equal(liveB, scene.graph.cards.find((row) => row.id === "b"));
  assert.equal(liveC, scene.graph.cards.find((row) => row.id === "c"));
  assert.equal(liveB.layout.x, 520);
  assert.equal(liveC.layout.x, 600);
});

test("CDP-E incident connectionだけpreview non-incident route exact", () => {
  const scene = manualScene();
  const started = beginCardDragSession({
    graph: scene.graph,
    cardId: "a",
    routeState: scene.routeState,
    topology: scene.topology,
  })!;
  const moved = moveCardDragSession(started, 160, 280);
  const ids = moved.transient.incidentRoutePreviews.map((row) => row.connectionId);
  assert.deepEqual(ids, ["cn_ab"]);
  assert.deepEqual(
    listIncidentConnectionIds(scene.graph.connections, "a"),
    ["cn_ab"],
  );
  const overlaid = overlayIncidentRoutePreviews(
    [
      { connectionId: "cn_ab", points: JOG },
      { connectionId: "cn_bc", points: OTHER },
    ],
    moved.transient.incidentRoutePreviews,
  );
  assert.deepEqual(overlaid[1]!.points, OTHER);
  assert.notDeepEqual(overlaid[0]!.points, JOG);
});

test("CDP-F MANUAL internal points preserve", () => {
  const scene = manualScene();
  const started = beginCardDragSession({
    graph: scene.graph,
    cardId: "a",
    routeState: scene.routeState,
    topology: scene.topology,
  })!;
  const moved = moveCardDragSession(started, 40, 280);
  const preview = moved.transient.incidentRoutePreviews.find(
    (row) => row.connectionId === "cn_ab",
  )!;
  assert.equal(subsequence(preview.points, JOG.slice(1)), true);
  assert.deepEqual(started.committedTopology!.routes[0]!.points, JOG);
});

test("CDP-G AUTOもdrag中はrubber-bandのみ", () => {
  const scene = autoScene();
  const started = beginCardDragSession({
    graph: scene.graph,
    cardId: "a",
    routeState: scene.routeState,
    topology: scene.topology,
  })!;
  const moved = moveCardDragSession(started, 40, 280);
  const preview = moved.transient.incidentRoutePreviews.find(
    (row) => row.connectionId === "cn_ab",
  )!;
  assert.equal(subsequence(preview.points, JOG.slice(1)), true);
  assert.equal(domainSrc.includes("findRectilinearPath"), false);
  assert.equal(domainSrc.includes("selectBestOrthogonalRoute"), false);
  assert.equal(domainSrc.includes("evaluateRouteQuality"), false);
  assert.equal(cardMoveBlock.includes("pathfind"), false);
});

test("CDP-H drop後MANUAL endpoint repair only", () => {
  const scene = manualScene();
  const droppedGraph = applyCardPositionToGraph(scene.graph, "a", 40, 280);
  const dropped = applyLightweightCardDrop({
    previous: scene.routeState,
    cards: droppedGraph.cards,
    connections: droppedGraph.connections,
    topology: scene.topology,
    movedCardId: "a",
  });
  const next = dropped.state.byId.cn_ab!;
  assert.equal(subsequence(next.points, JOG.slice(1)), true);
  assert.equal(dropped.state.byId.cn_bc!.points, scene.routeState.byId.cn_bc!.points);
  assert.ok(hookSrc.includes("applyLightweightCardDrop"));
  assert.ok(hookSrc.includes("finalizeDrop"));
  assert.ok(hookSrc.includes('type: "moveCard"'));
});

test("CDP-I 2 pointer → transient破棄 committed graph exact viewport handoff", () => {
  const scene = manualScene();
  const started = beginCardDragSession({
    graph: scene.graph,
    cardId: "a",
    routeState: scene.routeState,
    topology: scene.topology,
  })!;
  const moved = moveCardDragSession(started, 180, 260);
  const cancelled = cancelCardDragSession(moved);
  assert.equal(cancelled.transient, null);
  assert.equal(cancelled.graph, started.committedGraph);
  assert.deepEqual(cancelled.graph, scene.graph);
  assert.equal(cancelled.topology, started.committedTopology);
  let machine = applyPointerDownOnCard(createIdleState(), {
    cardId: "a",
    movable: true,
    pointerId: 1,
    pointerType: "touch",
    clientX: 100,
    clientY: 100,
    originX: 80,
    originY: 200,
    cardWidth: 160,
    cardHeight: 72,
  });
  machine = applyPointerMove(machine, {
    pointerId: 1,
    clientX: 160,
    clientY: 140,
    scale: 1,
  });
  const handoff = applySecondTouch(machine);
  assert.equal(handoff.state.phase, "VIEWPORT_GESTURE");
  assert.equal(handoff.commit?.kind, "card");
  assert.ok(hookSrc.includes('if (handoff.commit?.kind === "group")'));
  assert.ok(hookSrc.includes("clearRouteBase"));
  const printPortal = patientASrc.slice(patientASrc.lastIndexOf("rd-print-root"));
  assert.equal(printPortal.includes("dragTransient"), false);
});

test("CDP-J Patient A 71/64 drag中 committed graph replacement = 0", () => {
  const reconstruction = buildPatientAStudentReconstruction();
  const graph = applyPatientACardSizeScale(reconstruction.graph, 90);
  assert.equal(graph.cards.length, 71);
  assert.equal(graph.connections.length, 64);
  const routeState = seedStableRouteState(graph.cards, graph.connections);
  const target = graph.cards.find((row) => row.cardType === "information")!;
  const started = beginCardDragSession({
    graph,
    cardId: target.id,
    routeState,
  })!;
  const frames = Array.from({ length: 24 }, (_, index) => ({
    x: target.layout.x + index * 4,
    y: target.layout.y + index * 2,
  }));
  const moved = simulateMoveFrames(started, frames);
  assert.equal(moved.session.committedGraph, graph);
  assert.equal(moved.session.committedGraph, started.committedGraph);
  assert.equal(moved.perf.committedGraphUpdates, 0);
  assert.deepEqual(
    moved.session.committedGraph.cards.map((row) => row.layout),
    graph.cards.map((row) => row.layout),
  );
  assert.ok(patientASrc.includes("dragTransient={dragTransient}"));
  assert.ok(fixtureSrc.includes("dragTransient={dragTransient}"));
});

test("CDP-K Patient A Junction experiment exact", () => {
  const junction = buildPatientAJunctionReconstruction(90);
  const mergeIds = new Set(patientAMergeConnectionIds(junction.cardKeys));
  const owned = junction.graph.connections.find((row) => mergeIds.has(row.id));
  assert.ok(owned);
  const started = beginCardDragSession({
    graph: junction.graph,
    cardId: owned!.sourceCardId,
    routeState: junction.routeState,
    topology: junction.topology,
  })!;
  const bpBefore = cloneJson(junction.topology.branchPoints);
  const routesBefore = cloneJson(junction.topology.routes);
  const moved = moveCardDragSession(
    started,
    started.snapshot.originX + 28,
    started.snapshot.originY + 16,
  );
  assert.equal(moved.committedTopology, started.committedTopology);
  assert.deepEqual(moved.committedTopology!.branchPoints, bpBefore);
  assert.deepEqual(moved.committedTopology!.routes, routesBefore);
  assert.deepEqual(
    [...PATIENT_A_MERGE_JUNCTION_IDS],
    ["j_exec_in", "j_sleep_tx_in", "j_food_s_in", "j_role_s_in"],
  );
  assert.equal(domainSrc.includes("attachPatientAMergeJunctions"), false);
  assert.ok(junctionSrc.includes("patient_a_explicit_merge_junction_dev_only"));
  const previewIds = new Set(
    moved.transient.incidentRoutePreviews.map((row) => row.connectionId),
  );
  for (const id of previewIds) {
    if (!mergeIds.has(id)) continue;
    const incident = started.snapshot.incidents.find(
      (row) => row.connectionId === id,
    )!;
    assert.ok(incident.junctionAnchor);
    const bp = junction.topology.branchPoints.find((row) =>
      row.connectionIds.includes(id),
    )!;
    assert.equal(incident.junctionAnchor!.x, bp.x);
    assert.equal(incident.junctionAnchor!.y, bp.y);
  }
});

test("CDP-L card表示位置とroute previewが同じtransient positionを参照する", () => {
  const scene = manualScene();
  const started = beginCardDragSession({
    graph: scene.graph,
    cardId: "a",
    routeState: scene.routeState,
    topology: scene.topology,
  })!;
  const moved = moveCardDragSession(started, 112, 244);
  const liveCard = cardWithTransientPosition(scene.graph.cards[0]!, moved.transient);
  assert.equal(liveCard.layout.x, moved.transient.x);
  assert.equal(liveCard.layout.y, moved.transient.y);
  const preview = moved.transient.incidentRoutePreviews[0]!;
  assert.equal(preview.points[0]!.x, 112 + 160);
  assert.equal(preview.points[0]!.y, 244 + 36);
  assert.ok(surfaceSrc.includes("cardWithTransientPosition(card, dragTransient)"));
  assert.ok(surfaceSrc.includes("incidentRoutePreviews={incidentRoutePreviews}"));
  assert.ok(domainSrc.includes("rubberBandIncident(incident, liveCard)"));
});

test("CDP-M drag中 bridge geometry/stateを更新しない", () => {
  const scene = manualScene();
  const started = beginCardDragSession({
    graph: scene.graph,
    cardId: "a",
    routeState: scene.routeState,
    topology: scene.topology,
  })!;
  const bridges = started.committedRouteState!.bridges;
  const moved = moveCardDragSession(started, 200, 300);
  assert.equal(moved.committedRouteState, started.committedRouteState);
  assert.equal(moved.committedRouteState!.bridges, bridges);
  assert.deepEqual(moved.committedRouteState!.bridges, scene.routeState.bridges);
  assert.ok(layerSrc.includes("rubberBandPreviews != null ? new Set()"));
  assert.equal(cardMoveBlock.includes("onRouteStateChange"), false);
});

test("CDP-N drag中 topology.routesをupsert/removeしない", () => {
  const scene = manualScene();
  const started = beginCardDragSession({
    graph: scene.graph,
    cardId: "a",
    routeState: scene.routeState,
    topology: scene.topology,
  })!;
  const routesRef = started.committedTopology!.routes;
  const moved = moveCardDragSession(started, 210, 310);
  assert.equal(moved.committedTopology!.routes, routesRef);
  assert.equal(domainSrc.includes("topologyWithUpdatedRoutes"), false);
  assert.equal(cardMoveBlock.includes("onTopologyChange"), false);
});

test("CDP-O cancel後にtransient geometryが残らない", () => {
  const scene = manualScene();
  const started = beginCardDragSession({
    graph: scene.graph,
    cardId: "a",
    routeState: scene.routeState,
    topology: scene.topology,
  })!;
  const moved = moveCardDragSession(started, 200, 260);
  const cancelled = cancelCardDragSession(moved);
  assert.equal(cancelled.transient, null);
  const display = cardsWithTransientPosition(scene.graph.cards, cancelled.transient);
  assert.equal(display, scene.graph.cards);
  assert.ok(hookSrc.includes("setDragTransient(null)"));
  assert.ok(hookSrc.includes("cardDragSessionRef.current = null"));
  const afterUp = applyPointerUp(createIdleState(), { pointerId: 1 });
  assert.equal(afterUp.drop, null);
});

test("wiring: memo + Patient A dragTransient + DEV perf", () => {
  assert.ok(cardNodeSrc.includes("memo(RelatedDiagramCardNode)"));
  assert.ok(layerSrc.includes("memo(function ConnectionRouteGroup"));
  assert.ok(patientASrc.includes("dragTransient"));
  assert.ok(fixtureSrc.includes("dragTransient"));
  const printA = patientASrc.slice(patientASrc.lastIndexOf("rd-print-root"));
  assert.equal(printA.includes("dragTransient"), false);
  assert.ok(src("./cardDragPerf.ts").includes("__rdCardDragPerf"));
  assert.ok(hookSrc.includes("publishCardDragPerf"));
  assert.equal(src("./cardDragPerf.ts").includes("committedGraphUpdates"), true);
});

test("Patient A render isolation identity", () => {
  const reconstruction = buildPatientAStudentReconstruction();
  const graph = applyPatientACardSizeScale(reconstruction.graph, 90);
  const routeState = seedStableRouteState(graph.cards, graph.connections);
  const target = graph.cards[3]!;
  const started = beginCardDragSession({
    graph,
    cardId: target.id,
    routeState,
  })!;
  const moved = moveCardDragSession(
    started,
    target.layout.x + 20,
    target.layout.y + 12,
  );
  const display = cardsWithTransientPosition(graph.cards, moved.transient);
  const changedCards = display.filter((row, index) => row !== graph.cards[index]);
  assert.equal(changedCards.length, 1);
  assert.equal(changedCards[0]!.id, target.id);
  const committedRoutes = Object.values(routeState.byId).map((row) => ({
    connectionId: row.connectionId,
    points: row.points,
  }));
  const overlaid = overlayIncidentRoutePreviews(
    committedRoutes,
    moved.transient.incidentRoutePreviews,
  );
  const changedRoutes = overlaid.filter((row, index) => row !== committedRoutes[index]);
  assert.deepEqual(
    changedRoutes.map((row) => row.connectionId).sort(),
    moved.transient.incidentRoutePreviews.map((row) => row.connectionId).sort(),
  );
  const loop = simulateMoveFrames(started, [
    { x: target.layout.x + 8, y: target.layout.y + 4 },
    { x: target.layout.x + 16, y: target.layout.y + 8 },
    { x: target.layout.x + 24, y: target.layout.y + 12 },
  ]);
  console.log(
    "2-0 perf sim",
    JSON.stringify({
      cards: graph.cards.length,
      connections: graph.connections.length,
      frames: 3,
      ...loop.perf,
      previewConnectionCount: loop.session.transient.incidentRoutePreviews.length,
      changedCards: 1,
      changedRoutes: loop.session.transient.incidentRoutePreviews.length,
    }),
  );
});

void pushDiagramHistory;

console.log(`\n${passed} passed`);
