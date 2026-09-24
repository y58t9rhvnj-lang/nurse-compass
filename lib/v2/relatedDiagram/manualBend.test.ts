/**
 * Manual Bend / Segment Drag V1 — MB-A…AM.
 * Run: ./node_modules/.bin/jiti lib/v2/relatedDiagram/manualBend.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
  ENDPOINT_EXCLUSION_PX,
  canEditConnectionRoute,
  commitManualRouteEdit,
  dragOrthogonalSegment,
  routeIsOrthogonal,
  segmentOrientation,
  simplifyManualRoute,
} from "./manualRouteEdit";
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

function pt(x: number, y: number) {
  return { x, y };
}

const LONG_H = [pt(100, 200), pt(700, 200)];
const LONG_V = [pt(400, 80), pt(400, 700)];
const SHORT_H = [pt(100, 200), pt(160, 200)];
const BENT = [pt(100, 200), pt(360, 200), pt(360, 80), pt(700, 80)];

const connection: RelatedDiagramConnection = {
  id: "cn_ab",
  sourceCardId: "a",
  targetCardId: "b",
  relationType: "current",
  origin: "student_diagram",
  createdAt: "2026-09-22T00:00:00.000Z",
  updatedAt: "2026-09-22T00:00:00.000Z",
};

function routeStateOf(
  points: { x: number; y: number }[],
  id = "cn_ab",
): StableRouteState {
  return {
    byId: {
      [id]: {
        connectionId: id,
        sourceCardId: "a",
        targetCardId: "b",
        sourceEdge: "right",
        targetEdge: "left",
        sourcePin: { ...points[0]! },
        targetPin: { ...points[points.length - 1]! },
        points: points.map((point) => ({ ...point })),
      },
    },
    lastValidPoints: { [id]: points.map((point) => ({ ...point })) },
    invalidReasons: {},
    bridges: [],
  };
}

function assertClean(points: { x: number; y: number }[]) {
  assert.equal(routeIsOrthogonal(points), true);
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]!;
    const b = points[i]!;
    assert.equal(a.x === b.x && a.y === b.y, false);
  }
  const simplified = simplifyManualRoute(points);
  assert.deepEqual(simplified, points);
}

const domain = src("./manualRouteEdit.ts");
const hook = src("../../../components/v2/relatedDiagram/useConnectionRouteInteraction.ts");
const demo = src("../../../components/v2/relatedDiagram/RelatedDiagramRouteEditingDemoWorkspace.tsx");
const patientA = src("../../../components/v2/relatedDiagram/RelatedDiagramPatientADevWorkspace.tsx");
const fixture = src("../../../components/v2/relatedDiagram/RelatedDiagramDevFixtureWorkspace.tsx");

test("MB-A Student V1 2-point straight does not split", () => {
  const next = dragOrthogonalSegment({
    points: LONG_H,
    segmentIndex: 0,
    deltaX: 40,
    deltaY: 80,
    grab: pt(400, 200),
  });
  assert.deepEqual(next, LONG_H);
  assert.equal(routeIsOrthogonal(next), true);
});

test("MB-B Student V1 2-point vertical does not split", () => {
  const next = dragOrthogonalSegment({
    points: LONG_V,
    segmentIndex: 0,
    deltaX: 70,
    deltaY: 30,
    grab: pt(400, 390),
  });
  assert.deepEqual(next, LONG_V);
});

test("MB-C 2-point horizontal drag is no-op", () => {
  const next = dragOrthogonalSegment({
    points: LONG_H,
    segmentIndex: 0,
    deltaX: 90,
    deltaY: 64,
    grab: pt(400, 200),
  });
  assert.deepEqual(next, LONG_H);
});

test("MB-D 2-point vertical drag is no-op", () => {
  const next = dragOrthogonalSegment({
    points: LONG_V,
    segmentIndex: 0,
    deltaX: 40,
    deltaY: 80,
    grab: pt(400, 390),
  });
  assert.deepEqual(next, LONG_V);
});

test("MB-E 2-point grab position does not create a span", () => {
  const left = dragOrthogonalSegment({
    points: LONG_H,
    segmentIndex: 0,
    deltaX: 0,
    deltaY: 60,
    grab: pt(250, 200),
  });
  const right = dragOrthogonalSegment({
    points: LONG_H,
    segmentIndex: 0,
    deltaX: 0,
    deltaY: 60,
    grab: pt(520, 200),
  });
  assert.deepEqual(left, LONG_H);
  assert.deepEqual(right, LONG_H);
});

test("MB-F/G/H 2-point stays orthogonal no-op", () => {
  const next = dragOrthogonalSegment({
    points: LONG_H,
    segmentIndex: 0,
    deltaX: 0,
    deltaY: 50,
    grab: pt(400, 200),
  });
  assert.deepEqual(next, LONG_H);
  assert.equal(routeIsOrthogonal(next), true);
});

test("MB-I near-endpoint 2-point is no-op", () => {
  const next = dragOrthogonalSegment({
    points: LONG_H,
    segmentIndex: 0,
    deltaX: 0,
    deltaY: 50,
    grab: pt(LONG_H[0]!.x + ENDPOINT_EXCLUSION_PX - 4, 200),
  });
  assert.deepEqual(next, LONG_H);
  assert.equal(routeIsOrthogonal(next), true);
});

test("MB-J short segment is orthogonal or no-op", () => {
  const next = dragOrthogonalSegment({
    points: SHORT_H,
    segmentIndex: 0,
    deltaX: 0,
    deltaY: 40,
    grab: pt(130, 200),
  });
  assert.deepEqual(next[0], SHORT_H[0]);
  assert.deepEqual(next[next.length - 1], SHORT_H[1]);
  assert.equal(routeIsOrthogonal(next), true);
});

test("MB-K/L/M/N 2-point orthogonal no-op", () => {
  const next = dragOrthogonalSegment({
    points: LONG_H,
    segmentIndex: 0,
    deltaX: 0,
    deltaY: 70,
    grab: pt(400, 200),
  });
  assert.deepEqual(next, LONG_H);
  assertClean(next);
});

test("MB-O existing bent keeps point count", () => {
  const next = dragOrthogonalSegment({
    points: BENT,
    segmentIndex: 1,
    deltaX: 20,
    deltaY: 0,
    grab: pt(360, 140),
  });
  assert.ok(next.length <= BENT.length);
  assert.ok(routeIsOrthogonal(next));
});

test("MB-P 2-point does not generate a re-draggable horizontal", () => {
  const split = dragOrthogonalSegment({
    points: LONG_H,
    segmentIndex: 0,
    deltaX: 0,
    deltaY: 80,
    grab: pt(400, 200),
  });
  assert.deepEqual(split, LONG_H);
});

test("MB-Q 2-point does not generate a vertical connector", () => {
  const split = dragOrthogonalSegment({
    points: LONG_H,
    segmentIndex: 0,
    deltaX: 0,
    deltaY: 80,
    grab: pt(400, 200),
  });
  assert.deepEqual(split, LONG_H);
});

test("MB-R/S 2-point no-op still can upsert if caller commits same points", () => {
  const committed = commitManualRouteEdit({
    connection,
    routeState: routeStateOf(LONG_H),
    topology: emptyRouteTopology(),
    points: dragOrthogonalSegment({
      points: LONG_H,
      segmentIndex: 0,
      deltaX: 0,
      deltaY: 60,
      grab: pt(400, 200),
    }),
  });
  assert.equal(committed.topology.routes[0]?.connectionId, "cn_ab");
  assert.equal(committed.topology.routes[0]!.points.length, 2);
});

test("MB-T/U/V pointermove writes 0", () => {
  const move = hook.slice(hook.indexOf("const onMove"), hook.indexOf("const onUp"));
  assert.equal(move.includes("onTopologyChange"), false);
  assert.equal(move.includes("onHistoryPush"), false);
  assert.equal(move.includes("cloneStableRouteState"), false);
  assert.equal(move.includes("commitManualRouteEdit"), false);
});

test("MB-W pointerup commit 1", () => {
  assert.ok(hook.includes("commitManualRouteEdit"));
  assert.ok(hook.includes('type: "editRoute"'));
  assert.ok(hook.includes("routeEditPreview"));
});

test("MB-X/Y Undo Redo exact", () => {
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

test("MB-Z/AA cancel and second pointer", () => {
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
  assert.equal(state.phase, "pressing");
  assert.equal(state.segment, null);
  const cancelled = applyConnectionRouteSecondPointer(state);
  const up = applyConnectionRoutePointerUp(cancelled, 1, 1);
  assert.equal(up.commit, null);
});

test("MB-AB/AC semantic and non-target exact", () => {
  const other = [pt(100, 400), pt(400, 400)];
  const routeState: StableRouteState = {
    byId: {
      ...routeStateOf(LONG_H).byId,
      cn_cd: {
        connectionId: "cn_cd",
        sourceCardId: "c",
        targetCardId: "d",
        sourceEdge: "right",
        targetEdge: "left",
        sourcePin: other[0]!,
        targetPin: other[1]!,
        points: other,
      },
    },
    lastValidPoints: { cn_ab: LONG_H, cn_cd: other },
    invalidReasons: {},
    bridges: [],
  };
  const committed = commitManualRouteEdit({
    connection,
    routeState,
    topology: emptyRouteTopology(),
    points: dragOrthogonalSegment({
      points: LONG_H,
      segmentIndex: 0,
      deltaX: 0,
      deltaY: 50,
      grab: pt(400, 200),
    }),
  });
  assert.ok(pointsDeepEqual(committed.routeState.byId.cn_cd!.points, other));
  assert.equal(connection.sourceCardId, "a");
  assert.equal(connection.targetCardId, "b");
});

test("MB-AD card-through is not auto-fixed", () => {
  assert.equal(domain.includes("countPolylineCardHits"), true);
  const next = dragOrthogonalSegment({
    points: LONG_H,
    segmentIndex: 0,
    deltaX: 0,
    deltaY: 36,
    grab: pt(400, 200),
  });
  assert.deepEqual(next, LONG_H);
});

test("MB-AE Junction edit不可", () => {
  assert.equal(
    canEditConnectionRoute(
      {
        ...emptyRouteTopology(),
        branchPoints: [{ id: "bp", x: 1, y: 1, connectionIds: ["cn_j"] }],
      },
      { id: "cn_j", origin: "student_diagram" },
    ),
    false,
  );
});

test("MB-AF/AG authored body preserve helpers stay", () => {
  assert.ok(domain.includes("repairManualRouteEndpoints"));
  const mre = src("./manualRouteEdit.test.ts");
  assert.ok(mre.includes("MRE-I"));
  assert.ok(mre.includes("MRE-J"));
});

test("MB-AH/AI planner and D0-D3 0 in drag", () => {
  const dragChunk = domain.slice(
    domain.indexOf("export function dragOrthogonalSegment"),
    domain.indexOf("export function upsertManualRoute"),
  );
  for (const name of [
    "selectBestOrthogonalRoute",
    "generateOrthogonalCandidates",
    "findRectilinearPath",
    "evaluateArrangeScene",
    "layoutRelatedDiagramD0",
    "layoutRelatedDiagramD3",
    "seedStableRouteState",
    "applyIncrementalCardMove",
  ]) {
    assert.equal(dragChunk.includes(name), false, name);
  }
});

test("MB-AJ deterministic", () => {
  const a = dragOrthogonalSegment({
    points: LONG_H,
    segmentIndex: 0,
    deltaX: 0,
    deltaY: 55,
    grab: pt(400, 200),
  });
  const b = dragOrthogonalSegment({
    points: LONG_H,
    segmentIndex: 0,
    deltaX: 0,
    deltaY: 55,
    grab: pt(400, 200),
  });
  assert.deepEqual(a, b);
});

test("MB-AK 2-point remains straight", () => {
  const split = dragOrthogonalSegment({
    points: LONG_H,
    segmentIndex: 0,
    deltaX: 0,
    deltaY: 80,
    grab: pt(400, 200),
  });
  assert.deepEqual(split, LONG_H);
});

test("MB-AL/AM student UI has no Route Trace / 自動に戻す", () => {
  for (const file of [demo, patientA, fixture]) {
    assert.equal(file.includes("onBeginRouteTrace"), false);
    assert.equal(file.includes("ルートを描く"), false);
    assert.equal(file.includes("onResetAuto"), false);
    assert.equal(file.includes("自動に戻す"), false);
  }
});

console.log(`\n${passed} passed`);
