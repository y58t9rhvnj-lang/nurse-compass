/**
 * Slice 2B-1 — Form3 → Related Diagram cards.
 * Information: 1 source fact = 1 Information Card (原文そのまま).
 * Assessment: student-selected substring = Understanding Card text.
 * No AI summarization or auto-split.
 */

import {
  form3AssessmentSelectionOriginKey,
  form3InformationOriginKey,
  form3RecordRelation,
  initialUnderstandingStateFromForm3Classification,
  parseForm3RecordRelation,
  type RelatedDiagramForm3AssessmentSource,
  type RelatedDiagramForm3InformationSource,
} from "./form3AssessmentReadModel";
import type { NormalizedAssessmentSelection } from "./form3AssessmentSelection";
import { deleteCard, upsertCard, addCardSource } from "./semanticGraph";
import type {
  RelatedDiagramCard,
  RelatedDiagramCardSource,
  RelatedDiagramCardState,
  RelatedDiagramNursingProblem,
  RelatedDiagramSemanticGraph,
} from "./types";

export const UNDERSTANDING_CARD_WIDTH = 180;
export const UNDERSTANDING_CARD_HEIGHT = 72;
export const INFORMATION_CARD_WIDTH = 180;
export const INFORMATION_CARD_HEIGHT = 72;

export type CardEntitySnapshot = {
  card: RelatedDiagramCard;
  sources: RelatedDiagramCardSource[];
  nursingProblem?: RelatedDiagramNursingProblem;
};

export function form3InformationCardId(informationId: string): string {
  return `f3i_${informationId}`;
}

export function form3InformationSourceRowId(informationId: string): string {
  return `f3is_${informationId}`;
}

export function form3AssessmentSelectionCardId(
  assessmentId: string,
  selectionStart: number,
  selectionEnd: number,
): string {
  return `f3a_${assessmentId}_${selectionStart}_${selectionEnd}`;
}

export function form3AssessmentSelectionSourceRowId(
  assessmentId: string,
  selectionStart: number,
  selectionEnd: number,
): string {
  return `f3s_${assessmentId}_${selectionStart}_${selectionEnd}`;
}

export function buildInformationCardFromForm3(input: {
  source: RelatedDiagramForm3InformationSource;
  viewedPatternId?: string;
  layout: { x: number; y: number; zIndex: number };
  now?: string;
  cardId?: string;
}): CardEntitySnapshot {
  const ts = input.now ?? "2026-09-16T00:00:00.000Z";
  const cardId = input.cardId ?? form3InformationCardId(input.source.informationId);
  const card: RelatedDiagramCard = {
    id: cardId,
    cardType: "information",
    text: input.source.content,
    state: null,
    origin: "form3_information",
    layout: {
      x: input.layout.x,
      y: input.layout.y,
      width: INFORMATION_CARD_WIDTH,
      height: INFORMATION_CARD_HEIGHT,
      zIndex: input.layout.zIndex,
    },
    isLocked: false,
    createdAt: ts,
    updatedAt: ts,
  };
  const source: RelatedDiagramCardSource = {
    id: form3InformationSourceRowId(input.source.informationId),
    cardId,
    sourceType: "form3_information_card",
    sourceId: input.source.informationId,
    sourceVersion: String(input.source.sourceVersion),
    sourcePattern:
      input.viewedPatternId ?? input.source.patternKeys[0] ?? null,
    relation: form3RecordRelation(input.source.form3RecordId),
    sourceExcerpt: input.source.content,
    sourcePatterns: [...input.source.patternKeys],
    sourceSoType: input.source.soType,
    createdAt: ts,
  };
  return { card, sources: [source] };
}

export type AssessmentComposeDraft = {
  source: RelatedDiagramForm3AssessmentSource;
  selection: NormalizedAssessmentSelection;
  editedText: string;
  state: RelatedDiagramCardState | null;
};

export function createAssessmentComposeDraft(
  source: RelatedDiagramForm3AssessmentSource,
  selection: NormalizedAssessmentSelection,
): AssessmentComposeDraft {
  return {
    source,
    selection,
    editedText: selection.selectedText,
    state: initialUnderstandingStateFromForm3Classification(source.judgment),
  };
}

export function canCommitAssessmentCompose(
  draft: Pick<AssessmentComposeDraft, "state">,
): boolean {
  return draft.state === "current" || draft.state === "potential";
}

export function commitAssessmentCompose(
  draft: AssessmentComposeDraft,
  layout: { x: number; y: number; zIndex: number },
  now?: string,
): CardEntitySnapshot | null {
  if (!canCommitAssessmentCompose(draft) || draft.state == null) {
    return null;
  }
  return buildUnderstandingCardFromAssessmentSelection({
    source: draft.source,
    selection: draft.selection,
    editedText: draft.editedText,
    state: draft.state,
    layout,
    now,
  });
}

