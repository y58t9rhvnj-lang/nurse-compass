/**
 * Development-only fixture: teacher-reviewed風の統合失調症 病態 Knowledge.
 * NOT for production Knowledge Library seed. Slice 1 renderer / density QA only.
 */

import type {
  RelatedDiagramCard,
  RelatedDiagramConnection,
  RelatedDiagramKnowledgeSnapshot,
  RelatedDiagramSemanticGraph,
} from "../types";
import { RELATED_DIAGRAM_SEMANTIC_SCHEMA_VERSION } from "../types";
import { A3_HEIGHT_PX, A3_WIDTH_PX } from "../a3Canvas";

export const SCHIZOPHRENIA_FIXTURE_TOPIC_KEY =
  "schizophrenia_pathophysiology_dev_fixture" as const;
export const SCHIZOPHRENIA_FIXTURE_VERSION = "dev.fixture.2026.1" as const;

const TS = "2026-09-07T00:00:00.000Z";

/** Knowledge card layout (Slice 1 compact). Demo cards do not use these. */
export const KNOWLEDGE_CARD_WIDTH = 146;
export const KNOWLEDGE_CARD_HEIGHT_SHORT = 62;
export const KNOWLEDGE_CARD_HEIGHT_LONG = 72;
/** Vertical padding 5 / horizontal 7. Demo cards keep 6 / 8. */
export const KNOWLEDGE_CARD_PADDING_Y = 5;
export const KNOWLEDGE_CARD_PADDING_X = 7;

function kCard(
  id: string,
  text: string,
  x: number,
  y: number,
  height = KNOWLEDGE_CARD_HEIGHT_SHORT,
  zIndex = 0,
): RelatedDiagramCard {
  return {
    id,
    cardType: "knowledge",
    text,
    state: null,
    origin: "knowledge_library",
    layout: { x, y, width: KNOWLEDGE_CARD_WIDTH, height, zIndex },
    isLocked: true,
    createdAt: TS,
    updatedAt: TS,
  };
}

function kConn(
  id: string,
  source: string,
  target: string,
  relationType: "current" | "potential" = "current",
): RelatedDiagramConnection {
  return {
    id,
    sourceCardId: source,
    targetCardId: target,
    relationType,
    origin: "knowledge_library",
    createdAt: TS,
    updatedAt: TS,
  };
}

/** Pathology foundation cards (hand-authored A3 layout; not auto-layout). */
export const SCHIZOPHRENIA_KNOWLEDGE_CARDS: RelatedDiagramCard[] = [
  kCard("sk_disease", "統合失調症", 96, 40, KNOWLEDGE_CARD_HEIGHT_LONG),
  kCard("sk_patho_core", "基本病態：情報処理の障害", 304, 40, KNOWLEDGE_CARD_HEIGHT_LONG),
  kCard("sk_da", "ドパミン神経系の関与", 64, 172, KNOWLEDGE_CARD_HEIGHT_LONG),
  kCard("sk_glu", "グルタミン酸神経系の関与", 242, 172, KNOWLEDGE_CARD_HEIGHT_LONG),
  kCard("sk_nt_imbalance", "神経伝達の不均衡", 420, 172, KNOWLEDGE_CARD_HEIGHT_LONG),
  kCard("sk_positive", "陽性症状", 64, 320),
  kCard("sk_negative", "陰性症状", 248, 320),
  kCard("sk_cognitive", "認知機能への影響", 432, 320),
  kCard("sk_hallucination", "幻覚", 40, 460),
  kCard("sk_delusion", "妄想", 202, 460),
  kCard("sk_thought", "思考の障害", 364, 460),
  kCard("sk_avolition", "意欲の低下", 200, 584),
  kCard("sk_affect", "感情表出の低下", 374, 584),
  kCard("sk_attention", "注意・集中の困難", 526, 460),
  kCard("sk_working_memory", "作業記憶の低下", 688, 460),
];

