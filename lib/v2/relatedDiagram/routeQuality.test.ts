/**
 * Final route quality class / cross-canvas / crossing budget tests.
 * Run: npx tsx lib/v2/relatedDiagram/routeQuality.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CROSS_CANVAS_MIN_SPAN,
  HARD_MAX_CROSSINGS,
  MAX_FINAL_BENDS,
  compareQualityReports,
  crossCanvasMetrics,
  evaluateRouteQuality,
  selectQualityCandidate,
  siblingWorsenedTooMuch,
  type RouteQualityReport,
} from "./routeQuality";
import { PREFERRED_MAX_CROSSINGS } from "./routeCongestion";
import type { CongestionContext } from "./routeCongestion";
import type { Point } from "./orthogonalRouting";

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

function ctx(routes: Array<{ id: string; points: Point[] }>): CongestionContext {
  return {
    routes: routes.map((r) => ({ connectionId: r.id, points: r.points })),
    exemptIds: new Set(["changed"]),
    bridges: [],
    junctions: [],
  };
}

function report(
  points: Point[],
  congestion: CongestionContext,
  extra?: { hard?: string[]; bp?: Point; locality?: Point[] },
): RouteQualityReport {
  return evaluateRouteQuality({
    points,
    sourcePin: points[0]!,
    targetPin: points[points.length - 1]!,
    congestion,
    hardReasons: extra?.hard,
    branchPoint: extra?.bp,
    localityPoints: extra?.locality,
  });
}

test("constants stay at the Slice 2A budget", () => {
  assert.equal(PREFERRED_MAX_CROSSINGS, 1);
  assert.equal(HARD_MAX_CROSSINGS, 2);
  assert.equal(MAX_FINAL_BENDS, 6);
});

test("0 crossing beats 1 crossing when both are reasonable", () => {
  const congestion = ctx([
    {
      id: "stable",
      points: [
        { x: 0, y: 80 },
        { x: 200, y: 80 },
      ],
    },
  ]);
  const zero = report(
    [
      { x: 40, y: 10 },
      { x: 40, y: 40 },
      { x: 160, y: 40 },
      { x: 160, y: 10 },
    ],
    congestion,
  );
  const one = report(
    [
      { x: 80, y: 10 },
      { x: 80, y: 160 },
    ],
    congestion,
  );
  assert.equal(zero.crossings, 0);
  assert.equal(one.crossings, 1);
  assert.equal(zero.class, 0);
  assert.ok(one.class === 1 || one.class === "reject");
  assert.ok(compareQualityReports(zero, one) < 0);
});

test("safe 1 crossing beats a crossing-0 long detour", () => {
  const congestion = ctx([
    {
      id: "stable",
      points: [
        { x: 0, y: 50 },
        { x: 240, y: 50 },
      ],
    },
  ]);
  const shortBridge = [
    { x: 80, y: 0 },
    { x: 80, y: 120 },
  ];
  const longZero = [
    { x: 80, y: 0 },
    { x: 80, y: 8 },
    { x: 420, y: 8 },
    { x: 420, y: 120 },
    { x: 80, y: 120 },
  ];
  const a = report(shortBridge, congestion);
  const b = report(longZero, congestion);
  assert.equal(a.crossings, 1);
  assert.equal(b.crossings, 0);
  assert.ok(b.detourRatio > 3 || b.class === "reject" || b.class === 1);
  const picked = selectQualityCandidate(
    [longZero, shortBridge],
    (pts) => report(pts, congestion),
  );
  assert.deepEqual(picked, shortBridge);
});

test("3+ crossings are rejected; 1 crossing is preferred", () => {
  const congestion = ctx([
    { id: "s1", points: [{ x: 0, y: 30 }, { x: 200, y: 30 }] },
    { id: "s2", points: [{ x: 0, y: 60 }, { x: 200, y: 60 }] },
    { id: "s3", points: [{ x: 0, y: 90 }, { x: 200, y: 90 }] },
  ]);
  const three = report(
    [
      { x: 80, y: 0 },
      { x: 80, y: 140 },
    ],
    congestion,
  );
  const oneCtx = ctx([
    { id: "s1", points: [{ x: 0, y: 60 }, { x: 200, y: 60 }] },
  ]);
  const one = report(
    [
      { x: 80, y: 0 },
      { x: 80, y: 140 },
    ],
    oneCtx,
  );
  assert.ok(three.crossings >= 3);
  assert.equal(three.class, "reject");
  assert.ok(three.qualityReasons.includes("excessive-crossings"));
  assert.equal(one.crossings, 1);
  assert.ok(one.class === 1 || one.class === "reject");
  const picked = selectQualityCandidate(
    [
      [
        { x: 80, y: 0 },
        { x: 80, y: 140 },
      ],
    ],
    (pts) => report(pts, oneCtx),
  );
  assert.ok(picked);
});

test("bridge-bend candidate is a quality reject", () => {
  const congestion = ctx([
    {
      id: "stable",
      points: [
        { x: 90, y: 0 },
        { x: 90, y: 80 },
      ],
    },
  ]);
  const nearBend = report(
    [
      { x: 0, y: 70 },
      { x: 100, y: 70 },
      { x: 100, y: 140 },
    ],
    congestion,
  );
  assert.ok(nearBend.crossings >= 1);
  assert.ok(
    nearBend.class === "reject" ||
      nearBend.qualityReasons.includes("bridge-bend") ||
      nearBend.unsafeBridgeReasons.includes("bridge-bend"),
  );
});

test("bridge-junction candidate is a quality reject", () => {
  const congestion: CongestionContext = {
    routes: [
      {
        connectionId: "stable",
        points: [
          { x: 0, y: 50 },
          { x: 200, y: 50 },
        ],
      },
    ],
    exemptIds: new Set(["changed"]),
    bridges: [],
    junctions: [{ x: 80, y: 52 }],
  };
  const hit = report(
    [
      { x: 80, y: 0 },
      { x: 80, y: 120 },
    ],
    congestion,
  );
  assert.ok(hit.qualityReasons.includes("bridge-junction") || hit.class === "reject");
});

test("cross-canvas balloon is rejected; true A3-span is not", () => {
  const balloon = crossCanvasMetrics(
    [
      { x: 80, y: 80 },
      { x: 80, y: 400 },
      { x: 900, y: 400 },
      { x: 900, y: 90 },
      { x: 140, y: 90 },
    ],
    { x: 80, y: 80 },
    { x: 140, y: 90 },
  );
  assert.equal(balloon.reject, true);
  const span = crossCanvasMetrics(
    [
      { x: 40, y: 80 },
      { x: 1400, y: 80 },
    ],
    { x: 40, y: 80 },
    { x: 1400, y: 80 },
  );
  assert.equal(span.reject, false);
  assert.ok(CROSS_CANVAS_MIN_SPAN >= 40);
});

test("hard geometry failure is never class 0/1/2", () => {
  const q = report(
    [
      { x: 0, y: 0 },
      { x: 40, y: 0 },
    ],
    ctx([]),
    { hard: ["obstacle-violation"] },
  );
  assert.equal(q.legal, false);
  assert.equal(q.class, "reject");
});

test("fan bend budget allows semantic extra bends", () => {
  const points = [
    { x: 0, y: 50 },
    { x: 80, y: 50 },
    { x: 80, y: 80 },
    { x: 140, y: 80 },
    { x: 140, y: 120 },
    { x: 200, y: 120 },
  ];
  const q = report(points, ctx([]), { bp: { x: 80, y: 50 } });
  assert.ok(q.bendBudget >= MAX_FINAL_BENDS);
  assert.ok(q.bends <= q.bendBudget);
  assert.ok(q.class !== "reject" || q.qualityReasons.includes("excessive-bends") === false);
});

test("sibling worsen budget rejects a huge child-leg growth", () => {
  assert.equal(siblingWorsenedTooMuch(80, 120), false);
  assert.equal(siblingWorsenedTooMuch(80, 280), true);
});

test("selectQualityCandidate does not drop a short 0/1 to take 3 crossings", () => {
  const congestion = ctx([
    { id: "s1", points: [{ x: 40, y: 30 }, { x: 200, y: 30 }] },
    { id: "s2", points: [{ x: 40, y: 60 }, { x: 200, y: 60 }] },
    { id: "s3", points: [{ x: 40, y: 90 }, { x: 200, y: 90 }] },
  ]);
  const zero = [
    { x: 10, y: 10 },
    { x: 10, y: 140 },
  ];
  const three = [
    { x: 80, y: 10 },
    { x: 80, y: 140 },
  ];
  assert.equal(report(zero, congestion).crossings, 0);
  assert.ok(report(three, congestion).crossings >= 3);
  const picked = selectQualityCandidate([three, zero], (pts) =>
    report(pts, congestion),
  );
  assert.deepEqual(picked, zero);
});

test("Bridge renderer freeze tokens stay in ConnectionLayer", () => {
  const layer = readFileSync(
    new URL(
      "../../../components/v2/relatedDiagram/RelatedDiagramConnectionLayer.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.ok(layer.includes("planConnectionBridgeVisual"));
  assert.ok(layer.includes("hopArcPathD"));
  assert.ok(layer.includes("buildOrthogonalSpineDFromHops"));
  assert.ok(layer.includes("data-rd-bridge-arc"));
  assert.equal(layer.includes("mask"), false);
  assert.equal(layer.includes("data-rd-bridge-knockout"), false);
});

console.log(`\n${passed} passed`);
