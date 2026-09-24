/**
 * Patient A student-diagram reconstruction (RS-A…N).
 * Run: ./node_modules/.bin/jiti lib/v2/relatedDiagram/buildPatientAStudentReconstruction.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  arrangeRelatedDiagramScene,
} from "./applyRelatedDiagramLayout";
import { evaluateArrangeScene } from "./arrangePreservation";
import {
  DEV_RECONSTRUCTED_STUDENT_CONNECTION,
  DEV_RECONSTRUCTION_ASSUMPTION,
  PATIENT_A_DEV_RECONSTRUCTION_KIND,
  PATIENT_A_RECONSTRUCTION_CLUSTERS,
  PATIENT_A_STUDENT_RECONSTRUCTION_PLAN,
  buildPatientAStudentReconstruction,
} from "./buildPatientAStudentReconstruction";
import { analyzeRouteReadability, sceneDisplacement } from "./diagramLayoutL2b";
import { commitAssessmentCompose } from "./form3ToUnderstandingCard";
import {
  PATIENT_A_FORM3_SKELETON_DEV_SNAPSHOT,
} from "./fixtures/patientAForm3SkeletonSnapshot";
import { seedStableRouteState } from "./incrementalRoutes";
import { STUDENT_RELATED_DIAGRAM_UNSAVED_EDITING } from "./studentForm3RelatedDiagramBoundary";
import { rectIntersectsA3Legend } from "./a3Legend";
import { A3_HEIGHT_PX, A3_WIDTH_PX } from "./a3Canvas";

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

const snapshot = PATIENT_A_FORM3_SKELETON_DEV_SNAPSHOT;
const activeInfoTexts = snapshot.informationCards
  .filter((card) => card.status === "active")
  .map((card) => card.content);
const assessmentTexts = snapshot.assessmentCards.map((card) => card.interpretation);
const scene = buildPatientAStudentReconstruction();

test("RS-A Patient A source以外の患者事実を生成しない", () => {
  const infos = scene.graph.cards.filter((c) => c.cardType === "information");
  for (const card of infos) {
    assert.ok(
      activeInfoTexts.some((text) => text.includes(card.text)),
      `invented information: ${card.text}`,
    );
  }
  const understandings = scene.graph.cards.filter(
    (c) => c.cardType === "understanding",
  );
  for (const card of understandings) {
    assert.ok(
      assessmentTexts.some((text) => text.includes(card.text)),
      `invented understanding: ${card.text}`,
    );
  }
  const graphText = scene.graph.cards.map((c) => c.text).join("\n");
  assert.equal(graphText.includes("統合失調症"), false);
  assert.equal(graphText.includes("リスパダール"), false);
  assert.equal(graphText.includes("セロクエル"), false);
  assert.equal(graphText.includes("アモバン"), false);
  assert.equal(graphText.includes("レンドルミン"), false);
  assert.equal(graphText.includes("BMI23.8"), false);
  assert.equal(graphText.includes("セルフケア促進準備"), false);
});

test("RS-B Assessment全文Understanding 0", () => {
  const understandings = scene.graph.cards.filter(
    (c) => c.cardType === "understanding",
  );
  assert.ok(understandings.length > 0);
  for (const card of understandings) {
    assert.equal(
      assessmentTexts.includes(card.text),
      false,
      `full assessment card: ${card.id}`,
    );
    assert.ok(card.text.length < 90, card.text);
  }
});

test("RS-C Understandingはsource Assessment ID保持", () => {
  const understandings = scene.graph.cards.filter(
    (c) => c.cardType === "understanding",
  );
  const sources = scene.graph.cardSources.filter(
    (s) => s.sourceType === "form3_assessment",
  );
  assert.equal(sources.length, understandings.length);
  for (const card of understandings) {
    const source = sources.find((s) => s.cardId === card.id);
    assert.ok(source);
    assert.ok(snapshot.assessmentCards.some((a) => a.id === source!.sourceId));
    assert.equal(source!.selectedText, card.text);
    assert.equal(typeof source!.selectionStart, "number");
    assert.equal(typeof source!.selectionEnd, "number");
  }
});

test("RS-D candidate evidence provenance保持", () => {
  const sources = scene.graph.cardSources.filter(
    (s) => s.sourceType === "form3_assessment",
  );
  for (const source of sources) {
    const assessment = snapshot.assessmentCards.find(
      (a) => a.id === source.sourceId,
    );
    assert.ok(assessment);
    assert.deepEqual(
      source.candidateEvidenceInformationIds,
      [...new Set(assessment!.evidenceInformationIds)],
    );
  }
});

test("RS-E fixture connectionsはDEV-only", () => {
  assert.equal(scene.kind, PATIENT_A_DEV_RECONSTRUCTION_KIND);
  assert.equal(scene.connectionMeta.length, scene.graph.connections.length);
  for (const meta of scene.connectionMeta) {
    assert.equal(meta.kind, DEV_RECONSTRUCTED_STUDENT_CONNECTION);
    assert.ok(meta.id.startsWith("pa_rs_c_"));
  }
  for (const conn of scene.graph.connections) {
    assert.equal(conn.origin, "student_diagram");
    assert.ok(conn.id.startsWith("pa_rs_c_"));
  }
});

test("RS-F production composeへconnection生成なし", () => {
  const compose = src("./form3ToUnderstandingCard.ts");
  assert.equal(compose.includes("connections:"), false);
  assert.equal(compose.includes("addConnection"), false);
  assert.equal(compose.includes("upsertConnection"), false);
  const committed = commitAssessmentCompose;
  assert.equal(typeof committed, "function");
  const builder = src("./buildPatientAStudentReconstruction.ts");
  assert.ok(builder.includes(DEV_RECONSTRUCTED_STUDENT_CONNECTION));
  assert.equal(builder.includes("AUTO GENERATED PRODUCTION CONNECTION"), false);
});

test("RS-G A3 bounds", () => {
  for (const card of scene.graph.cards) {
    assert.ok(card.layout.x >= 0, card.id);
    assert.ok(card.layout.y >= 0, card.id);
    assert.ok(card.layout.x + card.layout.width <= A3_WIDTH_PX, card.id);
    assert.ok(card.layout.y + card.layout.height <= A3_HEIGHT_PX, card.id);
  }
});

test("RS-H legend reservation", () => {
  for (const card of scene.graph.cards) {
    assert.equal(
      rectIntersectsA3Legend({
        x: card.layout.x,
        y: card.layout.y,
        width: card.layout.width,
        height: card.layout.height,
      }),
      false,
      card.id,
    );
  }
});

test("RS-I Knowledge semantics不変", () => {
  assert.equal(scene.stats.knowledge, 0);
  assert.equal(
    scene.graph.cards.some((c) => c.cardType === "knowledge"),
    false,
  );
  assert.equal(
    scene.graph.cards.some((c) => c.origin === "knowledge_library"),
    false,
  );
});

test("RS-J NP semantics不変", () => {
  const nps = scene.graph.cards.filter((c) => c.cardType === "nursing_problem");
  assert.equal(nps.length, 2);
  for (const card of nps) {
    assert.equal(card.origin, "direct_insight");
    assert.ok(card.state === "current" || card.state === "potential");
    assert.ok(
      assessmentTexts.some((text) => text.includes(card.text)),
      card.text,
    );
  }
  assert.equal(scene.nursingProblemAssumptions.length, 2);
  for (const row of scene.nursingProblemAssumptions) {
    assert.equal(row.kind, DEV_RECONSTRUCTION_ASSUMPTION);
  }
  assert.equal(scene.graph.integrations.length, 0);
});

const beforeRoutes = seedStableRouteState(
  scene.graph.cards,
  scene.graph.connections,
);
const beforeQuality = evaluateArrangeScene({
  cards: scene.graph.cards,
  connections: scene.graph.connections,
  routeState: beforeRoutes,
});
const beforeRead = analyzeRouteReadability({
  cards: scene.graph.cards,
  connections: scene.graph.connections,
  routeState: beforeRoutes,
});
const arranged1 = arrangeRelatedDiagramScene({
  graph: scene.graph,
  routeState: beforeRoutes,
});
const after1Graph = arranged1.kind === "applied" ? arranged1.graph : scene.graph;
const after1Routes =
  arranged1.kind === "applied" ? arranged1.routeState : beforeRoutes;
const after1Topo = arranged1.kind === "applied" ? arranged1.topology : undefined;
const after1Quality = evaluateArrangeScene({
  cards: after1Graph.cards,
  connections: after1Graph.connections,
  routeState: after1Routes,
  topology: after1Topo,
});
const after1Read = analyzeRouteReadability({
  cards: after1Graph.cards,
  connections: after1Graph.connections,
  routeState: after1Routes,
  topology: after1Topo,
});
const arranged2 = arrangeRelatedDiagramScene({
  graph: after1Graph,
  routeState: after1Routes,
  topology: after1Topo,
});
const after2Graph =
  arranged2.kind === "applied" ? arranged2.graph : after1Graph;
const after2Moved = movedCardCount(after1Graph.cards, after2Graph.cards);

test("RS-K Arrange 1回実行可能", () => {
  assert.ok(arranged1.kind === "applied" || arranged1.kind === "noop");
  assert.ok(
    arranged1.notice === "arranged" ||
      arranged1.notice === "already_arranged" ||
      arranged1.notice === "impossible_to_fit",
  );
});

test("RS-L 2回目ArrangeがPreservation/no-opまたは固定点", () => {
  if (arranged2.kind === "noop") {
    assert.ok(
      arranged2.notice === "already_arranged" ||
        arranged2.notice === "impossible_to_fit",
    );
  } else {
    assert.equal(after2Moved, 0);
  }
});

test("RS-M student editing flag false", () => {
  assert.equal(STUDENT_RELATED_DIAGRAM_UNSAVED_EDITING, false);
});

test("RS-N DB read/writeなし", () => {
  const builder = src("./buildPatientAStudentReconstruction.ts");
  const workspace = src(
    "../../../components/v2/relatedDiagram/RelatedDiagramPatientADevWorkspace.tsx",
  );
  const page = src("../../../app/dev/related-diagram-patient-a/page.tsx");
  for (const text of [builder, workspace, page]) {
    assert.equal(text.includes("createClient"), false);
    assert.equal(text.includes("insertForm3"), false);
    assert.equal(text.includes("updateForm3WithVersion"), false);
    assert.equal(text.includes("saveForm3Action"), false);
    assert.equal(text.includes("saveForm3V2Action"), false);
    assert.equal(text.includes("insertRelatedDiagram"), false);
    assert.equal(text.includes("updateRelatedDiagram"), false);
    assert.equal(text.includes('.from("related_diagram_records")'), false);
    assert.equal(text.includes('.from("form3_records")'), false);
  }
});

test("plan counts match built scene", () => {
  assert.deepEqual(scene.stats, PATIENT_A_STUDENT_RECONSTRUCTION_PLAN);
  assert.deepEqual(scene.clusters, PATIENT_A_RECONSTRUCTION_CLUSTERS);
  assert.equal(scene.stats.junctions, 0);
});

test("no full-assessment Understanding and no invented Knowledge", () => {
  assert.equal(
    scene.graph.cards.filter((c) => c.cardType === "understanding").every(
      (c) => c.origin === "form3_assessment",
    ),
    true,
  );
});

console.log("\n--- reconstruction plan ---");
console.log(JSON.stringify(scene.stats, null, 2));
console.log("clusters", scene.clusters.join(", "));
console.log("\n--- Before metrics ---");
console.log(
  JSON.stringify(
    {
      kind: "before",
      overlap: beforeQuality.overlapCount,
      bounds: beforeQuality.boundsHits,
      legend: beforeQuality.legendHits,
      cardThrough: beforeQuality.cardThrough,
      highway: beforeQuality.highwayCount,
      outerRail: beforeQuality.outerRailCount,
      length: beforeQuality.totalLength,
      bends: beforeRead.totalBends,
      maxBends: beforeQuality.maxBendCount,
      hardDefects: beforeQuality.hardDefects,
      goodEnough: beforeQuality.goodEnough,
    },
    null,
    2,
  ),
);
console.log("\n--- Arrange 1 After metrics ---");
console.log(
  JSON.stringify(
    {
      kind: arranged1.kind,
      notice: arranged1.notice,
      movedCards: movedCardCount(scene.graph.cards, after1Graph.cards),
      displacement: sceneDisplacement(scene.graph.cards, after1Graph.cards),
      overlap: after1Quality.overlapCount,
      bounds: after1Quality.boundsHits,
      legend: after1Quality.legendHits,
      cardThrough: after1Quality.cardThrough,
      highway: after1Quality.highwayCount,
      outerRail: after1Quality.outerRailCount,
      length: after1Quality.totalLength,
      bends: after1Read.totalBends,
      maxBends: after1Quality.maxBendCount,
      hardDefects: after1Quality.hardDefects,
      goodEnough: after1Quality.goodEnough,
    },
    null,
    2,
  ),
);
console.log("\n--- Arrange 2 ---");
console.log(
  JSON.stringify(
    {
      kind: arranged2.kind,
      notice: arranged2.notice,
      movedCards: after2Moved,
    },
    null,
    2,
  ),
);

console.log(`\n${passed} tests passed`);
