/**
 * Arrange Preservation Gate.
 * Decide whether a D2/D3 candidate may replace the current scene.
 * Does not change D2/D3 layout algorithms.
 */

import { A3_HEIGHT_PX, A3_WIDTH_PX } from "./a3Canvas";
import { rectIntersectsA3Legend } from "./a3Legend";
import {
  CARD_MIN_GAP,
  collidingCards,
  cardLayoutRect,
  type CardCollisionBody,
} from "./cardCollision";
import { partitionLocalGraphUnits } from "./diagramLayoutL2dUnits";
import {
  L2B_EXTREME_DETOUR,
  analyzeRouteReadability,
  routeHighwayFlag,
  sceneDisplacement,
} from "./diagramLayoutL2b";
import { orthogonalBorderGap } from "./diagramLayoutL2";
import { knowledgeCardsOf } from "./knowledgeGroupLayout";
import type { StableRouteState } from "./incrementalRoutes";
import type { RelatedDiagramRouteTopology } from "./routeTopology";
import type {
  RelatedDiagramCard,
  RelatedDiagramConnection,
} from "./types";

export type ArrangeHardDefect =
  | "overlap"
  | "bounds"
  | "legend"
  | "card_through"
  | "highway"
  | "junction_crossing"
  | "extreme_detour"
  | "excessive_separation";

export type ArrangeSceneQuality = {
  hardDefects: ArrangeHardDefect[];
  goodEnough: boolean;
  overlapCount: number;
  boundsHits: number;
  legendHits: number;
  cardThrough: number;
  highwayCount: number;
  outerRailCount: number;
  extremeDetourCount: number;
  excessiveSeparationCount: number;
  illegalCrossingCount: number;
  maxBendCount: number;
  totalLength: number;
  clusterInterleave: number;
  knowledgeEncroachment: number;
};

export type ArrangeCandidateDecision = "keep_current" | "accept_candidate";

const CLUSTER_SLACK = 24;
const MAJOR_LENGTH_RATIO = 0.72;
const MAJOR_DISPLACEMENT_CAP = 96;
/** Visually unfollowable — wider than L2's preferred-gap "excessive". */
const UNFOLLOWABLE_GAP = 480;

