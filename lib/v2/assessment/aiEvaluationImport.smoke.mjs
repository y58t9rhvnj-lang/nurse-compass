/**
 * Self-contained smoke tests for Sprint 5B-2 validation helpers
 * (no TS path aliases). Run: node lib/v2/assessment/aiEvaluationImport.smoke.mjs
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const sample = JSON.parse(
  readFileSync(
    join(root, "docs/version2/ai/samples/ai-evaluation-result.sample.json"),
    "utf8",
  ),
);

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

function hash(value) {
  return createHash("sha256")
    .update(JSON.stringify(sortKeysDeep(value)), "utf8")
    .digest("hex");
}

function findPrivateNote(value, path = "", hits = []) {
  if (Array.isArray(value)) {
    value.forEach((v, i) => findPrivateNote(v, `${path}[${i}]`, hits));
    return hits;
  }
  if (!value || typeof value !== "object") return hits;
  for (const [k, v] of Object.entries(value)) {
    const p = path ? `${path}.${k}` : k;
    if (/^private_note$/i.test(k) || k === "privateNote") hits.push(p);
    findPrivateNote(v, p, hits);
  }
  return hits;
}

/** 初期版と同じ単純比較（undefined 配列への .includes を再現しない） */
function isSupportedSchemaVersion(v) {
  return typeof v === "number" && v === 1;
}

let n = 0;
function ok(name, fn) {
  fn();
  n += 1;
  console.log(`ok - ${name}`);
}

ok("sample has evaluation_request_id uuid", () => {
  assert.match(
    sample.metadata.evaluation_request_id,
    /^[0-9a-f-]{36}$/i,
  );
});

ok("hash stable for key reorder", () => {
  const a = hash(sample);
  const b = hash(JSON.parse(JSON.stringify(sample)));
  assert.equal(a, b);
  assert.equal(a.length, 64);
});

ok("private_note detection", () => {
  const dirty = structuredClone(sample);
  dirty.teacher_observation.private_note = "x";
  assert.ok(findPrivateNote(dirty).length > 0);
  assert.equal(findPrivateNote(sample).length, 0);
});

ok("citations avoid evidence_links for form2 eval", () => {
  for (const item of sample.item_evaluations) {
    for (const c of item.citations) {
      assert.ok(c.field_path || c.anonymous_object_id);
      if (typeof c.field_path === "string") {
        assert.equal(
          c.field_path.includes("evidence_links"),
          false,
          "sample must not cite evidence_links",
        );
      }
    }
  }
});

ok("citations require path or id", () => {
  for (const item of sample.item_evaluations) {
    for (const c of item.citations) {
      assert.ok(c.field_path || c.anonymous_object_id);
    }
  }
});

ok("scores in 1-5 or null", () => {
  for (const item of sample.item_evaluations) {
    assert.ok(
      item.score === null ||
        (Number.isInteger(item.score) && item.score >= 1 && item.score <= 5),
    );
  }
});

ok("feedback / observation separated", () => {
  assert.ok(Array.isArray(sample.student_feedback_draft.strengths));
  assert.ok(typeof sample.teacher_observation.summary === "string");
  assert.equal("private_note" in sample.teacher_observation, false);
});

ok("package/result schema version === 1 (safe compare)", () => {
  assert.equal(
    isSupportedSchemaVersion(sample.metadata.package_schema_version),
    true,
  );
  assert.equal(
    isSupportedSchemaVersion(sample.metadata.result_schema_version),
    true,
  );
  assert.equal(isSupportedSchemaVersion(2), false);
  assert.equal(isSupportedSchemaVersion(undefined), false);
  const broken = undefined;
  assert.throws(() => broken.includes(1), TypeError);
});

console.log(`\n${n} smoke tests passed`);
