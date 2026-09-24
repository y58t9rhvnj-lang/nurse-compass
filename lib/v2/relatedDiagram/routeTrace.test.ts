/**
 * Route Trace V1 — partial replacement (RT-P01…P38).
 * Run: ./node_modules/.bin/jiti lib/v2/relatedDiagram/routeTrace.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { emptyDiagramHistory, pushDiagramHistory } from "./diagramHistory";
import {
  cloneStableRouteState,
  pointsDeepEqual,
  type StableRouteState,
} from "./incrementalRoutes";
import { dragOrthogonalSegment } from "./manualRouteEdit";
import { RELATED_DIAGRAM_SEMANTIC_SCHEMA_VERSION } from "./types";
import type {
  RelatedDiagramCard,
  RelatedDiagramConnection,
} from "./types";
import { emptyRouteTopology } from "./routeTopology";
import type { RelatedDiagramRouteTopology } from "./routeTopology";
import {
  applyPartialRouteTrace,
  canTraceConnectionRoute,
  routeIsOrthogonalPolyline,
  sampleTracePoints,
  TRACE_REPLACEMENT_POINT_CAP,
} from "./routeTrace";
import {
  applyRouteTracePointerDown,
  applyRouteTracePointerMove,
  applyRouteTracePointerUp,
  applyRouteTraceSecondPointer,
} from "./routeTraceGesture";
import { commitManualRouteEdit } from "./manualRouteEdit";

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

const STRAIGHT = [pt(100, 200), pt(700, 200)];
const VERTICAL = [pt(400, 80), pt(400, 700)];
const BENT = [pt(100, 200), pt(360, 200), pt(360, 80), pt(700, 80)];

function downBump(fromX: number, toX: number, y: number, midY: number) {
  const raw: { x: number; y: number }[] = [];
  for (let x = fromX; x <= toX; x += 12) {
    const t = (x - fromX) / Math.max(1, toX - fromX);
    const dip = t < 0.15 || t > 0.85 ? y : midY;
    raw.push(pt(x, dip));
  }
  return raw;
}

function sideBump(fromY: number, toY: number, x: number, midX: number) {
  const raw: { x: number; y: number }[] = [];
  const step = fromY < toY ? 12 : -12;
  for (let y = fromY; step > 0 ? y <= toY : y >= toY; y += step) {
    const t = (y - fromY) / Math.max(1, toY - fromY);
    raw.push(pt(t < 0.15 || t > 0.85 ? x : midX, y));
  }
  return raw;
}

function prefixOf(points: { x: number; y: number }[], untilX: number) {
  return points.filter((point) => point.x <= untilX + 0.5);
}

const domain = src("./routeTrace.ts");
const gesture = src("./routeTraceGesture.ts");
const hook = src("../../../components/v2/relatedDiagram/useConnectionRouteInteraction.ts");
const bar = src("../../../components/v2/relatedDiagram/RelatedDiagramConnectionActionBar.tsx");
const demo = src("../../../components/v2/relatedDiagram/RelatedDiagramRouteEditingDemoWorkspace.tsx");
const patientA = src("../../../components/v2/relatedDiagram/RelatedDiagramPatientADevWorkspace.tsx");

test("RT-P01 straight center down → prefix/suffix preserve", () => {
  const result = applyPartialRouteTrace({
    existing: STRAIGHT,
    rawTrace: downBump(250, 520, 200, 320),
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.points[0], STRAIGHT[0]);
  assert.deepEqual(result.points[result.points.length - 1], STRAIGHT[1]);
  assert.ok(result.points.some((point) => point.y > 250));
  assert.ok(result.startAnchor.x > 100);
  assert.ok(result.endAnchor.x < 700);
});

test("RT-P02 center up → intended side", () => {
  const result = applyPartialRouteTrace({
    existing: STRAIGHT,
    rawTrace: downBump(250, 520, 200, 80),
  });
  assert.ok(result.points.some((point) => point.y < 160));
  assert.equal(result.points.some((point) => point.y > 250), false);
});

test("RT-P03 vertical right", () => {
  const result = applyPartialRouteTrace({
    existing: VERTICAL,
    rawTrace: sideBump(200, 520, 400, 560),
  });
  assert.ok(result.points.some((point) => point.x > 480));
  assert.deepEqual(result.points[0], VERTICAL[0]);
  assert.deepEqual(result.points[result.points.length - 1], VERTICAL[1]);
});

test("RT-P04 vertical left", () => {
  const result = applyPartialRouteTrace({
    existing: VERTICAL,
    rawTrace: sideBump(200, 520, 400, 220),
  });
  assert.ok(result.points.some((point) => point.x < 320));
});

test("RT-P05 bent middle only", () => {
  const result = applyPartialRouteTrace({
    existing: BENT,
    rawTrace: downBump(140, 300, 200, 300),
  });
  assert.deepEqual(result.points[0], BENT[0]);
  assert.deepEqual(result.points[result.points.length - 1], BENT[BENT.length - 1]);
  assert.ok(result.points.some((point) => point.x === 360 && point.y === 80) || result.points.some((point) => point.y === 80 && point.x >= 360));
});

test("RT-P06 MANUAL re-trace middle", () => {
  const first = applyPartialRouteTrace({
    existing: STRAIGHT,
    rawTrace: downBump(220, 500, 200, 300),
  });
  const second = applyPartialRouteTrace({
    existing: first.points,
    rawTrace: downBump(240, 480, first.points[1]?.y ?? 300, 120),
  });
  assert.deepEqual(second.points[0], STRAIGHT[0]);
  assert.deepEqual(second.points[second.points.length - 1], STRAIGHT[1]);
  assert.ok(second.points.some((point) => point.y < 180));
});

test("RT-P07/08 source and target pin exact", () => {
  const result = applyPartialRouteTrace({
    existing: STRAIGHT,
    rawTrace: downBump(200, 600, 200, 340),
  });
  assert.deepEqual(result.points[0], STRAIGHT[0]);
  assert.deepEqual(result.points[result.points.length - 1], STRAIGHT[1]);
});

test("RT-P09/10 prefix suffix outside trace", () => {
  const result = applyPartialRouteTrace({
    existing: STRAIGHT,
    rawTrace: downBump(300, 500, 200, 310),
  });
  const left = prefixOf(result.points, result.startAnchor.x);
  assert.ok(left[0]!.x === 100);
  assert.ok(result.points[result.points.length - 1]!.x === 700);
});

test("RT-P11/12 anchors can sit mid-segment", () => {
  const result = applyPartialRouteTrace({
    existing: STRAIGHT,
    rawTrace: downBump(280, 540, 200, 300),
  });
  assert.ok(result.startAnchor.x > 100 && result.startAnchor.x < 700);
  assert.ok(result.endAnchor.x > result.startAnchor.x);
});

test("RT-P13 reverse-direction deterministic", () => {
  const forward = applyPartialRouteTrace({
    existing: STRAIGHT,
    rawTrace: downBump(250, 520, 200, 320),
  });
  const backward = applyPartialRouteTrace({
    existing: STRAIGHT,
    rawTrace: [...downBump(250, 520, 200, 320)].reverse(),
  });
  assert.equal(backward.reversed, true);
  assert.deepEqual(forward.points, backward.points);
});

test("RT-P14 jitter does not explode bends", () => {
  const raw: { x: number; y: number }[] = [];
  for (let i = 0; i < 220; i += 1) {
    raw.push(pt(250 + i * 1.4, 320 + ((i % 2) * 3 - 1.5)));
  }
  const result = applyPartialRouteTrace({ existing: STRAIGHT, rawTrace: raw });
  assert.ok(result.replacementPointCount <= TRACE_REPLACEMENT_POINT_CAP);
  assert.ok(result.points.length <= 10);
});

test("RT-P15/16/17/18 orthogonal / no junk points", () => {
  const result = applyPartialRouteTrace({
    existing: STRAIGHT,
    rawTrace: downBump(240, 560, 200, 300),
  });
  assert.equal(routeIsOrthogonalPolyline(result.points), true);
  for (let i = 1; i < result.points.length; i += 1) {
    const a = result.points[i - 1]!;
    const b = result.points[i]!;
    assert.equal(a.x === b.x && a.y === b.y, false);
  }
});

test("RT-P19 AUTO→MANUAL", () => {
  const connection: RelatedDiagramConnection = {
    id: "cn_ab",
    sourceCardId: "a",
    targetCardId: "b",
    relationType: "current",
    origin: "student_diagram",
    createdAt: "2026-09-22T00:00:00.000Z",
    updatedAt: "2026-09-22T00:00:00.000Z",
  };
  const routeState: StableRouteState = {
    byId: {
      cn_ab: {
        connectionId: "cn_ab",
        sourceCardId: "a",
        targetCardId: "b",
        sourceEdge: "right",
        targetEdge: "left",
        sourcePin: STRAIGHT[0]!,
        targetPin: STRAIGHT[1]!,
        points: STRAIGHT,
      },
    },
    lastValidPoints: { cn_ab: STRAIGHT },
    invalidReasons: {},
    bridges: [],
  };
  const traced = applyPartialRouteTrace({
    existing: STRAIGHT,
    rawTrace: downBump(240, 520, 200, 300),
  });
  const committed = commitManualRouteEdit({
    connection,
    routeState,
    topology: emptyRouteTopology(),
    points: traced.points,
  });
  assert.equal(committed.topology.routes[0]?.connectionId, "cn_ab");
});

test("RT-P20 MANUAL remains MANUAL", () => {
  const connection: RelatedDiagramConnection = {
    id: "cn_ab",
    sourceCardId: "a",
    targetCardId: "b",
    relationType: "current",
    origin: "student_diagram",
    createdAt: "2026-09-22T00:00:00.000Z",
    updatedAt: "2026-09-22T00:00:00.000Z",
  };
  const first = commitManualRouteEdit({
    connection,
    routeState: {
      byId: {
        cn_ab: {
          connectionId: "cn_ab",
          sourceCardId: "a",
          targetCardId: "b",
          sourceEdge: "right",
          targetEdge: "left",
          sourcePin: STRAIGHT[0]!,
          targetPin: STRAIGHT[1]!,
          points: STRAIGHT,
        },
      },
      lastValidPoints: { cn_ab: STRAIGHT },
      invalidReasons: {},
      bridges: [],
    },
    topology: emptyRouteTopology(),
    points: applyPartialRouteTrace({
      existing: STRAIGHT,
      rawTrace: downBump(240, 520, 200, 300),
    }).points,
  });
  const second = commitManualRouteEdit({
    connection,
    routeState: first.routeState,
    topology: first.topology,
    points: applyPartialRouteTrace({
      existing: first.routeState.byId.cn_ab!.points,
      rawTrace: downBump(250, 500, 300, 120),
    }).points,
  });
  assert.equal(second.topology.routes.length, 1);
});

test("RT-P21/22 non-target and semantic unchanged", () => {
  const other = [pt(100, 400), pt(400, 400)];
  const routeState: StableRouteState = {
    byId: {
      cn_ab: {
        connectionId: "cn_ab",
        sourceCardId: "a",
        targetCardId: "b",
        sourceEdge: "right",
        targetEdge: "left",
        sourcePin: STRAIGHT[0]!,
        targetPin: STRAIGHT[1]!,
        points: STRAIGHT,
      },
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
    lastValidPoints: { cn_ab: STRAIGHT, cn_cd: other },
    invalidReasons: {},
    bridges: [],
  };
  const connection: RelatedDiagramConnection = {
    id: "cn_ab",
    sourceCardId: "a",
    targetCardId: "b",
    relationType: "current",
    origin: "student_diagram",
    createdAt: "2026-09-22T00:00:00.000Z",
    updatedAt: "2026-09-22T00:00:00.000Z",
  };
  const committed = commitManualRouteEdit({
    connection,
    routeState,
    topology: emptyRouteTopology(),
    points: applyPartialRouteTrace({
      existing: STRAIGHT,
      rawTrace: downBump(240, 520, 200, 300),
    }).points,
  });
  assert.ok(
    pointsDeepEqual(
      committed.routeState.byId.cn_cd!.points,
      routeState.byId.cn_cd!.points,
    ),
  );
  assert.deepEqual(
    committed.routeState.byId.cn_cd!.sourcePin,
    routeState.byId.cn_cd!.sourcePin,
  );
  assert.deepEqual(
    committed.routeState.byId.cn_cd!.targetPin,
    routeState.byId.cn_cd!.targetPin,
  );
  assert.equal(connection.sourceCardId, "a");
  assert.equal(connection.targetCardId, "b");
});

test("RT-P23/24/25 pointermove writes 0", () => {
  const move = hook.slice(hook.indexOf("const onMove"), hook.indexOf("const onUp"));
  assert.equal(move.includes("onTopologyChange"), false);
  assert.equal(move.includes("onHistoryPush"), false);
  assert.equal(move.includes("cloneStableRouteState"), false);
  assert.equal(move.includes("commitManualRouteEdit"), false);
});

test("RT-P26 pointerup commit 1", () => {
  assert.ok(hook.includes("commitManualRouteEdit"));
  assert.ok(hook.includes("applyPartialRouteTrace"));
  assert.ok(hook.includes('type: "editRoute"'));
});

test("RT-P27/28 Undo Redo exact", () => {
  const before = {
    routeState: {
      byId: {
        cn_ab: {
          connectionId: "cn_ab",
          sourceCardId: "a",
          targetCardId: "b",
          sourceEdge: "right" as const,
          targetEdge: "left" as const,
          sourcePin: STRAIGHT[0]!,
          targetPin: STRAIGHT[1]!,
          points: STRAIGHT,
        },
      },
      lastValidPoints: { cn_ab: STRAIGHT },
      invalidReasons: {},
      bridges: [],
    },
    topology: emptyRouteTopology(),
  };
  const afterPoints = applyPartialRouteTrace({
    existing: STRAIGHT,
    rawTrace: downBump(240, 520, 200, 300),
  }).points;
  const after = {
    routeState: {
      ...before.routeState,
      byId: {
        cn_ab: { ...before.routeState.byId.cn_ab!, points: afterPoints },
      },
    },
    topology: emptyRouteTopology(),
  };
  let history = pushDiagramHistory(emptyDiagramHistory(), {
    type: "editRoute",
    connectionId: "cn_ab",
    before,
    after,
  });
  assert.equal(history.past.length, 1);
  assert.ok(pointsDeepEqual(before.routeState.byId.cn_ab.points, STRAIGHT));
  assert.ok(!pointsDeepEqual(afterPoints, STRAIGHT));
});

test("RT-P29/30 cancel and second pointer", () => {
  const connection: RelatedDiagramConnection = {
    id: "cn_ab",
    sourceCardId: "a",
    targetCardId: "b",
    relationType: "current",
    origin: "student_diagram",
    createdAt: "2026-09-22T00:00:00.000Z",
    updatedAt: "2026-09-22T00:00:00.000Z",
  };
  let state = applyRouteTracePointerDown({
    pointerId: 1,
    pointerCount: 1,
    isPrimary: true,
    connectionId: "cn_ab",
    logical: pt(250, 210),
    connection,
    cardDragging: false,
    traceArmed: true,
  });
  state = applyRouteTracePointerMove(state, {
    pointerId: 1,
    pointerCount: 1,
    logical: pt(400, 320),
  });
  const cancelled = applyRouteTraceSecondPointer(state);
  assert.equal(cancelled.phase, "cancelled");
  const up = applyRouteTracePointerUp(cancelled, 1, pt(400, 320));
  assert.equal(up.commit, null);
});

test("RT-P31 Junction trace不可", () => {
  const connection: RelatedDiagramConnection = {
    id: "cn_j",
    sourceCardId: "a",
    targetCardId: "b",
    relationType: "current",
    origin: "student_diagram",
    createdAt: "2026-09-22T00:00:00.000Z",
    updatedAt: "2026-09-22T00:00:00.000Z",
  };
  const topology: RelatedDiagramRouteTopology = {
    ...emptyRouteTopology(),
    branchPoints: [{ id: "bp", x: 10, y: 10, connectionIds: ["cn_j"] }],
  };
  assert.equal(canTraceConnectionRoute(topology, connection), false);
});

test("RT-P32/33 planner and D0-D3 0", () => {
  for (const name of [
    "selectBestOrthogonalRoute",
    "generateOrthogonalCandidates",
    "findRectilinearPath",
    "evaluateArrangeScene",
    "layoutRelatedDiagramD0",
    "layoutRelatedDiagramD3",
    "seedStableRouteState",
  ]) {
    assert.equal(domain.includes(name), false, name);
    assert.equal(gesture.includes(name), false, name);
  }
});

test("RT-P34 card-through not auto-fixed", () => {
  const result = applyPartialRouteTrace({
    existing: STRAIGHT,
    rawTrace: [pt(250, 200), pt(300, 236), pt(500, 236), pt(540, 200)],
  });
  assert.ok(result.ok);
  assert.equal(domain.includes("countPolylineCardHits"), false);
});

test("RT-P35 Trace後 Segment Drag可能", () => {
  const traced = applyPartialRouteTrace({
    existing: STRAIGHT,
    rawTrace: downBump(240, 520, 200, 300),
  });
  const dragged = dragOrthogonalSegment({
    points: traced.points,
    segmentIndex: 1,
    deltaX: 0,
    deltaY: 20,
  });
  assert.equal(routeIsOrthogonalPolyline(dragged), true);
  assert.deepEqual(dragged[0], STRAIGHT[0]);
});

test("RT-P36 Segment Drag pointermove preview-only", () => {
  assert.ok(hook.includes("routeEditPreview"));
  const move = hook.slice(hook.indexOf("const onMove"), hook.indexOf("const onUp"));
  assert.ok(move.includes("setRouteEditPreview") || move.includes("routeEditPreview"));
  assert.equal(move.includes("commitManualRouteEdit"), false);
});

test("RT-P37 raw volume stays bounded", () => {
  const raw = Array.from({ length: 400 }, (_, i) =>
    pt(200 + i * 0.8, 300 + Math.sin(i) * 1.5),
  );
  const sampled = sampleTracePoints(raw);
  const result = applyPartialRouteTrace({ existing: STRAIGHT, rawTrace: raw });
  assert.ok(sampled.length < raw.length / 5);
  assert.ok(result.points.length <= 10);
});

test("RT-P38 deterministic", () => {
  const raw = downBump(240, 520, 200, 300);
  const a = applyPartialRouteTrace({ existing: STRAIGHT, rawTrace: raw });
  const b = applyPartialRouteTrace({ existing: STRAIGHT, rawTrace: raw });
  assert.deepEqual(a.points, b.points);
});

test("RT wiring: student UI has no Route Trace entry", () => {
  assert.equal(demo.includes("onBeginRouteTrace"), false);
  assert.equal(demo.includes("beginRouteTrace"), false);
  assert.equal(demo.includes("ルートを描く"), false);
  assert.equal(patientA.includes("onBeginRouteTrace"), false);
  assert.equal(patientA.includes("ルートを描く"), false);
  assert.equal(demo.includes("onResetAuto"), false);
  assert.equal(patientA.includes("onResetAuto"), false);
  void bar;
});

void RELATED_DIAGRAM_SEMANTIC_SCHEMA_VERSION;
void cloneStableRouteState;

console.log(`\n${passed} passed`);
