import "server-only";

/**
 * Related Diagram V1 — Supabase repository (Slice 0).
 * Pure DB access; authorization is enforced by RLS + caller profile values.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  RELATED_DIAGRAM_SEMANTIC_SCHEMA_VERSION,
  type RelatedDiagramDraft,
  type RelatedDiagramSemanticGraph,
  type RelatedDiagramStatus,
} from "./types";
import { createEmptySemanticGraph } from "./semanticGraph";

/** PostgREST / supabase-js error shape used by notebook repositories. */
export type RelatedDiagramPgLikeError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

export const RELATED_DIAGRAM_SELECT_COLUMNS =
  "id, user_id, organization_id, academic_year, case_id, assessment_cycle_id, status, canvas_schema_version, knowledge_group_id, knowledge_version, semantic_graph, version, created_at, updated_at" as const;

export type RelatedDiagramRow = {
  id: string;
  user_id: string;
  organization_id: string;
  academic_year: number;
  case_id: string;
  assessment_cycle_id: string | null;
  status: RelatedDiagramStatus;
  canvas_schema_version: string;
  knowledge_group_id: string | null;
  knowledge_version: string | null;
  semantic_graph: RelatedDiagramSemanticGraph;
  version: number;
  created_at: string;
  updated_at: string;
};

export type RelatedDiagramInsertValues = {
  user_id: string;
  organization_id: string;
  academic_year: number;
  case_id: string;
  assessment_cycle_id?: string | null;
  knowledge_group_id?: string | null;
  knowledge_version?: string | null;
  semantic_graph?: RelatedDiagramSemanticGraph;
  status?: RelatedDiagramStatus;
  canvas_schema_version?: string;
};

type RepoResult = {
  row: RelatedDiagramRow | null;
  error: RelatedDiagramPgLikeError | null;
};

export function mapRelatedDiagramRow(row: RelatedDiagramRow): RelatedDiagramDraft {
  return {
    id: row.id,
    userId: row.user_id,
    organizationId: row.organization_id,
    academicYear: row.academic_year,
    caseId: row.case_id,
    assessmentCycleId: row.assessment_cycle_id,
    status: row.status,
    canvasSchemaVersion: row.canvas_schema_version,
    knowledgeGroupId: row.knowledge_group_id,
    knowledgeVersion: row.knowledge_version,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    semanticGraph: row.semantic_graph,
  };
}

export async function getRelatedDiagram(
  supabase: SupabaseClient,
  userId: string,
  caseId: string,
): Promise<RepoResult> {
  const { data, error } = await supabase
    .from("related_diagram_records")
    .select(RELATED_DIAGRAM_SELECT_COLUMNS)
    .eq("user_id", userId)
    .eq("case_id", caseId)
    .maybeSingle();
  return {
    row: (data as RelatedDiagramRow | null) ?? null,
    error: error as RelatedDiagramPgLikeError | null,
  };
}

export async function insertRelatedDiagram(
  supabase: SupabaseClient,
  values: RelatedDiagramInsertValues,
): Promise<RepoResult> {
  const { data, error } = await supabase
    .from("related_diagram_records")
    .insert({
      user_id: values.user_id,
      organization_id: values.organization_id,
      academic_year: values.academic_year,
      case_id: values.case_id,
      assessment_cycle_id: values.assessment_cycle_id ?? null,
      knowledge_group_id: values.knowledge_group_id ?? null,
      knowledge_version: values.knowledge_version ?? null,
      semantic_graph: values.semantic_graph ?? createEmptySemanticGraph(),
      status: values.status ?? "draft",
      canvas_schema_version: values.canvas_schema_version ?? "1",
      version: 1,
    })
    .select(RELATED_DIAGRAM_SELECT_COLUMNS)
    .maybeSingle();
  return {
    row: (data as RelatedDiagramRow | null) ?? null,
    error: error as RelatedDiagramPgLikeError | null,
  };
}

/**
 * Optimistic lock update of semantic_graph (+ optional metadata).
 * Bumps DB version when expectedVersion matches.
 *
 * knowledgeGroupId / knowledgeVersion: callers must pass values from
 * resolveKnowledgeBinding() / draftBindKnowledge() so group.version is the
 * sole version source on the normal path.
 */
export async function updateRelatedDiagramWithVersion(
  supabase: SupabaseClient,
  params: {
    userId: string;
    caseId: string;
    expectedVersion: number;
    semanticGraph: RelatedDiagramSemanticGraph;
    status?: RelatedDiagramStatus;
    knowledgeGroupId?: string | null;
    knowledgeVersion?: string | null;
    assessmentCycleId?: string | null;
  },
): Promise<RepoResult> {
  const patch: Record<string, unknown> = {
    semantic_graph: params.semanticGraph,
    version: params.expectedVersion + 1,
  };
  if (params.status !== undefined) patch.status = params.status;
  if (params.knowledgeGroupId !== undefined) {
    patch.knowledge_group_id = params.knowledgeGroupId;
  }
  if (params.knowledgeVersion !== undefined) {
    patch.knowledge_version = params.knowledgeVersion;
  }
  if (params.assessmentCycleId !== undefined) {
    patch.assessment_cycle_id = params.assessmentCycleId;
  }

  const { data, error } = await supabase
    .from("related_diagram_records")
    .update(patch)
    .eq("user_id", params.userId)
    .eq("case_id", params.caseId)
    .eq("version", params.expectedVersion)
    .select(RELATED_DIAGRAM_SELECT_COLUMNS)
    .maybeSingle();
  return {
    row: (data as RelatedDiagramRow | null) ?? null,
    error: error as RelatedDiagramPgLikeError | null,
  };
}

export function assertSemanticSchemaVersion(
  graph: RelatedDiagramSemanticGraph,
): boolean {
  return graph.semanticSchemaVersion === RELATED_DIAGRAM_SEMANTIC_SCHEMA_VERSION;
}
