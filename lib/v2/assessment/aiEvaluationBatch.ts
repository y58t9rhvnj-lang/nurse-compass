/**
 * Sprint 5D — Batch Export / Import（個別処理の薄いオーケストレーション）
 */

import { randomUUID } from "crypto";
import type { AppProfile } from "@/lib/v2/auth/currentUser";
import {
  AI_EXPORT_FREE_TEXT_WARNING,
  summarizeIncludedArtifacts,
} from "@/lib/v2/assessment/aiExportAnonymize";
import {
  buildAiEvalBatchManifest,
  checkManifestAgainstFiles,
  parseAiEvalBatchManifest,
  type AiEvalBatchManifest,
  type ManifestIntegrityIssue,
} from "@/lib/v2/assessment/aiEvaluationBatchManifest";
import {
  AI_EVAL_BATCH_EXPORT_README,
  toUint8Array,
  uint8ToBase64,
  unzipToEntries,
  zipEntriesFromObject,
} from "@/lib/v2/assessment/aiEvaluationBatchZip";
import {
  buildAiExportRecordsFromRows,
  getAiExportIdSecret,
  loadCandidateSubmissionsForMilestone,
  type BuiltAiExportRecord,
} from "@/lib/v2/assessment/aiEvaluationExportCore";
import { buildPackagesForExport } from "@/lib/v2/assessment/aiEvaluationPackageExport";
import {
  importAiEvaluationResultAction,
  previewAiEvaluationImportAction,
} from "@/app/v2/actions/assessmentAiEvaluationImport";
import { writeAiExportAuditLog } from "@/lib/v2/assessment/aiExportAudit";
import { writeAiEvaluationAuditLog } from "@/lib/v2/assessment/aiEvaluationAudit";
import { AI_EVAL_PACKAGE_SCHEMA_VERSION } from "@/lib/v2/assessment/aiEvaluationVersions";
import {
  assertEvaluationRequestInTargetList,
  buildAiEvalFixedTargetList,
  parseAiEvalFixedTargetList,
  type AiEvalFixedTargetList,
} from "@/lib/v2/assessment/aiEvaluationTargetList";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AssessmentSubmissionScope } from "@/lib/v2/assessment/types";

export const AI_EVAL_BATCH_IMPORT_CONCURRENCY = 3;

export type BatchExportPreview = {
  milestoneId: string;
  milestoneTitle: string;
  targetCount: number;
  unsubmittedHint: number | null;
  skippedSnapshot: number;
  generateCount: number;
  freeTextWarning: string;
  includedArtifacts: string[];
  submissionIds: string[];
};

export type BatchExportResult = {
  batchId: string;
  filename: string;
  contentType: string;
  /** base64 ZIP */
  bodyBase64: string;
  packageCount: number;
  /** 固定対象リスト件数（Export / LLM / Import 共通） */
  targetListCount: number;
  auditLogged: boolean;
};

export async function previewBatchExport(input: {
  supabase: SupabaseClient;
  profile: AppProfile;
  milestoneId: string;
  milestoneTitle: string;
  submissionScope: AssessmentSubmissionScope | null;
  /** 指定時はその提出のみ。未指定は評価対象すべて */
  submissionIds?: string[] | null;
  unsubmittedStudentCount?: number | null;
}): Promise<
  | { ok: true; preview: BatchExportPreview }
  | { ok: false; kind: string; message: string }
> {
  const loaded = await loadCandidateSubmissionsForMilestone(
    input.supabase,
    input.profile.organizationId,
    input.milestoneId,
  );
  if (!loaded.ok) return loaded;

  let rows = loaded.rows;
  if (input.submissionIds && input.submissionIds.length > 0) {
    const allow = new Set(input.submissionIds);
    rows = rows.filter((r) => allow.has(r.id));
  }

  const { built, skippedSnapshot } = buildAiExportRecordsFromRows(
    input.profile.organizationId,
    rows,
    input.submissionScope,
  );

  return {
    ok: true,
    preview: {
      milestoneId: input.milestoneId,
      milestoneTitle: input.milestoneTitle,
      targetCount: rows.length,
      unsubmittedHint: input.unsubmittedStudentCount ?? null,
      skippedSnapshot,
      generateCount: built.length,
      freeTextWarning: AI_EXPORT_FREE_TEXT_WARNING,
      includedArtifacts: summarizeIncludedArtifacts(built.map((b) => b.record)),
      submissionIds: built.map((b) => b.submissionId),
    },
  };
}

