/**
 * Related Diagram V1 — draft service (Slice 0).
 * Orchestrates pure semantic graph ops + repository-shaped draft state.
 * No UI / AI / submission RPC.
 */

import {
  addCardSource,
  buildSubmissionSnapshot,
  createEmptySemanticGraph,
  createNursingProblem,
  deleteCard,
  deleteConnection,
  integrateNursingProblems,
  setNursingProblemPriority,
  upsertCard,
  upsertConnection,
  validateSemanticGraph,
  type SemanticGraphResult,
} from "./semanticGraph";
import type {
  RelatedDiagramCard,
  RelatedDiagramCardOrigin,
  RelatedDiagramCardSourceType,
  RelatedDiagramCardState,
  RelatedDiagramCardType,
  RelatedDiagramConnection,
  RelatedDiagramConnectionOrigin,
  RelatedDiagramConnectionRelationType,
  RelatedDiagramDraft,
  RelatedDiagramSemanticGraph,
  RelatedDiagramSubmissionSnapshot,
} from "./types";

export type DraftServiceState = {
  meta: Omit<RelatedDiagramDraft, "semanticGraph">;
  graph: RelatedDiagramSemanticGraph;
};

/**
 * Knowledge binding resolved from Library group row.
 * knowledgeVersion is always taken from group.version (never a divergent client claim).
 */
export type ResolvedKnowledgeBinding = {
  knowledgeGroupId: string;
  knowledgeVersion: string;
};

export type KnowledgeBindingErrorCode =
  | "knowledge_version_mismatch"
  | "knowledge_binding_incomplete"
  | "knowledge_version_blank";

/**
 * Normal path for draft init / binding resolution.
 * Rejects claimedKnowledgeVersion that differs from group.version.
 */
export function resolveKnowledgeBinding(input: {
  knowledgeGroupId: string;
  /** related_diagram_knowledge_groups.version */
  groupVersion: string;
  /** Optional client claim; must equal groupVersion when provided */
  claimedKnowledgeVersion?: string | null;
}):
  | { ok: true; binding: ResolvedKnowledgeBinding }
  | { ok: false; code: KnowledgeBindingErrorCode; message: string } {
  const groupVersion = input.groupVersion.trim();
  if (!groupVersion) {
    return {
      ok: false,
      code: "knowledge_version_blank",
      message: "groupVersion is required",
    };
  }
  if (
    input.claimedKnowledgeVersion != null &&
    input.claimedKnowledgeVersion.trim() !== "" &&
    input.claimedKnowledgeVersion.trim() !== groupVersion
  ) {
    return {
      ok: false,
      code: "knowledge_version_mismatch",
      message: `claimed knowledge_version "${input.claimedKnowledgeVersion}" !== group.version "${groupVersion}"`,
    };
  }
  return {
    ok: true,
    binding: {
      knowledgeGroupId: input.knowledgeGroupId,
      knowledgeVersion: groupVersion,
    },
  };
}

export function createDraftServiceState(input: {
  id: string;
  userId: string;
  organizationId: string;
  academicYear: number;
  caseId: string;
  assessmentCycleId?: string | null;
  /** Prefer resolveKnowledgeBinding() then pass here */
  knowledgeBinding?: ResolvedKnowledgeBinding | null;
  now?: string;
}):
  | { ok: true; state: DraftServiceState }
  | { ok: false; code: KnowledgeBindingErrorCode; message: string } {
  const binding = input.knowledgeBinding ?? null;
  if (binding) {
    if (!binding.knowledgeGroupId || !binding.knowledgeVersion.trim()) {
      return {
        ok: false,
        code: "knowledge_binding_incomplete",
        message: "knowledgeGroupId and knowledgeVersion are both required",
      };
    }
  }

  const ts = input.now ?? new Date().toISOString();
  return {
    ok: true,
    state: {
      meta: {
        id: input.id,
        userId: input.userId,
        organizationId: input.organizationId,
        academicYear: input.academicYear,
        caseId: input.caseId,
        assessmentCycleId: input.assessmentCycleId ?? null,
        status: "draft",
        canvasSchemaVersion: "1",
        knowledgeGroupId: binding?.knowledgeGroupId ?? null,
        knowledgeVersion: binding?.knowledgeVersion ?? null,
        version: 1,
        createdAt: ts,
        updatedAt: ts,
      },
      graph: createEmptySemanticGraph(),
    },
  };
}

/**
 * Apply / replace Knowledge binding on draft using group.version as sole version source.
 */
