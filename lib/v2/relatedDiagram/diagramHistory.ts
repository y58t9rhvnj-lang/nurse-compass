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
import { cloneConnection } from "./cardConnectionCreate";
import { replaceConnectionExact } from "./cardConnectionManage";
import { patchCardInGraph } from "./cardEdit";
import { restoreDeletedConnections } from "./cardDelete";
import {
  cloneNursingProblems,
  restoreNursingProblemsExact,
} from "./nursingProblemPriority";
import { deleteConnection, upsertConnection } from "./semanticGraph";
import type {
  RelatedDiagramCard,
  RelatedDiagramConnection,
  RelatedDiagramNursingProblem,
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
  connections?: RelatedDiagramConnection[];
  routeStateBefore?: StableRouteState;
  routeStateAfter?: StableRouteState;
  topologyBefore?: RelatedDiagramRouteTopology;
  topologyAfter?: RelatedDiagramRouteTopology;
  nursingProblemsBefore?: RelatedDiagramNursingProblem[];
  nursingProblemsAfter?: RelatedDiagramNursingProblem[];
};

export type SetNursingProblemPrioritiesHistoryAction = {
  type: "setNursingProblemPriorities";
  before: RelatedDiagramNursingProblem[];
  after: RelatedDiagramNursingProblem[];
};

export type EditCardHistoryAction = {
  type: "editCard";
  cardId: string;
  before: { text: string; state: RelatedDiagramCard["state"] };
  after: { text: string; state: RelatedDiagramCard["state"] };
};

export type AddConnectionHistoryAction = {
  type: "addConnection";
  connection: RelatedDiagramConnection;
  routeStateBefore: StableRouteState;
  routeStateAfter: StableRouteState;
  topologyBefore?: RelatedDiagramRouteTopology;
  topologyAfter?: RelatedDiagramRouteTopology;
};

export type EditConnectionRelationHistoryAction = {
  type: "editConnectionRelation";
  before: RelatedDiagramConnection;
  after: RelatedDiagramConnection;
};

export type DeleteConnectionHistoryAction = {
  type: "deleteConnection";
  connection: RelatedDiagramConnection;
  routeStateBefore: StableRouteState;
  routeStateAfter: StableRouteState;
  topologyBefore?: RelatedDiagramRouteTopology;
  topologyAfter?: RelatedDiagramRouteTopology;
};

export type ReverseConnectionHistoryAction = {
  type: "reverseConnection";
  before: RelatedDiagramConnection;
  after: RelatedDiagramConnection;
  routeStateBefore: StableRouteState;
  routeStateAfter: StableRouteState;
  topologyBefore?: RelatedDiagramRouteTopology;
  topologyAfter?: RelatedDiagramRouteTopology;
};

export type DiagramHistoryAction =
  | MoveHistoryAction
  | CardEntityHistoryAction
  | EditCardHistoryAction
  | AddConnectionHistoryAction
  | EditConnectionRelationHistoryAction
  | DeleteConnectionHistoryAction
  | ReverseConnectionHistoryAction
  | SetNursingProblemPrioritiesHistoryAction;

