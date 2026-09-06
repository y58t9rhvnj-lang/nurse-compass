/**
 * Related Diagram V1 — pure semantic graph operations (Slice 0).
 * No Supabase / UI. Invariants for provenance, origin⊥state, NP history, priority.
 */

import {
  RELATED_DIAGRAM_SEMANTIC_SCHEMA_VERSION,
  type RelatedDiagramCard,
  type RelatedDiagramCardOrigin,
  type RelatedDiagramCardSource,
  type RelatedDiagramCardSourceType,
  type RelatedDiagramCardState,
  type RelatedDiagramCardType,
  type RelatedDiagramConnection,
  type RelatedDiagramConnectionOrigin,
  type RelatedDiagramConnectionRelationType,
  type RelatedDiagramIntegration,
  type RelatedDiagramNursingProblem,
  type RelatedDiagramSemanticGraph,
  type RelatedDiagramSubmissionSnapshot,
} from "./types";

export type SemanticGraphErrorCode =
  | "card_not_found"
  | "connection_not_found"
  | "self_connection"
  | "invalid_state_for_type"
  | "duplicate_card_id"
  | "duplicate_connection_id"
  | "duplicate_priority"
  | "nursing_problem_missing"
  | "nursing_problem_card_type"
  | "support_card_missing"
  | "integration_member_missing"
  | "integration_member_count"
  | "integration_member_not_nursing_problem"
  | "duplicate_integration_id"
  | "integration_result_missing"
  | "integration_result_not_nursing_problem"
  | "orphan_integration_member"
  | "integration_connection_mismatch"
  | "integration_cycle"
  | "endpoint_missing";

export type SemanticGraphResult<T> =
  | { ok: true; graph: RelatedDiagramSemanticGraph; value: T }
  | { ok: false; code: SemanticGraphErrorCode; message: string };

function nowIso(now?: string): string {
  return now ?? new Date().toISOString();
}

function cloneGraph(
  graph: RelatedDiagramSemanticGraph,
): RelatedDiagramSemanticGraph {
  return structuredClone(graph);
}

