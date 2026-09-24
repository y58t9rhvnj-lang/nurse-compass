/**
 * Persistence adapter: Draft Persistence store → P2 repository ops.
 * Ownership keys are resolved by the injected ops (server actions).
 * Client identity arguments are ignored.
 */

import type { RelatedDiagramSemanticGraph } from "./types";
import type {
  RelatedDiagramDraftStore,
  RelatedDiagramDraftStoreResult,
  PersistIdentity,
} from "./relatedDiagramDraftPersistence";

export type RelatedDiagramRepositoryDraftOps = {
  get(): Promise<RelatedDiagramDraftStoreResult>;
  insert(input: {
    semanticGraph: RelatedDiagramSemanticGraph;
    routeScene: unknown;
  }): Promise<RelatedDiagramDraftStoreResult>;
  update(input: {
    expectedVersion: number;
    semanticGraph: RelatedDiagramSemanticGraph;
    routeScene: unknown;
  }): Promise<RelatedDiagramDraftStoreResult>;
};

/** Placeholder only. Server actions overwrite ownership keys. */
export const SERVER_OWNED_PERSIST_IDENTITY: PersistIdentity = {
  userId: "",
  organizationId: "",
  academicYear: 0,
  caseId: "",
};

export function createRelatedDiagramRepositoryDraftStore(
  ops: RelatedDiagramRepositoryDraftOps,
): RelatedDiagramDraftStore {
  return {
    async get(): Promise<RelatedDiagramDraftStoreResult> {
      return ops.get();
    },
    async insert(values): Promise<RelatedDiagramDraftStoreResult> {
      return ops.insert({
        semanticGraph: values.semantic_graph as RelatedDiagramSemanticGraph,
        routeScene: values.route_scene,
      });
    },
    async update(params): Promise<RelatedDiagramDraftStoreResult> {
      return ops.update({
        expectedVersion: params.expectedVersion,
        semanticGraph: params.semanticGraph,
        routeScene: params.routeScene,
      });
    },
  };
}