export type HistoryCommand =
  | { kind: "none" }
  | { kind: "applyFragment"; fragment: SceneFragment }
  | {
      kind: "insertCard";
      entity: CardEntitySnapshot;
      connections?: RelatedDiagramConnection[];
      routeState?: StableRouteState;
      topology?: RelatedDiagramRouteTopology;
      nursingProblems?: RelatedDiagramNursingProblem[];
    }
  | {
      kind: "removeCard";
      cardId: string;
      routeState?: StableRouteState;
      topology?: RelatedDiagramRouteTopology;
      nursingProblems?: RelatedDiagramNursingProblem[];
    }
  | {
      kind: "restoreNursingProblems";
      nursingProblems: RelatedDiagramNursingProblem[];
    }
  | {
      kind: "applyCardEdit";
      cardId: string;
      text: string;
      state: RelatedDiagramCard["state"];
    }
  | {
      kind: "addConnection";
      connection: RelatedDiagramConnection;
      routeState?: StableRouteState;
      topology?: RelatedDiagramRouteTopology;
    }
  | {
      kind: "removeConnection";
      connectionId: string;
      routeState?: StableRouteState;
      topology?: RelatedDiagramRouteTopology;
    }
  | {
      kind: "replaceConnection";
      connection: RelatedDiagramConnection;
      routeState?: StableRouteState;
      topology?: RelatedDiagramRouteTopology;
    };

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
      ? {
          ...action,
          entity: cloneCardEntity(action.entity),
          connections: action.connections?.map((row) => ({ ...row })),
          routeStateBefore: action.routeStateBefore
            ? cloneStableRouteState(action.routeStateBefore)
            : undefined,
          routeStateAfter: action.routeStateAfter
            ? cloneStableRouteState(action.routeStateAfter)
            : undefined,
          topologyBefore: cloneTopology(action.topologyBefore),
          topologyAfter: cloneTopology(action.topologyAfter),
          nursingProblemsBefore: action.nursingProblemsBefore
            ? cloneNursingProblems(action.nursingProblemsBefore)
            : undefined,
          nursingProblemsAfter: action.nursingProblemsAfter
            ? cloneNursingProblems(action.nursingProblemsAfter)
            : undefined,
        }
      : action.type === "editCard"
        ? {
            ...action,
            before: { ...action.before },
            after: { ...action.after },
          }
        : action.type === "addConnection"
          ? {
              ...action,
              connection: cloneConnection(action.connection),
              routeStateBefore: cloneStableRouteState(action.routeStateBefore),
              routeStateAfter: cloneStableRouteState(action.routeStateAfter),
              topologyBefore: cloneTopology(action.topologyBefore),
              topologyAfter: cloneTopology(action.topologyAfter),
            }
          : action.type === "editConnectionRelation"
            ? {
                ...action,
                before: cloneConnection(action.before),
                after: cloneConnection(action.after),
              }
            : action.type === "deleteConnection"
              ? {
                  ...action,
                  connection: cloneConnection(action.connection),
                  routeStateBefore: cloneStableRouteState(
                    action.routeStateBefore,
                  ),
                  routeStateAfter: cloneStableRouteState(action.routeStateAfter),
                  topologyBefore: cloneTopology(action.topologyBefore),
                  topologyAfter: cloneTopology(action.topologyAfter),
                }
              : action.type === "reverseConnection"
                ? {
                    ...action,
                    before: cloneConnection(action.before),
                    after: cloneConnection(action.after),
                    routeStateBefore: cloneStableRouteState(
                      action.routeStateBefore,
                    ),
                    routeStateAfter: cloneStableRouteState(
                      action.routeStateAfter,
                    ),
                    topologyBefore: cloneTopology(action.topologyBefore),
                    topologyAfter: cloneTopology(action.topologyAfter),
                  }
                : action.type === "setNursingProblemPriorities"
                  ? {
                      ...action,
                      before: cloneNursingProblems(action.before),
                      after: cloneNursingProblems(action.after),
                    }
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
      return {
        kind: "insertCard",
        entity: cloneCardEntity(action.entity),
        connections: action.connections?.map((row) => ({ ...row })),
        routeState: action.routeStateBefore
          ? cloneStableRouteState(action.routeStateBefore)
          : undefined,
        topology: cloneTopology(action.topologyBefore),
        nursingProblems: action.nursingProblemsBefore
          ? cloneNursingProblems(action.nursingProblemsBefore)
          : undefined,
      };
    case "setNursingProblemPriorities":
      return {
        kind: "restoreNursingProblems",
        nursingProblems: cloneNursingProblems(action.before),
      };
    case "editCard":
      return {
        kind: "applyCardEdit",
        cardId: action.cardId,
        text: action.before.text,
        state: action.before.state,
      };
    case "addConnection":
      return {
        kind: "removeConnection",
        connectionId: action.connection.id,
        routeState: cloneStableRouteState(action.routeStateBefore),
        topology: cloneTopology(action.topologyBefore),
      };
    case "editConnectionRelation":
      return {
        kind: "replaceConnection",
        connection: cloneConnection(action.before),
      };
    case "deleteConnection":
      return {
        kind: "replaceConnection",
        connection: cloneConnection(action.connection),
        routeState: cloneStableRouteState(action.routeStateBefore),
        topology: cloneTopology(action.topologyBefore),
      };
    case "reverseConnection":
      return {
        kind: "replaceConnection",
        connection: cloneConnection(action.before),
        routeState: cloneStableRouteState(action.routeStateBefore),
        topology: cloneTopology(action.topologyBefore),
      };
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
      return {
        kind: "removeCard",
        cardId: action.entity.card.id,
        routeState: action.routeStateAfter
          ? cloneStableRouteState(action.routeStateAfter)
          : undefined,
        topology: cloneTopology(action.topologyAfter),
        nursingProblems: action.nursingProblemsAfter
          ? cloneNursingProblems(action.nursingProblemsAfter)
          : undefined,
      };
    case "setNursingProblemPriorities":
      return {
        kind: "restoreNursingProblems",
        nursingProblems: cloneNursingProblems(action.after),
      };
    case "editCard":
      return {
        kind: "applyCardEdit",
        cardId: action.cardId,
        text: action.after.text,
        state: action.after.state,
      };
    case "addConnection":
      return {
        kind: "addConnection",
        connection: cloneConnection(action.connection),
        routeState: cloneStableRouteState(action.routeStateAfter),
        topology: cloneTopology(action.topologyAfter),
      };
    case "editConnectionRelation":
      return {
        kind: "replaceConnection",
        connection: cloneConnection(action.after),
      };
    case "deleteConnection":
      return {
        kind: "removeConnection",
        connectionId: action.connection.id,
        routeState: cloneStableRouteState(action.routeStateAfter),
        topology: cloneTopology(action.topologyAfter),
      };
    case "reverseConnection":
      return {
        kind: "replaceConnection",
        connection: cloneConnection(action.after),
        routeState: cloneStableRouteState(action.routeStateAfter),
        topology: cloneTopology(action.topologyAfter),
      };
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
  if (command.kind === "applyCardEdit") {
    const card = graph.cards.find((row) => row.id === command.cardId);
    if (!card) return graph;
    return patchCardInGraph(graph, {
      ...card,
      text: command.text,
      state: command.state,
    });
  }
  if (command.kind === "restoreNursingProblems") {
    return restoreNursingProblemsExact(graph, command.nursingProblems);
  }
  if (command.kind === "insertCard") {
    const inserted = insertCardEntity(graph, cloneCardEntity(command.entity));
    const restored = restoreDeletedConnections(
      inserted,
      command.connections ?? [],
    );
    return command.nursingProblems
      ? restoreNursingProblemsExact(restored, command.nursingProblems)
      : restored;
  }
  if (command.kind === "addConnection") {
    const result = upsertConnection(graph, {
      id: command.connection.id,
      sourceCardId: command.connection.sourceCardId,
      targetCardId: command.connection.targetCardId,
      relationType: command.connection.relationType,
      origin: command.connection.origin,
      now: command.connection.createdAt,
    });
    return result.ok ? result.graph : graph;
  }
  if (command.kind === "removeConnection") {
    const result = deleteConnection(graph, command.connectionId);
    return result.ok ? result.graph : graph;
  }
  if (command.kind === "replaceConnection") {
    return replaceConnectionExact(graph, command.connection);
  }
  const removed = removeCardEntity(graph, command.cardId);
  return command.nursingProblems
    ? restoreNursingProblemsExact(removed, command.nursingProblems)
    : removed;
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
