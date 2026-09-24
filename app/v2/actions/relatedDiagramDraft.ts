"use server";

/**
 * Student Related Diagram draft row access.
 * Identity comes from the authenticated profile + caseIdForPatient.
 * Client-supplied user/org/year/case values are not used.
 */

import { isSupabaseConfigured } from "@/lib/v2/env";
import { getCurrentProfile, type AppProfile } from "@/lib/v2/auth/currentUser";
import { createServerSupabaseClient } from "@/lib/v2/supabase/serverClient";
import { caseIdForPatient } from "@/lib/v2/notebook/caseId";
import { classifyDbError } from "@/lib/v2/notebook/types";
import {
  getRelatedDiagram,
  insertRelatedDiagram,
  updateRelatedDiagramWithVersion,
} from "@/lib/v2/relatedDiagram/relatedDiagramRepository";
import type { RelatedDiagramDraftStoreResult } from "@/lib/v2/relatedDiagram/relatedDiagramDraftPersistence";
import type { RelatedDiagramSemanticGraph } from "@/lib/v2/relatedDiagram/types";
import type { SupabaseClient } from "@supabase/supabase-js";

const STUDENT_RELATED_DIAGRAM_PATIENT_ID = "A";

type StudentContext =
  | { ok: true; supabase: SupabaseClient; profile: AppProfile; caseId: string }
  | { ok: false; result: RelatedDiagramDraftStoreResult };

function storeError(
  code: string,
  message: string,
): RelatedDiagramDraftStoreResult {
  return { row: null, error: { code, message } };
}

async function requireStudentContext(): Promise<StudentContext> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      result: storeError("not_configured", "backend not configured"),
    };
  }
  const profile = await getCurrentProfile();
  if (!profile || !profile.isActive || profile.role !== "student") {
    return {
      ok: false,
      result: storeError("unauthorized", "student login required"),
    };
  }
  if (!profile.organizationId || !Number.isInteger(profile.academicYear)) {
    return {
      ok: false,
      result: storeError("unauthorized", "profile incomplete"),
    };
  }
  const caseId = caseIdForPatient(STUDENT_RELATED_DIAGRAM_PATIENT_ID);
  if (!caseId) {
    return {
      ok: false,
      result: storeError("validation", "unknown case"),
    };
  }
  const supabase = await createServerSupabaseClient();
  return { ok: true, supabase, profile, caseId };
}

function mapRepoError(
  error: { code?: string; message?: string } | null,
): RelatedDiagramDraftStoreResult {
  const kind = classifyDbError(error);
  if (kind === "duplicate") {
    return storeError("conflict", "他の場所で更新されています");
  }
  if (kind === "unauthorized") {
    return storeError("unauthorized", "student login required");
  }
  return storeError(kind, "failed to save related diagram");
}

export async function readRelatedDiagramDraftRowAction(): Promise<RelatedDiagramDraftStoreResult> {
  const ctx = await requireStudentContext();
  if (!ctx.ok) return ctx.result;
  const { row, error } = await getRelatedDiagram(
    ctx.supabase,
    ctx.profile.id,
    ctx.caseId,
  );
  if (error) return mapRepoError(error);
  return { row, error: null };
}

export async function insertRelatedDiagramDraftRowAction(input: {
  semanticGraph: RelatedDiagramSemanticGraph;
  routeScene: unknown;
}): Promise<RelatedDiagramDraftStoreResult> {
  const ctx = await requireStudentContext();
  if (!ctx.ok) return ctx.result;
  const { row, error } = await insertRelatedDiagram(ctx.supabase, {
    user_id: ctx.profile.id,
    organization_id: ctx.profile.organizationId,
    academic_year: ctx.profile.academicYear,
    case_id: ctx.caseId,
    semantic_graph: input.semanticGraph,
    route_scene: input.routeScene,
  });
  if (error || !row) return mapRepoError(error);
  return { row, error: null };
}

export async function updateRelatedDiagramDraftRowAction(input: {
  expectedVersion: number;
  semanticGraph: RelatedDiagramSemanticGraph;
  routeScene: unknown;
}): Promise<RelatedDiagramDraftStoreResult> {
  const ctx = await requireStudentContext();
  if (!ctx.ok) return ctx.result;
  if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 1) {
    return storeError("validation", "invalid version");
  }
  const { row, error } = await updateRelatedDiagramWithVersion(ctx.supabase, {
    userId: ctx.profile.id,
    caseId: ctx.caseId,
    expectedVersion: input.expectedVersion,
    semanticGraph: input.semanticGraph,
    routeScene: input.routeScene,
  });
  if (error) return mapRepoError(error);
  return { row, error: null };
}
