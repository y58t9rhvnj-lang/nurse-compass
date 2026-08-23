"use server";

import { isSupabaseConfigured } from "@/lib/v2/env";
import { getCurrentProfile, type AppProfile } from "@/lib/v2/auth/currentUser";
import { createServerSupabaseClient } from "@/lib/v2/supabase/serverClient";
import { caseIdForPatient, isKnownPatient } from "@/lib/v2/notebook/caseId";
import {
  insertCycle,
  insertMilestone,
  listCyclesForOrg,
  listMilestonesForCycle,
  renumberMilestones,
  updateCycle,
  updateMilestone,
} from "@/lib/v2/assessment/assessmentRepository";
import {
  defaultScopeForType,
  validateScopeForType,
} from "@/lib/v2/assessment/submissionScope";
import type {
  AssessmentCycleRow,
  AssessmentCycleStatus,
  AssessmentEvaluationType,
  AssessmentMilestoneRow,
  AssessmentMilestoneStatus,
  AssessmentMilestoneType,
  AssessmentSubmissionScope,
} from "@/lib/v2/assessment/types";
import type { Form3PatternKey } from "@/lib/form3/form3Types";
import type { SupabaseClient } from "@supabase/supabase-js";

type StaffContext =
  | { ok: true; supabase: SupabaseClient; profile: AppProfile }
  | { ok: false; kind: string; message: string };

async function requireStaffContext(): Promise<StaffContext> {
  if (!isSupabaseConfigured()) {
    return { ok: false, kind: "not_configured", message: "backend not configured" };
  }
  const profile = await getCurrentProfile();
  if (
    !profile ||
    !profile.isActive ||
    (profile.role !== "teacher" && profile.role !== "admin")
  ) {
    return { ok: false, kind: "unauthorized", message: "staff login required" };
  }
  const supabase = await createServerSupabaseClient();
  return { ok: true, supabase, profile };
}

export async function listAssessmentCyclesAction(): Promise<
  | { ok: true; cycles: AssessmentCycleRow[] }
  | { ok: false; kind: string; message: string }
> {
  const ctx = await requireStaffContext();
  if (!ctx.ok) return ctx;
  const listed = await listCyclesForOrg(
    ctx.supabase,
    ctx.profile.organizationId,
  );
  if (listed.error) {
    return { ok: false, kind: "db_error", message: "failed to load cycles" };
  }
  return { ok: true, cycles: listed.rows };
}

export async function createAssessmentCycleAction(input: {
  title: string;
  patientId: string;
  description?: string | null;
  status?: AssessmentCycleStatus;
}): Promise<
  | { ok: true; cycle: AssessmentCycleRow }
  | { ok: false; kind: string; message: string }