export async function executeBatchExport(input: {
  supabase: SupabaseClient;
  profile: AppProfile;
  milestoneId: string;
  milestoneTitle: string;
  submissionScope: AssessmentSubmissionScope | null;
  submissionIds?: string[] | null;
}): Promise<
  | { ok: true; result: BatchExportResult }
  | { ok: false; kind: string; message: string }
> {
  const loaded = await loadCandidateSubmissionsForMilestone(
    input.supabase,
    input.profile.organizationId,
    input.milestoneId,
  );
  if (!loaded.ok) return loaded;

  let rows = loaded.rows;
  if (input.submissionIds && input.submissionIds.length > 0) {
    const allow = new Set(input.submissionIds);
    rows = rows.filter((r) => allow.has(r.id));
  }

  const { built, idMapper, idSecret } = buildAiExportRecordsFromRows(
    input.profile.organizationId,
    rows,
    input.submissionScope,
  );
  if (built.length === 0) {
    return {
      ok: false,
      kind: "validation",
      message: "エクスポート対象の提出がありません。",
    };
  }

  const { packages, evaluationRequestIds, exportedBuilt, generatedAtIso } =
    await buildPackagesForExport({
      profile: input.profile,
      built,
      idMapper,
      idSecret,
    });
  if (packages.length === 0) {
    return {
      ok: false,
      kind: "validation",
      message:
        "Package を生成できませんでした（service role / evaluation request を確認してください）。",
    };
  }

  const evalBySubmission = new Map<string, string>();
  for (let i = 0; i < exportedBuilt.length; i++) {
    const reqId = evaluationRequestIds[i];
    const row = exportedBuilt[i];
    if (reqId && row) evalBySubmission.set(row.submissionId, reqId);
  }
  const targetList: AiEvalFixedTargetList = buildAiEvalFixedTargetList({
    milestoneId: input.milestoneId,
    generatedAt: generatedAtIso,
    idSecret: idSecret || getAiExportIdSecret(),
    organizationId: input.profile.organizationId,
    selected: exportedBuilt.map((b) => ({
      submissionId: b.submissionId,
      studentUserId: b.studentUserId,
      milestoneId: b.assessmentMilestoneId,
      submittedAt: "",
      selectionReason: "eligible_real_student_submission" as const,
    })),
    evaluationRequestIdsBySubmissionId: evalBySubmission,
    exclusions: {},
  });

  const batchId = randomUUID();
  const role = input.profile.role === "admin" ? "admin" : "teacher";
  const members = evaluationRequestIds.map((id) => ({
    evaluation_request_id: id,
    path: `packages/${id}.json`,
  }));
  const manifest = buildAiEvalBatchManifest({
    kind: "ai_evaluation_export_batch",
    batchId,
    generatedAt: generatedAtIso,
    generatedByRole: role,
    members,
  });

  const files: Record<string, string> = {
    "manifest.json": JSON.stringify(manifest, null, 2),
    "target-list.json": JSON.stringify(targetList, null, 2),
    "README.txt": AI_EVAL_BATCH_EXPORT_README,
  };
  for (let i = 0; i < packages.length; i++) {
    const id = evaluationRequestIds[i];
    files[`packages/${id}.json`] = JSON.stringify(packages[i], null, 2);
  }

  const zipBytes = zipEntriesFromObject(files);
  const stamp = generatedAtIso.slice(0, 10).replace(/-/g, "");
  const filename = `ai-eval-batch-${stamp}-${packages.length}.zip`;

  const audit = await writeAiExportAuditLog({
    organizationId: input.profile.organizationId,
    actorUserId: input.profile.id,
    actorLoginId: input.profile.loginId,
    actorRole: role,
    milestoneId: input.milestoneId,
    format: "json",
    recordCount: packages.length,
    includedArtifacts: summarizeIncludedArtifacts(built.map((b) => b.record)),
    summary: `AI Evaluation Package 一括エクスポート: ${input.milestoneTitle}（${packages.length}件・zip）`,
    metadata: {
      batch_id: batchId,
      export_kind: "ai_evaluation_package_batch_zip",
      package_schema_version: AI_EVAL_PACKAGE_SCHEMA_VERSION,
      member_count: packages.length,
      target_list_count: targetList.target_count,
      scope_correction_count: built.filter((b) => b.scopeCorrected).length,
      scope_no_correction_count: built.filter((b) => !b.scopeCorrected).length,
      scope_warning_codes: [
        ...new Set(built.flatMap((b) => b.scopeWarnings.map((w) => w.code))),
      ],
    },
  });

  return {
    ok: true,
    result: {
      batchId,
      filename,
      contentType: "application/zip",
      bodyBase64: uint8ToBase64(zipBytes),
      packageCount: packages.length,
      targetListCount: targetList.target_count,
      auditLogged: audit.ok,
    },
  };
}

