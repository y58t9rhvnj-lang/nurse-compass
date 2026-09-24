/**
 * L3-A arrange apply. L1 hard safety, then L2-D D0–D3.
 * No full-scene topology regeneration.
 */

import {
  captureSceneFragment,
  type MoveHistoryAction,
} from "./diagramHistory";
import type { DiagramLayoutResult } from "./diagramLayout";
import { layoutRelatedDiagramConnected } from "./diagramLayoutL2";
import {
  applyKnowledgeLayerArrange,
  collectArrangeAffectedConnectionIds,
  restitchAffectedRoutes,
} from "./diagramLayoutL2d";
import { applyNursingProblemArrange } from "./diagramLayoutL2dNp";
import {
  evaluateArrangeScene,
  gateArrangeCandidate,
} from "./arrangePreservation";
import { type StableRouteState } from "./incrementalRoutes";
import type { RelatedDiagramRouteTopology } from "./routeTopology";
import type { RelatedDiagramSemanticGraph } from "./types";

export const ARRANGE_ALREADY_MESSAGE = "すでに整っています";
export const ARRANGE_IMPOSSIBLE_MESSAGE =
  "A3内に完全には整えられませんでした";
/** Internal D2→D3 feedback only. One user Arrange. Not a D4 loop. */
export const ARRANGE_STABILIZE_MAX_PASSES = 3;

export type ArrangeRelatedDiagramUiLockInput = {
  connecting: boolean;
  editOpen: boolean;
  composeOpen: boolean;
  chooserOpen: boolean;
  deleteConfirmOpen: boolean;
  priorityPickerOpen: boolean;
  dragging: boolean;
};

export function arrangeRelatedDiagramUiLocked(
  input: ArrangeRelatedDiagramUiLockInput,
): boolean {
  return (
    input.connecting ||
    input.editOpen ||
    input.composeOpen ||
    input.chooserOpen ||
    input.deleteConfirmOpen ||
    input.priorityPickerOpen ||
    input.dragging
  );
}

export type ArrangeRelatedDiagramNotice =
  | "already_arranged"
  | "arranged"
  | "impossible_to_fit";

export type ArrangeRelatedDiagramApplied = {
  kind: "applied";
  notice: "arranged" | "impossible_to_fit";
  graph: RelatedDiagramSemanticGraph;
  routeState: StableRouteState;
  topology?: RelatedDiagramRouteTopology;
  historyAction: MoveHistoryAction;
  layout: DiagramLayoutResult;
};

export type ArrangeRelatedDiagramNoop = {
  kind: "noop";
  notice: "already_arranged" | "impossible_to_fit";
  layout: DiagramLayoutResult;
};

export type ArrangeRelatedDiagramResult =
  | ArrangeRelatedDiagramApplied
  | ArrangeRelatedDiagramNoop;

export function arrangeNoticeMessage(
  result: ArrangeRelatedDiagramResult,
): string | null {
  if (result.notice === "impossible_to_fit") return ARRANGE_IMPOSSIBLE_MESSAGE;
  if (result.kind === "noop") return ARRANGE_ALREADY_MESSAGE;
  return null;
}

export function applyLayoutPositionsToGraph(
  graph: RelatedDiagramSemanticGraph,
  positions: Array<{ cardId: string; x: number; y: number }>,
): RelatedDiagramSemanticGraph {
  const byId = new Map(positions.map((pos) => [pos.cardId, pos]));
  let changed = false;
  const cards = graph.cards.map((card) => {
    const next = byId.get(card.id);
    if (!next) return card;
    if (card.layout.x === next.x && card.layout.y === next.y) return card;
    changed = true;
    return {
      ...card,
      layout: {
        ...card.layout,
        x: next.x,
        y: next.y,
      },
    };
  });
  return changed ? { ...graph, cards } : graph;
}

