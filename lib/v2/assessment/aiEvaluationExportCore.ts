/**
 * AI Export 共通: 匿名化レコード組み立て（Package Builder の入力）。
 * Server Action と Batch から共有する。
 */

import { createHash } from "crypto";
import { getServiceRoleKey } from "@/lib/v2/env.server";
import { patientIdForCaseId } from "@/lib/v2/notebook/caseId";
import { parseAssessmentSnapshot } from "@/lib/v2/assessment/snapshotReadModel";
import {
  buildAiAnonymizedAssessmentRecord,
  createAiAnonymousIdMapper,
  createAiTitleLabelMapper,
  type AiAnonymizedAssessmentRecord,
  type AiAnonymousIdMapper,
} from "@/lib/v2/assessment/aiExportAnonymize";
import { prepareAiEvaluationPackageStudentSubmission } from "@/lib/v2/assessment/aiEvaluationPackageSubmission";
import type { AssessmentSubmissionScope } from "@/lib/v2/assessment/types";
import {
  resolveScopeForAiEvaluationPackage,
  type AiEvalScopePolicyWarning,
} from "@/lib/v2/assessment/submissionScope";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isKnownVerificationStudentLoginId } from "@/lib/v2/assessment/aiEvaluationVerificationAccounts";

export type BuiltAiExportRecord = {
  record: AiAnonymizedAssessmentRecord;
  /** Package に適用した submission_scope（form2 強制補正後） */
  packageScope: AssessmentSubmissionScope | null;
  /** DB scope との差分・ポリシー警告（黙って隠さない） */
  scopeWarnings: AiEvalScopePolicyWarning[];
  scopeCorrected: boolean;
  scopeCorrections: string[];
  submissionId: string;
  submissionNumber: number;
  timingStatus: string;
  assessmentCycleId: string;
  assessmentMilestoneId: string;
  studentUserId: string;
  caseId: string;
  patientId: string;
};

export function getAiExportIdSecret(): string {
  const pepper = process.env.AI_EXPORT_ID_PEPPER?.trim();
  if (pepper) return pepper;
  const sr = getServiceRoleKey();
  if (sr) {
    return createHash("sha256").update(`ai-export|${sr}`).digest("hex");
  }
  return "nurse-compass-ai-export-dev";
}

/**
 * 本番 AI 評価候補の提出を読み込む。
 * 優先: assessment_ai_evaluation_candidates（検証用アカウント除外）。
 * 未適用環境向けフォールバック: assessment_evaluation_candidates + profiles.exclude_from_assessment。
 */
export async function loadCandidateSubmissionsForMilestone(
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
        studentUserId: string;
      }>;
    }
  | { ok: false; kind: string; message: string }
> {
  let candRows: Array<{ submission_id: string; student_user_id?: string }> = [];

  const aiView = await supabase
    .from("assessment_ai_evaluation_candidates")
    .select("submission_id, student_user_id")
    .eq("organization_id", organizationId)
    .eq("assessment_milestone_id", milestoneId);

  if (!aiView.error) {
    candRows = (aiView.data ?? []) as typeof candRows;
  } else {
    const base = await supabase
      .from("assessment_evaluation_candidates")
      .select("submission_id, student_user_id")
      .eq("organization_id", organizationId)
      .eq("assessment_milestone_id", milestoneId);
    if (base.error) {
      return {
        ok: false,
        kind: "db_error",
        message: "評価対象を読み込めませんでした。",
      };
    }
    const raw = (base.data ?? []) as Array<{
      submission_id: string;
      student_user_id: string;
    }>;
    const studentIds = [...new Set(raw.map((r) => r.student_user_id))];
    const excluded = new Set<string>();
    if (studentIds.length > 0) {
      const withFlag = await supabase
        .from("profiles")
        .select("id, exclude_from_assessment, login_id")
        .eq("organization_id", organizationId)
        .in("id", studentIds);
      if (!withFlag.error) {
        for (const p of (withFlag.data ?? []) as Array<{
          id: string;
          exclude_from_assessment?: boolean;
          login_id?: string;
        }>) {
          if (p.exclude_from_assessment === true) excluded.add(p.id);
        }
      } else {
        const legacy = await supabase
          .from("profiles")
          .select("id, login_id")
          .eq("organization_id", organizationId)
          .in("id", studentIds);
        for (const p of (legacy.data ?? []) as Array<{
          id: string;
          login_id?: string;
        }>) {
          if (isKnownVerificationStudentLoginId(String(p.login_id ?? ""))) {
            excluded.add(p.id);
          }
        }
      }
    }
    candRows = raw.filter((r) => !excluded.has(r.student_user_id));
  }

  const ids = [
    ...new Set(candRows.map((c) => c.submission_id).filter(Boolean)),
  ];
  if (ids.length === 0) {
    return { ok: true, rows: [] };
  }

  const { data: subs, error: sErr } = await supabase
    .from("assessment_submissions")
    .select(
      "id, assessment_cycle_id, assessment_milestone_id, case_id, submission_number, submitted_at, timing_status, snapshot, student_user_id",
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
      studentUserId: String(s.student_user_id),
    })),
  };
}

export function buildAiExportRecordsFromRows(
  profileOrgId: string,
  rows: Array<{
    id: string;
    assessmentCycleId: string;
    assessmentMilestoneId: string;
    caseId: string;
    submissionNumber: number;
    timingStatus: string;
    snapshot: unknown;
    studentUserId: string;
  }>,
  submissionScope?: AssessmentSubmissionScope | null,
): {
  built: BuiltAiExportRecord[];
  skippedSnapshot: number;
  idMapper: AiAnonymousIdMapper;
  idSecret: string;
} {
  const idSecret = getAiExportIdSecret();
  const ids = createAiAnonymousIdMapper(idSecret, profileOrgId);
  const titles = createAiTitleLabelMapper();
  const built: BuiltAiExportRecord[] = [];
  let skippedSnapshot = 0;
  for (const row of rows) {
    const patientId = patientIdForCaseId(row.caseId) ?? "A";
    const readModel = parseAssessmentSnapshot(row.snapshot, patientId);
    if (!readModel.ok) {
      skippedSnapshot += 1;
      continue;
    }
    const archiveRecord = buildAiAnonymizedAssessmentRecord({
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
    const resolved = resolveScopeForAiEvaluationPackage(
      archiveRecord.meta.milestone_type,
      submissionScope ?? readModel.submissionScope ?? null,
    );
    const scopeForPackage = resolved.packageScope;
    if (resolved.warnings.length > 0) {
      console.warn(
        "[ai-eval-scope]",
        row.id,
        resolved.corrected ? "corrected" : "warn-only",
        resolved.corrections,
        resolved.warnings.map((w) => w.code),
      );
    } else if (!resolved.corrected && scopeForPackage) {
      // DB と必須 scope が一致: 強制補正なし
      console.info("[ai-eval-scope]", row.id, "no-correction");
    }
    const record = prepareAiEvaluationPackageStudentSubmission(
      archiveRecord,
      scopeForPackage,
    );
    built.push({
      record,
      packageScope: scopeForPackage,
      scopeWarnings: resolved.warnings,
      scopeCorrected: resolved.corrected,
      scopeCorrections: resolved.corrections,
      submissionId: row.id,
      submissionNumber: row.submissionNumber,
      timingStatus: row.timingStatus,
      assessmentCycleId: row.assessmentCycleId,
      assessmentMilestoneId: row.assessmentMilestoneId,
      studentUserId: row.studentUserId,
      caseId: row.caseId,
      patientId,
    });
  }
  return { built, skippedSnapshot, idMapper: ids, idSecret };
}
