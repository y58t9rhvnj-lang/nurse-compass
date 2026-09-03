/**
 * Form3 AI評価 S1: policy version / StaticContent / Builder 切替の回帰。
 * Run: npx tsx lib/v2/assessment/aiEvaluationForm3StaticContentS1.test.ts
 */
import assert from "node:assert/strict";
import { createAiAnonymousIdMapper } from "./aiExportAnonymize";
import type { AiAnonymizedAssessmentRecord } from "./aiExportAnonymize";
import {
  assertAiEvaluationPackageShape,
  buildAiEvaluationPackage,
} from "./aiEvaluationPackageBuilder";
import {
  buildAiEvaluationCompassPolicy,
  buildAiEvaluationInstructions,
  buildAiEvaluationOutputSchemaHint,
  buildAiEvaluationRubricBlock,
} from "./aiEvaluationPackageStaticContent";
import {
  buildForm3AiEvaluationCompassPolicy,
  buildForm3AiEvaluationInstructions,
  FORM2_POLICY_PHRASES_FORBIDDEN_IN_FORM3,
} from "./aiEvaluationPackageStaticContentForm3";
import { resolveAiEvaluationStaticContent } from "./aiEvaluationPackageStaticContentResolve";
import {
  AI_EVAL_COMPASS_POLICY_VERSION,
  AI_EVAL_FORM2_COMPASS_POLICY_VERSION,
  AI_EVAL_FORM3_COMPASS_POLICY_VERSION,
  AI_EVAL_PACKAGE_SCHEMA_VERSION,
  AI_EVAL_RESULT_SCHEMA_VERSION,
  isForm3AiEvalMilestone,
  resolveAiEvalCompassPolicyVersion,
} from "./aiEvaluationVersions";

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
  milestoneType: string,
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
      milestone_type: milestoneType,
      cycle_title: "課題1",
      milestone_title: "評価時点1",
    },
    included_artifacts: ["様式2", "フィールド振り返り", "患者理解"],
    form2: { version: 1 },
    form3: null,
    information_cards: [],
    field_reflections: [],
    patient_understanding: null,
    evidence_links: [],
    source_versions: {
      form2: 1,
      form3: null,
      patient_understanding: null,
    },
  };
}

function buildPkg(milestoneType: string) {
  const idMapper = createAiAnonymousIdMapper("t", "org");
  return buildAiEvaluationPackage({
    evaluationRequestId: "11111111-1111-4111-8111-111111111111",
    generatedAt: "2026-09-02T00:00:00.000Z",
    generatedByRole: "teacher",
    studentSubmission: baseRecord(milestoneType),
    packageScope: null,
    patientId: "A",
    idMapper,
    idSecret: "t",
    organizationScopeKey: "org",
  });
}

function stringifyStatic(pkg: ReturnType<typeof buildPkg>): string {
  return JSON.stringify({
    compass_policy: pkg.compass_policy,
    rubric: pkg.rubric,
    evaluation_instructions: pkg.evaluation_instructions,
    output_schema_hint: pkg.output_schema_hint,
  });
}

// ---------------------------------------------------------------------------
// Version helpers
// ---------------------------------------------------------------------------

test("定数: Form2=2026.4 / Form3=2026.5 / 互換エイリアス一致", () => {
  assert.equal(AI_EVAL_FORM2_COMPASS_POLICY_VERSION, "2026.4");
  assert.equal(AI_EVAL_FORM3_COMPASS_POLICY_VERSION, "2026.5");
  assert.equal(AI_EVAL_COMPASS_POLICY_VERSION, "2026.4");
  assert.equal(AI_EVAL_COMPASS_POLICY_VERSION, AI_EVAL_FORM2_COMPASS_POLICY_VERSION);
});

test("A: form2_progress → 2026.4 + Form2 StaticContent", () => {
  // DB enum に無いが仕様エイリアスとして Form2 政策へ解決
  assert.equal(resolveAiEvalCompassPolicyVersion("form2_progress"), "2026.4");
  assert.equal(isForm3AiEvalMilestone("form2_progress"), false);
  const resolved = resolveAiEvaluationStaticContent("form2_progress");
  assert.equal(resolved.policyFamily, "form2");
  assert.deepEqual(resolved.compass_policy, buildAiEvaluationCompassPolicy());
  const pkg = buildPkg("form2_progress");
  assert.equal(pkg.metadata.compass_policy_version, "2026.4");
  assert.deepEqual(pkg.compass_policy, buildAiEvaluationCompassPolicy());
  assert.deepEqual(pkg.rubric, buildAiEvaluationRubricBlock());
  assert.deepEqual(
    pkg.evaluation_instructions,
    buildAiEvaluationInstructions(),
  );
});

