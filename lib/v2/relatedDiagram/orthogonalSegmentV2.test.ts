/**
 * Orthogonal Segment Operation V2.
 * Run: ./node_modules/.bin/jiti lib/v2/relatedDiagram/orthogonalSegmentV2.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildPatientAStudentReconstruction } from "./buildPatientAStudentReconstruction";
import {
  emptyDiagramHistory,
  pushDiagramHistory,
  redoDiagramHistory,
  undoDiagramHistory,
} from "./diagramHistory";
import { applyConnectionRouteSecondPointer } from "./connectionRouteGesture";
import {
  applyConnectionRoutePointerDown,
  applyConnectionRoutePointerMove,
  applyConnectionRoutePointerUp,
} from "./connectionRouteGesture";
import {
  cloneStableRouteState,
  pointsDeepEqual,
  seedInitialAutoRouteState,
  type StableRouteState,
} from "./incrementalRoutes";
import {
  canonicalizeManualRoute,
  commitManualRouteEdit,
  dragOrthogonalSegment,
  routeIsOrthogonal,
  segmentOrientation,
} from "./manualRouteEdit";
import { applyPatientACardSizeScale } from "./patientACardSizeExperiment";
import { emptyRouteTopology } from "./routeTopology";
import type { Point } from "./orthogonalRouting";
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

function hasDiagonal(points: Point[]): boolean {
  for (let i = 0; i < points.length - 1; i += 1) {
    if (segmentOrientation(points[i]!, points[i + 1]!) === "diagonal") return true;
  }
  return false;
}

const HH = [pt(0, 100), pt(100, 100), pt(200, 100)];
const LONG_H = [pt(100, 200), pt(700, 200)];
const LONG_V = [pt(400, 80), pt(400, 700)];
const L_HV = [pt(0, 100), pt(200, 100), pt(200, 180)];
const JOG = [
  pt(0, 100),
  pt(80, 100),
  pt(80, 40),
  pt(200, 40),
];

const connection: RelatedDiagramConnection = {
  id: "cn_ab",
  sourceCardId: "a",
  targetCardId: "b",
  relationType: "current",
  origin: "student_diagram",
  createdAt: "2026-09-22T00:00:00.000Z",
  updatedAt: "2026-09-22T00:00:00.000Z",
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
  };
}

test("V2-A H-H min fixture canonicalizes then first drag is diagonal-free", () => {
  const canonical = canonicalizeManualRoute(HH);
  assert.deepEqual(canonical, [pt(0, 100), pt(200, 100)]);
  const next = dragOrthogonalSegment({
    points: HH,
    segmentIndex: 0,
    deltaX: 0,
    deltaY: 40,
  });
  assert.equal(hasDiagonal(next), false);
  assert.equal(routeIsOrthogonal(next), true);
  assert.deepEqual(next[0], HH[0]);
  assert.deepEqual(next[next.length - 1], HH[HH.length - 1]);
});

test("V2-B 2-point H / V keep endpoints", () => {
  const h = dragOrthogonalSegment({
    points: LONG_H,
    segmentIndex: 0,
    deltaX: 30,
    deltaY: 70,
    grab: pt(400, 200),
  });
  const v = dragOrthogonalSegment({
    points: LONG_V,
    segmentIndex: 0,
    deltaX: 50,
    deltaY: 20,
    grab: pt(400, 390),
  });
  assert.deepEqual(h[0], LONG_H[0]);
  assert.deepEqual(h[h.length - 1], LONG_H[1]);
  assert.deepEqual(v[0], LONG_V[0]);
  assert.deepEqual(v[v.length - 1], LONG_V[1]);
  assert.equal(hasDiagonal(h), false);
  assert.equal(hasDiagonal(v), false);
});

test("V2-C 3-point L first and last", () => {
  const first = dragOrthogonalSegment({
    points: L_HV,
    segmentIndex: 0,
    deltaX: 0,
    deltaY: 50,
  });
  const last = dragOrthogonalSegment({
    points: L_HV,
    segmentIndex: 1,
    deltaX: 40,
    deltaY: 0,
  });
  assert.deepEqual(first[0], L_HV[0]);
  assert.deepEqual(first[first.length - 1], L_HV[L_HV.length - 1]);
  assert.deepEqual(last[0], L_HV[0]);
  assert.deepEqual(last[last.length - 1], L_HV[L_HV.length - 1]);
  assert.equal(hasDiagonal(first), false);
  assert.equal(hasDiagonal(last), false);
});

test("V2-D 4-point middle translate", () => {
  const next = dragOrthogonalSegment({
    points: JOG,
    segmentIndex: 1,
    deltaX: 24,
    deltaY: 90,
  });
  assert.equal(next[1]!.x, 104);
  assert.equal(next[2]!.x, 104);
  assert.equal(next[0]!.x, JOG[0]!.x);
  assert.equal(next[next.length - 1]!.x, JOG[JOG.length - 1]!.x);
  assert.equal(hasDiagonal(next), false);
});

test("V2-E Patient A previously diagonal-prone drags stay orthogonal", () => {
  const graph = applyPatientACardSizeScale(
    buildPatientAStudentReconstruction().graph,
    100,
  );
  const seeded = seedInitialAutoRouteState(graph.cards, graph.connections);
  let checks = 0;
  let diagonals = 0;
  for (const conn of graph.connections) {
    const points = seeded.byId[conn.id]!.points;
    for (let index = 0; index < points.length - 1; index += 1) {
      for (const [dx, dy] of [
        [0, 40],
        [40, 0],
        [0, -40],
        [-40, 0],
        [0, 80],
        [80, 0],
      ]) {
        const out = dragOrthogonalSegment({
          points,
          segmentIndex: index,
          deltaX: dx,
          deltaY: dy,
        });
        checks += 1;
        if (hasDiagonal(out)) diagonals += 1;
      }
    }
  }
  assert.ok(checks >= 28);
  assert.equal(diagonals, 0);
  console.log(JSON.stringify({ patientADragChecks: checks, diagonals }));
});

test("V2-F commit preserves endpoints and edges", () => {
  const before = routeStateOf(LONG_H);
  const preview = dragOrthogonalSegment({
    points: LONG_H,
    segmentIndex: 0,
    deltaX: 0,
    deltaY: 60,
    grab: pt(400, 200),
  });
  assert.equal(hasDiagonal(preview), false);
  const committed = commitManualRouteEdit({
    connection,
    routeState: before,
    topology: emptyRouteTopology(),
    points: preview,
  });
  const stored = committed.routeState.byId.cn_ab!;
  assert.equal(hasDiagonal(stored.points), false);
  assert.deepEqual(stored.points[0], LONG_H[0]);
  assert.deepEqual(stored.points[stored.points.length - 1], LONG_H[1]);
  assert.equal(stored.sourceEdge, "right");
  assert.equal(stored.targetEdge, "left");
  assert.equal(committed.topology.routes[0]?.connectionId, "cn_ab");
  assert.deepEqual(committed.topology.routes[0]?.points, stored.points);
});

test("V2-G undo / redo exact", () => {
  const beforeState = routeStateOf(LONG_H);
  const afterPoints = dragOrthogonalSegment({
    points: LONG_H,
    segmentIndex: 0,
    deltaX: 0,
    deltaY: 70,
    grab: pt(400, 200),
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
    pointsDeepEqual(undo.command.fragment.routeState.byId.cn_ab!.points, LONG_H),
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

test("V2-H second pointer cancel does not commit", () => {
  let state = applyConnectionRoutePointerDown({
    pointerId: 1,
    pointerCount: 1,
    isPrimary: true,
    connectionId: "cn_ab",
    selectedConnectionId: "cn_ab",
    clientX: 400,
    clientY: 200,
    logicalPoint: pt(400, 200),
    points: LONG_H,
    connection,
    cardDragging: false,
  });
  state = applyConnectionRoutePointerMove(state, {
    pointerId: 1,
    clientX: 400,
    clientY: 260,
    pointerCount: 1,
  });
  const cancelled = applyConnectionRouteSecondPointer(state);
  const up = applyConnectionRoutePointerUp(cancelled, 1, 1);
  assert.equal(up.commit, null);
});

test("V2-I drag operation has no planner / pathfinder", () => {
  const domain = src("./manualRouteEdit.ts");
  const dragChunk = domain.slice(
    domain.indexOf("export function dragOrthogonalSegment"),
    domain.indexOf("export function upsertManualRoute"),
  );
  for (const name of [
    "selectBestOrthogonalRoute",
    "generateOrthogonalCandidates",
    "findRectilinearPath",
    "ensureOrthogonalPolyline",
    "validateRouteGate",
    "planOrthogonalRoutes",
  ]) {
    assert.equal(dragChunk.includes(name), false, name);
  }
});

test("V2-J existing diagonal is not auto-repaired", () => {
  const slash = [pt(0, 0), pt(80, 40), pt(160, 0)];
  const next = dragOrthogonalSegment({
    points: slash,
    segmentIndex: 0,
    deltaX: 0,
    deltaY: 30,
  });
  assert.deepEqual(next, slash);
});

test("V2-K too-short 2-point is no-op", () => {
  const short = [pt(10, 20), pt(11, 20)];
  const next = dragOrthogonalSegment({
    points: short,
    segmentIndex: 0,
    deltaX: 0,
    deltaY: 40,
  });
  assert.deepEqual(next, short);
});

console.log(`\n${passed} passed`);
