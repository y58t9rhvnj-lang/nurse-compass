/**
 * DEV ONLY — Patient A Form3 → Related Diagram skeleton.
 * READ ONLY SNAPSHOT. DO NOT WRITE BACK.
 *
 * Visualizes Form3 evidence already stored by the student.
 * This is NOT production Understanding compose (no substring selection,
 * no student-confirmed 顕在/潜在). AI / Knowledge / Nursing Problem
 * are not generated.
 */

import { A3_HEIGHT_PX, A3_WIDTH_PX } from "./a3Canvas";
import { getA3LegendBounds } from "./a3Legend";
import type {
  PatientAForm3SkeletonAssessment,
  PatientAForm3SkeletonInformation,
  PatientAForm3SkeletonSnapshot,
} from "./fixtures/patientAForm3SkeletonSnapshot";
import {
  PATIENT_A_FORM3_SKELETON_DEV_SNAPSHOT,
  clonePatientAForm3SkeletonSnapshot,
} from "./fixtures/patientAForm3SkeletonSnapshot";
import {
  INFORMATION_CARD_HEIGHT,
  INFORMATION_CARD_WIDTH,
  UNDERSTANDING_CARD_HEIGHT,
  UNDERSTANDING_CARD_WIDTH,
} from "./form3ToUnderstandingCard";
import { emptyRelatedDiagramGraph } from "./resolveReadonlyScene";
import { RELATED_DIAGRAM_SEMANTIC_SCHEMA_VERSION } from "./types";
import type {
  RelatedDiagramCard,
  RelatedDiagramCardSource,
  RelatedDiagramCardState,
  RelatedDiagramConnection,
  RelatedDiagramSemanticGraph,
} from "./types";
import type { Form3Judgment } from "@/lib/form3/form3Types";

export const PATIENT_A_DEV_SKELETON_KIND =
  "patient_a_form3_skeleton_dev_only" as const;

/** Provenance marker: Form3 evidence visualization, not a Frozen RD relation. */
export const PATIENT_A_DEV_EVIDENCE_RELATION = "dev_form3_evidence_visualization";

/**
 * Frozen connection types have no "evidence" value.
 * `current` is used only as a visual/routing carrier so Arrange can draw
 * the line. It is NOT a student-confirmed Related Diagram current-relation.
 */
export const PATIENT_A_DEV_EVIDENCE_VISUAL_RELATION_TYPE = "current" as const;

/**
 * Frozen origins have no "form3_evidence" value.
 * `student_diagram` is the least-wrong carrier (not knowledge, not NP
 * integration). It does not mean the student drew this on the A3.
 */
export const PATIENT_A_DEV_EVIDENCE_VISUAL_ORIGIN = "student_diagram" as const;

const DEV_TS = "2026-09-20T12:25:56.369Z";

export function patientADevInformationCardId(informationId: string): string {
  return `f3i_${informationId}`;
}

/**
 * DEV-only Understanding id. Distinct from production
 * form3AssessmentSelectionCardId (substring compose).
 */
export function patientADevUnderstandingCardId(assessmentId: string): string {
  return `f3u_dev_${assessmentId}`;
}

export function patientADevEvidenceRelationId(
  assessmentId: string,
  informationId: string,
): string {
  return `f3e_dev_${assessmentId}_${informationId}`;
}

export type PatientADevUnderstandingStateKind =
  | "classification_hint"
  | "type_contract_placeholder";

export type PatientADevEvidenceRelation = {
  id: string;
  informationId: string;
  assessmentId: string;
  sourceCardId: string;
  targetCardId: string;
};

export type PatientADevSkeletonStats = {
  information: number;
  understanding: number;
  cards: number;
  evidence: number;
  isolatedInformation: number;
  knowledge: number;
  nursingProblem: number;
};

export type PatientADevSkeletonScene = {
  kind: typeof PATIENT_A_DEV_SKELETON_KIND;
  graph: RelatedDiagramSemanticGraph;
  evidenceRelations: PatientADevEvidenceRelation[];
  stats: PatientADevSkeletonStats;
};

