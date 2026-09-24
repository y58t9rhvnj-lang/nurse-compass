/**
 * Phase 2-1 lightweight card drop (CDP2-A…O).
 * Run: ./node_modules/.bin/jiti lib/v2/relatedDiagram/lightweightCardDrop.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { applyCardPositionToGraph } from "./cardInteractionState";
import {
  applyPointerDownOnCard,
  applyPointerMove,
  applySecondTouch,
  createIdleState,
} from "./cardInteractionState";
import {
  beginCardDragSession,
  cancelCardDragSession,
  internalRoutePoints,
  listIncidentConnectionIds,
  moveCardDragSession,
} from "./cardDragTransient";
import { emptyDiagramHistory, pushDiagramHistory } from "./diagramHistory";
import { collectAffectedConnectionIds, seedInitialAutoRouteState } from "./incrementalRoutes";
import {
  applyLightweightCardDrop,
  isUsableAutoPreview,
} from "./lightweightCardDrop";
import { LIGHTWEIGHT_INITIAL_CANDIDATE_LIMIT } from "./lightweightInitialRoute";
import { isOrthogonalPolyline } from "./orthogonalRouting";
import { buildPatientAStudentReconstruction } from "./buildPatientAStudentReconstruction";
import {
  PATIENT_A_MERGE_JUNCTION_IDS,
  buildPatientAJunctionReconstruction,
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
  const routeState = {
    byId: {
      cn_ab: {
        connectionId: "cn_ab",
        sourceCardId: "a",
        targetCardId: "b",
        sourceEdge: "right" as const,
        targetEdge: "left" as const,
        sourcePin: { ...JOG[0]! },
        targetPin: { ...JOG[JOG.length - 1]! },
        points: JOG.map((point) => ({ ...point })),
      },
      cn_bc: {
        connectionId: "cn_bc",
        sourceCardId: "b",
        targetCardId: "c",
        sourceEdge: "right" as const,
        targetEdge: "left" as const,
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
    bridges: [],
    qualityTrace: {},
  };
  return { graph: graphOf(cards, connections), topology, routeState };
}

function autoScene() {
  const scene = manualScene();
  return {
    graph: scene.graph,
    topology: emptyRouteTopology(),
    routeState: scene.routeState,
  };
}

function knowledgeAutoScene() {
  const scene = autoScene();
  return {
    ...scene,
    graph: graphOf(
      scene.graph.cards,
      scene.graph.connections.map((row) => ({
        ...row,
        origin: "knowledge_library" as const,
      })),
    ),
  };
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

const dropSrc = src("./lightweightCardDrop.ts");
const hookSrc = src("../../../components/v2/relatedDiagram/useCardInteraction.ts");
const lightSrc = src("./lightweightInitialRoute.ts");
const forbidden = [
  "selectBestOrthogonalRoute",
  "generateOrthogonalCandidates",
  "findRectilinearPath",
  "evaluateRouteQuality",
  "countRouteCrossings",
  "planOrthogonalRoutes",
  "seedStableRouteState",
  "seedInitialAutoRouteState",
  "planLightweightInitialRoutes",
  "evaluateArrangeScene",
  "arrangeRelatedDiagramScene",
  "applyD0",
  "applyD1",
  "applyD2",
  "applyD3",
  "layoutRelatedDiagramD0",
  "layoutRelatedDiagramD1",
  "layoutRelatedDiagramD2",
  "layoutRelatedDiagramD3",
];

test("CDP2-A Knowledge AUTO drop時 quality planner = 0", () => {
  const scene = knowledgeAutoScene();
  const next = applyCardPositionToGraph(scene.graph, "a", 120, 224);
  const dropped = applyLightweightCardDrop({
    previous: scene.routeState,
    cards: next.cards,
    connections: next.connections,
    topology: scene.topology,
    movedCardId: "a",
  });
  assert.equal(dropped.stats.qualityPlannerCalls, 0);
  assert.equal(dropped.stats.qualityRerouteCount, 0);
  assert.equal(dropSrc.includes("selectBestOrthogonalRoute"), false);
  assert.equal(hookSrc.includes("selectBestOrthogonalRoute"), false);
});

test("CDP2-B Knowledge AUTO drop時 high-quality candidate generation = 0", () => {
  const scene = knowledgeAutoScene();
  const next = applyCardPositionToGraph(scene.graph, "a", 120, 224);
  const dropped = applyLightweightCardDrop({
    previous: scene.routeState,
    cards: next.cards,
    connections: next.connections,
    topology: scene.topology,
    movedCardId: "a",
  });
  assert.equal(dropped.stats.qualityCandidateCalls, 0);
  assert.equal(dropped.stats.pathfindCalls, 0);
  assert.equal(dropped.stats.qualityEvalCalls, 0);
  assert.equal(dropped.stats.priorCrossingChecks, 0);
  assert.equal(dropSrc.includes("generateOrthogonalCandidates"), false);
});

test("CDP2-C Knowledge AUTO incident candidate <= 6 / connection", () => {
  const scene = knowledgeAutoScene();
  const next = applyCardPositionToGraph(scene.graph, "a", 120, 224);
  const dropped = applyLightweightCardDrop({
    previous: scene.routeState,
    cards: next.cards,
    connections: next.connections,
    topology: scene.topology,
    movedCardId: "a",
  });
  assert.ok(LIGHTWEIGHT_INITIAL_CANDIDATE_LIMIT <= 6);
  assert.ok(dropped.stats.maxCandidatesPerAuto <= 6);
  if (dropped.stats.autoCount > 0 && dropped.stats.lightweightFallbackCount > 0) {
    assert.ok(dropped.stats.candidateCount / dropped.stats.lightweightFallbackCount <= 6);
  }
});

test("CDP2-D non-incident route geometry exact", () => {
  const scene = manualScene();
  const next = applyCardPositionToGraph(scene.graph, "a", 40, 280);
  const dropped = applyLightweightCardDrop({
    previous: scene.routeState,
    cards: next.cards,
    connections: next.connections,
    topology: scene.topology,
    movedCardId: "a",
  });
  assert.equal(dropped.state.byId.cn_bc, scene.routeState.byId.cn_bc);
  assert.deepEqual(
    dropped.state.byId.cn_bc!.points,
    scene.routeState.byId.cn_bc!.points,
  );
  const overlap = collectAffectedConnectionIds({
    movedCardId: "a",
    cards: next.cards,
    connections: next.connections,
    topology: scene.topology,
    previous: scene.routeState,
  });
  const incidents = listIncidentConnectionIds(next.connections, "a");
  assert.ok(overlap.length >= incidents.length);
});

test("CDP2-E MANUAL internal geometry exact preserve", () => {
  const scene = manualScene();
  const next = applyCardPositionToGraph(scene.graph, "a", 40, 280);
  const dropped = applyLightweightCardDrop({
    previous: scene.routeState,
    cards: next.cards,
    connections: next.connections,
    topology: scene.topology,
    movedCardId: "a",
  });
  assert.equal(subsequence(dropped.state.byId.cn_ab!.points, JOG.slice(1)), true);
  assert.equal(
    subsequence(
      internalRoutePoints(dropped.state.byId.cn_ab!.points),
      internalRoutePoints(JOG),
    ),
    true,
  );
});

test("CDP2-F MANUAL endpointのみrepair", () => {
  const scene = manualScene();
  const started = beginCardDragSession({
    graph: scene.graph,
    cardId: "a",
    routeState: scene.routeState,
    topology: scene.topology,
  })!;
  const moved = moveCardDragSession(started, 40, 280);
  const next = applyCardPositionToGraph(scene.graph, "a", 40, 280);
  const dropped = applyLightweightCardDrop({
    previous: scene.routeState,
    cards: next.cards,
    connections: next.connections,
    topology: scene.topology,
    movedCardId: "a",
    previews: moved.transient.incidentRoutePreviews,
  });
  const preview = moved.transient.incidentRoutePreviews.find(
    (row) => row.connectionId === "cn_ab",
  )!;
  assert.deepEqual(dropped.state.byId.cn_ab!.points, preview.points);
  assert.deepEqual(dropped.state.byId.cn_ab!.points[0], {
    x: 200,
    y: 316,
  });
});

test("CDP2-G Junction BP/trunk exact", () => {
  const junction = buildPatientAJunctionReconstruction(90);
  const owned = junction.graph.connections.find((row) =>
    junction.topology.branchPoints.some((bp) =>
      bp.connectionIds.includes(row.id),
    ),
  );
  assert.ok(owned);
  const source = junction.graph.cards.find(
    (row) => row.id === owned!.sourceCardId,
  )!;
  const next = applyCardPositionToGraph(
    junction.graph,
    source.id,
    source.layout.x + 28,
    source.layout.y + 16,
  );
  const dropped = applyLightweightCardDrop({
    previous: junction.routeState,
    cards: next.cards,
    connections: next.connections,
    topology: junction.topology,
    movedCardId: source.id,
  });
  assert.equal(dropped.topology!.branchPoints, junction.topology.branchPoints);
  assert.equal(dropped.topology!.trunks, junction.topology.trunks);
  assert.deepEqual(dropped.topology!.branchPoints, junction.topology.branchPoints);
  assert.deepEqual(dropped.topology!.trunks, junction.topology.trunks);
  assert.deepEqual(
    [...PATIENT_A_MERGE_JUNCTION_IDS],
    ["j_exec_in", "j_sleep_tx_in", "j_food_s_in", "j_role_s_in"],
  );
});

test("CDP2-H history moveCard = 1", () => {
  const scene = manualScene();
  const next = applyCardPositionToGraph(scene.graph, "a", 40, 280);
  const dropped = applyLightweightCardDrop({
    previous: scene.routeState,
    cards: next.cards,
    connections: next.connections,
    topology: scene.topology,
    movedCardId: "a",
  });
  let history = emptyDiagramHistory();
  history = pushDiagramHistory(history, {
    type: "moveCard",
    cardIds: ["a"],
    before: {
      cards: [{ id: "a", x: 80, y: 200 }],
      routeState: scene.routeState,
      topology: scene.topology,
    },
    after: {
      cards: [{ id: "a", x: 40, y: 280 }],
      routeState: dropped.state,
      topology: dropped.topology,
    },
  });
  assert.equal(history.past.length, 1);
  assert.equal(history.past[0]!.type, "moveCard");
  assert.equal(hookSrc.includes('type: "moveCard"'), true);
  assert.equal(dropSrc.includes("pushDiagramHistory"), false);
  assert.equal(dropSrc.includes("onHistoryPush"), false);
});

test("CDP2-I topology MANUALのみ必要範囲更新", () => {
  const scene = manualScene();
  const next = applyCardPositionToGraph(scene.graph, "a", 40, 280);
  const dropped = applyLightweightCardDrop({
    previous: scene.routeState,
    cards: next.cards,
    connections: next.connections,
    topology: scene.topology,
    movedCardId: "a",
  });
  assert.equal(dropped.topology!.routes.length, 1);
  assert.equal(dropped.topology!.routes[0]!.connectionId, "cn_ab");
  assert.deepEqual(
    dropped.topology!.routes[0]!.points,
    dropped.state.byId.cn_ab!.points,
  );
  assert.equal(
    dropped.topology!.routes.some((row) => row.connectionId === "cn_bc"),
    false,
  );
});

test("CDP2-J Knowledge AUTO preview usableならdrop後採用可能", () => {
  const scene = knowledgeAutoScene();
  const next = applyCardPositionToGraph(scene.graph, "a", 120, 200);
  const preview = {
    connectionId: "cn_ab",
    sourceCardId: "a",
    targetCardId: "b",
    sourceEdge: "right" as const,
    targetEdge: "left" as const,
    points: [
      { x: 280, y: 236 },
      { x: 520, y: 236 },
    ],
  };
  const source = next.cards.find((row) => row.id === "a")!;
  const target = next.cards.find((row) => row.id === "b")!;
  assert.equal(isUsableAutoPreview(preview, source, target, next.cards), true);
  const dropped = applyLightweightCardDrop({
    previous: scene.routeState,
    cards: next.cards,
    connections: next.connections,
    topology: scene.topology,
    movedCardId: "a",
    previews: [preview],
  });
  assert.deepEqual(dropped.state.byId.cn_ab!.points, preview.points);
  assert.ok(dropped.stats.adoptedPreviewCount >= 1);
  assert.equal(dropped.stats.lightweightFallbackCount, 0);
});

test("CDP2-K Knowledge AUTO fallbackもorthogonal", () => {
  const scene = knowledgeAutoScene();
  const next = applyCardPositionToGraph(scene.graph, "a", 120, 320);
  const preview = {
    connectionId: "cn_ab",
    sourceCardId: "a",
    targetCardId: "b",
    sourceEdge: "right" as const,
    targetEdge: "left" as const,
    points: [
      { x: 280, y: 356 },
      { x: 400, y: 200 },
      { x: 520, y: 236 },
    ],
  };
  const dropped = applyLightweightCardDrop({
    previous: scene.routeState,
    cards: next.cards,
    connections: next.connections,
    topology: scene.topology,
    movedCardId: "a",
    previews: [preview],
  });
  assert.equal(isOrthogonalPolyline(dropped.state.byId.cn_ab!.points), true);
  assert.equal(dropped.stats.qualityPlannerCalls, 0);
});

function patientALightweightGraph() {
  const reconstruction = buildPatientAStudentReconstruction();
  return {
    ...reconstruction.graph,
    connections: reconstruction.graph.connections.map((row) => ({
      ...row,
      origin: "knowledge_library" as const,
    })),
  };
}

test("CDP2-L 64 connection全体を再seedしない", () => {
  const graph = patientALightweightGraph();
  const routeState = seedInitialAutoRouteState(graph.cards, graph.connections);
  const target = graph.cards.find((row) =>
    graph.connections.some(
      (rowConn) =>
        rowConn.sourceCardId === row.id || rowConn.targetCardId === row.id,
    ),
  )!;
  const incidents = new Set(listIncidentConnectionIds(graph.connections, target.id));
  const next = applyCardPositionToGraph(
    graph,
    target.id,
    target.layout.x + 40,
    target.layout.y + 24,
  );
  const dropped = applyLightweightCardDrop({
    previous: routeState,
    cards: next.cards,
    connections: next.connections,
    movedCardId: target.id,
  });
  assert.equal(graph.connections.length, 64);
  assert.equal(dropped.stats.seedAllCalls, 0);
  assert.equal(dropped.stats.incidentCount, incidents.size);
  for (const id of Object.keys(routeState.byId)) {
    if (incidents.has(id)) continue;
    assert.equal(dropped.state.byId[id], routeState.byId[id], id);
  }
  for (const name of [
    "seedInitialAutoRouteState",
    "seedStableRouteState",
    "planLightweightInitialRoutes",
  ]) {
    assert.equal(dropSrc.includes(name), false, name);
  }
});

test("CDP2-M D0-D3を呼ばない", () => {
  for (const name of forbidden) {
    assert.equal(dropSrc.includes(name), false, name);
  }
  assert.equal(hookSrc.includes("evaluateArrangeScene"), false);
  assert.equal(hookSrc.includes("arrangeRelatedDiagramScene"), false);
  assert.equal(lightSrc.includes("selectBestOrthogonalRoute"), false);
});

test("CDP2-N 2 pointer cancelではdrop routing 0", () => {
  const scene = autoScene();
  const started = beginCardDragSession({
    graph: scene.graph,
    cardId: "a",
    routeState: scene.routeState,
    topology: scene.topology,
  })!;
  const moved = moveCardDragSession(started, 180, 260);
  const cancelled = cancelCardDragSession(moved);
  assert.deepEqual(cancelled.routeState, scene.routeState);
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
    clientX: 180,
    clientY: 160,
    scale: 1,
  });
  const handoff = applySecondTouch(machine);
  assert.equal(handoff.commit?.kind, "card");
  assert.ok(hookSrc.includes('if (handoff.commit?.kind === "group")'));
  assert.equal(hookSrc.includes("applyLightweightCardDrop"), true);
  const secondTouch = hookSrc.slice(
    hookSrc.indexOf("const handoff = applySecondTouch"),
    hookSrc.indexOf("onCardPointerMove"),
  );
  assert.equal(secondTouch.includes("applyLightweightCardDrop"), false);
});

test("CDP2-O deterministic + Patient A drop timing", () => {
  const graph = patientALightweightGraph();
  const routeState = seedInitialAutoRouteState(graph.cards, graph.connections);
  const degrees = graph.cards.map((row) => ({
    id: row.id,
    count: listIncidentConnectionIds(graph.connections, row.id).length,
    card: row,
  }));
  const typical = degrees
    .filter((row) => row.count > 0)
    .sort((a, b) => a.count - b.count)[0]!;
  const busy = degrees.slice().sort((a, b) => b.count - a.count)[0]!;
  const measure = (row: typeof typical) => {
    const next = applyCardPositionToGraph(
      graph,
      row.id,
      row.card.layout.x + 40,
      row.card.layout.y + 24,
    );
    const first = applyLightweightCardDrop({
      previous: routeState,
      cards: next.cards,
      connections: next.connections,
      movedCardId: row.id,
    });
    const second = applyLightweightCardDrop({
      previous: routeState,
      cards: next.cards,
      connections: next.connections,
      movedCardId: row.id,
    });
    assert.deepEqual(first.state.byId, second.state.byId);
    assert.deepEqual(first.state.bridges, second.state.bridges);
    return first;
  };
  const t0 = performance.now();
  const typicalDrop = measure(typical);
  const typicalMs = performance.now() - t0;
  const t1 = performance.now();
  const busyDrop = measure(busy);
  const busyMs = performance.now() - t1;
  console.log(
    JSON.stringify(
      {
        typical: {
          cardId: typical.id,
          incidents: typical.count,
          totalMs: +typicalDrop.stats.totalMs.toFixed(2),
          wallMs: +typicalMs.toFixed(2),
          connectionMs: typicalDrop.stats.connectionMs,
          classifyMs: +typicalDrop.stats.classifyMs.toFixed(2),
          auto: typicalDrop.stats.autoCount,
          manual: typicalDrop.stats.manualCount,
          junction: typicalDrop.stats.junctionCount,
          candidates: typicalDrop.stats.candidateCount,
        },
        busy: {
          cardId: busy.id,
          incidents: busy.count,
          totalMs: +busyDrop.stats.totalMs.toFixed(2),
          wallMs: +busyMs.toFixed(2),
          connectionMs: busyDrop.stats.connectionMs,
          classifyMs: +busyDrop.stats.classifyMs.toFixed(2),
          auto: busyDrop.stats.autoCount,
          manual: busyDrop.stats.manualCount,
          junction: busyDrop.stats.junctionCount,
          candidates: busyDrop.stats.candidateCount,
        },
      },
      null,
      2,
    ),
  );
});

console.log(`\n${passed} passed`);
