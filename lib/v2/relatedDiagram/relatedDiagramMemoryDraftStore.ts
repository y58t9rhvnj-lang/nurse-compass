/**
 * In-memory Related Diagram draft store for P3 tests and DEV wiring.
 * Same get/insert/update contract as the P2 repository. No Supabase.
 */

import {
  buildRelatedDiagramInsertRow,
  buildRelatedDiagramUpdatePatch,
  type RelatedDiagramRow,
} from "./relatedDiagramRecord";
import type {
  RelatedDiagramDraftStore,
  RelatedDiagramDraftStoreResult,
} from "./relatedDiagramDraftPersistence";
import type { RelatedDiagramSemanticGraph } from "./types";

function cloneJson<T>(value: T): T {
  return structuredClone(value);
}

function keyOf(userId: string, caseId: string): string {
  return `${userId}:${caseId}`;
}

export function createMemoryRelatedDiagramDraftStore(): RelatedDiagramDraftStore & {
  rows: Map<string, RelatedDiagramRow>;
} {
  const rows = new Map<string, RelatedDiagramRow>();
  let seq = 0;

  return {
    rows,
    async get(userId, caseId): Promise<RelatedDiagramDraftStoreResult> {
      const row = rows.get(keyOf(userId, caseId));
      return { row: row ? cloneJson(row) : null, error: null };
    },
    async insert(values): Promise<RelatedDiagramDraftStoreResult> {
      const key = keyOf(values.user_id, values.case_id);
      if (rows.has(key)) {
        return { row: null, error: { code: "23505", message: "duplicate" } };
      }
      const payload = buildRelatedDiagramInsertRow(values);
      const now = "2026-09-24T00:00:00.000Z";
      seq += 1;
      const row: RelatedDiagramRow = {
        id: `rd_mem_${seq}`,
        user_id: payload.user_id as string,
        organization_id: payload.organization_id as string,
        academic_year: payload.academic_year as number,
        case_id: payload.case_id as string,
        assessment_cycle_id: (payload.assessment_cycle_id as string | null) ?? null,
        status: (payload.status as RelatedDiagramRow["status"]) ?? "draft",
        canvas_schema_version: (payload.canvas_schema_version as string) ?? "1",
        knowledge_group_id: (payload.knowledge_group_id as string | null) ?? null,
        knowledge_version: (payload.knowledge_version as string | null) ?? null,
        semantic_graph: payload.semantic_graph as RelatedDiagramSemanticGraph,
        route_scene: (payload.route_scene as unknown | null) ?? null,
        version: payload.version as number,
        created_at: now,
        updated_at: now,
      };
      rows.set(key, cloneJson(row));
      return { row: cloneJson(row), error: null };
    },
    async update(params): Promise<RelatedDiagramDraftStoreResult> {
      const key = keyOf(params.userId, params.caseId);
      const existing = rows.get(key);
      if (!existing || existing.version !== params.expectedVersion) {
        return { row: null, error: null };
      }
      const patch = buildRelatedDiagramUpdatePatch(params);
      const next: RelatedDiagramRow = {
        ...existing,
        semantic_graph: patch.semantic_graph as RelatedDiagramSemanticGraph,
        version: patch.version as number,
        updated_at: "2026-09-24T01:00:00.000Z",
      };
      if ("route_scene" in patch) {
        next.route_scene = patch.route_scene as unknown | null;
      }
      rows.set(key, cloneJson(next));
      return { row: cloneJson(next), error: null };
    },
  };
}

export const devSlice1DraftStore = createMemoryRelatedDiagramDraftStore();
