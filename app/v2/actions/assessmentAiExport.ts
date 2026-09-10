"use server";

import { isSupabaseConfigured } from "@/lib/v2/env";
import { getCurrentProfile, type AppProfile } from "@/lib/v2/auth/currentUser";
import { createServerSupabaseClient } from "@/lib/v2/supabase/serverClient";
import { getTeacherMilestoneMeta } from "@/lib/v2/assessment/teacherReviewRepository";
import {
  AI_EXPORT_SCHEMA_VERSION,
  AI_EXPORT_FREE_TEXT_WARNING,
  summarizeIncludedArtifacts,
} from "@/lib/v2/assessment/aiExportAnonymize";
import { writeAiExportAuditLog } from "@/lib/v2/assessment/aiExportAudit";
import { AI_EVAL_PACKAGE_SCHEMA_VERSION } from "@/lib/v2/assessment/aiEvaluationVersions";
import {
  buildAiExportRecordsFromRows,
  loadCandidateSubmissionsForMilestone,
  type BuiltAiExportRecord,
} from "@/lib/v2/assessment/aiEvaluationExportCore";
import { buildPackagesForExport } from "@/lib/v2/assessment/aiEvaluationPackageExport";
import type {
  AiExportDownloadResult,
  AiExportPreviewItem,
  AiExportPreviewResult,
} from "@/lib/v2/assessment/aiEvaluationExportTypes";
import type { SupabaseClient } from "@supabase/supabase-js";

type StaffContext =
  | { ok: true; supabase: SupabaseClient; profile: AppProfile }
  | { ok: false; kind: string; message: string };

/** 未指定は全員。指定時は正規候補との intersection のみ（空配列は0件。全員へフォールバックしない） */
function intersectCandidateRows<T extends { id: string }>(
  rows: T[],
  submissionIds?: string[] | null,
): T[] {
  if (submissionIds == null) return rows;
  const allow = new Set(
    submissionIds.filter(
      (id): id is string => typeof id === "string" && id.length > 0,
    ),
  );
  return rows.filter((r) => allow.has(r.id));
}

async function requireTeacherContext(): Promise<StaffContext> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      kind: "not_configured",
      message: "backend not configured",
    };
  }
  const profile = await getCurrentProfile();
  if (
    !profile ||
    !profile.isActive ||
    (profile.role !== "teacher" && profile.role !== "admin")
  ) {
    return { ok: false, kind: "unauthorized", message: "teacher login required" };
  }
  const supabase = await createServerSupabaseClient();
  return { ok: true, supabase, profile };
}

/** マイルストーンの評価対象提出について、エクスポート前プレビュー */
export async function previewMilestoneAiExportAction(input: {
  milestoneId: string;
  submissionIds?: string[] | null;
}): Promise<AiExportPreviewResult> {
  const ctx = await requireTeacherContext();
  if (!ctx.ok) return ctx;
  if (!input.milestoneId.trim()) {
    return { ok: false, kind: "validation", message: "課題が指定されていません。" };
  }

  const meta = await getTeacherMilestoneMeta(
    ctx.supabase,
    ctx.profile.organizationId,
    input.milestoneId,
  );
  if (meta.error || !meta.row) {
    return { ok: false, kind: "not_found", message: "課題が見つかりません。" };
  }

  const loaded = await loadCandidateSubmissionsForMilestone(
    ctx.supabase,
    ctx.profile.organizationId,
    input.milestoneId,
  );
  if (!loaded.ok) return loaded;

  const rows = intersectCandidateRows(loaded.rows, input.submissionIds);
  const { built } = buildAiExportRecordsFromRows(
    ctx.profile.organizationId,
    rows,
    meta.row.submissionScope,
  );
  const items: AiExportPreviewItem[] = built.map((b) => ({
    submissionId: b.submissionId,
    submissionNumber: b.submissionNumber,
    timingStatus: b.timingStatus,
    includedArtifacts: b.record.included_artifacts,
    parseOk: true,
  }));

  return {
    ok: true,
    milestoneId: meta.row.milestoneId,
    milestoneTitle: meta.row.title,
    cycleTitle: meta.row.cycleTitle,
    exportCycleTitle: built[0]?.record.meta.cycle_title ?? "課題1",
    exportMilestoneTitle: built[0]?.record.meta.milestone_title ?? "評価時点1",
    freeTextWarning: AI_EXPORT_FREE_TEXT_WARNING,
    recordCount: built.length,
    includedArtifacts: summarizeIncludedArtifacts(built.map((b) => b.record)),
    items,
    schemaVersion: AI_EXPORT_SCHEMA_VERSION,
    packageSchemaVersion: AI_EVAL_PACKAGE_SCHEMA_VERSION,
  };
}