export function buildUnderstandingCardFromAssessmentSelection(input: {
  source: RelatedDiagramForm3AssessmentSource;
  selection: NormalizedAssessmentSelection;
  editedText: string;
  state: RelatedDiagramCardState;
  layout: { x: number; y: number; zIndex: number };
  now?: string;
  cardId?: string;
}): CardEntitySnapshot {
  const { selection } = input;
  const sliced = input.source.assessmentText.slice(
    selection.selectionStart,
    selection.selectionEnd,
  );
  if (sliced !== selection.selectedText) {
    throw new Error("selectedText must equal assessmentText.slice(start, end)");
  }
  const ts = input.now ?? "2026-09-16T00:00:00.000Z";
  const cardId =
    input.cardId ??
    form3AssessmentSelectionCardId(
      input.source.assessmentId,
      selection.selectionStart,
      selection.selectionEnd,
    );
  const card: RelatedDiagramCard = {
    id: cardId,
    cardType: "understanding",
    text: input.editedText,
    state: input.state,
    origin: "form3_assessment",
    layout: {
      x: input.layout.x,
      y: input.layout.y,
      width: UNDERSTANDING_CARD_WIDTH,
      height: UNDERSTANDING_CARD_HEIGHT,
      zIndex: input.layout.zIndex,
    },
    isLocked: false,
    createdAt: ts,
    updatedAt: ts,
  };
  const source: RelatedDiagramCardSource = {
    id: form3AssessmentSelectionSourceRowId(
      input.source.assessmentId,
      selection.selectionStart,
      selection.selectionEnd,
    ),
    cardId,
    sourceType: "form3_assessment",
    sourceId: input.source.assessmentId,
    sourceVersion: String(input.source.sourceVersion),
    sourcePattern: input.source.patternId,
    relation: form3RecordRelation(input.source.form3RecordId),
    sourceExcerpt: input.source.assessmentText,
    selectedText: selection.selectedText,
    selectionStart: selection.selectionStart,
    selectionEnd: selection.selectionEnd,
    editedText: input.editedText,
    sourceClassification: input.source.judgment,
    candidateEvidenceInformationIds: [
      ...input.source.evidenceInformationIds,
    ],
    createdAt: ts,
  };
  return { card, sources: [source] };
}

export function originKeyFromCardSource(
  source: RelatedDiagramCardSource,
): string | null {
  const form3RecordId = parseForm3RecordRelation(source.relation);
  if (!form3RecordId) return null;
  if (source.sourceType === "form3_information_card") {
    return form3InformationOriginKey({
      form3RecordId,
      informationId: source.sourceId,
    });
  }
  if (source.sourceType === "form3_assessment") {
    if (source.selectionStart == null || source.selectionEnd == null) {
      return null;
    }
    return form3AssessmentSelectionOriginKey({
      form3RecordId,
      assessmentId: source.sourceId,
      selectionStart: source.selectionStart,
      selectionEnd: source.selectionEnd,
    });
  }
  return null;
}

export function isForm3InformationAlreadyOnCanvas(
  graph: RelatedDiagramSemanticGraph,
  identity: { form3RecordId: string; informationId: string },
): boolean {
  const want = form3InformationOriginKey(identity);
  return graph.cardSources.some(
    (source) => originKeyFromCardSource(source) === want,
  );
}

export function isForm3AssessmentSelectionAlreadyOnCanvas(
  graph: RelatedDiagramSemanticGraph,
  identity: {
    form3RecordId: string;
    assessmentId: string;
    selectionStart: number;
    selectionEnd: number;
  },
): boolean {
  const want = form3AssessmentSelectionOriginKey(identity);
  return graph.cardSources.some(
    (source) => originKeyFromCardSource(source) === want,
  );
}

export function cardHasConnections(
  graph: RelatedDiagramSemanticGraph,
  cardId: string,
): boolean {
  return graph.connections.some(
    (connection) =>
      connection.sourceCardId === cardId || connection.targetCardId === cardId,
  );
}

export function nextCardZIndex(graph: RelatedDiagramSemanticGraph): number {
  let max = 0;
  for (const card of graph.cards) {
    if (card.layout.zIndex > max) max = card.layout.zIndex;
  }
  return max + 1;
}

