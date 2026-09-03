/**
 * Form3 AI評価 S3.1: case_context excluded + selected instruction。
 * Run: npx tsx lib/v2/assessment/aiEvaluationForm3S31HumanReviewFixes.test.ts
 */
import assert from "node:assert/strict";
import { createAiAnonymousIdMapper } from "./aiExportAnonymize";
import type { AiAnonymizedAssessmentRecord } from "./aiExportAnonymize";
import {
  assertAiEvaluationPackageShape,
  buildAiEvaluationPackage,
  FORM2_AI_EVAL_EXCLUDED_FROM_EVALUATION,
  FORM3_AI_EVAL_EXCLUDED_FROM_EVALUATION,
} from "./aiEvaluationPackageBuilder";
import { prepareAiEvaluationPackageStudentSubmission } from "./aiEvaluationPackageSubmission";
import {
  FORM2_POLICY_PHRASES_FORBIDDEN_IN_FORM3,
} from "./aiEvaluationPackageStaticContentForm3";
import { FORM3_AI_EVAL_REQUIRED_SCOPE } from "./submissionScope";
import type { AssessmentSubmissionScope } from "./types";
import type { Form3PatternKey } from "@/lib/form3/form3Types";

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

function form3Fixture(): Record<string, unknown> {
  return {
    schemaVersion: 2,
    informationCards: [
      { id: "info_sleep", patternKeys: ["sleep_rest"], content: "睡眠（架空）" },
      {
        id: "info_multi",
        patternKeys: ["sleep_rest", "activity_exercise"],
        content: "横断（架空）",
      },
      {
        id: "info_nutrition",
        patternKeys: ["nutritional_metabolic"],
        content: "栄養（架空）",
      },
    ],
    assessmentCards: [
      { id: "assess_sleep", patternKey: "sleep_rest", interpretation: "睡眠解釈" },
      {
        id: "assess_activity",
        patternKey: "activity_exercise",
        interpretation: "活動解釈",
      },
    ],
    finalForm: {
      sleep_rest: {
        informationSO: "so",
        interpretationAnalysisCareNeed: "care",
      },
      activity_exercise: {
        informationSO: "so2",
        interpretationAnalysisCareNeed: "care2",
      },
      cognitive_perceptual: {
        informationSO: "so3",
        interpretationAnalysisCareNeed: "care3",
      },
    },
    workspacePatternFlags: {
      sleep_rest: true,
      activity_exercise: true,
      cognitive_perceptual: true,
    },
  };
}

function record(milestoneType: string): AiAnonymizedAssessmentRecord {
  return {
    schema_version: 1,
    export_kind: "assessment_submission",
    anonymous_ids: {
      case_id: "c",
      cycle_id: "y",
      milestone_id: "m",
      submission_id: "s",
    },
    meta: {
      timing_status: "on_time",
      submission_number: 1,
      submitted_at: "2026-09-02T09:00:00.000Z",
      evaluation_type:
        milestoneType === "form3_complete" ? "summative" : "formative",
      milestone_type: milestoneType,
      cycle_title: "t",
      milestone_title: "t",
    },
    included_artifacts: ["様式3"],
    form2: { version: 1 },
    form3: form3Fixture(),
    information_cards: [],
    field_reflections: [],
    patient_understanding: null,
    evidence_links: [],
    source_versions: { form2: 1, form3: 2, patient_understanding: null },
  };
}

function scopeSelected(
  patternIds: Form3PatternKey[],
): AssessmentSubmissionScope {
  return {
    ...FORM3_AI_EVAL_REQUIRED_SCOPE,
    form3Scope: { mode: "selected_patterns", patternIds },
  };
}

function scopeAll(): AssessmentSubmissionScope {
  return {
    ...FORM3_AI_EVAL_REQUIRED_SCOPE,
    form3Scope: { mode: "all_patterns" },
  };
}

function buildPkg(
  milestoneType: string,
  scope: AssessmentSubmissionScope | null,
) {
  const idMapper = createAiAnonymousIdMapper("t", "org");
  const prepared = prepareAiEvaluationPackageStudentSubmission(
    record(milestoneType),
    scope,
  );
  return buildAiEvaluationPackage({
    evaluationRequestId: "11111111-1111-4111-8111-111111111111",
    generatedAt: "2026-09-02T12:00:00.000Z",
    generatedByRole: "teacher",
    studentSubmission: prepared,
    packageScope: scope,
    patientId: "A",
    idMapper,
    idSecret: "t",
    organizationScopeKey: "org",
  });
}

function excluded(pkg: ReturnType<typeof buildPkg>): string[] {
  return (pkg.case_context as { excluded_from_evaluation: string[] })
    .excluded_from_evaluation;
}

function stage(pkg: ReturnType<typeof buildPkg>): Record<string, unknown> {
  return (pkg.evaluation_instructions as { evaluation_stage: Record<string, unknown> })
    .evaluation_stage;
}

test("T1 Form2 excluded_from_evaluation が S3.1 正本と完全一致", () => {
  const pkg = buildPkg("form2", {
    includeForm2: true,
    includeForm3: false,
    includeInformationCards: false,
    includeEvidenceLinks: false,
    includeFieldReflections: true,
    includePatientUnderstanding: true,
  });
  assert.deepEqual(excluded(pkg), [...FORM2_AI_EVAL_EXCLUDED_FROM_EVALUATION]);
  assert.ok(
    excluded(pkg).includes("情報カード（様式2段階の評価対象外）"),
  );
  assert.ok(
    excluded(pkg).includes(
      "看護目標・看護計画・看護の方向性・具体的援助・観察項目・実施すべき看護",
    ),
  );
});

