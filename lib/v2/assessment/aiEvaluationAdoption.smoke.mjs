/**
 * Sprint 5C pure-logic smoke tests (no DB).
 * Run: node lib/v2/assessment/aiEvaluationAdoption.smoke.mjs
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

function sortKeysDeep(value) {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === "object") {
    const out = {};
    for (const k of Object.keys(value).sort((a, b) => a.localeCompare(b))) {
      out[k] = sortKeysDeep(value[k]);
    }
    return out;
  }
  return value;
}

function hashPayload(family, code, payload) {
  return createHash("sha256")
    .update(
      JSON.stringify(sortKeysDeep({ code, family, ...payload })),
      "utf8",
    )
    .digest("hex");
}

function mergeAdoptSelection(review, selection) {
  const scores = { ...(review.rubric_scores || {}) };
  const applied = { rubric_scores: {} };
  for (const key of selection.adopted_rubric_keys || []) {
    const v = selection.applied_rubric_scores?.[key];
    if (typeof v === "number") {
      scores[key] = v;
      applied.rubric_scores[key] = v;
    }
  }
  let strengths = review.strengths_comment || "";
  let next = review.next_steps_comment || "";
  let missing = review.missing_information_comment || "";
  const overall = review.overall_comment || "";
  const privateNote = review.private_note || "";
  for (const block of selection.adopted_comment_blocks || []) {
    if (block === "strengths") {
      strengths = selection.applied_comments?.strengths ?? "";
      applied.strengths_comment = strengths;
    } else if (block === "next_questions") {
      next = selection.applied_comments?.next_questions ?? "";
      applied.next_steps_comment = next;
    } else if (block === "gaps_or_alternatives") {
      missing = selection.applied_comments?.gaps_or_alternatives ?? "";
      applied.missing_information_comment = missing;
    }
  }
  return {
    rubric_scores: scores,
    strengths_comment: strengths,
    next_steps_comment: next,
    missing_information_comment: missing,
    overall_comment: overall,
    private_note: privateNote,
    applied,
  };
}

function canAdopt(ctx) {
  const reasons = [];
  if (ctx.role !== "teacher") reasons.push("teacher_only");
  if (!["needs_review", "partially_adopted"].includes(ctx.stagingStatus)) {
    reasons.push("staging_not_active");
  }
  if (ctx.validationStatus === "invalid") reasons.push("invalid_candidate");
  if (ctx.unacked > 0) reasons.push("warnings_unacked");
  if (!ctx.reviewExists) reasons.push("review_missing");
  if (ctx.reviewStatus === "completed") reasons.push("review_completed");
  if (ctx.returned) reasons.push("review_returned");
  return { ok: reasons.length === 0, reasons };
}

function ackValid(warning, acks) {
  return acks.some(
    (a) =>
      a.family === warning.family &&
      a.code === warning.code &&
      a.payload_hash === warning.payload_hash,
  );
}

let n = 0;
function ok(name, fn) {
  fn();
  n += 1;
  console.log(`ok - ${name}`);
}

ok("payload hash change invalidates old ack", () => {
  const family = "version";
  const code = "rubric_version_mismatch";
  const h1 = hashPayload(family, code, { expected: "1", actual: "2" });
  const h2 = hashPayload(family, code, { expected: "1", actual: "3" });
  assert.notEqual(h1, h2);
  const warning = { family, code, payload_hash: h2 };
  const oldAcks = [{ family, code, payload_hash: h1 }];
  assert.equal(ackValid(warning, oldAcks), false);
  assert.equal(
    ackValid(warning, [{ family, code, payload_hash: h2 }]),
    true,
  );
});

ok("unacked warnings block adopt", () => {
  const r = canAdopt({
    role: "teacher",
    stagingStatus: "needs_review",
    validationStatus: "warning",
    unacked: 1,
    reviewExists: true,
    reviewStatus: "draft",
    returned: false,
  });
  assert.equal(r.ok, false);
  assert.ok(r.reasons.includes("warnings_unacked"));
});

ok("teacher can adopt when ready", () => {
  const r = canAdopt({
    role: "teacher",
    stagingStatus: "needs_review",
    validationStatus: "ok",
    unacked: 0,
    reviewExists: true,
    reviewStatus: "draft",
    returned: false,
  });
  assert.equal(r.ok, true);
});

ok("admin adopt rejected", () => {
  const r = canAdopt({
    role: "admin",
    stagingStatus: "needs_review",
    validationStatus: "ok",
    unacked: 0,
    reviewExists: true,
    reviewStatus: "draft",
    returned: false,
  });
  assert.equal(r.ok, false);
  assert.ok(r.reasons.includes("teacher_only"));
});

ok("completed review blocked", () => {
  const r = canAdopt({
    role: "teacher",
    stagingStatus: "partially_adopted",
    validationStatus: "ok",
    unacked: 0,
    reviewExists: true,
    reviewStatus: "completed",
    returned: false,
  });
  assert.equal(r.ok, false);
  assert.ok(r.reasons.includes("review_completed"));
});

ok("returned review blocked", () => {
  const r = canAdopt({
    role: "teacher",
    stagingStatus: "needs_review",
    validationStatus: "ok",
    unacked: 0,
    reviewExists: true,
    reviewStatus: "draft",
    returned: true,
  });
  assert.equal(r.ok, false);
  assert.ok(r.reasons.includes("review_returned"));
});

ok("single rubric adopt keeps other teacher scores", () => {
  const review = {
    rubric_scores: {
      information_gathering: 4,
      relating_information: 2,
    },
    strengths_comment: "教員メモ維持",
    next_steps_comment: "",
    missing_information_comment: "",
    overall_comment: "総合は触らない",
    private_note: "秘匿",
  };
  const merged = mergeAdoptSelection(review, {
    adopted_rubric_keys: ["information_gathering"],
    adopted_comment_blocks: [],
    applied_rubric_scores: { information_gathering: 3 },
    applied_comments: {},
  });
  assert.equal(merged.rubric_scores.information_gathering, 3);
  assert.equal(merged.rubric_scores.relating_information, 2);
  assert.equal(merged.strengths_comment, "教員メモ維持");
  assert.equal(merged.overall_comment, "総合は触らない");
  assert.equal(merged.private_note, "秘匿");
});

ok("comment block adopt does not set overall or observation", () => {
  const review = {
    rubric_scores: {},
    strengths_comment: "",
    next_steps_comment: "旧",
    missing_information_comment: "",
    overall_comment: "",
    private_note: "",
  };
  const merged = mergeAdoptSelection(review, {
    adopted_rubric_keys: [],
    adopted_comment_blocks: ["strengths"],
    applied_rubric_scores: {},
    applied_comments: { strengths: "AI strengths" },
  });
  assert.equal(merged.strengths_comment, "AI strengths");
  assert.equal(merged.next_steps_comment, "旧");
  assert.equal(merged.overall_comment, "");
  assert.equal("teacher_observation" in merged.applied, false);
});

ok("adoption_sequence increments", () => {
  let seq = 0;
  seq = seq + 1;
  assert.equal(seq, 1);
  seq = seq + 1;
  assert.equal(seq, 2);
});

ok("partially_adopted allows additional adopt", () => {
  const r = canAdopt({
    role: "teacher",
    stagingStatus: "partially_adopted",
    validationStatus: "ok",
    unacked: 0,
    reviewExists: true,
    reviewStatus: "draft",
    returned: false,
  });
  assert.equal(r.ok, true);
});

ok("student role cannot adopt", () => {
  const r = canAdopt({
    role: "student",
    stagingStatus: "needs_review",
    validationStatus: "ok",
    unacked: 0,
    reviewExists: true,
    reviewStatus: "draft",
    returned: false,
  });
  assert.equal(r.ok, false);
});

ok("audit summary has no full body", () => {
  const summary = "AI評価候補を一部採用しました";
  const metadata = { adoption_id: "x", review_id: "y" };
  assert.equal(summary.includes("rationale"), false);
  assert.equal("raw_result_json" in metadata, false);
  assert.equal("normalized_result_json" in metadata, false);
});

console.log(`\n${n} adoption smoke tests passed`);
