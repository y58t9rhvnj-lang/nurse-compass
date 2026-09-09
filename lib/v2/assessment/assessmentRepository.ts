import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  logAssessmentDiag,
  supabaseErrFields,
} from "./assessmentDiagnostics";
import { parseSubmissionScope } from "./submissionScope";
import type {
  AssessmentLateReviewStatus,
  AssessmentMilestoneRow,
  AssessmentMilestoneStatus,
  AssessmentMilestoneType,
  AssessmentEvaluationType,
  AssessmentCycleRow,
  AssessmentCycleStatus,
  AssessmentSubmissionListItem,
  AssessmentSubmitPreview,
  AssessmentSubmitSuccess,
  AssessmentTimingStatus,
  OpenAssessmentMilestoneItem,
} from "./types";

type PgLikeError = { message?: string; code?: string } | null;

function asTiming(v: unknown): AssessmentTimingStatus {
  return v === "late" ? "late" : "on_time";
}

function asLateReview(v: unknown): AssessmentLateReviewStatus | null {
  if (v === "pending" || v === "approved" || v === "rejected") return v;
  return null;
}

export async function rpcListOpenMilestones(
  supabase: SupabaseClient,
  caseId: string,
): Promise<
  | { ok: true; items: OpenAssessmentMilestoneItem[]; serverNow: string }
  | { ok: false; error: string; message?: string; dbError: PgLikeError }
> {
  const { data, error } = await supabase.rpc("list_open_assessment_milestones", {
    p_case_id: caseId,
  });
  if (error) return { ok: false, error: "db_error", dbError: error };
  const row = data as Record<string, unknown> | null;
  if (!row || row.ok !== true) {
    return {
      ok: false,
      error: typeof row?.error === "string" ? row.error : "db_error",
      message: typeof row?.message === "string" ? row.message : undefined,
      dbError: null,
    };
  }
  const rawItems = Array.isArray(row.items) ? row.items : [];
  const items: OpenAssessmentMilestoneItem[] = rawItems.map((it) => {
    const o = it as Record<string, unknown>;
    return {
      milestoneId: String(o.milestoneId),
      milestoneTitle: String(o.milestoneTitle),
      description: (o.description as string | null) ?? null,
      milestoneType: o.milestoneType as AssessmentMilestoneType,
      evaluationType: o.evaluationType as AssessmentEvaluationType,
      sequenceNumber: Number(o.sequenceNumber),
      opensAt: (o.opensAt as string | null) ?? null,
      deadlineAt: String(o.deadlineAt),
      submissionScope: parseSubmissionScope(o.submissionScope),
      status: o.status as AssessmentMilestoneStatus,
      cycleId: String(o.cycleId),
      cycleTitle: String(o.cycleTitle),
      caseId: String(o.caseId),
    };
  });
  return {
    ok: true,
    items,
    serverNow: String(row.serverNow ?? new Date().toISOString()),
  };
}

/**
 * 学生向け: 事例に紐づく open/closed/archived（RLS で見える範囲）の提出課題。
 * draft は除外。migration なしで SELECT 合成。
 */
export async function listStudentMilestonesForCase(
  supabase: SupabaseClient,
  caseId: string,
): Promise<{
  rows: Array<{
    milestone: AssessmentMilestoneRow;
    cycleTitle: string;
    caseId: string;
  }>;
  error: PgLikeError;
}> {
  const { data, error } = await supabase
    .from("assessment_milestones")
    .select(
      "*, assessment_cycles!inner(id, title, case_id, organization_id, status)",
    )
    .eq("assessment_cycles.case_id", caseId)
    .in("status", ["open", "closed", "archived"])
    .order("sequence_number", { ascending: true });

  if (error) return { rows: [], error };

  const rows = ((data ?? []) as Record<string, unknown>[])
    .map((row) => {
      const cycle = row.assessment_cycles as Record<string, unknown> | null;
      if (!cycle) return null;
      if (String(cycle.status) === "draft") return null;
      const milestone = mapMilestone(row);
      if (milestone.status === "draft") return null;
      return {
        milestone,
        cycleTitle: String(cycle.title),
        caseId: String(cycle.case_id),
      };
    })
    .filter(
      (
        x,
      ): x is {
        milestone: AssessmentMilestoneRow;
        cycleTitle: string;
        caseId: string;
      } => x !== null,
    );

  return { rows, error: null };
}

