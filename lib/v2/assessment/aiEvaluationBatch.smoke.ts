/**
 * Sprint 5D — Package builder / manifest / zip smoke
 * Run: npx tsx lib/v2/assessment/aiEvaluationBatch.smoke.ts
 */

import { randomUUID } from "crypto";
import {
  assertAiEvaluationPackageShape,
  buildAiEvaluationPackage,
  toPackageStudentSubmission,
} from "./aiEvaluationPackageBuilder";
import {
  buildAiEvalBatchManifest,
  checkManifestAgainstFiles,
  parseAiEvalBatchManifest,
} from "./aiEvaluationBatchManifest";
import {
  AI_EVAL_BATCH_EXPORT_README,
  unzipToEntries,
  zipEntriesFromObject,
} from "./aiEvaluationBatchZip";
import { createAiAnonymousIdMapper } from "./aiExportAnonymize";
import type { AiAnonymizedAssessmentRecord } from "./aiExportAnonymize";

let failed = 0;
function check(label: string, cond: boolean) {
  if (cond) console.log(`ok - ${label}`);
  else {
    console.error(`FAIL - ${label}`);
    failed += 1;
  }
}

function sampleSubmission(): AiAnonymizedAssessmentRecord {
  return {
    schema_version: 1,
    export_kind: "assessment_submission",
    anonymous_ids: {
      case_id: "case_aaaaaaaaaaaaaaaa",
      cycle_id: "cyc_bbbbbbbbbbbbbbbb",
      milestone_id: "ms_cccccccccccccccc",
      submission_id: "sub_dddddddddddddddd",
    },
    meta: {
      timing_status: "on_time",
      submission_number: 1,
      submitted_at: "2026-08-20T05:30:00.000Z",
      evaluation_type: "formative",
      milestone_type: "midterm",
      cycle_title: "課題1",
      milestone_title: "評価時点1",
    },
    included_artifacts: ["様式2"],
    form2: { version: 1 },
    form3: null,
    information_cards: [],
    evidence_links: [],
    field_reflections: [],
    patient_understanding: null,
    source_versions: { form2: 1, form3: null, patient_understanding: null },
  };
}

const idSecret = "smoke-secret";
const orgKey = "org-smoke";
const idMapper = createAiAnonymousIdMapper(idSecret, orgKey);

const reqId = randomUUID();
const pkg = buildAiEvaluationPackage({
  evaluationRequestId: reqId,
  generatedAt: new Date().toISOString(),
  generatedByRole: "teacher",
  studentSubmission: sampleSubmission(),
  patientId: "A",
  idMapper,
  idSecret,
  organizationScopeKey: orgKey,
});

const shape = assertAiEvaluationPackageShape(pkg);
check("package shape ok", shape.ok);
check(
  "metadata.evaluation_request_id",
  pkg.metadata.evaluation_request_id === reqId,
);
check(
  "student_submission has no evaluation_request_id",
  !("evaluation_request_id" in pkg.student_submission),
);
check(
  "toPackageStudentSubmission strips id",
  !("evaluation_request_id" in
    toPackageStudentSubmission({
      ...sampleSubmission(),
      evaluation_request_id: reqId,
    })),
);

const members = Array.from({ length: 3 }, () => {
  const id = randomUUID();
  return { evaluation_request_id: id, path: `packages/${id}.json` };
});
const manifest = buildAiEvalBatchManifest({
  kind: "ai_evaluation_export_batch",
  batchId: randomUUID(),
  generatedAt: new Date().toISOString(),
  generatedByRole: "teacher",
  members,
});
const parsed = parseAiEvalBatchManifest(manifest);
check("manifest parse", parsed.ok);

const files: Record<string, string> = {
  "manifest.json": JSON.stringify(manifest),
  "README.txt": AI_EVAL_BATCH_EXPORT_README,
};
for (const m of members) {
  files[m.path] = JSON.stringify(pkg);
}
const zip = zipEntriesFromObject(files);
const entries = unzipToEntries(zip);
check("zip has manifest", entries.readText("manifest.json") != null);
check("zip has README", entries.readText("README.txt")?.includes("用途") === true);

const integrityOk = checkManifestAgainstFiles({
  manifest,
  zipPaths: entries.paths,
  memberDirPrefix: "packages/",
  expectedKind: "ai_evaluation_export_batch",
});
check("manifest integrity ok", integrityOk.canExecute);

const broken = checkManifestAgainstFiles({
  manifest,
  zipPaths: entries.paths.filter((p) => !p.endsWith(`${members[0].evaluation_request_id}.json`)),
  memberDirPrefix: "packages/",
  expectedKind: "ai_evaluation_export_batch",
});
check("missing file blocks execute", !broken.canExecute && broken.missing.length === 1);

// 70 member zip load (memory smoke)
const many = Array.from({ length: 70 }, () => {
  const id = randomUUID();
  return { evaluation_request_id: id, path: `packages/${id}.json` };
});
const manyManifest = buildAiEvalBatchManifest({
  kind: "ai_evaluation_export_batch",
  batchId: randomUUID(),
  generatedAt: new Date().toISOString(),
  generatedByRole: "teacher",
  members: many,
});
const manyFiles: Record<string, string> = {
  "manifest.json": JSON.stringify(manyManifest),
  "README.txt": AI_EVAL_BATCH_EXPORT_README,
};
for (const m of many) {
  manyFiles[m.path] = JSON.stringify({
    ...pkg,
    metadata: { ...pkg.metadata, evaluation_request_id: m.evaluation_request_id },
  });
}
const t0 = Date.now();
const manyZip = zipEntriesFromObject(manyFiles);
const manyEntries = unzipToEntries(manyZip);
const elapsed = Date.now() - t0;
check("70 packages zip roundtrip", manyEntries.paths.length >= 72);
check("70 packages under 15s", elapsed < 15000);
console.log(`70-pack zip bytes=${manyZip.byteLength} elapsed_ms=${elapsed}`);

if (failed > 0) {
  console.error(`\n${failed} checks failed`);
  process.exit(1);
}
console.log("\n5D batch smoke passed");
