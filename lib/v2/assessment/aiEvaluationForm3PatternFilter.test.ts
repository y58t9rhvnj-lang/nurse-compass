/**
 * Form3 AI評価 S3: pattern filter 回帰。
 * Run: npx tsx lib/v2/assessment/aiEvaluationForm3PatternFilter.test.ts
 */
import assert from "node:assert/strict";
import {
  filterForm3ForAiEvaluation,
  resolveForm3AiEvalFilterMode,
} from "./aiEvaluationForm3PatternFilter";
import { prepareAiEvaluationPackageStudentSubmission } from "./aiEvaluationPackageSubmission";
import type { AiAnonymizedAssessmentRecord } from "./aiExportAnonymize";
import {
  buildAiEvaluationPackage,
} from "./aiEvaluationPackageBuilder";
import { createAiAnonymousIdMapper } from "./aiExportAnonymize";
import {
  buildAiEvaluationCompassPolicy,
  buildAiEvaluationInstructions,
  buildAiEvaluationRubricBlock,
} from "./aiEvaluationPackageStaticContent";
import {
  FORM3_AI_EVAL_REQUIRED_SCOPE,
  resolveScopeForAiEvaluationPackage,
} from "./submissionScope";
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

function sampleForm3(): Record<string, unknown> {
  return {
    schemaVersion: 2,
    patientId: "case_x",
    updatedAt: "2026-09-02T00:00:00.000Z",
    informationCards: [
      {
        id: "info_sleep",
        content: "睡眠のみ",
        patternKeys: ["sleep_rest"],
      },
      {
        id: "info_multi",
        content: "睡眠+活動",
        patternKeys: ["sleep_rest", "activity_exercise"],
      },
      {
        id: "info_nutrition",
        content: "栄養のみ",
        patternKeys: ["nutritional_metabolic"],
      },
      {
        id: "info_no_pattern",
        content: "パターンなし",
        patternKeys: [],
      },
      {
        id: "info_legacy_singular",
        content: "legacy 単数",
        patternKey: "sleep_rest",
      },
    ],
    assessmentCards: [
      {
        id: "assess_sleep",
        patternKey: "sleep_rest",
        interpretation: "睡眠解釈",
      },
      {
        id: "assess_activity",
        patternKey: "activity_exercise",
        interpretation: "活動解釈",
      },
      {
        id: "assess_null",
        patternKey: null,
        interpretation: "未割当",
      },
    ],
    finalForm: {
      sleep_rest: {
        informationSO: "sleep so",
        interpretationAnalysisCareNeed: "sleep care",
      },
      activity_exercise: {
        informationSO: "act so",
        interpretationAnalysisCareNeed: "act care",
      },
      nutritional_metabolic: {
        informationSO: "nut so",
        interpretationAnalysisCareNeed: "nut care",
      },
      elimination: {
        informationSO: "elim so",
        interpretationAnalysisCareNeed: "elim care",
      },
    },
    workspacePatternFlags: {
      sleep_rest: true,
      activity_exercise: true,
      nutritional_metabolic: false,
      elimination: true,
    },
    migration: { shouldStrip: true },
    v1Backup: { shouldStrip: true },
    related_diagram: { nodes: [] },
  };
}

function allScope(): AssessmentSubmissionScope {
  return {
    ...FORM3_AI_EVAL_REQUIRED_SCOPE,
    form3Scope: { mode: "all_patterns" },
  };
}

function selectedScope(
  patternIds: Form3PatternKey[],
): AssessmentSubmissionScope {
  return {
    ...FORM3_AI_EVAL_REQUIRED_SCOPE,
    form3Scope: {
      mode: "selected_patterns",
      patternIds,
    },
  };
}

function baseRecord(
  form3: Record<string, unknown>,
  milestoneType = "form3_progress",
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
    included_artifacts: ["様式3"],
    form2: { version: 1 },
    form3,
    information_cards: [],
    field_reflections: [],
    patient_understanding: null,
    evidence_links: [],
    source_versions: {
      form2: null,
      form3: 2,
      patient_understanding: null,
    },
  };
}

