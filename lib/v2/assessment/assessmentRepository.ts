import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AssessmentLateReviewStatus,
  AssessmentSubmissionListItem,
  AssessmentSubmitPreview,
  AssessmentSubmitSuccess,
  AssessmentTimingStatus,
} from "./types";

type PgLikeError = { message?: string; code?: string } | null;

function asTiming(v: unknown): AssessmentTimingStatus {
  return v === "late" ? "late" : "on_time";
}

function asLateReview(v: unknown): AssessmentLateReviewStatus | null {
  if (v === "pending" || v === "approved" || v === "rejected") return v;
  return null;
}

export async function rpcGetAssessmentSubmitPreview(
  supabase: SupabaseClient,
  caseId: string,
): Promise<
  | { ok: true; data: AssessmentSubmitPreview }
  | { ok: false; error: string; message?: string; dbError: PgLikeError }
> {
  const { data, error } = await supabase.rpc("get_assessment_submit_preview", {
    p_case_id: caseId,
  });
  if (error) {
    return { ok: false, error: "db_error", dbError: error };
  }
  const row = data as Record<string, unknown> | null;
  if (!row || row.ok !== true) {
    return {
      ok: false,
      error: typeof row?.error === "string" ? row.error : "db_error",
      message: typeof row?.message === "string" ? row.message : undefined,
      dbError: null,
    };
  }
  return {
    ok: true,
    data: {
      assessmentCycleId: String(row.assessmentCycleId),
      title: String(row.title),
      deadlineAt: String(row.deadlineAt),
      serverNow: String(row.serverNow),
      wouldBeLate: Boolean(row.wouldBeLate),
    },
  };
}

export async function rpcSubmitAssessmentSubmission(
  supabase: SupabaseClient,
  params: {
    caseId: string;
    snapshot: unknown;
    sourceVersions: unknown;
    snapshotSchemaVersion: number;
    clientRequestId: string | null;
  },
): Promise<
  | { ok: true; data: AssessmentSubmitSuccess }
  | { ok: false; error: string; message?: string; dbError: PgLikeError }
> {
  const { data, error } = await supabase.rpc("submit_assessment_submission", {
    p_case_id: params.caseId,
    p_snapshot: params.snapshot,
    p_source_versions: params.sourceVersions,
    p_snapshot_schema_version: params.snapshotSchemaVersion,
    p_client_request_id: params.clientRequestId,
  });
  if (error) {
    return { ok: false, error: "db_error", dbError: error };
  }
  const row = data as Record<string, unknown> | null;
  if (!row || row.ok !== true) {
    return {
      ok: false,
      error: typeof row?.error === "string" ? row.error : "db_error",
      message: typeof row?.message === "string" ? row.message : undefined,
      dbError: null,
    };
  }

  const lateRaw = row.lateReviewStatus;
  const lateReviewStatus =
    lateRaw === null || lateRaw === undefined
      ? null
      : asLateReview(lateRaw);

  return {
    ok: true,
    data: {
      submissionId: String(row.submissionId),
      submissionNumber: Number(row.submissionNumber),
      submittedAt: String(row.submittedAt),
      timingStatus: asTiming(row.timingStatus),
      lateReviewStatus,
      assessmentCycleId: String(row.assessmentCycleId),
      deadlineAt: String(row.deadlineAt),
      idempotent: Boolean(row.idempotent),
    },
  };
}

export async function listOwnSubmissionsForCase(
  supabase: SupabaseClient,
  userId: string,
  caseId: string,
): Promise<{
  items: AssessmentSubmissionListItem[];
  evaluationCandidateId: string | null;
  deadlineAt: string | null;
  cycleTitle: string | null;
  error: PgLikeError;
}> {
  const { data: subs, error: subErr } = await supabase
    .from("assessment_submissions")
    .select(
      "id, submission_number, submitted_at, timing_status, late_review_status, assessment_cycle_id",
    )
    .eq("student_user_id", userId)
    .eq("case_id", caseId)
    .eq("is_withdrawn", false)
    .order("submission_number", { ascending: false });

  if (subErr) {
    return {
      items: [],
      evaluationCandidateId: null,
      deadlineAt: null,
      cycleTitle: null,
      error: subErr,
    };
  }

  const rows = (subs ?? []) as Array<{
    id: string;
    submission_number: number;
    submitted_at: string;
    timing_status: string;
    late_review_status: string | null;
    assessment_cycle_id: string;
  }>;

  let evaluationCandidateId: string | null = null;
  let deadlineAt: string | null = null;
  let cycleTitle: string | null = null;

  if (rows.length > 0) {
    const cycleId = rows[0]!.assessment_cycle_id;
    const { data: cand } = await supabase
      .from("assessment_evaluation_candidates")
      .select("submission_id")
      .eq("student_user_id", userId)
      .eq("assessment_cycle_id", cycleId)
      .maybeSingle();
    evaluationCandidateId =
      (cand as { submission_id?: string } | null)?.submission_id ?? null;

    const { data: cycle } = await supabase
      .from("assessment_cycles")
      .select("deadline_at, title")
      .eq("id", cycleId)
      .maybeSingle();
    const c = cycle as { deadline_at?: string; title?: string } | null;
    deadlineAt = c?.deadline_at ?? null;
    cycleTitle = c?.title ?? null;
  }

  const items: AssessmentSubmissionListItem[] = rows.map((r) => ({
    id: r.id,
    submissionNumber: r.submission_number,
    submittedAt: r.submitted_at,
    timingStatus: asTiming(r.timing_status),
    lateReviewStatus: asLateReview(r.late_review_status),
    isEvaluationCandidate: evaluationCandidateId === r.id,
  }));

  return {
    items,
    evaluationCandidateId,
    deadlineAt,
    cycleTitle,
    error: null,
  };
}