> {
  const ctx = await requireStaffContext();
  if (!ctx.ok) return ctx;
  const title = input.title.trim();
  if (!title) return { ok: false, kind: "validation", message: "title required" };
  if (!isKnownPatient(input.patientId)) {
    return { ok: false, kind: "validation", message: "unknown case" };
  }
  const caseId = caseIdForPatient(input.patientId)!;
  // cycle.deadline_at は互換必須列。正本は milestone。遠い未来を仮置き。
  const placeholderDeadline = new Date(
    Date.now() + 365 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const inserted = await insertCycle(ctx.supabase, {
    organization_id: ctx.profile.organizationId,
    case_id: caseId,
    title,
    description: input.description?.trim() || null,
    status: input.status ?? "open",
    deadline_at: placeholderDeadline,
    created_by: ctx.profile.id,
  });
  if (inserted.error || !inserted.row) {
    return { ok: false, kind: "db_error", message: "failed to create cycle" };
  }
  return { ok: true, cycle: inserted.row };
}

export async function updateAssessmentCycleAction(input: {
  id: string;
  title: string;
  description?: string | null;
  status: AssessmentCycleStatus;
}): Promise<
  | { ok: true; cycle: AssessmentCycleRow }
  | { ok: false; kind: string; message: string }
> {
  const ctx = await requireStaffContext();
  if (!ctx.ok) return ctx;
  const title = input.title.trim();
  if (!title) return { ok: false, kind: "validation", message: "title required" };

  const { data: existing } = await ctx.supabase
    .from("assessment_cycles")
    .select("id, organization_id")
    .eq("id", input.id)
    .maybeSingle();
  if (!existing) {
    return { ok: false, kind: "not_found", message: "cycle not found" };
  }
  if (
    (existing as { organization_id: string }).organization_id !==
    ctx.profile.organizationId
  ) {
    return { ok: false, kind: "unauthorized", message: "wrong organization" };
  }

  const updated = await updateCycle(ctx.supabase, input.id, {
    title,
    description: input.description?.trim() || null,
    status: input.status,
  });
  if (updated.error || !updated.row) {
    return { ok: false, kind: "db_error", message: "failed to update cycle" };
  }
  return { ok: true, cycle: updated.row };
}

export async function listAssessmentMilestonesAction(
  cycleId: string,
): Promise<
  | { ok: true; milestones: AssessmentMilestoneRow[] }
  | { ok: false; kind: string; message: string }
> {
  const ctx = await requireStaffContext();
  if (!ctx.ok) return ctx;
  const listed = await listMilestonesForCycle(ctx.supabase, cycleId);
  if (listed.error) {
    return { ok: false, kind: "db_error", message: "failed to load milestones" };
  }
  // org guard
  const filtered = listed.rows.filter(
    (m) => m.organizationId === ctx.profile.organizationId,
  );
  return { ok: true, milestones: filtered };
}

export async function upsertAssessmentMilestoneAction(input: {
  id?: string;
  assessmentCycleId: string;
  title: string;
  description?: string | null;
  milestoneType: AssessmentMilestoneType;
  evaluationType: AssessmentEvaluationType;
  opensAt?: string | null;
  deadlineAt: string;
  status: AssessmentMilestoneStatus;
  patternIds?: Form3PatternKey[];
  submissionScope?: AssessmentSubmissionScope;
}): Promise<
  | { ok: true; milestone: AssessmentMilestoneRow }
  | { ok: false; kind: string; message: string }
> {
  const ctx = await requireStaffContext();
  if (!ctx.ok) return ctx;

  const title = input.title.trim();
  if (!title) return { ok: false, kind: "validation", message: "title required" };
  if (!input.deadlineAt) {
    return { ok: false, kind: "validation", message: "deadline required" };
  }

  const scope =
    input.submissionScope ??
    defaultScopeForType(input.milestoneType, input.patternIds ?? []);
  const scopeError = validateScopeForType(input.milestoneType, scope);
  if (scopeError) {
    return { ok: false, kind: "validation", message: scopeError };
  }

  // verify cycle belongs to org
  const { data: cycle, error: cycleErr } = await ctx.supabase
    .from("assessment_cycles")
    .select("id, organization_id, case_id")
    .eq("id", input.assessmentCycleId)
    .maybeSingle();
  if (cycleErr || !cycle) {
    return { ok: false, kind: "not_found", message: "cycle not found" };
  }
  if (
    (cycle as { organization_id: string }).organization_id !==
    ctx.profile.organizationId
  ) {
    return { ok: false, kind: "unauthorized", message: "wrong organization" };
  }

  if (input.id) {
    const updated = await updateMilestone(ctx.supabase, input.id, {
      title,
      description: input.description ?? null,
      milestone_type: input.milestoneType,
      evaluation_type: input.evaluationType,
      opens_at: input.opensAt ?? null,
      deadline_at: input.deadlineAt,
      status: input.status,
      submission_scope: scope,
    });
    if (updated.error || !updated.row) {
      return { ok: false, kind: "db_error", message: "failed to update" };
    }
    return { ok: true, milestone: updated.row };
  }

  const existing = await listMilestonesForCycle(
    ctx.supabase,
    input.assessmentCycleId,
  );
  const nextSeq =
    (existing.rows.reduce((m, r) => Math.max(m, r.sequenceNumber), 0) || 0) + 1;

  const inserted = await insertMilestone(ctx.supabase, {
    assessment_cycle_id: input.assessmentCycleId,
    organization_id: ctx.profile.organizationId,
    title,
    description: input.description ?? null,
    milestone_type: input.milestoneType,
    sequence_number: nextSeq,
    opens_at: input.opensAt ?? null,
    deadline_at: input.deadlineAt,
    closes_at: null,
    submission_scope: scope,
    evaluation_type: input.evaluationType,
    status: input.status,
    created_by: ctx.profile.id,
  });
  if (inserted.error || !inserted.row) {
    return { ok: false, kind: "db_error", message: "failed to create" };
  }
  return { ok: true, milestone: inserted.row };
}

export async function setAssessmentMilestoneStatusAction(input: {
  id: string;
  status: AssessmentMilestoneStatus;
}): Promise<
  | { ok: true; milestone: AssessmentMilestoneRow }
  | { ok: false; kind: string; message: string }
> {
  const ctx = await requireStaffContext();
  if (!ctx.ok) return ctx;
  const { data: existing } = await ctx.supabase
    .from("assessment_milestones")
    .select("id, organization_id")
    .eq("id", input.id)
    .maybeSingle();
  if (!existing) {
    return { ok: false, kind: "not_found", message: "milestone not found" };
  }
  if (
    String((existing as { organization_id: string }).organization_id) !==
    ctx.profile.organizationId
  ) {
    return { ok: false, kind: "unauthorized", message: "wrong organization" };
  }
  const updated = await updateMilestone(ctx.supabase, input.id, {
    status: input.status,
  });
  if (updated.error || !updated.row) {
    return { ok: false, kind: "db_error", message: "failed to update status" };
  }
  return { ok: true, milestone: updated.row };
}

export async function duplicateAssessmentMilestoneAction(
  id: string,
): Promise<
  | { ok: true; milestone: AssessmentMilestoneRow }
  | { ok: false; kind: string; message: string }
> {
  const ctx = await requireStaffContext();
  if (!ctx.ok) return ctx;
  const { data, error } = await ctx.supabase
    .from("assessment_milestones")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) {
    return { ok: false, kind: "not_found", message: "milestone not found" };
  }
  const src = data as Record<string, unknown>;
  if (String(src.organization_id) !== ctx.profile.organizationId) {
    return { ok: false, kind: "unauthorized", message: "wrong organization" };
  }
  const listed = await listMilestonesForCycle(
    ctx.supabase,
    String(src.assessment_cycle_id),
  );
  const nextSeq =
    (listed.rows.reduce((m, r) => Math.max(m, r.sequenceNumber), 0) || 0) + 1;

  const inserted = await insertMilestone(ctx.supabase, {
    assessment_cycle_id: src.assessment_cycle_id,
    organization_id: src.organization_id,
    title: `${String(src.title)}（コピー）`,
    description: src.description,
    milestone_type: src.milestone_type,
    sequence_number: nextSeq,
    opens_at: src.opens_at,
    deadline_at: src.deadline_at,
    closes_at: null,
    submission_scope: src.submission_scope,
    evaluation_type: src.evaluation_type,
    status: "draft",
    created_by: ctx.profile.id,
  });
  if (inserted.error || !inserted.row) {
    return { ok: false, kind: "db_error", message: "failed to duplicate" };
  }
  return { ok: true, milestone: inserted.row };
}

