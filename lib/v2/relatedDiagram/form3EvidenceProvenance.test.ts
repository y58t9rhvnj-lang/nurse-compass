/**
 * Form3 Evidence Provenance Contract V1 (EP-A…T).
 * Run: ./node_modules/.bin/jiti lib/v2/relatedDiagram/form3EvidenceProvenance.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createEmptyForm3V2 } from "../../form3/v2/form3V2Factory";
import type { Form3DataV2 } from "../../form3/v2/form3V2Types";
import {
  mapForm3V2ToRelatedDiagramReadModel,
  normalizeForm3EvidenceInformationIds,
} from "./form3AssessmentReadModel";
import {
  deriveForm3EvidenceCandidates,
} from "./form3EvidenceCandidates";
import {
  PATIENT_A_FORM3_SKELETON_DEV_SNAPSHOT,
  clonePatientAForm3SkeletonSnapshot,
} from "./fixtures/patientAForm3SkeletonSnapshot";
import { buildSchizophreniaForm3ReadModel } from "./fixtures/form3AssessmentSourceFixture";
import {
  buildInformationCardFromForm3,
  buildUnderstandingCardFromAssessmentSelection,
  createAssessmentComposeDraft,
  insertCardEntity,
  isForm3InformationAlreadyOnCanvas,
} from "./form3ToUnderstandingCard";
import { createEmptySemanticGraph } from "./semanticGraph";
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

function patientAForm3Payload(): Form3DataV2 {
  const snap = clonePatientAForm3SkeletonSnapshot();
  const empty = createEmptyForm3V2("A");
  return {
    ...empty,
    patientId: snap.patientId,
    informationCards: snap.informationCards,
    assessmentCards: snap.assessmentCards,
    updatedAt: snap.updatedAt,
  };
}

function patientAReadModel() {
  return mapForm3V2ToRelatedDiagramReadModel({
    form3RecordId: "patient-a-dev-snapshot",
    sourceVersion: 34,
    payload: patientAForm3Payload(),
  });
}

function sliceOf(
  assessmentText: string,
  selectedText: string,
) {
  const selectionStart = assessmentText.indexOf(selectedText);
  assert.ok(selectionStart >= 0, selectedText);
  return {
    selectedText,
    selectionStart,
    selectionEnd: selectionStart + selectedText.length,
  };
}

const schizo = buildSchizophreniaForm3ReadModel();
const problem = schizo.assessments.find((row) => row.judgment === "problem")!;
const patientA = patientAReadModel();
const elimination = patientA.assessments.find(
  (row) => row.assessmentId === "047e9cd1-203b-461c-b04d-a78e136c4826",
)!;

test("EP-A Assessment read modelにcandidate IDsが残る", () => {
  assert.ok(problem.evidenceInformationIds.length > 0);
  assert.deepEqual(problem.evidenceInformationIds, ["info-sleep-hallucination"]);
  assert.ok(elimination.evidenceInformationIds.length > 0);
});

test("EP-B hasEvidenceがcandidate IDsからderiveされる", () => {
  assert.equal(problem.hasEvidence, problem.evidenceInformationIds.length > 0);
  const empty = schizo.assessments.find(
    (row) => row.evidenceInformationIds.length === 0,
  );
  if (empty) assert.equal(empty.hasEvidence, false);
  assert.equal(elimination.hasEvidence, true);
});

test("EP-C Information ID identity保持", () => {
  for (const id of elimination.evidenceInformationIds) {
    const info = patientA.informations.find((row) => row.informationId === id);
    assert.ok(info);
    assert.equal(info!.informationId, id);
  }
});

test("EP-D Understanding composeでcandidate IDs継承", () => {
  const selection = sliceOf(problem.assessmentText, "夜間の幻聴");
  const entity = buildUnderstandingCardFromAssessmentSelection({
    source: problem,
    selection,
    editedText: selection.selectedText,
    state: "current",
    layout: { x: 10, y: 10, zIndex: 1 },
  });
  assert.deepEqual(
    entity.sources[0]?.candidateEvidenceInformationIds,
    problem.evidenceInformationIds,
  );
});

test("EP-E selected range provenance維持", () => {
  const selection = sliceOf(problem.assessmentText, "夜間の幻聴");
  const entity = buildUnderstandingCardFromAssessmentSelection({
    source: problem,
    selection,
    editedText: "短い表現",
    state: "current",
    layout: { x: 10, y: 10, zIndex: 1 },
  });
  const source = entity.sources[0]!;
  assert.equal(source.selectedText, "夜間の幻聴");
  assert.equal(source.selectionStart, selection.selectionStart);
  assert.equal(source.selectionEnd, selection.selectionEnd);
  assert.equal(source.sourceExcerpt, problem.assessmentText);
  assert.equal(entity.card.text, "短い表現");
});

test("EP-F 1 Assessment→2 Understandingでcandidate setが両方に継承", () => {
  const a = sliceOf(elimination.assessmentText, "便秘は再発しうる");
  const b = sliceOf(elimination.assessmentText, "抗精神病薬・催眠薬");
  const u1 = buildUnderstandingCardFromAssessmentSelection({
    source: elimination,
    selection: a,
    editedText: a.selectedText,
    state: "potential",
    layout: { x: 10, y: 10, zIndex: 1 },
  });
  const u2 = buildUnderstandingCardFromAssessmentSelection({
    source: elimination,
    selection: b,
    editedText: b.selectedText,
    state: "potential",
    layout: { x: 40, y: 80, zIndex: 2 },
  });
  assert.deepEqual(
    u1.sources[0]?.candidateEvidenceInformationIds,
    elimination.evidenceInformationIds,
  );
  assert.deepEqual(
    u2.sources[0]?.candidateEvidenceInformationIds,
    elimination.evidenceInformationIds,
  );
  assert.equal(elimination.evidenceInformationIds.length, 5);
});

test("EP-G candidate setはsource array mutationの影響を受けない", () => {
  const payload = patientAForm3Payload();
  const card = payload.assessmentCards.find(
    (row) => row.id === elimination.assessmentId,
  )!;
  const before = [...card.evidenceInformationIds];
  const model = mapForm3V2ToRelatedDiagramReadModel({
    form3RecordId: "patient-a-dev-snapshot",
    sourceVersion: 34,
    payload,
  });
  const source = model.assessments.find(
    (row) => row.assessmentId === elimination.assessmentId,
  )!;
  card.evidenceInformationIds.push("mutated-id");
  assert.deepEqual(source.evidenceInformationIds, before);
  assert.equal(source.evidenceInformationIds.includes("mutated-id"), false);
  const entity = buildUnderstandingCardFromAssessmentSelection({
    source,
    selection: sliceOf(source.assessmentText, "便秘は再発しうる"),
    editedText: "便秘は再発しうる",
    state: "potential",
    layout: { x: 1, y: 1, zIndex: 1 },
  });
  source.evidenceInformationIds.push("compose-mutated");
  assert.equal(
    entity.sources[0]!.candidateEvidenceInformationIds!.includes("compose-mutated"),
    false,
  );
});

test("EP-H candidate→canvas Information照合はID provenance", () => {
  const info = patientA.informations.find(
    (row) => row.informationId === elimination.evidenceInformationIds[0],
  )!;
  let graph = insertCardEntity(
    createEmptySemanticGraph(),
    buildInformationCardFromForm3({
      source: info,
      layout: { x: 10, y: 10, zIndex: 1 },
    }),
  );
  const derived = deriveForm3EvidenceCandidates({
    form3RecordId: elimination.form3RecordId,
    candidateEvidenceInformationIds: elimination.evidenceInformationIds,
    informations: patientA.informations,
    graph,
  });
  assert.equal(derived.alreadyPresent[0]?.informationId, info.informationId);
  assert.equal(derived.alreadyPresent[0]?.canvasCardId, `f3i_${info.informationId}`);
  assert.equal(derived.available.length, 4);
});

test("EP-I 本文一致を使わない", () => {
  const helper = src("./form3EvidenceCandidates.ts");
  assert.equal(helper.includes(".content ==="), false);
  assert.equal(helper.includes("card.text"), false);
  assert.ok(helper.includes("form3_information_card"));
  assert.ok(helper.includes("informationId"));
});

test("EP-J 同じInformationをduplicateしない", () => {
  const info = patientA.informations.find(
    (row) => row.informationId === elimination.evidenceInformationIds[0],
  )!;
  let graph = insertCardEntity(
    createEmptySemanticGraph(),
    buildInformationCardFromForm3({
      source: info,
      layout: { x: 10, y: 10, zIndex: 1 },
    }),
  );
  assert.equal(
    isForm3InformationAlreadyOnCanvas(graph, {
      form3RecordId: info.form3RecordId,
      informationId: info.informationId,
    }),
    true,
  );
  graph = insertCardEntity(
    graph,
    buildInformationCardFromForm3({
      source: info,
      layout: { x: 80, y: 80, zIndex: 2 },
    }),
  );
  assert.equal(
    graph.cards.filter((card) => card.cardType === "information").length,
    1,
  );
});

test("EP-K 未追加candidateを既存pathで追加可能", () => {
  const info = patientA.informations.find(
    (row) => row.informationId === elimination.evidenceInformationIds[1],
  )!;
  let graph = createEmptySemanticGraph();
  const derivedBefore = deriveForm3EvidenceCandidates({
    form3RecordId: elimination.form3RecordId,
    candidateEvidenceInformationIds: elimination.evidenceInformationIds,
    informations: patientA.informations,
    graph,
  });
  assert.ok(
    derivedBefore.available.some((row) => row.informationId === info.informationId),
  );
  graph = insertCardEntity(
    graph,
    buildInformationCardFromForm3({
      source: info,
      layout: { x: 10, y: 10, zIndex: 1 },
    }),
  );
  const derivedAfter = deriveForm3EvidenceCandidates({
    form3RecordId: elimination.form3RecordId,
    candidateEvidenceInformationIds: elimination.evidenceInformationIds,
    informations: patientA.informations,
    graph,
  });
  assert.ok(
    derivedAfter.alreadyPresent.some(
      (row) => row.informationId === info.informationId,
    ),
  );
  assert.equal(graph.cards[0]?.text, info.content);
  assert.equal(graph.cardSources[0]?.sourceSoType, info.soType);
  assert.deepEqual(graph.cardSources[0]?.sourcePatterns, info.patternKeys);
});

test("EP-L 追加済みcandidateを再追加しない", () => {
  const info = patientA.informations.find(
    (row) => row.informationId === elimination.evidenceInformationIds[0],
  )!;
  const graph = insertCardEntity(
    createEmptySemanticGraph(),
    buildInformationCardFromForm3({
      source: info,
      layout: { x: 10, y: 10, zIndex: 1 },
    }),
  );
  const derived = deriveForm3EvidenceCandidates({
    form3RecordId: elimination.form3RecordId,
    candidateEvidenceInformationIds: elimination.evidenceInformationIds,
    informations: patientA.informations,
    graph,
  });
  assert.equal(
    derived.alreadyPresent.find((row) => row.informationId === info.informationId)
      ?.status,
    "already_present",
  );
});

test("EP-M candidate追加でRD Connection 0", () => {
  let graph = createEmptySemanticGraph();
  for (const id of elimination.evidenceInformationIds) {
    const info = patientA.informations.find((row) => row.informationId === id);
    if (!info) continue;
    graph = insertCardEntity(
      graph,
      buildInformationCardFromForm3({
        source: info,
        layout: { x: 10, y: 10, zIndex: graph.cards.length + 1 },
      }),
    );
  }
  assert.ok(graph.cards.length >= 5);
  assert.equal(graph.connections.length, 0);
});

test("EP-N composeでもRD Connection 0", () => {
  const u1 = buildUnderstandingCardFromAssessmentSelection({
    source: elimination,
    selection: sliceOf(elimination.assessmentText, "便秘は再発しうる"),
    editedText: "便秘は再発しうる",
    state: "potential",
    layout: { x: 10, y: 10, zIndex: 1 },
  });
  const u2 = buildUnderstandingCardFromAssessmentSelection({
    source: elimination,
    selection: sliceOf(elimination.assessmentText, "抗精神病薬・催眠薬"),
    editedText: "抗精神病薬・催眠薬",
    state: "potential",
    layout: { x: 40, y: 80, zIndex: 2 },
  });
  let graph = insertCardEntity(createEmptySemanticGraph(), u1);
  graph = insertCardEntity(graph, u2);
  assert.equal(graph.cards.length, 2);
  assert.equal(graph.connections.length, 0);
});

test("EP-O classification/state contract不変", () => {
  const draft = createAssessmentComposeDraft(
    elimination,
    sliceOf(elimination.assessmentText, "便秘は再発しうる"),
  );
  assert.equal(elimination.judgment, "risk");
  assert.equal(draft.state, "potential");
  const strength = schizo.assessments.find((row) => row.judgment === "strength")!;
  assert.equal(createAssessmentComposeDraft(
    strength,
    sliceOf(strength.assessmentText, strength.assessmentText.slice(0, 8)),
  ).state, null);
});

test("EP-P Patient A reviewed 10でcandidate refs=35", () => {
  const reviewed = PATIENT_A_FORM3_SKELETON_DEV_SNAPSHOT.assessmentCards.filter(
    (card) => card.status === "reviewed",
  );
  assert.equal(reviewed.length, 10);
  const activeIds = new Set(
    patientA.informations.map((row) => row.informationId),
  );
  let refs = 0;
  for (const row of patientA.assessments.filter((item) =>
    reviewed.some((card) => card.id === item.assessmentId),
  )) {
    refs += row.evidenceInformationIds.filter((id) => activeIds.has(id)).length;
  }
  assert.equal(refs, 35);
});

test("EP-Q 排泄Assessment candidate=5", () => {
  assert.equal(elimination.patternId, "elimination");
  assert.equal(elimination.evidenceInformationIds.length, 5);
});

test("EP-R Knowledge/NPへ影響なし", () => {
  const entity = buildUnderstandingCardFromAssessmentSelection({
    source: elimination,
    selection: sliceOf(elimination.assessmentText, "便秘は再発しうる"),
    editedText: "便秘は再発しうる",
    state: "potential",
    layout: { x: 10, y: 10, zIndex: 1 },
  });
  const graph = insertCardEntity(createEmptySemanticGraph(), entity);
  assert.equal(graph.cards.some((card) => card.cardType === "knowledge"), false);
  assert.equal(
    graph.cards.some((card) => card.cardType === "nursing_problem"),
    false,
  );
  assert.equal(graph.nursingProblems.length, 0);
  const helper = src("./form3EvidenceCandidates.ts");
  const compose = src("./form3ToUnderstandingCard.ts");
  assert.equal(helper.includes("nursing_problem"), false);
  assert.equal(compose.includes("createNursingProblem"), false);
});

test("EP-S array order independent where appropriate", () => {
  const shuffled = patientAForm3Payload();
  shuffled.assessmentCards = [...shuffled.assessmentCards].reverse();
  shuffled.informationCards = [...shuffled.informationCards].reverse();
  const a = patientAReadModel();
  const b = mapForm3V2ToRelatedDiagramReadModel({
    form3RecordId: "patient-a-dev-snapshot",
    sourceVersion: 34,
    payload: shuffled,
  });
  const elimA = a.assessments.find(
    (row) => row.assessmentId === elimination.assessmentId,
  )!;
  const elimB = b.assessments.find(
    (row) => row.assessmentId === elimination.assessmentId,
  )!;
  assert.deepEqual(elimB.evidenceInformationIds, elimA.evidenceInformationIds);
  assert.deepEqual(
    normalizeForm3EvidenceInformationIds(["b", "a", "b", "", "a"]),
    ["b", "a"],
  );
});

test("EP-T student editing flag false", () => {
  assert.equal(STUDENT_RELATED_DIAGRAM_UNSAVED_EDITING, false);
  const boundary = src("./studentForm3RelatedDiagramBoundary.ts");
  assert.ok(boundary.includes("STUDENT_RELATED_DIAGRAM_UNSAVED_EDITING = false"));
});

test("dangling evidence IDs stay and are missing, not rewritten", () => {
  const empty = createEmptyForm3V2("A");
  const payload: Form3DataV2 = {
    ...empty,
    informationCards: [
      {
        id: "known-info",
        content: "既知",
        soType: "O",
        sourceType: "observation",
        patternKeys: ["elimination"],
        order: 0,
        status: "active",
        createdAt: empty.updatedAt || "2026-09-21T00:00:00.000Z",
        updatedAt: empty.updatedAt || "2026-09-21T00:00:00.000Z",
      },
    ],
    assessmentCards: [
      {
        id: "assess-dangle",
        interpretation: "dangling evidence を含むアセスメント。",
        classification: "problem",
        evidenceInformationIds: ["known-info", "ghost-id", "known-info"],
        needMoreInformation: "",
        patternKey: "elimination",
        order: 0,
        status: "reviewed",
        createdAt: empty.updatedAt,
        updatedAt: empty.updatedAt,
      },
    ],
  };
  const model = mapForm3V2ToRelatedDiagramReadModel({
    form3RecordId: "rec-dangle",
    sourceVersion: 1,
    payload,
  });
  const row = model.assessments[0]!;
  assert.deepEqual(row.evidenceInformationIds, ["known-info", "ghost-id"]);
  const derived = deriveForm3EvidenceCandidates({
    form3RecordId: "rec-dangle",
    candidateEvidenceInformationIds: row.evidenceInformationIds,
    informations: model.informations,
    graph: createEmptySemanticGraph(),
  });
  assert.equal(derived.missing[0]?.informationId, "ghost-id");
  assert.equal(derived.available[0]?.informationId, "known-info");
});

test("UI does not create connections", () => {
  const drawer = src(
    "../../../components/v2/relatedDiagram/RelatedDiagramForm3Drawer.tsx",
  );
  const workspace = src(
    "../../../components/v2/relatedDiagram/RelatedDiagramDevFixtureWorkspace.tsx",
  );
  assert.equal(drawer.includes("upsertConnection"), false);
  assert.equal(drawer.includes("relationType"), false);
  assert.ok(workspace.includes("handleAddInformation"));
  assert.ok(workspace.includes("graph={graph}"));
});

console.log(`${passed} passed`);