export const SCHIZOPHRENIA_KNOWLEDGE_CONNECTIONS: RelatedDiagramConnection[] = [
  kConn("skc1", "sk_disease", "sk_patho_core"),
  kConn("skc2", "sk_patho_core", "sk_da"),
  kConn("skc3", "sk_patho_core", "sk_glu"),
  kConn("skc4", "sk_da", "sk_nt_imbalance"),
  kConn("skc5", "sk_glu", "sk_nt_imbalance"),
  kConn("skc6", "sk_nt_imbalance", "sk_positive"),
  kConn("skc7", "sk_nt_imbalance", "sk_negative"),
  kConn("skc8", "sk_nt_imbalance", "sk_cognitive"),
  kConn("skc9", "sk_positive", "sk_hallucination"),
  kConn("skc10", "sk_positive", "sk_delusion"),
  kConn("skc11", "sk_positive", "sk_thought"),
  kConn("skc12", "sk_negative", "sk_avolition"),
  kConn("skc13", "sk_negative", "sk_affect"),
  kConn("skc14", "sk_cognitive", "sk_attention"),
  kConn("skc15", "sk_cognitive", "sk_working_memory"),
  kConn("skc16", "sk_da", "sk_positive", "potential"),
];

/**
 * Style demo only — not Knowledge Library content.
 * One of each card/connection visual for Slice 1 QA (right side of A3).
 */
