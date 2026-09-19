/**
 * Slice 2B-2F-2 — Direct Nursing Problem Card.
 * Same cardType as existing NP cards. origin=direct_insight only.
 * Does not use the integration builder (supports + diagram_integration).
 */

import { DIRECT_INSIGHT_ORIGIN } from "./cardDirectInsight";
import type { CardEntitySnapshot } from "./form3ToUnderstandingCard";
import type {
  RelatedDiagramCard,
  RelatedDiagramCardState,
  RelatedDiagramNursingProblem,
} from "./types";

export const DIRECT_NURSING_PROBLEM_WIDTH = 200;
export const DIRECT_NURSING_PROBLEM_HEIGHT = 78;

export function newDirectNursingProblemCardId(now = Date.now()): string {
  return `dnp_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function buildDirectNursingProblemRow(input: {
  cardId: string;
  now?: string;
  status?: RelatedDiagramNursingProblem["status"];
  priority?: number | null;
}): RelatedDiagramNursingProblem {
  const ts = input.now ?? "2026-09-19T00:00:00.000Z";
  return {
    cardId: input.cardId,
    status: input.status ?? "active",
    priority: input.priority ?? null,
    createdAt: ts,
    updatedAt: ts,
  };
}

export function buildDirectNursingProblemCard(input: {
  text: string;
  state: RelatedDiagramCardState;
  layout: { x: number; y: number; zIndex: number };
  cardId?: string;
  now?: string;
}): CardEntitySnapshot {
  const ts = input.now ?? "2026-09-19T00:00:00.000Z";
  const id = input.cardId ?? newDirectNursingProblemCardId();
  const card: RelatedDiagramCard = {
    id,
    cardType: "nursing_problem",
    text: input.text.trim(),
    state: input.state,
    origin: DIRECT_INSIGHT_ORIGIN,
    layout: {
      x: input.layout.x,
      y: input.layout.y,
      width: DIRECT_NURSING_PROBLEM_WIDTH,
      height: DIRECT_NURSING_PROBLEM_HEIGHT,
      zIndex: input.layout.zIndex,
    },
    isLocked: false,
    createdAt: ts,
    updatedAt: ts,
  };
  return {
    card,
    sources: [],
    nursingProblem: buildDirectNursingProblemRow({ cardId: id, now: ts }),
  };
}