export async function moveAssessmentMilestoneAction(input: {
  cycleId: string;
  milestoneId: string;
  direction: "up" | "down";
}): Promise<
  | { ok: true; milestones: AssessmentMilestoneRow[] }
  | { ok: false; kind: string; message: string }
> {
  const ctx = await requireStaffContext();
  if (!ctx.ok) return ctx;
  const listed = await listMilestonesForCycle(ctx.supabase, input.cycleId);
  if (listed.error) {
    return { ok: false, kind: "db_error", message: "failed to load" };
  }
  const rows = listed.rows.filter(
    (m) => m.organizationId === ctx.profile.organizationId,
  );
  const idx = rows.findIndex((m) => m.id === input.milestoneId);
  if (idx < 0) return { ok: false, kind: "not_found", message: "not found" };
  const swapWith = input.direction === "up" ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= rows.length) {
    return { ok: true, milestones: rows };
  }
  const ordered = rows.map((r) => r.id);
  const tmp = ordered[idx]!;
  ordered[idx] = ordered[swapWith]!;
  ordered[swapWith] = tmp;
  const renumbered = await renumberMilestones(
    ctx.supabase,
    input.cycleId,
    ordered,
  );
  if (renumbered.error) {
    return { ok: false, kind: "db_error", message: "failed to reorder" };
  }
  const again = await listMilestonesForCycle(ctx.supabase, input.cycleId);
  return { ok: true, milestones: again.rows };
}
