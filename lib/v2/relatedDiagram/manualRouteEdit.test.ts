/**
 * Manual Route Editing V1 — MRE-A…T.
 * Run: node_modules/.bin/jiti lib/v2/relatedDiagram/manualRouteEdit.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyCardPositionToGraph } from "./cardInteractionState";
import { createEmptySemanticGraph } from "./semanticGraph";
import {
  applyConnectionRouteCancel,
  applyConnectionRoutePointerDown,
  applyConnectionRoutePointerMove,
  applyConnectionRoutePointerUp,
  applyConnectionRouteSecondPointer,
  CONNECTION_ROUTE_DRAG_THRESHOLD_PX,
  canStartConnectionRouteDrag,
} from "./connectionRouteGesture";
import {
  collectArrangeAffectedConnectionIds,
  restitchAffectedRoutes,
} from "./diagramLayoutL2d";
import {
  emptyDiagramHistory,
  pushDiagramHistory,
  redoDiagramHistory,
  undoDiagramHistory,
} from "./diagramHistory";
import { CARD_DRAG_THRESHOLD_PX } from "./cardInteractionState";
import {
  applyIncrementalCardMove,
  cloneStableRouteState,
  pointsDeepEqual,
  seedStableRouteState,
  type StableRouteState,
} from "./incrementalRoutes";
import {
  authoredRouteRecord,
  canEditConnectionRoute,
  commitManualRouteEdit,
  connectionSemanticsEqual,
  dragOrthogonalSegment,
  isManualConnection,
  listEditableSegments,
  manualRouteHasCardThrough,
  pickEditableSegment,
  repairManualRouteEndpoints,
  resetManualRouteToAuto,
  routeIsOrthogonal,
  simplifyManualRoute,
} from "./manualRouteEdit";
import { buildPatientAStudentReconstruction } from "./buildPatientAStudentReconstruction";
import { applyPatientACardSizeScale } from "./patientACardSizeExperiment";
import {
  PATIENT_A_MERGE_JUNCTION_SPECS,
  buildPatientAJunctionReconstruction,
  patientAMergeConnectionIds,
} from "./patientAMergeJunctionTopology";
import {
  emptyRouteTopology,
  isJunctionOwnedConnection,
  isStudentManualRoute,
  type RelatedDiagramRouteTopology,
} from "./routeTopology";
import type {
  RelatedDiagramCard,
  RelatedDiagramConnection,
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

function scene() {
  const cards = [card("a", 80, 200), card("b", 520, 200)];
  const connection = conn("cn_ab", "a", "b");
  const connections = [connection];
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
    },
    lastValidPoints: { cn_ab: JOG.map((point) => ({ ...point })) },
    invalidReasons: {},
    bridges: [],
    qualityTrace: {},
  };
  return { cards, connection, connections, routeState };
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

function simulateDrag(input: {
  selected: boolean;
  connection: RelatedDiagramConnection;
  points: { x: number; y: number }[];
  topology?: RelatedDiagramRouteTopology;
  start: { x: number; y: number };
  end: { x: number; y: number };
  logical: { x: number; y: number };
  pointerCount?: number;
  cardDragging?: boolean;
  moves?: number;
}) {
  let historyWrites = 0;
  let state = applyConnectionRoutePointerDown({
    pointerId: 1,
    pointerCount: input.pointerCount ?? 1,
    isPrimary: true,
    connectionId: input.connection.id,
    selectedConnectionId: input.selected ? input.connection.id : null,
    clientX: input.start.x,
    clientY: input.start.y,
    logicalPoint: input.logical,
    points: input.points,
    connection: input.connection,
    topology: input.topology,
    cardDragging: input.cardDragging ?? false,
  });
  const steps = input.moves ?? 4;
  for (let i = 1; i <= steps; i += 1) {
    state = applyConnectionRoutePointerMove(state, {
      pointerId: 1,
      clientX: input.start.x + ((input.end.x - input.start.x) * i) / steps,
      clientY: input.start.y + ((input.end.y - input.start.y) * i) / steps,
      pointerCount: input.pointerCount ?? 1,
    });
    historyWrites += 0;
  }
  const up = applyConnectionRoutePointerUp(state, 1, 1);
  return { state, up, historyWrites };
}

test("MRE-A 1:1 select → editable", () => {
  const { connection, routeState } = scene();
  assert.equal(canEditConnectionRoute(undefined, connection), true);
  const segments = listEditableSegments(routeState.byId.cn_ab!.points);
  assert.ok(segments.length >= 2);
  assert.ok(segments.some((row) => row.orientation === "horizontal"));
  assert.ok(segments.some((row) => row.orientation === "vertical"));
});

test("MRE-B horizontal segment drag → y only / orthogonal", () => {
  const points = JOG.map((point) => ({ ...point }));
  const next = dragOrthogonalSegment({
    points,
    segmentIndex: 2,
    deltaX: 80,
    deltaY: -40,
  });
  assert.equal(next[0]!.x, 240);
  assert.equal(next[0]!.y, 236);
  assert.deepEqual(next[next.length - 1], JOG[JOG.length - 1]);
  assert.ok(next.some((point) => point.y === 100));
  assert.ok(routeIsOrthogonal(next));
  assert.equal(next.some((point) => point.x === 360 + 80 && point.y === 140), false);
});

test("MRE-C vertical segment drag → x only / orthogonal", () => {
  const next = dragOrthogonalSegment({
    points: JOG,
    segmentIndex: 1,
    deltaX: 24,
    deltaY: 90,
  });
  assert.equal(next[1]!.x, 384);
  assert.equal(next[2]!.x, 384);
  assert.equal(next[1]!.y, 236);
  assert.equal(next[2]!.y, 140);
  assert.ok(routeIsOrthogonal(next));
});

test("MRE-D connection semantics exact", () => {
  const { connection, routeState } = scene();
  const before = { ...connection };
  const committed = commitManualRouteEdit({
    connection,
    routeState,
    points: dragOrthogonalSegment({
      points: JOG,
      segmentIndex: 2,
      deltaX: 0,
      deltaY: 20,
    }),
  });
  assert.ok(connectionSemanticsEqual(before, connection));
  assert.equal(committed.routeState.byId.cn_ab!.sourceCardId, "a");
  assert.equal(committed.routeState.byId.cn_ab!.targetCardId, "b");
  assert.equal(connection.relationType, "current");
  assert.equal(connection.origin, "student_diagram");
});

test("MRE-E 1 gesture = history 1", () => {
  const { connection } = scene();
  const gesture = simulateDrag({
    selected: true,
    connection,
    points: JOG,
    start: { x: 440, y: 140 },
    end: { x: 440, y: 180 },
    logical: { x: 440, y: 140 },
  });
  assert.equal(gesture.historyWrites, 0);
  assert.equal(gesture.up.commit?.kind, "drag");
  let history = emptyDiagramHistory();
  history = pushDiagramHistory(history, {
    type: "editRoute",
    connectionId: connection.id,
    before: {
      routeState: scene().routeState,
      topology: emptyRouteTopology(),
    },
    after: {
      routeState: scene().routeState,
      topology: emptyRouteTopology(),
    },
  });
  assert.equal(history.past.length, 1);
  assert.equal(history.future.length, 0);
});

test("MRE-F Undo / Redo exact", () => {
  const { connection, routeState } = scene();
  const beforeTopo = emptyRouteTopology();
  const after = commitManualRouteEdit({
    connection,
    routeState,
    topology: beforeTopo,
    points: dragOrthogonalSegment({
      points: JOG,
      segmentIndex: 2,
      deltaX: 0,
      deltaY: 28,
    }),
  });
  let history = pushDiagramHistory(emptyDiagramHistory(), {
    type: "editRoute",
    connectionId: connection.id,
    before: { routeState: cloneStableRouteState(routeState), topology: beforeTopo },
    after: {
      routeState: cloneStableRouteState(after.routeState),
      topology: after.topology,
    },
  });
  const undo = undoDiagramHistory(history);
  assert.equal(undo.command.kind, "applyFragment");
  if (undo.command.kind !== "applyFragment") return;
  assert.ok(
    pointsDeepEqual(undo.command.fragment.routeState.byId.cn_ab!.points, JOG),
  );
  history = undo.history;
  const redo = redoDiagramHistory(history);
  assert.equal(redo.command.kind, "applyFragment");
  if (redo.command.kind !== "applyFragment") return;
  assert.ok(
    pointsDeepEqual(
      redo.command.fragment.routeState.byId.cn_ab!.points,
      after.routeState.byId.cn_ab!.points,
    ),
  );
});

test("MRE-G 2回目 drag も history 1", () => {
  const { connection, routeState } = scene();
  const first = commitManualRouteEdit({
    connection,
    routeState,
    points: dragOrthogonalSegment({
      points: JOG,
      segmentIndex: 2,
      deltaX: 0,
      deltaY: 16,
    }),
  });
  let history = pushDiagramHistory(emptyDiagramHistory(), {
    type: "editRoute",
    connectionId: connection.id,
    before: { routeState, topology: undefined },
    after: { routeState: first.routeState, topology: first.topology },
  });
  const second = commitManualRouteEdit({
    connection,
    routeState: first.routeState,
    topology: first.topology,
    points: dragOrthogonalSegment({
      points: first.routeState.byId.cn_ab!.points,
      segmentIndex: 2,
      deltaX: 0,
      deltaY: 12,
    }),
  });
  history = pushDiagramHistory(history, {
    type: "editRoute",
    connectionId: connection.id,
    before: { routeState: first.routeState, topology: first.topology },
    after: { routeState: second.routeState, topology: second.topology },
  });
  assert.equal(history.past.length, 2);
  assert.equal(history.past[1]!.type, "editRoute");
});

test("MRE-H 自動に戻す → topology route削除 + auto route", () => {
  const { cards, connection, connections, routeState } = scene();
  const manual = commitManualRouteEdit({
    connection,
    routeState,
    points: JOG,
  });
  assert.equal(isManualConnection(manual.topology, connection), true);
  const reset = resetManualRouteToAuto({
    cards,
    connections,
    connection,
    routeState: manual.routeState,
    topology: manual.topology,
  });
  assert.equal(isStudentManualRoute(reset.topology, connection), false);
  assert.equal(authoredRouteRecord(reset.topology, connection.id), undefined);
  assert.ok((reset.routeState.byId.cn_ab?.points.length ?? 0) >= 2);
  assert.equal(isManualConnection(reset.topology, connection), false);
});

test("MRE-I manual connection の card 移動 → internal preserve / endpoint repair", () => {
  const { cards, connection, connections, routeState } = scene();
  const manual = commitManualRouteEdit({
    connection,
    routeState,
    points: JOG,
  });
  const movedGraph = applyCardPositionToGraph(
    { ...createEmptySemanticGraph(), cards, connections },
    "a",
    80,
    260,
  );
  const incremental = applyIncrementalCardMove({
    previous: manual.routeState,
    cards: movedGraph.cards,
    connections,
    topology: manual.topology,
    movedCardId: "a",
  });
  const next = incremental.state.byId.cn_ab!.points;
  assert.ok(subsequence(next, JOG.slice(1, -1)));
  assert.ok(routeIsOrthogonal(next));
  assert.equal(isStudentManualRoute(incremental.topology, connection), true);
  const auto = seedStableRouteState(movedGraph.cards, connections);
  assert.equal(
    pointsDeepEqual(next, auto.byId.cn_ab?.points ?? []),
    false,
  );
});

test("MRE-J Arrange + card不動 → manual route exact", () => {
  const { cards, connections, routeState, connection } = scene();
  const manual = commitManualRouteEdit({
    connection,
    routeState,
    points: JOG,
  });
  const affected = collectArrangeAffectedConnectionIds({
    previousCards: cards,
    nextCards: cards,
    connections,
    topology: manual.topology,
    previousTopology: manual.topology,
    activeUnitCardIds: [],
  });
  assert.equal(affected.includes("cn_ab"), false);
  const stitched = restitchAffectedRoutes({
    previous: manual.routeState,
    cards,
    connections,
    topology: manual.topology,
    affectedIds: affected,
  });
  assert.ok(pointsDeepEqual(stitched.routeState.byId.cn_ab!.points, JOG));
});

test("MRE-J2 Arrange + endpoint card移動 → internal preserve / endpoint repair", () => {
  const { cards, connections, routeState, connection } = scene();
  const manual = commitManualRouteEdit({
    connection,
    routeState,
    points: JOG,
  });
  const nextCards = cards.map((row) =>
    row.id === "b"
      ? { ...row, layout: { ...row.layout, y: row.layout.y + 48 } }
      : row,
  );
  const affected = collectArrangeAffectedConnectionIds({
    previousCards: cards,
    nextCards,
    connections,
    topology: manual.topology,
    previousTopology: manual.topology,
    activeUnitCardIds: [],
  });
  assert.ok(affected.includes("cn_ab"));
  const stitched = restitchAffectedRoutes({
    previous: manual.routeState,
    cards: nextCards,
    connections,
    topology: manual.topology,
    affectedIds: affected,
  });
  const next = stitched.routeState.byId.cn_ab!.points;
  assert.ok(subsequence(next, JOG.slice(1, -1)));
  assert.ok(isStudentManualRoute(stitched.topology, connection));
  assert.ok(routeIsOrthogonal(next));
});

test("MRE-K Junction所属は edit 不可", () => {
  const connection = conn("cn_j", "a", "b");
  const topology: RelatedDiagramRouteTopology = {
    ...emptyRouteTopology(),
    routeGroups: [
      {
        id: "g1",
        sourceCardId: "a",
        trunkId: "t1",
        connectionIds: ["cn_j"],
      },
    ],
    trunks: [
      {
        id: "t1",
        points: [{ x: 0, y: 0 }],
        connectionIds: ["cn_j"],
        branchPointId: "bp1",
      },
    ],
    branchPoints: [
      { id: "bp1", x: 10, y: 10, connectionIds: ["cn_j"] },
    ],
    routes: [
      {
        connectionId: "cn_j",
        sourceEdge: "right",
        targetEdge: "left",
        points: JOG,
      },
    ],
  };
  assert.equal(isJunctionOwnedConnection(topology, "cn_j"), true);
  assert.equal(canEditConnectionRoute(topology, connection), false);
  assert.equal(isStudentManualRoute(topology, connection), false);
  assert.equal(
    canStartConnectionRouteDrag({
      selectedConnectionId: "cn_j",
      connection,
      topology,
      pointerCount: 1,
      cardDragging: false,
    }),
    false,
  );
});

test("MRE-L card tap は connection edit にならない", () => {
  const { connection } = scene();
  const down = applyConnectionRoutePointerDown({
    pointerId: 1,
    pointerCount: 1,
    isPrimary: true,
    connectionId: connection.id,
    selectedConnectionId: connection.id,
    clientX: 300,
    clientY: 236,
    logicalPoint: { x: 300, y: 236 },
    points: JOG,
    connection,
    cardDragging: true,
  });
  assert.equal(down.phase, "idle");
  assert.equal(
    canStartConnectionRouteDrag({
      selectedConnectionId: connection.id,
      connection,
      pointerCount: 1,
      cardDragging: true,
    }),
    false,
  );
});

test("MRE-M 2 pointer で route drag しない", () => {
  const { connection } = scene();
  let state = applyConnectionRoutePointerDown({
    pointerId: 1,
    pointerCount: 1,
    isPrimary: true,
    connectionId: connection.id,
    selectedConnectionId: connection.id,
    clientX: 300,
    clientY: 236,
    logicalPoint: { x: 300, y: 236 },
    points: JOG,
    connection,
    cardDragging: false,
  });
  state = applyConnectionRouteSecondPointer(state);
  state = applyConnectionRoutePointerMove(state, {
    pointerId: 1,
    clientX: 300,
    clientY: 280,
    pointerCount: 2,
  });
  const up = applyConnectionRoutePointerUp(state, 1, 1);
  assert.equal(up.commit, null);
  const two = applyConnectionRoutePointerDown({
    pointerId: 1,
    pointerCount: 2,
    isPrimary: true,
    connectionId: connection.id,
    selectedConnectionId: connection.id,
    clientX: 300,
    clientY: 236,
    logicalPoint: { x: 300, y: 236 },
    points: JOG,
    connection,
    cardDragging: false,
  });
  assert.equal(two.phase, "idle");
});

test("MRE-N card drag と route drag 競合なし", () => {
  const { connection } = scene();
  assert.equal(CONNECTION_ROUTE_DRAG_THRESHOLD_PX, CARD_DRAG_THRESHOLD_PX);
  const cancelled = applyConnectionRouteCancel();
  assert.equal(cancelled.phase, "idle");
  assert.equal(
    canStartConnectionRouteDrag({
      selectedConnectionId: connection.id,
      connection,
      pointerCount: 1,
      cardDragging: true,
    }),
    false,
  );
});

test("MRE-O duplicate / zero / collinear のみ除去。meaningful jog 保持", () => {
  const cleaned = simplifyManualRoute([
    { x: 10, y: 10 },
    { x: 10, y: 10 },
    { x: 40, y: 10 },
    { x: 80, y: 10 },
    { x: 80, y: 40 },
    { x: 80, y: 40 },
    { x: 120, y: 40 },
  ]);
  assert.deepEqual(cleaned, [
    { x: 10, y: 10 },
    { x: 80, y: 10 },
    { x: 80, y: 40 },
    { x: 120, y: 40 },
  ]);
  const jog = simplifyManualRoute(JOG);
  assert.ok(subsequence(jog, [{ x: 360, y: 236 }, { x: 360, y: 140 }]));
});

test("MRE-P card-through manual route を reject しない", () => {
  const blocker = card("wall", 300, 200);
  const { cards, connection, routeState } = scene();
  const through = [
    { x: 240, y: 236 },
    { x: 400, y: 236 },
    { x: 520, y: 236 },
  ];
  const committed = commitManualRouteEdit({
    connection,
    routeState,
    points: through,
  });
  assert.ok(
    manualRouteHasCardThrough({
      cards: [...cards, blocker],
      connection,
      points: committed.routeState.byId.cn_ab!.points,
    }),
  );
  assert.equal(isManualConnection(committed.topology, connection), true);
});

test("MRE-Q deterministic / array order independent", () => {
  const a = pickEditableSegment(JOG, { x: 360, y: 188 });
  const reversed = [...JOG].reverse();
  const b = pickEditableSegment(JOG.slice(), { x: 360, y: 188 });
  assert.ok(a);
  assert.equal(a?.index, b?.index);
  const { connection, routeState } = scene();
  const first = commitManualRouteEdit({
    connection,
    routeState,
    points: JOG,
  });
  const second = commitManualRouteEdit({
    connection,
    routeState: {
      ...routeState,
      byId: { ...routeState.byId },
    },
    points: JOG.map((point) => ({ ...point })),
  });
  assert.ok(
    pointsDeepEqual(
      first.topology.routes[0]!.points,
      second.topology.routes[0]!.points,
    ),
  );
  void reversed;
});

test("MRE-R Patient A Junction experiment exact", () => {
  const base = buildPatientAStudentReconstruction();
  const plain90 = applyPatientACardSizeScale(base.graph, 90);
  const junction = buildPatientAJunctionReconstruction(90);
  const mergeIds = patientAMergeConnectionIds(base.cardKeys);
  assert.equal(junction.graph.cards.length, 71);
  assert.equal(junction.graph.connections.length, 64);
  assert.equal(plain90.connections.length, 64);
  assert.equal(PATIENT_A_MERGE_JUNCTION_SPECS.length, 4);
  assert.equal(mergeIds.length, 8);
  const lib = src("./patientAMergeJunctionTopology.ts");
  assert.equal(lib.includes("manualRouteEdit"), false);
  assert.equal(lib.includes("editRoute"), false);
});

test("MRE-S manual topology route に bestOneToOne / full reroute を適用しない", () => {
  const { cards, connections, routeState, connection } = scene();
  const manual = commitManualRouteEdit({
    connection,
    routeState,
    points: JOG,
  });
  const nextCards = cards.map((row) =>
    row.id === "a"
      ? { ...row, layout: { ...row.layout, y: row.layout.y + 32 } }
      : row,
  );
  const incremental = applyIncrementalCardMove({
    previous: manual.routeState,
    cards: nextCards,
    connections,
    topology: manual.topology,
    movedCardId: "a",
  });
  const stitched = restitchAffectedRoutes({
    previous: manual.routeState,
    cards: nextCards,
    connections,
    topology: manual.topology,
    affectedIds: ["cn_ab"],
  });
  assert.ok(subsequence(incremental.state.byId.cn_ab!.points, JOG.slice(1, -1)));
  assert.ok(subsequence(stitched.routeState.byId.cn_ab!.points, JOG.slice(1, -1)));
  const repairedOnly = repairManualRouteEndpoints({
    points: JOG,
    sourcePin: incremental.state.byId.cn_ab!.sourcePin,
    targetPin: incremental.state.byId.cn_ab!.targetPin,
  });
  assert.ok(subsequence(repairedOnly, JOG.slice(1, -1)));
});

test("MRE-T 自動に戻した後は通常 routing 対象", () => {
  const { cards, connection, connections, routeState } = scene();
  const manual = commitManualRouteEdit({
    connection,
    routeState,
    points: JOG,
  });
  const reset = resetManualRouteToAuto({
    cards,
    connections,
    connection,
    routeState: manual.routeState,
    topology: manual.topology,
  });
  assert.equal(isStudentManualRoute(reset.topology, connection), false);
  const nextCards = cards.map((row) =>
    row.id === "a"
      ? { ...row, layout: { ...row.layout, y: row.layout.y + 80 } }
      : row,
  );
  const incremental = applyIncrementalCardMove({
    previous: reset.routeState,
    cards: nextCards,
    connections,
    topology: reset.topology,
    movedCardId: "a",
  });
  assert.equal(isStudentManualRoute(incremental.topology, connection), false);
  assert.equal(
    pointsDeepEqual(incremental.state.byId.cn_ab!.points, JOG),
    false,
  );
});

test("tap below threshold selects, does not drag", () => {
  const { connection } = scene();
  const gesture = simulateDrag({
    selected: false,
    connection,
    points: JOG,
    start: { x: 300, y: 236 },
    end: { x: 303, y: 238 },
    logical: { x: 300, y: 236 },
  });
  assert.equal(gesture.up.commit?.kind, "tap");
});

test("source scan: no routingMode / Patient A uses existing selection", () => {
  const domain = src("./manualRouteEdit.ts");
  const hook = src("../../../components/v2/relatedDiagram/useConnectionRouteInteraction.ts");
  const patientA = src(
    "../../../components/v2/relatedDiagram/RelatedDiagramPatientADevWorkspace.tsx",
  );
  const fixture = src(
    "../../../components/v2/relatedDiagram/RelatedDiagramDevFixtureWorkspace.tsx",
  );
  assert.equal(domain.includes("routingMode"), false);
  assert.ok(hook.includes("setPointerCapture"));
  assert.ok(patientA.includes("useConnectionRouteInteraction"));
  assert.ok(patientA.includes("selectedConnectionId"));
  assert.ok(fixture.includes("useConnectionRouteInteraction"));
  assert.equal(fixture.includes("onBeginRouteTrace"), false);
  assert.equal(fixture.includes("ルートを描く"), false);
});

console.log(`${passed} passed`);
