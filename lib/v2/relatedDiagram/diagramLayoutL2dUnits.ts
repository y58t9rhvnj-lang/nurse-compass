/**
 * L2-D D1: local graph units.
 * Semantic seeds + size cap. Not hop-count-only, not a full CC.
 */

import { knowledgeCardsOf } from "./knowledgeGroupLayout";
import type { RelatedDiagramRouteTopology } from "./routeTopology";
import type {
  RelatedDiagramCard,
  RelatedDiagramConnection,
} from "./types";

export const L2D_STUDENT_UNIT_MAX = 8;

export type LocalGraphUnitKind =
  | "knowledge"
  | "junction_fan"
  | "nursing_problem"
  | "star"
  | "pair"
  | "isolated";

export type LocalGraphUnit = {
  id: string;
  kind: LocalGraphUnitKind;
  cardIds: string[];
};

function compareId(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function neighborsOf(
  cardId: string,
  connections: RelatedDiagramConnection[],
): string[] {
  const ids = new Set<string>();
  for (const conn of connections) {
    if (conn.sourceCardId === cardId) ids.add(conn.targetCardId);
    if (conn.targetCardId === cardId) ids.add(conn.sourceCardId);
  }
  return [...ids].sort(compareId);
}

function takeBounded(ids: string[], max: number): string[] {
  const unique = [...new Set(ids)].sort(compareId);
  if (unique.length <= max) return unique;
  return unique.slice(0, max);
}

export function partitionLocalGraphUnits(input: {
  cards: RelatedDiagramCard[];
  connections: RelatedDiagramConnection[];
  topology?: RelatedDiagramRouteTopology;
}): LocalGraphUnit[] {
  const cards = [...input.cards].sort((a, b) => compareId(a.id, b.id));
  const connections = [...input.connections].sort((a, b) =>
    compareId(a.id, b.id),
  );
  const assigned = new Set<string>();
  const units: LocalGraphUnit[] = [];

  const knowledgeIds = knowledgeCardsOf(cards)
    .map((card) => card.id)
    .sort(compareId);
  if (knowledgeIds.length > 0) {
    units.push({
      id: "unit:knowledge",
      kind: "knowledge",
      cardIds: knowledgeIds,
    });
    for (const id of knowledgeIds) assigned.add(id);
  }

  const groups = [...(input.topology?.routeGroups ?? [])].sort((a, b) =>
    compareId(a.id, b.id),
  );
  for (const group of groups) {
    const memberIds = new Set<string>([group.sourceCardId]);
    for (const conn of connections) {
      if (!group.connectionIds.includes(conn.id)) continue;
      memberIds.add(conn.sourceCardId);
      memberIds.add(conn.targetCardId);
    }
    const fresh = [...memberIds]
      .filter((id) => !assigned.has(id))
      .sort(compareId);
    if (fresh.length === 0) continue;
    if (fresh.some((id) => knowledgeIds.includes(id))) continue;
    const cardIds = takeBounded(
      [group.sourceCardId, ...fresh].filter((id) => cards.some((card) => card.id === id)),
      L2D_STUDENT_UNIT_MAX,
    );
    if (cardIds.length === 0) continue;
    units.push({
      id: `unit:fan:${group.id}`,
      kind: "junction_fan",
      cardIds,
    });
    for (const id of cardIds) assigned.add(id);
  }

  const npCards = cards.filter((card) => card.cardType === "nursing_problem");
  for (const np of npCards) {
    if (assigned.has(np.id)) continue;
    const near = new Set<string>([np.id]);
    for (const conn of connections) {
      if (
        conn.relationType !== "nursing_problem_basis" &&
        conn.relationType !== "nursing_problem_integration"
      ) {
        continue;
      }
      if (conn.sourceCardId === np.id || conn.targetCardId === np.id) {
        near.add(conn.sourceCardId);
        near.add(conn.targetCardId);
      }
    }
    const extra: string[] = [];
    for (const id of [...near]) {
      for (const other of neighborsOf(id, connections)) {
        const card = cards.find((item) => item.id === other);
        if (!card || assigned.has(other) || card.cardType === "knowledge") continue;
        if (
          card.cardType === "information" ||
          card.cardType === "understanding" ||
          card.cardType === "nursing_problem"
        ) {
          extra.push(other);
        }
      }
    }
    const cardIds = takeBounded(
      [...near, ...extra].filter((id) => !assigned.has(id) || id === np.id),
      L2D_STUDENT_UNIT_MAX,
    );
    if (!cardIds.includes(np.id)) cardIds.unshift(np.id);
    const bounded = takeBounded(cardIds, L2D_STUDENT_UNIT_MAX);
    units.push({
      id: `unit:np:${np.id}`,
      kind: "nursing_problem",
      cardIds: bounded,
    });
    for (const id of bounded) assigned.add(id);
  }

  const remaining = () =>
    cards.map((card) => card.id).filter((id) => !assigned.has(id));

  let leftover = remaining();
  leftover.sort(compareId);
  while (leftover.length > 0) {
    let bestCenter = leftover[0]!;
    let bestDegree = -1;
    for (const id of leftover) {
      const degree = neighborsOf(id, connections).filter((other) =>
        leftover.includes(other),
      ).length;
      if (degree > bestDegree || (degree === bestDegree && id < bestCenter)) {
        bestCenter = id;
        bestDegree = degree;
      }
    }
    const localNeighbors = neighborsOf(bestCenter, connections).filter((id) =>
      leftover.includes(id),
    );
    if (bestDegree >= 2) {
      const cardIds = takeBounded([bestCenter, ...localNeighbors], L2D_STUDENT_UNIT_MAX);
      units.push({
        id: `unit:star:${bestCenter}`,
        kind: "star",
        cardIds,
      });
      for (const id of cardIds) assigned.add(id);
    } else if (bestDegree === 1) {
      const pair = [bestCenter, localNeighbors[0]!].sort(compareId);
      units.push({
        id: `unit:pair:${pair.join("+")}`,
        kind: "pair",
        cardIds: pair,
      });
      for (const id of pair) assigned.add(id);
    } else {
      units.push({
        id: `unit:iso:${bestCenter}`,
        kind: "isolated",
        cardIds: [bestCenter],
      });
      assigned.add(bestCenter);
    }
    leftover = remaining();
  }

  return units;
}
