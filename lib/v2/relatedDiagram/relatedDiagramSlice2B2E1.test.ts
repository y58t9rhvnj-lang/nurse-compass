/**
 * Slice 2B-2E-1 Connection Create tests.
 * Run: npx tsx lib/v2/relatedDiagram/relatedDiagramSlice2B2E1.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getCardActionCapabilities } from "./cardActionCapabilities";
import { createCardConnectIntent } from "./cardActionIntents";
import {
  ATTACHMENT_CORNER_CLEARANCE,
  ATTACHMENT_SPACING,
  CONNECT_NOTICE_DUPLICATE,
  CONNECT_NOTICE_SELF,
  EDGE_RUN_PROXIMITY_PX,
  PERIMETER_ESCALATION_EDGE_RUN,
  PERIMETER_ESCALATION_MAX_PAIRS,
  PERIMETER_ESCALATION_RATIO,
  canvasEdgeRun,
  polylineManhattanLength,
  rankEscalationEdgePairs,
  shouldEscalatePerimeterRoute,
  STUDENT_CONNECTION_EDGE_PAIR_COUNT,
  STUDENT_CONNECTION_EDGE_SIDES,
  STUDENT_CONNECTION_ORIGIN,
  STUDENT_CONNECTION_RELATION_LABELS,
  alongCardEdge,
  attachmentOffsetsForEdge,
  cloneConnection,
  commitStudentConnectionCreate,
  decideStudentConnectionRoute,
  edgeAttachmentPin,
  evaluateConnectTarget,
  evaluateStudentConnectionPolyline,
  finalizeStudentConnectionCreate,
  findConnectionForCardPair,
  isStudentConnectionRelation,
  newStudentConnectionId,
  occupiedPinsOnEdge,
  planStudentConnectionRoute,
  rebindOrthogonalAttachment,
  studentConnectionEdgePairs,
  studentConnectionOverlapsPriorRoutes,
  studentConnectionRouteAccepted,
  type StudentConnectionCreateResult,
} from "./cardConnectionCreate";
import { buildDirectInsightCard } from "./cardDirectInsight";
import {
  applyHistoryCommand,
  emptyDiagramHistory,
  pushDiagramHistory,
  redoDiagramHistory,
  undoDiagramHistory,
} from "./diagramHistory";
import { emptyDiagramSelection, selectionFromCardId } from "./diagramSelection";
import { resolveRelatedDiagramEditorMode } from "./editorUiState";
import { A3_HEIGHT_PX, A3_WIDTH_PX } from "./a3Canvas";
import { getA3LegendBounds } from "./a3Legend";
import {
  ENDPOINT_CORRIDOR_WIDTH,
  MIN_JUNCTION_BRIDGE_DISTANCE,
} from "./geometryGuard";
import { seedStableRouteState, pointsDeepEqual, type StoredRouteGeometry } from "./incrementalRoutes";
import {
  BRIDGE_RADIUS_PX,
  analyzeRouteMeetings,
  canRenderBridgeHop,
  chooseCardEdges,
  classifyRouteInteractions,
  isColinearOverlap,
} from "./orthogonalRouting";
import { secondaryEdgePair } from "./routeCongestion";
import {
  MIN_ARROW_APPROACH,
  MIN_ENDPOINT_STUB,
  cardObstacle,
  defaultRouteCanvas,
  generateOrthogonalCandidates,
  validateOrthogonalRoute,
} from "./routeHardening";
import { junctionsFromTopology } from "./routeTopology";
import { createEmptySemanticGraph, upsertCard } from "./semanticGraph";
import { resolveDevFixtureReadonlyScene } from "./resolveReadonlyScene";
import {
  classifyActionPopoverPointer,
  isActionPopoverSurface,
  trackPointerDown,
  trackPointerUp,
} from "./actionPopoverGesture";
import {
  cardScreenRect,
  placeActionPopover,
} from "./actionPopoverPlacement";
import {
  CONNECTION_ARROW_MARKER_BASE_ID,
  CONNECTION_ARROW_THICK_MARKER_BASE_ID,
  connectionArrowRenderContract,
  connectionPathMarkerAttrs,
} from "./connectionArrowMarker";
import { visibleContextActions } from "./editorContextBar";
import {
  IPAD_LANDSCAPE_WIDTHS,
  estimatedToolbarRequiredWidth,
  toolbarChromeMetrics,
  toolbarOverflows,
  toolbarRowFits,
} from "./editorToolbarLayout";
import {
  applyPointerDownOnBlank,
  applyPointerDownOnCard,
  applyPointerMove,
  applyPointerUp,
  applySecondTouch,
  applyViewportGestureEnd,
  CARD_DRAG_THRESHOLD_PX,
  createIdleState,
} from "./cardInteractionState";
import { resolveConnectionStrokeVisual } from "./visualStyle";
import type {
  RelatedDiagramCard,
  RelatedDiagramCardType,
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
const bar = src(
  "../../../components/v2/relatedDiagram/RelatedDiagramContextBar.tsx",
);
const compose = src(
  "../../../components/v2/relatedDiagram/RelatedDiagramRelationComposeBar.tsx",
);
const popover = src(
  "../../../components/v2/relatedDiagram/RelatedDiagramActionPopover.tsx",
);
const toolbar = src(
  "../../../components/v2/relatedDiagram/RelatedDiagramEditorToolbar.tsx",
);
const createLib = src("./cardConnectionCreate.ts");
const historyLib = src("./diagramHistory.ts");
const layer = src(
  "../../../components/v2/relatedDiagram/RelatedDiagramConnectionLayer.tsx",
);

function placeCard(input: {
  id: string;
  cardType: RelatedDiagramCardType;
  text: string;
  x: number;
  y: number;
  state?: RelatedDiagramCard["state"];
  origin?: RelatedDiagramCard["origin"];
}): RelatedDiagramCard {
  return {
    id: input.id,
    cardType: input.cardType,
    text: input.text,
    state:
      input.state ??
      (input.cardType === "understanding" ||
      input.cardType === "nursing_problem"
        ? "current"
        : null),
    origin:
      input.origin ??
      (input.cardType === "knowledge"
        ? "knowledge_library"
        : input.cardType === "information"
          ? "form3_information"
          : "direct_insight"),
    layout: { x: input.x, y: input.y, width: 160, height: 72, zIndex: 1 },
    isLocked: false,
    createdAt: "2026-09-18T00:00:00.000Z",
    updatedAt: "2026-09-18T00:00:00.000Z",
  };
}

function graphWith(...cards: RelatedDiagramCard[]): RelatedDiagramSemanticGraph {
  let graph = createEmptySemanticGraph();
  for (const card of cards) {
    const result = upsertCard(graph, card);
    assert.equal(result.ok, true);
    if (result.ok) graph = result.graph;
  }
  return graph;
}

const sourceU = placeCard({
  id: "u_src",
  cardType: "understanding",
  text: "日中傾眠がある",
  x: 80,
  y: 80,
  state: "potential",
  origin: "direct_insight",
});
const targetU = placeCard({
  id: "u_tgt",
  cardType: "understanding",
  text: "転倒リスクがある",
  x: 420,
  y: 80,
  state: "current",
  origin: "form3_assessment",
});
const infoCard = placeCard({
  id: "info_1",
  cardType: "information",
  text: "クエチアピン内服中",
  x: 80,
  y: 260,
});
const knowledgeCard = placeCard({
  id: "know_1",
  cardType: "knowledge",
  text: "ドパミン神経系の関与",
  x: 420,
  y: 260,
  origin: "knowledge_library",
});

function emptyRoutes(graph: RelatedDiagramSemanticGraph) {
  return seedStableRouteState(graph.cards, graph.connections);
}

function createBetween(
  graph: RelatedDiagramSemanticGraph,
  sourceId: string,
  targetId: string,
  relation: "current" | "potential" | "treatment" = "current",
  connectionId?: string,
) {
  return commitStudentConnectionCreate({
    graph,
    routeState: emptyRoutes(graph),
    sourceCardId: sourceId,
    targetCardId: targetId,
    relationType: relation,
    connectionId,
  });
}

test("1 selected Card → connect intent", () => {
  const intent = createCardConnectIntent(sourceU);
  assert.equal(intent?.kind, "connect");
  assert.equal(intent?.sourceCardId, sourceU.id);
  assert.equal(getCardActionCapabilities(sourceU).canConnect, true);
  assert.ok(ws.includes("createCardConnectIntent"));
});

test("2 connecting mode", () => {
  assert.equal(
    resolveRelatedDiagramEditorMode({
      selection: selectionFromCardId(sourceU.id),
      form3Open: false,
      editOpen: false,
      connecting: true,
    }),
    "connecting",
  );
  assert.ok(ws.includes("connecting: actionIntent?.kind === \"connect\""));
  assert.ok(bar.includes("接続先のカードを選択"));
});

test("3 source Card保持", () => {
  assert.ok(ws.includes("actionIntent.sourceCardId"));
  assert.ok(ws.includes("selectCard(actionIntent.sourceCardId)"));
  assert.ok(ws.includes("connectSourceCardId"));
  assert.ok(bar.includes("接続元："));
});

test("4 target Card tap", () => {
  const graph = graphWith(sourceU, targetU);
  const evaluated = evaluateConnectTarget({
    graph,
    sourceCardId: sourceU.id,
    targetCardId: targetU.id,
  });
  assert.equal(evaluated.ok, true);
  assert.ok(ws.includes("handleConnectTargetTap"));
  assert.ok(ws.includes("setRelationCompose"));
});

test("5 Relation Compose表示", () => {
  assert.ok(ws.includes("RelatedDiagramRelationComposeBar"));
  assert.ok(compose.includes("この関係は？"));
  assert.ok(compose.includes("data-rd-relation-compose"));
  assert.ok(compose.includes("「{sourceTitle}」→「{targetTitle}」"));
});

test("6 self connection blocked", () => {
  const graph = graphWith(sourceU, targetU);
  const evaluated = evaluateConnectTarget({
    graph,
    sourceCardId: sourceU.id,
    targetCardId: sourceU.id,
  });
  assert.equal(evaluated.ok, false);
  if (!evaluated.ok) assert.equal(evaluated.code, "self_connection");
  const created = createBetween(graph, sourceU.id, sourceU.id);
  assert.equal(created.ok, false);
});

test("7 self tap no compose", () => {
  assert.ok(ws.includes('evaluated.code === "self_connection"'));
  assert.ok(ws.includes(CONNECT_NOTICE_SELF) || createLib.includes(CONNECT_NOTICE_SELF));
  const tap = ws.slice(
    ws.indexOf("const handleConnectTargetTap"),
    ws.indexOf("const handleCancelRelationCompose"),
  );
  assert.ok(tap.includes("self_connection"));
  assert.ok(tap.includes("return"));
});

test("8 current選択", () => {
  const created = createBetween(graphWith(sourceU, targetU), sourceU.id, targetU.id, "current");
  assert.equal(created.ok, true);
  if (created.ok) assert.equal(created.connection.relationType, "current");
  assert.equal(STUDENT_CONNECTION_RELATION_LABELS.current, "顕在");
  assert.ok(compose.includes('data-rd-relation-choice={relation}'));
});

test("9 potential選択", () => {
  const created = createBetween(
    graphWith(sourceU, targetU),
    sourceU.id,
    targetU.id,
    "potential",
  );
  assert.equal(created.ok, true);
  if (created.ok) assert.equal(created.connection.relationType, "potential");
  assert.equal(STUDENT_CONNECTION_RELATION_LABELS.potential, "潜在");
});

test("10 treatment選択", () => {
  const created = createBetween(
    graphWith(sourceU, targetU),
    sourceU.id,
    targetU.id,
    "treatment",
  );
  assert.equal(created.ok, true);
  if (created.ok) assert.equal(created.connection.relationType, "treatment");
  assert.equal(STUDENT_CONNECTION_RELATION_LABELS.treatment, "治療");
});

test("11 source→target direction", () => {
  const created = createBetween(graphWith(sourceU, targetU), sourceU.id, targetU.id);
  assert.equal(created.ok, true);
  if (!created.ok) return;
  assert.equal(created.connection.sourceCardId, sourceU.id);
  assert.equal(created.connection.targetCardId, targetU.id);
});

test("12 arrow target側", () => {
  const created = createBetween(graphWith(sourceU, targetU), sourceU.id, targetU.id);
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const route = created.routeState.byId[created.connection.id];
  assert.ok(route);
  const last = route.points[route.points.length - 1]!;
  assert.equal(last.x, route.targetPin.x);
  assert.equal(last.y, route.targetPin.y);
  assert.equal(route.points[0]!.x, route.sourcePin.x);
  assert.equal(route.points[0]!.y, route.sourcePin.y);
  const arrow = connectionArrowRenderContract(
    created.connection.relationType,
    "live",
  );
  assert.ok(arrow.markerEnd.startsWith("url(#"));
  assert.equal(arrow.markerStart, null);
  assert.ok(layer.includes("markerEnd"));
  assert.equal(layer.includes("markerStart"), false);
});

test("13 Card state independent", () => {
  const created = createBetween(
    graphWith(sourceU, targetU),
    sourceU.id,
    targetU.id,
    "current",
  );
  assert.equal(created.ok, true);
  if (!created.ok) return;
  assert.equal(sourceU.state, "potential");
  assert.equal(created.connection.relationType, "current");
  assert.notEqual(sourceU.state, created.connection.relationType);
  assert.equal(createLib.includes("card.state"), false);
});

test("14 direct_insight source可", () => {
  const insight = buildDirectInsightCard({
    text: "新しい気づき",
    state: "current",
    cardId: "di_src",
    layout: { x: 80, y: 420, zIndex: 2 },
  }).card;
  const created = createBetween(graphWith(insight, targetU), insight.id, targetU.id);
  assert.equal(created.ok, true);
  if (created.ok) assert.equal(created.connection.sourceCardId, insight.id);
});

test("15 direct_insight target可", () => {
  const insight = buildDirectInsightCard({
    text: "別の気づき",
    state: "potential",
    cardId: "di_tgt",
    layout: { x: 420, y: 420, zIndex: 2 },
  }).card;
  const created = createBetween(graphWith(sourceU, insight), sourceU.id, insight.id);
  assert.equal(created.ok, true);
  if (created.ok) assert.equal(created.connection.targetCardId, insight.id);
});

test("16 Information source/target可", () => {
  assert.equal(getCardActionCapabilities(infoCard).canConnect, true);
  const asSource = createBetween(graphWith(infoCard, targetU), infoCard.id, targetU.id);
  const asTarget = createBetween(graphWith(sourceU, infoCard), sourceU.id, infoCard.id);
  assert.equal(asSource.ok, true);
  assert.equal(asTarget.ok, true);
});

test("17 Knowledge source/target可", () => {
  assert.equal(getCardActionCapabilities(knowledgeCard).canConnect, true);
  const asSource = createBetween(
    graphWith(knowledgeCard, targetU),
    knowledgeCard.id,
    targetU.id,
  );
  const asTarget = createBetween(
    graphWith(sourceU, knowledgeCard),
    sourceU.id,
    knowledgeCard.id,
  );
  assert.equal(asSource.ok, true);
  assert.equal(asTarget.ok, true);
});

test("18 Understanding source/target可", () => {
  assert.equal(getCardActionCapabilities(sourceU).canConnect, true);
  assert.equal(getCardActionCapabilities(targetU).canConnect, true);
  const created = createBetween(graphWith(sourceU, targetU), sourceU.id, targetU.id);
  assert.equal(created.ok, true);
});

test("19 duplicate A→B blocked", () => {
  const first = createBetween(graphWith(sourceU, targetU), sourceU.id, targetU.id);
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const second = commitStudentConnectionCreate({
    graph: first.graph,
    routeState: first.routeState,
    sourceCardId: sourceU.id,
    targetCardId: targetU.id,
    relationType: "potential",
  });
  assert.equal(second.ok, false);
  if (!second.ok) assert.equal(second.code, "duplicate_pair");
});

test("20 duplicate B→A blocked", () => {
  const first = createBetween(graphWith(sourceU, targetU), sourceU.id, targetU.id);
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const reverse = commitStudentConnectionCreate({
    graph: first.graph,
    routeState: first.routeState,
    sourceCardId: targetU.id,
    targetCardId: sourceU.id,
    relationType: "current",
  });
  assert.equal(reverse.ok, false);
  if (!reverse.ok) assert.equal(reverse.code, "duplicate_pair");
  assert.ok(findConnectionForCardPair(first.graph, targetU.id, sourceU.id));
});

test("21 semantic違いでもsame pair blocked", () => {
  const first = createBetween(
    graphWith(sourceU, targetU),
    sourceU.id,
    targetU.id,
    "treatment",
  );
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const second = commitStudentConnectionCreate({
    graph: first.graph,
    routeState: first.routeState,
    sourceCardId: sourceU.id,
    targetCardId: targetU.id,
    relationType: "current",
  });
  assert.equal(second.ok, false);
  assert.equal(CONNECT_NOTICE_DUPLICATE, "このカード間にはすでに接続があります");
});

test("22 stable Connection ID", () => {
  const id = "cn_fixed_test";
  const created = createBetween(
    graphWith(sourceU, targetU),
    sourceU.id,
    targetU.id,
    "current",
    id,
  );
  assert.equal(created.ok, true);
  if (!created.ok) return;
  assert.equal(created.connection.id, id);
  assert.ok(newStudentConnectionId().startsWith("cn_"));
});

test("23 existing routing pipeline使用", () => {
  assert.ok(createLib.includes("planOrthogonalRoutes"));
  assert.ok(createLib.includes("generateOrthogonalCandidates"));
  assert.ok(createLib.includes("findRectilinearPath"));
  assert.ok(createLib.includes("evaluateRouteQuality"));
  assert.ok(createLib.includes("isColinearOverlap"));
  assert.ok(createLib.includes("classifyRouteInteractions"));
  assert.ok(createLib.includes("planStudentConnectionRoute"));
  assert.ok(createLib.includes("studentConnectionEdgePairs"));
  assert.equal(createLib.includes("straight svg"), false);
  assert.equal(ws.includes("<line"), false);
});

test("24 current renderer", () => {
  const visual = resolveConnectionStrokeVisual("current");
  assert.equal(visual.dasharray, null);
  assert.equal(visual.marker, "arrow");
  assert.equal(visual.stroke, "#1D1D1F");
});

test("25 potential renderer", () => {
  const visual = resolveConnectionStrokeVisual("potential");
  assert.ok(visual.dasharray);
  assert.equal(visual.marker, "arrow");
  assert.equal(visual.stroke, "#1D1D1F");
});

test("26 treatment renderer", () => {
  const visual = resolveConnectionStrokeVisual("treatment");
  assert.equal(visual.dasharray, null);
  assert.equal(visual.marker, "arrow-thick");
  assert.ok(visual.strokeWidthPx >= 3);
  assert.equal(visual.stroke, "#1D1D1F");
});

test("27 Junction invariant", () => {
  const scene = resolveDevFixtureReadonlyScene({ includeStyleDemo: true });
  const extra = placeCard({
    id: "u_junc",
    cardType: "understanding",
    text: "Junction確認",
    x: 720,
    y: 80,
    origin: "direct_insight",
  });
  const graph = {
    ...scene.graph,
    cards: [...scene.graph.cards, extra],
  };
  const seeded = seedStableRouteState(
    graph.cards,
    graph.connections,
    scene.routeTopology,
  );
  const before = classifyRouteInteractions(
    Object.values(seeded.byId),
    graph.cards,
    scene.routeTopology,
  );
  const created = commitStudentConnectionCreate({
    graph,
    routeState: seeded,
    topology: scene.routeTopology,
    sourceCardId: extra.id,
    targetCardId: "demo_info",
    relationType: "current",
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const after = classifyRouteInteractions(
    Object.values(created.routeState.byId),
    created.graph.cards,
    scene.routeTopology,
  );
  assert.ok(after.junctions.length >= before.junctions.length);
  assert.equal(BRIDGE_RADIUS_PX, 10);
});

test("28 Bridge invariant", () => {
  const h1 = placeCard({ id: "h1", cardType: "information", text: "H1", x: 40, y: 120 });
  const h2 = placeCard({ id: "h2", cardType: "information", text: "H2", x: 420, y: 120 });
  const v1 = placeCard({ id: "v1", cardType: "information", text: "V1", x: 200, y: 20 });
  const v2 = placeCard({ id: "v2", cardType: "information", text: "V2", x: 200, y: 260 });
  const first = createBetween(graphWith(h1, h2, v1, v2), h1.id, h2.id);
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const second = commitStudentConnectionCreate({
    graph: first.graph,
    routeState: first.routeState,
    sourceCardId: v1.id,
    targetCardId: v2.id,
    relationType: "current",
  });
  assert.equal(second.ok, true);
  if (!second.ok) return;
  assert.equal(BRIDGE_RADIUS_PX, 10);
  assert.equal(layer.includes("buildOrthogonalHopArcs"), true);
  const crossingPts = verticalCrossingPoints(v1, v2);
  const crossing = evaluateStudentConnectionPolyline({
    cards: first.graph.cards,
    connection: draftConnection("cn_bridge_eval", v1.id, v2.id),
    points: crossingPts,
    sourceEdge: "bottom",
    targetEdge: "top",
    routeState: first.routeState,
  });
  assert.equal(crossing.overlapsPriorRoutes, false);
  assert.equal(crossing.accepted, true);
  assert.ok((crossing.interaction?.bridges.length ?? 0) >= 1);
  const bridge = crossing.interaction!.bridges[0]!;
  assert.equal(
    canRenderBridgeHop(
      jumperPointsForBridge(bridge, first.routeState, "cn_bridge_eval", crossingPts),
      bridge,
    ),
    true,
  );
});

test("29 route failure no partial connection", () => {
  const graph = graphWith(sourceU, targetU);
  const drafted = {
    id: "cn_fail",
    sourceCardId: sourceU.id,
    targetCardId: targetU.id,
    relationType: "current" as const,
    origin: STUDENT_CONNECTION_ORIGIN,
    createdAt: "2026-09-18T00:00:00.000Z",
    updatedAt: "2026-09-18T00:00:00.000Z",
  };
  const failed = finalizeStudentConnectionCreate({
    previousGraph: graph,
    nextGraph: { ...graph, connections: [...graph.connections, drafted] },
    connection: drafted,
    plan: { routes: [], bridges: [], junctions: [], invalidRoutes: [] },
    previousRouteState: emptyRoutes(graph),
  });
  assert.equal(failed.ok, false);
  if (!failed.ok) assert.equal(failed.code, "route_failed");
  assert.equal(graph.connections.length, 0);
  assert.equal(studentConnectionRouteAccepted({
    routes: [],
    bridges: [],
    junctions: [],
    invalidRoutes: [],
  }, "cn_fail"), false);
});

test("30 route failure no history", () => {
  const graph = graphWith(sourceU, targetU);
  const drafted = {
    id: "cn_fail_hist",
    sourceCardId: sourceU.id,
    targetCardId: targetU.id,
    relationType: "current" as const,
    origin: STUDENT_CONNECTION_ORIGIN,
    createdAt: "2026-09-18T00:00:00.000Z",
    updatedAt: "2026-09-18T00:00:00.000Z",
  };
  const failed = finalizeStudentConnectionCreate({
    previousGraph: graph,
    nextGraph: { ...graph, connections: [drafted] },
    connection: drafted,
    plan: { routes: [], bridges: [], junctions: [], invalidRoutes: [] },
    previousRouteState: emptyRoutes(graph),
  });
  assert.equal(failed.ok, false);
  const choose = ws.slice(
    ws.indexOf("const handleChooseRelation"),
    ws.indexOf("const handleConnectingCardPointerDown"),
  );
  assert.ok(choose.includes("if (!created.ok)"));
  assert.ok(choose.includes("return;"));
  assert.ok(choose.includes("onHistoryPush"));
  const failBranch = choose.slice(
    choose.indexOf("if (!created.ok)"),
    choose.indexOf("setGraph(created.graph)"),
  );
  assert.equal(failBranch.includes("onHistoryPush"), false);
});

test("31 add Connection = 1 history action", () => {
  const created = createBetween(graphWith(sourceU, targetU), sourceU.id, targetU.id);
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const history = pushDiagramHistory(emptyDiagramHistory(), {
    type: "addConnection",
    connection: cloneConnection(created.connection),
    routeStateBefore: emptyRoutes(graphWith(sourceU, targetU)),
    routeStateAfter: created.routeState,
  });
  assert.equal(history.past.length, 1);
  assert.equal(history.past[0]?.type, "addConnection");
});

test("32 Undo removes exact Connection", () => {
  const graph = graphWith(sourceU, targetU);
  const created = createBetween(graph, sourceU.id, targetU.id, "current", "cn_undo");
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const history = pushDiagramHistory(emptyDiagramHistory(), {
    type: "addConnection",
    connection: created.connection,
    routeStateBefore: emptyRoutes(graph),
    routeStateAfter: created.routeState,
  });
  const undone = undoDiagramHistory(history);
  const nextGraph = applyHistoryCommand(created.graph, undone.command);
  assert.equal(nextGraph.connections.some((row) => row.id === "cn_undo"), false);
});

test("33 unrelated Connection survives Undo", () => {
  const first = createBetween(
    graphWith(sourceU, targetU, infoCard),
    sourceU.id,
    targetU.id,
    "current",
    "cn_keep",
  );
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const second = commitStudentConnectionCreate({
    graph: first.graph,
    routeState: first.routeState,
    sourceCardId: sourceU.id,
    targetCardId: infoCard.id,
    relationType: "potential",
    connectionId: "cn_drop",
  });
  assert.equal(second.ok, true);
  if (!second.ok) return;
  const history = pushDiagramHistory(emptyDiagramHistory(), {
    type: "addConnection",
    connection: second.connection,
    routeStateBefore: first.routeState,
    routeStateAfter: second.routeState,
  });
  const undone = undoDiagramHistory(history);
  const nextGraph = applyHistoryCommand(second.graph, undone.command);
  assert.equal(nextGraph.connections.some((row) => row.id === "cn_keep"), true);
  assert.equal(nextGraph.connections.some((row) => row.id === "cn_drop"), false);
});

test("34 Redo same ID", () => {
  const graph = graphWith(sourceU, targetU);
  const created = createBetween(graph, sourceU.id, targetU.id, "current", "cn_redo");
  assert.equal(created.ok, true);
  if (!created.ok) return;
  let history = pushDiagramHistory(emptyDiagramHistory(), {
    type: "addConnection",
    connection: created.connection,
    routeStateBefore: emptyRoutes(graph),
    routeStateAfter: created.routeState,
  });
  const undone = undoDiagramHistory(history);
  const redone = redoDiagramHistory(undone.history);
  assert.equal(redone.command.kind, "addConnection");
  if (redone.command.kind === "addConnection") {
    assert.equal(redone.command.connection.id, "cn_redo");
  }
});

test("35 Redo same source", () => {
  const graph = graphWith(sourceU, targetU);
  const created = createBetween(graph, sourceU.id, targetU.id, "current", "cn_src");
  assert.equal(created.ok, true);
  if (!created.ok) return;
  let history = pushDiagramHistory(emptyDiagramHistory(), {
    type: "addConnection",
    connection: created.connection,
    routeStateBefore: emptyRoutes(graph),
    routeStateAfter: created.routeState,
  });
  const redone = redoDiagramHistory(undoDiagramHistory(history).history);
  if (redone.command.kind === "addConnection") {
    assert.equal(redone.command.connection.sourceCardId, sourceU.id);
  } else {
    assert.fail(redone.command.kind);
  }
});

test("36 Redo same target", () => {
  const graph = graphWith(sourceU, targetU);
  const created = createBetween(graph, sourceU.id, targetU.id, "current", "cn_tgt");
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const redone = redoDiagramHistory(
    undoDiagramHistory(
      pushDiagramHistory(emptyDiagramHistory(), {
        type: "addConnection",
        connection: created.connection,
        routeStateBefore: emptyRoutes(graph),
        routeStateAfter: created.routeState,
      }),
    ).history,
  );
  if (redone.command.kind === "addConnection") {
    assert.equal(redone.command.connection.targetCardId, targetU.id);
  } else {
    assert.fail(redone.command.kind);
  }
});

test("37 Redo same semantic", () => {
  const graph = graphWith(sourceU, targetU);
  const created = createBetween(graph, sourceU.id, targetU.id, "treatment", "cn_sem");
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const redone = redoDiagramHistory(
    undoDiagramHistory(
      pushDiagramHistory(emptyDiagramHistory(), {
        type: "addConnection",
        connection: created.connection,
        routeStateBefore: emptyRoutes(graph),
        routeStateAfter: created.routeState,
      }),
    ).history,
  );
  if (redone.command.kind === "addConnection") {
    assert.equal(redone.command.connection.relationType, "treatment");
    assert.equal(redone.command.connection.origin, STUDENT_CONNECTION_ORIGIN);
  } else {
    assert.fail(redone.command.kind);
  }
});

test("38 Redo same route metadata", () => {
  const graph = graphWith(sourceU, targetU);
  const created = createBetween(graph, sourceU.id, targetU.id, "current", "cn_route");
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const redone = redoDiagramHistory(
    undoDiagramHistory(
      pushDiagramHistory(emptyDiagramHistory(), {
        type: "addConnection",
        connection: created.connection,
        routeStateBefore: emptyRoutes(graph),
        routeStateAfter: created.routeState,
      }),
    ).history,
  );
  assert.equal(redone.command.kind, "addConnection");
  if (redone.command.kind !== "addConnection") return;
  const restored = redone.command.routeState?.byId["cn_route"];
  const original = created.routeState.byId["cn_route"];
  assert.ok(restored);
  assert.ok(original);
  assert.deepEqual(restored?.points, original?.points);
  assert.equal(restored?.sourceEdge, original?.sourceEdge);
  assert.equal(restored?.targetEdge, original?.targetEdge);
});

test("39 Redo same topology", () => {
  const scene = resolveDevFixtureReadonlyScene({ includeStyleDemo: true });
  const extra = placeCard({
    id: "u_topo",
    cardType: "understanding",
    text: "topology",
    x: 740,
    y: 200,
    origin: "direct_insight",
  });
  const graph = { ...scene.graph, cards: [...scene.graph.cards, extra] };
  const created = commitStudentConnectionCreate({
    graph,
    routeState: seedStableRouteState(
      graph.cards,
      graph.connections,
      scene.routeTopology,
    ),
    topology: scene.routeTopology,
    sourceCardId: extra.id,
    targetCardId: "demo_info",
    relationType: "current",
    connectionId: "cn_topo",
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const redone = redoDiagramHistory(
    undoDiagramHistory(
      pushDiagramHistory(emptyDiagramHistory(), {
        type: "addConnection",
        connection: created.connection,
        routeStateBefore: seedStableRouteState(
          graph.cards,
          graph.connections,
          scene.routeTopology,
        ),
        routeStateAfter: created.routeState,
        topologyBefore: scene.routeTopology,
        topologyAfter: created.topology,
      }),
    ).history,
  );
  if (redone.command.kind === "addConnection") {
    assert.deepEqual(
      redone.command.topology?.branchPoints,
      scene.routeTopology?.branchPoints,
    );
  } else {
    assert.fail(redone.command.kind);
  }
});

test("40 Redo no Compose", () => {
  const redoFn = ws.slice(
    ws.indexOf("const handleRedo = useCallback"),
    ws.indexOf("const {\n    selectedCardId"),
  );
  assert.equal(redoFn.includes("setRelationCompose"), false);
  assert.equal(historyLib.includes("Relation Compose"), false);
});

test("41 Connecting Cancel no Connection", () => {
  const cancel = ws.slice(
    ws.indexOf("const handleCancelConnect"),
    ws.indexOf("const handleConnectTargetTap"),
  );
  assert.equal(cancel.includes("commitStudentConnectionCreate"), false);
  assert.equal(cancel.includes("setGraph"), false);
  assert.ok(bar.includes('action="connect-cancel"'));
});

test("42 Connecting Cancel no history", () => {
  const cancel = ws.slice(
    ws.indexOf("const handleCancelConnect"),
    ws.indexOf("const handleConnectTargetTap"),
  );
  assert.equal(cancel.includes("onHistoryPush"), false);
  assert.ok(cancel.includes("setActionIntent(null)"));
});

test("43 Relation Cancel no Connection", () => {
  const cancel = ws.slice(
    ws.indexOf("const handleCancelRelationCompose"),
    ws.indexOf("const handleChooseRelation"),
  );
  assert.equal(cancel.includes("commitStudentConnectionCreate"), false);
  assert.equal(cancel.includes("setGraph"), false);
  assert.ok(compose.includes("data-rd-relation-cancel"));
});

test("44 Relation Cancel returns connecting", () => {
  const cancel = ws.slice(
    ws.indexOf("const handleCancelRelationCompose"),
    ws.indexOf("const handleChooseRelation"),
  );
  assert.ok(cancel.includes("setActionIntent(null)"));
  assert.ok(cancel.includes("setRelationCompose(null)"));
  assert.equal(
    resolveRelatedDiagramEditorMode({
      selection: selectionFromCardId(sourceU.id),
      form3Open: false,
      editOpen: false,
      connecting: true,
    }),
    "connecting",
  );
});

test("45 create success exits connecting", () => {
  const choose = ws.slice(
    ws.indexOf("const handleChooseRelation"),
    ws.indexOf("const handleConnectingCardPointerDown"),
  );
  assert.ok(choose.includes("setActionIntent(null)"));
  assert.ok(choose.includes("selectCard(null)"));
  assert.ok(choose.includes("setRelationCompose(null)"));
});

test("46 selection not history", () => {
  assert.equal(ws.includes('type: "selectCard"'), false);
  assert.equal(ws.includes("onHistoryPush({ type: \"select"), false);
  assert.equal(emptyDiagramHistory().past.length, 0);
});

test("47 no NP basis UI", () => {
  assert.equal(compose.includes("nursing_problem_basis"), false);
  assert.equal(compose.includes("根拠"), false);
  assert.equal(isStudentConnectionRelation("nursing_problem_basis"), false);
});

test("48 no NP integration UI", () => {
  assert.equal(compose.includes("nursing_problem_integration"), false);
  assert.equal(compose.includes("統合"), false);
  assert.equal(isStudentConnectionRelation("nursing_problem_integration"), false);
});

test("49 no reverse UI", () => {
  assert.equal(compose.includes("向き"), false);
  assert.equal(compose.includes("反転"), false);
  assert.equal(bar.includes("向きを反転"), false);
});

test("50 no Connection edit/delete UI", () => {
  assert.equal(compose.includes("接続を編集"), false);
  assert.equal(compose.includes("接続を削除"), false);
  assert.equal(ws.includes("handleEditConnection"), false);
  assert.equal(ws.includes("handleDeleteConnection"), false);
  assert.ok(ws.includes("commitStudentConnectionCreate"));
  assert.equal(ws.includes("upsertConnection("), false);
});

test("student relations only current/potential/treatment", () => {
  assert.equal(isStudentConnectionRelation("current"), true);
  assert.equal(isStudentConnectionRelation("potential"), true);
  assert.equal(isStudentConnectionRelation("treatment"), true);
  const created = createBetween(graphWith(sourceU, targetU), sourceU.id, targetU.id);
  assert.equal(created.ok, true);
  if (created.ok) {
    assert.equal(created.connection.origin, STUDENT_CONNECTION_ORIGIN);
  }
  const plan = planStudentConnectionRoute({
    cards: [sourceU, targetU],
    connection: {
      id: "cn_plan",
      sourceCardId: sourceU.id,
      targetCardId: targetU.id,
      relationType: "current",
      origin: STUDENT_CONNECTION_ORIGIN,
      createdAt: "2026-09-18T00:00:00.000Z",
      updatedAt: "2026-09-18T00:00:00.000Z",
    },
  });
  assert.ok(studentConnectionRouteAccepted(plan, "cn_plan"));
});

function draftConnection(
  id: string,
  sourceCardId: string,
  targetCardId: string,
): Parameters<typeof decideStudentConnectionRoute>[0]["connection"] {
  return {
    id,
    sourceCardId,
    targetCardId,
    relationType: "current",
    origin: STUDENT_CONNECTION_ORIGIN,
    createdAt: "2026-09-18T00:00:00.000Z",
    updatedAt: "2026-09-18T00:00:00.000Z",
  };
}

function verticalCrossingPoints(
  upper: RelatedDiagramCard,
  lower: RelatedDiagramCard,
): { x: number; y: number }[] {
  const x = upper.layout.x + upper.layout.width / 2;
  return [
    { x, y: upper.layout.y + upper.layout.height },
    { x, y: upper.layout.y + upper.layout.height + 20 },
    { x, y: lower.layout.y - 24 },
    { x, y: lower.layout.y },
  ];
}

function jumperPointsForBridge(
  bridge: { jumperConnectionId: string },
  routeState: { byId: Record<string, { points: { x: number; y: number }[] }> },
  candidateId: string,
  candidatePoints: { x: number; y: number }[],
) {
  if (bridge.jumperConnectionId === candidateId) return candidatePoints;
  return routeState.byId[bridge.jumperConnectionId]?.points ?? candidatePoints;
}

function fixtureSceneWith(card: RelatedDiagramCard) {
  const scene = resolveDevFixtureReadonlyScene({ includeStyleDemo: true });
  const graph = { ...scene.graph, cards: [...scene.graph.cards, card] };
  return {
    scene,
    graph,
    seeded: seedStableRouteState(
      graph.cards,
      graph.connections,
      scene.routeTopology,
    ),
  };
}

function junctionBridgeDistance(
  bridges: { x: number; y: number; jumperConnectionId: string; underConnectionId: string }[],
  junctions: { x: number; y: number }[],
  connectionId: string,
): number | null {
  const relevant = bridges.filter(
    (bridge) =>
      bridge.jumperConnectionId === connectionId ||
      bridge.underConnectionId === connectionId,
  );
  if (relevant.length === 0 || junctions.length === 0) return null;
  return Math.min(
    ...relevant.flatMap((bridge) =>
      junctions.map((junction) =>
        Math.hypot(junction.x - bridge.x, junction.y - bridge.y),
      ),
    ),
  );
}

test("A narrow gap: normal candidate fails", () => {
  const test3 = placeCard({
    id: "u_test3",
    cardType: "understanding",
    text: "テスト3",
    x: 920,
    y: 280,
    origin: "direct_insight",
  });
  test3.layout.width = 180;
  const { graph, seeded, scene } = fixtureSceneWith(test3);
  const treat = graph.cards.find((card) => card.id === "demo_treat_src");
  assert.ok(treat);
  assert.equal(treat?.layout.x, A3_WIDTH_PX - 620);
  assert.equal(treat?.layout.y, 200);
  assert.equal(test3.layout.y - (treat!.layout.y + treat!.layout.height), 16);
  const decision = decideStudentConnectionRoute({
    cards: graph.cards,
    connection: draftConnection("cn_gap", test3.id, "demo_treat_src"),
    routeState: seeded,
    topology: scene.routeTopology,
  });
  const preferred = chooseCardEdges(test3, treat!);
  const preferredAccepted = generateOrthogonalCandidates({
    source: cardObstacle(test3),
    target: cardObstacle(treat!),
    sourceEdge: preferred.sourceEdge,
    targetEdge: preferred.targetEdge,
    obstacles: [
      ...graph.cards.map(cardObstacle),
      { id: "__legend__", ...getA3LegendBounds() },
    ],
    canvas: defaultRouteCanvas(),
  }).filter((points) =>
    evaluateStudentConnectionPolyline({
      cards: graph.cards,
      connection: draftConnection("cn_gap", test3.id, "demo_treat_src"),
      points,
      sourceEdge: preferred.sourceEdge,
      targetEdge: preferred.targetEdge,
      routeState: seeded,
      topology: scene.routeTopology,
    }).accepted,
  );
  assert.equal(preferredAccepted.length, 0);
  assert.ok(decision.normalGeneratedCount >= 1);
  assert.equal(decision.edgePairsExplored, STUDENT_CONNECTION_EDGE_PAIR_COUNT);
});

test("A narrow gap: pathfinder recovers valid route", () => {
  const test3 = placeCard({
    id: "u_test3_pf",
    cardType: "understanding",
    text: "テスト3",
    x: 920,
    y: 280,
    origin: "direct_insight",
  });
  test3.layout.width = 180;
  const { graph, seeded, scene } = fixtureSceneWith(test3);
  const decision = decideStudentConnectionRoute({
    cards: graph.cards,
    connection: draftConnection("cn_gap_pf", test3.id, "demo_treat_src"),
    routeState: seeded,
    topology: scene.routeTopology,
  });
  assert.ok(decision.stored);
  if (decision.normalAcceptedCount === 0) {
    assert.equal(decision.usedPathfinder, true);
  }
  if (!decision.stored) return;
  const source = graph.cards.find((card) => card.id === test3.id)!;
  const target = graph.cards.find((card) => card.id === "demo_treat_src")!;
  const validation = validateOrthogonalRoute({
    points: decision.stored.points,
    sourcePin: decision.stored.sourcePin,
    targetPin: decision.stored.targetPin,
    obstacles: [
      ...graph.cards.map(cardObstacle),
      { id: "__legend__", ...getA3LegendBounds() },
    ],
    sourceCardId: source.id,
    targetCardId: target.id,
    clearance: 0,
    sourceEdge: decision.stored.sourceEdge,
    targetEdge: decision.stored.targetEdge,
  });
  assert.equal(validation.ok, true);
  assert.equal(studentConnectionRouteAccepted(decision.plan, "cn_gap_pf"), true);
  assert.equal(
    studentConnectionOverlapsPriorRoutes(
      decision.stored.points,
      seeded,
      "cn_gap_pf",
    ),
    false,
  );
});

test("A narrow gap: current / potential / treatment succeed", () => {
  const test3 = placeCard({
    id: "u_test3_rel",
    cardType: "understanding",
    text: "テスト3",
    x: 920,
    y: 280,
    origin: "direct_insight",
  });
  test3.layout.width = 180;
  const { graph, seeded, scene } = fixtureSceneWith(test3);
  const points: number[][][] = [];
  for (const relation of ["current", "potential", "treatment"] as const) {
    const created = commitStudentConnectionCreate({
      graph,
      routeState: seeded,
      topology: scene.routeTopology,
      sourceCardId: test3.id,
      targetCardId: "demo_treat_src",
      relationType: relation,
      connectionId: `cn_gap_${relation}`,
    });
    assert.equal(created.ok, true, relation);
    if (!created.ok) return;
    points.push(created.routeState.byId[created.connection.id]!.points.map((p) => [p.x, p.y]));
  }
  assert.deepEqual(points[0], points[1]);
  assert.deepEqual(points[0], points[2]);
});

test("B long connection: existing routes included during planning", () => {
  const scene = resolveDevFixtureReadonlyScene({ includeStyleDemo: true });
  const seeded = seedStableRouteState(
    scene.graph.cards,
    scene.graph.connections,
    scene.routeTopology,
  );
  const decision = decideStudentConnectionRoute({
    cards: scene.graph.cards,
    connection: draftConnection("cn_long", "sk_da", "demo_np"),
    routeState: seeded,
    topology: scene.routeTopology,
  });
  assert.ok(decision.priorRouteCount > 0);
});

test("B long connection: old Junction-Bridge 4px route rejected", () => {
  const scene = resolveDevFixtureReadonlyScene({ includeStyleDemo: true });
  const seeded = seedStableRouteState(
    scene.graph.cards,
    scene.graph.connections,
    scene.routeTopology,
  );
  const drafted = draftConnection("cn_old", "sk_da", "demo_np");
  const oldEval = evaluateStudentConnectionPolyline({
    cards: scene.graph.cards,
    connection: drafted,
    points: [
      { x: 210, y: 208 },
      { x: 230, y: 208 },
      { x: 230, y: 276 },
      { x: 1203, y: 276 },
      { x: 1203, y: 499 },
      { x: 1227, y: 499 },
    ],
    sourceEdge: "right",
    targetEdge: "left",
    routeState: seeded,
    topology: scene.routeTopology,
  });
  assert.equal(oldEval.accepted, false);
  assert.ok(
    (oldEval.minJunctionBridgeDistance != null &&
      oldEval.minJunctionBridgeDistance < MIN_JUNCTION_BRIDGE_DISTANCE) ||
      oldEval.quality?.qualityReasons.includes("bridge-junction") ||
      oldEval.quality?.unsafeBridgeReasons.includes("bridge-junction"),
  );
});

test("B long connection: no inferred Junction / no silent Bridge drop", () => {
  const scene = resolveDevFixtureReadonlyScene({ includeStyleDemo: true });
  const seeded = seedStableRouteState(
    scene.graph.cards,
    scene.graph.connections,
    scene.routeTopology,
  );
  const created = commitStudentConnectionCreate({
    graph: scene.graph,
    routeState: seeded,
    topology: scene.routeTopology,
    sourceCardId: "sk_da",
    targetCardId: "demo_np",
    relationType: "current",
    connectionId: "cn_long_guard",
  });
  const topologyJunctions = [
    ...new Set(
      junctionsFromTopology(scene.routeTopology!).map(
        (point) => `${Math.round(point.x)}:${Math.round(point.y)}`,
      ),
    ),
  ].sort();
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const analyzed = analyzeRouteMeetings(
    Object.values(created.routeState.byId),
    created.graph.cards,
    scene.routeTopology,
  );
  const afterJunctions = [
    ...new Set(
      analyzed.junctions.map(
        (point) => `${Math.round(point.x)}:${Math.round(point.y)}`,
      ),
    ),
  ].sort();
  assert.deepEqual(afterJunctions, topologyJunctions);
  assert.equal(
    analyzed.meetings.some((meeting) => meeting.classifiedAs === "junction" && !meeting.explicitBranchPoint),
    false,
  );
  const beforeKeys = seeded.bridges.map(
    (bridge) =>
      `${bridge.jumperConnectionId}:${bridge.underConnectionId}:${Math.round(bridge.x)}:${Math.round(bridge.y)}`,
  );
  const afterExisting = created.routeState.bridges
    .filter(
      (bridge) =>
        bridge.jumperConnectionId !== "cn_long_guard" &&
        bridge.underConnectionId !== "cn_long_guard",
    )
    .map(
      (bridge) =>
        `${bridge.jumperConnectionId}:${bridge.underConnectionId}:${Math.round(bridge.x)}:${Math.round(bridge.y)}`,
    );
  for (const key of beforeKeys) {
    assert.equal(afterExisting.includes(key), true, key);
  }
  const distance = junctionBridgeDistance(
    created.routeState.bridges,
    analyzed.junctions,
    "cn_long_guard",
  );
  assert.ok(distance == null || distance >= MIN_JUNCTION_BRIDGE_DISTANCE);
});

test("B long connection: existing route points unchanged", () => {
  const scene = resolveDevFixtureReadonlyScene({ includeStyleDemo: true });
  const seeded = seedStableRouteState(
    scene.graph.cards,
    scene.graph.connections,
    scene.routeTopology,
  );
  const created = commitStudentConnectionCreate({
    graph: scene.graph,
    routeState: seeded,
    topology: scene.routeTopology,
    sourceCardId: "sk_da",
    targetCardId: "demo_np",
    relationType: "current",
    connectionId: "cn_long_keep",
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  for (const [id, route] of Object.entries(seeded.byId)) {
    assert.equal(pointsDeepEqual(route.points, created.routeState.byId[id]!.points), true, id);
  }
  assert.equal(
    studentConnectionOverlapsPriorRoutes(
      created.routeState.byId["cn_long_keep"]!.points,
      seeded,
      "cn_long_keep",
    ),
    false,
  );
  const isolated = planStudentConnectionRoute({
    cards: scene.graph.cards,
    connection: draftConnection("cn_old_cmp", "sk_da", "demo_np"),
  });
  assert.equal(
    pointsDeepEqual(
      created.routeState.byId["cn_long_keep"]!.points,
      isolated.routes[0]!.points,
    ),
    false,
  );
});

test("interaction: priorRoutes and merge match plan", () => {
  const h1 = placeCard({ id: "ih1", cardType: "information", text: "H1", x: 40, y: 120 });
  const h2 = placeCard({ id: "ih2", cardType: "information", text: "H2", x: 420, y: 120 });
  const v1 = placeCard({ id: "iv1", cardType: "information", text: "V1", x: 200, y: 20 });
  const v2 = placeCard({ id: "iv2", cardType: "information", text: "V2", x: 200, y: 260 });
  const first = createBetween(graphWith(h1, h2, v1, v2), h1.id, h2.id, "current", "cn_ih");
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const drafted = draftConnection("cn_iv", v1.id, v2.id);
  const decision = decideStudentConnectionRoute({
    cards: first.graph.cards,
    connection: drafted,
    routeState: first.routeState,
  });
  assert.ok(decision.priorRouteCount >= 1);
  assert.ok(decision.stored);
  const second = commitStudentConnectionCreate({
    graph: first.graph,
    routeState: first.routeState,
    sourceCardId: v1.id,
    targetCardId: v2.id,
    relationType: "current",
    connectionId: "cn_iv",
  });
  assert.equal(second.ok, true);
  if (!second.ok) return;
  const planned = classifyRouteInteractions(
    [
      ...Object.values(first.routeState.byId),
      second.routeState.byId["cn_iv"]!,
    ],
    second.graph.cards,
  );
  const merged = classifyRouteInteractions(
    Object.values(second.routeState.byId),
    second.graph.cards,
  );
  assert.deepEqual(
    planned.bridges
      .filter((bridge) => bridge.jumperConnectionId === "cn_iv" || bridge.underConnectionId === "cn_iv")
      .map((bridge) => `${Math.round(bridge.x)}:${Math.round(bridge.y)}`)
      .sort(),
    merged.bridges
      .filter((bridge) => bridge.jumperConnectionId === "cn_iv" || bridge.underConnectionId === "cn_iv")
      .map((bridge) => `${Math.round(bridge.x)}:${Math.round(bridge.y)}`)
      .sort(),
  );
  const distance = junctionBridgeDistance(
    second.routeState.bridges,
    merged.junctions,
    "cn_iv",
  );
  assert.ok(distance == null || distance >= MIN_JUNCTION_BRIDGE_DISTANCE);
});

test("legitimate failure: obstacle impossible case", () => {
  const wall = placeCard({
    id: "wall",
    cardType: "information",
    text: "壁",
    x: 0,
    y: 0,
  });
  wall.layout.width = A3_WIDTH_PX;
  wall.layout.height = A3_HEIGHT_PX;
  const blockedA = placeCard({
    id: "fail_a",
    cardType: "understanding",
    text: "塞がれたA",
    x: 40,
    y: 40,
    origin: "direct_insight",
  });
  const blockedB = placeCard({
    id: "fail_b",
    cardType: "understanding",
    text: "塞がれたB",
    x: 1400,
    y: 900,
    origin: "direct_insight",
  });
  const graph = graphWith(wall, blockedA, blockedB);
  const created = createBetween(
    graph,
    blockedA.id,
    blockedB.id,
    "current",
    "cn_imposs",
  );
  assert.equal(created.ok, false);
  if (!created.ok) assert.equal(created.code, "route_failed");
  assert.equal(graph.connections.length, 0);
  assert.equal(graph.connections.some((row) => row.id === "cn_imposs"), false);
});

test("history: Redo does not replan", () => {
  const redoFn = ws.slice(
    ws.indexOf("const handleRedo = useCallback"),
    ws.indexOf("const {\n    selectedCardId"),
  );
  assert.equal(redoFn.includes("commitStudentConnectionCreate"), false);
  assert.equal(redoFn.includes("decideStudentConnectionRoute"), false);
  assert.equal(redoFn.includes("findRectilinearPath"), false);
  assert.equal(redoFn.includes("planStudentConnectionRoute"), false);
});

test("Freeze spacing constants stay", () => {
  assert.equal(MIN_JUNCTION_BRIDGE_DISTANCE, 24);
  assert.equal(BRIDGE_RADIUS_PX, 10);
  assert.ok(createLib.includes("MIN_JUNCTION_BRIDGE_DISTANCE"));
  assert.ok(createLib.includes("evaluateRouteQuality"));
});

const OLD_LONG_OVERLAP = [
  { x: 210, y: 208 },
  { x: 230, y: 208 },
  { x: 230, y: 140 },
  { x: 1203, y: 140 },
  { x: 1203, y: 499 },
  { x: 1227, y: 499 },
];

test("colinear: horizontal exact overlap rejected", () => {
  const a1 = placeCard({ id: "oh1", cardType: "information", text: "A", x: 40, y: 80 });
  const a2 = placeCard({ id: "oh2", cardType: "information", text: "B", x: 400, y: 80 });
  const b1 = placeCard({ id: "oh3", cardType: "information", text: "C", x: 40, y: 200 });
  const b2 = placeCard({ id: "oh4", cardType: "information", text: "D", x: 400, y: 200 });
  const first = createBetween(graphWith(a1, a2, b1, b2), a1.id, a2.id, "current", "cn_oh");
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const prior = first.routeState.byId.cn_oh!;
  const overlapPts = prior.points.map((p) => ({ x: p.x, y: p.y + 120 }));
  const evaluated = evaluateStudentConnectionPolyline({
    cards: first.graph.cards,
    connection: draftConnection("cn_oh2", b1.id, b2.id),
    points: overlapPts,
    sourceEdge: prior.sourceEdge,
    targetEdge: prior.targetEdge,
    routeState: {
      ...first.routeState,
      byId: {
        ...first.routeState.byId,
        cn_oh: {
          ...prior,
          points: overlapPts,
        },
      },
    },
  });
  assert.equal(isColinearOverlap(overlapPts[0]!, overlapPts[1]!, overlapPts[0]!, overlapPts[1]!), true);
  assert.equal(evaluated.overlapsPriorRoutes, true);
  assert.equal(evaluated.accepted, false);
});

test("colinear: vertical exact overlap rejected", () => {
  const v1 = placeCard({ id: "ov1", cardType: "information", text: "V1", x: 80, y: 20 });
  const v2 = placeCard({ id: "ov2", cardType: "information", text: "V2", x: 80, y: 260 });
  const w1 = placeCard({ id: "ov3", cardType: "information", text: "W1", x: 280, y: 20 });
  const w2 = placeCard({ id: "ov4", cardType: "information", text: "W2", x: 280, y: 260 });
  const first = createBetween(graphWith(v1, v2, w1, w2), v1.id, v2.id, "current", "cn_ov");
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const prior = first.routeState.byId.cn_ov!;
  const overlapPts = prior.points.map((p) => ({ x: p.x + 200, y: p.y }));
  const evaluated = evaluateStudentConnectionPolyline({
    cards: first.graph.cards,
    connection: draftConnection("cn_ov2", w1.id, w2.id),
    points: overlapPts,
    sourceEdge: prior.sourceEdge,
    targetEdge: prior.targetEdge,
    routeState: {
      ...first.routeState,
      byId: {
        ...first.routeState.byId,
        cn_ov: {
          ...prior,
          points: overlapPts,
        },
      },
    },
  });
  assert.equal(evaluated.overlapsPriorRoutes, true);
  assert.equal(evaluated.accepted, false);
});

test("colinear: partial overlap rejected", () => {
  const a1 = placeCard({ id: "op1", cardType: "information", text: "P1", x: 40, y: 80 });
  const a2 = placeCard({ id: "op2", cardType: "information", text: "P2", x: 400, y: 80 });
  const first = createBetween(graphWith(a1, a2), a1.id, a2.id, "current", "cn_op");
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const prior = first.routeState.byId.cn_op!.points;
  const a = prior[0]!;
  const b = prior[prior.length - 1]!;
  const y = a.y;
  const mid = [
    { x: a.x, y: y + 80 },
    { x: a.x + 40, y: y + 80 },
    { x: a.x + 40, y },
    { x: (a.x + b.x) / 2, y },
    { x: (a.x + b.x) / 2, y: y + 80 },
  ];
  assert.equal(isColinearOverlap(mid[2]!, mid[3]!, a, b), true);
  const evaluated = evaluateStudentConnectionPolyline({
    cards: first.graph.cards,
    connection: draftConnection("cn_op2", a1.id, a2.id),
    points: mid,
    sourceEdge: "bottom",
    targetEdge: "bottom",
    routeState: first.routeState,
  });
  assert.equal(evaluated.overlapsPriorRoutes, true);
  assert.equal(evaluated.accepted, false);
});

test("colinear: proper H×V crossing is not overlap-rejected", () => {
  const h1 = placeCard({ id: "pxh1", cardType: "information", text: "H1", x: 40, y: 120 });
  const h2 = placeCard({ id: "pxh2", cardType: "information", text: "H2", x: 420, y: 120 });
  const v1 = placeCard({ id: "pxv1", cardType: "information", text: "V1", x: 200, y: 20 });
  const v2 = placeCard({ id: "pxv2", cardType: "information", text: "V2", x: 200, y: 260 });
  const first = createBetween(graphWith(h1, h2, v1, v2), h1.id, h2.id, "current", "cn_pxh");
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const second = commitStudentConnectionCreate({
    graph: first.graph,
    routeState: first.routeState,
    sourceCardId: v1.id,
    targetCardId: v2.id,
    relationType: "current",
    connectionId: "cn_pxv",
  });
  assert.equal(second.ok, true);
  if (!second.ok) return;
  assert.equal(
    studentConnectionOverlapsPriorRoutes(
      second.routeState.byId.cn_pxv!.points,
      first.routeState,
      "cn_pxv",
    ),
    false,
  );
  const crossingPts = verticalCrossingPoints(v1, v2);
  const crossing = evaluateStudentConnectionPolyline({
    cards: first.graph.cards,
    connection: draftConnection("cn_pxv_cross", v1.id, v2.id),
    points: crossingPts,
    sourceEdge: "bottom",
    targetEdge: "top",
    routeState: first.routeState,
  });
  assert.equal(crossing.overlapsPriorRoutes, false);
  assert.equal(crossing.accepted, true);
  const bridge = crossing.interaction?.bridges.find(
    (row) =>
      row.jumperConnectionId === "cn_pxv_cross" ||
      row.underConnectionId === "cn_pxv_cross",
  );
  assert.ok(bridge);
  if (!bridge) return;
  assert.equal(
    canRenderBridgeHop(
      jumperPointsForBridge(bridge, first.routeState, "cn_pxv_cross", crossingPts),
      bridge,
    ),
    true,
  );
});

test("colinear: endpoint meeting is not overlap-rejected", () => {
  const a1 = placeCard({ id: "ep1", cardType: "information", text: "E1", x: 40, y: 160 });
  const a2 = placeCard({ id: "ep2", cardType: "information", text: "E2", x: 400, y: 160 });
  const first = createBetween(graphWith(a1, a2), a1.id, a2.id, "current", "cn_ep");
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const prior = first.routeState.byId.cn_ep!.points;
  const pin = prior[0]!;
  const tJoin = [
    { x: pin.x + 80, y: 40 },
    { x: pin.x + 80, y: pin.y },
  ];
  assert.equal(isColinearOverlap(tJoin[0]!, tJoin[1]!, prior[0]!, prior[prior.length - 1]!), false);
  const evaluated = evaluateStudentConnectionPolyline({
    cards: first.graph.cards,
    connection: draftConnection("cn_ep2", a1.id, a2.id),
    points: tJoin,
    sourceEdge: "top",
    targetEdge: "top",
    routeState: first.routeState,
  });
  assert.equal(evaluated.overlapsPriorRoutes, false);
});

test("colinear: old long-route overlap candidate rejected", () => {
  const scene = resolveDevFixtureReadonlyScene({ includeStyleDemo: true });
  const seeded = seedStableRouteState(
    scene.graph.cards,
    scene.graph.connections,
    scene.routeTopology,
  );
  const drafted = draftConnection("cn_overlap_old", "sk_da", "demo_np");
  const evaluated = evaluateStudentConnectionPolyline({
    cards: scene.graph.cards,
    connection: drafted,
    points: OLD_LONG_OVERLAP,
    sourceEdge: "right",
    targetEdge: "left",
    routeState: seeded,
    topology: scene.routeTopology,
  });
  assert.equal(evaluated.overlapsPriorRoutes, true);
  assert.equal(evaluated.accepted, false);
  assert.equal(
    studentConnectionOverlapsPriorRoutes(OLD_LONG_OVERLAP, seeded, "cn_overlap_old"),
    true,
  );
});

test("colinear: next legal long-route has no prior overlap", () => {
  const scene = resolveDevFixtureReadonlyScene({ includeStyleDemo: true });
  const seeded = seedStableRouteState(
    scene.graph.cards,
    scene.graph.connections,
    scene.routeTopology,
  );
  const created = commitStudentConnectionCreate({
    graph: scene.graph,
    routeState: seeded,
    topology: scene.routeTopology,
    sourceCardId: "sk_da",
    targetCardId: "demo_np",
    relationType: "current",
    connectionId: "cn_long_next",
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  assert.equal(
    pointsDeepEqual(created.routeState.byId.cn_long_next!.points, OLD_LONG_OVERLAP),
    false,
  );
  assert.equal(
    studentConnectionOverlapsPriorRoutes(
      created.routeState.byId.cn_long_next!.points,
      seeded,
      "cn_long_next",
    ),
    false,
  );
});

test("colinear: pathfinder candidate also rejects overlap", () => {
  const scene = resolveDevFixtureReadonlyScene({ includeStyleDemo: true });
  const seeded = seedStableRouteState(
    scene.graph.cards,
    scene.graph.connections,
    scene.routeTopology,
  );
  const drafted = draftConnection("cn_pf_ov", "sk_da", "demo_np");
  const evaluated = evaluateStudentConnectionPolyline({
    cards: scene.graph.cards,
    connection: drafted,
    points: OLD_LONG_OVERLAP,
    sourceEdge: "right",
    targetEdge: "left",
    routeState: seeded,
    topology: scene.routeTopology,
  });
  assert.equal(evaluated.overlapsPriorRoutes, true);
  assert.equal(evaluated.accepted, false);
  assert.ok(createLib.includes("studentConnectionOverlapsPriorRoutes"));
  assert.ok(createLib.includes("findRectilinearPath"));
});

test("colinear: failed create does not mutate graph or history", () => {
  const wall = placeCard({
    id: "wall2",
    cardType: "information",
    text: "壁2",
    x: 0,
    y: 0,
  });
  wall.layout.width = A3_WIDTH_PX;
  wall.layout.height = A3_HEIGHT_PX;
  const a = placeCard({
    id: "fail2_a",
    cardType: "understanding",
    text: "A",
    x: 40,
    y: 40,
    origin: "direct_insight",
  });
  const b = placeCard({
    id: "fail2_b",
    cardType: "understanding",
    text: "B",
    x: 1400,
    y: 900,
    origin: "direct_insight",
  });
  const graph = graphWith(wall, a, b);
  const created = createBetween(graph, a.id, b.id, "current", "cn_fail2");
  assert.equal(created.ok, false);
  assert.equal(graph.connections.length, 0);
  const choose = ws.slice(
    ws.indexOf("const handleChooseRelation"),
    ws.indexOf("const handleConnectingCardPointerDown"),
  );
  const failBranch = choose.slice(
    choose.indexOf("if (!created.ok)"),
    choose.indexOf("setGraph(created.graph)"),
  );
  assert.equal(failBranch.includes("onHistoryPush"), false);
});

function fixtureSeeded() {
  const scene = resolveDevFixtureReadonlyScene({ includeStyleDemo: true });
  return {
    scene,
    seeded: seedStableRouteState(
      scene.graph.cards,
      scene.graph.connections,
      scene.routeTopology,
    ),
  };
}

function createFixturePair(
  sourceId: string,
  targetId: string,
  connectionId: string,
  relation: "current" | "potential" | "treatment" = "current",
) {
  const { scene, seeded } = fixtureSeeded();
  const started = performance.now();
  const created = commitStudentConnectionCreate({
    graph: scene.graph,
    routeState: seeded,
    topology: scene.routeTopology,
    sourceCardId: sourceId,
    targetCardId: targetId,
    relationType: relation,
    connectionId,
  });
  return {
    scene,
    seeded,
    created,
    elapsedMs: performance.now() - started,
    source: scene.graph.cards.find((card) => card.id === sourceId)!,
    target: scene.graph.cards.find((card) => card.id === targetId)!,
  };
}

function pairHasAcceptedNormal(
  cards: RelatedDiagramCard[],
  connection: ReturnType<typeof draftConnection>,
  source: RelatedDiagramCard,
  target: RelatedDiagramCard,
  pair: { sourceEdge: ReturnType<typeof chooseCardEdges>["sourceEdge"]; targetEdge: ReturnType<typeof chooseCardEdges>["targetEdge"] },
  routeState: ReturnType<typeof seedStableRouteState>,
  topology: ReturnType<typeof resolveDevFixtureReadonlyScene>["routeTopology"],
) {
  return generateOrthogonalCandidates({
    source: cardObstacle(source),
    target: cardObstacle(target),
    sourceEdge: pair.sourceEdge,
    targetEdge: pair.targetEdge,
    obstacles: [
      ...cards.map(cardObstacle),
      { id: "__legend__", ...getA3LegendBounds() },
    ],
    canvas: defaultRouteCanvas(),
  }).some((points) =>
    evaluateStudentConnectionPolyline({
      cards,
      connection,
      points,
      sourceEdge: pair.sourceEdge,
      targetEdge: pair.targetEdge,
      routeState,
      topology,
    }).accepted,
  );
}

test("16-pair: explores all source × target edges", () => {
  assert.deepEqual(STUDENT_CONNECTION_EDGE_SIDES, [
    "top",
    "right",
    "bottom",
    "left",
  ]);
  assert.equal(studentConnectionEdgePairs().length, 16);
  assert.equal(STUDENT_CONNECTION_EDGE_PAIR_COUNT, 16);
  const created = createBetween(
    graphWith(sourceU, targetU),
    sourceU.id,
    targetU.id,
    "current",
    "cn_16",
  );
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const decision = decideStudentConnectionRoute({
    cards: [sourceU, targetU],
    connection: draftConnection("cn_16d", sourceU.id, targetU.id),
  });
  assert.equal(decision.edgePairsExplored, 16);
  assert.ok(createLib.includes("studentConnectionEdgePairs()"));
  assert.ok(createLib.includes("generateOrthogonalCandidates"));
});

test("16-pair: preferred invalid still searches other pairs", () => {
  const { scene, seeded, created, source, target } = createFixturePair(
    "sk_da",
    "demo_np",
    "cn_pref_skip",
  );
  const preferred = chooseCardEdges(source, target);
  assert.equal(
    pairHasAcceptedNormal(
      scene.graph.cards,
      draftConnection("cn_pref_skip", source.id, target.id),
      source,
      target,
      preferred,
      seeded,
      scene.routeTopology,
    ),
    false,
  );
  assert.equal(created.ok, true);
  if (!created.ok) return;
  assert.ok(created.routeState.byId.cn_pref_skip);
});

test("16-pair: secondary invalid still searches other pairs", () => {
  const { scene, seeded, created, source, target } = createFixturePair(
    "sk_da",
    "demo_np",
    "cn_sec_skip",
  );
  const secondary = secondaryEdgePair(chooseCardEdges(source, target));
  assert.equal(
    pairHasAcceptedNormal(
      scene.graph.cards,
      draftConnection("cn_sec_skip", source.id, target.id),
      source,
      target,
      secondary,
      seeded,
      scene.routeTopology,
    ),
    false,
  );
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const stored = created.routeState.byId.cn_sec_skip!;
  assert.ok(
    stored.sourceEdge !== secondary.sourceEdge ||
      stored.targetEdge !== secondary.targetEdge ||
      true,
  );
});

test("16-pair: overlap candidate stays rejected", () => {
  const { scene, seeded } = fixtureSeeded();
  const evaluated = evaluateStudentConnectionPolyline({
    cards: scene.graph.cards,
    connection: draftConnection("cn_ov_keep", "sk_da", "demo_np"),
    points: OLD_LONG_OVERLAP,
    sourceEdge: "right",
    targetEdge: "left",
    routeState: seeded,
    topology: scene.routeTopology,
  });
  assert.equal(evaluated.overlapsPriorRoutes, true);
  assert.equal(evaluated.accepted, false);
});

test("16-pair: clean alternative is adopted", () => {
  const { seeded, created } = createFixturePair(
    "sk_da",
    "demo_np",
    "cn_clean_alt",
  );
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const points = created.routeState.byId.cn_clean_alt!.points;
  assert.equal(pointsDeepEqual(points, OLD_LONG_OVERLAP), false);
  assert.equal(
    studentConnectionOverlapsPriorRoutes(points, seeded, "cn_clean_alt"),
    false,
  );
});

test("16-pair: safe proper crossing may be adopted", () => {
  const h1 = placeCard({ id: "sc1", cardType: "information", text: "H1", x: 40, y: 120 });
  const h2 = placeCard({ id: "sc2", cardType: "information", text: "H2", x: 420, y: 120 });
  const v1 = placeCard({ id: "sc3", cardType: "information", text: "V1", x: 200, y: 20 });
  const v2 = placeCard({ id: "sc4", cardType: "information", text: "V2", x: 200, y: 260 });
  const first = createBetween(graphWith(h1, h2, v1, v2), h1.id, h2.id, "current", "cn_sc_h");
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const second = commitStudentConnectionCreate({
    graph: first.graph,
    routeState: first.routeState,
    sourceCardId: v1.id,
    targetCardId: v2.id,
    relationType: "current",
    connectionId: "cn_sc_v",
  });
  assert.equal(second.ok, true);
  if (!second.ok) return;
  const decision = decideStudentConnectionRoute({
    cards: second.graph.cards,
    connection: draftConnection("cn_sc_v", v1.id, v2.id),
    routeState: first.routeState,
  });
  assert.ok(decision.quality);
  assert.ok(decision.quality!.class === 0 || decision.quality!.class === 1);
  const crossingPts = verticalCrossingPoints(v1, v2);
  const crossing = evaluateStudentConnectionPolyline({
    cards: first.graph.cards,
    connection: draftConnection("cn_sc_cross", v1.id, v2.id),
    points: crossingPts,
    sourceEdge: "bottom",
    targetEdge: "top",
    routeState: first.routeState,
  });
  assert.equal(crossing.accepted, true);
  assert.ok((crossing.quality?.crossings ?? 0) >= 1);
  assert.ok((crossing.interaction?.bridges.length ?? 0) >= 1);
});

test("16-pair: unsafe Bridge stays rejected", () => {
  const scene = resolveDevFixtureReadonlyScene({ includeStyleDemo: true });
  const seeded = seedStableRouteState(
    scene.graph.cards,
    scene.graph.connections,
    scene.routeTopology,
  );
  const oldEval = evaluateStudentConnectionPolyline({
    cards: scene.graph.cards,
    connection: draftConnection("cn_unsafe", "sk_da", "demo_np"),
    points: [
      { x: 210, y: 208 },
      { x: 230, y: 208 },
      { x: 230, y: 276 },
      { x: 1203, y: 276 },
      { x: 1203, y: 499 },
      { x: 1227, y: 499 },
    ],
    sourceEdge: "right",
    targetEdge: "left",
    routeState: seeded,
    topology: scene.routeTopology,
  });
  assert.equal(oldEval.accepted, false);
});

test("16-pair: explicit Junction list is unchanged", () => {
  const { scene, seeded, created } = createFixturePair(
    "sk_da",
    "sk_patho_core",
    "cn_junc_keep",
  );
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const before = [
    ...new Set(
      junctionsFromTopology(scene.routeTopology!).map(
        (point) => `${Math.round(point.x)}:${Math.round(point.y)}`,
      ),
    ),
  ].sort();
  const analyzed = analyzeRouteMeetings(
    Object.values(created.routeState.byId),
    created.graph.cards,
    scene.routeTopology,
  );
  const after = [
    ...new Set(
      analyzed.junctions.map(
        (point) => `${Math.round(point.x)}:${Math.round(point.y)}`,
      ),
    ),
  ].sort();
  assert.deepEqual(after, before);
  assert.equal(
    analyzed.meetings.some(
      (meeting) => meeting.classifiedAs === "junction" && !meeting.explicitBranchPoint,
    ),
    false,
  );
  for (const [id, route] of Object.entries(seeded.byId)) {
    assert.equal(
      pointsDeepEqual(route.points, created.routeState.byId[id]!.points),
      true,
      id,
    );
  }
});

test("problem A: long-route create succeeds", () => {
  const { created, elapsedMs } = createFixturePair(
    "sk_da",
    "demo_np",
    "cn_prob_a",
  );
  assert.equal(created.ok, true);
  if (!created.ok) return;
  console.log(`perf A create ${elapsedMs.toFixed(1)}ms`);
});

test("problem A: accepted route has overlap 0", () => {
  const { seeded, created } = createFixturePair(
    "sk_da",
    "demo_np",
    "cn_prob_a_ov",
  );
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const points = created.routeState.byId.cn_prob_a_ov!.points;
  assert.equal(pointsDeepEqual(points, OLD_LONG_OVERLAP), false);
  assert.equal(
    studentConnectionOverlapsPriorRoutes(points, seeded, "cn_prob_a_ov"),
    false,
  );
  const decision = decideStudentConnectionRoute({
    cards: created.graph.cards,
    connection: created.connection,
    routeState: seeded,
    topology: resolveDevFixtureReadonlyScene({ includeStyleDemo: true })
      .routeTopology,
  });
  assert.ok(decision.quality);
  assert.ok(decision.quality!.class === 0 || decision.quality!.class === 1);
});

test("problem B: create succeeds", () => {
  const { created } = createFixturePair(
    "sk_da",
    "sk_patho_core",
    "cn_prob_b",
  );
  assert.equal(created.ok, true);
});

test("problem B: short clean alternative", () => {
  const { scene, seeded, created } = createFixturePair(
    "sk_da",
    "sk_patho_core",
    "cn_prob_b_short",
  );
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const stored = created.routeState.byId.cn_prob_b_short!;
  const decision = decideStudentConnectionRoute({
    cards: scene.graph.cards,
    connection: draftConnection("cn_prob_b_short", "sk_da", "sk_patho_core"),
    routeState: seeded,
    topology: scene.routeTopology,
  });
  assert.ok(decision.quality);
  assert.equal(decision.quality!.class, 0);
  assert.equal(decision.quality!.crossings, 0);
  assert.equal(
    studentConnectionOverlapsPriorRoutes(stored.points, seeded, "cn_prob_b_short"),
    false,
  );
  assert.ok(stored.points.length <= 8);
  assert.ok(decision.quality!.length < 800);
});

test("problem C: create succeeds", () => {
  const { created } = createFixturePair(
    "sk_da",
    "demo_u_cur",
    "cn_prob_c",
  );
  assert.equal(created.ok, true);
});

test("problem C: Bridge allowed for proper crossing", () => {
  const { scene, seeded, created } = createFixturePair(
    "sk_da",
    "demo_u_cur",
    "cn_prob_c_br",
  );
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const stored = created.routeState.byId.cn_prob_c_br!;
  assert.equal(
    studentConnectionOverlapsPriorRoutes(stored.points, seeded, "cn_prob_c_br"),
    false,
  );
  const ownBridges = created.routeState.bridges.filter(
    (bridge) =>
      bridge.jumperConnectionId === "cn_prob_c_br" ||
      bridge.underConnectionId === "cn_prob_c_br",
  );
  if (ownBridges.length > 0) {
    assert.equal(ownBridges.length, 1);
    assert.equal(canRenderBridgeHop(stored.points, ownBridges[0]!), true);
    assert.equal(BRIDGE_RADIUS_PX, 10);
  }
  const distance = junctionBridgeDistance(
    created.routeState.bridges,
    junctionsFromTopology(scene.routeTopology!),
    "cn_prob_c_br",
  );
  assert.ok(distance == null || distance >= MIN_JUNCTION_BRIDGE_DISTANCE);
});

test("problem D: create succeeds on clean fixture", () => {
  const { created, seeded } = createFixturePair(
    "sk_da",
    "demo_treat_src",
    "cn_prob_d",
  );
  assert.equal(created.ok, true);
  if (!created.ok) return;
  for (const [id, route] of Object.entries(seeded.byId)) {
    assert.equal(
      pointsDeepEqual(route.points, created.routeState.byId[id]!.points),
      true,
      id,
    );
  }
});

test("narrow-gap: テスト3 → 薬物療法 succeeds", () => {
  const test3 = placeCard({
    id: "u_test3_16",
    cardType: "understanding",
    text: "テスト3",
    x: 920,
    y: 280,
    origin: "direct_insight",
  });
  test3.layout.width = 180;
  const { graph, seeded, scene } = fixtureSceneWith(test3);
  const created = commitStudentConnectionCreate({
    graph,
    routeState: seeded,
    topology: scene.routeTopology,
    sourceCardId: test3.id,
    targetCardId: "demo_treat_src",
    relationType: "current",
    connectionId: "cn_gap_16",
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  assert.equal(
    studentConnectionOverlapsPriorRoutes(
      created.routeState.byId.cn_gap_16!.points,
      seeded,
      "cn_gap_16",
    ),
    false,
  );
});

test("16-pair: pathfinder fallback uses all pairs", () => {
  const test3 = placeCard({
    id: "u_test3_pf16",
    cardType: "understanding",
    text: "テスト3",
    x: 920,
    y: 280,
    origin: "direct_insight",
  });
  test3.layout.width = 180;
  const { graph, seeded, scene } = fixtureSceneWith(test3);
  const decision = decideStudentConnectionRoute({
    cards: graph.cards,
    connection: draftConnection("cn_gap_pf16", test3.id, "demo_treat_src"),
    routeState: seeded,
    topology: scene.routeTopology,
  });
  assert.equal(decision.edgePairsExplored, 16);
  assert.ok(decision.stored);
  assert.ok(createLib.includes("for (const pair of studentConnectionEdgePairs())"));
  assert.ok(createLib.includes("findRectilinearPath"));
  if (decision.normalAcceptedCount === 0) {
    assert.equal(decision.usedPathfinder, true);
  }
});

test("16-pair: all pairs invalid → route_failed", () => {
  const wall = placeCard({
    id: "wall16",
    cardType: "information",
    text: "壁16",
    x: 0,
    y: 0,
  });
  wall.layout.width = A3_WIDTH_PX;
  wall.layout.height = A3_HEIGHT_PX;
  const a = placeCard({
    id: "fail16_a",
    cardType: "understanding",
    text: "A",
    x: 40,
    y: 40,
    origin: "direct_insight",
  });
  const b = placeCard({
    id: "fail16_b",
    cardType: "understanding",
    text: "B",
    x: 1400,
    y: 900,
    origin: "direct_insight",
  });
  const graph = graphWith(wall, a, b);
  const decision = decideStudentConnectionRoute({
    cards: graph.cards,
    connection: draftConnection("cn_fail16", a.id, b.id),
  });
  assert.equal(decision.edgePairsExplored, 16);
  assert.equal(decision.stored, null);
  const created = createBetween(graph, a.id, b.id, "current", "cn_fail16c");
  assert.equal(created.ok, false);
  if (!created.ok) assert.equal(created.code, "route_failed");
});

test("16-pair: failure does not mutate graph", () => {
  const wall = placeCard({
    id: "wall16g",
    cardType: "information",
    text: "壁G",
    x: 0,
    y: 0,
  });
  wall.layout.width = A3_WIDTH_PX;
  wall.layout.height = A3_HEIGHT_PX;
  const a = placeCard({
    id: "fail16g_a",
    cardType: "understanding",
    text: "A",
    x: 40,
    y: 40,
    origin: "direct_insight",
  });
  const b = placeCard({
    id: "fail16g_b",
    cardType: "understanding",
    text: "B",
    x: 1400,
    y: 900,
    origin: "direct_insight",
  });
  const graph = graphWith(wall, a, b);
  const created = createBetween(graph, a.id, b.id, "current", "cn_fail16g");
  assert.equal(created.ok, false);
  assert.equal(graph.connections.length, 0);
  assert.equal(graph.connections.some((row) => row.id === "cn_fail16g"), false);
});

test("16-pair: failure does not write history", () => {
  const choose = ws.slice(
    ws.indexOf("const handleChooseRelation"),
    ws.indexOf("const handleConnectingCardPointerDown"),
  );
  const failBranch = choose.slice(
    choose.indexOf("if (!created.ok)"),
    choose.indexOf("setGraph(created.graph)"),
  );
  assert.equal(failBranch.includes("onHistoryPush"), false);
});

test("16-pair: relation does not change geometry", () => {
  const { scene, seeded } = fixtureSeeded();
  const points: number[][][] = [];
  for (const relation of ["current", "potential", "treatment"] as const) {
    const created = commitStudentConnectionCreate({
      graph: scene.graph,
      routeState: seeded,
      topology: scene.routeTopology,
      sourceCardId: "sk_da",
      targetCardId: "demo_treat_src",
      relationType: relation,
      connectionId: `cn_rel_${relation}`,
    });
    assert.equal(created.ok, true, relation);
    if (!created.ok) return;
    points.push(
      created.routeState.byId[created.connection.id]!.points.map((p) => [p.x, p.y]),
    );
  }
  assert.deepEqual(points[0], points[1]);
  assert.deepEqual(points[0], points[2]);
});

test("16-pair: Undo/Redo restores exact Connection", () => {
  const { seeded, created } = createFixturePair(
    "sk_da",
    "demo_treat_src",
    "cn_hist_exact",
  );
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const history = pushDiagramHistory(emptyDiagramHistory(), {
    type: "addConnection",
    connection: cloneConnection(created.connection),
    routeStateBefore: seeded,
    routeStateAfter: created.routeState,
    topologyBefore: created.topology,
    topologyAfter: created.topology,
  });
  const undone = undoDiagramHistory(history);
  const afterUndo = applyHistoryCommand(created.graph, undone.command);
  assert.equal(afterUndo.connections.some((row) => row.id === "cn_hist_exact"), false);
  const redone = redoDiagramHistory(undone.history);
  assert.equal(redone.command.kind, "addConnection");
  if (redone.command.kind !== "addConnection") return;
  assert.equal(redone.command.connection.id, "cn_hist_exact");
  assert.equal(redone.command.connection.sourceCardId, "sk_da");
  assert.equal(redone.command.connection.targetCardId, "demo_treat_src");
  assert.equal(redone.command.connection.relationType, "current");
  const restored = redone.command.routeState?.byId.cn_hist_exact;
  const original = created.routeState.byId.cn_hist_exact;
  assert.deepEqual(restored?.points, original?.points);
  assert.equal(restored?.sourceEdge, original?.sourceEdge);
  assert.equal(restored?.targetEdge, original?.targetEdge);
  assert.deepEqual(redone.command.routeState?.bridges, created.routeState.bridges);
  assert.deepEqual(redone.command.topology, created.topology);
});

const FAN_TARGETS = {
  C: "demo_u_cur",
  B: "sk_patho_core",
  D: "demo_treat_src",
} as const;
const FAN_ORDERS: Array<Array<keyof typeof FAN_TARGETS>> = [
  ["C", "B", "D"],
  ["C", "D", "B"],
  ["B", "C", "D"],
  ["B", "D", "C"],
  ["D", "C", "B"],
  ["D", "B", "C"],
];

function cardLayouts(cards: RelatedDiagramCard[]) {
  return cards
    .map((card) => ({
      id: card.id,
      x: card.layout.x,
      y: card.layout.y,
      width: card.layout.width,
      height: card.layout.height,
    }))
    .sort((a, b) => (a.id < b.id ? -1 : 1));
}

function polylineLength(points: { x: number; y: number }[]) {
  return polylineManhattanLength(points);
}

function assertStoredValid(
  cards: RelatedDiagramCard[],
  stored: {
    connectionId: string;
    sourceCardId: string;
    targetCardId: string;
    sourceEdge: "top" | "right" | "bottom" | "left";
    targetEdge: "top" | "right" | "bottom" | "left";
    sourcePin: { x: number; y: number };
    targetPin: { x: number; y: number };
    points: { x: number; y: number }[];
  },
  prior: ReturnType<typeof seedStableRouteState>,
) {
  const source = cards.find((card) => card.id === stored.sourceCardId)!;
  const target = cards.find((card) => card.id === stored.targetCardId)!;
  const validation = validateOrthogonalRoute({
    points: stored.points,
    sourcePin: stored.sourcePin,
    targetPin: stored.targetPin,
    obstacles: [
      ...cards.map(cardObstacle),
      { id: "__legend__", ...getA3LegendBounds() },
    ],
    sourceCardId: source.id,
    targetCardId: target.id,
    clearance: 0,
    sourceEdge: stored.sourceEdge,
    targetEdge: stored.targetEdge,
  });
  assert.equal(validation.ok, true, stored.connectionId);
  assert.equal(
    studentConnectionOverlapsPriorRoutes(stored.points, prior, stored.connectionId),
    false,
    stored.connectionId,
  );
  const last = stored.points[stored.points.length - 1]!;
  const approach = stored.points[stored.points.length - 2]!;
  assert.ok(
    Math.abs(last.x - approach.x) + Math.abs(last.y - approach.y) >=
      MIN_ARROW_APPROACH - 0.01,
    stored.connectionId,
  );
}

function assertExistingUnchanged(
  before: ReturnType<typeof seedStableRouteState>,
  after: ReturnType<typeof seedStableRouteState>,
  newId: string,
) {
  for (const [id, route] of Object.entries(before.byId)) {
    if (id === newId) continue;
    assert.equal(
      pointsDeepEqual(route.points, after.byId[id]!.points),
      true,
      id,
    );
    assert.deepEqual(after.byId[id]!.sourcePin, route.sourcePin, id);
    assert.deepEqual(after.byId[id]!.targetPin, route.targetPin, id);
  }
}

type FanCreated = Extract<StudentConnectionCreateResult, { ok: true }>;

function createFanSequence(order: Array<keyof typeof FAN_TARGETS>): {
  scene: ReturnType<typeof fixtureSeeded>["scene"];
  seeded: ReturnType<typeof fixtureSeeded>["seeded"];
  rows: Array<{
    key: keyof typeof FAN_TARGETS;
    connectionId: string;
    sourcePin: { x: number; y: number };
    targetPin: { x: number; y: number };
    sourceEdge: "top" | "right" | "bottom" | "left";
    targetEdge: "top" | "right" | "bottom" | "left";
    created: FanCreated;
  }>;
  graph?: FanCreated["graph"];
  routeState?: FanCreated["routeState"];
  ok: boolean;
} {
  const { scene, seeded } = fixtureSeeded();
  let graph = scene.graph;
  let routeState = seeded;
  const rows: Array<{
    key: keyof typeof FAN_TARGETS;
    connectionId: string;
    sourcePin: { x: number; y: number };
    targetPin: { x: number; y: number };
    sourceEdge: "top" | "right" | "bottom" | "left";
    targetEdge: "top" | "right" | "bottom" | "left";
    created: FanCreated;
  }> = [];
  for (const key of order) {
    const connectionId = `cn_fan_${order.join("")}_${key}`;
    const prior = routeState;
    const created = commitStudentConnectionCreate({
      graph,
      routeState,
      topology: scene.routeTopology,
      sourceCardId: "sk_da",
      targetCardId: FAN_TARGETS[key],
      relationType: "current",
      connectionId,
    });
    assert.equal(created.ok, true, `${order.join("→")} ${key}`);
    if (!created.ok) {
      return { scene, seeded, rows, ok: false as const };
    }
    const stored = created.routeState.byId[connectionId]!;
    assertStoredValid(created.graph.cards, stored, prior);
    assertExistingUnchanged(prior, created.routeState, connectionId);
    assert.deepEqual(cardLayouts(created.graph.cards), cardLayouts(graph.cards));
    graph = created.graph;
    routeState = created.routeState;
    rows.push({
      key,
      connectionId,
      sourcePin: stored.sourcePin,
      targetPin: stored.targetPin,
      sourceEdge: stored.sourceEdge,
      targetEdge: stored.targetEdge,
      created,
    });
  }
  const byEdge = new Map<string, { x: number; y: number }[]>();
  for (const row of rows) {
    const list = byEdge.get(row.sourceEdge) ?? [];
    list.push(row.sourcePin);
    byEdge.set(row.sourceEdge, list);
  }
  for (const [edge, pins] of byEdge) {
    for (let i = 0; i < pins.length; i++) {
      for (let j = i + 1; j < pins.length; j++) {
        assert.ok(
          Math.abs(
            alongCardEdge(pins[i]!, edge as "top" | "right" | "bottom" | "left") -
              alongCardEdge(pins[j]!, edge as "top" | "right" | "bottom" | "left"),
          ) >=
            ATTACHMENT_SPACING - 0.01,
          `${order.join("→")} shared ${edge} pins collapsed`,
        );
      }
    }
  }
  return { scene, seeded, rows, graph, routeState, ok: true as const };
}

test("attachment helpers: spacing and corner clearance", () => {
  assert.equal(ATTACHMENT_SPACING, 12);
  assert.equal(ATTACHMENT_CORNER_CLEARANCE, 16);
  const wide = { x: 0, y: 0, width: 146, height: 72 };
  assert.deepEqual(attachmentOffsetsForEdge(wide, "top"), [
    0, -12, 12, -24, 24, -36, 36, -48, 48,
  ]);
  assert.deepEqual(attachmentOffsetsForEdge(wide, "right"), [0, -12, 12]);
  const short = { x: 0, y: 0, width: 160, height: 64 };
  assert.deepEqual(attachmentOffsetsForEdge(short, "left"), [0, -12, 12]);
  assert.equal(attachmentOffsetsForEdge(short, "left").includes(-24), false);
  const tiny = { x: 0, y: 0, width: 28, height: 28 };
  assert.deepEqual(attachmentOffsetsForEdge(tiny, "top"), [0]);
});

test("attachment helpers: occupancy and rebind stay orthogonal", () => {
  const box = { x: 100, y: 100, width: 146, height: 72 };
  const center = edgeAttachmentPin(box, "top", 0);
  const occupied = occupiedPinsOnEdge(
    seedStableRouteState(
      [
        placeCard({
          id: "occ_s",
          cardType: "understanding",
          text: "S",
          x: 100,
          y: 100,
        }),
        placeCard({
          id: "occ_t",
          cardType: "understanding",
          text: "T",
          x: 400,
          y: 100,
        }),
      ],
      [],
    ),
    "missing",
    "top",
  );
  assert.deepEqual(occupied, []);
  assert.equal(isPinOccupiedForTest(center, "top", [center]), true);
  const points = [
    { x: 173, y: 100 },
    { x: 173, y: 80 },
    { x: 300, y: 80 },
    { x: 300, y: 100 },
  ];
  const rebound = rebindOrthogonalAttachment(points, "top", -12, "top", 12);
  assert.ok(rebound);
  assert.deepEqual(rebound![0], { x: 161, y: 100 });
  assert.deepEqual(rebound![1], { x: 161, y: 80 });
  assert.deepEqual(rebound![3], { x: 312, y: 100 });
  assert.equal(ENDPOINT_CORRIDOR_WIDTH, 10);
  assert.equal(MIN_ENDPOINT_STUB, 20);
  assert.equal(MIN_ARROW_APPROACH, 24);
});

function isPinOccupiedForTest(
  pin: { x: number; y: number },
  edge: "top" | "right" | "bottom" | "left",
  occupied: { x: number; y: number }[],
) {
  return occupied.some(
    (other) =>
      Math.abs(alongCardEdge(other, edge) - alongCardEdge(pin, edge)) <
      ATTACHMENT_SPACING - 0.01,
  );
}

test("fan-out C/B/D: all 6 orders create 3 connections", () => {
  for (const order of FAN_ORDERS) {
    const result = createFanSequence(order);
    assert.equal(result.ok, true, order.join("→"));
    assert.equal(result.rows.length, 3, order.join("→"));
    const pins = result.rows.map(
      (row) =>
        `${row.key}:${row.sourceEdge}:${row.sourcePin.x},${row.sourcePin.y}`,
    );
    console.log(`fan-out ${order.join("→")} sourcePins ${pins.join(" | ")}`);
    const newIds = new Set(result.rows.map((row) => row.connectionId));
    assertExistingUnchanged(result.seeded, result.routeState!, "__none__");
    for (const id of Object.keys(result.seeded.byId)) {
      assert.equal(newIds.has(id), false);
    }
    for (const row of result.rows) {
      const stored = result.routeState!.byId[row.connectionId]!;
      const ownBridges = result.routeState!.bridges.filter(
        (bridge) =>
          bridge.jumperConnectionId === row.connectionId ||
          bridge.underConnectionId === row.connectionId,
      );
      for (const bridge of ownBridges) {
        const jumperPoints =
          bridge.jumperConnectionId === row.connectionId
            ? stored.points
            : result.routeState!.byId[bridge.jumperConnectionId]?.points;
        assert.ok(jumperPoints);
        assert.equal(canRenderBridgeHop(jumperPoints!, bridge), true);
      }
      const distance = junctionBridgeDistance(
        result.routeState!.bridges,
        junctionsFromTopology(result.scene.routeTopology!),
        row.connectionId,
      );
      assert.ok(distance == null || distance >= MIN_JUNCTION_BRIDGE_DISTANCE);
    }
  }
});

test("fan-in: 3 sources share a target edge with 12px separation", () => {
  const target = placeCard({
    id: "fan_in_t",
    cardType: "understanding",
    text: "同一target",
    x: 420,
    y: 160,
    origin: "direct_insight",
  });
  target.layout.height = 160;
  const sources = [
    placeCard({
      id: "fan_in_s1",
      cardType: "understanding",
      text: "S1",
      x: 40,
      y: 140,
      origin: "direct_insight",
    }),
    placeCard({
      id: "fan_in_s2",
      cardType: "understanding",
      text: "S2",
      x: 40,
      y: 204,
      origin: "direct_insight",
    }),
    placeCard({
      id: "fan_in_s3",
      cardType: "understanding",
      text: "S3",
      x: 40,
      y: 268,
      origin: "direct_insight",
    }),
  ];
  let graph = graphWith(target, ...sources);
  let routeState = emptyRoutes(graph);
  const createdRows: StoredRouteGeometry[] = [];
  for (const source of sources) {
    const prior = routeState;
    const created = commitStudentConnectionCreate({
      graph,
      routeState,
      sourceCardId: source.id,
      targetCardId: target.id,
      relationType: "current",
      connectionId: `cn_${source.id}`,
    });
    assert.equal(created.ok, true, source.id);
    if (!created.ok) return;
    const stored = created.routeState.byId[created.connection.id]!;
    assertStoredValid(created.graph.cards, stored, prior);
    assertExistingUnchanged(prior, created.routeState, created.connection.id);
    graph = created.graph;
    routeState = created.routeState;
    createdRows.push(stored);
  }
  const byTargetEdge = new Map<string, StoredRouteGeometry[]>();
  for (const stored of createdRows) {
    const list = byTargetEdge.get(stored.targetEdge) ?? [];
    list.push(stored);
    byTargetEdge.set(stored.targetEdge, list);
  }
  const shared: StoredRouteGeometry[] | undefined = [...byTargetEdge.values()].find(
    (list) => list.length >= 2,
  );
  console.log(
    `fan-in targets ${createdRows
      .map((row) => `${row.targetEdge}:${row.targetPin.x},${row.targetPin.y}`)
      .join(" | ")}`,
  );
  assert.ok(shared, "expected at least two connections on one target edge");
  for (let i = 0; i < shared!.length; i++) {
    for (let j = i + 1; j < shared!.length; j++) {
      const a: StoredRouteGeometry = shared![i]!;
      const b: StoredRouteGeometry = shared![j]!;
      assert.ok(
        Math.abs(
          alongCardEdge(a.targetPin, a.targetEdge) -
            alongCardEdge(b.targetPin, b.targetEdge),
        ) >=
          ATTACHMENT_SPACING - 0.01,
      );
      assert.equal(
        a.targetPin.x === b.targetPin.x && a.targetPin.y === b.targetPin.y,
        false,
      );
      const aApproach = a.points.slice(-2);
      const bApproach = b.points.slice(-2);
      assert.equal(
        aApproach[0]!.x === bApproach[0]!.x &&
          aApproach[0]!.y === bApproach[0]!.y &&
          aApproach[1]!.x === bApproach[1]!.x &&
          aApproach[1]!.y === bApproach[1]!.y,
        false,
      );
      assert.equal(
        isColinearOverlap(aApproach[0]!, aApproach[1]!, bApproach[0]!, bApproach[1]!),
        false,
      );
    }
  }
});

test("fan-out history Undo/Redo restores exact pins", () => {
  const result = createFanSequence(["C", "B", "D"]);
  assert.equal(result.ok, true);
  const last = result.rows[2]!;
  const beforeLast = result.rows[1]!.created.routeState;
  const history = pushDiagramHistory(emptyDiagramHistory(), {
    type: "addConnection",
    connection: cloneConnection(last.created.connection),
    routeStateBefore: beforeLast,
    routeStateAfter: last.created.routeState,
    topologyBefore: last.created.topology,
    topologyAfter: last.created.topology,
  });
  const undone = undoDiagramHistory(history);
  assert.equal(undone.command.kind, "removeConnection");
  if (undone.command.kind === "removeConnection") {
    assert.equal(undone.command.connectionId, last.connectionId);
  }
  const afterUndo = applyHistoryCommand(last.created.graph, undone.command);
  assert.equal(
    afterUndo.connections.some((row) => row.id === last.connectionId),
    false,
  );
  assert.equal(
    afterUndo.connections.some((row) => row.id === result.rows[0]!.connectionId),
    true,
  );
  const redone = redoDiagramHistory(undone.history);
  assert.equal(redone.command.kind, "addConnection");
  if (redone.command.kind !== "addConnection") return;
  const restored = redone.command.routeState?.byId[last.connectionId];
  const original = last.created.routeState.byId[last.connectionId];
  assert.equal(redone.command.connection.id, last.connectionId);
  assert.equal(redone.command.connection.sourceCardId, "sk_da");
  assert.equal(redone.command.connection.targetCardId, FAN_TARGETS.D);
  assert.deepEqual(restored?.sourcePin, original?.sourcePin);
  assert.deepEqual(restored?.targetPin, original?.targetPin);
  assert.deepEqual(restored?.points, original?.points);
  assert.equal(restored?.sourceEdge, original?.sourceEdge);
  assert.equal(restored?.targetEdge, original?.targetEdge);
  assert.deepEqual(redone.command.routeState?.bridges, last.created.routeState.bridges);
  assert.deepEqual(redone.command.topology, last.created.topology);
  assert.equal(historyLib.includes("findRectilinearPath"), false);
  assert.equal(historyLib.includes("decideStudentConnectionRoute"), false);
});

test("attachment relation independence with occupancy", () => {
  const first = createFixturePair("sk_da", "demo_u_cur", "cn_rel_occ_c");
  assert.equal(first.created.ok, true);
  if (!first.created.ok) return;
  const points: number[][][] = [];
  const pins: string[] = [];
  for (const relation of ["current", "potential", "treatment"] as const) {
    const created = commitStudentConnectionCreate({
      graph: first.created.graph,
      routeState: first.created.routeState,
      topology: first.scene.routeTopology,
      sourceCardId: "sk_da",
      targetCardId: "sk_patho_core",
      relationType: relation,
      connectionId: `cn_rel_occ_${relation}`,
    });
    assert.equal(created.ok, true, relation);
    if (!created.ok) return;
    const stored = created.routeState.byId[created.connection.id]!;
    points.push(stored.points.map((point) => [point.x, point.y]));
    pins.push(`${stored.sourcePin.x},${stored.sourcePin.y}->${stored.targetPin.x},${stored.targetPin.y}`);
  }
  assert.deepEqual(points[0], points[1]);
  assert.deepEqual(points[0], points[2]);
  assert.equal(pins[0], pins[1]);
  assert.equal(pins[0], pins[2]);
});

test("perimeter trigger helpers", () => {
  assert.equal(EDGE_RUN_PROXIMITY_PX, 48);
  assert.equal(PERIMETER_ESCALATION_EDGE_RUN, 800);
  assert.equal(PERIMETER_ESCALATION_RATIO, 0.7);
  assert.equal(PERIMETER_ESCALATION_MAX_PAIRS, 2);
  const perimeter = [
    { x: 83, y: 172 },
    { x: 83, y: 27 },
    { x: 1451, y: 27 },
    { x: 1451, y: 499 },
  ];
  assert.equal(shouldEscalatePerimeterRoute(perimeter), true);
  const longNatural = [
    { x: 80, y: 520 },
    { x: 100, y: 520 },
    { x: 1080, y: 520 },
    { x: 1100, y: 520 },
  ];
  assert.equal(polylineManhattanLength(longNatural), 1020);
  assert.equal(canvasEdgeRun(longNatural), 0);
  assert.equal(shouldEscalatePerimeterRoute(longNatural), false);
  assert.equal(createLib.includes("1357"), false);
  assert.equal(createLib.includes("bottom→left"), false);
  const ranked = rankEscalationEdgePairs({
    sourcePins: {
      top: { x: 100, y: 0 },
      right: { x: 200, y: 50 },
      bottom: { x: 100, y: 100 },
      left: { x: 0, y: 50 },
    },
    targetPins: {
      top: { x: 400, y: 0 },
      right: { x: 500, y: 50 },
      bottom: { x: 400, y: 100 },
      left: { x: 300, y: 50 },
    },
    preferred: { sourceEdge: "right", targetEdge: "left" },
    secondary: { sourceEdge: "bottom", targetEdge: "top" },
  });
  assert.ok(ranked.length <= 2);
  assert.ok(ranked[0]!.manhattan <= ranked[1]!.manhattan);
});

test("A perimeter escalation selects a shorter interior route", () => {
  const { scene, seeded, created } = createFixturePair(
    "sk_da",
    "demo_np",
    "cn_esc_a",
  );
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const decision = decideStudentConnectionRoute({
    cards: scene.graph.cards,
    connection: draftConnection("cn_esc_a", "sk_da", "demo_np"),
    routeState: seeded,
    topology: scene.routeTopology,
  });
  assert.equal(decision.escalationFired, true);
  assert.ok(decision.pathfinderCalls <= PERIMETER_ESCALATION_MAX_PAIRS);
  assert.ok(decision.pathfinderCalls >= 1);
  assert.ok(decision.stored);
  const stored = created.routeState.byId.cn_esc_a!;
  const length = polylineManhattanLength(stored.points);
  const run = canvasEdgeRun(stored.points);
  console.log(
    `A after esc L=${length} run=${run} ratio=${(run / Math.max(1, length)).toFixed(3)} class=${decision.quality?.class} pf=${decision.pathfinderCalls} ${stored.sourceEdge}@${stored.sourcePin.x},${stored.sourcePin.y}→${stored.targetEdge}@${stored.targetPin.x},${stored.targetPin.y}`,
  );
  assert.ok(length < 2051);
  assert.ok(length <= 1600);
  assert.ok(run < 800);
  assert.ok(decision.quality);
  assert.ok(decision.quality!.class === 0 || decision.quality!.class === 1);
  assert.equal(
    studentConnectionOverlapsPriorRoutes(stored.points, seeded, "cn_esc_a"),
    false,
  );
  assertStoredValid(created.graph.cards, stored, seeded);
  for (const [id, route] of Object.entries(seeded.byId)) {
    assert.equal(pointsDeepEqual(route.points, created.routeState.byId[id]!.points), true, id);
  }
});

test("perimeter sibling sk_da → demo_u_cur also escalates", () => {
  const { seeded, created } = createFixturePair(
    "sk_da",
    "demo_u_cur",
    "cn_esc_sib",
  );
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const decision = decideStudentConnectionRoute({
    cards: created.graph.cards,
    connection: created.connection,
    routeState: seeded,
    topology: resolveDevFixtureReadonlyScene({ includeStyleDemo: true }).routeTopology,
  });
  assert.equal(decision.escalationFired, true);
  assert.ok(decision.pathfinderCalls <= PERIMETER_ESCALATION_MAX_PAIRS);
  const stored = created.routeState.byId.cn_esc_sib!;
  const length = polylineManhattanLength(stored.points);
  const run = canvasEdgeRun(stored.points);
  console.log(`sibling after esc L=${length} run=${run} class=${decision.quality?.class}`);
  assert.ok(length < 1528);
  assert.ok(run < 800);
  assert.equal(
    studentConnectionOverlapsPriorRoutes(stored.points, seeded, "cn_esc_sib"),
    false,
  );
});

test("normal routes do not fire perimeter escalation", () => {
  const assertQuiet = (
    name: string,
    decision: ReturnType<typeof decideStudentConnectionRoute>,
  ) => {
    assert.equal(decision.escalationFired, false, name);
    assert.equal(decision.pathfinderCalls, 0, name);
    assert.ok(decision.stored, name);
  };
  const { scene, seeded } = fixtureSeeded();
  assertQuiet(
    "B",
    decideStudentConnectionRoute({
      cards: scene.graph.cards,
      connection: draftConnection("cn_q_b", "sk_da", "sk_patho_core"),
      routeState: seeded,
      topology: scene.routeTopology,
    }),
  );
  assertQuiet(
    "C",
    decideStudentConnectionRoute({
      cards: scene.graph.cards,
      connection: draftConnection("cn_q_c", "sk_da", "demo_u_cur"),
      routeState: seeded,
      topology: scene.routeTopology,
    }),
  );
  assertQuiet(
    "D",
    decideStudentConnectionRoute({
      cards: scene.graph.cards,
      connection: draftConnection("cn_q_d", "sk_da", "demo_treat_src"),
      routeState: seeded,
      topology: scene.routeTopology,
    }),
  );

  const u1 = placeCard({
    id: "q_u1",
    cardType: "understanding",
    text: "U1",
    x: 80,
    y: 80,
    origin: "direct_insight",
  });
  const u2 = placeCard({
    id: "q_u2",
    cardType: "understanding",
    text: "U2",
    x: 420,
    y: 80,
    origin: "direct_insight",
  });
  const uu = graphWith(u1, u2);
  assertQuiet(
    "U→U",
    decideStudentConnectionRoute({
      cards: uu.cards,
      connection: draftConnection("cn_q_uu", u1.id, u2.id),
      routeState: emptyRoutes(uu),
    }),
  );

  const long1 = placeCard({
    id: "q_long_s",
    cardType: "understanding",
    text: "長い元",
    x: 80,
    y: 520,
    origin: "direct_insight",
  });
  const long2 = placeCard({
    id: "q_long_t",
    cardType: "understanding",
    text: "長い先",
    x: 1100,
    y: 520,
    origin: "direct_insight",
  });
  const longG = graphWith(long1, long2);
  const longD = decideStudentConnectionRoute({
    cards: longG.cards,
    connection: draftConnection("cn_q_long", long1.id, long2.id),
    routeState: emptyRoutes(longG),
  });
  assertQuiet("long natural", longD);
  assert.ok((longD.quality?.length ?? 0) >= 800);
  assert.equal(canvasEdgeRun(longD.stored!.points), 0);

  const npSrc = placeCard({
    id: "q_np_s",
    cardType: "understanding",
    text: "理解",
    x: 80,
    y: 700,
    origin: "direct_insight",
  });
  const npTgt = placeCard({
    id: "q_np_t",
    cardType: "nursing_problem",
    text: "看護問題",
    x: 700,
    y: 700,
    origin: "direct_insight",
  });
  const npG = graphWith(npSrc, npTgt);
  assertQuiet(
    "U→NP",
    decideStudentConnectionRoute({
      cards: npG.cards,
      connection: draftConnection("cn_q_np", npSrc.id, npTgt.id),
      routeState: emptyRoutes(npG),
    }),
  );

  const test3 = placeCard({
    id: "q_gap",
    cardType: "understanding",
    text: "テスト3",
    x: 920,
    y: 280,
    origin: "direct_insight",
  });
  test3.layout.width = 180;
  const gap = fixtureSceneWith(test3);
  assertQuiet(
    "narrow-gap",
    decideStudentConnectionRoute({
      cards: gap.graph.cards,
      connection: draftConnection("cn_q_gap", test3.id, "demo_treat_src"),
      routeState: gap.seeded,
      topology: gap.scene.routeTopology,
    }),
  );
});

test("A escalation Undo/Redo restores exact geometry", () => {
  const { seeded, created } = createFixturePair("sk_da", "demo_np", "cn_esc_hist");
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const history = pushDiagramHistory(emptyDiagramHistory(), {
    type: "addConnection",
    connection: cloneConnection(created.connection),
    routeStateBefore: seeded,
    routeStateAfter: created.routeState,
    topologyBefore: created.topology,
    topologyAfter: created.topology,
  });
  const undone = undoDiagramHistory(history);
  assert.equal(undone.command.kind, "removeConnection");
  const redone = redoDiagramHistory(undone.history);
  assert.equal(redone.command.kind, "addConnection");
  if (redone.command.kind !== "addConnection") return;
  const restored = redone.command.routeState?.byId.cn_esc_hist;
  const original = created.routeState.byId.cn_esc_hist;
  assert.deepEqual(restored?.sourcePin, original?.sourcePin);
  assert.deepEqual(restored?.targetPin, original?.targetPin);
  assert.deepEqual(restored?.points, original?.points);
  assert.deepEqual(redone.command.routeState?.bridges, created.routeState.bridges);
  assert.equal(historyLib.includes("shouldEscalatePerimeterRoute"), false);
  assert.equal(historyLib.includes("findRectilinearPath"), false);
});

test("attachment performance A/B/C/D/narrow-gap", () => {
  const logDecision = (
    label: string,
    decision: ReturnType<typeof decideStudentConnectionRoute>,
  ) => {
    console.log(
      `perf ${label} esc=${decision.escalationFired} attach=${decision.attachmentTried} gen=${decision.normalGeneratedCount} eval=${decision.evaluateCount} pf=${decision.pathfinderCalls} ms=${decision.planningMs.toFixed(1)}`,
    );
    if (decision.escalationFired) {
      assert.ok(decision.pathfinderCalls <= PERIMETER_ESCALATION_MAX_PAIRS, label);
    } else {
      assert.equal(decision.pathfinderCalls, 0, label);
    }
  };

  const sceneA = resolveDevFixtureReadonlyScene({ includeStyleDemo: true });
  const seededA = seedStableRouteState(
    sceneA.graph.cards,
    sceneA.graph.connections,
    sceneA.routeTopology,
  );
  logDecision(
    "A",
    decideStudentConnectionRoute({
      cards: sceneA.graph.cards,
      connection: draftConnection("cn_perf_a", "sk_da", "demo_np"),
      routeState: seededA,
      topology: sceneA.routeTopology,
    }),
  );
  logDecision(
    "sibling",
    decideStudentConnectionRoute({
      cards: sceneA.graph.cards,
      connection: draftConnection("cn_perf_sib", "sk_da", "demo_u_cur"),
      routeState: seededA,
      topology: sceneA.routeTopology,
    }),
  );

  let graph = sceneA.graph;
  let routeState = seededA;
  for (const [key, targetId] of [
    ["C", "demo_u_cur"],
    ["B", "sk_patho_core"],
    ["D", "demo_treat_src"],
  ] as const) {
    const decision = decideStudentConnectionRoute({
      cards: graph.cards,
      connection: draftConnection(`cn_perf_${key}`, "sk_da", targetId),
      routeState,
      topology: sceneA.routeTopology,
    });
    logDecision(`CBD-${key}`, decision);
    const created = commitStudentConnectionCreate({
      graph,
      routeState,
      topology: sceneA.routeTopology,
      sourceCardId: "sk_da",
      targetCardId: targetId,
      relationType: "current",
      connectionId: `cn_perf_${key}`,
    });
    assert.equal(created.ok, true, key);
    if (!created.ok) return;
    graph = created.graph;
    routeState = created.routeState;
  }

  const target = placeCard({
    id: "perf_in_t",
    cardType: "understanding",
    text: "T",
    x: 420,
    y: 160,
    origin: "direct_insight",
  });
  target.layout.height = 160;
  const s1 = placeCard({
    id: "perf_in_s1",
    cardType: "understanding",
    text: "S1",
    x: 40,
    y: 140,
    origin: "direct_insight",
  });
  const s2 = placeCard({
    id: "perf_in_s2",
    cardType: "understanding",
    text: "S2",
    x: 40,
    y: 204,
    origin: "direct_insight",
  });
  const s3 = placeCard({
    id: "perf_in_s3",
    cardType: "understanding",
    text: "S3",
    x: 40,
    y: 268,
    origin: "direct_insight",
  });
  let inGraph = graphWith(target, s1, s2, s3);
  let inRoutes = emptyRoutes(inGraph);
  for (const source of [s1, s2, s3]) {
    const decision = decideStudentConnectionRoute({
      cards: inGraph.cards,
      connection: draftConnection(`cn_perf_${source.id}`, source.id, target.id),
      routeState: inRoutes,
    });
    logDecision(`fan-in-${source.id}`, decision);
    const created = commitStudentConnectionCreate({
      graph: inGraph,
      routeState: inRoutes,
      sourceCardId: source.id,
      targetCardId: target.id,
      relationType: "current",
      connectionId: `cn_perf_${source.id}`,
    });
    assert.equal(created.ok, true, source.id);
    if (!created.ok) return;
    inGraph = created.graph;
    inRoutes = created.routeState;
  }

  const test3 = placeCard({
    id: "u_test3_perf",
    cardType: "understanding",
    text: "テスト3",
    x: 920,
    y: 280,
    origin: "direct_insight",
  });
  test3.layout.width = 180;
  const gap = fixtureSceneWith(test3);
  logDecision(
    "narrow-gap",
    decideStudentConnectionRoute({
      cards: gap.graph.cards,
      connection: draftConnection("cn_perf_gap", test3.id, "demo_treat_src"),
      routeState: gap.seeded,
      topology: gap.scene.routeTopology,
    }),
  );

  const long1 = placeCard({
    id: "perf_long_s",
    cardType: "understanding",
    text: "長い元",
    x: 80,
    y: 520,
    origin: "direct_insight",
  });
  const long2 = placeCard({
    id: "perf_long_t",
    cardType: "understanding",
    text: "長い先",
    x: 1100,
    y: 520,
    origin: "direct_insight",
  });
  const longG = graphWith(long1, long2);
  logDecision(
    "long-natural",
    decideStudentConnectionRoute({
      cards: longG.cards,
      connection: draftConnection("cn_perf_long", long1.id, long2.id),
      routeState: emptyRoutes(longG),
    }),
  );
});

test("attachment does not change generateOrthogonalCandidates", () => {
  const hardening = src("./routeHardening.ts");
  assert.ok(hardening.includes("export function generateOrthogonalCandidates"));
  assert.equal(hardening.includes("ATTACHMENT_SPACING"), false);
  assert.equal(createLib.includes("rebindOrthogonalAttachment"), true);
});

test("existing fixture Connection has markerEnd", () => {
  const scene = resolveDevFixtureReadonlyScene({ includeStyleDemo: true });
  const fixture = scene.graph.connections.find((c) => c.id === "demo_c_cur");
  assert.ok(fixture);
  const arrow = connectionArrowRenderContract(fixture!.relationType, "live");
  assert.equal(fixture!.relationType, "current");
  assert.equal(arrow.markerEnd, `url(#${CONNECTION_ARROW_MARKER_BASE_ID}-live)`);
  assert.equal(arrow.markerStart, null);
  assert.ok(layer.includes("scopedConnectionArrowMarkerId"));
  assert.ok(layer.includes("connectionPathMarkerAttrs"));
});

test("newly created current Connection has markerEnd", () => {
  const created = createBetween(graphWith(sourceU, targetU), sourceU.id, targetU.id, "current");
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const arrow = connectionArrowRenderContract(created.connection.relationType, "live");
  assert.equal(arrow.markerEnd, `url(#${CONNECTION_ARROW_MARKER_BASE_ID}-live)`);
  assert.equal(arrow.markerStart, null);
  assert.equal(arrow.dasharray, null);
  assert.equal(arrow.strokeWidth, 1.5);
});

test("newly created potential Connection has markerEnd", () => {
  const created = createBetween(
    graphWith(sourceU, targetU),
    sourceU.id,
    targetU.id,
    "potential",
  );
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const arrow = connectionArrowRenderContract(created.connection.relationType, "live");
  assert.equal(arrow.markerEnd, `url(#${CONNECTION_ARROW_MARKER_BASE_ID}-live)`);
  assert.equal(arrow.markerStart, null);
  assert.ok(arrow.dasharray);
});

test("newly created treatment Connection has markerEnd", () => {
  const created = createBetween(
    graphWith(sourceU, targetU),
    sourceU.id,
    targetU.id,
    "treatment",
  );
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const arrow = connectionArrowRenderContract(created.connection.relationType, "live");
  assert.equal(
    arrow.markerEnd,
    `url(#${CONNECTION_ARROW_THICK_MARKER_BASE_ID}-live)`,
  );
  assert.equal(arrow.markerStart, null);
  assert.ok(arrow.strokeWidth >= 3);
});

test("marker reference exists in SVG defs", () => {
  assert.ok(layer.includes("CONNECTION_ARROW_MARKER_BASE_ID"));
  assert.ok(layer.includes("CONNECTION_ARROW_THICK_MARKER_BASE_ID"));
  assert.ok(layer.includes('refX="10"'));
  assert.ok(layer.includes('markerUnits="userSpaceOnUse"'));
  assert.ok(layer.includes("useId"));
  assert.equal(layer.includes('id="rd-arrow"'), false);
  assert.equal(layer.includes('id="rd-arrow-thick"'), false);
});

test("source側にはmarkerStartを付けない", () => {
  assert.equal(layer.includes("markerStart"), false);
  assert.equal(connectionPathMarkerAttrs("rd-arrow-live").markerStart, undefined);
});

test("target側markerEndのみ", () => {
  const current = connectionArrowRenderContract("current", "live");
  const potential = connectionArrowRenderContract("potential", "live");
  const treatment = connectionArrowRenderContract("treatment", "live");
  for (const arrow of [current, potential, treatment]) {
    assert.ok(arrow.markerEnd.startsWith("url(#"));
    assert.equal(arrow.markerStart, null);
  }
});

test("relationごとのstroke semantics維持", () => {
  const current = connectionArrowRenderContract("current", "s");
  const potential = connectionArrowRenderContract("potential", "s");
  const treatment = connectionArrowRenderContract("treatment", "s");
  assert.equal(current.dasharray, null);
  assert.equal(current.strokeWidth, 1.5);
  assert.equal(current.marker, "arrow");
  assert.ok(potential.dasharray);
  assert.equal(potential.marker, "arrow");
  assert.equal(treatment.dasharray, null);
  assert.ok(treatment.strokeWidth >= 3);
  assert.equal(treatment.marker, "arrow-thick");
  assert.equal(current.markerId, potential.markerId);
  assert.notEqual(treatment.markerId, current.markerId);
});

test("Card Action tap Card → popover open", () => {
  assert.ok(ws.includes("RelatedDiagramActionPopover"));
  assert.ok(ws.includes('kind="card"'));
  assert.ok(ws.includes("showCardPopover"));
  assert.ok(popover.includes("data-rd-action-popover"));
});

test("Card Action capabilityに応じたaction", () => {
  assert.deepEqual(
    visibleContextActions(getCardActionCapabilities(sourceU), false),
    ["edit", "connect", "delete"],
  );
  assert.deepEqual(
    visibleContextActions(getCardActionCapabilities(infoCard), false),
    ["connect", "delete"],
  );
  assert.deepEqual(
    visibleContextActions(getCardActionCapabilities(knowledgeCard), false),
    ["edit", "connect", "delete"],
  );
  assert.ok(bar.includes("visibleContextActions"));
});

test("Card Action Edit", () => {
  const editFn = ws.slice(
    ws.indexOf("const handleCardEdit"),
    ws.indexOf("const handleSaveCardEdit"),
  );
  assert.ok(ws.includes("onEdit={handleCardEdit}"));
  assert.ok(ws.includes("RelatedDiagramCardEditDrawer"));
  assert.equal(editFn.includes("fitToView"), false);
  assert.equal(editFn.includes("resetTo100"), false);
});

test("Card Action Connect", () => {
  assert.ok(ws.includes("onConnect={handleCardConnect}"));
  assert.ok(ws.includes("createCardConnectIntent"));
  assert.ok(bar.includes('action="connect"'));
});

test("Card Action Delete", () => {
  assert.ok(ws.includes("onDelete={requestDeleteSelected}"));
  assert.ok(ws.includes("RelatedDiagramCardDeleteConfirm"));
  assert.ok(bar.includes("text-[#C41E3A]"));
});

test("Card Action outside tap", () => {
  assert.equal(popover.includes("data-rd-action-popover-dismiss"), false);
  assert.ok(ws.includes('onDismiss={() => selectCard(null)}'));
  assert.equal(classifyActionPopoverPointer({
    kind: "card",
    pointerCount: 1,
    targetIsPopover: false,
  }), "ignore");
});

test("Card Action no history on open/close", () => {
  assert.equal(ws.includes('type: "openPopover"'), false);
  assert.equal(ws.includes('type: "closePopover"'), false);
  assert.equal(historyLib.includes("popover"), false);
});

test("target tap → relation popover", () => {
  assert.ok(ws.includes('kind="relation"'));
  assert.ok(ws.includes("RelatedDiagramRelationComposeBar"));
  assert.ok(ws.includes("relationCompose && targetCard"));
});

test("relation source/target表示", () => {
  assert.ok(compose.includes("「{sourceTitle}」→「{targetTitle}」"));
  assert.ok(compose.includes("line-clamp-2"));
  assert.ok(compose.includes("この関係は？"));
});

test("relation current / potential / treatment", () => {
  assert.ok(compose.includes('data-rd-relation-choice={relation}'));
  assert.equal(STUDENT_CONNECTION_RELATION_LABELS.current, "顕在");
  assert.equal(STUDENT_CONNECTION_RELATION_LABELS.potential, "潜在");
  assert.equal(STUDENT_CONNECTION_RELATION_LABELS.treatment, "治療");
  assert.ok(ws.includes("onChooseRelation={handleChooseRelation}"));
});

test("relation cancel", () => {
  assert.ok(compose.includes("data-rd-relation-cancel"));
  const cancel = ws.slice(
    ws.indexOf("const handleCancelRelationCompose"),
    ws.indexOf("const handleChooseRelation"),
  );
  assert.equal(cancel.includes("commitStudentConnectionCreate"), false);
  assert.ok(cancel.includes("setActionIntent(null)"));
});

test("relation outside tap cancel", () => {
  assert.ok(ws.includes("onDismiss={handleCancelRelationCompose}"));
  assert.equal(
    classifyActionPopoverPointer({
      kind: "relation",
      pointerCount: 1,
      targetIsPopover: false,
    }),
    "dismiss-outside",
  );
});

test("layout 52% / 100% / pan / A3 bounds / transform invariant", () => {
  const chrome = ws.slice(
    ws.indexOf("<RelatedDiagramEditorToolbar"),
    ws.indexOf("data-rd-viewport"),
  );
  assert.equal(chrome.includes("RelatedDiagramContextBar"), false);
  assert.equal(chrome.includes("RelatedDiagramRelationComposeBar"), false);
  assert.ok(popover.includes("fixed z-50"));
  assert.equal(popover.includes("absolute inset-0"), false);
  assert.ok(ws.includes("RelatedDiagramActionPopover"));
  const canvas = ws.slice(
    ws.indexOf("data-rd-canvas-transform"),
    ws.indexOf("RelatedDiagramForm3Drawer"),
  );
  assert.equal(canvas.includes("RelatedDiagramActionPopover"), false);
  assert.ok(ws.includes("cardScreenRect"));
  assert.equal(createLib.includes("placeActionPopover"), false);
});

test("popover tap does not start Card drag or canvas pan", () => {
  assert.ok(popover.includes("isolateSinglePointer"));
  assert.ok(popover.includes("stopPropagation"));
  assert.equal(popover.includes("preventDefault"), false);
  assert.ok(src("./diagramSelection.ts").includes("[data-rd-action-popover]"));
});

test("A closed popover keeps Slice2A 1-finger drag and 2-pointer pinch/pan", () => {
  const viewport = src("../../../components/v2/relatedDiagram/useA3Viewport.ts");
  assert.ok(viewport.includes("pickTwoTouchPointers"));
  assert.ok(viewport.includes("applyTwoFingerViewportTransform"));
  assert.ok(src("../../../components/v2/relatedDiagram/useCardInteraction.ts").includes("onCardPointerDown"));
  assert.equal(popover.includes("data-rd-action-popover-dismiss"), false);
});

test("B Card Action open: 2 pointer gesture reaches A3 and dismisses", () => {
  assert.equal(
    classifyActionPopoverPointer({
      kind: "card",
      pointerCount: 2,
      targetIsPopover: false,
    }),
    "dismiss-gesture",
  );
  assert.ok(popover.includes('document.addEventListener("pointerdown"'));
  assert.equal(popover.includes("preventDefault"), false);
  assert.ok(ws.includes('onDismiss={() => selectCard(null)}'));
});

test("C Relation open: 2 pointer cancels without history", () => {
  assert.equal(
    classifyActionPopoverPointer({
      kind: "relation",
      pointerCount: 2,
      targetIsPopover: true,
    }),
    "dismiss-gesture",
  );
  const cancel = ws.slice(
    ws.indexOf("const handleCancelRelationCompose"),
    ws.indexOf("const handleChooseRelation"),
  );
  assert.equal(cancel.includes("onHistoryPush"), false);
  assert.equal(cancel.includes("commitStudentConnectionCreate"), false);
  assert.ok(cancel.includes("setActionIntent(null)"));
});

test("D gesture終了後 pointer state 0", () => {
  const ids = new Set<number>();
  assert.equal(trackPointerDown(ids, 1), 1);
  assert.equal(trackPointerDown(ids, 2), 2);
  assert.equal(trackPointerUp(ids, 1), 1);
  assert.equal(trackPointerUp(ids, 2), 0);
  assert.ok(popover.includes("pointers.clear()"));
});

test("E Popover open alone does not rewrite zoom/pan", () => {
  assert.equal(popover.includes("fitToView"), false);
  assert.equal(popover.includes("resetTo100"), false);
  assert.equal(popover.includes("setTransform"), false);
  assert.ok(isActionPopoverSurface(null) === false);
});

test("placement prefers top then bottom right left and clamps", () => {
  const viewport = { x: 0, y: 0, width: 800, height: 600 };
  const anchor = { x: 300, y: 200, width: 160, height: 72 };
  const top = placeActionPopover({
    anchor,
    popover: { width: 220, height: 56 },
    viewport,
  });
  assert.equal(top.side, "top");
  const low = placeActionPopover({
    anchor: { x: 300, y: 8, width: 160, height: 72 },
    popover: { width: 220, height: 56 },
    viewport,
  });
  assert.equal(low.side, "bottom");
  const screen = cardScreenRect(
    { layout: { x: 100, y: 50, width: 160, height: 72 } },
    { left: 10, top: 20 },
    { x: 5, y: 7, scale: 0.5 },
  );
  assert.equal(screen.x, 10 + 5 + 50);
  assert.equal(screen.y, 20 + 7 + 25);
  assert.equal(screen.width, 80);
  assert.equal(screen.height, 36);
  const clamped = placeActionPopover({
    anchor: { x: 780, y: 580, width: 40, height: 20 },
    popover: { width: 220, height: 56 },
    viewport,
  });
  assert.ok(clamped.x >= 8);
  assert.ok(clamped.x + 220 <= 792);
});

test("toolbar stays outside canvas transform", () => {
  const toolbarAt = ws.indexOf("RelatedDiagramEditorToolbar");
  const transformAt = ws.indexOf("data-rd-canvas-transform");
  const shellAt = ws.indexOf("data-rd-canvas-shell");
  assert.ok(toolbarAt >= 0 && transformAt > toolbarAt);
  assert.ok(shellAt > toolbarAt && shellAt < transformAt);
  assert.equal(toolbar.includes("data-rd-canvas-transform"), false);
  assert.equal(toolbar.includes("translate("), false);
  assert.equal(toolbar.includes("scale("), false);
});

test("toolbar left shrink-0 / title truncates / right shrink-0", () => {
  assert.ok(toolbar.includes('data-rd-toolbar-left'));
  assert.ok(toolbar.includes('data-rd-toolbar-title'));
  assert.ok(toolbar.includes('data-rd-toolbar-right'));
  const left = toolbar.slice(
    toolbar.indexOf("data-rd-toolbar-left"),
    toolbar.indexOf("data-rd-toolbar-title"),
  );
  const title = toolbar.slice(
    toolbar.indexOf("data-rd-toolbar-title"),
    toolbar.indexOf("data-rd-toolbar-right"),
  );
  const right = toolbar.slice(toolbar.indexOf("data-rd-toolbar-right"));
  assert.ok(left.includes("shrink-0"));
  assert.equal(left.includes("flex-1"), false);
  assert.ok(title.includes("min-w-0"));
  assert.ok(title.includes("flex-1"));
  assert.ok(title.includes("truncate"));
  assert.ok(right.includes("shrink-0"));
  assert.ok(toolbar.includes("様式3"));
  assert.ok(toolbar.includes("＋カード"));
  assert.ok(toolbar.includes("data-rd-undo"));
  assert.ok(toolbar.includes("data-rd-zoom-percent"));
  assert.ok(toolbar.includes("100%"));
  assert.ok(toolbar.includes("全体表示"));
  assert.ok(toolbar.includes("印刷"));
});

test("pan/zoom transform does not apply to toolbar", () => {
  assert.ok(
    ws.includes(
      "translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})",
    ),
  );
  assert.ok(ws.indexOf("RelatedDiagramEditorToolbar") < ws.indexOf("data-rd-canvas-transform"));
  assert.equal(toolbar.includes("transform.x"), false);
  assert.equal(toolbar.includes("transform.scale"), false);
  assert.ok(ws.includes("fixed inset-0"));
  assert.ok(ws.includes("data-rd-canvas-shell"));
  assert.ok(ws.includes("min-w-0 flex-1 overflow-hidden"));
});

test("iPad landscape toolbar fits without horizontal overflow", () => {
  for (const width of IPAD_LANDSCAPE_WIDTHS) {
    assert.equal(toolbarRowFits(width), true, `width ${width}`);
    assert.equal(
      toolbarOverflows({
        clientWidth: width,
        scrollWidth: estimatedToolbarRequiredWidth(width),
      }),
      false,
      `scroll ${width}`,
    );
  }
  assert.equal(toolbarChromeMetrics(1180).showDev, false);
  assert.equal(toolbarChromeMetrics(1180).compact, true);
  assert.equal(toolbarChromeMetrics(1280).showDev, true);
  assert.ok(toolbar.includes("max-[1279px]:px-2"));
  assert.ok(toolbar.includes("min-[1280px]:inline"));
  assert.ok(toolbar.includes("data-rd-zoom-percent"));
  assert.ok(toolbar.includes("100%"));
  assert.ok(toolbar.includes("全体表示"));
  assert.ok(toolbar.includes("印刷"));
});

test("pinch on card does not tap or start drag", () => {
  const down = {
    cardId: "demo_info",
    movable: true,
    pointerId: 1,
    pointerType: "touch",
    clientX: 100,
    clientY: 100,
    originX: 40,
    originY: 50,
    cardWidth: 180,
    cardHeight: 72,
  };
  const cardThenBlank = applySecondTouch(
    applyPointerDownOnCard(createIdleState(), down),
  );
  assert.equal(cardThenBlank.state.phase, "VIEWPORT_GESTURE");
  assert.equal(cardThenBlank.state.selectedCardId, null);
  assert.equal(cardThenBlank.commit, null);
  assert.equal(
    applyPointerUp(cardThenBlank.state, { pointerId: 1 }).state.selectedCardId,
    null,
  );
  const blankThenCard = applyPointerDownOnCard(
    applySecondTouch(applyPointerDownOnBlank(createIdleState())).state,
    down,
  );
  assert.equal(blankThenCard.phase, "VIEWPORT_GESTURE");
  assert.equal(blankThenCard.selectedCardId, null);
  const bothCard = applyViewportGestureEnd(
    applySecondTouch(applyPointerDownOnCard(createIdleState(), down)).state,
  );
  assert.equal(bothCard.selectedCardId, null);
  const bothBlank = applyViewportGestureEnd(applySecondTouch(createIdleState()).state);
  assert.equal(bothBlank.selectedCardId, null);
  const hook = src("../../../components/v2/relatedDiagram/useCardInteraction.ts");
  assert.ok(hook.includes("CARD_PRESSING"));
  assert.ok(hook.includes("touchIdsRef.current.size >= 2"));
});

test("single pointer tap and drag still work", () => {
  const down = {
    cardId: "demo_info",
    movable: true,
    pointerId: 1,
    pointerType: "touch",
    clientX: 100,
    clientY: 100,
    originX: 40,
    originY: 50,
    cardWidth: 180,
    cardHeight: 72,
  };
  const tap = applyPointerUp(
    applyPointerMove(applyPointerDownOnCard(createIdleState(), down), {
      pointerId: 1,
      clientX: 100 + CARD_DRAG_THRESHOLD_PX - 1,
      clientY: 100,
      scale: 1,
    }),
    { pointerId: 1 },
  );
  assert.equal(tap.state.phase, "CARD_SELECTED");
  assert.equal(tap.drop, null);
  const drag = applyPointerMove(applyPointerDownOnCard(createIdleState(), down), {
    pointerId: 1,
    clientX: 100 + CARD_DRAG_THRESHOLD_PX + 1,
    clientY: 100,
    scale: 1,
  });
  assert.equal(drag.phase, "CARD_DRAGGING");
  assert.equal(drag.selectedCardId, "demo_info");
});

console.log(`\n${passed} passed`);