export function createEmptySemanticGraph(): RelatedDiagramSemanticGraph {
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

function stateAllowedForType(
  cardType: RelatedDiagramCardType,
  state: RelatedDiagramCardState | null,
): boolean {
  if (cardType === "information" || cardType === "knowledge") {
    return state === null;
  }
  // understanding / nursing_problem: current|potential required (null forbidden)
  return state === "current" || state === "potential";
}

export function upsertCard(
  graph: RelatedDiagramSemanticGraph,
  input: {
    id: string;
    cardType: RelatedDiagramCardType;
    text: string;
    state: RelatedDiagramCardState | null;
    origin: RelatedDiagramCardOrigin;
    layout?: RelatedDiagramCard["layout"];
    isLocked?: boolean;
    now?: string;
  },
): SemanticGraphResult<RelatedDiagramCard> {
  if (!stateAllowedForType(input.cardType, input.state)) {
    return {
      ok: false,
      code: "invalid_state_for_type",
      message: `state ${String(input.state)} is invalid for cardType ${input.cardType}`,
    };
  }

  const g = cloneGraph(graph);
  const ts = nowIso(input.now);
  const existing = g.cards.find((c) => c.id === input.id);
  const layout = input.layout ??
    existing?.layout ?? {
      x: 0,
      y: 0,
      width: 160,
      height: 72,
      zIndex: 0,
    };

  const card: RelatedDiagramCard = {
    id: input.id,
    cardType: input.cardType,
    text: input.text,
    state: input.state,
    origin: input.origin,
    layout,
    isLocked: input.isLocked ?? existing?.isLocked ?? false,
    createdAt: existing?.createdAt ?? ts,
    updatedAt: ts,
  };

  if (existing) {
    g.cards = g.cards.map((c) => (c.id === input.id ? card : c));
  } else {
    g.cards.push(card);
  }

  return { ok: true, graph: g, value: card };
}

export function deleteCard(
  graph: RelatedDiagramSemanticGraph,
  cardId: string,
): SemanticGraphResult<{ deletedCardId: string }> {
  if (!graph.cards.some((c) => c.id === cardId)) {
    return { ok: false, code: "card_not_found", message: `card ${cardId} not found` };
  }

  const g = cloneGraph(graph);
  g.cards = g.cards.filter((c) => c.id !== cardId);
  g.cardSources = g.cardSources.filter((s) => s.cardId !== cardId);
  g.connections = g.connections.filter(
    (c) => c.sourceCardId !== cardId && c.targetCardId !== cardId,
  );
  g.nursingProblems = g.nursingProblems.filter((p) => p.cardId !== cardId);
  g.nursingProblemSupports = g.nursingProblemSupports.filter(
    (s) =>
      s.nursingProblemCardId !== cardId && s.supportingCardId !== cardId,
  );
  const removedIntegrationIds = new Set(
    g.integrations
      .filter((i) => i.resultProblemCardId === cardId)
      .map((i) => i.id),
  );
  g.integrations = g.integrations.filter((i) => i.resultProblemCardId !== cardId);
  g.integrationMembers = g.integrationMembers.filter(
    (m) =>
      m.sourceProblemCardId !== cardId &&
      !removedIntegrationIds.has(m.integrationId),
  );

  return { ok: true, graph: g, value: { deletedCardId: cardId } };
}

export function addCardSource(
  graph: RelatedDiagramSemanticGraph,
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
): SemanticGraphResult<RelatedDiagramCardSource> {
  if (!graph.cards.some((c) => c.id === input.cardId)) {
    return {
      ok: false,
      code: "card_not_found",
      message: `card ${input.cardId} not found`,
    };
  }

  const g = cloneGraph(graph);
  const source: RelatedDiagramCardSource = {
    id: input.id,
    cardId: input.cardId,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    sourceVersion: input.sourceVersion ?? null,
    sourcePattern: input.sourcePattern ?? null,
    relation: input.relation ?? null,
    createdAt: nowIso(input.now),
  };
  g.cardSources.push(source);
  return { ok: true, graph: g, value: source };
}

export function upsertConnection(
  graph: RelatedDiagramSemanticGraph,
  input: {
    id: string;
    sourceCardId: string;
    targetCardId: string;
    relationType: RelatedDiagramConnectionRelationType;
    origin: RelatedDiagramConnectionOrigin;
    now?: string;
  },
): SemanticGraphResult<RelatedDiagramConnection> {
  if (input.sourceCardId === input.targetCardId) {
    return {
      ok: false,
      code: "self_connection",
      message: "source and target must differ",
    };
  }
  const ids = new Set(graph.cards.map((c) => c.id));
  if (!ids.has(input.sourceCardId) || !ids.has(input.targetCardId)) {
    return {
      ok: false,
      code: "endpoint_missing",
      message: "connection endpoints must exist",
    };
  }

  const g = cloneGraph(graph);
  const ts = nowIso(input.now);
  const existing = g.connections.find((c) => c.id === input.id);
  const connection: RelatedDiagramConnection = {
    id: input.id,
    sourceCardId: input.sourceCardId,
    targetCardId: input.targetCardId,
    relationType: input.relationType,
    origin: input.origin,
    createdAt: existing?.createdAt ?? ts,
    updatedAt: ts,
  };
  if (existing) {
    g.connections = g.connections.map((c) =>
      c.id === input.id ? connection : c,
    );
  } else {
    g.connections.push(connection);
  }
  return { ok: true, graph: g, value: connection };
}

export function deleteConnection(
  graph: RelatedDiagramSemanticGraph,
  connectionId: string,
): SemanticGraphResult<{ deletedConnectionId: string }> {
  if (!graph.connections.some((c) => c.id === connectionId)) {
    return {
      ok: false,
      code: "connection_not_found",
      message: `connection ${connectionId} not found`,
    };
  }
  const g = cloneGraph(graph);
  g.connections = g.connections.filter((c) => c.id !== connectionId);
  return {
    ok: true,
    graph: g,
    value: { deletedConnectionId: connectionId },
  };
}

export function createNursingProblem(
  graph: RelatedDiagramSemanticGraph,
  input: {
    cardId: string;
    text: string;
    state: RelatedDiagramCardState;
    supportingCardIds: string[];
    priority?: number | null;
    now?: string;
  },
): SemanticGraphResult<{
  card: RelatedDiagramCard;
  nursingProblem: RelatedDiagramNursingProblem;
}> {
  const ts = nowIso(input.now);
  let next = graph;

  const cardRes = upsertCard(next, {
    id: input.cardId,
    cardType: "nursing_problem",
    text: input.text,
    state: input.state,
    origin: "diagram_integration",
    now: ts,
  });
  if (!cardRes.ok) return cardRes;
  next = cardRes.graph;

  for (const supportingCardId of input.supportingCardIds) {
    if (!next.cards.some((c) => c.id === supportingCardId)) {
      return {
        ok: false,
        code: "support_card_missing",
        message: `supporting card ${supportingCardId} not found`,
      };
    }
  }

  if (input.priority != null) {
    const clash = next.nursingProblems.find(
      (p) =>
        p.status === "active" &&
        p.priority === input.priority &&
        p.cardId !== input.cardId,
    );
    if (clash) {
      return {
        ok: false,
        code: "duplicate_priority",
        message: `priority ${input.priority} already used`,
      };
    }
  }

  const g = cloneGraph(next);
  const nursingProblem: RelatedDiagramNursingProblem = {
    cardId: input.cardId,
    status: "active",
    priority: input.priority ?? null,
    createdAt: ts,
    updatedAt: ts,
  };
  g.nursingProblems = [
    ...g.nursingProblems.filter((p) => p.cardId !== input.cardId),
    nursingProblem,
  ];
  g.nursingProblemSupports = [
    ...g.nursingProblemSupports.filter(
      (s) => s.nursingProblemCardId !== input.cardId,
    ),
    ...input.supportingCardIds.map((supportingCardId) => ({
      nursingProblemCardId: input.cardId,
      supportingCardId,
      createdAt: ts,
    })),
  ];

  // Visible nursing_problem_basis Connections are NOT auto-created.
  // supportingCardIds are stored only as nursingProblemSupports.
  // Students create basis Connections explicitly on Canvas (student_diagram).

  return {
    ok: true,
    graph: g,
    value: { card: cardRes.value, nursingProblem },
  };
}

export function setNursingProblemPriority(
  graph: RelatedDiagramSemanticGraph,
  cardId: string,
  priority: number | null,
  now?: string,
): SemanticGraphResult<RelatedDiagramNursingProblem> {
  const problem = graph.nursingProblems.find((p) => p.cardId === cardId);
  if (!problem) {
    return {
      ok: false,
      code: "nursing_problem_missing",
      message: `nursing problem ${cardId} not found`,
    };
  }
  if (priority != null) {
    const clash = graph.nursingProblems.find(
      (p) =>
        p.status === "active" &&
        p.priority === priority &&
        p.cardId !== cardId,
    );
    if (clash) {
      return {
        ok: false,
        code: "duplicate_priority",
        message: `priority ${priority} already used`,
      };
    }
  }

  const g = cloneGraph(graph);
  const updated: RelatedDiagramNursingProblem = {
    ...problem,
    priority,
    updatedAt: nowIso(now),
  };
  g.nursingProblems = g.nursingProblems.map((p) =>
    p.cardId === cardId ? updated : p,
  );
  return { ok: true, graph: g, value: updated };
}

/**
 * Multi-stage integration: mark members integrated, create result NP,
 * append integration history (never overwrite prior integration rows).
 */
export function integrateNursingProblems(
  graph: RelatedDiagramSemanticGraph,
  input: {
    integrationId: string;
    resultCardId: string;
    resultText: string;
    resultState: RelatedDiagramCardState;
    sourceProblemCardIds: string[];
    now?: string;
  },
): SemanticGraphResult<RelatedDiagramIntegration> {
  if (input.sourceProblemCardIds.length < 2) {
    return {
      ok: false,
      code: "integration_member_missing",
      message: "integration requires at least two source problems",
    };
  }

  for (const id of input.sourceProblemCardIds) {
    const p = graph.nursingProblems.find((n) => n.cardId === id);
    if (!p || p.status !== "active") {
      return {
        ok: false,
        code: "nursing_problem_missing",
        message: `active nursing problem ${id} not found`,
      };
    }
  }

  // Multi-stage: result must not already be an ancestor of a source (cycle).
  const memberOf = new Map<string, string[]>();
  for (const m of graph.integrationMembers) {
    const integ = graph.integrations.find((i) => i.id === m.integrationId);
    if (!integ) continue;
    const list = memberOf.get(integ.resultProblemCardId) ?? [];
    list.push(m.sourceProblemCardId);
    memberOf.set(integ.resultProblemCardId, list);
  }
  function ancestors(cardId: string, seen = new Set<string>()): Set<string> {
    if (seen.has(cardId)) return seen;
    seen.add(cardId);
    for (const child of memberOf.get(cardId) ?? []) {
      ancestors(child, seen);
    }
    return seen;
  }
  for (const sourceId of input.sourceProblemCardIds) {
    if (ancestors(sourceId).has(input.resultCardId)) {
      return {
        ok: false,
        code: "integration_cycle",
        message: "integration would create a cycle",
      };
    }
  }

  const ts = nowIso(input.now);
  const created = createNursingProblem(graph, {
    cardId: input.resultCardId,
    text: input.resultText,
    state: input.resultState,
    supportingCardIds: input.sourceProblemCardIds,
    now: ts,
  });
  if (!created.ok) return created;

  const g = cloneGraph(created.graph);
  g.nursingProblems = g.nursingProblems.map((p) =>
    input.sourceProblemCardIds.includes(p.cardId)
      ? { ...p, status: "integrated" as const, priority: null, updatedAt: ts }
      : p,
  );

  const integration: RelatedDiagramIntegration = {
    id: input.integrationId,
    resultProblemCardId: input.resultCardId,
    createdAt: ts,
  };
  g.integrations.push(integration);
  for (const sourceProblemCardId of input.sourceProblemCardIds) {
    g.integrationMembers.push({
      integrationId: input.integrationId,
      sourceProblemCardId,
    });
    const connId = `np_integ:${input.integrationId}:${sourceProblemCardId}`;
    g.connections.push({
      id: connId,
      sourceCardId: sourceProblemCardId,
      targetCardId: input.resultCardId,
      relationType: "nursing_problem_integration",
      origin: "system_integration",
      createdAt: ts,
      updatedAt: ts,
    });
  }

  return { ok: true, graph: g, value: integration };
}

export function validateSemanticGraph(
  graph: RelatedDiagramSemanticGraph,
): { ok: true } | { ok: false; code: SemanticGraphErrorCode; message: string } {
  const cardById = new Map(graph.cards.map((c) => [c.id, c]));
  const cardIds = new Set(cardById.keys());

  {
    const seen = new Set<string>();
    for (const card of graph.cards) {
      if (seen.has(card.id)) {
        return {
          ok: false,
          code: "duplicate_card_id",
          message: `duplicate card id ${card.id}`,
        };
      }
      seen.add(card.id);
      if (!stateAllowedForType(card.cardType, card.state)) {
        return {
          ok: false,
          code: "invalid_state_for_type",
          message: `invalid state for ${card.id}`,
        };
      }
    }
  }

  const connIds = new Set<string>();
  for (const conn of graph.connections) {
    if (connIds.has(conn.id)) {
      return {
        ok: false,
        code: "duplicate_connection_id",
        message: `duplicate connection id ${conn.id}`,
      };
    }
    connIds.add(conn.id);
    if (conn.sourceCardId === conn.targetCardId) {
      return { ok: false, code: "self_connection", message: conn.id };
    }
    if (!cardIds.has(conn.sourceCardId) || !cardIds.has(conn.targetCardId)) {
      return {
        ok: false,
        code: "endpoint_missing",
        message: conn.id,
      };
    }
  }

  for (const source of graph.cardSources) {
    if (!cardIds.has(source.cardId)) {
      return {
        ok: false,
        code: "card_not_found",
        message: source.id,
      };
    }
  }

  const activePriorities = new Set<number>();
  for (const np of graph.nursingProblems) {
    const card = cardById.get(np.cardId);
    if (!card) {
      return {
        ok: false,
        code: "nursing_problem_missing",
        message: np.cardId,
      };
    }
    if (card.cardType !== "nursing_problem") {
      return {
        ok: false,
        code: "nursing_problem_card_type",
        message: np.cardId,
      };
    }
    if (np.status === "active" && np.priority != null) {
      if (activePriorities.has(np.priority)) {
        return {
          ok: false,
          code: "duplicate_priority",
          message: String(np.priority),
        };
      }
      activePriorities.add(np.priority);
    }
  }

  for (const support of graph.nursingProblemSupports) {
    if (!cardIds.has(support.nursingProblemCardId)) {
      return {
        ok: false,
        code: "nursing_problem_missing",
        message: support.nursingProblemCardId,
      };
    }
    if (!cardIds.has(support.supportingCardId)) {
      return {
        ok: false,
        code: "support_card_missing",
        message: support.supportingCardId,
      };
    }
  }

  const integrationById = new Map<string, (typeof graph.integrations)[number]>();
  for (const integ of graph.integrations) {
    if (integrationById.has(integ.id)) {
      return {
        ok: false,
        code: "duplicate_integration_id",
        message: integ.id,
      };
    }
    integrationById.set(integ.id, integ);

    const resultCard = cardById.get(integ.resultProblemCardId);
    if (!resultCard) {
      return {
        ok: false,
        code: "integration_result_missing",
        message: integ.resultProblemCardId,
      };
    }
    if (resultCard.cardType !== "nursing_problem") {
      return {
        ok: false,
        code: "integration_result_not_nursing_problem",
        message: integ.resultProblemCardId,
      };
    }
  }

  const membersByIntegration = new Map<string, string[]>();
  for (const member of graph.integrationMembers) {
    if (!integrationById.has(member.integrationId)) {
      return {
        ok: false,
        code: "orphan_integration_member",
        message: `${member.integrationId}:${member.sourceProblemCardId}`,
      };
    }
    const sourceCard = cardById.get(member.sourceProblemCardId);
    if (!sourceCard) {
      return {
        ok: false,
        code: "integration_member_missing",
        message: member.sourceProblemCardId,
      };
    }
    if (sourceCard.cardType !== "nursing_problem") {
      return {
        ok: false,
        code: "integration_member_not_nursing_problem",
        message: member.sourceProblemCardId,
      };
    }
    const list = membersByIntegration.get(member.integrationId) ?? [];
    list.push(member.sourceProblemCardId);
    membersByIntegration.set(member.integrationId, list);
  }

  for (const integ of graph.integrations) {
    const members = membersByIntegration.get(integ.id) ?? [];
    if (members.length < 2) {
      return {
        ok: false,
        code: "integration_member_count",
        message: integ.id,
      };
    }
  }

  // nursing_problem_integration Connection ↔ integration structure
  const expectedIntegEdges = new Set<string>();
  for (const member of graph.integrationMembers) {
    const integ = integrationById.get(member.integrationId);
    if (!integ) continue;
    expectedIntegEdges.add(
      `${member.sourceProblemCardId}->${integ.resultProblemCardId}`,
    );
  }

  for (const conn of graph.connections) {
    if (conn.relationType !== "nursing_problem_integration") continue;
    const key = `${conn.sourceCardId}->${conn.targetCardId}`;
    if (!expectedIntegEdges.has(key)) {
      return {
        ok: false,
        code: "integration_connection_mismatch",
        message: conn.id,
      };
    }
    const sourceCard = cardById.get(conn.sourceCardId);
    const targetCard = cardById.get(conn.targetCardId);
    if (
      !sourceCard ||
      !targetCard ||
      sourceCard.cardType !== "nursing_problem" ||
      targetCard.cardType !== "nursing_problem"
    ) {
      return {
        ok: false,
        code: "integration_connection_mismatch",
        message: conn.id,
      };
    }
  }

  for (const key of expectedIntegEdges) {
    const [sourceCardId, targetCardId] = key.split("->");
    const found = graph.connections.some(
      (c) =>
        c.relationType === "nursing_problem_integration" &&
        c.sourceCardId === sourceCardId &&
        c.targetCardId === targetCardId,
    );
    if (!found) {
      return {
        ok: false,
        code: "integration_connection_mismatch",
        message: `missing edge ${key}`,
      };
    }
  }

  // Integration DAG: edges result → members (composed-of). Cycle = reject.
  const children = new Map<string, string[]>();
  for (const integ of graph.integrations) {
    const members = membersByIntegration.get(integ.id) ?? [];
    children.set(integ.resultProblemCardId, [
      ...(children.get(integ.resultProblemCardId) ?? []),
      ...members,
    ]);
  }

  const visitState = new Map<string, 0 | 1 | 2>();
  function hasCycle(node: string): boolean {
    const st = visitState.get(node) ?? 0;
    if (st === 1) return true;
    if (st === 2) return false;
    visitState.set(node, 1);
    for (const child of children.get(node) ?? []) {
      if (hasCycle(child)) return true;
    }
    visitState.set(node, 2);
    return false;
  }
  for (const node of children.keys()) {
    if (hasCycle(node)) {
      return {
        ok: false,
        code: "integration_cycle",
        message: "integration graph contains a cycle",
      };
    }
  }

  return { ok: true };
}

export function buildSubmissionSnapshot(input: {
  relatedDiagramId: string;
  caseId: string;
  studentRef: string;
  submittedAt: string;
  assessmentCycleId: string | null;
  knowledgeGroupId: string | null;
  knowledgeVersion: string | null;
  statusAtSubmit: RelatedDiagramSubmissionSnapshot["statusAtSubmit"];
  graph: RelatedDiagramSemanticGraph;
}):
  | { ok: true; snapshot: RelatedDiagramSubmissionSnapshot }
  | { ok: false; code: SemanticGraphErrorCode; message: string } {
  const validated = validateSemanticGraph(input.graph);
  if (!validated.ok) return validated;
  return {
    ok: true,
    snapshot: {
      semanticSchemaVersion: RELATED_DIAGRAM_SEMANTIC_SCHEMA_VERSION,
      relatedDiagramId: input.relatedDiagramId,
      caseId: input.caseId,
      studentRef: input.studentRef,
      submittedAt: input.submittedAt,
      assessmentCycleId: input.assessmentCycleId,
      knowledgeGroupId: input.knowledgeGroupId,
      knowledgeVersion: input.knowledgeVersion,
      statusAtSubmit: input.statusAtSubmit,
      graph: structuredClone(input.graph),
    },
  };
}