function idsOf(cards: unknown): string[] {
  if (!Array.isArray(cards)) return [];
  return cards
    .map((c) =>
      c && typeof c === "object" && typeof (c as { id?: unknown }).id === "string"
        ? (c as { id: string }).id
        : "",
    )
    .filter(Boolean)
    .sort();
}

// ---------------------------------------------------------------------------
// T1–T4 all
// ---------------------------------------------------------------------------

test("T1 all → informationCards 全保持（pattern 付き）", () => {
  const out = filterForm3ForAiEvaluation(sampleForm3(), { mode: "all_patterns" });
  const ids = idsOf(out.informationCards);
  assert.ok(ids.includes("info_sleep"));
  assert.ok(ids.includes("info_multi"));
  assert.ok(ids.includes("info_nutrition"));
  assert.ok(ids.includes("info_no_pattern"));
  assert.ok(ids.includes("info_legacy_singular"));
});

test("T2 all → assessmentCards 全保持", () => {
  const out = filterForm3ForAiEvaluation(sampleForm3(), { mode: "all_patterns" });
  assert.deepEqual(idsOf(out.assessmentCards), [
    "assess_activity",
    "assess_null",
    "assess_sleep",
  ]);
});

test("T3 all → finalForm 全保持", () => {
  const out = filterForm3ForAiEvaluation(sampleForm3(), { mode: "all_patterns" });
  assert.deepEqual(Object.keys(out.finalForm as object).sort(), [
    "activity_exercise",
    "elimination",
    "nutritional_metabolic",
    "sleep_rest",
  ]);
});

test("T4 all → workspacePatternFlags 全保持", () => {
  const out = filterForm3ForAiEvaluation(sampleForm3(), { mode: "all_patterns" });
  assert.deepEqual(Object.keys(out.workspacePatternFlags as object).sort(), [
    "activity_exercise",
    "elimination",
    "nutritional_metabolic",
    "sleep_rest",
  ]);
});

// ---------------------------------------------------------------------------
// T5–T12 selected
// ---------------------------------------------------------------------------

test("T5 selected 1 → informationCards patternKeys 一致のみ", () => {
  const out = filterForm3ForAiEvaluation(sampleForm3(), {
    mode: "selected_patterns",
    patternIds: ["sleep_rest"],
  });
  assert.deepEqual(idsOf(out.informationCards), [
    "info_legacy_singular",
    "info_multi",
    "info_sleep",
  ]);
});

test("T6 multi-tag informationCard → 1つ一致で保持（patternKeys 非破壊）", () => {
  const src = sampleForm3();
  const out = filterForm3ForAiEvaluation(src, {
    mode: "selected_patterns",
    patternIds: ["sleep_rest"],
  });
  const multi = (out.informationCards as Array<Record<string, unknown>>).find(
    (c) => c.id === "info_multi",
  );
  assert.ok(multi);
  assert.deepEqual(multi!.patternKeys, ["sleep_rest", "activity_exercise"]);
});

test("T7 informationCard 不一致 → 除外", () => {
  const out = filterForm3ForAiEvaluation(sampleForm3(), {
    mode: "selected_patterns",
    patternIds: ["sleep_rest"],
  });
  assert.ok(!idsOf(out.informationCards).includes("info_nutrition"));
});

test("T8 assessmentCard 一致 → 保持", () => {
  const out = filterForm3ForAiEvaluation(sampleForm3(), {
    mode: "selected_patterns",
    patternIds: ["sleep_rest"],
  });
  assert.deepEqual(idsOf(out.assessmentCards), ["assess_sleep"]);
});

test("T9 assessmentCard 不一致 → 除外", () => {
  const out = filterForm3ForAiEvaluation(sampleForm3(), {
    mode: "selected_patterns",
    patternIds: ["sleep_rest"],
  });
  assert.ok(!idsOf(out.assessmentCards).includes("assess_activity"));
});

test("T10 finalForm → selected key のみ", () => {
  const out = filterForm3ForAiEvaluation(sampleForm3(), {
    mode: "selected_patterns",
    patternIds: ["sleep_rest", "activity_exercise"],
  });
  assert.deepEqual(Object.keys(out.finalForm as object).sort(), [
    "activity_exercise",
    "sleep_rest",
  ]);
});

