/**
 * Route Editing Demo Patient fixture.
 * Run: ./node_modules/.bin/jiti lib/v2/relatedDiagram/buildRouteEditingDemoPatient.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildPatientAStudentReconstruction } from "./buildPatientAStudentReconstruction";
import {
  ROUTE_EDITING_DEMO_CONNECTION_IDS,
  ROUTE_EDITING_DEMO_EXISTING_BEND_POINTS,
  ROUTE_EDITING_DEMO_GEOMETRY_CASES,
  ROUTE_EDITING_DEMO_KIND,
  ROUTE_EDITING_DEMO_MULTI_CARD_ID,
  buildRouteEditingDemoPatient,
} from "./buildRouteEditingDemoPatient";
import { countPolylineCardHits } from "./diagramLayoutL2";
import { seedInitialAutoRouteState } from "./incrementalRoutes";
import { analyzeRouteMeetings } from "./orthogonalRouting";
import { isJunctionOwnedConnection, isStudentManualRoute } from "./routeTopology";

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

const scene = buildRouteEditingDemoPatient();
const seeded = seedInitialAutoRouteState(
  scene.graph.cards,
  scene.graph.connections,
  scene.topology,
);

test("RED-A 15-20 cards / 12-18 connections", () => {
  assert.ok(scene.graph.cards.length >= 15);
  assert.ok(scene.graph.cards.length <= 20);
  assert.ok(scene.graph.connections.length >= 12);
  assert.ok(scene.graph.connections.length <= 18);
  assert.equal(scene.kind, ROUTE_EDITING_DEMO_KIND);
});

test("RED-B no Junction / no Knowledge", () => {
  assert.equal(scene.topology.branchPoints.length, 0);
  assert.equal(scene.topology.trunks.length, 0);
  assert.equal(scene.topology.routeGroups.length, 0);
  assert.equal(
    scene.graph.cards.some((card) => card.cardType === "knowledge"),
    false,
  );
  for (const connection of scene.graph.connections) {
    assert.equal(isJunctionOwnedConnection(scene.topology, connection.id), false);
    assert.equal(connection.origin, "student_diagram");
  }
});

test("RED-C geometry cases present", () => {
  assert.deepEqual(
    [...scene.geometryCases],
    [...ROUTE_EDITING_DEMO_GEOMETRY_CASES],
  );
  const longH = seeded.byId[ROUTE_EDITING_DEMO_CONNECTION_IDS.longHorizontal]!;
  const longV = seeded.byId[ROUTE_EDITING_DEMO_CONNECTION_IDS.longVertical]!;
  const xs = longH.points.map((point) => point.x);
  const ys = longV.points.map((point) => point.y);
  assert.ok(Math.max(...xs) - Math.min(...xs) >= 400);
  assert.ok(Math.max(...ys) - Math.min(...ys) >= 400);
});

test("RED-D card-through / crossing / existing bend / multi", () => {
  const through = seeded.byId[ROUTE_EDITING_DEMO_CONNECTION_IDS.cardThrough]!;
  assert.ok(
    countPolylineCardHits(
      through.points,
      scene.graph.cards.map((card) => ({ id: card.id, ...card.layout })),
      new Set([through.sourceCardId, through.targetCardId]),
    ) > 0,
  );
  const meetings = analyzeRouteMeetings(Object.values(seeded.byId), scene.graph.cards);
  assert.ok(meetings.independentCrossingCount > 0);
  const bend = scene.graph.connections.find(
    (row) => row.id === ROUTE_EDITING_DEMO_CONNECTION_IDS.existingBend,
  )!;
  assert.equal(isStudentManualRoute(scene.topology, bend), true);
  assert.deepEqual(
    seeded.byId[bend.id]!.points,
    ROUTE_EDITING_DEMO_EXISTING_BEND_POINTS,
  );
  const multi = scene.graph.connections.filter(
    (row) =>
      row.sourceCardId === ROUTE_EDITING_DEMO_MULTI_CARD_ID ||
      row.targetCardId === ROUTE_EDITING_DEMO_MULTI_CARD_ID,
  );
  assert.ok(multi.length >= 3);
});

test("RED-E AUTO seed covers every connection", () => {
  for (const connection of scene.graph.connections) {
    const stored = seeded.byId[connection.id];
    assert.ok(stored, connection.id);
    assert.ok(stored!.points.length >= 2);
  }
});

test("RED-F Patient A fixture stays 71/64 and is not imported", () => {
  const patientA = buildPatientAStudentReconstruction();
  assert.equal(patientA.graph.cards.length, 71);
  assert.equal(patientA.graph.connections.length, 64);
  const demo = src("./buildRouteEditingDemoPatient.ts");
  const page = src("../../../app/dev/related-diagram-route-editing/page.tsx");
  const ws = src(
    "../../../components/v2/relatedDiagram/RelatedDiagramRouteEditingDemoWorkspace.tsx",
  );
  assert.equal(demo.includes("buildPatientAStudentReconstruction"), false);
  assert.equal(demo.includes("patientAMergeJunctionTopology"), false);
  assert.equal(page.includes("related-diagram-patient-a"), false);
  assert.equal(ws.includes("attachPatientAMergeJunctions"), false);
  assert.equal(ws.includes("buildPatientAStudentReconstruction"), false);
});

console.log(`\n${passed} passed`);
console.log(
  JSON.stringify(
    {
      cards: scene.graph.cards.length,
      connections: scene.graph.connections.length,
      geometryCases: scene.geometryCases,
      crossings: analyzeRouteMeetings(Object.values(seeded.byId), scene.graph.cards)
        .independentCrossingCount,
    },
    null,
    2,
  ),
);
