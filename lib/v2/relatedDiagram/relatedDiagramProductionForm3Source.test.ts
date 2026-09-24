/**
 * Production Related Diagram Form3 drawer source.
 * Run: ./node_modules/.bin/jiti lib/v2/relatedDiagram/relatedDiagramProductionForm3Source.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createEmptyForm3V2 } from "../../form3/v2/form3V2Factory";
import type {
  Form3AssessmentCardV2,
  Form3DataV2,
  Form3InformationCardV2,
} from "../../form3/v2/form3V2Types";
import { SCHIZOPHRENIA_FORM3_FIXTURE_RECORD_ID } from "./fixtures/form3AssessmentSourceFixture";
import { studentForm3ReadModelFromRecord } from "./studentForm3RelatedDiagramBoundary";

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

const TS = "2026-09-24T00:00:00.000Z";

function info(
  id: string,
  content: string,
  patternKeys: Form3InformationCardV2["patternKeys"],
): Form3InformationCardV2 {
  return {
    id,
    content,
    soType: "O",
    sourceType: "observation",
    patternKeys,
    order: 0,
    status: "active",
    createdAt: TS,
    updatedAt: TS,
  };
}

function assess(
  id: string,
  interpretation: string,
  patternKey: Form3AssessmentCardV2["patternKey"],
): Form3AssessmentCardV2 {
  return {
    id,
    interpretation,
    classification: "problem",
    evidenceInformationIds: [],
    needMoreInformation: "",
    patternKey,
    order: 0,
    status: "reviewed",
    createdAt: TS,
    updatedAt: TS,
  };
}

function payloadA(): Form3DataV2 {
  const base = createEmptyForm3V2("A");
  return {
    ...base,
    informationCards: [
      info("info-a-nutrition", "学生Aの栄養情報", ["nutritional_metabolic"]),
      info("info-a-health", "学生Aの健康知覚", ["health_perception_management"]),
    ],
    assessmentCards: [
      assess("assess-a-nutrition", "学生Aの栄養アセスメント", "nutritional_metabolic"),
    ],
  };
}

function payloadB(): Form3DataV2 {
  const base = createEmptyForm3V2("A");
  return {
    ...base,
    informationCards: [
      info("info-b-sleep", "学生Bの睡眠情報", ["sleep_rest"]),
    ],
    assessmentCards: [
      assess("assess-b-sleep", "学生Bの睡眠アセスメント", "sleep_rest"),
    ],
  };
}

test("A Production student Form3 record shows that student's Information, not fixture", () => {
  const model = studentForm3ReadModelFromRecord({
    row: { id: "rec-a", version: 3, payload: payloadA() },
  });
  assert.equal(model.form3RecordId, "rec-a");
  assert.equal(
    model.informations.some((row) => row.content === "学生Aの栄養情報"),
    true,
  );
  assert.equal(
    model.informations.some((row) => row.form3RecordId === SCHIZOPHRENIA_FORM3_FIXTURE_RECORD_ID),
    false,
  );
  assert.notEqual(model.form3RecordId, SCHIZOPHRENIA_FORM3_FIXTURE_RECORD_ID);
});

test("B Assessment is the same student's data", () => {
  const model = studentForm3ReadModelFromRecord({
    row: { id: "rec-a", version: 3, payload: payloadA() },
  });
  assert.equal(
    model.assessments.some((row) => row.assessmentText === "学生Aの栄養アセスメント"),
    true,
  );
  assert.equal(
    model.assessments.some((row) => row.form3RecordId === SCHIZOPHRENIA_FORM3_FIXTURE_RECORD_ID),
    false,
  );
});

test("C Gordon pattern filtering keeps cards on their tagged patterns", () => {
  const model = studentForm3ReadModelFromRecord({
    row: { id: "rec-a", version: 3, payload: payloadA() },
  });
  const nutrition = model.patterns.find((p) => p.patternId === "nutritional_metabolic");
  const sleep = model.patterns.find((p) => p.patternId === "sleep_rest");
  const health = model.patterns.find((p) => p.patternId === "health_perception_management");
  assert.ok(nutrition);
  assert.ok(sleep);
  assert.ok(health);
  assert.equal(nutrition.informations.length, 1);
  assert.equal(nutrition.assessments.length, 1);
  assert.equal(nutrition.informations[0]?.content, "学生Aの栄養情報");
  assert.equal(sleep.informations.length, 0);
  assert.equal(sleep.assessments.length, 0);
  assert.equal(health.informations.length, 1);
  assert.equal(health.assessments.length, 0);
});

test("D missing Form3 record is empty and is not the DEV fixture", () => {
  const model = studentForm3ReadModelFromRecord({ row: null });
  assert.equal(model.informations.length, 0);
  assert.equal(model.assessments.length, 0);
  assert.equal(model.form3RecordId, "");
  assert.notEqual(model.form3RecordId, SCHIZOPHRENIA_FORM3_FIXTURE_RECORD_ID);
  assert.ok(model.patterns.every((p) => p.informations.length === 0));
  assert.ok(model.patterns.every((p) => p.assessments.length === 0));
});

test("E pattern without cards stays empty for the drawer message", () => {
  const model = studentForm3ReadModelFromRecord({
    row: { id: "rec-a", version: 3, payload: payloadA() },
  });
  const empty = model.patterns.find((p) => p.patternId === "elimination");
  assert.ok(empty);
  assert.equal(empty.informations.length, 0);
  assert.equal(empty.assessments.length, 0);
  const drawer = src("../../../components/v2/relatedDiagram/RelatedDiagramForm3Drawer.tsx");
  assert.ok(drawer.includes("このパターンにタグされた情報はありません"));
  assert.ok(drawer.includes("このパターンにはAssessmentがありません"));
});

test("F student A and student B sources do not mix", () => {
  const a = studentForm3ReadModelFromRecord({
    row: { id: "rec-a", version: 1, payload: payloadA() },
  });
  const b = studentForm3ReadModelFromRecord({
    row: { id: "rec-b", version: 1, payload: payloadB() },
  });
  assert.equal(a.form3RecordId, "rec-a");
  assert.equal(b.form3RecordId, "rec-b");
  assert.equal(
    a.informations.some((row) => row.content.includes("学生B")),
    false,
  );
  assert.equal(
    b.informations.some((row) => row.content.includes("学生A")),
    false,
  );
  assert.equal(
    a.assessments.some((row) => row.assessmentText.includes("学生B")),
    false,
  );
  assert.equal(
    b.assessments.some((row) => row.assessmentText.includes("学生A")),
    false,
  );
});

test("G Production source path does not call the DEV fixture builder", () => {
  const page = src("../../../app/v2/student/related-diagram/page.tsx");
  const editor = src("../../../components/v2/relatedDiagram/RelatedDiagramStudentEditor.tsx");
  const boundary = src("./studentForm3RelatedDiagramBoundary.ts");
  assert.ok(page.includes("getForm3"));
  assert.ok(page.includes("studentForm3ReadModelFromRecord"));
  assert.ok(page.includes("createServerSupabaseClient"));
  assert.ok(page.includes('requireRole("student")'));
  assert.equal(page.includes("buildSchizophreniaForm3ReadModel"), false);
  assert.equal(page.includes("SERVICE_ROLE"), false);
  assert.equal(page.includes("createAdminSupabaseClient"), false);
  assert.equal(editor.includes("buildSchizophreniaForm3ReadModel"), false);
  assert.equal(boundary.includes("buildSchizophreniaForm3ReadModel"), false);
  assert.ok(boundary.includes("mapStudentForm3ToRelatedDiagramSources"));
});

test("H DEV workspace still uses the schizophrenia fixture when no model is passed", () => {
  const ws = src("../../../components/v2/relatedDiagram/RelatedDiagramDevFixtureWorkspace.tsx");
  const devAuth = src("../../../app/v2/dev/related-diagram-slice1/page.tsx");
  const devUnauth = src("../../../app/dev/related-diagram-slice1/page.tsx");
  assert.ok(ws.includes("buildSchizophreniaForm3ReadModel"));
  assert.ok(ws.includes("form3ModelProp ?? buildSchizophreniaForm3ReadModel()"));
  assert.ok(devAuth.includes("<RelatedDiagramDevFixtureWorkspace />"));
  assert.ok(devUnauth.includes("<RelatedDiagramDevFixtureWorkspace />"));
  assert.equal(devAuth.includes("buildSchizophreniaForm3ReadModel"), false);
  assert.equal(devUnauth.includes("buildSchizophreniaForm3ReadModel"), false);
});

test("invalid payload is empty, not the DEV fixture", () => {
  const model = studentForm3ReadModelFromRecord({
    row: { id: "rec-bad", version: 1, payload: { schemaVersion: 1 } },
  });
  assert.equal(model.informations.length, 0);
  assert.equal(model.assessments.length, 0);
  assert.equal(model.form3RecordId, "rec-bad");
  assert.notEqual(model.form3RecordId, SCHIZOPHRENIA_FORM3_FIXTURE_RECORD_ID);
});

console.log(`\n${passed} passed`);
