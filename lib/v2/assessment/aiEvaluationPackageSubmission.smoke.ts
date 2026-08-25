/**
 * Smoke for AI evaluation package student_submission shaping.
 * Run: npx tsx lib/v2/assessment/aiEvaluationPackageSubmission.smoke.ts
 */
import assert from "node:assert/strict";
import { prepareAiEvaluationPackageStudentSubmission } from "./aiEvaluationPackageSubmission";
import type { AiAnonymizedAssessmentRecord } from "./aiExportAnonymize";
import type { AssessmentSubmissionScope } from "./types";

const base: AiAnonymizedAssessmentRecord = {
  schema_version: 1,
  export_kind: "assessment_submission",
  anonymous_ids: {
    case_id: "case_x",
    cycle_id: "cyc_x",
    milestone_id: "ms_x",
    submission_id: "sub_x",
  },
  meta: {
    timing_status: "on_time",
    submission_number: 1,
    submitted_at: "2026-08-20T05:30:00.000Z",
    evaluation_type: "formative",
    milestone_type: "form2",
    cycle_title: "課題1",
    milestone_title: "評価時点1",
  },
  included_artifacts: ["様式2", "様式3", "情報カード", "Evidenceリンク", "フィールド振り返り", "患者理解"],
  form2: { version: 1 },
  form3: {
    schemaVersion: 2,
    informationCards: [
      { id: "card_a", patternKey: "activity_exercise", content: "a" },
      { id: "card_b", patternKey: "sleep_rest", content: "b" },
    ],
    assessmentCards: [
      { id: "card_c", patternKey: "activity_exercise", interpretation: "c" },
    ],
  },
  information_cards: [{ id: "card_a", content: "a" }],
  evidence_links: [
    { id: "lnk_1", form2_field_key: "history.currentCondition", evidence_id: "card_a" },
  ],
  field_reflections: [
    {
      form2_field_key: "history.currentCondition",
      reflection_text: "考察",
      updated_at: "2026-08-20T04:50:00.000Z",
    },
  ],
  patient_understanding: {
    case_ref: "case_x",
    overview_text: "理解",
    updated_at: "2026-08-20T05:00:00.000Z",
  },
  source_versions: {
    form2: 1,
    form3: 1,
    patient_understanding: "2026-08-20T05:00:00.000Z",
  },
};

let n = 0;
function ok(name: string, fn: () => void) {
  fn();
  n += 1;
  console.log(`ok - ${name}`);
}

ok("evidence_links always emptied", () => {
  const out = prepareAiEvaluationPackageStudentSubmission(base, null);
  assert.deepEqual(out.evidence_links, []);
  assert.ok(!out.included_artifacts.includes("Evidenceリンク"));
});

ok("form2-only scope drops form3 and patient_understanding", () => {
  const scope: AssessmentSubmissionScope = {
    includeForm2: true,
    includeForm3: false,
    includeInformationCards: true,
    includeEvidenceLinks: true,
    includeFieldReflections: true,
    includePatientUnderstanding: false,
  };
  const out = prepareAiEvaluationPackageStudentSubmission(base, scope);
  assert.ok(out.form2);
  assert.equal(out.form3, null);
  assert.equal(out.patient_understanding, null);
  assert.equal(out.field_reflections.length, 1);
  assert.equal(out.information_cards.length, 1);
  assert.deepEqual(out.included_artifacts, [
    "様式2",
    "情報カード",
    "フィールド振り返り",
  ]);
});

ok("selected form3 patterns filter cards", () => {
  const scope: AssessmentSubmissionScope = {
    includeForm2: true,
    includeForm3: true,
    form3Scope: {
      mode: "selected_patterns",
      patternIds: ["activity_exercise"],
    },
    includeInformationCards: true,
    includeEvidenceLinks: true,
    includeFieldReflections: true,
    includePatientUnderstanding: true,
  };
  const out = prepareAiEvaluationPackageStudentSubmission(base, scope);
  const info = out.form3?.informationCards as Array<Record<string, unknown>>;
  assert.equal(info.length, 1);
  assert.equal(info[0].id, "card_a");
});

ok("archive keys retained", () => {
  const out = prepareAiEvaluationPackageStudentSubmission(base, null);
  assert.ok("evidence_links" in out);
  assert.ok("field_reflections" in out);
  assert.ok("information_cards" in out);
});

console.log(`\n${n} package submission smoke tests passed`);
