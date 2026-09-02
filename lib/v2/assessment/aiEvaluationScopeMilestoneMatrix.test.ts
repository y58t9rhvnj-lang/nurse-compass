/**
 * Scope × milestone_type 行列の回帰固定（Version 2.2）。
 * 関連図・Form3 AI 実装 / 軽量リファクタ前の現行挙動ロック。
 *
 * Run: npx tsx lib/v2/assessment/aiEvaluationScopeMilestoneMatrix.test.ts
 */
import assert from "node:assert/strict";
import { prepareAiEvaluationPackageStudentSubmission } from "./aiEvaluationPackageSubmission";
import type { AiAnonymizedAssessmentRecord } from "./aiExportAnonymize";
import {
  FORM2_AI_EVAL_REQUIRED_SCOPE,
  defaultScopeForType,
  parseSubmissionScope,
  resolveScopeForAiEvaluationPackage,
  scopeForAiEvaluationPackage,
} from "./submissionScope";
import type { AssessmentSubmissionScope } from "./types";

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
    included_artifacts: ["様式2", "様式3", "情報カード", "フィールド振り返り", "患者理解"],
    form2: { version: 1, basicInformation: { chiefComplaint: "主訴" } },
    form3: {
      version: 1,
      informationCards: [
        { id: "c1", patternKey: "sleep_rest", text: "睡眠カード" },
        { id: "c2", patternKey: "activity_exercise", text: "活動カード" },
      ],
      assessmentCards: [],
      workspacePatternFlags: {
        sleep_rest: true,
        activity_exercise: true,
      },
    },
    information_cards: [
      {
        anonymous_object_id: "card_1",
        pattern_key: "sleep_rest",
        body_text: "カード本文",
      },
    ],
    field_reflections: [
      {
        form2_field_key: "basicInformation.chiefComplaint",
        reflection_text: "振り返り",
      },
    ],
    patient_understanding: {
      case_ref: "case_x",
      overview_text: "患者理解テキスト",
      updated_at: null,
    },
    evidence_links: [
      {
        anonymous_object_id: "ev_1",
        form2_field_key: "basicInformation.chiefComplaint",
      },
    ],
    source_versions: {
      form2: 1,
      form3: 1,
      patient_understanding: null,
    },
    ...overrides,
  };
}

function assertKnownAiPackageKeysOnly(record: AiAnonymizedAssessmentRecord) {
  const allowed = new Set([
    "schema_version",
    "export_kind",
    "evaluation_request_id",
    "anonymous_ids",
    "meta",
    "included_artifacts",
    "form2",
    "form3",
    "information_cards",
    "field_reflections",
    "patient_understanding",
    "evidence_links",
    "source_versions",
  ]);
  for (const key of Object.keys(record)) {
    assert.ok(
      allowed.has(key),
      `未知の AI package キーが混入: ${key}`,
    );
  }
  assert.equal(
    Object.prototype.hasOwnProperty.call(record, "related_diagram"),
    false,
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(record, "relatedDiagram"),
    false,
  );
}

// ---------------------------------------------------------------------------
// A. Form2 milestone
// ---------------------------------------------------------------------------

test("A. Form2 AI required scope の固定フラグ", () => {
  assert.equal(FORM2_AI_EVAL_REQUIRED_SCOPE.includeForm2, true);
  assert.equal(FORM2_AI_EVAL_REQUIRED_SCOPE.includeForm3, false);
  assert.equal(FORM2_AI_EVAL_REQUIRED_SCOPE.includeInformationCards, false);
  assert.equal(FORM2_AI_EVAL_REQUIRED_SCOPE.includeEvidenceLinks, false);
  assert.equal(FORM2_AI_EVAL_REQUIRED_SCOPE.includeFieldReflections, true);
  assert.equal(FORM2_AI_EVAL_REQUIRED_SCOPE.includePatientUnderstanding, true);
});

