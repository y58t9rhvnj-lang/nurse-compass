/**
 * Slice A — Student V1 Segment Parallel Move.
 * Run: ./node_modules/.bin/jiti lib/v2/relatedDiagram/segmentParallelMove.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { classifyActionPopoverPointer } from "./actionPopoverGesture";
import { connectionActionBarDockRect } from "./actionPopoverPlacement";
import {
  applyConnectionRoutePointerDown,
  applyConnectionRoutePointerMove,
  applyConnectionRoutePointerUp,
  applyConnectionRouteSecondPointer,
} from "./connectionRouteGesture";
import {
  emptyDiagramHistory,
  pushDiagramHistory,
  redoDiagramHistory,
  undoDiagramHistory,
} from "./diagramHistory";
import {
  cloneStableRouteState,
  pointsDeepEqual,
  type StableRouteState,
} from "./incrementalRoutes";
import {
  canEditConnectionRoute,
  commitManualRouteEdit,
  dragOrthogonalSegment,
  isStudentManualRoute,
  listEditableSegments,
  pickEditableSegment,
  routeIsOrthogonal,
  segmentOrientation,
} from "./manualRouteEdit";
import type { Point } from "./orthogonalRouting";
import { emptyRouteTopology } from "./routeTopology";
import type { RelatedDiagramConnection } from "./types";

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

function pt(x: number, y: number): Point {
  return { x, y };
}

const ROUTE = [
  pt(0, 200),
  pt(80, 200),
  pt(80, 80),
  pt(220, 80),
  pt(220, 200),
  pt(300, 200),
];
const STRAIGHT = [pt(0, 100), pt(240, 100)];
const L_SHAPE = [pt(0, 100), pt(160, 100), pt(160, 180)];
const MIDDLE_H = 2;
const MIDDLE_V = 1;

const connection: RelatedDiagramConnection = {
  id: "cn_ab",
  sourceCardId: "a",
  targetCardId: "b",
  relationType: "current",
  origin: "student_diagram",
  createdAt: "2026-09-23T00:00:00.000Z",
  updatedAt: "2026-09-23T00:00:00.000Z",
};

function routeStateOf(points: Point[]): StableRouteState {
  return {
    byId: {
      cn_ab: {
        connectionId: "cn_ab",
        sourceCardId: "a",
        targetCardId: "b",
        sourceEdge: "right",
        targetEdge: "left",
        sourcePin: { ...points[0]! },
        targetPin: { ...points[points.length - 1]! },
        points: points.map((point) => ({ ...point })),
      },
    },
    lastValidPoints: { cn_ab: points.map((point) => ({ ...point })) },
    invalidReasons: {},
    bridges: [],
    qualityTrace: {},
  };
}

function hasDiagonal(points: Point[]): boolean {
  return points.some((_, i) => {
    if (i === 0) return false;
    return segmentOrientation(points[i - 1]!, points[i]!) === "diagonal";
  });
}

test("A middle horizontal → 上下 parallel move", () => {
  const next = dragOrthogonalSegment({
    points: ROUTE,
    segmentIndex: MIDDLE_H,
    deltaX: 40,
    deltaY: 36,
  });
  assert.equal(next.length, ROUTE.length);
  assert.equal(next[MIDDLE_H]!.y, 116);
  assert.equal(next[MIDDLE_H + 1]!.y, 116);
  assert.equal(next[MIDDLE_H]!.x, ROUTE[MIDDLE_H]!.x);
  assert.equal(next[MIDDLE_H + 1]!.x, ROUTE[MIDDLE_H + 1]!.x);
  assert.deepEqual(next[0], ROUTE[0]);
  assert.deepEqual(next[next.length - 1], ROUTE[ROUTE.length - 1]);
  assert.equal(hasDiagonal(next), false);
});

test("B middle vertical → 左右 parallel move", () => {
  const next = dragOrthogonalSegment({
    points: ROUTE,
    segmentIndex: MIDDLE_V,
    deltaX: 28,
    deltaY: 50,
  });
  assert.equal(next.length, ROUTE.length);
  assert.equal(next[MIDDLE_V]!.x, 108);
  assert.equal(next[MIDDLE_V + 1]!.x, 108);
  assert.equal(next[MIDDLE_V]!.y, ROUTE[MIDDLE_V]!.y);
  assert.equal(next[MIDDLE_V + 1]!.y, ROUTE[MIDDLE_V + 1]!.y);
  assert.equal(hasDiagonal(next), false);
});

test("C points.length before == after", () => {
  const h = dragOrthogonalSegment({
    points: ROUTE,
    segmentIndex: MIDDLE_H,
    deltaX: 0,
    deltaY: -20,
  });
  const v = dragOrthogonalSegment({
    points: ROUTE,
    segmentIndex: MIDDLE_V,
    deltaX: -16,
    deltaY: 0,
  });
  assert.equal(h.length, ROUTE.length);
  assert.equal(v.length, ROUTE.length);
});

test("D diagonal 0", () => {
  for (const [index, dx, dy] of [
    [MIDDLE_H, 80, 40],
    [MIDDLE_V, 40, 80],
  ] as const) {
    const next = dragOrthogonalSegment({
      points: ROUTE,
      segmentIndex: index,
      deltaX: dx,
      deltaY: dy,
    });
    assert.equal(hasDiagonal(next), false);
    assert.equal(routeIsOrthogonal(next), true);
  }
});

test("E first segment 編集不可", () => {
  assert.equal(
    listEditableSegments(ROUTE).some((row) => row.index === 0),
    false,
  );
  const next = dragOrthogonalSegment({
    points: ROUTE,
    segmentIndex: 0,
    deltaX: 0,
    deltaY: 40,
  });
  assert.deepEqual(next, ROUTE);
});

test("F last segment 編集不可", () => {
  assert.equal(
    listEditableSegments(ROUTE).some((row) => row.index === ROUTE.length - 2),
    false,
  );
  const next = dragOrthogonalSegment({
    points: ROUTE,
    segmentIndex: ROUTE.length - 2,
    deltaX: 0,
    deltaY: 40,
  });
  assert.deepEqual(next, ROUTE);
});

test("G 2-point straight 編集不可", () => {
  assert.deepEqual(listEditableSegments(STRAIGHT), []);
  assert.equal(pickEditableSegment(STRAIGHT, pt(120, 100)), null);
  const next = dragOrthogonalSegment({
    points: STRAIGHT,
    segmentIndex: 0,
    deltaX: 0,
    deltaY: 50,
    grab: pt(120, 100),
  });
  assert.deepEqual(next, STRAIGHT);
});

test("H 3-point L middle無し 編集不可", () => {
  assert.deepEqual(listEditableSegments(L_SHAPE), []);
  const first = dragOrthogonalSegment({
    points: L_SHAPE,
    segmentIndex: 0,
    deltaX: 0,
    deltaY: 30,
  });
  const last = dragOrthogonalSegment({
    points: L_SHAPE,
    segmentIndex: 1,
    deltaX: 30,
    deltaY: 0,
  });
  assert.deepEqual(first, L_SHAPE);
  assert.deepEqual(last, L_SHAPE);
});

test("I AUTO student Parallel Move commit → MANUAL", () => {
  const before = routeStateOf(ROUTE);
  assert.equal(isStudentManualRoute(emptyRouteTopology(), connection), false);
  const preview = dragOrthogonalSegment({
    points: ROUTE,
    segmentIndex: MIDDLE_H,
    deltaX: 0,
    deltaY: 24,
  });
  const committed = commitManualRouteEdit({
    connection,
    routeState: before,
    topology: emptyRouteTopology(),
    points: preview,
  });
  assert.equal(isStudentManualRoute(committed.topology, connection), true);
  assert.equal(committed.topology.routes[0]?.connectionId, "cn_ab");
  assert.equal(committed.routeState.byId.cn_ab!.points.length, ROUTE.length);
});

test("J Undo / Redo exact", () => {
  const beforeState = routeStateOf(ROUTE);
  const afterPoints = dragOrthogonalSegment({
    points: ROUTE,
    segmentIndex: MIDDLE_H,
    deltaX: 0,
    deltaY: 24,
  });
  const after = commitManualRouteEdit({
    connection,
    routeState: beforeState,
    topology: emptyRouteTopology(),
    points: afterPoints,
  });
  let history = pushDiagramHistory(emptyDiagramHistory(), {
    type: "editRoute",
    connectionId: "cn_ab",
    before: {
      routeState: cloneStableRouteState(beforeState),
      topology: emptyRouteTopology(),
    },
    after: {
      routeState: cloneStableRouteState(after.routeState),
      topology: after.topology,
    },
  });
  const undo = undoDiagramHistory(history);
  assert.equal(undo.command.kind, "applyFragment");
  if (undo.command.kind !== "applyFragment") return;
  assert.ok(
    pointsDeepEqual(undo.command.fragment.routeState.byId.cn_ab!.points, ROUTE),
  );
  const redo = redoDiagramHistory(undo.history);
  assert.equal(redo.command.kind, "applyFragment");
  if (redo.command.kind !== "applyFragment") return;
  assert.ok(
    pointsDeepEqual(
      redo.command.fragment.routeState.byId.cn_ab!.points,
      after.routeState.byId.cn_ab!.points,
    ),
  );
});

test("K second pointer cancel → preview rollback / history 0", () => {
  let state = applyConnectionRoutePointerDown({
    pointerId: 1,
    pointerCount: 1,
    isPrimary: true,
    connectionId: "cn_ab",
    selectedConnectionId: "cn_ab",
    clientX: 160,
    clientY: 100,
    logicalPoint: pt(150, 80),
    points: ROUTE,
    connection,
    cardDragging: false,
  });
  assert.ok(state.segment);
  state = applyConnectionRoutePointerMove(state, {
    pointerId: 1,
    clientX: 160,
    clientY: 160,
    pointerCount: 1,
  });
  const cancelled = applyConnectionRouteSecondPointer(state);
  const up = applyConnectionRoutePointerUp(cancelled, 1, 1);
  assert.equal(up.commit, null);
});

test("L Junction-owned 編集不可", () => {
  const topology = {
    ...emptyRouteTopology(),
    branchPoints: [{ id: "bp", x: 80, y: 100, connectionIds: ["cn_ab"] }],
  };
  assert.equal(canEditConnectionRoute(topology, connection), false);
  let state = applyConnectionRoutePointerDown({
    pointerId: 1,
    pointerCount: 1,
    isPrimary: true,
    connectionId: "cn_ab",
    selectedConnectionId: "cn_ab",
    clientX: 160,
    clientY: 100,
    logicalPoint: pt(150, 80),
    points: ROUTE,
    connection,
    topology,
    cardDragging: false,
  });
  assert.equal(state.segment, null);
  state = applyConnectionRoutePointerMove(state, {
    pointerId: 1,
    clientX: 160,
    clientY: 180,
    pointerCount: 1,
  });
  assert.equal(state.phase, "pressing");
});

test("Action Bar dock / connection hit は dismissしない", () => {
  const dock = connectionActionBarDockRect({
    x: 0,
    y: 0,
    width: 800,
    height: 600,
  });
  assert.equal(dock.x, 8);
  assert.equal(dock.y, 8);
  assert.equal(
    classifyActionPopoverPointer({
      kind: "connection",
      pointerCount: 1,
      targetIsPopover: false,
      targetIsConnectionHit: true,
    }),
    "ignore",
  );
  assert.equal(
    classifyActionPopoverPointer({
      kind: "connection",
      pointerCount: 1,
      targetIsPopover: false,
    }),
    "dismiss-outside",
  );
});

test("Student Editor hides arrange; internals remain", () => {
  const toolbar = src("../../../components/v2/relatedDiagram/RelatedDiagramEditorToolbar.tsx");
  const ws = src("../../../components/v2/relatedDiagram/RelatedDiagramDevFixtureWorkspace.tsx");
  const apply = src("./applyRelatedDiagramLayout.ts");
  assert.ok(toolbar.includes("showArrange"));
  assert.ok(toolbar.includes("関連図を整える"));
  assert.ok(ws.includes("showArrange={false}"));
  assert.ok(ws.includes("onArrange={handleArrange}"));
  assert.ok(ws.includes("connectionActionBarDockRect"));
  assert.ok(apply.includes("arrangeRelatedDiagramScene"));
  assert.equal(src("./autoCardMoveQualityReroute.ts").includes("decideStudentConnectionRoute"), true);
});

test("no-op / zero delta は points exact", () => {
  const next = dragOrthogonalSegment({
    points: ROUTE,
    segmentIndex: MIDDLE_H,
    deltaX: 0,
    deltaY: 0,
  });
  assert.deepEqual(next, ROUTE);
});

console.log(`\n${passed} passed`);