test("T2 Form3 に『様式2段階の評価対象外』が無い", () => {
  const blob = JSON.stringify(buildPkg("form3_progress", scopeAll()));
  assert.equal(blob.includes("様式2段階の評価対象外"), false);
  assert.equal(blob.includes("様式2段階"), false);
});

test("T3 Form3 に Form2 の看護評価対象外文言が無い", () => {
  const excl = excluded(buildPkg("form3_complete", scopeAll()));
  assert.equal(
    excl.some((x) =>
      x.includes("看護目標・看護計画・看護の方向性・具体的援助・観察項目・実施すべき看護"),
    ),
    false,
  );
  const blob = JSON.stringify({
    excluded: excl,
    policy: buildPkg("form3_complete", scopeAll()).compass_policy,
  });
  for (const p of FORM2_POLICY_PHRASES_FORBIDDEN_IN_FORM3) {
    assert.equal(blob.includes(p), false, `leaked: ${p}`);
  }
});

test("T4 Form3 excluded は Cards を補助証拠として許容する", () => {
  const excl = excluded(buildPkg("form3_progress", scopeAll())).join("\n");
  assert.ok(excl.includes("補助証拠"));
  assert.ok(excl.includes("informationCards"));
  assert.equal(excl.includes("様式2段階の評価対象外"), false);
});

test("T5 Form3 は看護への展開を評価可能（policy維持）", () => {
  const policy = buildPkg("form3_progress", scopeAll()).compass_policy as {
    education_principles: string[];
  };
  assert.ok(
    policy.education_principles.some((p) =>
      p.includes("必要な看護を考えられているかは評価対象"),
    ),
  );
});

test("T6 AI の看護計画完成禁止は維持", () => {
  const pkg = buildPkg("form3_progress", scopeAll());
  const prohibitions = (pkg.compass_policy as { prohibitions: string[] })
    .prohibitions;
  assert.ok(prohibitions.some((p) => p.includes("看護計画を完成")));
  assert.equal(
    (pkg.evaluation_instructions as { do_not_complete_nursing_plans: boolean })
      .do_not_complete_nursing_plans,
    true,
  );
});

test("T7 selected sleep_rest → 限定評価 instruction あり", () => {
  const st = stage(buildPkg("form3_progress", scopeSelected(["sleep_rest"])));
  const scope = st.pattern_evaluation_scope as {
    mode: string;
    selected_pattern_ids: string[];
    note: string;
  };
  assert.equal(scope.mode, "selected_patterns");
  assert.deepEqual(scope.selected_pattern_ids, ["sleep_rest"]);
  assert.ok(scope.note.includes("限定した評価"));
  assert.ok(scope.note.includes("減点しない") || scope.note.includes("不足・未到達"));
});

test("T8 selected 複数 → 限定評価 instruction あり", () => {
  const st = stage(
    buildPkg(
      "form3_progress",
      scopeSelected(["sleep_rest", "activity_exercise"]),
    ),
  );
  const scope = st.pattern_evaluation_scope as {
    selected_pattern_ids: string[];
  };
  assert.deepEqual(scope.selected_pattern_ids, [
    "sleep_rest",
    "activity_exercise",
  ]);
});

test("T9 selected で package 外 pattern 欠如を減点しない明示", () => {
  const note = (
    stage(buildPkg("form3_complete", scopeSelected(["sleep_rest"])))
      .pattern_evaluation_scope as { note: string }
  ).note;
  assert.ok(note.includes("含まれていないpattern"));
  assert.ok(note.includes("不足・未到達") || note.includes("減点しない"));
});

test("T10 all_patterns → selected 限定 instruction なし", () => {
  const st = stage(buildPkg("form3_complete", scopeAll()));
  assert.equal("pattern_evaluation_scope" in st, false);
  assert.equal(st.evaluation_mode, "summative_leaning");
});

test("T11 progress formative / one-step-ahead 維持", () => {
  const pkg = buildPkg("form3_progress", scopeSelected(["sleep_rest"]));
  assert.equal(stage(pkg).evaluation_mode, "formative");
  assert.equal(
    (pkg.evaluation_instructions as { ask_one_step_ahead: boolean })
      .ask_one_step_ahead,
    true,
  );
  assert.ok(String(stage(pkg).focus).includes("一つ先"));
});

test("T12 complete summative_leaning 維持", () => {
  const pkg = buildPkg("form3_complete", scopeAll());
  assert.equal(stage(pkg).evaluation_mode, "summative_leaning");
  assert.ok(String(stage(pkg).focus).includes("①情報整理"));
});

test("T17 package schema compatibility", () => {
  for (const pkg of [
    buildPkg("form2", {
      includeForm2: true,
      includeForm3: false,
      includeInformationCards: false,
      includeEvidenceLinks: false,
      includeFieldReflections: true,
      includePatientUnderstanding: true,
    }),
    buildPkg("form3_progress", scopeSelected(["sleep_rest"])),
    buildPkg("form3_complete", scopeAll()),
  ]) {
    assert.equal(assertAiEvaluationPackageShape(pkg).ok, true);
  }
});

test("Form3 excluded 定数に Form2 看護対象外が無い", () => {
  const joined = FORM3_AI_EVAL_EXCLUDED_FROM_EVALUATION.join("\n");
  assert.equal(joined.includes("様式2段階"), false);
  assert.equal(
    joined.includes(
      "看護目標・看護計画・看護の方向性・具体的援助・観察項目・実施すべき看護",
    ),
    false,
  );
});

console.log(`\n${passed} Form3 S3.1 Human Review fix tests passed`);
