/**
 * Parallel Move pointerup must refresh scene bridges.
 * Run: ./node_modules/.bin/jiti lib/v2/relatedDiagram/manualRouteBridge.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  emptyDiagramHistory,
  pushDiagramHistory,
  redoDiagramHistory,
  undoDiagramHistory,
} from "./diagramHistory";
import {
  bridgesDeepEqual,
  cloneStableRouteState,
  pointsDeepEqual,
  type StableRouteState,
} from "./incrementalRoutes";
import {
  commitManualRouteEdit,
  dragOrthogonalSegment,
  isStudentManualRoute,
} from "./manualRouteEdit";
import { classifyRouteInteractions } from "./orthogonalRouting";
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

const OPEN = [
  { x: 80, y: 80 },
  { x: 200, y: 80 },
  { x: 200, y: 160 },
  { x: 400, y: 160 },
  { x: 400, y: 80 },
];
const CROSSED = [
  { x: 80, y: 80 },
  { x: 200, y: 80 },
  { x: 200, y: 240 },
  { x: 400, y: 240 },
  { x: 400, y: 80 },
];
const OTHER = [
  { x: 40, y: 200 },
  { x: 480, y: 200 },
];

const connection: RelatedDiagramConnection = {
  id: "cn_ab",
  sourceCardId: "a",
  targetCardId: "b",
  relationType: "current",
  origin: "student_diagram",
  createdAt: "2026-09-23T00:00:00.000Z",
  updatedAt: "2026-09-23T00:00:00.000Z",
};

function stored(
  id: string,
  sourceCardId: string,
  targetCardId: string,
  points: { x: number; y: number }[],
) {
  return {
    connectionId: id,
    sourceCardId,
    targetCardId,
    sourceEdge: "right" as const,
    targetEdge: "left" as const,
    sourcePin: { ...points[0]! },
    targetPin: { ...points[points.length - 1]! },
    points: points.map((point) => ({ ...point })),
  };
}

function twoRouteState(
  ab: { x: number; y: number }[],
  bridges: StableRouteState["bridges"] = [],
): StableRouteState {
  return {
    byId: {
      cn_ab: stored("cn_ab", "a", "b", ab),
      cn_cd: stored("cn_cd", "c", "d", OTHER),
    },
    lastValidPoints: {
      cn_ab: ab.map((point) => ({ ...point })),
      cn_cd: OTHER.map((point) => ({ ...point })),
    },
    invalidReasons: {},
    bridges: bridges.map((bridge) => ({ ...bridge })),
    qualityTrace: {},
  };
}

function expectedBridges(ab: { x: number; y: number }[]) {
  const state = twoRouteState(ab);
  return classifyRouteInteractions(
    Object.values(state.byId).map((row) => ({
      connectionId: row.connectionId,
      sourceCardId: row.sourceCardId,
      targetCardId: row.targetCardId,
      sourceEdge: row.sourceEdge,
      targetEdge: row.targetEdge,
      points: row.points,
    })),
  ).bridges;
}

test("A Parallel Move creates crossing → pointerup bridge", () => {
  const before = twoRouteState(OPEN);
  assert.equal(expectedBridges(OPEN).length, 0);
  const moved = dragOrthogonalSegment({
    points: OPEN,
    segmentIndex: 2,
    deltaX: 0,
    deltaY: 80,
  });
  const committed = commitManualRouteEdit({
    connection,
    routeState: before,
    topology: emptyRouteTopology(),
    points: moved,
  });
  const bridges = committed.routeState.bridges;
  assert.ok(bridges.length >= 1);
  assert.equal(
    bridges.some(
      (row) =>
        (row.jumperConnectionId === "cn_ab" &&
          row.underConnectionId === "cn_cd") ||
        (row.jumperConnectionId === "cn_cd" &&
          row.underConnectionId === "cn_ab"),
    ),
    true,
  );
  assert.ok(bridgesDeepEqual(bridges, expectedBridges(moved)));
});

test("B Parallel Move removes crossing → pointerup no bridge", () => {
  const stale = expectedBridges(CROSSED);
  assert.ok(stale.length >= 1);
  const before = twoRouteState(CROSSED, stale);
  const moved = dragOrthogonalSegment({
    points: CROSSED,
    segmentIndex: 2,
    deltaX: 0,
    deltaY: -80,
  });
  const committed = commitManualRouteEdit({
    connection,
    routeState: before,
    topology: emptyRouteTopology(),
    points: moved,
  });
  assert.equal(committed.routeState.bridges.length, 0);
});

test("C crossing position follows Parallel Move", () => {
  const before = twoRouteState(CROSSED, expectedBridges(CROSSED));
  const old = before.bridges[0]!;
  const moved = dragOrthogonalSegment({
    points: CROSSED,
    segmentIndex: 1,
    deltaX: 40,
    deltaY: 0,
  });
  const committed = commitManualRouteEdit({
    connection,
    routeState: before,
    topology: emptyRouteTopology(),
    points: moved,
  });
  assert.ok(committed.routeState.bridges.length >= 1);
  const next = committed.routeState.bridges[0]!;
  assert.equal(next.x === old.x && next.y === old.y, false);
  assert.ok(bridgesDeepEqual(committed.routeState.bridges, expectedBridges(moved)));
});

test("D/E/F points edges pins unchanged except Parallel Move", () => {
  const before = twoRouteState(OPEN);
  const moved = dragOrthogonalSegment({
    points: OPEN,
    segmentIndex: 2,
    deltaX: 0,
    deltaY: 80,
  });
  const committed = commitManualRouteEdit({
    connection,
    routeState: before,
    topology: emptyRouteTopology(),
    points: moved,
  });
  const stored = committed.routeState.byId.cn_ab!;
  assert.ok(pointsDeepEqual(stored.points, moved));
  assert.equal(stored.sourceEdge, "right");
  assert.equal(stored.targetEdge, "left");
  assert.deepEqual(stored.sourcePin, OPEN[0]);
  assert.deepEqual(stored.targetPin, OPEN[OPEN.length - 1]);
  assert.ok(
    pointsDeepEqual(committed.routeState.byId.cn_cd!.points, OTHER),
  );
});

test("G MANUAL maintained", () => {
  const committed = commitManualRouteEdit({
    connection,
    routeState: twoRouteState(OPEN),
    topology: emptyRouteTopology(),
    points: dragOrthogonalSegment({
      points: OPEN,
      segmentIndex: 2,
      deltaX: 0,
      deltaY: 80,
    }),
  });
  assert.equal(isStudentManualRoute(committed.topology, connection), true);
});

test("H/I Undo Redo restores points + bridges", () => {
  const beforeState = twoRouteState(OPEN);
  const moved = dragOrthogonalSegment({
    points: OPEN,
    segmentIndex: 2,
    deltaX: 0,
    deltaY: 80,
  });
  const after = commitManualRouteEdit({
    connection,
    routeState: beforeState,
    topology: emptyRouteTopology(),
    points: moved,
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
    pointsDeepEqual(undo.command.fragment.routeState.byId.cn_ab!.points, OPEN),
  );
  assert.ok(bridgesDeepEqual(undo.command.fragment.routeState.bridges, []));
  const redo = redoDiagramHistory(undo.history);
  assert.equal(redo.command.kind, "applyFragment");
  if (redo.command.kind !== "applyFragment") return;
  assert.ok(
    pointsDeepEqual(redo.command.fragment.routeState.byId.cn_ab!.points, moved),
  );
  assert.ok(
    bridgesDeepEqual(
      redo.command.fragment.routeState.bridges,
      after.routeState.bridges,
    ),
  );
});

test("J planner / pathfinder 0", () => {
  const domain = src("./manualRouteEdit.ts");
  const chunk = domain.slice(
    domain.indexOf("export function refreshStableRouteBridges"),
    domain.indexOf("export function repairManualRouteEndpoints"),
  );
  for (const name of [
    "decideStudentConnectionRoute",
    "selectBestOrthogonalRoute",
    "findRectilinearPath",
    "planOrthogonalRoutes",
    "applyLightweightCardDrop",
    "applyStudentAutoQualityReroute",
  ]) {
    assert.equal(chunk.includes(name), false, name);
  }
  assert.ok(chunk.includes("classifyRouteInteractions"));
  assert.ok(
    src("../../../components/v2/relatedDiagram/useConnectionRouteInteraction.ts").includes(
      "cards: liveRef.current.graph.cards",
    ),
  );
});

console.log(`\n${passed} passed`);
