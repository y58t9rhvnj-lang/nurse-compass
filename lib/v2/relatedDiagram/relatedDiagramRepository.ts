import "server-only";

/**
 * Related Diagram V1 — Supabase repository (Slice 0 + Persistence P2).
 * Pure DB access; authorization is enforced by RLS + caller profile values.
 * Stores route_scene JSON as-is. Does not parse, restore, or generate routes.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  RELATED_DIAGRAM_SEMANTIC_SCHEMA_VERSION,
  type RelatedDiagramSemanticGraph,
} from "./types";
import {
  RELATED_DIAGRAM_SELECT_COLUMNS,
  buildRelatedDiagramInsertRow,
  buildRelatedDiagramUpdatePatch,
  mapRelatedDiagramRow,
  type RelatedDiagramInsertValues,
  type RelatedDiagramRow,
  type RelatedDiagramUpdateParams,
} from "./relatedDiagramRecord";

export {
  RELATED_DIAGRAM_SELECT_COLUMNS,
  buildRelatedDiagramInsertRow,
  buildRelatedDiagramUpdatePatch,
  mapRelatedDiagramRow,
};
export type {
  RelatedDiagramInsertValues,
  RelatedDiagramRow,
  RelatedDiagramUpdateParams,
};

/** PostgREST / supabase-js error shape used by notebook repositories. */
export type RelatedDiagramPgLikeError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

type RepoResult = {
  row: RelatedDiagramRow | null;
  error: RelatedDiagramPgLikeError | null;
};

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
    .insert(buildRelatedDiagramInsertRow(values))
    .select(RELATED_DIAGRAM_SELECT_COLUMNS)
    .maybeSingle();
  return {
    row: (data as RelatedDiagramRow | null) ?? null,
    error: error as RelatedDiagramPgLikeError | null,
  };
}

/**
 * Optimistic lock update of semantic_graph (+ optional route_scene / metadata).
 * Bumps DB version when expectedVersion matches.
 *
 * routeScene omitted → existing route_scene is left unchanged.
 * routeScene null → persist null.
 * routeScene object → persist that JSON in the same UPDATE as semantic_graph.
 *
 * knowledgeGroupId / knowledgeVersion: callers must pass values from
 * resolveKnowledgeBinding() / draftBindKnowledge() so group.version is the
 * sole version source on the normal path.
 */
export async function updateRelatedDiagramWithVersion(
  supabase: SupabaseClient,
  params: RelatedDiagramUpdateParams,
): Promise<RepoResult> {
  const { data, error } = await supabase
    .from("related_diagram_records")
    .update(buildRelatedDiagramUpdatePatch(params))
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