export function arrangeRelatedDiagramScene(input: {
  graph: RelatedDiagramSemanticGraph;
  routeState: StableRouteState;
  topology?: RelatedDiagramRouteTopology;
}): ArrangeRelatedDiagramResult {
  const opening = evaluateArrangeScene({
    cards: input.graph.cards,
    connections: input.graph.connections,
    routeState: input.routeState,
    topology: input.topology,
  });
  const layout = opening.goodEnough
    ? {
        positions: input.graph.cards.map((card) => ({
          cardId: card.id,
          x: card.layout.x,
          y: card.layout.y,
        })),
        changedCardIds: [] as string[],
        fullyArranged: true,
        reason: "already_arranged" as const,
      }
    : layoutRelatedDiagramConnected({
        cards: input.graph.cards,
        connections: input.graph.connections,
      });
  const cardsMoved = layout.changedCardIds.length > 0;
  const laidOutGraph = cardsMoved
    ? applyLayoutPositionsToGraph(input.graph, layout.positions)
    : input.graph;
  const l1Affected = collectArrangeAffectedConnectionIds({
    previousCards: input.graph.cards,
    nextCards: laidOutGraph.cards,
    connections: input.graph.connections,
    topology: input.topology,
    previousTopology: input.topology,
    activeUnitCardIds: [],
  });
  const afterHard =
    l1Affected.length > 0
      ? restitchAffectedRoutes({
          previous: input.routeState,
          previousTopology: input.topology,
          cards: laidOutGraph.cards,
          connections: input.graph.connections,
          topology: input.topology,
          affectedIds: l1Affected,
        })
      : {
          routeState: input.routeState,
          topology: input.topology,
        };
  let cards = laidOutGraph.cards;
  let routeState = afterHard.routeState;
  let topology = afterHard.topology;
  const refinedIds = new Set<string>(layout.changedCardIds);
  let refinedRouteChanged = false;
  for (let pass = 0; pass < ARRANGE_STABILIZE_MAX_PASSES; pass += 1) {
    const current = {
      cards,
      connections: input.graph.connections,
      routeState,
      topology,
    };
    const refined = gateArrangeCandidate(
      current,
      applyKnowledgeLayerArrange({
        cards,
        connections: input.graph.connections,
        routeState,
        topology,
      }),
    );
    const afterKnowledge = {
      cards: refined.changedCardIds.length > 0 ? refined.cards : cards,
      connections: input.graph.connections,
      routeState: refined.routeState,
      topology: refined.topology,
    };
    const npRefined = gateArrangeCandidate(
      afterKnowledge,
      applyNursingProblemArrange({
        cards: afterKnowledge.cards,
        connections: input.graph.connections,
        routeState: afterKnowledge.routeState,
        topology: afterKnowledge.topology,
      }),
    );
    const passTouched =
      refined.changedCardIds.length > 0 ||
      refined.routeChanged ||
      npRefined.changedCardIds.length > 0 ||
      npRefined.routeChanged;
    for (const id of refined.changedCardIds) refinedIds.add(id);
    for (const id of npRefined.changedCardIds) refinedIds.add(id);
    if (refined.routeChanged || npRefined.routeChanged) refinedRouteChanged = true;
    cards = npRefined.changedCardIds.length > 0
      ? npRefined.cards
      : refined.changedCardIds.length > 0
        ? refined.cards
        : cards;
    routeState = npRefined.routeState;
    topology = npRefined.topology;
    if (!passTouched) break;
  }
  const nextGraph =
    cards === laidOutGraph.cards ? laidOutGraph : { ...laidOutGraph, cards };
  const changedCardIds = [...refinedIds].sort();
  if (
    !cardsMoved &&
    changedCardIds.length === 0 &&
    !refinedRouteChanged
  ) {
    return {
      kind: "noop",
      notice: layout.fullyArranged ? "already_arranged" : "impossible_to_fit",
      layout,
    };
  }

  const historyAction: MoveHistoryAction = {
    type: "moveGroup",
    cardIds: changedCardIds,
    before: captureSceneFragment({
      cards: input.graph.cards,
      cardIds: changedCardIds,
      routeState: input.routeState,
      topology: input.topology,
    }),
    after: captureSceneFragment({
      cards: nextGraph.cards,
      cardIds: changedCardIds,
      routeState,
      topology,
    }),
  };

  return {
    kind: "applied",
    notice: layout.fullyArranged ? "arranged" : "impossible_to_fit",
    graph: nextGraph,
    routeState,
    topology,
    historyAction,
    layout,
  };
}