export type BatchImportMemberPreview = {
  evaluationRequestId: string;
  path: string;
  validationStatus: "ok" | "warning" | "invalid" | "error";
  requestFound: boolean;
  requestExpired: boolean;
  message?: string;
};

export type BatchImportPreview = {
  batchId: string | null;
  canExecute: boolean;
  manifestCount: number;
  fileCount: number;
  evaluationRequestIds: string[];
  missing: string[];
  extra: string[];
  pathMismatches: Array<{
    evaluationRequestId: string;
    expectedPath: string;
    reason: string;
  }>;
  issues: ManifestIntegrityIssue[];
  counts: {
    valid: number;
    warning: number;
    invalid: number;
    duplicateHint: number;
    expired: number;
    error: number;
  };
  members: BatchImportMemberPreview[];
};

export type BatchImportMemberResult = {
  evaluationRequestId: string;
  path: string;
  ok: boolean;
  kind?: string;
  message?: string;
  stagingId?: string;
  validationStatus?: string;
  assessmentSubmissionId?: string;
  assessmentMilestoneId?: string;
  studentUserId?: string;
};

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }
  const n = Math.max(1, Math.min(concurrency, items.length || 1));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return results;
}

export async function previewBatchImportZip(input: {
  profile: AppProfile;
  zipBase64: string;
  fileName?: string;
}): Promise<
  | { ok: true; preview: BatchImportPreview }
  | { ok: false; kind: string; message: string }
