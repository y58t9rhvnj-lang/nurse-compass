/**
 * AI評価 Package 方針 2026.4 の自動検証。
 * Run: npx tsx lib/v2/assessment/aiEvaluationPolicy2026_4.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { prepareAiEvaluationPackageStudentSubmission } from "./aiEvaluationPackageSubmission";
import type { AiAnonymizedAssessmentRecord } from "./aiExportAnonymize";
import { createAiAnonymousIdMapper } from "./aiExportAnonymize";
import {
  buildAiEvaluationPackage,
} from "./aiEvaluationPackageBuilder";
import {
  AI_EVAL_COMPASS_POLICY_VERSION,
  AI_EVAL_RUBRIC_VERSION,
} from "./aiEvaluationVersions";
import {
  AI_EVAL_EMPTY_PATIENT_UNDERSTANDING_STATEMENT,
  AI_EVAL_FORBIDDEN_STUDENT_FEEDBACK_PATTERNS,
  buildAiEvaluationCompassPolicy,
  buildAiEvaluationInstructions,
  buildAiEvaluationRubricBlock,
} from "./aiEvaluationPackageStaticContent";
import {
  buildStudentVisibleScopeIncludes,
  FORM2_AI_EVAL_REQUIRED_SCOPE,
  resolveScopeForAiEvaluationPackage,
  scopeForAiEvaluationPackage,
} from "./submissionScope";
import type { AssessmentSubmissionScope } from "./types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const samplePkgPath = join(
  __dirname,
  "../../../docs/version2/ai/samples/ai-evaluation-package.sample.json",
);
const sampleResPath = join(
  __dirname,
  "../../../docs/version2/ai/samples/ai-evaluation-result.sample.json",
);

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

function baseRecord(
  overrides: Partial<AiAnonymizedAssessmentRecord> = {},
): AiAnonymizedAssessmentRecord {
  return {
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
    included_artifacts: ["様式2", "情報カード", "フィールド振り返り", "患者理解"],
    form2: {
      version: 1,
      basicInformation: {
        chiefComplaint: "夜に怠け者と声が聞こえて眠れない",
      },
    },
    form3: null,
    information_cards: [{ id: "card_a", content: "カード内容" }],
    evidence_links: [],
    field_reflections: [
      {
        form2_field_key: "basicInformation.chiefComplaint",
        reflection_text:
          "幻聴によって睡眠へ影響している可能性がある。「怠け者」という内容から自己肯定感へ影響している可能性もある。",
        updated_at: "2026-08-20T04:50:00.000Z",
      },
    ],
    patient_understanding: {
      case_ref: "case_x",
      overview_text:
        "夜間の幻聴と睡眠障害があり、自己肯定感にも影響しうる人だと理解している。",
      updated_at: "2026-08-20T05:00:00.000Z",
    },
    source_versions: {
      form2: 1,
      form3: null,
      patient_understanding: "2026-08-20T05:00:00.000Z",
    },
    ...overrides,
  };
}

const form2Scope: AssessmentSubmissionScope = {
  includeForm2: true,
  includeForm3: false,
  includeInformationCards: true,
  includeEvidenceLinks: true,
  includeFieldReflections: true,
  includePatientUnderstanding: false,
};

test("patient understandingがscope内で保持される", () => {
  const scope = scopeForAiEvaluationPackage("form2", form2Scope);
  assert.ok(scope);
  assert.equal(scope.includePatientUnderstanding, true);
  const out = prepareAiEvaluationPackageStudentSubmission(baseRecord(), scope);
  assert.ok(out.patient_understanding);
  assert.ok(out.included_artifacts.includes("患者理解"));
});

test("patient understandingがscope外のときだけ除外される", () => {
  const scope: AssessmentSubmissionScope = {
    ...form2Scope,
    includePatientUnderstanding: false,
  };
  const out = prepareAiEvaluationPackageStudentSubmission(baseRecord(), scope);
  assert.equal(out.patient_understanding, null);
  assert.ok(!out.included_artifacts.includes("患者理解"));
});

test("visible scopeがsubmission scopeから動的生成される", () => {
  const scope = scopeForAiEvaluationPackage("form2", form2Scope);
  const includes = buildStudentVisibleScopeIncludes(scope);
  assert.ok(includes.includes("様式2"));
  assert.ok(includes.includes("フィールド振り返り"));
  assert.ok(includes.includes("患者理解"));
  assert.ok(!includes.includes("情報カード"));
  assert.ok(!includes.some((x) => x.includes("様式3")));

  const idMapper = createAiAnonymousIdMapper("t", "org");
  const pkg = buildAiEvaluationPackage({
    evaluationRequestId: "11111111-1111-4111-8111-111111111111",
    generatedAt: "2026-08-29T00:00:00.000Z",
    generatedByRole: "teacher",
    studentSubmission: prepareAiEvaluationPackageStudentSubmission(
      baseRecord(),
      scope,
    ),
    packageScope: scope,
    patientId: "A",
    idMapper,
    idSecret: "t",
    organizationScopeKey: "org",
  });
  const visible = pkg.case_context.student_visible_scope as {
    includes: string[];
  };
  assert.deepEqual(visible.includes, includes);
});

test("DB一致時は強制補正が発生しない", () => {
  const resolved = resolveScopeForAiEvaluationPackage(
    "form2",
    FORM2_AI_EVAL_REQUIRED_SCOPE,
  );
  assert.equal(resolved.corrected, false);
  assert.deepEqual(resolved.corrections, []);
  assert.equal(resolved.warnings.length, 0);
  assert.ok(resolved.packageScope);
});

test("情報カードを様式2評価に使用しない", () => {
  const scope = scopeForAiEvaluationPackage("form2", form2Scope);
  assert.equal(scope?.includeInformationCards, false);
  assert.equal(scope?.includeEvidenceLinks, false);
  const out = prepareAiEvaluationPackageStudentSubmission(baseRecord(), scope);
  assert.equal(out.information_cards.length, 0);
  assert.ok(!out.included_artifacts.includes("情報カード"));

  const policy = buildAiEvaluationCompassPolicy();
  assert.ok(
    (policy.prohibitions as string[]).some((p) => p.includes("情報カード")),
  );
  const rubric = buildAiEvaluationRubricBlock();
  const info = (rubric.items as Array<{ key: string; focus: string }>).find(
    (i) => i.key === "information_gathering",
  );
  assert.ok(info?.focus.includes("情報カード"));
  assert.ok(info?.focus.includes("対象外"));
});

test("DB不一致時は警告付きで補正する", () => {
  const resolved = resolveScopeForAiEvaluationPackage("form2", form2Scope);
  assert.equal(resolved.corrected, true);
  assert.ok(resolved.warnings.some((w) => w.code === "db_scope_policy_mismatch"));
  assert.ok(
    resolved.warnings.some(
      (w) => w.code === "patient_understanding_out_of_scope",
    ),
  );
  assert.ok(
    resolved.warnings.some(
      (w) => w.code === "information_cards_in_scope_against_policy",
    ),
  );
  assert.equal(resolved.packageScope?.includePatientUnderstanding, true);
  assert.equal(resolved.packageScope?.includeInformationCards, false);
});

test("患者理解が空の場合の評価文", () => {
  assert.match(
    AI_EVAL_EMPTY_PATIENT_UNDERSTANDING_STATEMENT,
    /提出上/,
  );
  assert.match(
    AI_EVAL_EMPTY_PATIENT_UNDERSTANDING_STATEMENT,
    /統合過程を確認できません|過程は確認できません/,
  );
  assert.ok(
    !AI_EVAL_EMPTY_PATIENT_UNDERSTANDING_STATEMENT.includes(
      "患者理解ができていない",
    ),
  );
  const instructions = buildAiEvaluationInstructions();
  const stage = instructions.evaluation_stage as {
    empty_patient_understanding: string;
  };
  assert.equal(
    stage.empty_patient_understanding,
    AI_EVAL_EMPTY_PATIENT_UNDERSTANDING_STATEMENT,
  );
});

test("一つの情報から適切に考察できているケース", () => {
  const scope = scopeForAiEvaluationPackage("form2", form2Scope);
  const out = prepareAiEvaluationPackageStudentSubmission(baseRecord(), scope);
  const reflection = String(
    out.field_reflections[0]?.reflection_text ?? "",
  );
  assert.match(reflection, /可能性/);
  assert.match(reflection, /幻聴|自己肯定感/);
  const examples = (
    buildAiEvaluationInstructions().evaluation_stage as {
      examples_of_adequate_thinking: string[];
    }
  ).examples_of_adequate_thinking;
  assert.ok(examples.some((e) => e.includes("怠け者")));
});

test("3段階は教育原則として focus/policy に統合され tertiary は無い", () => {
  const principles = buildAiEvaluationCompassPolicy()
    .education_principles as string[];
  assert.ok(principles.some((p) => p.includes("教育原則") && p.includes("3段階")));
  assert.ok(principles.some((p) => p.includes("単一情報で断定しない")));
  assert.ok(principles.some((p) => p.includes("合格相当")));
  const stage = buildAiEvaluationInstructions().evaluation_stage as {
    focus: string;
    primary: string;
    secondary: string;
    tertiary?: unknown;
  };
  assert.match(stage.focus, /教育原則/);
  assert.match(stage.focus, /各情報の意味/);
  assert.match(stage.focus, /全体像を大まかに/);
  assert.match(stage.focus, /患者理解を深めることができる/);
  assert.match(stage.primary, /教育原則①②/);
  assert.match(stage.secondary, /教育原則③/);
  assert.equal("tertiary" in stage, false);
  assert.ok(!/70〜80%/.test(stage.primary));
  assert.ok(!/20〜30%/.test(stage.secondary));
});

test("全体像を概ね捉えられていれば合格相当となるケース", () => {
  const focus = (
    buildAiEvaluationRubricBlock().items as Array<{
      key: string;
      focus: string;
    }>
  ).find((i) => i.key === "patient_understanding")?.focus;
  assert.ok(focus?.includes("大まかに"));
  assert.ok(focus?.includes("空欄時"));
  assert.ok(focus?.includes("段階2"));
});

test("看護の方向性や援助方法が出力されない", () => {
  const sample = JSON.parse(readFileSync(sampleResPath, "utf8")) as {
    student_feedback_draft: Record<string, string[] | string>;
  };
  const fb = sample.student_feedback_draft;
  const blob = JSON.stringify({
    strengths: fb.strengths,
    supporting_information: fb.supporting_information,
    gaps_or_alternatives: fb.gaps_or_alternatives,
    next_questions: fb.next_questions,
  });
  for (const re of AI_EVAL_FORBIDDEN_STUDENT_FEEDBACK_PATTERNS) {
    assert.equal(re.test(blob), false, `forbidden match: ${re}`);
  }
  const prohibitions = buildAiEvaluationCompassPolicy().prohibitions as string[];
  assert.ok(prohibitions.some((p) => p.includes("看護目標")));
  assert.ok(prohibitions.some((p) => p.includes("単一情報からの断定")));
});

test("policy / sample versionが 2026.4 / rubric 3 で一致する", () => {
  assert.equal(AI_EVAL_COMPASS_POLICY_VERSION, "2026.4");
  assert.equal(AI_EVAL_RUBRIC_VERSION, "3");
  const pkg = JSON.parse(readFileSync(samplePkgPath, "utf8")) as {
    metadata: { compass_policy_version: string; rubric_version: string };
    compass_policy: { version: string };
    rubric: { version: string };
    evaluation_instructions: { evaluation_stage: Record<string, unknown> };
  };
  assert.equal(pkg.metadata.compass_policy_version, "2026.4");
  assert.equal(pkg.metadata.rubric_version, "3");
  assert.equal(pkg.compass_policy.version, "2026.4");
  assert.equal(pkg.rubric.version, "3");
  assert.equal("tertiary" in pkg.evaluation_instructions.evaluation_stage, false);
  const res = JSON.parse(readFileSync(sampleResPath, "utf8")) as {
    metadata: { compass_policy_version: string; rubric_version: string };
  };
  assert.equal(res.metadata.compass_policy_version, "2026.4");
  assert.equal(res.metadata.rubric_version, "3");
});

console.log(`\n${passed} policy 2026.4 tests passed`);
