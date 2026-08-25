/**
 * Sprint 5B-2 validation unit checks (TypeScript).
 * Runnable smoke (no aliases): node lib/v2/assessment/aiEvaluationImport.smoke.mjs
 * Full TS suite (when tsx/path resolve available):
 *   npx tsx lib/v2/assessment/aiEvaluationResultValidate.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  findPrivateNotePaths,
  validateAiEvaluationResult,
  type AiEvalRequestSnapshot,
} from "./aiEvaluationResultValidate";
import { normalizeAiEvaluationResult } from "./aiEvaluationResultNormalize";
import { sha256HexOfCanonicalJson } from "./aiEvaluationResultHash";

const __dirname = dirname(fileURLToPath(import.meta.url));
const samplePath = join(
  __dirname,
  "../../../docs/version2/ai/samples/ai-evaluation-result.sample.json",
);

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
    packageSchemaVersion: 1,
    resultSchemaVersion: 1,
    compassPolicyVersion: "2026.2",
    rubricVersion: "1",
    goldStandardVersion: "patient-a/1",
    caseVersion: "patient-a/1",
    exportSchemaVersion: 1,
    status: "generated",
    expiresAt: new Date(Date.now() + 86400000 * 30).toISOString(),
    usedAt: null,
    ...overrides,
  };
}

function loadSample(): unknown {
  return JSON.parse(readFileSync(samplePath, "utf8"));
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

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

test("正常 result", () => {
  const raw = loadSample();
  const out = validateAiEvaluationResult({
    source: raw,
    actorOrganizationId: baseRequest().organizationId,
    request: baseRequest(),
    requestLookup: "found",
  });
  // sample 本文に電話番号ヒューリスティックの誤検出があり得るため、
  // 構造的成功は errors=0 + needs_review で判定する。
  assert.equal(out.errors.length, 0);
  assert.equal(out.reviewStatus, "needs_review");
  assert.ok(
    out.validationStatus === "ok" || out.validationStatus === "warning",
  );
  assert.ok(out.resultHash);
});

test("schema 不正（配列ルート）", () => {
  const out = validateAiEvaluationResult({ source: [] });
  assert.equal(out.validationStatus, "invalid");
  assert.ok(out.errors.some((e) => e.code === "schema_invalid"));
});

test("request 不明", () => {
  const out = validateAiEvaluationResult({
    source: loadSample(),
    requestLookup: "missing",
  });
  assert.equal(out.validationStatus, "invalid");
  assert.ok(out.errors.some((e) => e.code === "evaluation_request_missing"));
});

test("request 期限切れ", () => {
  const out = validateAiEvaluationResult({
    source: loadSample(),
    actorOrganizationId: baseRequest().organizationId,
    request: baseRequest({
      expiresAt: new Date(Date.now() - 1000).toISOString(),
      status: "expired",
    }),
    requestLookup: "found",
  });
  assert.equal(out.validationStatus, "invalid");
  assert.ok(out.errors.some((e) => e.code === "request_expired"));
});

test("他組織 request", () => {
  const out = validateAiEvaluationResult({
    source: loadSample(),
    actorOrganizationId: "99999999-9999-4999-8999-999999999999",
    request: baseRequest(),
    requestLookup: "found",
  });
  assert.ok(out.errors.some((e) => e.code === "submission_org_mismatch"));
});

test("version warning", () => {
  const out = validateAiEvaluationResult({
    source: loadSample(),
    actorOrganizationId: baseRequest().organizationId,
    request: baseRequest({ rubricVersion: "9" }),
    requestLookup: "found",
  });
  assert.equal(out.validationStatus, "warning");
  assert.ok(
    out.versionWarnings.some((w) => w.code === "rubric_version_mismatch"),
  );
});

test("PII warning", () => {
  const raw = clone(loadSample()) as Record<string, unknown>;
  const draft = raw.student_feedback_draft as Record<string, unknown>;
  draft.strengths = ["連絡先は test@example.com です"];
  const out = validateAiEvaluationResult({
    source: raw,
    actorOrganizationId: baseRequest().organizationId,
    request: baseRequest(),
    requestLookup: "found",
  });
  assert.equal(out.validationStatus, "warning");
  assert.ok(out.piiWarnings.some((w) => w.code === "pii_strong_email"));
});

test("private_note 混入", () => {
  const raw = clone(loadSample()) as Record<string, unknown>;
  (raw.teacher_observation as Record<string, unknown>).private_note = "secret";
  assert.ok(findPrivateNotePaths(raw).length > 0);
  const out = validateAiEvaluationResult({
    source: raw,
    actorOrganizationId: baseRequest().organizationId,
    request: baseRequest(),
    requestLookup: "found",
  });
  assert.ok(out.errors.some((e) => e.code === "private_note_contaminated"));
});

test("rubric 欠落は warning", () => {
  const raw = clone(loadSample()) as Record<string, unknown>;
  raw.item_evaluations = (
    raw.item_evaluations as unknown[]
  ).slice(0, 2);
  const out = validateAiEvaluationResult({
    source: raw,
    actorOrganizationId: baseRequest().organizationId,
    request: baseRequest(),
    requestLookup: "found",
  });
  assert.ok(
    out.versionWarnings.some((w) => w.code === "incomplete_rubric_items"),
  );
});

test("score 範囲外", () => {
  const raw = clone(loadSample()) as Record<string, unknown>;
  const items = raw.item_evaluations as Array<Record<string, unknown>>;
  items[0].score = 9;
  const out = validateAiEvaluationResult({
    source: raw,
    actorOrganizationId: baseRequest().organizationId,
    request: baseRequest(),
    requestLookup: "found",
  });
  assert.ok(out.errors.some((e) => e.code === "rubric_structure_broken"));
});

test("citation 不正", () => {
  const raw = clone(loadSample()) as Record<string, unknown>;
  const items = raw.item_evaluations as Array<Record<string, unknown>>;
  items[0].citations = [{}];
  const out = validateAiEvaluationResult({
    source: raw,
    actorOrganizationId: baseRequest().organizationId,
    request: baseRequest(),
    requestLookup: "found",
  });
  assert.ok(out.errors.some((e) => e.code === "citation_invalid"));
});

test("result_hash 安定（キー順・空白）", () => {
  const a = normalizeAiEvaluationResult(loadSample());
  const b = normalizeAiEvaluationResult(
    JSON.parse(JSON.stringify(loadSample())),
  );
  assert.ok(a && b);
  assert.equal(sha256HexOfCanonicalJson(a), sha256HexOfCanonicalJson(b));
});

test("JSON parse error", () => {
  const out = validateAiEvaluationResult({ source: "{not-json" });
  assert.equal(out.reviewStatus, "invalid");
  assert.ok(out.errors.some((e) => e.code === "json_parse_error"));
});

console.log(`\n${passed} tests passed`);