> {
  let zipBytes: Uint8Array;
  try {
    zipBytes = toUint8Array(input.zipBase64);
  } catch {
    return { ok: false, kind: "validation", message: "ZIP を読み取れません。" };
  }

  let entries: ReturnType<typeof unzipToEntries>;
  try {
    entries = unzipToEntries(zipBytes);
  } catch {
    return { ok: false, kind: "validation", message: "ZIP が破損しています。" };
  }

  const manifestText = entries.readText("manifest.json");
  if (!manifestText) {
    return {
      ok: false,
      kind: "missing_manifest",
      message: "manifest.json が無いため取込できません。",
    };
  }

  let manifestJson: unknown;
  try {
    manifestJson = JSON.parse(manifestText);
  } catch {
    return {
      ok: false,
      kind: "invalid_manifest",
      message: "manifest.json の JSON が不正です。",
    };
  }

  const parsed = parseAiEvalBatchManifest(manifestJson);
  if (!parsed.ok) {
    return {
      ok: false,
      kind: "invalid_manifest",
      message: parsed.issues[0]?.message ?? "manifest が不正です。",
    };
  }

  const integrity = checkManifestAgainstFiles({
    manifest: parsed.manifest,
    zipPaths: entries.paths,
    memberDirPrefix: "results/",
    expectedKind: "ai_evaluation_import_batch",
  });

  let targetList: AiEvalFixedTargetList | null = null;
  const targetListText = entries.readText("target-list.json");
  if (targetListText) {
    try {
      const parsedList = parseAiEvalFixedTargetList(JSON.parse(targetListText));
      if (!parsedList.ok) {
        return {
          ok: false,
          kind: "invalid_target_list",
          message: parsedList.message,
        };
      }
      targetList = parsedList.list;
    } catch {
      return {
        ok: false,
        kind: "invalid_target_list",
        message: "target-list.json の JSON が不正です。",
      };
    }
  }

  const members: BatchImportMemberPreview[] = [];
  let valid = 0;
  let warning = 0;
  let invalid = 0;
  let expired = 0;
  let error = 0;
  let duplicateHint = 0;

  if (integrity.canExecute) {
    for (const m of parsed.manifest.members) {
      if (targetList) {
        const gate = assertEvaluationRequestInTargetList(
          targetList,
          m.evaluation_request_id,
        );
        if (!gate.ok) {
          members.push({
            evaluationRequestId: m.evaluation_request_id,
            path: m.path,
            validationStatus: "error",
            requestFound: false,
            requestExpired: false,
            message: gate.message,
          });
          error += 1;
          continue;
        }
      }
      const text = entries.readText(m.path);
      if (!text) {
        members.push({
          evaluationRequestId: m.evaluation_request_id,
          path: m.path,
          validationStatus: "error",
          requestFound: false,
          requestExpired: false,
          message: "ファイルを読めません。",
        });
        error += 1;
        continue;
      }
      const prev = await previewAiEvaluationImportAction({
        fileName: m.path,
        jsonText: text,
      });
      if (!prev.ok) {
        members.push({
          evaluationRequestId: m.evaluation_request_id,
          path: m.path,
          validationStatus: "error",
          requestFound: false,
          requestExpired: false,
          message: prev.message,
        });
        error += 1;
        continue;
      }
      const p = prev.preview;
      if (p.requestExpired) expired += 1;
      if (p.validationStatus === "ok") valid += 1;
      else if (p.validationStatus === "warning") warning += 1;
      else invalid += 1;
      // duplicate は実行時に判明することが多いが、エラーコードからヒント
      if (p.errors.some((e) => e.code.includes("duplicate"))) {
        duplicateHint += 1;
      }
      members.push({
        evaluationRequestId: m.evaluation_request_id,
        path: m.path,
        validationStatus: p.validationStatus,
        requestFound: p.requestFound,
        requestExpired: p.requestExpired,
      });
    }
  }

  const canExecuteWithTargetList =
    integrity.canExecute &&
    (!targetList ||
      parsed.manifest.members.every(
        (m) =>
          assertEvaluationRequestInTargetList(
            targetList,
            m.evaluation_request_id,
          ).ok,
      ));

  return {
    ok: true,
    preview: {
      batchId: parsed.manifest.batch_id,
      canExecute: canExecuteWithTargetList,
      manifestCount: integrity.manifestCount,
      fileCount: integrity.fileCount,
      evaluationRequestIds: integrity.evaluationRequestIds,
      missing: integrity.missing,
      extra: integrity.extra,
      pathMismatches: integrity.pathMismatches,
      issues: integrity.issues,
      counts: {
        valid,
        warning,
        invalid,
        duplicateHint,
        expired,
        error,
      },
      members,
    },
  };
}

export async function executeBatchImportZip(input: {
  profile: AppProfile;
  zipBase64: string;
  fileName?: string;
}): Promise<
  | {
      ok: true;
      batchId: string;
      results: BatchImportMemberResult[];
      summary: {
        total: number;
        success: number;
        failed: number;
      };
    }
  | { ok: false; kind: string; message: string }