test("T11 workspacePatternFlags → selected key のみ", () => {
  const out = filterForm3ForAiEvaluation(sampleForm3(), {
    mode: "selected_patterns",
    patternIds: ["sleep_rest"],
  });
  assert.deepEqual(Object.keys(out.workspacePatternFlags as object), [
    "sleep_rest",
  ]);
});

test("T12 selected 複数 → union として保持", () => {
  const out = filterForm3ForAiEvaluation(sampleForm3(), {
    mode: "selected_patterns",
    patternIds: ["sleep_rest", "nutritional_metabolic"],
  });
  assert.deepEqual(idsOf(out.informationCards), [
    "info_legacy_singular",
    "info_multi",
    "info_nutrition",
    "info_sleep",
  ]);
  assert.deepEqual(idsOf(out.assessmentCards), ["assess_sleep"]);
  assert.deepEqual(Object.keys(out.finalForm as object).sort(), [
    "nutritional_metabolic",
    "sleep_rest",
  ]);
});

// ---------------------------------------------------------------------------
// T13–T16 edge
// ---------------------------------------------------------------------------

test("T13 pattern 情報なし → selected で forward しない", () => {
  const out = filterForm3ForAiEvaluation(sampleForm3(), {
    mode: "selected_patterns",
    patternIds: ["sleep_rest"],
  });
  assert.ok(!idsOf(out.informationCards).includes("info_no_pattern"));
  assert.ok(!idsOf(out.assessmentCards).includes("assess_null"));
});

test("T14 unknown field / related_diagram → package へ漏れない", () => {
  const prepared = prepareAiEvaluationPackageStudentSubmission(
    baseRecord(sampleForm3()),
    selectedScope(["sleep_rest"]),
  );
  assert.ok(prepared.form3);
  assert.equal(
    Object.prototype.hasOwnProperty.call(prepared.form3, "related_diagram"),
    false,
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(prepared.form3, "migration"),
    false,
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(prepared.form3, "v1Backup"),
    false,
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(prepared, "related_diagram"),
    false,
  );
});

test("T15 input snapshot / form3 は mutation されない", () => {
  const form3 = sampleForm3();
  const before = JSON.stringify(form3);
  const record = baseRecord(form3);
  prepareAiEvaluationPackageStudentSubmission(
    record,
    selectedScope(["sleep_rest"]),
  );
  filterForm3ForAiEvaluation(form3, {
    mode: "selected_patterns",
    patternIds: ["activity_exercise"],
  });
  assert.equal(JSON.stringify(form3), before);
  assert.equal(JSON.stringify(record.form3), before);
});

test("T16 selected + empty patterns → 空（all と解釈しない）", () => {
  assert.deepEqual(
    resolveForm3AiEvalFilterMode({
      mode: "selected_patterns",
      patternIds: [],
    }),
    { mode: "selected_patterns", patternIds: [] },
  );
  const out = filterForm3ForAiEvaluation(sampleForm3(), {
    mode: "selected_patterns",
    patternIds: [],
  });
  assert.deepEqual(out.informationCards, []);
  assert.deepEqual(out.assessmentCards, []);
  assert.deepEqual(out.finalForm, {});
  assert.deepEqual(out.workspacePatternFlags, {});
});

// ---------------------------------------------------------------------------
// T17 Form2 不変 / integration
// ---------------------------------------------------------------------------

