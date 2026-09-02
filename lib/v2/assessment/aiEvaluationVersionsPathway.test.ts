/**
 * Version helper 単一経路の回帰固定（Version 2.2）。
 * aiEvaluationVersions と Result validator の受理範囲を突き合わせる。
 *
 * Run: npx tsx lib/v2/assessment/aiEvaluationVersionsPathway.test.ts
 *
 * 注意: validator が magic number（!== 1）依存の場合でも、
 * 本 Step では本体を修正せず、helper との一致/差分をテストで可視化する。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateAiEvaluationResult,
  type AiEvalRequestSnapshot,
} from "./aiEvaluationResultValidate";
import {
  AI_EVAL_COMPASS_POLICY_VERSION,
  AI_EVAL_PACKAGE_SCHEMA_VERSION,
  AI_EVAL_RESULT_SCHEMA_VERSION,
  AI_EVAL_RUBRIC_VERSION,
  AI_EVAL_SUPPORTED_PACKAGE_SCHEMA_VERSIONS,
  AI_EVAL_SUPPORTED_RESULT_SCHEMA_VERSIONS,
  isSupportedAiEvalPackageSchemaVersion,
  isSupportedAiEvalResultSchemaVersion,
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

function validateWithMeta(metaPatch: Record<string, unknown>) {
  const raw = clone(loadSample());
  raw.metadata = { ...(raw.metadata as Record<string, unknown>), ...metaPatch };
  return validateAiEvaluationResult({
    source: raw,
    actorOrganizationId: baseRequest().organizationId,
    request: baseRequest(),
    requestLookup: "found",
  });
}

function packageSchemaAcceptedByValidator(version: number): boolean {
  const out = validateWithMeta({ package_schema_version: version });
  return !out.errors.some((e) => e.code === "unsupported_package_schema");
}

function resultSchemaAcceptedByValidator(version: number): boolean {
  const out = validateWithMeta({ result_schema_version: version });
  return !out.errors.some((e) => e.code === "unsupported_result_schema");
}

// ---------------------------------------------------------------------------
// 現行定数
// ---------------------------------------------------------------------------

test("現行 supported 定数: package/result=1, policy=2026.4, rubric=3", () => {
  assert.equal(AI_EVAL_PACKAGE_SCHEMA_VERSION, 1);
  assert.equal(AI_EVAL_RESULT_SCHEMA_VERSION, 1);
  assert.equal(AI_EVAL_COMPASS_POLICY_VERSION, "2026.4");
  assert.equal(AI_EVAL_RUBRIC_VERSION, "3");
  assert.deepEqual([...AI_EVAL_SUPPORTED_PACKAGE_SCHEMA_VERSIONS], [1]);
  assert.deepEqual([...AI_EVAL_SUPPORTED_RESULT_SCHEMA_VERSIONS], [1]);
});

test("versions helper: 1 のみ supported", () => {
  assert.equal(isSupportedAiEvalPackageSchemaVersion(1), true);
  assert.equal(isSupportedAiEvalPackageSchemaVersion(2), false);
  assert.equal(isSupportedAiEvalPackageSchemaVersion(0), false);
  assert.equal(isSupportedAiEvalResultSchemaVersion(1), true);
  assert.equal(isSupportedAiEvalResultSchemaVersion(2), false);
  assert.equal(isSupportedAiEvalResultSchemaVersion(99), false);
});

test("sample result metadata が helper 定数と一致", () => {
  const meta = loadSample().metadata as Record<string, unknown>;
  assert.equal(meta.package_schema_version, AI_EVAL_PACKAGE_SCHEMA_VERSION);
  assert.equal(meta.result_schema_version, AI_EVAL_RESULT_SCHEMA_VERSION);
  assert.equal(meta.compass_policy_version, AI_EVAL_COMPASS_POLICY_VERSION);
  assert.equal(meta.rubric_version, AI_EVAL_RUBRIC_VERSION);
});

// ---------------------------------------------------------------------------
// helper ↔ validator 受理一致
// ---------------------------------------------------------------------------

test("package schema: helper と validator の受理が一致（probe 0,1,2,99）", () => {
  for (const v of [0, 1, 2, 99]) {
    const helper = isSupportedAiEvalPackageSchemaVersion(v);
    const validator = packageSchemaAcceptedByValidator(v);
    assert.equal(
      helper,
      validator,
      `package_schema_version drift at ${v}: helper=${helper} validator=${validator}`,
    );
  }
});

test("result schema: helper と validator の受理が一致（probe 0,1,2,99）", () => {
  for (const v of [0, 1, 2, 99]) {
    const helper = isSupportedAiEvalResultSchemaVersion(v);
    const validator = resultSchemaAcceptedByValidator(v);
    assert.equal(
      helper,
      validator,
      `result_schema_version drift at ${v}: helper=${helper} validator=${validator}`,
    );
  }
});

test("supported schema=1 は validator が構造エラーにしない（unsupported_* なし）", () => {
  const out = validateWithMeta({
    package_schema_version: 1,
    result_schema_version: 1,
    compass_policy_version: AI_EVAL_COMPASS_POLICY_VERSION,
    rubric_version: AI_EVAL_RUBRIC_VERSION,
  });
  assert.ok(!out.errors.some((e) => e.code === "unsupported_package_schema"));
  assert.ok(!out.errors.some((e) => e.code === "unsupported_result_schema"));
  assert.equal(out.errors.length, 0);
  assert.ok(
    out.validationStatus === "ok" || out.validationStatus === "warning",
  );
});

test("unsupported package schema=2 は error（unsupported_package_schema）", () => {
  const out = validateWithMeta({ package_schema_version: 2 });
  assert.equal(out.validationStatus, "invalid");
  assert.ok(out.errors.some((e) => e.code === "unsupported_package_schema"));
});

test("unsupported result schema=2 は error（unsupported_result_schema）", () => {
  const out = validateWithMeta({ result_schema_version: 2 });
  assert.equal(out.validationStatus, "invalid");
  assert.ok(out.errors.some((e) => e.code === "unsupported_result_schema"));
});

test("policy/rubric 不一致は既存仕様どおり warning（invalid にしない）", () => {
  const out = validateWithMeta({
    compass_policy_version: "2026.3",
    rubric_version: "2",
  });
  // request は現行 2026.4 / 3 のため mismatch warning
  assert.ok(out.errors.length === 0 || out.validationStatus !== "invalid");
  assert.ok(
    out.versionWarnings.some((w) => w.code === "compass_policy_version_mismatch") ||
      out.versionWarnings.some((w) => w.code === "rubric_version_mismatch"),
  );
  assert.ok(
    out.validationStatus === "warning" || out.validationStatus === "ok",
  );
  // 現行は schema unsupported のみ fatal。policy/rubric は warning。
  assert.equal(out.validationStatus, "warning");
});

// ---------------------------------------------------------------------------
// helper 単一経路（magic number 除去後）
// ---------------------------------------------------------------------------

test("validator schema 判定は isSupported* helper 経路と一致する", () => {
  assert.equal(AI_EVAL_SUPPORTED_PACKAGE_SCHEMA_VERSIONS.length, 1);
  assert.equal(AI_EVAL_SUPPORTED_PACKAGE_SCHEMA_VERSIONS[0], 1);
  assert.equal(AI_EVAL_SUPPORTED_RESULT_SCHEMA_VERSIONS.length, 1);
  assert.equal(AI_EVAL_SUPPORTED_RESULT_SCHEMA_VERSIONS[0], 1);

  for (const v of [-1, 0, 1, 2, 3, 10, 99]) {
    assert.equal(
      isSupportedAiEvalPackageSchemaVersion(v),
      packageSchemaAcceptedByValidator(v),
      `package schema pathway mismatch at ${v}`,
    );
    assert.equal(
      isSupportedAiEvalResultSchemaVersion(v),
      resultSchemaAcceptedByValidator(v),
      `result schema pathway mismatch at ${v}`,
    );
  }
});

console.log(`\n${passed} version pathway tests passed`);