test("B: form2_complete / form2 → 2026.4 + Form2 StaticContent", () => {
  for (const mt of ["form2_complete", "form2"] as const) {
    assert.equal(resolveAiEvalCompassPolicyVersion(mt), "2026.4");
    const pkg = buildPkg(mt);
    assert.equal(pkg.metadata.compass_policy_version, "2026.4");
    assert.deepEqual(pkg.compass_policy, buildAiEvaluationCompassPolicy());
    assert.deepEqual(pkg.evaluation_instructions, buildAiEvaluationInstructions());
    assert.deepEqual(
      pkg.output_schema_hint,
      buildAiEvaluationOutputSchemaHint(),
    );
  }
});

test("C: form3_progress → 2026.5 + Form3 StaticContent + progress instructions", () => {
  const pkg = buildPkg("form3_progress");
  assert.equal(pkg.metadata.compass_policy_version, "2026.5");
  assert.equal(pkg.compass_policy.version, "2026.5");
  assert.deepEqual(pkg.compass_policy, buildForm3AiEvaluationCompassPolicy());
  const stage = pkg.evaluation_instructions.evaluation_stage as {
    milestone_type: string;
    evaluation_mode: string;
    focus: string;
  };
  assert.equal(stage.milestone_type, "form3_progress");
  assert.equal(stage.evaluation_mode, "formative");
  assert.ok(stage.focus.includes("形成"));
  assert.ok(stage.focus.includes("一つ先"));
  assert.ok(stage.focus.includes("過度に減点しない") || stage.focus.includes("未完成"));
  assert.deepEqual(
    pkg.evaluation_instructions,
    buildForm3AiEvaluationInstructions("form3_progress"),
  );
});

test("D: form3_complete → 2026.5 + Form3 StaticContent + complete instructions", () => {
  const pkg = buildPkg("form3_complete");
  assert.equal(pkg.metadata.compass_policy_version, "2026.5");
  assert.equal(pkg.compass_policy.version, "2026.5");
  const stage = pkg.evaluation_instructions.evaluation_stage as {
    milestone_type: string;
    evaluation_mode: string;
    focus: string;
  };
  assert.equal(stage.milestone_type, "form3_complete");
  assert.equal(stage.evaluation_mode, "summative_leaning");
  assert.ok(stage.focus.includes("総括") || stage.focus.includes("①情報整理"));
  assert.ok(stage.focus.includes("必要な看護"));
  assert.deepEqual(
    pkg.evaluation_instructions,
    buildForm3AiEvaluationInstructions("form3_complete"),
  );
  // progress と instructions が異なること
  assert.notDeepEqual(
    pkg.evaluation_instructions,
    buildForm3AiEvaluationInstructions("form3_progress"),
  );
});

test("E: metadata.compass_policy_version === compass_policy.version", () => {
  for (const mt of [
    "form2",
    "form2_progress",
    "form2_complete",
    "form3_progress",
    "form3_complete",
  ]) {
    const pkg = buildPkg(mt);
    assert.equal(
      pkg.metadata.compass_policy_version,
      pkg.compass_policy.version,
      `mismatch at ${mt}`,
    );
  }
});

test("F: request 用 resolve === package metadata（Export 整合）", () => {
  for (const mt of [
    "form2",
    "form2_progress",
    "form2_complete",
    "form3_progress",
    "form3_complete",
    "final",
    "custom",
    null,
  ]) {
    const requestVersion = resolveAiEvalCompassPolicyVersion(mt);
    const pkg = buildPkg(mt ?? "midterm");
    // null/midterm → Form2。Export は meta.milestone_type を同じ helper で解決する
    const expectedMeta = resolveAiEvalCompassPolicyVersion(
      mt ?? "midterm",
    );
    assert.equal(pkg.metadata.compass_policy_version, expectedMeta);
    if (mt !== null) {
      assert.equal(requestVersion, pkg.metadata.compass_policy_version);
    }
  }
});

