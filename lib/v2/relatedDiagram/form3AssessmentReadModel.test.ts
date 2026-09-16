/**
 * Slice 2B-1 Form3 read model + 11-pattern mapping tests.
 * Run: npx tsx lib/v2/relatedDiagram/form3AssessmentReadModel.test.ts
 */

import assert from "node:assert/strict";
import { FORM3_PATTERN_ORDER, createEmptyForm3 } from "../../form3/form3Types";
import {
  RELATED_DIAGRAM_FORM3_PATTERN_LABELS,
  form3AssessmentOriginKey,
  form3InformationOriginKey,
  form3PatternCircledLabel,
  form3PatternTabLabel,
  initialUnderstandingStateFromForm3Classification,
  mapForm3JudgmentToCardState,
  mapUnknownForm3PayloadToReadModel,
} from "./form3AssessmentReadModel";
import {
  SCHIZOPHRENIA_FORM3_ASSESSMENT_CARDS,
  SCHIZOPHRENIA_FORM3_FIXTURE_RECORD_ID,
  SCHIZOPHRENIA_FORM3_INFORMATION_CARDS,
  buildSchizophreniaForm3ReadModel,
  buildSchizophreniaForm3V2Fixture,
} from "./fixtures/form3AssessmentSourceFixture";
import { studentRelatedDiagramForm3ExpansionEnabled } from "./studentForm3RelatedDiagramBoundary";

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

test("maps all 11 Gordon patterns in FORM3_PATTERN_ORDER", () => {
  const model = buildSchizophreniaForm3ReadModel();
  assert.equal(model.patterns.length, 11);
  assert.deepEqual(
    model.patterns.map((p) => p.patternId),
    [...FORM3_PATTERN_ORDER],
  );
  assert.equal(
    form3PatternCircledLabel("health_perception_management"),
    "① 健康知覚・健康管理",
  );
  assert.equal(RELATED_DIAGRAM_FORM3_PATTERN_LABELS.value_belief, "価値・信念");
  assert.equal(form3PatternTabLabel("health_perception_management"), "①健康知覚");
  assert.equal(form3PatternTabLabel("sleep_rest"), "⑤睡眠");
});

test("Information is filtered by patternKeys tags, not ownership", () => {
  const model = buildSchizophreniaForm3ReadModel();
  assert.ok(model.informations.length >= 3);
  assert.ok(model.informations.some((i) => i.soType === "S"));
  assert.ok(model.informations.some((i) => i.soType === "O"));
  const multi = model.informations.find((i) => i.patternKeys.length > 1);
  assert.ok(multi);
  const taggedGroups = model.patterns.filter((p) =>
    p.informations.some((i) => i.informationId === multi!.informationId),
  );
  assert.equal(taggedGroups.length, multi!.patternKeys.length);
  assert.equal(
    form3InformationOriginKey(multi!),
    `info:${multi!.form3RecordId}::${multi!.informationId}`,
  );
  assert.equal(
    SCHIZOPHRENIA_FORM3_INFORMATION_CARDS.some((c) =>
      c.content.includes("ドパミン"),
    ),
    false,
  );
});

test("uses Form3 v2 assessment card ids as stable identity", () => {
  const model = buildSchizophreniaForm3ReadModel();
  assert.ok(model.assessments.length >= 6);
  for (const row of model.assessments) {
    assert.ok(row.assessmentId.startsWith("f3a-dev-"));
    assert.equal(row.form3RecordId, SCHIZOPHRENIA_FORM3_FIXTURE_RECORD_ID);
    assert.equal(
      form3AssessmentOriginKey(row),
      `${row.form3RecordId}::${row.patternId}::${row.assessmentId}`,
    );
  }
  const fixtureIds = SCHIZOPHRENIA_FORM3_ASSESSMENT_CARDS.map((c) => c.id);
  assert.deepEqual(
    model.assessments.map((a) => a.assessmentId).sort(),
    fixtureIds.slice().sort(),
  );
});

test("preserves Form3 current/potential equivalents and does not invent the rest", () => {
  assert.deepEqual(mapForm3JudgmentToCardState("problem"), {
    state: "current",
    mapping: "explicit_current",
  });
  assert.deepEqual(mapForm3JudgmentToCardState("risk"), {
    state: "potential",
    mapping: "explicit_potential",
  });
  for (const judgment of [
    "strength",
    "functioning_normally",
    "insufficient_information",
    null,
  ] as const) {
    assert.deepEqual(mapForm3JudgmentToCardState(judgment), {
      state: "current",
      mapping: "schema_default_current",
    });
  }
  const model = buildSchizophreniaForm3ReadModel();
  const problem = model.assessments.find((a) => a.judgment === "problem");
  const risk = model.assessments.find((a) => a.judgment === "risk");
  const strength = model.assessments.find((a) => a.judgment === "strength");
  assert.equal(problem?.state, "current");
  assert.equal(problem?.stateMapping, "explicit_current");
  assert.equal(risk?.state, "potential");
  assert.equal(risk?.stateMapping, "explicit_potential");
  assert.equal(strength?.state, "current");
  assert.equal(strength?.stateMapping, "schema_default_current");
});

test("fixture covers ≥3 patterns, ≥6 assessments, current and potential", () => {
  const model = buildSchizophreniaForm3ReadModel();
  const patternsWithAssessments = model.patterns.filter(
    (p) => p.assessments.length > 0,
  );
  assert.ok(patternsWithAssessments.length >= 3);
  assert.ok(model.assessments.length >= 6);
  assert.ok(model.assessments.some((a) => a.state === "current"));
  assert.ok(model.assessments.some((a) => a.state === "potential"));
  assert.ok(model.assessments.some((a) => a.hasEvidence));
  const payload = buildSchizophreniaForm3V2Fixture();
  assert.equal(
    payload.assessmentCards.some((c) => c.interpretation.includes("ドパミン")),
    false,
  );
});

test("compose initial state uses Form3 only as a hint", () => {
  assert.equal(
    initialUnderstandingStateFromForm3Classification("problem"),
    "current",
  );
  assert.equal(
    initialUnderstandingStateFromForm3Classification("risk"),
    "potential",
  );
  for (const judgment of [
    "strength",
    "functioning_normally",
    "insufficient_information",
    null,
  ] as const) {
    assert.equal(
      initialUnderstandingStateFromForm3Classification(judgment),
      null,
    );
  }
});

test("rejects v1 Form3 because it has no stable assessment identity", () => {
  const v1 = createEmptyForm3("A");
  const result = mapUnknownForm3PayloadToReadModel({
    form3RecordId: "rec-1",
    sourceVersion: 1,
    payload: v1,
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, "no_stable_assessment_identity");
  }
});

test("student expansion remains disabled in Slice 2B-1", () => {
  assert.equal(studentRelatedDiagramForm3ExpansionEnabled(), false);
});

console.log(`\n${passed} passed`);
