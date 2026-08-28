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
import type { SupabaseClient } from "@supabase/supabase-js";

export type BuiltAiExportRecord = {
  record: AiAnonymizedAssessmentRecord;
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
    const scopeForPackage =
      submissionScope ?? readModel.submissionScope ?? null;
    const record = prepareAiEvaluationPackageStudentSubmission(
      archiveRecord,
      scopeForPackage,
    );
    built.push({
      record,
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