export function draftBindKnowledge(
  state: DraftServiceState,
  input: {
    knowledgeGroupId: string;
    groupVersion: string;
    claimedKnowledgeVersion?: string | null;
    now?: string;
  },
):
  | { ok: true; state: DraftServiceState }
  | { ok: false; code: KnowledgeBindingErrorCode; message: string } {
  const resolved = resolveKnowledgeBinding(input);
  if (!resolved.ok) return resolved;
  const ts = input.now ?? new Date().toISOString();
  return {
    ok: true,
    state: {
      meta: {
        ...state.meta,
        knowledgeGroupId: resolved.binding.knowledgeGroupId,
        knowledgeVersion: resolved.binding.knowledgeVersion,
        version: state.meta.version + 1,
        updatedAt: ts,
      },
      graph: state.graph,
    },
  };
}

function bumpVersion(
  state: DraftServiceState,
  graph: RelatedDiagramSemanticGraph,
  now?: string,
): DraftServiceState {
  const ts = now ?? new Date().toISOString();
  return {
    meta: {
      ...state.meta,
      version: state.meta.version + 1,
      updatedAt: ts,
    },
    graph,
  };
}

function applyGraphResult<T>(
  state: DraftServiceState,
  result: SemanticGraphResult<T>,
  now?: string,
):
  | { ok: true; state: DraftServiceState; value: T }
  | { ok: false; code: string; message: string } {
  if (!result.ok) {
    return { ok: false, code: result.code, message: result.message };
  }
  return {
    ok: true,
    state: bumpVersion(state, result.graph, now),
    value: result.value,
  };
}

export function draftUpsertCard(
  state: DraftServiceState,
  input: {
    id: string;
    cardType: RelatedDiagramCardType;
    text: string;
    state: RelatedDiagramCardState | null;
    origin: RelatedDiagramCardOrigin;
    now?: string;
  },
) {
  return applyGraphResult(state, upsertCard(state.graph, input), input.now);
}

export function draftDeleteCard(
  state: DraftServiceState,
  cardId: string,
  now?: string,
) {
  return applyGraphResult(state, deleteCard(state.graph, cardId), now);
}

export function draftAddCardSource(
  state: DraftServiceState,
  input: {
    id: string;
    cardId: string;
    sourceType: RelatedDiagramCardSourceType;
    sourceId: string;
    sourceVersion?: string | null;
    sourcePattern?: string | null;
    relation?: string | null;
    now?: string;
  },
) {
  return applyGraphResult(state, addCardSource(state.graph, input), input.now);
}

export function draftUpsertConnection(
  state: DraftServiceState,
  input: {
    id: string;
    sourceCardId: string;
    targetCardId: string;
    relationType: RelatedDiagramConnectionRelationType;
    origin: RelatedDiagramConnectionOrigin;
    now?: string;
  },
) {
  return applyGraphResult(state, upsertConnection(state.graph, input), input.now);
}

export function draftDeleteConnection(
  state: DraftServiceState,
  connectionId: string,
  now?: string,
) {
  return applyGraphResult(state, deleteConnection(state.graph, connectionId), now);
}

export function draftCreateNursingProblem(
  state: DraftServiceState,
  input: {
    cardId: string;
    text: string;
    state: RelatedDiagramCardState;
    supportingCardIds: string[];
    priority?: number | null;
    now?: string;
  },
) {
  return applyGraphResult(
    state,
    createNursingProblem(state.graph, input),
    input.now,
  );
}

export function draftSetPriority(
  state: DraftServiceState,
  cardId: string,
  priority: number | null,
  now?: string,
) {
  return applyGraphResult(
    state,
    setNursingProblemPriority(state.graph, cardId, priority, now),
    now,
  );
}

export function draftIntegrateNursingProblems(
  state: DraftServiceState,
  input: {
    integrationId: string;
    resultCardId: string;
    resultText: string;
    resultState: RelatedDiagramCardState;
    sourceProblemCardIds: string[];
    now?: string;
  },
) {
  return applyGraphResult(
    state,
    integrateNursingProblems(state.graph, input),
    input.now,
  );
}

export function draftValidate(state: DraftServiceState) {
  return validateSemanticGraph(state.graph);
}

export function draftBuildImmutableSnapshot(
  state: DraftServiceState,
  submittedAt: string,
):
  | { ok: true; snapshot: RelatedDiagramSubmissionSnapshot }
  | { ok: false; code: string; message: string } {
  return buildSubmissionSnapshot({
    relatedDiagramId: state.meta.id,
    caseId: state.meta.caseId,
    studentRef: state.meta.userId,
    submittedAt,
    assessmentCycleId: state.meta.assessmentCycleId,
    knowledgeGroupId: state.meta.knowledgeGroupId,
    knowledgeVersion: state.meta.knowledgeVersion,
    statusAtSubmit: state.meta.status,
    graph: state.graph,
  });
}

/** Helpers for tests / callers that need card lists */
export function listCards(state: DraftServiceState): RelatedDiagramCard[] {
  return state.graph.cards;
}

export function listConnections(
  state: DraftServiceState,
): RelatedDiagramConnection[] {
  return state.graph.connections;
}
