/**
 * Pure mapping: Knowledge Library DB rows → semantic graph.
 * No server-only (safe for unit tests / client-adjacent code).
 */

import type {
  RelatedDiagramCard,
  RelatedDiagramConnection,
  RelatedDiagramSemanticGraph,
} from "./types";
import { RELATED_DIAGRAM_SEMANTIC_SCHEMA_VERSION } from "./types";

export type KnowledgeCardRow = {
  id: string;
  knowledge_group_id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  z_index: number;
};

export type KnowledgeConnectionRow = {
  id: string;
  knowledge_group_id: string;
  source_knowledge_card_id: string;
  target_knowledge_card_id: string;
  relation_type: string;
};

const TS = "1970-01-01T00:00:00.000Z";

export function knowledgeRowsToSemanticGraph(input: {
  cards: KnowledgeCardRow[];
  connections: KnowledgeConnectionRow[];
  knowledgeVersion: string;
}): RelatedDiagramSemanticGraph {
  const cards: RelatedDiagramCard[] = input.cards.map((c) => ({
    id: c.id,
    cardType: "knowledge",
    text: c.text,
    state: null,
    origin: "knowledge_library",
    layout: {
      x: Number(c.x),
      y: Number(c.y),
      width: Number(c.width),
      height: Number(c.height),
      zIndex: Number(c.z_index),
    },
    isLocked: true,
    createdAt: TS,
    updatedAt: TS,
  }));

  const connections: RelatedDiagramConnection[] = input.connections.map(
    (c) => ({
      id: c.id,
      sourceCardId: c.source_knowledge_card_id,
      targetCardId: c.target_knowledge_card_id,
      relationType:
        c.relation_type === "potential" || c.relation_type === "treatment"
          ? c.relation_type
          : "current",
      origin: "knowledge_library",
      createdAt: TS,
      updatedAt: TS,
    }),
  );

  return {
    semanticSchemaVersion: RELATED_DIAGRAM_SEMANTIC_SCHEMA_VERSION,
    cards,
    cardSources: cards.map((c) => ({
      id: `ksrc_${c.id}`,
      cardId: c.id,
      sourceType: "knowledge_library" as const,
      sourceId: c.id,
      sourceVersion: input.knowledgeVersion,
      sourcePattern: null,
      relation: "pathology_foundation",
      createdAt: TS,
    })),
    connections,
    nursingProblems: [],
    nursingProblemSupports: [],
    integrations: [],
    integrationMembers: [],
  };
}
