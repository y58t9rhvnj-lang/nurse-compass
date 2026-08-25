"use server";

import { createHash } from "crypto";
import { isSupabaseConfigured } from "@/lib/v2/env";
import { getServiceRoleKey } from "@/lib/v2/env.server";
import { getCurrentProfile, type AppProfile } from "@/lib/v2/auth/currentUser";
import { createServerSupabaseClient } from "@/lib/v2/supabase/serverClient";
import { patientIdForCaseId } from "@/lib/v2/notebook/caseId";
import {
  getTeacherMilestoneMeta,
} from "@/lib/v2/assessment/teacherReviewRepository";
import { parseAssessmentSnapshot } from "@/lib/v2/assessment/snapshotReadModel";
import {
  AI_EXPORT_SCHEMA_VERSION,
  AI_EXPORT_FREE_TEXT_WARNING,
  buildAiAnonymizedAssessmentRecord,
  buildJsonExportDocument,
  buildJsonlExportText,
  createAiAnonymousIdMapper,
  createAiTitleLabelMapper,
  summarizeIncludedArtifacts,
  type AiAnonymizedAssessmentRecord,
} from "@/lib/v2/assessment/aiExportAnonymize";
import { writeAiExportAuditLog } from "@/lib/v2/assessment/aiExportAudit";
import type { SupabaseClient } from "@supabase/supabase-js";

type StaffContext =
  | { ok: true; supabase: SupabaseClient; profile: AppProfile }
  | { ok: false; kind: string; message: string };

async function requireTeacherContext(): Promise<StaffContext> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      kind: "not_configured",
      message: "backend not configured",
    };
  }
  const profile = await getCurrentProfile();
  // Sprint 5A: 教員のみ（admin も教員画面経由で可）
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

function getAiExportIdSecret(): string {
  const pepper = process.env.AI_EXPORT_ID_PEPPER?.trim();
  if (pepper) return pepper;
  const sr = getServiceRoleKey();
  if (sr) {
    return createHash("sha256").update(`ai-export|${sr}`).digest("hex");
  }
  return "nurse-compass-ai-export-dev";
}

export type AiExportPreviewItem = {
  submissionId: string;
  submissionNumber: number;
  timingStatus: string;
  includedArtifacts: string[];
  parseOk: boolean;
};

export type AiExportPreviewResult =
  | {
      ok: true;
      milestoneId: string;
      milestoneTitle: string;
      cycleTitle: string;
      /** 外部ファイル上の表記（課題N） */
      exportCycleTitle: string;
      /** 外部ファイル上の表記（評価時点N） */
      exportMilestoneTitle: string;
      freeTextWarning: string;
      recordCount: number;
      includedArtifacts: string[];
      items: AiExportPreviewItem[];
      schemaVersion: typeof AI_EXPORT_SCHEMA_VERSION;
    }
  | { ok: false; kind: string; message: string };

type BuiltRecord = {
  record: AiAnonymizedAssessmentRecord;
  submissionId: string;
  submissionNumber: number;
  timingStatus: string;
};

async function loadCandidateSubmissionsForMilestone(
  supabase: SupabaseClient,
  organizationId: string,
  milestoneId: string,
): Promise<
  | {
      ok: true;
      rows: Array<{
        id: string;
        assessmentCycleId: string;
        assessmentMilestoneId: string;
        caseId: string;
        submissionNumber: number;
        submittedAt: string;
        timingStatus: string;
        snapshot: unknown;
      }>;
    }
  | { ok: false; kind: string; message: string }
> {
  const { data: cands, error: cErr } = await supabase
    .from("assessment_evaluation_candidates")
    .select("submission_id")
    .eq("organization_id", organizationId)
    .eq("assessment_milestone_id", milestoneId);
  if (cErr) {
    return {
      ok: false,
      kind: "db_error",
      message: "評価対象を読み込めませんでした。",
    };
  }
  const ids = [
    ...new Set(
      ((cands ?? []) as Array<{ submission_id: string }>).map(
        (c) => c.submission_id,
      ),
    ),
  ];
  if (ids.length === 0) {
    return { ok: true, rows: [] };
  }

  const { data: subs, error: sErr } = await supabase
    .from("assessment_submissions")
    .select(
      "id, assessment_cycle_id, assessment_milestone_id, case_id, submission_number, submitted_at, timing_status, snapshot",
    )
    .eq("organization_id", organizationId)
    .eq("assessment_milestone_id", milestoneId)
    .in("id", ids)
    .eq("is_withdrawn", false)
    .order("submission_number", { ascending: true });
  if (sErr) {
    return {
      ok: false,
      kind: "db_error",
      message: "提出データを読み込めませんでした。",
    };
  }

  return {
    ok: true,
    rows: ((subs ?? []) as Record<string, unknown>[]).map((s) => ({
      id: String(s.id),
      assessmentCycleId: String(s.assessment_cycle_id),
      assessmentMilestoneId: String(s.assessment_milestone_id),
      caseId: String(s.case_id),
      submissionNumber: Number(s.submission_number),
      submittedAt: String(s.submitted_at),
      timingStatus: String(s.timing_status ?? "on_time"),
      snapshot: s.snapshot,
    })),
  };
}