test("A. Form2: DB default は cards/evidence を含むが AI resolve で除外", () => {
  const dbDefault = defaultScopeForType("form2");
  assert.equal(dbDefault.includeForm2, true);
  assert.equal(dbDefault.includeFieldReflections, true);
  assert.equal(dbDefault.includePatientUnderstanding, true);
  // DB デフォルト（マイルストーン設定）と AI 必須 scope は意図的に乖離し得る
  assert.equal(dbDefault.includeInformationCards, true);
  assert.equal(dbDefault.includeEvidenceLinks, true);
  assert.equal(dbDefault.includeForm3, false);

  const resolved = resolveScopeForAiEvaluationPackage("form2", dbDefault);
  assert.ok(resolved.packageScope);
  assert.equal(resolved.corrected, true);
  assert.equal(resolved.packageScope.includeForm2, true);
  assert.equal(resolved.packageScope.includeForm3, false);
  assert.equal(resolved.packageScope.includeInformationCards, false);
  assert.equal(resolved.packageScope.includeEvidenceLinks, false);
  assert.equal(resolved.packageScope.includeFieldReflections, true);
  assert.equal(resolved.packageScope.includePatientUnderstanding, true);
  assert.ok(
    resolved.warnings.some((w) => w.code === "db_scope_policy_mismatch"),
  );
  assert.ok(
    resolved.warnings.some(
      (w) => w.code === "information_cards_in_scope_against_policy",
    ),
  );
});

test("A. Form2: AI package 投影で cards/evidence/form3 を載せない", () => {
  const scope = scopeForAiEvaluationPackage(
    "form2",
    defaultScopeForType("form2"),
  );
  const prepared = prepareAiEvaluationPackageStudentSubmission(
    baseRecord(),
    scope,
  );
  assert.ok(prepared.form2);
  assert.equal(prepared.form3, null);
  assert.equal(prepared.information_cards.length, 0);
  assert.equal(prepared.evidence_links.length, 0);
  assert.ok(prepared.field_reflections.length > 0);
  assert.ok(prepared.patient_understanding?.overview_text);
  assert.ok(!prepared.included_artifacts.includes("情報カード"));
  assert.ok(!prepared.included_artifacts.includes("様式3"));
  assert.ok(prepared.included_artifacts.includes("様式2"));
  assert.ok(prepared.included_artifacts.includes("フィールド振り返り"));
  assert.ok(prepared.included_artifacts.includes("患者理解"));
});

test("A. Form2: Form3 を DB scope で誤って ON しても AI では OFF", () => {
  const leaked: AssessmentSubmissionScope = {
    ...defaultScopeForType("form2"),
    includeForm3: true,
    form3Scope: { mode: "all_patterns" },
  };
  const resolved = resolveScopeForAiEvaluationPackage("form2", leaked);
  assert.equal(resolved.packageScope?.includeForm3, false);
  assert.ok(resolved.corrections.includes("includeForm3"));
});

// ---------------------------------------------------------------------------
// B. Form3 milestone
// ---------------------------------------------------------------------------

test("B. Form3_progress: Form2 強制 scope で上書きされない", () => {
  const patterns = ["sleep_rest", "activity_exercise"] as const;
  const db = defaultScopeForType("form3_progress", [...patterns]);
  assert.equal(db.includeForm3, true);
  assert.equal(db.form3Scope?.mode, "selected_patterns");
  if (db.form3Scope?.mode === "selected_patterns") {
    assert.deepEqual(db.form3Scope.patternIds, [...patterns]);
  }

  const resolved = resolveScopeForAiEvaluationPackage("form3_progress", db);
  assert.equal(resolved.corrected, false);
  assert.equal(resolved.corrections.length, 0);
  assert.deepEqual(resolved.packageScope, db);
  // Form2 AI 必須へ寄せない
  assert.equal(resolved.packageScope?.includeForm3, true);
  assert.equal(resolved.packageScope?.includeInformationCards, true);
  assert.notDeepEqual(resolved.packageScope, FORM2_AI_EVAL_REQUIRED_SCOPE);
});

test("B. Form3_complete: pattern all が保持され Form2 強制なし", () => {
  const db = defaultScopeForType("form3_complete");
  assert.equal(db.form3Scope?.mode, "all_patterns");
  const resolved = resolveScopeForAiEvaluationPackage("form3_complete", db);
  assert.equal(resolved.corrected, false);
  assert.equal(resolved.packageScope?.form3Scope?.mode, "all_patterns");
  assert.equal(resolved.packageScope?.includeForm3, true);
  assert.equal(resolved.packageScope?.includePatientUnderstanding, true);
});

