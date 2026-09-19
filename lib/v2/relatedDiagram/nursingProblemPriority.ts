/**
 * Slice 2B-2H-1 — Nursing Problem Priority domain.
 * Student ranking only. Stable 1..K reorder. No AI. No layout / routing.
 */

import type {
  RelatedDiagramNursingProblem,
  RelatedDiagramSemanticGraph,
} from "./types";

export type NursingProblemPriorityErrorCode =
  | "card_not_found"
  | "not_nursing_problem"
  | "nursing_problem_missing"
  | "not_active"
  | "invalid_priority";

export type AssignNursingProblemPriorityResult =
  | {
      ok: true;
      graph: RelatedDiagramSemanticGraph;
      changed: boolean;
    }
  | {
      ok: false;
      code: NursingProblemPriorityErrorCode;
      message: string;
    };

export function cloneNursingProblemRow(
  row: RelatedDiagramNursingProblem,
): RelatedDiagramNursingProblem {
  return { ...row };
}

export function cloneNursingProblems(
  rows: readonly RelatedDiagramNursingProblem[],
): RelatedDiagramNursingProblem[] {
  return rows.map(cloneNursingProblemRow);
}

export function formatNursingProblemPriorityBadge(
  priority: number | null | undefined,
): string | null {
  if (priority == null || !Number.isInteger(priority) || priority < 1) {
    return null;
  }
  return `#${priority}`;
}

export function resolveNursingProblemPriority(
  graph: RelatedDiagramSemanticGraph,
  cardId: string,
): number | null {
  const row = graph.nursingProblems.find((problem) => problem.cardId === cardId);
  if (!row || row.status !== "active") return null;
  return row.priority;
}

function rankedActiveProblems(
  graph: RelatedDiagramSemanticGraph,
): RelatedDiagramNursingProblem[] {
  return graph.nursingProblems
    .filter((row) => row.status === "active" && row.priority != null)
    .slice()
    .sort((a, b) => {
      const byPriority = (a.priority ?? 0) - (b.priority ?? 0);
      return byPriority !== 0 ? byPriority : a.cardId.localeCompare(b.cardId);
    });
}

function applyRankedOrder(
  graph: RelatedDiagramSemanticGraph,
  order: readonly string[],
  unrankedCardId: string | null,
  now: string,
): { graph: RelatedDiagramSemanticGraph; changed: boolean } {
  const nextRank = new Map(order.map((cardId, index) => [cardId, index + 1]));
  let changed = false;
  const nursingProblems = graph.nursingProblems.map((row) => {
    if (unrankedCardId != null && row.cardId === unrankedCardId) {
      if (row.priority == null) return row;
      changed = true;
      return { ...row, priority: null, updatedAt: now };
    }
    const assigned = nextRank.get(row.cardId);
    if (assigned == null) return row;
    if (row.priority === assigned) return row;
    changed = true;
    return { ...row, priority: assigned, updatedAt: now };
  });
  if (!changed) return { graph, changed: false };
  return { graph: { ...graph, nursingProblems }, changed: true };
}

export function compactActiveNursingProblemPriorities(
  graph: RelatedDiagramSemanticGraph,
  now?: string,
): { graph: RelatedDiagramSemanticGraph; changed: boolean } {
  const ranked = rankedActiveProblems(graph);
  return applyRankedOrder(
    graph,
    ranked.map((row) => row.cardId),
    null,
    now ?? new Date().toISOString(),
  );
}

export function assignNursingProblemPriority(
  graph: RelatedDiagramSemanticGraph,
  cardId: string,
  priority: number | null,
  now?: string,
): AssignNursingProblemPriorityResult {
  const card = graph.cards.find((row) => row.id === cardId);
  if (!card) {
    return {
      ok: false,
      code: "card_not_found",
      message: `card ${cardId} not found`,
    };
  }
  if (card.cardType !== "nursing_problem") {
    return {
      ok: false,
      code: "not_nursing_problem",
      message: `card ${cardId} is not a nursing problem`,
    };
  }
  const problem = graph.nursingProblems.find((row) => row.cardId === cardId);
  if (!problem) {
    return {
      ok: false,
      code: "nursing_problem_missing",
      message: `nursing problem ${cardId} not found`,
    };
  }
  if (problem.status !== "active") {
    return {
      ok: false,
      code: "not_active",
      message: `nursing problem ${cardId} is not active`,
    };
  }
  if (problem.priority === priority) {
    return { ok: true, graph, changed: false };
  }
  if (priority != null && (!Number.isInteger(priority) || priority < 1)) {
    return {
      ok: false,
      code: "invalid_priority",
      message: `priority ${priority} is not a valid rank`,
    };
  }

  const ranked = rankedActiveProblems(graph);
  const rankedIds = ranked.map((row) => row.cardId);
  const current = problem.priority;
  const max = current == null ? ranked.length + 1 : ranked.length;
  if (priority != null && priority > max) {
    return {
      ok: false,
      code: "invalid_priority",
      message: `priority ${priority} is outside 1..${max}`,
    };
  }

  const ts = now ?? new Date().toISOString();
  if (priority == null) {
    return {
      ok: true,
      ...applyRankedOrder(
        graph,
        rankedIds.filter((id) => id !== cardId),
        cardId,
        ts,
      ),
    };
  }

  const without = rankedIds.filter((id) => id !== cardId);
  const nextOrder = without.slice();
  nextOrder.splice(priority - 1, 0, cardId);
  return {
    ok: true,
    ...applyRankedOrder(graph, nextOrder, null, ts),
  };
}

export function restoreNursingProblemsExact(
  graph: RelatedDiagramSemanticGraph,
  rows: readonly RelatedDiagramNursingProblem[],
): RelatedDiagramSemanticGraph {
  return { ...graph, nursingProblems: cloneNursingProblems(rows) };
}
