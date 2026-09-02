/**
 * Import Core 純関数回帰（DB 非依存）。
 * Run: npx tsx lib/v2/assessment/aiEvaluationImportCore.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildAiEvaluationImportPreview,
  runAiEvaluationImportValidation,
} from "./aiEvaluationImportValidation";
import type { AiEvalRequestSnapshot } from "./aiEvaluationResultValidate";
import {
  AI_EVAL_COMPASS_POLICY_VERSION,
  AI_EVAL_PACKAGE_SCHEMA_VERSION,
  AI_EVAL_RESULT_SCHEMA_VERSION,
  AI_EVAL_RUBRIC_VERSION,
} from "./aiEvaluationVersions";

const __dirname = dirname(fileURLToPath(import.meta.url));
const samplePath = join(
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

function loadSample(): Record<string, unknown> {
  return JSON.parse(readFileSync(samplePath, "utf8")) as Record<string, unknown>;
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function baseRequest(
  overrides: Partial<AiEvalRequestSnapshot> = {},
): AiEvalRequestSnapshot {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    organizationId: "22222222-2222-4222-8222-222222222222",
    assessmentSubmissionId: "33333333-3333-4333-8333-333333333333",
    assessmentCycleId: "44444444-4444-4444-8444-444444444444",
    assessmentMilestoneId: "55555555-5555-4555-8555-555555555555",
    studentUserId: "66666666-6666-4666-8666-666666666666",
    evaluationRequestId: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    packageSchemaVersion: AI_EVAL_PACKAGE_SCHEMA_VERSION,
    resultSchemaVersion: AI_EVAL_RESULT_SCHEMA_VERSION,
    compassPolicyVersion: AI_EVAL_COMPASS_POLICY_VERSION,
    rubricVersion: AI_EVAL_RUBRIC_VERSION,
    goldStandardVersion: "patient-a/1",
    caseVersion: "patient-a/1",
    exportSchemaVersion: 1,
    status: "generated",
    expiresAt: new Date(Date.now() + 86400000 * 30).toISOString(),
    usedAt: null,
    ...overrides,
  };
}

test("valid result → valid/warning + needs_review", () => {
  const { validated, requestExpired } = runAiEvaluationImportValidation({
    jsonText: JSON.stringify(loadSample()),
    organizationId: baseRequest().organizationId,
    request: baseRequest(),
    requestLookup: "found",
  });
  assert.equal(requestExpired, false);
  assert.equal(validated.errors.length, 0);
  assert.ok(
    validated.validationStatus === "ok" ||
      validated.validationStatus === "warning",
  );
  assert.equal(validated.reviewStatus, "needs_review");
  const preview = buildAiEvaluationImportPreview({
    fileName: "result.json",
    validated,
    requestFound: true,
    requestExpired: false,
  });
  assert.equal(preview.validationStatus, validated.validationStatus);
  assert.equal(preview.requestFound, true);
});

test("malformed result → invalid", () => {
  const { validated } = runAiEvaluationImportValidation({
    jsonText: "not-json{",
    organizationId: baseRequest().organizationId,
    request: null,
    requestLookup: "skipped",
  });
  assert.equal(validated.validationStatus, "invalid");
  assert.equal(validated.reviewStatus, "invalid");
  assert.ok(validated.errors.some((e) => e.code === "json_parse_error"));
});

test("private_note → invalid", () => {
  const raw = clone(loadSample());
  (raw.teacher_observation as Record<string, unknown>).private_note = "secret";
  const { validated } = runAiEvaluationImportValidation({
    jsonText: JSON.stringify(raw),
    organizationId: baseRequest().organizationId,
    request: baseRequest(),
    requestLookup: "found",
  });
  assert.equal(validated.validationStatus, "invalid");
  assert.ok(
    validated.errors.some((e) => e.code === "private_note_contaminated"),
  );
});

test("unsupported schema → invalid（従来どおり）", () => {
  const raw = clone(loadSample());
  (raw.metadata as Record<string, unknown>).package_schema_version = 2;
  const { validated } = runAiEvaluationImportValidation({
    jsonText: JSON.stringify(raw),
    organizationId: baseRequest().organizationId,
    request: baseRequest(),
    requestLookup: "found",
  });
  assert.equal(validated.validationStatus, "invalid");
  assert.ok(
    validated.errors.some((e) => e.code === "unsupported_package_schema"),
  );
});

test("warning条件 → warning（invalid にしない）", () => {
  const { validated } = runAiEvaluationImportValidation({
    jsonText: JSON.stringify(loadSample()),
    organizationId: baseRequest().organizationId,
    request: baseRequest({ rubricVersion: "9" }),
    requestLookup: "found",
  });
  assert.equal(validated.validationStatus, "warning");
  assert.equal(validated.reviewStatus, "needs_review");
  assert.ok(
    validated.versionWarnings.some((w) => w.code === "rubric_version_mismatch"),
  );
  assert.equal(validated.errors.length, 0);
});

test("empty json → preliminary invalid path still returns outcome", () => {
  const { validated } = runAiEvaluationImportValidation({
    jsonText: "",
    organizationId: baseRequest().organizationId,
    request: null,
    requestLookup: "missing",
  });
  assert.equal(validated.validationStatus, "invalid");
});

console.log(`\n${passed} import core tests passed`);