export function buildSlice1StyleDemoGraph(): RelatedDiagramSemanticGraph {
  const cards: RelatedDiagramCard[] = [
    {
      id: "demo_info",
      cardType: "information",
      text: "（デモ）S「声が聞こえる」",
      state: null,
      origin: "patient_information",
      layout: { x: A3_WIDTH_PX - 360, y: 80, width: 180, height: 72, zIndex: 1 },
      isLocked: true,
      createdAt: TS,
      updatedAt: TS,
    },
    {
      id: "demo_u_cur",
      cardType: "understanding",
      text: "（デモ）幻聴の影響",
      state: "current",
      origin: "form3_assessment",
      layout: {
        x: A3_WIDTH_PX - 360,
        y: 200,
        width: 180,
        height: 72,
        zIndex: 1,
      },
      isLocked: true,
      createdAt: TS,
      updatedAt: TS,
    },
    {
      id: "demo_u_pot",
      cardType: "understanding",
      text: "（デモ）孤立の可能性",
      state: "potential",
      origin: "diagram_integration",
      layout: {
        x: A3_WIDTH_PX - 360,
        y: 320,
        width: 180,
        height: 72,
        zIndex: 1,
      },
      isLocked: true,
      createdAt: TS,
      updatedAt: TS,
    },
    {
      id: "demo_np",
      cardType: "nursing_problem",
      text: "（デモ）コミュニケーションの障害",
      state: "current",
      origin: "diagram_integration",
      layout: {
        x: A3_WIDTH_PX - 360,
        y: 460,
        width: 200,
        height: 78,
        zIndex: 1,
      },
      isLocked: true,
      createdAt: TS,
      updatedAt: TS,
    },
    {
      id: "demo_np2",
      cardType: "nursing_problem",
      text: "（デモ）セルフケア不足（潜在）",
      state: "potential",
      origin: "diagram_integration",
      layout: {
        x: A3_WIDTH_PX - 360,
        y: 580,
        width: 200,
        height: 78,
        zIndex: 1,
      },
      isLocked: true,
      createdAt: TS,
      updatedAt: TS,
    },
    {
      id: "demo_treat_src",
      cardType: "understanding",
      text: "（デモ）薬物療法",
      state: "current",
      origin: "form3_assessment",
      layout: {
        x: A3_WIDTH_PX - 620,
        y: 200,
        width: 160,
        height: 64,
        zIndex: 1,
      },
      isLocked: true,
      createdAt: TS,
      updatedAt: TS,
    },
    {
      id: "demo_junc_a",
      cardType: "information",
      text: "（デモ）分岐A",
      state: null,
      origin: "patient_information",
      layout: { x: 60, y: 820, width: 88, height: 44, zIndex: 1 },
      isLocked: true,
      createdAt: TS,
      updatedAt: TS,
    },
    {
      id: "demo_junc_b",
      cardType: "information",
      text: "（デモ）分岐B",
      state: null,
      origin: "patient_information",
      layout: { x: 280, y: 720, width: 88, height: 44, zIndex: 1 },
      isLocked: true,
      createdAt: TS,
      updatedAt: TS,
    },
    {
      id: "demo_junc_c",
      cardType: "information",
      text: "（デモ）分岐C",
      state: null,
      origin: "patient_information",
      layout: { x: 280, y: 820, width: 88, height: 44, zIndex: 1 },
      isLocked: true,
      createdAt: TS,
      updatedAt: TS,
    },
    {
      id: "demo_junc_d",
      cardType: "information",
      text: "（デモ）分岐D",
      state: null,
      origin: "patient_information",
      layout: { x: 280, y: 920, width: 88, height: 44, zIndex: 1 },
      isLocked: true,
      createdAt: TS,
      updatedAt: TS,
    },
    {
      id: "demo_cross_h1",
      cardType: "information",
      text: "（デモ）交差A",
      state: null,
      origin: "patient_information",
      layout: { x: 860, y: 740, width: 88, height: 44, zIndex: 1 },
      isLocked: true,
      createdAt: TS,
      updatedAt: TS,
    },
    {
      id: "demo_cross_h2",
      cardType: "information",
      text: "（デモ）交差B",
      state: null,
      origin: "patient_information",
      layout: { x: 1180, y: 740, width: 88, height: 44, zIndex: 1 },
      isLocked: true,
      createdAt: TS,
      updatedAt: TS,
    },
    {
      id: "demo_cross_v1",
      cardType: "understanding",
      text: "（デモ）交差C",
      state: "current",
      origin: "form3_assessment",
      layout: { x: 1020, y: 620, width: 88, height: 44, zIndex: 1 },
      isLocked: true,
      createdAt: TS,
      updatedAt: TS,
    },
    {
      id: "demo_cross_v2",
      cardType: "understanding",
      text: "（デモ）交差D",
      state: "current",
      origin: "form3_assessment",
      layout: { x: 1020, y: 840, width: 88, height: 44, zIndex: 1 },
      isLocked: true,
      createdAt: TS,
      updatedAt: TS,
    },
  ];

  const connections: RelatedDiagramConnection[] = [
    {
      id: "demo_c_cur",
      sourceCardId: "demo_info",
      targetCardId: "demo_u_cur",
      relationType: "current",
      origin: "student_diagram",
      createdAt: TS,
      updatedAt: TS,
    },
    {
      id: "demo_c_pot",
      sourceCardId: "demo_u_cur",
      targetCardId: "demo_u_pot",
      relationType: "potential",
      origin: "student_diagram",
      createdAt: TS,
      updatedAt: TS,
    },
    {
      id: "demo_c_treat",
      sourceCardId: "demo_treat_src",
      targetCardId: "demo_u_cur",
      relationType: "treatment",
      origin: "student_diagram",
      createdAt: TS,
      updatedAt: TS,
    },
    {
      id: "demo_c_basis",
      sourceCardId: "demo_u_cur",
      targetCardId: "demo_np",
      relationType: "nursing_problem_basis",
      origin: "student_diagram",
      createdAt: TS,
      updatedAt: TS,
    },
    {
      id: "demo_c_integ",
      sourceCardId: "demo_np",
      targetCardId: "demo_np2",
      relationType: "nursing_problem_integration",
      origin: "system_integration",
      createdAt: TS,
      updatedAt: TS,
    },
    {
      id: "demo_c_junc_b",
      sourceCardId: "demo_junc_a",
      targetCardId: "demo_junc_b",
      relationType: "current",
      origin: "student_diagram",
      createdAt: TS,
      updatedAt: TS,
    },
    {
      id: "demo_c_junc_c",
      sourceCardId: "demo_junc_a",
      targetCardId: "demo_junc_c",
      relationType: "current",
      origin: "student_diagram",
      createdAt: TS,
      updatedAt: TS,
    },
    {
      id: "demo_c_junc_d",
      sourceCardId: "demo_junc_a",
      targetCardId: "demo_junc_d",
      relationType: "current",
      origin: "student_diagram",
      createdAt: TS,
      updatedAt: TS,
    },
    {
      id: "demo_c_cross_h",
      sourceCardId: "demo_cross_h1",
      targetCardId: "demo_cross_h2",
      relationType: "current",
      origin: "student_diagram",
      createdAt: TS,
      updatedAt: TS,
    },
    {
      id: "demo_c_cross_v",
      sourceCardId: "demo_cross_v1",
      targetCardId: "demo_cross_v2",
      relationType: "potential",
      origin: "student_diagram",
      createdAt: TS,
      updatedAt: TS,
    },
  ];

  return {
    semanticSchemaVersion: RELATED_DIAGRAM_SEMANTIC_SCHEMA_VERSION,
    cards,
    cardSources: [],
    connections,
    nursingProblems: [
      {
        cardId: "demo_np",
        status: "active",
        priority: 1,
        createdAt: TS,
        updatedAt: TS,
      },
      {
        cardId: "demo_np2",
        status: "active",
        priority: 2,
        createdAt: TS,
        updatedAt: TS,
      },
    ],
    nursingProblemSupports: [],
    integrations: [],
    integrationMembers: [],
  };
}

