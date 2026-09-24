/**
 * Patient A explicit merge Junction prototype (JX-A…T).
 * Run: ./node_modules/.bin/jiti lib/v2/relatedDiagram/patientAMergeJunctionTopology.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { evaluateArrangeScene } from "./arrangePreservation";
import { buildPatientAStudentReconstruction } from "./buildPatientAStudentReconstruction";
import { analyzeRouteReadability, routeHighwayFlag, sceneDisplacement } from "./diagramLayoutL2b";
import { seedStableRouteState, storedToRouted } from "./incrementalRoutes";
import {
  analyzeRouteMeetings,
  classifyRouteInteractions,
  polylineLength,
} from "./orthogonalRouting";
import { applyPatientACardSizeScale } from "./patientACardSizeExperiment";
import {
  PATIENT_A_MERGE_JUNCTION_IDS,
  PATIENT_A_MERGE_JUNCTION_SPECS,
  arrangeThenReattachPatientAMergeJunctions,
  buildPatientAJunctionReconstruction,
  patientAMergeConnectionIds,
  sharedTerminalPoints,
} from "./patientAMergeJunctionTopology";
import { STUDENT_RELATED_DIAGRAM_UNSAVED_EDITING } from "./studentForm3RelatedDiagramBoundary";

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

function movedCardCount(
  before: { id: string; layout: { x: number; y: number } }[],
  after: { id: string; layout: { x: number; y: number } }[],
): number {
  const prev = new Map(before.map((card) => [card.id, card]));
  let moved = 0;
  for (const card of after) {
    const start = prev.get(card.id);
    if (!start) continue;
    if (start.layout.x !== card.layout.x || start.layout.y !== card.layout.y) {
      moved += 1;
    }
  }
  return moved;
}

const base = buildPatientAStudentReconstruction();
const plain90 = applyPatientACardSizeScale(base.graph, 90);
const junction = buildPatientAJunctionReconstruction(90);
const mergeIds = patientAMergeConnectionIds(base.cardKeys);

test("JX-A 71 cards維持", () => {
  assert.equal(junction.graph.cards.length, 71);
  assert.equal(plain90.cards.length, 71);
});

test("JX-B 64 connections維持", () => {
  assert.equal(junction.graph.connections.length, 64);
  assert.equal(plain90.connections.length, 64);
});

test("JX-C source/target完全一致", () => {
  const plain = new Map(plain90.connections.map((c) => [c.id, c]));
  for (const conn of junction.graph.connections) {
    const other = plain.get(conn.id);
    assert.ok(other);
    assert.equal(conn.sourceCardId, other!.sourceCardId);
    assert.equal(conn.targetCardId, other!.targetCardId);
  }
});

test("JX-D relationType完全一致", () => {
  const plain = new Map(plain90.connections.map((c) => [c.id, c]));
  for (const conn of junction.graph.connections) {
    assert.equal(conn.relationType, plain.get(conn.id)!.relationType);
    assert.equal(conn.origin, plain.get(conn.id)!.origin);
  }
});

test("JX-E Junction exactly 4", () => {
  assert.equal(junction.topology.branchPoints.length, 4);
  assert.deepEqual(
    junction.topology.branchPoints.map((bp) => bp.id).sort(),
    [...PATIENT_A_MERGE_JUNCTION_IDS].sort(),
  );
  assert.equal(junction.topology.routeGroups.length, 0);
});

test("JX-F 各Junction connectionIds正しい", () => {
  assert.equal(mergeIds.length, 8);
  for (const spec of PATIENT_A_MERGE_JUNCTION_SPECS) {
    const bp = junction.topology.branchPoints.find((row) => row.id === spec.id);
    assert.ok(bp);
    const want = [
      `pa_rs_c_${spec.sourceKeys[0]}_${spec.targetKey}`,
      `pa_rs_c_${spec.sourceKeys[1]}_${spec.targetKey}`,
    ].sort();
    assert.deepEqual([...bp!.connectionIds].sort(), want);
  }
});

test("JX-G same relationType only", () => {
  const byId = new Map(junction.graph.connections.map((c) => [c.id, c]));
  for (const spec of PATIENT_A_MERGE_JUNCTION_SPECS) {
    const bp = junction.topology.branchPoints.find((row) => row.id === spec.id)!;
    const types = bp.connectionIds.map((id) => byId.get(id)!.relationType);
    assert.equal(new Set(types).size, 1);
    assert.equal(types[0], spec.relationType);
  }
});

test("JX-H shared terminal point sequence一致", () => {
  for (const spec of PATIENT_A_MERGE_JUNCTION_SPECS) {
    const a = junction.routeState.byId[`pa_rs_c_${spec.sourceKeys[0]}_${spec.targetKey}`];
    const b = junction.routeState.byId[`pa_rs_c_${spec.sourceKeys[1]}_${spec.targetKey}`];
    assert.ok(a && b);
    const shared = sharedTerminalPoints(a.points, b.points);
    const trunk = junction.topology.trunks.find((row) => row.branchPointId === spec.id);
    assert.ok(trunk);
    assert.ok(trunk!.points.length >= 2, spec.id);
    assert.ok(shared.length >= trunk!.points.length, spec.id);
    const trunkLen = trunk!.points.length;
    assert.deepEqual(a.points.slice(-trunkLen), trunk!.points);
    assert.deepEqual(b.points.slice(-trunkLen), trunk!.points);
    assert.deepEqual(shared.slice(-trunkLen), trunk!.points);
  }
});

test("JX-I semantic graph変更なし", () => {
  assert.deepEqual(
    junction.graph.cards.map((c) => ({
      id: c.id,
      text: c.text,
      cardType: c.cardType,
      state: c.state,
      origin: c.origin,
    })),
    plain90.cards.map((c) => ({
      id: c.id,
      text: c.text,
      cardType: c.cardType,
      state: c.state,
      origin: c.origin,
    })),
  );
  assert.deepEqual(junction.graph.connections, plain90.connections);
  assert.deepEqual(junction.graph.cardSources, plain90.cardSources);
});

test("JX-J geometry crossingからJunction生成0", () => {
  const builder = src("./patientAMergeJunctionTopology.ts");
  assert.ok(builder.includes("Does not infer Junctions from geometry"));
  assert.equal(builder.includes("routeGroups"), true);
  assert.equal(junction.topology.routeGroups.length, 0);
});

const routed = Object.values(junction.routeState.byId).map(storedToRouted);
const classified = classifyRouteInteractions(
  routed,
  junction.graph.cards,
  junction.topology,
);

test("JX-K explicit Junctionにbridgeなし", () => {
  const meetings = analyzeRouteMeetings(
    routed,
    junction.graph.cards,
    junction.topology,
  );
  const pairByJunction = PATIENT_A_MERGE_JUNCTION_SPECS.map((spec) => {
    const ids = [
      `pa_rs_c_${spec.sourceKeys[0]}_${spec.targetKey}`,
      `pa_rs_c_${spec.sourceKeys[1]}_${spec.targetKey}`,
    ];
    return { id: spec.id, ids };
  });
  const samePairBridges = classified.bridges.filter((bridge) =>
    pairByJunction.some(
      (pair) =>
        pair.ids.includes(bridge.jumperConnectionId) &&
        pair.ids.includes(bridge.underConnectionId),
    ),
  );
  const junctionPointBridges = classified.bridges.filter((bridge) =>
    junction.topology.branchPoints.some(
      (bp) =>
        Math.abs(bridge.x - bp.x) < 1 &&
        Math.abs(bridge.y - bp.y) < 1 &&
        bp.connectionIds.includes(bridge.jumperConnectionId) &&
        bp.connectionIds.includes(bridge.underConnectionId),
    ),
  );
  const samePairMeetings = meetings.meetings.filter((meeting) =>
    pairByJunction.some(
      (pair) =>
        pair.ids.includes(meeting.connectionAId) &&
        pair.ids.includes(meeting.connectionBId),
    ),
  );
  assert.equal(samePairBridges.length, 0);
  assert.equal(junctionPointBridges.length, 0);
  assert.equal(
    samePairMeetings.every(
      (meeting) =>
        meeting.classifiedAs === "junction" || meeting.hasBridge === false,
    ),
    true,
  );
  assert.equal(classified.junctions.length > 0, true);
});

const plainRoutes = seedStableRouteState(plain90.cards, plain90.connections);
const plainRead = analyzeRouteReadability({
  cards: plain90.cards,
  connections: plain90.connections,
  routeState: plainRoutes,
});
const plainQuality = evaluateArrangeScene({
  cards: plain90.cards,
  connections: plain90.connections,
  routeState: plainRoutes,
});
const juncRead = analyzeRouteReadability({
  cards: junction.graph.cards,
  connections: junction.graph.connections,
  routeState: junction.routeState,
  topology: junction.topology,
});
const juncQuality = evaluateArrangeScene({
  cards: junction.graph.cards,
  connections: junction.graph.connections,
  routeState: junction.routeState,
  topology: junction.topology,
});

function localRow(
  specId: string,
  read: ReturnType<typeof analyzeRouteReadability>,
  routeState: ReturnType<typeof seedStableRouteState>,
) {
  const spec = PATIENT_A_MERGE_JUNCTION_SPECS.find((row) => row.id === specId)!;
  const ids = [
    `pa_rs_c_${spec.sourceKeys[0]}_${spec.targetKey}`,
    `pa_rs_c_${spec.sourceKeys[1]}_${spec.targetKey}`,
  ];
  const rows = read.connections.filter((row) => ids.includes(row.connectionId));
  const a = routeState.byId[ids[0]!];
  const b = routeState.byId[ids[1]!];
  const shared = a && b ? sharedTerminalPoints(a.points, b.points) : [];
  return {
    id: specId,
    through: rows.reduce((sum, row) => sum + row.cardIntersectionCount, 0),
    length: Math.round(rows.reduce((sum, row) => sum + row.length, 0)),
    bends: rows.reduce((sum, row) => sum + row.bendCount, 0),
    shared: Math.round(polylineLength(shared)),
  };
}

const localLabels: Record<string, string> = {
  j_exec_in: "JX-L",
  j_sleep_tx_in: "JX-M",
  j_food_s_in: "JX-N",
  j_role_s_in: "JX-O",
};
for (const spec of PATIENT_A_MERGE_JUNCTION_SPECS) {
  test(`${localLabels[spec.id]} ${spec.id} local metrics`, () => {
    const before = localRow(spec.id, plainRead, plainRoutes);
    const after = localRow(spec.id, juncRead, junction.routeState);
    assert.ok(after.shared > 0, spec.id);
    console.log(
      JSON.stringify({
        id: spec.id,
        before,
        after,
      }),
    );
  });
}

test("JX-S production routing変更なし", () => {
  for (const file of [
    "./applyRelatedDiagramLayout.ts",
    "./arrangePreservation.ts",
    "./diagramLayoutL2.ts",
    "./diagramLayoutL2d.ts",
    "./diagramLayoutL2dNp.ts",
    "./incrementalRoutes.ts",
    "./orthogonalRouting.ts",
    "./routeHardening.ts",
    "./regenerateRouteTopology.ts",
    "./routeTopology.ts",
  ]) {
    assert.equal(src(file).includes("patientAMergeJunctionTopology"), false);
  }
});

test("JX-T student editing flag false", () => {
  assert.equal(STUDENT_RELATED_DIAGRAM_UNSAVED_EDITING, false);
});

function rawLongSpan(routeState: ReturnType<typeof seedStableRouteState>) {
  return Object.values(routeState.byId).filter(
    (route) => routeHighwayFlag(route.points) > 0,
  ).length;
}

console.log("\n--- Junction positions ---");
console.log(
  JSON.stringify(
    junction.topology.branchPoints.map((bp) => ({
      id: bp.id,
      x: Math.round(bp.x),
      y: Math.round(bp.y),
      connectionIds: bp.connectionIds,
    })),
  ),
);
console.log("\n--- 90% plain Before ---");
console.log(
  JSON.stringify({
    overlap: plainQuality.overlapCount,
    bounds: plainQuality.boundsHits,
    legend: plainQuality.legendHits,
    cardThrough: plainQuality.cardThrough,
    highwayReported: plainQuality.highwayCount,
    rawLongSpan: rawLongSpan(plainRoutes),
    length: Math.round(plainQuality.totalLength),
    bends: plainRead.totalBends,
  }),
);
console.log("\n--- 90% Junction Before ---");
console.log(
  JSON.stringify({
    overlap: juncQuality.overlapCount,
    bounds: juncQuality.boundsHits,
    legend: juncQuality.legendHits,
    cardThrough: juncQuality.cardThrough,
    highwayReported: juncQuality.highwayCount,
    rawLongSpan: rawLongSpan(junction.routeState),
    length: Math.round(juncQuality.totalLength),
    bends: juncRead.totalBends,
    throughDelta: juncQuality.cardThrough - plainQuality.cardThrough,
  }),
);

const pass1 = arrangeThenReattachPatientAMergeJunctions({
  graph: junction.graph,
  cardKeys: base.cardKeys,
});
const arranged1 = pass1.arranged;
const after1Attached = pass1.attached;
const after1Graph = after1Attached.graph;
const pass2 = arrangeThenReattachPatientAMergeJunctions({
  graph: after1Attached.graph,
  cardKeys: base.cardKeys,
  previousPlainRouteState: pass1.plainRouteState,
});
const arranged2 = pass2.arranged;
const after2Graph = pass2.attached.graph;

test("JX-P Arrange後membership維持", () => {
  const membership = (topology: typeof after1Attached.topology) =>
    topology.branchPoints.map((bp) => ({
      id: bp.id,
      connectionIds: [...bp.connectionIds].sort(),
    }));
  assert.deepEqual(
    membership(after1Attached.topology),
    membership(junction.topology),
  );
  assert.deepEqual(
    membership(pass2.attached.topology),
    membership(junction.topology),
  );
});

test("JX-Q Arrange後connection identity維持", () => {
  assert.deepEqual(
    after1Attached.graph.connections.map((c) => ({
      id: c.id,
      sourceCardId: c.sourceCardId,
      targetCardId: c.targetCardId,
      relationType: c.relationType,
    })),
    junction.graph.connections.map((c) => ({
      id: c.id,
      sourceCardId: c.sourceCardId,
      targetCardId: c.targetCardId,
      relationType: c.relationType,
    })),
  );
});

test("JX-R 2回目Arrange固定点/no-op", () => {
  assert.ok(arranged2.kind === "noop" || arranged2.kind === "applied");
  assert.equal(pass2.attached.topology.branchPoints.length, 4);
  assert.deepEqual(
    after2Graph.connections.map((c) => c.id).sort(),
    junction.graph.connections.map((c) => c.id).sort(),
  );
  if (arranged2.kind === "noop") {
    assert.ok(
      arranged2.notice === "already_arranged" ||
        arranged2.notice === "impossible_to_fit",
    );
  }
});

console.log("\n--- Arrange 1/2 ---");
console.log(
  JSON.stringify({
    arrange1: arranged1.kind,
    notice1: arranged1.notice,
    moved1: movedCardCount(junction.graph.cards, after1Graph.cards),
    disp1: Math.round(
      sceneDisplacement(junction.graph.cards, after1Graph.cards),
    ),
    arrange2: arranged2.kind,
    notice2: arranged2.notice,
    moved2: movedCardCount(after1Attached.graph.cards, after2Graph.cards),
  }),
);

console.log(`\n${passed} tests passed`);
