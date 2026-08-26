"use server";

import { isSupabaseConfigured } from "@/lib/v2/env";
import { getCurrentProfile, type AppProfile } from "@/lib/v2/auth/currentUser";
import { createServerSupabaseClient } from "@/lib/v2/supabase/serverClient";
import {
  getTeacherAssessmentReviewBySubmissionId,
} from "@/lib/v2/assessment/assessmentReviewRepository";
import { isAssessmentReviewCurrentlyReturned } from "@/lib/v2/assessment/assessmentReviewStatus";
import { emptyRubricScores } from "@/lib/v2/assessment/assessmentRubric";
import {
  buildAiEvaluationCandidateReadModel,
  type AiEvaluationCandidateReadModel,
} from "@/lib/v2/assessment/aiEvaluationCandidateReadModel";
import { resolveAiEvaluationCitation } from "@/lib/v2/assessment/aiEvaluationCitationResolve";
import {
  countAdoptionsForStaging,
  getActiveAiEvaluationStagingForSubmission,
  listAiEvaluationStagingHistoryForSubmission,
} from "@/lib/v2/assessment/aiEvaluationCandidateRepository";
import { listWarningAcksForStaging } from "@/lib/v2/assessment/aiEvaluationWarningRepository";
import { parseAssessmentSnapshot } from "@/lib/v2/assessment/snapshotReadModel";
import { patientIdForCaseId } from "@/lib/v2/notebook/caseId";
import type { SupabaseClient } from "@supabase/supabase-js";

type StaffContext =
  | { ok: true; supabase: SupabaseClient; profile: AppProfile }
  | { ok: false; kind: string; message: string };

async function requireStaffContext(): Promise<StaffContext> {
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
    return { ok: false, kind: "unauthorized", message: "staff login required" };
  }
  const supabase = await createServerSupabaseClient();
  return { ok: true, supabase, profile };
}

export type GetAiEvaluationCandidateResult =
  | {
      ok: true;
      candidate: AiEvaluationCandidateReadModel | null;
      actorRole: "teacher" | "admin";
      canAcknowledgeWarnings: boolean;
      canAdopt: boolean;
    }
  | { ok: false; kind: string; message: string };

export async function getAiEvaluationCandidateForSubmissionAction(input: {
  submissionId: string;
}): Promise<GetAiEvaluationCandidateResult> {
  const ctx = await requireStaffContext();
  if (!ctx.ok) return ctx;
  if (!input.submissionId.trim()) {
    return { ok: false, kind: "validation", message: "提出が指定されていません。" };
  }

  const orgId = ctx.profile.organizationId;
  const active = await getActiveAiEvaluationStagingForSubmission(
    ctx.supabase,
    orgId,
    input.submissionId,
  );
  if (!active.ok) {
    return { ok: false, kind: "db_error", message: active.message };
  }

  const history = await listAiEvaluationStagingHistoryForSubmission(
    ctx.supabase,
    orgId,
    input.submissionId,
  );
  if (!history.ok) {
    return { ok: false, kind: "db_error", message: history.message };
  }

  if (!active.row) {
    return {
      ok: true,
      candidate: null,
      actorRole: ctx.profile.role as "teacher" | "admin",
      canAcknowledgeWarnings: ctx.profile.role === "teacher",
      canAdopt: false,
    };
  }

  const [acks, reviewGot, adoptionCount, submissionRow] = await Promise.all([
    listWarningAcksForStaging(ctx.supabase, orgId, active.row.id),
    getTeacherAssessmentReviewBySubmissionId(
      ctx.supabase,
      orgId,
      input.submissionId,
    ),
    countAdoptionsForStaging(ctx.supabase, active.row.id),
    ctx.supabase
      .from("assessment_submissions")
      .select("snapshot, case_id")
      .eq("id", input.submissionId)
      .eq("organization_id", orgId)
      .maybeSingle(),
  ]);

  if (!acks.ok) {
    return { ok: false, kind: "db_error", message: acks.message };
  }
  if (reviewGot.error) {
    return { ok: false, kind: "db_error", message: "評価を読み込めませんでした。" };
  }
  if (!adoptionCount.ok) {
    return { ok: false, kind: "db_error", message: adoptionCount.message };
  }

  const caseId =
    submissionRow.data &&
    typeof (submissionRow.data as { case_id?: string }).case_id === "string"
      ? (submissionRow.data as { case_id: string }).case_id
      : "";
  const patientId = patientIdForCaseId(caseId) ?? "A";
  const snapshotRaw = submissionRow.data
    ? (submissionRow.data as { snapshot?: unknown }).snapshot
    : null;
  const snapshot = parseAssessmentSnapshot(snapshotRaw, patientId);
  const snapshotOk = snapshot.ok ? snapshot : null;

  const review = reviewGot.row;
  const teacherScores = review?.rubricScores ?? emptyRubricScores();
  const actorRole = ctx.profile.role as "teacher" | "admin";

  const candidate = buildAiEvaluationCandidateReadModel({
    staging: {
      id: active.row.id,
      evaluationRequestId: active.row.evaluationRequestId,
      requestId: active.row.requestId,
      assessmentSubmissionId: active.row.assessmentSubmissionId,
      reviewStatus: active.row.reviewStatus,
      validationStatus: active.row.validationStatus,
      resultHash: active.row.resultHash,
      sourceModel: active.row.sourceModel,
      sourceProvider: active.row.sourceProvider,
      promptVersion: active.row.promptVersion,
      packageSchemaVersion: active.row.packageSchemaVersion,
      resultSchemaVersion: active.row.resultSchemaVersion,
      compassPolicyVersion: active.row.compassPolicyVersion,
      rubricVersion: active.row.rubricVersion,
      goldStandardVersion: active.row.goldStandardVersion,
      caseVersion: active.row.caseVersion,
      exportSchemaVersion: active.row.exportSchemaVersion,
      normalizedResultJson: active.row.normalizedResultJson,
      versionWarnings: active.row.versionWarnings,
      piiWarnings: active.row.piiWarnings,
      validationErrors: active.row.validationErrors,
      teacherDraftOverlayJson: active.row.teacherDraftOverlayJson,
      importedAt: active.row.importedAt,
    },
    acks: acks.rows.map((a) => ({
      warningFamily: a.warningFamily,
      warningCode: a.warningCode,
      warningPayloadHash: a.warningPayloadHash,
      acknowledgedAt: a.acknowledgedAt,
    })),
    teacherRubricScores: teacherScores,
    review: {
      status: review?.status ?? "draft",
      currentlyReturned: review
        ? isAssessmentReviewCurrentlyReturned(review)
        : false,
      exists: Boolean(review),
    },
    actorRole,
    history: history.rows,
    adoptionCount: adoptionCount.count,
    resolveCitation: (c) =>
      resolveAiEvaluationCitation({
        fieldPath: c.fieldPath,
        anonymousObjectId: c.anonymousObjectId,
        snapshot: snapshotOk,
      }),
  });

  return {
    ok: true,
    candidate,
    actorRole,
    canAcknowledgeWarnings: actorRole === "teacher",
    canAdopt: candidate.canAdopt && actorRole === "teacher",
  };
}