function compareId(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function sortedCards(cards: RelatedDiagramCard[]): RelatedDiagramCard[] {
  return [...cards].sort((a, b) => compareId(a.id, b.id));
}

function sortedConnections(
  connections: RelatedDiagramConnection[],
): RelatedDiagramConnection[] {
  return [...connections].sort((a, b) => compareId(a.id, b.id));
}

function bboxOf(cards: RelatedDiagramCard[]): {
  x: number;
  y: number;
  width: number;
  height: number;
} | null {
  if (cards.length === 0) return null;
  const left = Math.min(...cards.map((card) => card.layout.x));
  const top = Math.min(...cards.map((card) => card.layout.y));
  const right = Math.max(...cards.map((card) => card.layout.x + card.layout.width));
  const bottom = Math.max(...cards.map((card) => card.layout.y + card.layout.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function overlapArea(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): number {
  const left = Math.max(a.x, b.x);
  const top = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  if (right <= left || bottom <= top) return 0;
  return (right - left) * (bottom - top);
}

function overlapCount(cards: RelatedDiagramCard[]): number {
  const bodies: CardCollisionBody[] = cards.map(cardLayoutRect);
  let count = 0;
  for (let i = 0; i < bodies.length; i += 1) {
    const hits = collidingCards(bodies[i]!, bodies, CARD_MIN_GAP).filter(
      (other) => other.id !== bodies[i]!.id,
    );
    count += hits.length;
  }
  return Math.floor(count / 2);
}

function boundsHits(cards: RelatedDiagramCard[]): number {
  return cards.filter((card) => {
    const { x, y, width, height } = card.layout;
    return x < 0 || y < 0 || x + width > A3_WIDTH_PX || y + height > A3_HEIGHT_PX;
  }).length;
}

function legendHits(cards: RelatedDiagramCard[]): number {
  return cards.filter((card) => rectIntersectsA3Legend(card.layout)).length;
}

function excessiveSeparationCount(
  cards: RelatedDiagramCard[],
  connections: RelatedDiagramConnection[],
): number {
  const byId = new Map(cards.map((card) => [card.id, card]));
  let count = 0;
  for (const conn of connections) {
    const source = byId.get(conn.sourceCardId);
    const target = byId.get(conn.targetCardId);
    if (!source || !target) continue;
    if (orthogonalBorderGap(source.layout, target.layout) > UNFOLLOWABLE_GAP) {
      count += 1;
    }
  }
  return count;
}

function outerRailCount(routeState: StableRouteState): number {
  let count = 0;
  for (const route of Object.values(routeState.byId)) {
    if (route.points.some((point) => point.x <= 16 || point.x >= A3_WIDTH_PX - 16)) {
      count += 1;
    }
  }
  return count;
}

function clusterMetrics(
  cards: RelatedDiagramCard[],
  connections: RelatedDiagramConnection[],
  topology?: RelatedDiagramRouteTopology,
): { interleave: number; encroachment: number } {
  const units = partitionLocalGraphUnits({ cards, connections, topology });
  const byId = new Map(cards.map((card) => [card.id, card]));
  const boxes = units
    .map((unit) => {
      const members = unit.cardIds
        .map((id) => byId.get(id))
        .filter((item): item is RelatedDiagramCard => item != null);
      return { unit, box: bboxOf(members) };
    })
    .filter((row) => row.box != null) as Array<{
    unit: (typeof units)[number];
    box: { x: number; y: number; width: number; height: number };
  }>;
  const linked = new Set<string>();
  for (const conn of connections) {
    const sourceUnit = units.find((unit) => unit.cardIds.includes(conn.sourceCardId));
    const targetUnit = units.find((unit) => unit.cardIds.includes(conn.targetCardId));
    if (sourceUnit && targetUnit && sourceUnit.id !== targetUnit.id) {
      linked.add(`${sourceUnit.id}\0${targetUnit.id}`);
      linked.add(`${targetUnit.id}\0${sourceUnit.id}`);
    }
  }
  let interleave = 0;
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const left = boxes[i]!;
      const right = boxes[j]!;
      if (linked.has(`${left.unit.id}\0${right.unit.id}`)) continue;
      interleave += overlapArea(left.box, right.box);
    }
  }
  const knowledge = bboxOf(knowledgeCardsOf(cards));
  const npCards = cards.filter((card) => card.cardType === "nursing_problem");
  const npBox = bboxOf(npCards);
  let encroachment = 0;
  if (knowledge && npBox) {
    const npLeft = npBox.x - CLUSTER_SLACK;
    for (const card of knowledgeCardsOf(cards)) {
      const mid = card.layout.x + card.layout.width / 2;
      if (mid > npLeft) {
        encroachment += mid - npLeft;
      }
    }
  }
  return { interleave, encroachment };
}

export function evaluateArrangeScene(input: {
  cards: RelatedDiagramCard[];
  connections: RelatedDiagramConnection[];
  routeState: StableRouteState;
  topology?: RelatedDiagramRouteTopology;
}): ArrangeSceneQuality {
  const cards = sortedCards(input.cards);
  const connections = sortedConnections(input.connections);
  const analysis = analyzeRouteReadability({
    cards,
    connections,
    routeState: input.routeState,
    topology: input.topology,
  });
  const overlaps = overlapCount(cards);
  const bounds = boundsHits(cards);
  const legend = legendHits(cards);
  const rail = outerRailCount(input.routeState);
  const separation = excessiveSeparationCount(cards, connections);
  const extreme = analysis.connections.filter(
    (row) => row.detourRatio > L2B_EXTREME_DETOUR,
  ).length;
  const illegalCrossing = analysis.connections.filter(
    (row) =>
      row.crossingCount > 0 &&
      (row.cardIntersectionCount > 0 || row.highway > 0 || row.corridorViolation > 0),
  ).length;
  const cluster = clusterMetrics(cards, connections, input.topology);
  const hardDefects: ArrangeHardDefect[] = [];
  if (overlaps > 0) hardDefects.push("overlap");
  if (bounds > 0) hardDefects.push("bounds");
  if (legend > 0) hardDefects.push("legend");
  if (analysis.totalCardThrough > 0) hardDefects.push("card_through");
  if (analysis.highwayCount > 0 || rail > 0) hardDefects.push("highway");
  if (illegalCrossing > 0) hardDefects.push("junction_crossing");
  if (extreme > 0) hardDefects.push("extreme_detour");
  if (separation > 0) hardDefects.push("excessive_separation");
  return {
    hardDefects,
    goodEnough: hardDefects.length === 0,
    overlapCount: overlaps,
    boundsHits: bounds,
    legendHits: legend,
    cardThrough: analysis.totalCardThrough,
    highwayCount: analysis.highwayCount,
    outerRailCount: rail,
    extremeDetourCount: extreme,
    excessiveSeparationCount: separation,
    illegalCrossingCount: illegalCrossing,
    maxBendCount: analysis.maxBendCount,
    totalLength: analysis.totalLength,
    clusterInterleave: cluster.interleave,
    knowledgeEncroachment: cluster.encroachment,
  };
}

export function currentSceneIsGoodEnough(quality: ArrangeSceneQuality): boolean {
  return quality.goodEnough;
}

function clusterWorse(
  current: ArrangeSceneQuality,
  candidate: ArrangeSceneQuality,
): boolean {
  if (candidate.clusterInterleave > current.clusterInterleave + 1) return true;
  if (candidate.knowledgeEncroachment > current.knowledgeEncroachment + CLUSTER_SLACK) {
    return true;
  }
  return false;
}

function hardDefectCount(quality: ArrangeSceneQuality): number {
  return (
    quality.overlapCount +
    quality.boundsHits +
    quality.legendHits +
    quality.cardThrough +
    quality.highwayCount +
    quality.outerRailCount +
    quality.extremeDetourCount +
    quality.excessiveSeparationCount +
    quality.illegalCrossingCount
  );
}

export function compareArrangeCandidate(input: {
  current: {
    cards: RelatedDiagramCard[];
    connections: RelatedDiagramConnection[];
    routeState: StableRouteState;
    topology?: RelatedDiagramRouteTopology;
  };
  candidate: {
    cards: RelatedDiagramCard[];
    connections: RelatedDiagramConnection[];
    routeState: StableRouteState;
    topology?: RelatedDiagramRouteTopology;
  };
}): ArrangeCandidateDecision {
  const current = evaluateArrangeScene(input.current);
  const candidate = evaluateArrangeScene({
    ...input.candidate,
    connections: input.current.connections,
  });
  const displacement = sceneDisplacement(input.current.cards, input.candidate.cards);
  if (displacement === 0) {
    if (hardDefectCount(candidate) < hardDefectCount(current)) return "accept_candidate";
    return "keep_current";
  }
  if (current.goodEnough) {
    return "keep_current";
  }
  const addedDefects = candidate.hardDefects.filter(
    (item) => !current.hardDefects.includes(item),
  );
  if (
    hardDefectCount(candidate) < hardDefectCount(current) &&
    addedDefects.length === 0
  ) {
    return "accept_candidate";
  }
  if (candidate.goodEnough && addedDefects.length === 0) {
    return "accept_candidate";
  }
  if (clusterWorse(current, candidate)) return "keep_current";
  if (
    hardDefectCount(candidate) === hardDefectCount(current) &&
    displacement <= MAJOR_DISPLACEMENT_CAP &&
    candidate.totalLength <= current.totalLength * MAJOR_LENGTH_RATIO
  ) {
    return "accept_candidate";
  }
  return "keep_current";
}

export function acceptArrangeCandidate(input: {
  current: {
    cards: RelatedDiagramCard[];
    connections: RelatedDiagramConnection[];
    routeState: StableRouteState;
    topology?: RelatedDiagramRouteTopology;
  };
  candidate: {
    cards: RelatedDiagramCard[];
    connections: RelatedDiagramConnection[];
    routeState: StableRouteState;
    topology?: RelatedDiagramRouteTopology;
  };
}): boolean {
  return compareArrangeCandidate(input) === "accept_candidate";
}

export function gateArrangeCandidate<T extends {
  cards: RelatedDiagramCard[];
  routeState: StableRouteState;
  topology?: RelatedDiagramRouteTopology;
  changedCardIds: string[];
  routeChanged: boolean;
}>(
  current: {
    cards: RelatedDiagramCard[];
    connections: RelatedDiagramConnection[];
    routeState: StableRouteState;
    topology?: RelatedDiagramRouteTopology;
  },
  candidate: T,
): T | {
  cards: RelatedDiagramCard[];
  routeState: StableRouteState;
  topology?: RelatedDiagramRouteTopology;
  changedCardIds: string[];
  routeChanged: boolean;
} {
  if (candidate.changedCardIds.length === 0 && !candidate.routeChanged) {
    return candidate;
  }
  if (
    acceptArrangeCandidate({
      current,
      candidate: {
        cards: candidate.cards,
        connections: current.connections,
        routeState: candidate.routeState,
        topology: candidate.topology,
      },
    })
  ) {
    return candidate;
  }
  return {
    cards: current.cards,
    routeState: current.routeState,
    topology: current.topology,
    changedCardIds: [],
    routeChanged: false,
  };
}

export function routeLooksLikeHighway(points: Array<{ x: number; y: number }>): boolean {
  return routeHighwayFlag(points) > 0;
}