/** 1件の提出をプレビュー */
export async function previewSubmissionAiExportAction(input: {
  milestoneId: string;
  studentId: string;
  submissionId: string;
}): Promise<AiExportPreviewResult> {
  const ctx = await requireTeacherContext();
  if (!ctx.ok) return ctx;

  const meta = await getTeacherMilestoneMeta(
    ctx.supabase,
    ctx.profile.organizationId,
    input.milestoneId,
  );
  if (meta.error || !meta.row) {
    return { ok: false, kind: "not_found", message: "課題が見つかりません。" };
  }

  const { data: full, error } = await ctx.supabase
    .from("assessment_submissions")
    .select(
      "id, assessment_cycle_id, assessment_milestone_id, case_id, submission_number, timing_status, snapshot, student_user_id",
    )
    .eq("id", input.submissionId)
    .eq("organization_id", ctx.profile.organizationId)
    .eq("assessment_milestone_id", input.milestoneId)
    .eq("student_user_id", input.studentId)
    .maybeSingle();
  if (error || !full) {
    return { ok: false, kind: "not_found", message: "提出が見つかりません。" };
  }

  const row = full as Record<string, unknown>;
  const { built } = buildAiExportRecordsFromRows(
    ctx.profile.organizationId,
    [
      {
        id: String(row.id),
        assessmentCycleId: String(row.assessment_cycle_id),
        assessmentMilestoneId: String(row.assessment_milestone_id),
        caseId: String(row.case_id),
        submissionNumber: Number(row.submission_number),
        timingStatus: String(row.timing_status ?? "on_time"),
        snapshot: row.snapshot,
        studentUserId: String(row.student_user_id ?? input.studentId),
      },
    ],
    meta.row.submissionScope,
  );
  if (built.length === 0) {
    return {
      ok: false,
      kind: "validation",
      message: "この提出データはエクスポート形式に対応していません。",
    };
  }

  return {
    ok: true,
    milestoneId: meta.row.milestoneId,
    milestoneTitle: meta.row.title,
    cycleTitle: meta.row.cycleTitle,
    exportCycleTitle: built[0].record.meta.cycle_title ?? "課題1",
    exportMilestoneTitle: built[0].record.meta.milestone_title ?? "評価時点1",
    freeTextWarning: AI_EXPORT_FREE_TEXT_WARNING,
    recordCount: 1,
    includedArtifacts: built[0].record.included_artifacts,
    items: [
      {
        submissionId: built[0].submissionId,
        submissionNumber: built[0].submissionNumber,
        timingStatus: built[0].timingStatus,
        includedArtifacts: built[0].record.included_artifacts,
        parseOk: true,
      },
    ],
    schemaVersion: AI_EXPORT_SCHEMA_VERSION,
    packageSchemaVersion: AI_EVAL_PACKAGE_SCHEMA_VERSION,
  };
}

async function finishExport(input: {
  profile: AppProfile;
  milestoneId: string;
  milestoneTitle: string;
  format: "json" | "jsonl";
  built: BuiltAiExportRecord[];
  idSecret: string;
  idMapper: ReturnType<
    typeof import("@/lib/v2/assessment/aiExportAnonymize").createAiAnonymousIdMapper
  >;
}): Promise<AiExportDownloadResult> {
  if (input.built.length === 0) {
    return {
      ok: false,
      kind: "validation",
      message: "エクスポート対象の提出がありません。",
    };
  }

  const { packages, evaluationRequestIds, generatedAtIso } =
    await buildPackagesForExport({
      profile: input.profile,
      built: input.built,
      idSecret: input.idSecret,
      idMapper: input.idMapper,
    });

  if (packages.length === 0) {
    return {
      ok: false,
      kind: "validation",
      message:
        "評価リクエストを記録できず、Package を生成できませんでした（service role を確認してください）。",
    };
  }

  const includedArtifacts = summarizeIncludedArtifacts(
    input.built.map((b) => b.record),
  );
  const stamp = generatedAtIso.slice(0, 10);
  let body: string;
  let filename: string;
  if (input.format === "jsonl") {
    body = packages.map((p) => JSON.stringify(p)).join("\n") + "\n";
    filename = `ai-eval-packages-${stamp}-${packages.length}.jsonl`;
  } else if (packages.length === 1) {
    body = JSON.stringify(packages[0], null, 2);
    filename = `ai-eval-package-${stamp}.json`;
  } else {
    body = JSON.stringify(
      {
        schema_version: 1,
        format: "ai_evaluation_packages",
        package_schema_version: AI_EVAL_PACKAGE_SCHEMA_VERSION,
        exported_at: generatedAtIso,
        package_count: packages.length,
        packages,
      },
      null,
      2,
    );
    filename = `ai-eval-packages-${stamp}.json`;
  }

  const audit = await writeAiExportAuditLog({
    organizationId: input.profile.organizationId,
    actorUserId: input.profile.id,
    actorLoginId: input.profile.loginId,
    actorRole: input.profile.role === "admin" ? "admin" : "teacher",
    milestoneId: input.milestoneId,
    format: input.format,
    recordCount: packages.length,
    includedArtifacts,
    summary: `AI Evaluation Package エクスポート: ${input.milestoneTitle}（${packages.length}件・${input.format}）`,
    metadata: {
      schema_version: AI_EXPORT_SCHEMA_VERSION,
      package_schema_version: AI_EVAL_PACKAGE_SCHEMA_VERSION,
      evaluation_requests_recorded: evaluationRequestIds.length,
      export_kind: "ai_evaluation_package",
    },
  });

  return {
    ok: true,
    format: input.format,
    filename,
    contentType:
      input.format === "jsonl"
        ? "application/x-ndjson; charset=utf-8"
        : "application/json; charset=utf-8",
    body,
    recordCount: packages.length,
    includedArtifacts,
    auditLogged: audit.ok,
  };
}