function compareId(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function hash32(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Neutral seed scatter. Not a finished layout, not a single pile.
 * Does not use patternKey as a lane.
 */
export function patientADevSeedLayout(
  cardId: string,
  index: number,
  width: number,
  height: number,
): { x: number; y: number } {
  const legend = getA3LegendBounds();
  const margin = 36;
  const colGap = 36;
  const rowGap = 28;
  const cols = 6;
  const col = index % cols;
  const row = Math.floor(index / cols);
  const jitter = hash32(cardId);
  const jx = (jitter % 37) - 18;
  const jy = ((jitter >>> 8) % 29) - 14;
  let x = margin + col * (width + colGap) + jx;
  let y = margin + row * (height + rowGap) + jy;
  const maxX = A3_WIDTH_PX - width - margin;
  const maxY = A3_HEIGHT_PX - height - margin;
  x = Math.max(margin, Math.min(maxX, x));
  y = Math.max(margin, Math.min(maxY, y));
  if (
    x + width > legend.x - 8 &&
    y + height > legend.y - 8
  ) {
    x = Math.max(margin, legend.x - width - 16);
  }
  return { x, y };
}

/**
 * Frozen Understanding state is current|potential only.
 * problem/risk become compose hints. Other classifications keep a
 * type-contract placeholder — not a student-confirmed state.
 */
export function patientADevUnderstandingState(judgment: Form3Judgment | null): {
  state: RelatedDiagramCardState;
  stateKind: PatientADevUnderstandingStateKind;
} {
  if (judgment === "problem") {
    return { state: "current", stateKind: "classification_hint" };
  }
  if (judgment === "risk") {
    return { state: "potential", stateKind: "classification_hint" };
  }
  return { state: "current", stateKind: "type_contract_placeholder" };
}

function buildInformationCard(
  card: PatientAForm3SkeletonInformation,
  index: number,
): { card: RelatedDiagramCard; source: RelatedDiagramCardSource } {
  const id = patientADevInformationCardId(card.id);
  const pos = patientADevSeedLayout(
    id,
    index,
    INFORMATION_CARD_WIDTH,
    INFORMATION_CARD_HEIGHT,
  );
  return {
    card: {
      id,
      cardType: "information",
      text: card.content,
      state: null,
      origin: "form3_information",
      layout: {
        x: pos.x,
        y: pos.y,
        width: INFORMATION_CARD_WIDTH,
        height: INFORMATION_CARD_HEIGHT,
        zIndex: 1,
      },
      isLocked: false,
      createdAt: DEV_TS,
      updatedAt: DEV_TS,
    },
    source: {
      id: `f3is_${card.id}`,
      cardId: id,
      sourceType: "form3_information_card",
      sourceId: card.id,
      sourceVersion: "34",
      sourcePattern: card.patternKeys[0] ?? null,
      relation: PATIENT_A_DEV_EVIDENCE_RELATION,
      sourceExcerpt: card.content,
      sourcePatterns: [...card.patternKeys],
      sourceSoType: card.soType,
      createdAt: DEV_TS,
    },
  };
}

function buildUnderstandingCard(
  card: PatientAForm3SkeletonAssessment,
  index: number,
): { card: RelatedDiagramCard; source: RelatedDiagramCardSource } {
  const id = patientADevUnderstandingCardId(card.id);
  const pos = patientADevSeedLayout(
    id,
    index,
    UNDERSTANDING_CARD_WIDTH,
    UNDERSTANDING_CARD_HEIGHT,
  );
  const hint = patientADevUnderstandingState(card.classification);
  return {
    card: {
      id,
      cardType: "understanding",
      // DEV visualization uses the full interpretation. Production Frozen
      // Understanding compose is a student-selected substring + explicit state.
      text: card.interpretation,
      state: hint.state,
      origin: "form3_assessment",
      layout: {
        x: pos.x,
        y: pos.y,
        width: UNDERSTANDING_CARD_WIDTH,
        height: UNDERSTANDING_CARD_HEIGHT,
        zIndex: 2,
      },
      isLocked: false,
      createdAt: DEV_TS,
      updatedAt: DEV_TS,
    },
    source: {
      id: `f3as_dev_${card.id}`,
      cardId: id,
      sourceType: "form3_assessment",
      sourceId: card.id,
      sourceVersion: "34",
      sourcePattern: card.patternKey,
      relation: `${PATIENT_A_DEV_EVIDENCE_RELATION}:${hint.stateKind}`,
      sourceExcerpt: card.interpretation,
      selectedText: card.interpretation,
      selectionStart: 0,
      selectionEnd: card.interpretation.length,
      editedText: card.interpretation,
      sourceClassification: card.classification,
      createdAt: DEV_TS,
    },
  };
}

function adaptEvidenceToVisualConnection(
  relation: PatientADevEvidenceRelation,
): RelatedDiagramConnection {
  return {
    id: relation.id,
    sourceCardId: relation.sourceCardId,
    targetCardId: relation.targetCardId,
    relationType: PATIENT_A_DEV_EVIDENCE_VISUAL_RELATION_TYPE,
    origin: PATIENT_A_DEV_EVIDENCE_VISUAL_ORIGIN,
    createdAt: DEV_TS,
    updatedAt: DEV_TS,
  };
}

export function buildPatientAForm3Skeleton(
  snapshot: PatientAForm3SkeletonSnapshot = PATIENT_A_FORM3_SKELETON_DEV_SNAPSHOT,
): PatientADevSkeletonScene {
  const frozen = clonePatientAForm3SkeletonSnapshot(snapshot);
  const infos = frozen.informationCards
    .filter((card) => card.status === "active")
    .slice()
    .sort((a, b) => compareId(a.id, b.id));
  const assessments = frozen.assessmentCards
    .filter((card) => card.status === "reviewed")
    .slice()
    .sort((a, b) => compareId(a.id, b.id));

  const infoByForm3Id = new Map(infos.map((card) => [card.id, card]));
  const informationBuilt = infos.map((card, index) =>
    buildInformationCard(card, index),
  );
  const understandingBuilt = assessments.map((card, index) =>
    buildUnderstandingCard(card, index + infos.length),
  );

  const evidenceRelations: PatientADevEvidenceRelation[] = [];
  for (const assessment of assessments) {
    const uniqueEvidence = [...new Set(assessment.evidenceInformationIds)].sort(
      compareId,
    );
    for (const informationId of uniqueEvidence) {
      if (!infoByForm3Id.has(informationId)) continue;
      evidenceRelations.push({
        id: patientADevEvidenceRelationId(assessment.id, informationId),
        informationId,
        assessmentId: assessment.id,
        sourceCardId: patientADevInformationCardId(informationId),
        targetCardId: patientADevUnderstandingCardId(assessment.id),
      });
    }
  }
  evidenceRelations.sort((a, b) => compareId(a.id, b.id));

  const usedInfo = new Set(evidenceRelations.map((row) => row.informationId));
  const isolatedInformation = infos.filter((card) => !usedInfo.has(card.id)).length;

  const cards = [
    ...informationBuilt.map((row) => row.card),
    ...understandingBuilt.map((row) => row.card),
  ].sort((a, b) => compareId(a.id, b.id));
  const cardSources = [
    ...informationBuilt.map((row) => row.source),
    ...understandingBuilt.map((row) => row.source),
  ].sort((a, b) => compareId(a.id, b.id));
  const connections = evidenceRelations
    .map(adaptEvidenceToVisualConnection)
    .sort((a, b) => compareId(a.id, b.id));

  const graph: RelatedDiagramSemanticGraph = {
    ...emptyRelatedDiagramGraph(),
    semanticSchemaVersion: RELATED_DIAGRAM_SEMANTIC_SCHEMA_VERSION,
    cards,
    cardSources,
    connections,
  };

  return {
    kind: PATIENT_A_DEV_SKELETON_KIND,
    graph,
    evidenceRelations,
    stats: {
      information: informationBuilt.length,
      understanding: understandingBuilt.length,
      cards: cards.length,
      evidence: evidenceRelations.length,
      isolatedInformation,
      knowledge: 0,
      nursingProblem: 0,
    },
  };
}