export function insertCardEntity(
  graph: RelatedDiagramSemanticGraph,
  entity: CardEntitySnapshot,
): RelatedDiagramSemanticGraph {
  if (graph.cards.some((card) => card.id === entity.card.id)) {
    return graph;
  }
  const upserted = upsertCard(graph, {
    id: entity.card.id,
    cardType: entity.card.cardType,
    text: entity.card.text,
    state: entity.card.state,
    origin: entity.card.origin,
    layout: entity.card.layout,
    isLocked: entity.card.isLocked,
    now: entity.card.updatedAt,
  });
  if (!upserted.ok) return graph;
  let next = {
    ...upserted.graph,
    cards: upserted.graph.cards.map((card) =>
      card.id === entity.card.id
        ? {
            ...entity.card,
            createdAt: entity.card.createdAt,
            updatedAt: entity.card.updatedAt,
          }
        : card,
    ),
  };
  for (const source of entity.sources) {
    if (next.cardSources.some((row) => row.id === source.id)) continue;
    const added = addCardSource(next, {
      id: source.id,
      cardId: source.cardId,
      sourceType: source.sourceType,
      sourceId: source.sourceId,
      sourceVersion: source.sourceVersion,
      sourcePattern: source.sourcePattern,
      relation: source.relation,
      sourceExcerpt: source.sourceExcerpt,
      selectedText: source.selectedText,
      selectionStart: source.selectionStart,
      selectionEnd: source.selectionEnd,
      editedText: source.editedText,
      sourceClassification: source.sourceClassification,
      sourcePatterns: source.sourcePatterns,
      sourceSoType: source.sourceSoType,
      candidateEvidenceInformationIds: source.candidateEvidenceInformationIds,
      now: source.createdAt,
    });
    if (!added.ok) return next;
    next = {
      ...added.graph,
      cardSources: added.graph.cardSources.map((row) =>
        row.id === source.id ? { ...source } : row,
      ),
    };
  }
  if (entity.card.cardType === "nursing_problem") {
    const row =
      entity.nursingProblem ??
      next.nursingProblems.find((problem) => problem.cardId === entity.card.id) ??
      {
        cardId: entity.card.id,
        status: "active" as const,
        priority: null,
        createdAt: entity.card.createdAt,
        updatedAt: entity.card.updatedAt,
      };
    next = {
      ...next,
      nursingProblems: [
        ...next.nursingProblems.filter((problem) => problem.cardId !== entity.card.id),
        { ...row },
      ],
    };
  }
  return next;
}

export function removeCardEntity(
  graph: RelatedDiagramSemanticGraph,
  cardId: string,
): RelatedDiagramSemanticGraph {
  const removed = deleteCard(graph, cardId);
  return removed.ok ? removed.graph : graph;
}

export function cloneCardEntity(entity: CardEntitySnapshot): CardEntitySnapshot {
  return {
    card: { ...entity.card, layout: { ...entity.card.layout } },
    sources: entity.sources.map((source) => ({
      ...source,
      sourcePatterns: source.sourcePatterns ? [...source.sourcePatterns] : source.sourcePatterns,
      candidateEvidenceInformationIds: source.candidateEvidenceInformationIds
        ? [...source.candidateEvidenceInformationIds]
        : source.candidateEvidenceInformationIds,
    })),
    nursingProblem: entity.nursingProblem
      ? { ...entity.nursingProblem }
      : entity.nursingProblem,
  };
}

export type Form3SourceTrace = {
  kind: "information" | "assessment";
  originLabel: "様式3の情報から追加" | "様式3のアセスメントから追加";
  soType: "S" | "O" | null;
  patternId: string | null;
  patternName: string | null;
  patternKeys: string[];
  informationId: string | null;
  assessmentId: string | null;
  sourceText: string | null;
  selectedText: string | null;
  selectionStart: number | null;
  selectionEnd: number | null;
  cardText: string;
  editedText: string | null;
  sourceClassification: string | null;
  candidateEvidenceInformationIds: string[];
  cardState: RelatedDiagramCardState | null;
};

export function form3SourceTrace(
  graph: RelatedDiagramSemanticGraph,
  cardId: string,
): Form3SourceTrace | null {
  const card = graph.cards.find((row) => row.id === cardId);
  if (!card) return null;
  const source = graph.cardSources.find((row) => row.cardId === cardId);
  if (!source) return null;
  if (
    card.origin === "form3_information" ||
    source.sourceType === "form3_information_card"
  ) {
    return {
      kind: "information",
      originLabel: "様式3の情報から追加",
      soType: source.sourceSoType ?? null,
      patternId: source.sourcePattern,
      patternName: null,
      patternKeys: source.sourcePatterns ?? [],
      informationId: source.sourceId,
      assessmentId: null,
      sourceText: source.sourceExcerpt ?? card.text,
      selectedText: null,
      selectionStart: null,
      selectionEnd: null,
      cardText: card.text,
      editedText: null,
      sourceClassification: null,
      candidateEvidenceInformationIds: [],
      cardState: card.state,
    };
  }
  if (card.origin !== "form3_assessment") return null;
  return {
    kind: "assessment",
    originLabel: "様式3のアセスメントから追加",
    soType: null,
    patternId: source.sourcePattern,
    patternName: null,
    patternKeys: source.sourcePattern ? [source.sourcePattern] : [],
    informationId: null,
    assessmentId: source.sourceId,
    sourceText: source.sourceExcerpt ?? null,
    selectedText: source.selectedText ?? null,
    selectionStart: source.selectionStart ?? null,
    selectionEnd: source.selectionEnd ?? null,
    cardText: card.text,
    editedText: source.editedText ?? card.text,
    sourceClassification: source.sourceClassification ?? null,
    candidateEvidenceInformationIds: [
      ...(source.candidateEvidenceInformationIds ?? []),
    ],
    cardState: card.state,
  };
}
