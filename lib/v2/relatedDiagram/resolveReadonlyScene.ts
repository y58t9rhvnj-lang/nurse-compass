/**
 * Slice 1 readonly scene resolution (student runtime).
 *
 * Student path:
 * - published Knowledge binding → foundation graph only (no style demo)
 * - no binding → empty (handled by caller)
 * - load error → error (handled by caller)
 *
 * Development fixture / style-demo merge lives only in
 * `resolveDevFixtureReadonlyScene` and must never be used as production fallback.
 */

import type { RelatedDiagramSemanticGraph } from "./types";
import { RELATED_DIAGRAM_SEMANTIC_SCHEMA_VERSION } from "./types";
import {
  buildSchizophreniaKnowledgeGraph,
  buildSlice1StyleDemoGraph,
  SLICE1_CANVAS_META,
} from "./fixtures/schizophreniaPathophysiologyFixture";
import {
  buildSchizophreniaKnowledgeTopology,
  buildSlice1DevRouteTopology,
} from "./fixtures/schizophreniaRouteTopology";
import type { RelatedDiagramRouteTopology } from "./routeTopology";

export type RelatedDiagramReadonlyScene = {
  graph: RelatedDiagramSemanticGraph;
  source: "knowledge_binding" | "dev_fixture";
  knowledgeTitle: string;
  knowledgeVersion: string;
  /** Always false on student runtime scenes. */
  includesStyleDemo: boolean;
  /** Layout/routing metadata only. Absent on student scenes until Slice 2. */
  routeTopology?: RelatedDiagramRouteTopology;
};

export function emptyRelatedDiagramGraph(): RelatedDiagramSemanticGraph {
  return {
    semanticSchemaVersion: RELATED_DIAGRAM_SEMANTIC_SCHEMA_VERSION,
    cards: [],
    cardSources: [],
    connections: [],
    nursingProblems: [],
    nursingProblemSupports: [],
    integrations: [],
    integrationMembers: [],
  };
}

/** Student / production: Knowledge foundation only. Never merges style demo. */
export function resolveReadonlySceneFromKnowledgeBinding(input: {
  foundation: RelatedDiagramSemanticGraph;
  knowledgeTitle: string;
  knowledgeVersion: string;
}): RelatedDiagramReadonlyScene {
  return {
    graph: input.foundation,
    source: "knowledge_binding",
    knowledgeTitle: input.knowledgeTitle,
    knowledgeVersion: input.knowledgeVersion,
    includesStyleDemo: false,
  };
}

/**
 * DEV / test / static preview only.
 * Merges schizophrenia pathology fixture + semantic style demo.
 * Must not be called from student production load path.
 */
export function resolveDevFixtureReadonlyScene(options?: {
  includeStyleDemo?: boolean;
}): RelatedDiagramReadonlyScene {
  const includeStyleDemo = options?.includeStyleDemo !== false;
  const foundation = buildSchizophreniaKnowledgeGraph();
  if (!includeStyleDemo) {
    return {
      graph: foundation,
      source: "dev_fixture",
      knowledgeTitle: SLICE1_CANVAS_META.knowledgeTitle,
      knowledgeVersion: SLICE1_CANVAS_META.knowledgeVersion,
      includesStyleDemo: false,
      routeTopology: buildSchizophreniaKnowledgeTopology(),
    };
  }
  const demo = buildSlice1StyleDemoGraph();
  return {
    graph: {
      semanticSchemaVersion: RELATED_DIAGRAM_SEMANTIC_SCHEMA_VERSION,
      cards: [...foundation.cards, ...demo.cards],
      cardSources: [...foundation.cardSources, ...demo.cardSources],
      connections: [...foundation.connections, ...demo.connections],
      nursingProblems: demo.nursingProblems,
      nursingProblemSupports: demo.nursingProblemSupports,
      integrations: demo.integrations,
      integrationMembers: demo.integrationMembers,
    },
    source: "dev_fixture",
    knowledgeTitle: SLICE1_CANVAS_META.knowledgeTitle,
    knowledgeVersion: SLICE1_CANVAS_META.knowledgeVersion,
    includesStyleDemo: true,
    routeTopology: buildSlice1DevRouteTopology(),
  };
}