test("G: Form3 StaticContent に Form2 専用政策文言が混入しない", () => {
  for (const mt of ["form3_progress", "form3_complete"] as const) {
    const blob = stringifyStatic(buildPkg(mt));
    for (const phrase of FORM2_POLICY_PHRASES_FORBIDDEN_IN_FORM3) {
      assert.equal(
        blob.includes(phrase),
        false,
        `Form2 phrase leaked in ${mt}: ${phrase}`,
      );
    }
    assert.equal(blob.includes("様式2段階"), false);
    assert.equal(blob.includes("field_reflectionsを中心"), false);
    assert.equal(blob.includes("主根拠は form2"), false);
  }
});

test("H: Form3 は看護への展開を評価可、計画完成は禁止", () => {
  const policy = buildForm3AiEvaluationCompassPolicy();
  const principles = policy.education_principles as string[];
  const prohibitions = policy.prohibitions as string[];
  const roles = policy.ai_role as string[];
  assert.ok(
    principles.some((p) => p.includes("必要な看護を考えられているかは評価対象")),
  );
  assert.ok(prohibitions.some((p) => p.includes("看護計画を完成")));
  assert.ok(
    prohibitions.some((p) => p.includes("援助・観察項目の正解一覧")),
  );
  assert.ok(roles.some((r) => r.includes("根拠を問い返す")));
  assert.ok(roles.some((r) => r.includes("一つ先")));

  const focus = (
    buildPkg("form3_complete").rubric.items as Array<{ key: string; focus: string }>
  ).find((i) => i.key === "overall_integration")?.focus;
  assert.ok(focus?.includes("必要な看護へ論理的に展開"));
  assert.ok(focus?.includes("看護行為") || focus?.includes("羅列"));
});

test("I: Form2 package は既存 Form2 StaticContent と完全一致", () => {
  const pkg = buildPkg("form2");
  assert.equal(pkg.metadata.compass_policy_version, "2026.4");
  assert.deepEqual(pkg.compass_policy, buildAiEvaluationCompassPolicy());
  assert.deepEqual(pkg.rubric, buildAiEvaluationRubricBlock());
  assert.deepEqual(
    pkg.evaluation_instructions,
    buildAiEvaluationInstructions(),
  );
  assert.deepEqual(
    pkg.output_schema_hint,
    buildAiEvaluationOutputSchemaHint(),
  );
  // Form2 focus が残っていること（上書きされていない）
  const infoFocus = (
    pkg.rubric.items as Array<{ key: string; focus: string }>
  ).find((i) => i.key === "information_gathering")?.focus;
  assert.ok(infoFocus?.includes("様式2段階の評価対象外"));
});

test("J: package shape / schema version 互換", () => {
  for (const mt of ["form2", "form3_progress", "form3_complete"]) {
    const pkg = buildPkg(mt);
    const shape = assertAiEvaluationPackageShape(pkg);
    assert.equal(shape.ok, true);
    assert.equal(pkg.metadata.package_schema_version, AI_EVAL_PACKAGE_SCHEMA_VERSION);
    assert.equal(AI_EVAL_RESULT_SCHEMA_VERSION, 1);
    assert.equal(
      (pkg.rubric.items as unknown[]).length,
      7,
    );
  }
});

test("progress/complete は同じ 2026.5 で instructions のみ差", () => {
  const p = buildPkg("form3_progress");
  const c = buildPkg("form3_complete");
  assert.equal(p.metadata.compass_policy_version, "2026.5");
  assert.equal(c.metadata.compass_policy_version, "2026.5");
  assert.deepEqual(p.compass_policy, c.compass_policy);
  assert.deepEqual(p.rubric, c.rubric);
  assert.notDeepEqual(p.evaluation_instructions, c.evaluation_instructions);
});

test("Form3 overall_integration focus が Form2 文言を上書きしていない（別経路）", () => {
  const form2Focus = (
    buildAiEvaluationRubricBlock().items as Array<{ key: string; focus: string }>
  ).find((i) => i.key === "overall_integration")?.focus;
  const form3Focus = (
    buildPkg("form3_progress").rubric.items as Array<{
      key: string;
      focus: string;
    }>
  ).find((i) => i.key === "overall_integration")?.focus;
  assert.ok(form2Focus?.includes("看護目標・計画・援助・観察項目・情報カードは評価対象外"));
  assert.ok(form3Focus?.includes("必要な看護へ論理的に展開"));
  assert.notEqual(form2Focus, form3Focus);
});

console.log(`\n${passed} Form3 StaticContent S1 tests passed`);