export async function rpcGetAssessmentSubmitPreview(
  supabase: SupabaseClient,
  milestoneId: string,
): Promise<
  | { ok: true; data: AssessmentSubmitPreview }
  | { ok: false; error: string; message?: string; dbError: PgLikeError }
> {
  const { data, error } = await supabase.rpc("get_assessment_submit_preview", {
    p_assessment_milestone_id: milestoneId,
  });
  if (error) return { ok: false, error: "db_error", dbError: error };
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
      assessmentMilestoneId: String(row.assessmentMilestoneId),
      assessmentCycleId: String(row.assessmentCycleId),
      cycleTitle: String(row.cycleTitle),
      milestoneTitle: String(row.milestoneTitle),
      milestoneType: row.milestoneType as AssessmentMilestoneType,
      evaluationType: row.evaluationType as AssessmentEvaluationType,
      submissionScope: parseSubmissionScope(row.submissionScope),
      deadlineAt: String(row.deadlineAt),
      serverNow: String(row.serverNow),
      wouldBeLate: Boolean(row.wouldBeLate),
    },
  };
}

export async function rpcSubmitAssessmentSubmission(
  supabase: SupabaseClient,
  params: {
    milestoneId: string;
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
    p_assessment_milestone_id: params.milestoneId,
    p_case_id: params.caseId,
    p_snapshot: params.snapshot,
    p_source_versions: params.sourceVersions,
    p_snapshot_schema_version: params.snapshotSchemaVersion,
    p_client_request_id: params.clientRequestId,
  });
  if (error) return { ok: false, error: "db_error", dbError: error };
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
  return {
    ok: true,
    data: {
      submissionId: String(row.submissionId),
      submissionNumber: Number(row.submissionNumber),
      submittedAt: String(row.submittedAt),
      timingStatus: asTiming(row.timingStatus),
      lateReviewStatus:
        lateRaw === null || lateRaw === undefined
          ? null
          : asLateReview(lateRaw),
      assessmentCycleId: String(row.assessmentCycleId),
      assessmentMilestoneId: String(row.assessmentMilestoneId),
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
  evaluationCandidateIds: string[];
  error: PgLikeError;
}> {
  const { data: subs, error: subErr } = await supabase
    .from("assessment_submissions")
    .select(
      "id, submission_number, submitted_at, timing_status, late_review_status, assessment_milestone_id, assessment_cycle_id",
    )
    .eq("student_user_id", userId)
    .eq("case_id", caseId)
    .eq("is_withdrawn", false)
    .order("submitted_at", { ascending: false });

  if (subErr) {
    return { items: [], evaluationCandidateIds: [], error: subErr };
  }

  const rows = (subs ?? []) as Array<{
    id: string;
    submission_number: number;
    submitted_at: string;
    timing_status: string;
    late_review_status: string | null;
    assessment_milestone_id: string;
    assessment_cycle_id: string;
  }>;

  const milestoneIds = [...new Set(rows.map((r) => r.assessment_milestone_id))];
  const cycleIds = [...new Set(rows.map((r) => r.assessment_cycle_id))];

  const [{ data: milestones }, { data: cycles }, { data: candidates }] =
    await Promise.all([
      milestoneIds.length
        ? supabase
            .from("assessment_milestones")
            .select("id, title, evaluation_type")
            .in("id", milestoneIds)
        : Promise.resolve({ data: [] as unknown[] }),
      cycleIds.length
        ? supabase
            .from("assessment_cycles")
            .select("id, title")
            .in("id", cycleIds)
        : Promise.resolve({ data: [] as unknown[] }),
      supabase
        .from("assessment_evaluation_candidates")
        .select("submission_id")
        .eq("student_user_id", userId)
        .eq("case_id", caseId),
    ]);

  const mMap = new Map(
    ((milestones ?? []) as Array<{
      id: string;
      title: string;
      evaluation_type: string;
    }>).map((m) => [m.id, m]),
  );
  const cMap = new Map(
    ((cycles ?? []) as Array<{ id: string; title: string }>).map((c) => [
      c.id,
      c,
    ]),
  );
  const evaluationCandidateIds = (
    (candidates ?? []) as Array<{ submission_id: string }>
  ).map((c) => c.submission_id);
  const candSet = new Set(evaluationCandidateIds);

  const items: AssessmentSubmissionListItem[] = rows.map((r) => {
    const m = mMap.get(r.assessment_milestone_id);
    const c = cMap.get(r.assessment_cycle_id);
    return {
      id: r.id,
      submissionNumber: r.submission_number,
      submittedAt: r.submitted_at,
      timingStatus: asTiming(r.timing_status),
      lateReviewStatus: asLateReview(r.late_review_status),
      isEvaluationCandidate: candSet.has(r.id),
      assessmentMilestoneId: r.assessment_milestone_id,
      milestoneTitle: m?.title ?? null,
      cycleTitle: c?.title ?? null,
      evaluationType: (m?.evaluation_type as AssessmentEvaluationType) ?? null,
    };
  });

  return { items, evaluationCandidateIds, error: null };
}

function mapCycle(row: Record<string, unknown>): AssessmentCycleRow {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    caseId: String(row.case_id),
    title: String(row.title),
    description: (row.description as string | null) ?? null,
    status: row.status as AssessmentCycleStatus,
    deadlineAt: String(row.deadline_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapMilestone(row: Record<string, unknown>): AssessmentMilestoneRow {
  return {
    id: String(row.id),
    assessmentCycleId: String(row.assessment_cycle_id),
    organizationId: String(row.organization_id),
    title: String(row.title),
    description: (row.description as string | null) ?? null,
    milestoneType: row.milestone_type as AssessmentMilestoneType,
    sequenceNumber: Number(row.sequence_number),
    opensAt: (row.opens_at as string | null) ?? null,
    deadlineAt: String(row.deadline_at),
    closesAt: (row.closes_at as string | null) ?? null,
    submissionScope: parseSubmissionScope(row.submission_scope),
    evaluationType: row.evaluation_type as AssessmentEvaluationType,
    status: row.status as AssessmentMilestoneStatus,
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function listCyclesForOrg(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<{ rows: AssessmentCycleRow[]; error: PgLikeError }> {
  logAssessmentDiag({
    op: "listCyclesForOrg",
    phase: "start",
    organizationId,
  });
  const { data, error } = await supabase
    .from("assessment_cycles")
    .select(
      "id, organization_id, case_id, title, description, status, deadline_at, created_at, updated_at",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  if (error) {
    logAssessmentDiag({
      op: "listCyclesForOrg",
      phase: "fail",
      organizationId,
      ...supabaseErrFields(error),
    });
    return { rows: [], error };
  }
  const rows = ((data ?? []) as Record<string, unknown>[]).map(mapCycle);
  logAssessmentDiag({
    op: "listCyclesForOrg",
    phase: "success",
    organizationId,
    detail: `count=${rows.length}`,
  });
  return { rows, error: null };
}

export async function listMilestonesForCycle(
  supabase: SupabaseClient,
  cycleId: string,
): Promise<{ rows: AssessmentMilestoneRow[]; error: PgLikeError }> {
  logAssessmentDiag({
    op: "listMilestonesForCycle",
    phase: "start",
    cycleId,
  });
  const { data, error } = await supabase
    .from("assessment_milestones")
    .select("*")
    .eq("assessment_cycle_id", cycleId)
    .order("sequence_number", { ascending: true });
  if (error) {
    logAssessmentDiag({
      op: "listMilestonesForCycle",
      phase: "fail",
      cycleId,
      ...supabaseErrFields(error),
    });
    return { rows: [], error };
  }

  const rows = ((data ?? []) as Record<string, unknown>[]).map(mapMilestone);
  const ids = rows.map((r) => r.id);
  if (ids.length === 0) {
    logAssessmentDiag({
      op: "listMilestonesForCycle",
      phase: "success",
      cycleId,
      detail: "count=0",
    });
    return { rows, error: null };
  }

  const { data: counts } = await supabase
    .from("assessment_submissions")
    .select("assessment_milestone_id")
    .in("assessment_milestone_id", ids);

  const countMap = new Map<string, number>();
  for (const c of (counts ?? []) as Array<{ assessment_milestone_id: string }>) {
    countMap.set(
      c.assessment_milestone_id,
      (countMap.get(c.assessment_milestone_id) ?? 0) + 1,
    );
  }
  logAssessmentDiag({
    op: "listMilestonesForCycle",
    phase: "success",
    cycleId,
    detail: `count=${rows.length}`,
  });
  return {
    rows: rows.map((r) => ({
      ...r,
      submissionCount: countMap.get(r.id) ?? 0,
    })),
    error: null,
  };
}

export async function insertCycle(
  supabase: SupabaseClient,
  values: {
    organization_id: string;
    case_id: string;
    title: string;
    description?: string | null;
    status: AssessmentCycleStatus;
    deadline_at: string;
    created_by: string;
  },
): Promise<{ row: AssessmentCycleRow | null; error: PgLikeError }> {
  const { data, error } = await supabase
    .from("assessment_cycles")
    .insert(values)
    .select(
      "id, organization_id, case_id, title, description, status, deadline_at, created_at, updated_at",
    )
    .maybeSingle();
  if (error) return { row: null, error };
  return {
    row: data ? mapCycle(data as Record<string, unknown>) : null,
    error: null,
  };
}

export async function updateCycle(
  supabase: SupabaseClient,
  id: string,
  patch: {
    title?: string;
    description?: string | null;
    status?: AssessmentCycleStatus;
  },
): Promise<{ row: AssessmentCycleRow | null; error: PgLikeError }> {
  const { data, error } = await supabase
    .from("assessment_cycles")
    .update(patch)
    .eq("id", id)
    .select(
      "id, organization_id, case_id, title, description, status, deadline_at, created_at, updated_at",
    )
    .maybeSingle();
  if (error) return { row: null, error };
  return {
    row: data ? mapCycle(data as Record<string, unknown>) : null,
    error: null,
  };
}

export async function insertMilestone(
  supabase: SupabaseClient,
  values: Record<string, unknown>,
): Promise<{ row: AssessmentMilestoneRow | null; error: PgLikeError }> {
  const { data, error } = await supabase
    .from("assessment_milestones")
    .insert(values)
    .select("*")
    .maybeSingle();
  if (error) return { row: null, error };
  return {
    row: data ? mapMilestone(data as Record<string, unknown>) : null,
    error: null,
  };
}

export async function updateMilestone(
  supabase: SupabaseClient,
  id: string,
  patch: Record<string, unknown>,
): Promise<{ row: AssessmentMilestoneRow | null; error: PgLikeError }> {
  const { data, error } = await supabase
    .from("assessment_milestones")
    .update(patch)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) return { row: null, error };
  return {
    row: data ? mapMilestone(data as Record<string, unknown>) : null,
    error: null,
  };
}

export async function renumberMilestones(
  supabase: SupabaseClient,
  cycleId: string,
  orderedIds: string[],
): Promise<{ error: PgLikeError }> {
  // Avoid unique collisions: temp high numbers then normalize
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from("assessment_milestones")
      .update({ sequence_number: 1000 + i })
      .eq("id", orderedIds[i]!)
      .eq("assessment_cycle_id", cycleId);
    if (error) return { error };
  }
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from("assessment_milestones")
      .update({ sequence_number: i + 1 })
      .eq("id", orderedIds[i]!)
      .eq("assessment_cycle_id", cycleId);
    if (error) return { error };
  }
  return { error: null };
}
