/**
 * related_diagram_records row mapping (Persistence P2).
 * Stores semantic_graph + route_scene JSON. Does not parse or restore routes.
 */

import type {
  RelatedDiagramDraft,
  RelatedDiagramSemanticGraph,
  RelatedDiagramStatus,
} from "./types";
import { createEmptySemanticGraph } from "./semanticGraph";

export const RELATED_DIAGRAM_SELECT_COLUMNS =
  "id, user_id, organization_id, academic_year, case_id, assessment_cycle_id, status, canvas_schema_version, knowledge_group_id, knowledge_version, semantic_graph, route_scene, version, created_at, updated_at" as const;

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
  route_scene: unknown | null;
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
  route_scene?: unknown | null;
  status?: RelatedDiagramStatus;
  canvas_schema_version?: string;
};

export type RelatedDiagramUpdateParams = {
  userId: string;
  caseId: string;
  expectedVersion: number;
  semanticGraph: RelatedDiagramSemanticGraph;
  /** undefined = leave existing column; null = clear; object = persist JSON */
  routeScene?: unknown | null;
  status?: RelatedDiagramStatus;
  knowledgeGroupId?: string | null;
  knowledgeVersion?: string | null;
  assessmentCycleId?: string | null;
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
    routeScene: row.route_scene ?? null,
  };
}

export function buildRelatedDiagramInsertRow(
  values: RelatedDiagramInsertValues,
): Record<string, unknown> {
  return {
    user_id: values.user_id,
    organization_id: values.organization_id,
    academic_year: values.academic_year,
    case_id: values.case_id,
    assessment_cycle_id: values.assessment_cycle_id ?? null,
    knowledge_group_id: values.knowledge_group_id ?? null,
    knowledge_version: values.knowledge_version ?? null,
    semantic_graph: values.semantic_graph ?? createEmptySemanticGraph(),
    route_scene: values.route_scene === undefined ? null : values.route_scene,
    status: values.status ?? "draft",
    canvas_schema_version: values.canvas_schema_version ?? "1",
    version: 1,
  };
}

export function buildRelatedDiagramUpdatePatch(
  params: RelatedDiagramUpdateParams,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    semantic_graph: params.semanticGraph,
    version: params.expectedVersion + 1,
  };
  if (params.routeScene !== undefined) {
    patch.route_scene = params.routeScene;
  }
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
  return patch;
}