test("T17 Form2 package は S3 前後で Form2 StaticContent 不変", () => {
  const idMapper = createAiAnonymousIdMapper("t", "org");
  const record: AiAnonymizedAssessmentRecord = {
    ...baseRecord({ schemaVersion: 2 }, "form2"),
    form3: null,
    form2: { version: 1, basicInformation: { chiefComplaint: "主訴" } },
    field_reflections: [
      {
        form2_field_key: "basicInformation.chiefComplaint",
        reflection_text: "振り返り",
      },
    ],
    patient_understanding: {
      case_ref: "case_x",
      overview_text: "患者理解",
      updated_at: null,
    },
  };
  const prepared = prepareAiEvaluationPackageStudentSubmission(record, {
    includeForm2: true,
    includeForm3: false,
    includeInformationCards: false,
    includeEvidenceLinks: false,
    includeFieldReflections: true,
    includePatientUnderstanding: true,
  });
  const pkg = buildAiEvaluationPackage({
    evaluationRequestId: "11111111-1111-4111-8111-111111111111",
    generatedAt: "2026-09-02T00:00:00.000Z",
    generatedByRole: "teacher",
    studentSubmission: prepared,
    packageScope: {
      includeForm2: true,
      includeForm3: false,
      includeInformationCards: false,
      includeEvidenceLinks: false,
      includeFieldReflections: true,
      includePatientUnderstanding: true,
    },
    patientId: "A",
    idMapper,
    idSecret: "t",
    organizationScopeKey: "org",
  });
  assert.equal(pkg.metadata.compass_policy_version, "2026.4");
  assert.deepEqual(pkg.compass_policy, buildAiEvaluationCompassPolicy());
  assert.deepEqual(pkg.rubric, buildAiEvaluationRubricBlock());
  assert.deepEqual(pkg.evaluation_instructions, buildAiEvaluationInstructions());
});

test("T18 resolveForm3AiEvalFilterMode: all / selected / 欠落", () => {
  assert.deepEqual(resolveForm3AiEvalFilterMode(undefined), {
    mode: "all_patterns",
  });
  assert.deepEqual(resolveForm3AiEvalFilterMode({ mode: "all_patterns" }), {
    mode: "all_patterns",
  });
  assert.deepEqual(
    resolveForm3AiEvalFilterMode({
      mode: "selected_patterns",
      patternIds: ["sleep_rest"],
    }),
    { mode: "selected_patterns", patternIds: ["sleep_rest"] },
  );
});

test("T19 S2 scope + S3 filter 統合: sleep_rest サンプル", () => {
  const resolved = resolveScopeForAiEvaluationPackage(
    "form3_progress",
    selectedScope(["sleep_rest"]),
  );
  const prepared = prepareAiEvaluationPackageStudentSubmission(
    baseRecord(sampleForm3()),
    resolved.packageScope,
  );
  const form3 = prepared.form3 as Record<string, unknown>;
  const info = form3.informationCards as unknown[];
  const assess = form3.assessmentCards as unknown[];
  const finalKeys = Object.keys(form3.finalForm as object).sort();
  const flagKeys = Object.keys(form3.workspacePatternFlags as object).sort();

  // 人間可読サンプル（報告用）
  console.log(
    [
      "",
      "--- selected_patterns: [sleep_rest] sample ---",
      `informationCards: ${info.length} (${idsOf(info).join(", ")})`,
      `assessmentCards: ${assess.length} (${idsOf(assess).join(", ")})`,
      `finalForm keys: ${finalKeys.join(", ")}`,
      `workspacePatternFlags keys: ${flagKeys.join(", ")}`,
      "----------------------------------------------",
      "",
    ].join("\n"),
  );

  assert.equal(info.length, 3);
  assert.equal(assess.length, 1);
  assert.deepEqual(finalKeys, ["sleep_rest"]);
  assert.deepEqual(flagKeys, ["sleep_rest"]);
  assert.equal(prepared.form2, null);
});

test("T20 schema compatibility: form3 既知ルートのみ", () => {
  const out = filterForm3ForAiEvaluation(sampleForm3(), {
    mode: "selected_patterns",
    patternIds: ["sleep_rest"],
  });
  for (const key of Object.keys(out)) {
    assert.ok(
      [
        "schemaVersion",
        "patientId",
        "updatedAt",
        "informationCards",
        "assessmentCards",
        "finalForm",
        "workspacePatternFlags",
        "version",
      ].includes(key),
      `unexpected form3 key: ${key}`,
    );
  }
});

test("all_patterns via prepare は全体を保つ", () => {
  const prepared = prepareAiEvaluationPackageStudentSubmission(
    baseRecord(sampleForm3(), "form3_complete"),
    allScope(),
  );
  const form3 = prepared.form3 as Record<string, unknown>;
  assert.equal((form3.informationCards as unknown[]).length, 5);
  assert.equal((form3.assessmentCards as unknown[]).length, 3);
  assert.equal(Object.keys(form3.finalForm as object).length, 4);
});

console.log(`\n${passed} Form3 pattern filter S3 tests passed`);