> {
  const previewed = await previewBatchImportZip(input);
  if (!previewed.ok) return previewed;
  if (!previewed.preview.canExecute) {
    return {
      ok: false,
      kind: "manifest_mismatch",
      message:
        "manifest と実ファイルが一致しないため実行できません。Preview を確認してください。",
    };
  }

  const zipBytes = toUint8Array(input.zipBase64);
  const entries = unzipToEntries(zipBytes);
  const manifestText = entries.readText("manifest.json");
  if (!manifestText) {
    return {
      ok: false,
      kind: "missing_manifest",
      message: "manifest.json が無いため取込できません。",
    };
  }
  const parsed = parseAiEvalBatchManifest(JSON.parse(manifestText));
  if (!parsed.ok) {
    return {
      ok: false,
      kind: "invalid_manifest",
      message: "manifest が不正です。",
    };
  }
  const manifest: AiEvalBatchManifest = parsed.manifest;
  const batchId = manifest.batch_id;
  const role = input.profile.role === "admin" ? "admin" : "teacher";

  let targetList: AiEvalFixedTargetList | null = null;
  const targetListText = entries.readText("target-list.json");
  if (targetListText) {
    const parsedList = parseAiEvalFixedTargetList(JSON.parse(targetListText));
    if (!parsedList.ok) {
      return {
        ok: false,
        kind: "invalid_target_list",
        message: parsedList.message,
      };
    }
    targetList = parsedList.list;
  }

  const results = await mapPool(
    manifest.members,
    AI_EVAL_BATCH_IMPORT_CONCURRENCY,
    async (m) => {
      if (targetList) {
        const gate = assertEvaluationRequestInTargetList(
          targetList,
          m.evaluation_request_id,
        );
        if (!gate.ok) {
          return {
            evaluationRequestId: m.evaluation_request_id,
            path: m.path,
            ok: false,
            kind: gate.kind,
            message: gate.message,
          } satisfies BatchImportMemberResult;
        }
      }
      const text = entries.readText(m.path);
      if (!text) {
        return {
          evaluationRequestId: m.evaluation_request_id,
          path: m.path,
          ok: false,
          kind: "missing_file",
          message: "ファイルを読めません。",
        } satisfies BatchImportMemberResult;
      }
      const imported = await importAiEvaluationResultAction({
        fileName: m.path,
        jsonText: text,
      });
      // 個別 import の audit に batch 情報を追加で残す
      await writeAiEvaluationAuditLog({
        organizationId: input.profile.organizationId,
        actorUserId: input.profile.id,
        actorLoginId: input.profile.loginId,
        actorRole: role,
        action: "assessment.ai_eval.batch_import_member",
        evaluationRequestId: m.evaluation_request_id,
        stagingId: imported.ok ? imported.stagingId : undefined,
        summary: imported.ok
          ? `バッチ取込成功: ${m.path}`
          : `バッチ取込失敗: ${m.path}`,
        metadata: {
          batch_id: batchId,
          member_path: m.path,
          evaluation_request_id: m.evaluation_request_id,
          ok: imported.ok,
          kind: imported.ok ? null : imported.kind,
        },
      });
      if (!imported.ok) {
        return {
          evaluationRequestId: m.evaluation_request_id,
          path: m.path,
          ok: false,
          kind: imported.kind,
          message: imported.message,
        };
      }
      return {
        evaluationRequestId: m.evaluation_request_id,
        path: m.path,
        ok: true,
        stagingId: imported.stagingId,
        validationStatus: imported.validationStatus,
        assessmentSubmissionId: imported.assessmentSubmissionId,
        assessmentMilestoneId: imported.assessmentMilestoneId,
        studentUserId: imported.studentUserId,
      };
    },
  );

  const success = results.filter((r) => r.ok).length;
  await writeAiEvaluationAuditLog({
    organizationId: input.profile.organizationId,
    actorUserId: input.profile.id,
    actorLoginId: input.profile.loginId,
    actorRole: role,
    action: "assessment.ai_eval.batch_import",
    summary: `AI評価一括取込: 成功 ${success}/${results.length}`,
    metadata: {
      batch_id: batchId,
      total: results.length,
      success,
      failed: results.length - success,
      file_name: input.fileName ?? null,
    },
  });

  return {
    ok: true,
    batchId,
    results,
    summary: {
      total: results.length,
      success,
      failed: results.length - success,
    },
  };
}

/** 型参照維持（未使用警告回避） */
export type _Built = BuiltAiExportRecord;