/** マイルストーンの評価対象を正式 Package（JSON / JSONL）でエクスポート */
export async function exportMilestoneAiDataAction(input: {
  milestoneId: string;
  format: "json" | "jsonl";
  submissionIds?: string[] | null;
}): Promise<AiExportDownloadResult> {
  const ctx = await requireTeacherContext();
  if (!ctx.ok) return ctx;
  if (input.format !== "json" && input.format !== "jsonl") {
    return { ok: false, kind: "validation", message: "形式が不正です。" };
  }

  const meta = await getTeacherMilestoneMeta(
    ctx.supabase,
    ctx.profile.organizationId,
    input.milestoneId,
  );
  if (meta.error || !meta.row) {
    return { ok: false, kind: "not_found", message: "課題が見つかりません。" };
  }

  const loaded = await loadCandidateSubmissionsForMilestone(
    ctx.supabase,
    ctx.profile.organizationId,
    input.milestoneId,
  );
  if (!loaded.ok) return loaded;

  const rows = intersectCandidateRows(loaded.rows, input.submissionIds);
  const { built, idMapper, idSecret } = buildAiExportRecordsFromRows(
    ctx.profile.organizationId,
    rows,
    meta.row.submissionScope,
  );
  return finishExport({
    profile: ctx.profile,
    milestoneId: meta.row.milestoneId,
    milestoneTitle: meta.row.title,
    format: input.format,
    built,
    idMapper,
    idSecret,
  });
}

/** 1提出を正式 Package JSON でエクスポート */
export async function exportSubmissionAiDataAction(input: {
  milestoneId: string;
  studentId: string;
  submissionId: string;
  format?: "json" | "jsonl";
}): Promise<AiExportDownloadResult> {
  const ctx = await requireTeacherContext();
  if (!ctx.ok) return ctx;
  const format = input.format ?? "json";
  if (format !== "json" && format !== "jsonl") {
    return { ok: false, kind: "validation", message: "形式が不正です。" };
  }

  const meta = await getTeacherMilestoneMeta(
    ctx.supabase,
    ctx.profile.organizationId,
    input.milestoneId,
  );
  if (meta.error || !meta.row) {
    return { ok: false, kind: "not_found", message: "課題が見つかりません。" };
  }

  const { data: full, error } = await ctx.supabase
    .from("assessment_submissions")
    .select(
      "id, assessment_cycle_id, assessment_milestone_id, case_id, submission_number, timing_status, snapshot, student_user_id",
    )
    .eq("id", input.submissionId)
    .eq("organization_id", ctx.profile.organizationId)
    .eq("assessment_milestone_id", input.milestoneId)
    .eq("student_user_id", input.studentId)
    .maybeSingle();
  if (error || !full) {
    return { ok: false, kind: "not_found", message: "提出が見つかりません。" };
  }

  const row = full as Record<string, unknown>;
  const { built, idMapper, idSecret } = buildAiExportRecordsFromRows(
    ctx.profile.organizationId,
    [
      {
        id: String(row.id),
        assessmentCycleId: String(row.assessment_cycle_id),
        assessmentMilestoneId: String(row.assessment_milestone_id),
        caseId: String(row.case_id),
        submissionNumber: Number(row.submission_number),
        timingStatus: String(row.timing_status ?? "on_time"),
        snapshot: row.snapshot,
        studentUserId: String(row.student_user_id),
      },
    ],
    meta.row.submissionScope,
  );

  return finishExport({
    profile: ctx.profile,
    milestoneId: meta.row.milestoneId,
    milestoneTitle: meta.row.title,
    format,
    built,
    idMapper,
    idSecret,
  });
}
