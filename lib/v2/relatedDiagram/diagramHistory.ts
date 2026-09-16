/**
 * Local undo/redo for Related Diagram card moves and Form3 card add/delete.
 * One drop / one add / one delete = one action. Viewport is not recorded.
 * Move semantics are unchanged from Slice 2A.
 */

import {
  cloneCardEntity,
  insertCardEntity,
  removeCardEntity,
  type CardEntitySnapshot,
} from "./form3ToUnderstandingCard";
import {
  cloneStableRouteState,
  type StableRouteState,
} from "./incrementalRoutes";
import type { RelatedDiagramRouteTopology } from "./routeTopology";
import type {
  RelatedDiagramCard,
  RelatedDiagramSemanticGraph,
} from "./types";

export const DIAGRAM_HISTORY_LIMIT = 50;

export type CardPositionSnap = {
  id: string;
  x: number;
  y: number;
};

export type SceneFragment = {
  cards: CardPositionSnap[];
  routeState: StableRouteState;
  topology?: RelatedDiagramRouteTopology;
};

export type MoveHistoryAction = {
  type: "moveCard" | "moveGroup";
  cardIds: string[];
  before: SceneFragment;
  after: SceneFragment;
};

export type CardEntityHistoryAction = {
  type: "addCard" | "deleteCard";
  entity: CardEntitySnapshot;
};

export type DiagramHistoryAction = MoveHistoryAction | CardEntityHistoryAction;

export type HistoryCommand =
  | { kind: "none" }
  | { kind: "applyFragment"; fragment: SceneFragment }
  | { kind: "insertCard"; entity: CardEntitySnapshot }
  | { kind: "removeCard"; cardId: string };

export type { CardEntitySnapshot };

export type DiagramHistory = {
  past: DiagramHistoryAction[];
  future: DiagramHistoryAction[];
};

export function emptyDiagramHistory(): DiagramHistory {
  return { past: [], future: [] };
}

export function cloneTopology(
  topology?: RelatedDiagramRouteTopology,
): RelatedDiagramRouteTopology | undefined {
  if (!topology) return undefined;
  return {
    schema: topology.schema,
    trunks: topology.trunks.map((t) => ({
      ...t,
      points: t.points.map((p) => ({ x: p.x, y: p.y })),
      connectionIds: [...t.connectionIds],
    })),
    branchPoints: topology.branchPoints.map((b) => ({
      ...b,
      connectionIds: [...b.connectionIds],
    })),
    routeGroups: topology.routeGroups.map((g) => ({
      ...g,
      connectionIds: [...g.connectionIds],
    })),
    routes: topology.routes.map((r) => ({
      ...r,
      points: r.points.map((p) => ({ x: p.x, y: p.y })),
    })),
  };
}

export function snapshotCards(
  cards: RelatedDiagramCard[],
  ids: string[],
): CardPositionSnap[] {
  const want = new Set(ids);
  return cards
    .filter((c) => want.has(c.id))
    .map((c) => ({ id: c.id, x: c.layout.x, y: c.layout.y }));
}

export function captureSceneFragment(input: {
  cards: RelatedDiagramCard[];
  cardIds: string[];
  routeState: StableRouteState;
  topology?: RelatedDiagramRouteTopology;
}): SceneFragment {
  return {
    cards: snapshotCards(input.cards, input.cardIds),
    routeState: cloneStableRouteState(input.routeState),
    topology: cloneTopology(input.topology),
  };
}

export function fragmentsEqual(a: SceneFragment, b: SceneFragment): boolean {
  if (a.cards.length !== b.cards.length) return false;
  const byId = new Map(b.cards.map((c) => [c.id, c]));
  return a.cards.every((c) => {
    const other = byId.get(c.id);
    return other != null && other.x === c.x && other.y === c.y;
  });
}

export function pushDiagramHistory(
  history: DiagramHistory,
  action: DiagramHistoryAction,
  limit = DIAGRAM_HISTORY_LIMIT,
): DiagramHistory {
  const stored =
    action.type === "addCard" || action.type === "deleteCard"
      ? { ...action, entity: cloneCardEntity(action.entity) }
      : action;
  const past = [...history.past, stored];
  while (past.length > limit) past.shift();
  return { past, future: [] };
}

function undoCommand(action: DiagramHistoryAction): HistoryCommand {
  switch (action.type) {
    case "moveCard":
    case "moveGroup":
      return { kind: "applyFragment", fragment: action.before };
    case "addCard":
      return { kind: "removeCard", cardId: action.entity.card.id };
    case "deleteCard":
      return { kind: "insertCard", entity: cloneCardEntity(action.entity) };
  }
}

function redoCommand(action: DiagramHistoryAction): HistoryCommand {
  switch (action.type) {
    case "moveCard":
    case "moveGroup":
      return { kind: "applyFragment", fragment: action.after };
    case "addCard":
      return { kind: "insertCard", entity: cloneCardEntity(action.entity) };
    case "deleteCard":
      return { kind: "removeCard", cardId: action.entity.card.id };
  }
}

export function undoDiagramHistory(history: DiagramHistory): {
  history: DiagramHistory;
  fragment: SceneFragment | null;
  command: HistoryCommand;
} {
  if (history.past.length === 0) {
    return { history, fragment: null, command: { kind: "none" } };
  }
  const action = history.past[history.past.length - 1]!;
  const command = undoCommand(action);
  return {
    history: {
      past: history.past.slice(0, -1),
      future: [action, ...history.future],
    },
    fragment: command.kind === "applyFragment" ? command.fragment : null,
    command,
  };
}

export function redoDiagramHistory(history: DiagramHistory): {
  history: DiagramHistory;
  fragment: SceneFragment | null;
  command: HistoryCommand;
} {
  if (history.future.length === 0) {
    return { history, fragment: null, command: { kind: "none" } };
  }
  const action = history.future[0]!;
  const command = redoCommand(action);
  return {
    history: {
      past: [...history.past, action],
      future: history.future.slice(1),
    },
    fragment: command.kind === "applyFragment" ? command.fragment : null,
    command,
  };
}

export function applyHistoryCommand(
  graph: RelatedDiagramSemanticGraph,
  command: HistoryCommand,
): RelatedDiagramSemanticGraph {
  if (command.kind === "none") return graph;
  if (command.kind === "applyFragment") {
    return applySceneFragmentToGraph(graph, command.fragment);
  }
  if (command.kind === "insertCard") {
    return insertCardEntity(graph, cloneCardEntity(command.entity));
  }
  return removeCardEntity(graph, command.cardId);
}

export function applySceneFragmentToGraph(
  graph: RelatedDiagramSemanticGraph,
  fragment: SceneFragment,
): RelatedDiagramSemanticGraph {
  const next = new Map(fragment.cards.map((c) => [c.id, c]));
  return {
    ...graph,
    cards: graph.cards.map((card) => {
      const snap = next.get(card.id);
      if (!snap) return card;
      if (card.layout.x === snap.x && card.layout.y === snap.y) return card;
      return {
        ...card,
        layout: { ...card.layout, x: snap.x, y: snap.y },
      };
    }),
  };
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}