test("B. Form3: selected_patterns が package 投影でも保持される", () => {
  const scope: AssessmentSubmissionScope = {
    includeForm2: true,
    includeForm3: true,
    form3Scope: {
      mode: "selected_patterns",
      patternIds: ["sleep_rest"],
    },
    includeInformationCards: false,
    includeEvidenceLinks: false,
    includeFieldReflections: false,
    includePatientUnderstanding: true,
  };
  const resolved = resolveScopeForAiEvaluationPackage("form3_progress", scope);
  assert.deepEqual(resolved.packageScope?.form3Scope, scope.form3Scope);

  const prepared = prepareAiEvaluationPackageStudentSubmission(
    baseRecord({ meta: { ...baseRecord().meta, milestone_type: "form3_progress" } }),
    resolved.packageScope,
  );
  assert.ok(prepared.form3);
  const cards = prepared.form3.informationCards as Array<Record<string, unknown>>;
  assert.equal(cards.length, 1);
  assert.equal(cards[0].patternKey, "sleep_rest");
  const flags = prepared.form3.workspacePatternFlags as Record<string, unknown>;
  assert.equal(Object.keys(flags).sort().join(","), "sleep_rest");
});

test("B. Form3: Form2 固有 AI policy（cards 強制 OFF）が漏れない", () => {
  const db: AssessmentSubmissionScope = {
    ...defaultScopeForType("form3_progress", ["sleep_rest"]),
    includeInformationCards: true,
  };
  const resolved = resolveScopeForAiEvaluationPackage("form3_progress", db);
  assert.equal(resolved.packageScope?.includeInformationCards, true);
  assert.ok(
    !resolved.warnings.some(
      (w) => w.code === "information_cards_in_scope_against_policy",
    ),
  );
  assert.ok(
    !resolved.warnings.some((w) => w.code === "db_scope_policy_mismatch"),
  );
});

// ---------------------------------------------------------------------------
// C. 未知 / 将来 artifact（実装せず現行設計を固定）
// ---------------------------------------------------------------------------

test("C. parseSubmissionScope は未知 includeRelatedDiagram を無視する", () => {
  const parsed = parseSubmissionScope({
    includeForm2: true,
    includeForm3: false,
    includeInformationCards: false,
    includeEvidenceLinks: false,
    includeFieldReflections: true,
    includePatientUnderstanding: true,
    includeRelatedDiagram: true,
    relatedDiagram: { nodes: [] },
  });
  assert.equal(
    Object.prototype.hasOwnProperty.call(parsed, "includeRelatedDiagram"),
    false,
  );
  const keys = Object.keys(parsed).sort();
  assert.deepEqual(keys, [
    "form3Scope",
    "includeEvidenceLinks",
    "includeFieldReflections",
    "includeForm2",
    "includeForm3",
    "includeInformationCards",
    "includePatientUnderstanding",
  ].sort());
});

test("C. 清浄レコードの AI package に related_diagram は出ない", () => {
  const prepared = prepareAiEvaluationPackageStudentSubmission(
    baseRecord(),
    FORM2_AI_EVAL_REQUIRED_SCOPE,
  );
  assertKnownAiPackageKeysOnly(prepared);
});

test("C. 未知artifactは AI package から strip される", () => {
  // artifact registry §4: 未知キーは AI へ送らない。
  // related_diagram は未実装のため allowlist 外 → 必ず落ちる。
  const polluted = {
    ...baseRecord(),
    related_diagram: { nodes: [{ id: "n1" }] },
    relatedDiagram: { edges: [] },
    unexpected_future_field: "leak",
  } as AiAnonymizedAssessmentRecord & {
    related_diagram: unknown;
    relatedDiagram: unknown;
    unexpected_future_field: string;
  };
  const prepared = prepareAiEvaluationPackageStudentSubmission(
    polluted,
    FORM2_AI_EVAL_REQUIRED_SCOPE,
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(prepared, "related_diagram"),
    false,
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(prepared, "relatedDiagram"),
    false,
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(prepared, "unexpected_future_field"),
    false,
  );
  assertKnownAiPackageKeysOnly(prepared);
  // 既知・許可 artifact は従来どおり
  assert.ok(prepared.form2);
  assert.equal(prepared.form3, null);
  assert.equal(prepared.information_cards.length, 0);
  assert.equal(prepared.evidence_links.length, 0);
  assert.ok(prepared.field_reflections.length > 0);
  assert.ok(prepared.patient_understanding?.overview_text);
});

test("C. FORM2_AI_EVAL_REQUIRED_SCOPE に将来フラグが混入していない", () => {
  const keys = Object.keys(FORM2_AI_EVAL_REQUIRED_SCOPE).sort();
  assert.deepEqual(keys, [
    "includeEvidenceLinks",
    "includeFieldReflections",
    "includeForm2",
    "includeForm3",
    "includeInformationCards",
    "includePatientUnderstanding",
  ].sort());
});

console.log(`\n${passed} scope×milestone matrix tests passed`);
