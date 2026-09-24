/**
 * Patient A DEV card-size corridor experiment.
 * Run: ./node_modules/.bin/jiti lib/v2/relatedDiagram/patientACardSizeExperiment.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { A3_BODY_PT } from "./a3Canvas";
import { arrangeRelatedDiagramScene } from "./applyRelatedDiagramLayout";
import { evaluateArrangeScene } from "./arrangePreservation";
import { buildPatientAStudentReconstruction } from "./buildPatientAStudentReconstruction";
import { DIRECT_NURSING_PROBLEM_HEIGHT, DIRECT_NURSING_PROBLEM_WIDTH } from "./cardDirectNursingProblem";
import { analyzeRouteReadability, sceneDisplacement } from "./diagramLayoutL2b";
import {
  INFORMATION_CARD_HEIGHT,
  INFORMATION_CARD_WIDTH,
  UNDERSTANDING_CARD_HEIGHT,
  UNDERSTANDING_CARD_WIDTH,
} from "./form3ToUnderstandingCard";
import { seedStableRouteState } from "./incrementalRoutes";
import {
  PATIENT_A_DEFAULT_CARD_SIZE_SCALE,
  PATIENT_A_PRODUCTION_CARD_CONTRACT,
  applyPatientACardSizeScale,
  measurePatientACorridors,
  patientACardBoxForType,
  patientADevCardChrome,
} from "./patientACardSizeExperiment";
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

test("production card constants unchanged", () => {
  assert.equal(INFORMATION_CARD_WIDTH, 180);
  assert.equal(INFORMATION_CARD_HEIGHT, 72);
  assert.equal(UNDERSTANDING_CARD_WIDTH, 180);
  assert.equal(UNDERSTANDING_CARD_HEIGHT, 72);
  assert.equal(DIRECT_NURSING_PROBLEM_WIDTH, 200);
  assert.equal(DIRECT_NURSING_PROBLEM_HEIGHT, 78);
  assert.equal(A3_BODY_PT, 10.5);
  assert.equal(PATIENT_A_DEFAULT_CARD_SIZE_SCALE, 100);
  assert.deepEqual(PATIENT_A_PRODUCTION_CARD_CONTRACT.information, {
    width: 180,
    height: 72,
  });
});

test("100/90/85 logical boxes", () => {
  assert.deepEqual(patientACardBoxForType("information", 100), {
    width: 180,
    height: 72,
  });
  assert.deepEqual(patientACardBoxForType("understanding", 100), {
    width: 180,
    height: 72,
  });
  assert.deepEqual(patientACardBoxForType("nursing_problem", 100), {
    width: 200,
    height: 78,
  });
  assert.deepEqual(patientACardBoxForType("information", 90), {
    width: 162,
    height: 65,
  });
  assert.deepEqual(patientACardBoxForType("nursing_problem", 90), {
    width: 180,
    height: 70,
  });
  assert.deepEqual(patientACardBoxForType("information", 85), {
    width: 153,
    height: 61,
  });
  assert.deepEqual(patientACardBoxForType("nursing_problem", 85), {
    width: 170,
    height: 66,
  });
});

test("scale keeps identity / text / connections", () => {
  const scaled = applyPatientACardSizeScale(base.graph, 85);
  assert.equal(scaled.cards.length, 71);
  assert.equal(scaled.connections.length, 64);
  assert.deepEqual(
    scaled.cards.map((c) => c.id),
    base.graph.cards.map((c) => c.id),
  );
  assert.deepEqual(
    scaled.cards.map((c) => c.text),
    base.graph.cards.map((c) => c.text),
  );
  assert.deepEqual(
    scaled.cards.map((c) => ({ x: c.layout.x, y: c.layout.y })),
    base.graph.cards.map((c) => ({ x: c.layout.x, y: c.layout.y })),
  );
  assert.deepEqual(scaled.connections, base.graph.connections);
  assert.equal(
    scaled.cards.filter((c) => c.cardType === "information").every((c) => c.layout.width === 153),
    true,
  );
});

test("font stays 10.5pt; padding shrinks first", () => {
  const full = patientADevCardChrome(100);
  const mid = patientADevCardChrome(90);
  const small = patientADevCardChrome(85);
  assert.equal(full.fontSizePt, 10.5);
  assert.equal(mid.fontSizePt, 10.5);
  assert.equal(small.fontSizePt, 10.5);
  assert.equal(full.padding, "6px 8px");
  assert.equal(mid.padding, "4px 6px");
  assert.equal(small.padding, "4px 5px");
  assert.equal(full.lineHeight, 1.35);
  assert.equal(mid.lineHeight, 1.35);
  assert.equal(small.lineHeight, 1.3);
});

test("no CSS transform scale and no production Arrange edits", () => {
  const experiment = src("./patientACardSizeExperiment.ts");
  const workspace = src(
    "../../../components/v2/relatedDiagram/RelatedDiagramPatientADevWorkspace.tsx",
  );
  assert.equal(experiment.includes("transform: scale"), false);
  assert.equal(experiment.includes("Do not visually shrink cards with CSS scale"), true);
  assert.ok(workspace.includes("applyPatientACardSizeScale"));
  assert.ok(workspace.includes("CSS scaleなし"));
  assert.ok(workspace.includes('data-rd-patient-a-card-size'));
  assert.ok(workspace.includes("PATIENT_A_DEFAULT_CARD_SIZE_SCALE"));
  for (const file of [
    "./applyRelatedDiagramLayout.ts",
    "./arrangePreservation.ts",
    "./diagramLayoutL2.ts",
    "./diagramLayoutL2d.ts",
    "./diagramLayoutL2dNp.ts",
    "./incrementalRoutes.ts",
    "./form3ToUnderstandingCard.ts",
    "./cardDirectNursingProblem.ts",
  ]) {
    assert.equal(src(file).includes("patientACardSizeExperiment"), false);
  }
  const cardNode = src(
    "../../../components/v2/relatedDiagram/RelatedDiagramCardNode.tsx",
  );
  assert.ok(cardNode.includes('chrome?.padding ?? "6px 8px"'));
  assert.ok(cardNode.includes("A3_BODY_PT"));
  assert.equal(STUDENT_RELATED_DIAGRAM_UNSAVED_EDITING, false);
});

type MetricRow = {
  scale: number;
  phase: string;
  overlap: number;
  bounds: number;
  legend: number;
  cardThrough: number;
  highway: number;
  outerRail: number;
  length: number;
  bends: number;
  maxBends: number;
  movedCards: number;
  displacement: number;
  occupancy: number;
  usableVertical: number;
  usableHorizontal: number;
  meanMinGap: number;
};

function collectMetrics(
  scale: 100 | 90 | 85,
): { before: MetricRow; after: MetricRow } {
  const graph = applyPatientACardSizeScale(base.graph, scale);
  const corridorsBefore = measurePatientACorridors(graph.cards);
  const beforeRoutes = seedStableRouteState(graph.cards, graph.connections);
  const beforeQuality = evaluateArrangeScene({
    cards: graph.cards,
    connections: graph.connections,
    routeState: beforeRoutes,
  });
  const beforeRead = analyzeRouteReadability({
    cards: graph.cards,
    connections: graph.connections,
    routeState: beforeRoutes,
  });
  const arranged = arrangeRelatedDiagramScene({
    graph,
    routeState: beforeRoutes,
  });
  const afterGraph = arranged.kind === "applied" ? arranged.graph : graph;
  const afterRoutes =
    arranged.kind === "applied" ? arranged.routeState : beforeRoutes;
  const afterTopo = arranged.kind === "applied" ? arranged.topology : undefined;
  const afterQuality = evaluateArrangeScene({
    cards: afterGraph.cards,
    connections: afterGraph.connections,
    routeState: afterRoutes,
    topology: afterTopo,
  });
  const afterRead = analyzeRouteReadability({
    cards: afterGraph.cards,
    connections: afterGraph.connections,
    routeState: afterRoutes,
    topology: afterTopo,
  });
  const corridorsAfter = measurePatientACorridors(afterGraph.cards);
  return {
    before: {
      scale,
      phase: "before",
      overlap: beforeQuality.overlapCount,
      bounds: beforeQuality.boundsHits,
      legend: beforeQuality.legendHits,
      cardThrough: beforeQuality.cardThrough,
      highway: beforeQuality.highwayCount,
      outerRail: beforeQuality.outerRailCount,
      length: Math.round(beforeQuality.totalLength),
      bends: beforeRead.totalBends,
      maxBends: beforeQuality.maxBendCount,
      movedCards: 0,
      displacement: 0,
      occupancy: Number(corridorsBefore.occupancy.toFixed(3)),
      usableVertical: corridorsBefore.usableVerticalCorridors,
      usableHorizontal: corridorsBefore.usableHorizontalCorridors,
      meanMinGap: Number(corridorsBefore.meanMinGap.toFixed(1)),
    },
    after: {
      scale,
      phase: arranged.kind,
      overlap: afterQuality.overlapCount,
      bounds: afterQuality.boundsHits,
      legend: afterQuality.legendHits,
      cardThrough: afterQuality.cardThrough,
      highway: afterQuality.highwayCount,
      outerRail: afterQuality.outerRailCount,
      length: Math.round(afterQuality.totalLength),
      bends: afterRead.totalBends,
      maxBends: afterQuality.maxBendCount,
      movedCards: movedCardCount(graph.cards, afterGraph.cards),
      displacement: Math.round(
        sceneDisplacement(graph.cards, afterGraph.cards),
      ),
      occupancy: Number(corridorsAfter.occupancy.toFixed(3)),
      usableVertical: corridorsAfter.usableVerticalCorridors,
      usableHorizontal: corridorsAfter.usableHorizontalCorridors,
      meanMinGap: Number(corridorsAfter.meanMinGap.toFixed(1)),
    },
  };
}

const metrics100 = collectMetrics(100);
const metrics90 = collectMetrics(90);
const metrics85 = collectMetrics(85);

test("same 71/64 at every scale", () => {
  for (const scale of [100, 90, 85] as const) {
    const graph = applyPatientACardSizeScale(base.graph, scale);
    assert.equal(graph.cards.length, 71);
    assert.equal(graph.connections.length, 64);
    assert.equal(graph.cards.filter((c) => c.cardType === "knowledge").length, 0);
  }
});

test("smaller cards reduce occupancy and increase mean gap before Arrange", () => {
  assert.ok(metrics90.before.occupancy < metrics100.before.occupancy);
  assert.ok(metrics85.before.occupancy < metrics90.before.occupancy);
  assert.ok(metrics90.before.meanMinGap >= metrics100.before.meanMinGap);
  assert.ok(metrics85.before.meanMinGap >= metrics90.before.meanMinGap);
});

console.log("\n--- card size metrics ---");
console.log(
  [
    "scale",
    "phase",
    "overlap",
    "bounds",
    "legend",
    "cardThrough",
    "highway",
    "outerRail",
    "length",
    "bends",
    "maxBends",
    "moved",
    "disp",
    "occupancy",
    "vCorr",
    "hCorr",
    "meanGap",
  ].join("\t"),
);
for (const row of [
  metrics100.before,
  metrics100.after,
  metrics90.before,
  metrics90.after,
  metrics85.before,
  metrics85.after,
]) {
  console.log(
    [
      row.scale,
      row.phase,
      row.overlap,
      row.bounds,
      row.legend,
      row.cardThrough,
      row.highway,
      row.outerRail,
      row.length,
      row.bends,
      row.maxBends,
      row.movedCards,
      row.displacement,
      row.occupancy,
      row.usableVertical,
      row.usableHorizontal,
      row.meanMinGap,
    ].join("\t"),
  );
}

console.log(`\n${passed} tests passed`);
