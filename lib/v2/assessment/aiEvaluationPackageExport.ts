/**
 * Package 生成＋evaluation_request 記録（個別 / Batch 共通）
 */

import { randomUUID } from "crypto";
import type { AppProfile } from "@/lib/v2/auth/currentUser";
import { isServiceRoleConfigured } from "@/lib/v2/env.server";
import { createAdminSupabaseClient } from "@/lib/v2/supabase/adminClient";
import {
  AI_EXPORT_SCHEMA_VERSION,
  type AiAnonymousIdMapper,
} from "@/lib/v2/assessment/aiExportAnonymize";
import {
  buildAiEvaluationPackage,
  type AiEvaluationPackage,
} from "@/lib/v2/assessment/aiEvaluationPackageBuilder";
import { insertAiEvaluationRequest } from "@/lib/v2/assessment/aiEvaluationRequestRepository";
import { sha256HexOfCanonicalJson } from "@/lib/v2/assessment/aiEvaluationResultHash";
import {
  AI_EVAL_COMPASS_POLICY_VERSION,
  AI_EVAL_PACKAGE_SCHEMA_VERSION,
  AI_EVAL_REQUEST_TTL_DAYS,
  AI_EVAL_RESULT_SCHEMA_VERSION,
  AI_EVAL_RUBRIC_VERSION,
  aiEvalCaseVersionsForPatientId,
} from "@/lib/v2/assessment/aiEvaluationVersions";
import type { BuiltAiExportRecord } from "@/lib/v2/assessment/aiEvaluationExportCore";

export async function buildPackagesForExport(input: {
  profile: AppProfile;
  built: BuiltAiExportRecord[];
  idSecret: string;
  idMapper: AiAnonymousIdMapper;
}): Promise<{
  packages: AiEvaluationPackage[];
  evaluationRequestIds: string[];
  exportedBuilt: BuiltAiExportRecord[];
  generatedAtIso: string;
}> {
  const generatedAt = new Date();
  const expiresAt = new Date(
    generatedAt.getTime() + AI_EVAL_REQUEST_TTL_DAYS * 24 * 60 * 60 * 1000,
  );
  const generatedAtIso = generatedAt.toISOString();
  const expiresAtIso = expiresAt.toISOString();
  const role = input.profile.role === "admin" ? "admin" : "teacher";
  const packages: AiEvaluationPackage[] = [];
  const evaluationRequestIds: string[] = [];
  const exportedBuilt: BuiltAiExportRecord[] = [];

  if (!isServiceRoleConfigured()) {
    return {
      packages: [],
      evaluationRequestIds: [],
      exportedBuilt: [],
      generatedAtIso,
    };
  }
  const admin = createAdminSupabaseClient();

  for (const b of input.built) {
    const evaluationRequestId = randomUUID();
    const caseVersions = aiEvalCaseVersionsForPatientId(b.patientId);
    const packageHash = sha256HexOfCanonicalJson({
      schema_version: AI_EXPORT_SCHEMA_VERSION,
      evaluation_request_id: evaluationRequestId,
      anonymous_ids: b.record.anonymous_ids,
      source_versions: b.record.source_versions,
      included_artifacts: b.record.included_artifacts,
    });

    const inserted = await insertAiEvaluationRequest(admin, {
      organizationId: input.profile.organizationId,
      assessmentSubmissionId: b.submissionId,
      assessmentCycleId: b.assessmentCycleId,
      assessmentMilestoneId: b.assessmentMilestoneId,
      studentUserId: b.studentUserId,
      evaluationRequestId,
      packageSchemaVersion: AI_EVAL_PACKAGE_SCHEMA_VERSION,
      resultSchemaVersion: AI_EVAL_RESULT_SCHEMA_VERSION,
      compassPolicyVersion: AI_EVAL_COMPASS_POLICY_VERSION,
      rubricVersion: AI_EVAL_RUBRIC_VERSION,
      goldStandardVersion: caseVersions.goldStandardVersion,
      caseVersion: caseVersions.caseVersion,
      exportSchemaVersion: AI_EXPORT_SCHEMA_VERSION,
      packageHash,
      anonymousSubmissionId: b.record.anonymous_ids.submission_id,
      generatedAt: generatedAtIso,
      generatedBy: input.profile.id,
      expiresAt: expiresAtIso,
    });
    if (!inserted.ok) {
      console.error(
        "[buildPackagesForExport] failed to record evaluation request",
        inserted.kind,
      );
      continue;
    }

    const pkg = buildAiEvaluationPackage({
      evaluationRequestId,
      generatedAt: generatedAtIso,
      generatedByRole: role,
      studentSubmission: b.record,
      packageScope: b.packageScope,
      patientId: b.patientId,
      idMapper: input.idMapper,
      idSecret: input.idSecret,
      organizationScopeKey: input.profile.organizationId,
    });
    packages.push(pkg);
    evaluationRequestIds.push(evaluationRequestId);
    exportedBuilt.push(b);
  }

  return { packages, evaluationRequestIds, exportedBuilt, generatedAtIso };
}