function buildRecordsFromRows(
  profileOrgId: string,
  rows: Array<{
    id: string;
    assessmentCycleId: string;
    assessmentMilestoneId: string;
    caseId: string;
    submissionNumber: number;
    timingStatus: string;
    snapshot: unknown;
  }>,
): BuiltRecord[] {
  const ids = createAiAnonymousIdMapper(
    getAiExportIdSecret(),
    profileOrgId,
  );
  const titles = createAiTitleLabelMapper();
  const built: BuiltRecord[] = [];
  for (const row of rows) {
    const patientId = patientIdForCaseId(row.caseId) ?? "A";
    const readModel = parseAssessmentSnapshot(row.snapshot, patientId);
    if (!readModel.ok) continue;
    const record = buildAiAnonymizedAssessmentRecord({
      ids,
      titles,
      sourceIds: {
        caseId: row.caseId,
        cycleId: row.assessmentCycleId,
        milestoneId: row.assessmentMilestoneId,
        submissionId: row.id,
      },
      readModel,
      timingStatus: row.timingStatus,
      submissionNumber: row.submissionNumber,
    });
    built.push({
      record,
      submissionId: row.id,
      submissionNumber: row.submissionNumber,
      timingStatus: row.timingStatus,
    });
  }
  return built;
}

/** マイルストーンの評価対象提出について、エクスポート前プレビュー */
export async function previewMilestoneAiExportAction(
  milestoneId: string,
): Promise<AiExportPreviewResult> {
  const ctx = await requireTeacherContext();
  if (!ctx.ok) return ctx;
  if (!milestoneId.trim()) {
    return { ok: false, kind: "validation", message: "課題が指定されていません。" };
  }

  const meta = await getTeacherMilestoneMeta(
    ctx.supabase,
    ctx.profile.organizationId,
    milestoneId,
  );
  if (meta.error || !meta.row) {
    return { ok: false, kind: "not_found", message: "課題が見つかりません。" };
  }

  const loaded = await loadCandidateSubmissionsForMilestone(
    ctx.supabase,
    ctx.profile.organizationId,
    milestoneId,
  );
  if (!loaded.ok) return loaded;

  const built = buildRecordsFromRows(ctx.profile.organizationId, loaded.rows);
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
      "id, assessment_cycle_id, assessment_milestone_id, case_id, submission_number, timing_status, snapshot",
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
  const built = buildRecordsFromRows(ctx.profile.organizationId, [
    {
      id: String(row.id),
      assessmentCycleId: String(row.assessment_cycle_id),
      assessmentMilestoneId: String(row.assessment_milestone_id),
      caseId: String(row.case_id),
      submissionNumber: Number(row.submission_number),
      timingStatus: String(row.timing_status ?? "on_time"),
      snapshot: row.snapshot,
    },
  ]);
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
  };
}

export type AiExportDownloadResult =
  | {
      ok: true;
      format: "json" | "jsonl";
      filename: string;
      contentType: string;
      body: string;
      recordCount: number;
      includedArtifacts: string[];
      auditLogged: boolean;
    }
  | { ok: false; kind: string; message: string };

async function finishExport(input: {
  profile: AppProfile;
  milestoneId: string;
  milestoneTitle: string;
  format: "json" | "jsonl";
  records: AiAnonymizedAssessmentRecord[];
}): Promise<AiExportDownloadResult> {
  if (input.records.length === 0) {
    return {
      ok: false,
      kind: "validation",
      message: "エクスポート対象の提出がありません。",
    };
  }

  const exportedAt = new Date().toISOString();
  const includedArtifacts = summarizeIncludedArtifacts(input.records);
  const body =
    input.format === "jsonl"
      ? buildJsonlExportText(input.records)
      : JSON.stringify(
          buildJsonExportDocument(input.records, exportedAt),
          null,
          2,
        );

  const stamp = exportedAt.slice(0, 10);
  const filename =
    input.format === "jsonl"
      ? `ai-export-${stamp}-${input.records.length}.jsonl`
      : `ai-export-${stamp}.json`;

  const audit = await writeAiExportAuditLog({
    organizationId: input.profile.organizationId,
    actorUserId: input.profile.id,
    actorLoginId: input.profile.loginId,
    actorRole: input.profile.role === "admin" ? "admin" : "teacher",
    milestoneId: input.milestoneId,
    format: input.format,
    recordCount: input.records.length,
    includedArtifacts,
    summary: `AI匿名化エクスポート: ${input.milestoneTitle}（${input.records.length}件・${input.format}）`,
    metadata: {
      schema_version: AI_EXPORT_SCHEMA_VERSION,
      // 実 submission uuid は監査に残さない（件数のみ）
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
    recordCount: input.records.length,
    includedArtifacts,
    auditLogged: audit.ok,
  };
}

/** マイルストーンの評価対象を JSON / JSONL でエクスポート */
export async function exportMilestoneAiDataAction(input: {
  milestoneId: string;
  format: "json" | "jsonl";
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

  const built = buildRecordsFromRows(ctx.profile.organizationId, loaded.rows);
  return finishExport({
    profile: ctx.profile,
    milestoneId: meta.row.milestoneId,
    milestoneTitle: meta.row.title,
    format: input.format,
    records: built.map((b) => b.record),
  });
}

/** 1提出を JSON でエクスポート（単件は json 固定、必要なら jsonl も可） */
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
  const built = buildRecordsFromRows(ctx.profile.organizationId, [
    {
      id: String(row.id),
      assessmentCycleId: String(row.assessment_cycle_id),
      assessmentMilestoneId: String(row.assessment_milestone_id),
      caseId: String(row.case_id),
      submissionNumber: Number(row.submission_number),
      timingStatus: String(row.timing_status ?? "on_time"),
      snapshot: row.snapshot,
    },
  ]);

  return finishExport({
    profile: ctx.profile,
    milestoneId: meta.row.milestoneId,
    milestoneTitle: meta.row.title,
    format,
    records: built.map((b) => b.record),
  });
}
