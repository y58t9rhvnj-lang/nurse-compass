/**
 * Slice 2B-2H-2 — Priority Picker options + history wrap.
 * Reuses 2H-1 assignNursingProblemPriority. No new reorder algorithm.
 */

import type { SetNursingProblemPrioritiesHistoryAction } from "./diagramHistory";
import {
  assignNursingProblemPriority,
  cloneNursingProblems,
  formatNursingProblemPriorityBadge,
  resolveNursingProblemPriority,
} from "./nursingProblemPriority";
import type { RelatedDiagramSemanticGraph } from "./types";

export const NURSING_PROBLEM_PRIORITY_UNSET_LABEL = "未設定";

export type NursingProblemPriorityPickerOption = {
  priority: number | null;
  label: string;
  selected: boolean;
};

export type CommitNursingProblemPriorityPickerResult =
  | { ok: false; code: string; message: string }
  | {
      ok: true;
      graph: RelatedDiagramSemanticGraph;
      changed: false;
    }
  | {
      ok: true;
      graph: RelatedDiagramSemanticGraph;
      changed: true;
      action: SetNursingProblemPrioritiesHistoryAction;
    };

export function activeRankedNursingProblemCount(
  graph: RelatedDiagramSemanticGraph,
): number {
  return graph.nursingProblems.filter(
    (row) => row.status === "active" && row.priority != null,
  ).length;
}

export function canSetNursingProblemPriority(
  graph: RelatedDiagramSemanticGraph,
  cardId: string,
): boolean {
  const card = graph.cards.find((row) => row.id === cardId);
  if (!card || card.cardType !== "nursing_problem") return false;
  const row = graph.nursingProblems.find((problem) => problem.cardId === cardId);
  return row?.status === "active";
}

export function nursingProblemPriorityPickerOptions(
  graph: RelatedDiagramSemanticGraph,
  cardId: string,
): NursingProblemPriorityPickerOption[] | null {
  if (!canSetNursingProblemPriority(graph, cardId)) return null;
  const current = resolveNursingProblemPriority(graph, cardId);
  const ranked = activeRankedNursingProblemCount(graph);
  const max = current == null ? ranked + 1 : ranked;
  const options: NursingProblemPriorityPickerOption[] = [];
  for (let rank = 1; rank <= max; rank += 1) {
    const label = formatNursingProblemPriorityBadge(rank);
    if (!label) continue;
    options.push({
      priority: rank,
      label,
      selected: current === rank,
    });
  }
  options.push({
    priority: null,
    label: NURSING_PROBLEM_PRIORITY_UNSET_LABEL,
    selected: current == null,
  });
  return options;
}

export function commitNursingProblemPriorityPickerSelection(input: {
  graph: RelatedDiagramSemanticGraph;
  cardId: string;
  priority: number | null;
  now?: string;
}): CommitNursingProblemPriorityPickerResult {
  const before = cloneNursingProblems(input.graph.nursingProblems);
  const assigned = assignNursingProblemPriority(
    input.graph,
    input.cardId,
    input.priority,
    input.now,
  );
  if (!assigned.ok) {
    return {
      ok: false,
      code: assigned.code,
      message: assigned.message,
    };
  }
  if (!assigned.changed) {
    return { ok: true, graph: assigned.graph, changed: false };
  }
  return {
    ok: true,
    graph: assigned.graph,
    changed: true,
    action: {
      type: "setNursingProblemPriorities",
      before,
      after: cloneNursingProblems(assigned.graph.nursingProblems),
    },
  };
}