export function buildSchizophreniaKnowledgeSnapshot(): RelatedDiagramKnowledgeSnapshot {
  return {
    knowledgeGroupId: "fixture-schizophrenia-dev",
    knowledgeVersion: SCHIZOPHRENIA_FIXTURE_VERSION,
    topicKey: SCHIZOPHRENIA_FIXTURE_TOPIC_KEY,
    title: "統合失調症の病態（開発用fixture）",
    cards: SCHIZOPHRENIA_KNOWLEDGE_CARDS.map((c) => ({
      id: c.id,
      text: c.text,
      x: c.layout.x,
      y: c.layout.y,
      width: c.layout.width,
      height: c.layout.height,
      zIndex: c.layout.zIndex,
    })),
    connections: SCHIZOPHRENIA_KNOWLEDGE_CONNECTIONS.map((c) => ({
      id: c.id,
      sourceKnowledgeCardId: c.sourceCardId,
      targetKnowledgeCardId: c.targetCardId,
      relationType: c.relationType,
    })),
  };
}

export function buildSchizophreniaKnowledgeGraph(): RelatedDiagramSemanticGraph {
  return {
    semanticSchemaVersion: RELATED_DIAGRAM_SEMANTIC_SCHEMA_VERSION,
    cards: SCHIZOPHRENIA_KNOWLEDGE_CARDS,
    cardSources: SCHIZOPHRENIA_KNOWLEDGE_CARDS.map((c) => ({
      id: `src_${c.id}`,
      cardId: c.id,
      sourceType: "knowledge_library" as const,
      sourceId: c.id,
      sourceVersion: SCHIZOPHRENIA_FIXTURE_VERSION,
      sourcePattern: null,
      relation: "pathology_foundation",
      createdAt: TS,
    })),
    connections: SCHIZOPHRENIA_KNOWLEDGE_CONNECTIONS,
    nursingProblems: [],
    nursingProblemSupports: [],
    integrations: [],
    integrationMembers: [],
  };
}

/** DEV/preview only: pathology + style demo. Never use as student runtime fallback. */
export function buildSlice1ReadonlySceneGraph(): RelatedDiagramSemanticGraph {
  const knowledge = buildSchizophreniaKnowledgeGraph();
  const demo = buildSlice1StyleDemoGraph();
  return {
    semanticSchemaVersion: RELATED_DIAGRAM_SEMANTIC_SCHEMA_VERSION,
    cards: [...knowledge.cards, ...demo.cards],
    cardSources: [...knowledge.cardSources, ...demo.cardSources],
    connections: [...knowledge.connections, ...demo.connections],
    nursingProblems: demo.nursingProblems,
    nursingProblemSupports: demo.nursingProblemSupports,
    integrations: demo.integrations,
    integrationMembers: demo.integrationMembers,
  };
}

export const SLICE1_CANVAS_META = {
  logicalWidthPx: A3_WIDTH_PX,
  logicalHeightPx: A3_HEIGHT_PX,
  source: "dev_fixture" as const,
  knowledgeTitle: "統合失調症の病態（開発用fixture）",
  knowledgeVersion: SCHIZOPHRENIA_FIXTURE_VERSION,
};
