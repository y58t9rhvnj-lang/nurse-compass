/**
 * Patient A Form3 skeleton DEV builder (PA-A…R).
 * Run: ./node_modules/.bin/jiti lib/v2/relatedDiagram/buildPatientAForm3Skeleton.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  arrangeRelatedDiagramScene,
} from "./applyRelatedDiagramLayout";
import { evaluateArrangeScene } from "./arrangePreservation";
import {
  PATIENT_A_DEV_EVIDENCE_RELATION,
  PATIENT_A_DEV_SKELETON_KIND,
  buildPatientAForm3Skeleton,
  patientADevInformationCardId,
} from "./buildPatientAForm3Skeleton";
import { analyzeRouteReadability } from "./diagramLayoutL2b";
import {
  PATIENT_A_FORM3_SKELETON_DEV_SNAPSHOT,
  clonePatientAForm3SkeletonSnapshot,
} from "./fixtures/patientAForm3SkeletonSnapshot";
import { seedStableRouteState } from "./incrementalRoutes";
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

function shuffle<T>(rows: T[]): T[] {
  const copy = rows.slice();
  copy.reverse();
  if (copy.length > 2) {
    const [first, ...rest] = copy;
    copy.splice(0, copy.length, ...rest, first!);
  }
  return copy;
}

test("PA-A snapshot parse成功", () => {
  const snap = PATIENT_A_FORM3_SKELETON_DEV_SNAPSHOT;
  assert.equal(snap._devOnly, true);
  assert.equal(snap._readOnlySnapshot, true);
  assert.equal(snap._doNotWriteBack, true);
  assert.equal(snap.schemaVersion, 2);
  assert.equal(snap.source.dbVersion, 34);
  assert.equal(snap.source.caseId, "SP-001");
  assert.equal(snap.source.loginId, "99999991");
  assert.equal(snap.patientId, "A");
});

const scene = buildPatientAForm3Skeleton();

test("PA-B active Information = 26", () => {
  assert.equal(scene.stats.information, 26);
  assert.equal(
    scene.graph.cards.filter((c) => c.cardType === "information").length,
    26,
  );
});

test("PA-C reviewed Assessment = 10", () => {
  assert.equal(scene.stats.understanding, 10);
  assert.equal(
    scene.graph.cards.filter((c) => c.cardType === "understanding").length,
    10,
  );
});

test("PA-D cards = 36", () => {
  assert.equal(scene.stats.cards, 36);
  assert.equal(scene.graph.cards.length, 36);
});

test("PA-E evidence = 35", () => {
  assert.equal(scene.stats.evidence, 35);
  assert.equal(scene.evidenceRelations.length, 35);
  assert.equal(scene.graph.connections.length, 35);
});

test("PA-F isolated Information = 8", () => {
  assert.equal(scene.stats.isolatedInformation, 8);
});

test("PA-G 同一Informationをmulti-tagでduplicateしない", () => {
  const ids = scene.graph.cards
    .filter((c) => c.cardType === "information")
    .map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
  const snapIds = PATIENT_A_FORM3_SKELETON_DEV_SNAPSHOT.informationCards
    .filter((c) => c.status === "active")
    .map((c) => patientADevInformationCardId(c.id));
  assert.equal(new Set(snapIds).size, 26);
  assert.deepEqual([...ids].sort(), [...snapIds].sort());
});

test("PA-H archived Informationを除外", () => {
  const archived = PATIENT_A_FORM3_SKELETON_DEV_SNAPSHOT.informationCards
    .filter((c) => c.status === "archived")
    .map((c) => patientADevInformationCardId(c.id));
  assert.ok(archived.length > 0);
  for (const id of archived) {
    assert.equal(scene.graph.cards.some((c) => c.id === id), false);
  }
});

test("PA-I draft/archived Assessmentを除外", () => {
  const excluded = PATIENT_A_FORM3_SKELETON_DEV_SNAPSHOT.assessmentCards
    .filter((c) => c.status !== "reviewed");
  assert.ok(excluded.length > 0);
  for (const card of excluded) {
    assert.equal(
      scene.graph.cards.some((c) => c.id === `f3u_dev_${card.id}`),
      false,
    );
  }
});

test("PA-J dangling evidenceを作らない", () => {
  const cardIds = new Set(scene.graph.cards.map((c) => c.id));
  for (const rel of scene.evidenceRelations) {
    assert.ok(cardIds.has(rel.sourceCardId));
    assert.ok(cardIds.has(rel.targetCardId));
  }
  for (const conn of scene.graph.connections) {
    assert.ok(cardIds.has(conn.sourceCardId));
    assert.ok(cardIds.has(conn.targetCardId));
  }
});

test("PA-K builder deterministic", () => {
  const a = buildPatientAForm3Skeleton();
  const b = buildPatientAForm3Skeleton();
  assert.deepEqual(a, b);
});

test("PA-L array order independent", () => {
  const shuffled = clonePatientAForm3SkeletonSnapshot();
  shuffled.informationCards = shuffle(shuffled.informationCards);
  shuffled.assessmentCards = shuffle(shuffled.assessmentCards);
  const a = buildPatientAForm3Skeleton();
  const b = buildPatientAForm3Skeleton(shuffled);
  assert.deepEqual(a, b);
});

test("PA-M source Form3 snapshotをmutationしない", () => {
  const original = clonePatientAForm3SkeletonSnapshot();
  const firstInfo = PATIENT_A_FORM3_SKELETON_DEV_SNAPSHOT.informationCards[0]!;
  const beforeKeys = firstInfo.patternKeys.slice();
  const beforeEvidence =
    PATIENT_A_FORM3_SKELETON_DEV_SNAPSHOT.assessmentCards[0]!.evidenceInformationIds.slice();
  buildPatientAForm3Skeleton(PATIENT_A_FORM3_SKELETON_DEV_SNAPSHOT);
  assert.deepEqual(
    PATIENT_A_FORM3_SKELETON_DEV_SNAPSHOT.informationCards[0]!.patternKeys,
    beforeKeys,
  );
  assert.deepEqual(
    PATIENT_A_FORM3_SKELETON_DEV_SNAPSHOT.assessmentCards[0]!.evidenceInformationIds,
    beforeEvidence,
  );
  assert.equal(
    PATIENT_A_FORM3_SKELETON_DEV_SNAPSHOT.informationCards.length,
    original.informationCards.length,
  );
});

test("PA-N Knowledge = 0", () => {
  assert.equal(scene.stats.knowledge, 0);
  assert.equal(
    scene.graph.cards.some((c) => c.cardType === "knowledge"),
    false,
  );
});

test("PA-O Nursing Problem = 0", () => {
  assert.equal(scene.stats.nursingProblem, 0);
  assert.equal(
    scene.graph.cards.some((c) => c.cardType === "nursing_problem"),
    false,
  );
  assert.equal(scene.graph.nursingProblems.length, 0);
});

test("PA-P demo crossing/Junction/style cards = 0", () => {
  const ids = scene.graph.cards.map((c) => c.id).join(" ");
  assert.equal(/demo_|style_|skc|sk_/.test(ids), false);
  assert.equal(scene.kind, PATIENT_A_DEV_SKELETON_KIND);
  assert.ok(
    scene.graph.cardSources.every((s) =>
      (s.relation ?? "").includes(PATIENT_A_DEV_EVIDENCE_RELATION),
    ),
  );
});

test("PA-Q production DB write pathを呼ばない", () => {
  const builder = src("./buildPatientAForm3Skeleton.ts");
  const workspace = src(
    "../../../components/v2/relatedDiagram/RelatedDiagramPatientADevWorkspace.tsx",
  );
  const page = src("../../../app/dev/related-diagram-patient-a/page.tsx");
  for (const text of [builder, workspace, page]) {
    assert.equal(text.includes("insertForm3"), false);
    assert.equal(text.includes("updateForm3WithVersion"), false);
    assert.equal(text.includes("saveForm3Action"), false);
    assert.equal(text.includes("saveForm3V2Action"), false);
  }
  assert.equal(STUDENT_RELATED_DIAGRAM_UNSAVED_EDITING, false);
});

test("PA-R related_diagram_records write pathを呼ばない", () => {
  const builder = src("./buildPatientAForm3Skeleton.ts");
  const workspace = src(
    "../../../components/v2/relatedDiagram/RelatedDiagramPatientADevWorkspace.tsx",
  );
  const page = src("../../../app/dev/related-diagram-patient-a/page.tsx");
  for (const text of [builder, workspace, page]) {
    assert.equal(text.includes("insertRelatedDiagram"), false);
    assert.equal(text.includes("updateRelatedDiagram"), false);
    assert.equal(text.includes(".from(\"related_diagram_records\")"), false);
  }
});

test("classification hint does not invent NP / confirmed state", () => {
  const understandings = scene.graph.cards.filter(
    (c) => c.cardType === "understanding",
  );
  const sources = new Map(scene.graph.cardSources.map((s) => [s.cardId, s]));
  for (const card of understandings) {
    const source = sources.get(card.id);
    assert.ok(source);
    if (source!.sourceClassification === "problem") {
      assert.equal(card.state, "current");
      assert.ok((source!.relation ?? "").endsWith("classification_hint"));
    } else if (source!.sourceClassification === "risk") {
      assert.equal(card.state, "potential");
      assert.ok((source!.relation ?? "").endsWith("classification_hint"));
    } else {
      assert.ok((source!.relation ?? "").endsWith("type_contract_placeholder"));
    }
  }
});

test("seed scatter is not a single point and not pattern lanes", () => {
  const points = new Set(
    scene.graph.cards.map((c) => `${c.layout.x},${c.layout.y}`),
  );
  assert.ok(points.size >= 30);
  const builder = src("./buildPatientAForm3Skeleton.ts");
  assert.equal(builder.includes("patternKey as a lane"), true);
  assert.equal(/11列|pattern lane/.test(builder), false);
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
const arranged = arrangeRelatedDiagramScene({
  graph: scene.graph,
  routeState: beforeRoutes,
});
const afterGraph = arranged.kind === "applied" ? arranged.graph : scene.graph;
const afterRoutes =
  arranged.kind === "applied" ? arranged.routeState : beforeRoutes;
const afterTopo =
  arranged.kind === "applied" ? arranged.topology : undefined;
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

function componentStats(cards: { id: string }[], connections: { sourceCardId: string; targetCardId: string }[]) {
  const nodes = new Map(cards.map((c) => [c.id, [] as string[]]));
  for (const conn of connections) {
    nodes.get(conn.sourceCardId)?.push(conn.targetCardId);
    nodes.get(conn.targetCardId)?.push(conn.sourceCardId);
  }
  const seen = new Set<string>();
  let isolated = 0;
  let components = 0;
  let max = 0;
  for (const id of nodes.keys()) {
    if (seen.has(id)) continue;
    components += 1;
    const stack = [id];
    seen.add(id);
    let size = 0;
    while (stack.length) {
      const cur = stack.pop()!;
      size += 1;
      for (const n of nodes.get(cur) ?? []) {
        if (!seen.has(n)) {
          seen.add(n);
          stack.push(n);
        }
      }
    }
    if (size === 1) isolated += 1;
    if (size > max) max = size;
  }
  return { components, isolated, max };
}

const beforeComp = componentStats(scene.graph.cards, scene.graph.connections);
const afterComp = componentStats(afterGraph.cards, afterGraph.connections);
const moved = scene.graph.cards.filter((card) => {
  const next = afterGraph.cards.find((c) => c.id === card.id);
  return next != null && (next.layout.x !== card.layout.x || next.layout.y !== card.layout.y);
}).length;

test("Arrange metrics are observed without algorithm changes", () => {
  console.log(
    JSON.stringify(
      {
        arrangeKind: arranged.kind,
        notice: arranged.notice,
        before: {
          overlap: beforeQuality.overlapCount,
          bounds: beforeQuality.boundsHits,
          legend: beforeQuality.legendHits,
          cardThrough: beforeQuality.cardThrough,
          highway: beforeQuality.highwayCount,
          outerRail: beforeQuality.outerRailCount,
          totalLength: beforeQuality.totalLength,
          maxBends: beforeQuality.maxBendCount,
          totalBends: beforeRead.totalBends,
          components: beforeComp.components,
          isolated: beforeComp.isolated,
          maxComponent: beforeComp.max,
        },
        after: {
          overlap: afterQuality.overlapCount,
          bounds: afterQuality.boundsHits,
          legend: afterQuality.legendHits,
          cardThrough: afterQuality.cardThrough,
          highway: afterQuality.highwayCount,
          outerRail: afterQuality.outerRailCount,
          totalLength: afterQuality.totalLength,
          maxBends: afterQuality.maxBendCount,
          totalBends: afterRead.totalBends,
          components: afterComp.components,
          isolated: afterComp.isolated,
          maxComponent: afterComp.max,
          movedCardCount: moved,
        },
      },
      null,
      2,
    ),
  );
  assert.equal(afterGraph.cards.filter((c) => c.cardType === "knowledge").length, 0);
  assert.equal(afterGraph.cards.filter((c) => c.cardType === "nursing_problem").length, 0);
  assert.equal(afterGraph.connections.length, 35);
});

console.log(`${passed} passed`);
