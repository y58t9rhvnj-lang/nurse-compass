"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { A3_HEIGHT_PX, A3_WIDTH_PX } from "@/lib/v2/relatedDiagram/a3Canvas";
import {
  resolveCardDropCollision,
  resolveGroupDropCollision,
} from "@/lib/v2/relatedDiagram/cardCollision";
import {
  applyCardPositionToGraph,
  applyEscape,
  applyPointerDownOnBlank,
  applyPointerDownOnCard,
  applySelectCard,
  applyPointerDownOnGroupHandle,
  applyPointerMove,
  applyPointerUp,
  applySecondTouch,
  applyViewportGestureEnd,
  createIdleState,
  isCardLayoutMovable,
  isRelatedDiagramInteractionTarget,
  type CardInteractionState,
  type DragCommit,
} from "@/lib/v2/relatedDiagram/cardInteractionState";
import {
  captureSceneFragment,
  fragmentsEqual,
  type DiagramHistoryAction,
} from "@/lib/v2/relatedDiagram/diagramHistory";
import {
  applyIncrementalCardMove,
  applyIncrementalGroupMove,
  type StableRouteState,
} from "@/lib/v2/relatedDiagram/incrementalRoutes";
import {
  applyKnowledgeGroupDelta,
  knowledgeCardsOf,
  knowledgeGroupBounds,
} from "@/lib/v2/relatedDiagram/knowledgeGroupLayout";
import { translateKnowledgeTopology } from "@/lib/v2/relatedDiagram/regenerateRouteTopology";
import type { RelatedDiagramRouteTopology } from "@/lib/v2/relatedDiagram/routeTopology";
import type {
  RelatedDiagramCard,
  RelatedDiagramSemanticGraph,
} from "@/lib/v2/relatedDiagram/types";

export function useCardInteraction({
  enabled,
  graph,
  onGraphChange,
  scale,
  topology,
  routeState,
  onTopologyChange,
  onRouteStateChange,
  onHistoryPush,
}: {
  enabled: boolean;
  graph: RelatedDiagramSemanticGraph;
  onGraphChange: (graph: RelatedDiagramSemanticGraph) => void;
  scale: number;
  topology?: RelatedDiagramRouteTopology;
  routeState?: StableRouteState;
  onTopologyChange?: (
    topology: RelatedDiagramRouteTopology,
    context: {
      cards: RelatedDiagramCard[];
      connections: RelatedDiagramSemanticGraph["connections"];
    },
  ) => void;
  onRouteStateChange?: (state: StableRouteState) => void;
  onHistoryPush?: (action: DiagramHistoryAction) => void;
}) {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState(false);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [draggingGroup, setDraggingGroup] = useState(false);

  const machineRef = useRef<CardInteractionState>(createIdleState());
  const graphRef = useRef(graph);
  graphRef.current = graph;
  const topologyRef = useRef(topology);
  topologyRef.current = topology;
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const routeStateRef = useRef(routeState);
  routeStateRef.current = routeState;
  const captureElRef = useRef<HTMLElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingClientRef = useRef<{ x: number; y: number } | null>(null);
  const touchIdsRef = useRef<Set<number>>(new Set());
  const groupStartGraphRef = useRef<RelatedDiagramSemanticGraph | null>(null);
  const groupStartTopologyRef = useRef<RelatedDiagramRouteTopology | null>(null);
  const groupStartRouteStateRef = useRef<StableRouteState | null>(null);

  const publishMachine = useCallback((next: CardInteractionState) => {
    machineRef.current = next;
    setSelectedCardId(next.selectedCardId);
    setSelectedGroup(next.selectedGroup);
    setDraggingCardId(
      next.phase === "CARD_DRAGGING" ? next.selectedCardId : null,
    );
    setDraggingGroup(next.phase === "GROUP_DRAGGING");
  }, []);

  const applyCommit = useCallback(
    (commit: DragCommit | null, finalizeDrop: boolean) => {
      if (!commit) return;
      if (commit.kind === "group") {
        const startGraph = groupStartGraphRef.current ?? graphRef.current;
        const startTopo = groupStartTopologyRef.current ?? topologyRef.current;
        const bbox = knowledgeGroupBounds(startGraph.cards);
        if (!bbox) return;
        const delta = finalizeDrop
          ? resolveGroupDropCollision({
              groupBounds: bbox,
              desiredDelta: { dx: commit.dx, dy: commit.dy },
              externalCards: startGraph.cards.filter(
                (c) => c.cardType !== "knowledge",
              ),
            })
          : { dx: commit.dx, dy: commit.dy };
        const nextGraph = applyKnowledgeGroupDelta(startGraph, delta.dx, delta.dy);
        onGraphChange(nextGraph);
        const nextTopo = startTopo
          ? translateKnowledgeTopology(
              startTopo,
              startGraph.connections,
              startGraph.cards,
              delta.dx,
              delta.dy,
            )
          : undefined;
        if (nextTopo && onTopologyChange) {
          onTopologyChange(nextTopo, {
            cards: nextGraph.cards,
            connections: nextGraph.connections,
          });
        }
        const startRoutes =
          groupStartRouteStateRef.current ?? routeStateRef.current;
        let nextRoutes = startRoutes;
        if (startRoutes && onRouteStateChange) {
          const moved = applyIncrementalGroupMove({
            previous: startRoutes,
            startCards: startGraph.cards,
            cards: nextGraph.cards,
            connections: nextGraph.connections,
            topology: nextTopo,
            dx: delta.dx,
            dy: delta.dy,
          });
          nextRoutes = moved.state;
          onRouteStateChange(moved.state);
        }
        if (finalizeDrop && onHistoryPush && startRoutes && nextRoutes) {
          const ids = knowledgeCardsOf(startGraph.cards).map((c) => c.id);
          const before = captureSceneFragment({
            cards: startGraph.cards,
            cardIds: ids,
            routeState: startRoutes,
            topology: startTopo,
          });
          const after = captureSceneFragment({
            cards: nextGraph.cards,
            cardIds: ids,
            routeState: nextRoutes,
            topology: nextTopo ?? startTopo,
          });
          if (!fragmentsEqual(before, after)) {
            onHistoryPush({
              type: "moveGroup",
              cardIds: ids,
              before,
              after,
            });
          }
        }
        return;
      }
      const card = graphRef.current.cards.find((c) => c.id === commit.cardId);
      if (!card || !isCardLayoutMovable(card)) return;
      const nextPos = finalizeDrop
        ? resolveCardDropCollision({
            movingCard: card,
            desiredPosition: { x: commit.x, y: commit.y },
            otherCards: graphRef.current.cards.filter((c) => c.id !== card.id),
            lastLegal: {
              x: machineRef.current.originX,
              y: machineRef.current.originY,
            },
          }).position
        : { x: commit.x, y: commit.y };
      const nextGraph =
        card.layout.x === nextPos.x && card.layout.y === nextPos.y
          ? graphRef.current
          : applyCardPositionToGraph(
              graphRef.current,
              commit.cardId,
              nextPos.x,
              nextPos.y,
            );
      if (nextGraph !== graphRef.current) {
        onGraphChange(nextGraph);
      }
      if (!finalizeDrop || !routeStateRef.current || !onRouteStateChange) {
        return;
      }
      const beforeState = routeStateRef.current;
      const beforeTopo = topologyRef.current;
      const moved = applyIncrementalCardMove({
        previous: beforeState,
        cards: nextGraph.cards,
        connections: nextGraph.connections,
        topology: beforeTopo,
        movedCardId: commit.cardId,
      });
      onRouteStateChange(moved.state);
      if (moved.topology && onTopologyChange) {
        onTopologyChange(moved.topology, {
          cards: nextGraph.cards,
          connections: nextGraph.connections,
        });
      }
      if (onHistoryPush) {
        const originCards = nextGraph.cards.map((c) =>
          c.id === commit.cardId
            ? {
                ...c,
                layout: {
                  ...c.layout,
                  x: machineRef.current.originX,
                  y: machineRef.current.originY,
                },
              }
            : c,
        );
        const before = captureSceneFragment({
          cards: originCards,
          cardIds: [commit.cardId],
          routeState: beforeState,
          topology: beforeTopo,
        });
        const after = captureSceneFragment({
          cards: nextGraph.cards,
          cardIds: [commit.cardId],
          routeState: moved.state,
          topology: moved.topology ?? beforeTopo,
        });
        if (!fragmentsEqual(before, after)) {
          onHistoryPush({
            type: "moveCard",
            cardIds: [commit.cardId],
            before,
            after,
          });
        }
      }
    },
    [onGraphChange, onHistoryPush, onRouteStateChange, onTopologyChange],
  );

  const releaseCapture = useCallback(() => {
    const el = captureElRef.current;
    const pointerId = machineRef.current.pointerId;
    if (el && pointerId != null && el.hasPointerCapture?.(pointerId)) {
      el.releasePointerCapture(pointerId);
    }
    captureElRef.current = null;
  }, []);

  const clearRouteBase = useCallback(() => {
    groupStartGraphRef.current = null;
    groupStartTopologyRef.current = null;
    groupStartRouteStateRef.current = null;
  }, []);

  const flushMove = useCallback(() => {
    rafRef.current = null;
    const pending = pendingClientRef.current;
    if (!pending) return;
    pendingClientRef.current = null;
    const prev = machineRef.current;
    if (prev.pointerId == null) return;
    const next = applyPointerMove(prev, {
      pointerId: prev.pointerId,
      clientX: pending.x,
      clientY: pending.y,
      scale: scaleRef.current,
      canvasWidth: A3_WIDTH_PX,
      canvasHeight: A3_HEIGHT_PX,
    });
    publishMachine(next);
    if (next.phase === "CARD_DRAGGING" && next.selectedCardId) {
      applyCommit(
        {
          kind: "card",
          cardId: next.selectedCardId,
          x: next.currentX,
          y: next.currentY,
        },
        false,
      );
    }
    if (next.phase === "GROUP_DRAGGING") {
      if (!groupStartGraphRef.current) {
        groupStartGraphRef.current = graphRef.current;
        groupStartTopologyRef.current = topologyRef.current ?? null;
        groupStartRouteStateRef.current = routeStateRef.current ?? null;
      }
      applyCommit(
        { kind: "group", dx: next.currentX, dy: next.currentY },
        false,
      );
    }
  }, [applyCommit, publishMachine]);

  const onCardPointerDown = useCallback(
    (card: RelatedDiagramCard, event: ReactPointerEvent<HTMLElement>) => {
      if (!enabled) return;
      if (machineRef.current.phase === "VIEWPORT_GESTURE") return;
      if (
        machineRef.current.pointerId != null &&
        event.pointerId !== machineRef.current.pointerId
      ) {
        return;
      }
      if (event.cancelable) event.preventDefault();
      const next = applyPointerDownOnCard(machineRef.current, {
        cardId: card.id,
        movable: isCardLayoutMovable(card),
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        clientX: event.clientX,
        clientY: event.clientY,
        originX: card.layout.x,
        originY: card.layout.y,
        cardWidth: card.layout.width,
        cardHeight: card.layout.height,
      });
      publishMachine(next);
      captureElRef.current = event.currentTarget;
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [enabled, publishMachine],
  );

  const onGroupHandlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!enabled) return;
      if (machineRef.current.phase === "VIEWPORT_GESTURE") return;
      const bbox = knowledgeGroupBounds(graphRef.current.cards);
      if (!bbox) return;
      if (event.cancelable) event.preventDefault();
      event.stopPropagation();
      const next = applyPointerDownOnGroupHandle(machineRef.current, {
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        clientX: event.clientX,
        clientY: event.clientY,
        bboxX: bbox.x,
        bboxY: bbox.y,
        bboxWidth: bbox.width,
        bboxHeight: bbox.height,
      });
      publishMachine(next);
      captureElRef.current = event.currentTarget;
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [enabled, publishMachine],
  );

  const onCardPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!enabled) return;
      if (machineRef.current.pointerId !== event.pointerId) return;
      if (machineRef.current.phase === "VIEWPORT_GESTURE") return;
      pendingClientRef.current = { x: event.clientX, y: event.clientY };
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(flushMove);
      }
    },
    [enabled, flushMove],
  );

  const onCardPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!enabled) return;
      const current = machineRef.current;
      if (current.pointerId !== event.pointerId) return;
      const result = applyPointerUp(current, { pointerId: event.pointerId });
      applyCommit(result.drop, true);
      releaseCapture();
      clearRouteBase();
      publishMachine(result.state);
    },
    [applyCommit, clearRouteBase, enabled, publishMachine, releaseCapture],
  );

  const onSurfacePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!enabled) return;
      if (isRelatedDiagramInteractionTarget(event.target)) return;
      if (machineRef.current.phase === "VIEWPORT_GESTURE") return;
      if (
        machineRef.current.phase === "CARD_DRAGGING" ||
        machineRef.current.phase === "GROUP_DRAGGING"
      ) {
        return;
      }
      publishMachine(applyPointerDownOnBlank(machineRef.current));
    },
    [enabled, publishMachine],
  );

  useEffect(() => {
    if (!enabled) return;
    const draggingPhases = new Set([
      "CARD_SELECTED",
      "CARD_DRAGGING",
      "GROUP_SELECTED",
      "GROUP_DRAGGING",
    ]);
    const onWindowPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "touch") {
        touchIdsRef.current.add(event.pointerId);
      }
      const current = machineRef.current;
      if (
        event.pointerType === "touch" &&
        current.pointerId != null &&
        event.pointerId !== current.pointerId &&
        draggingPhases.has(current.phase)
      ) {
        const handoff = applySecondTouch(current);
        applyCommit(handoff.commit, true);
        releaseCapture();
        clearRouteBase();
        publishMachine(handoff.state);
      }
    };
    const onWindowPointerUp = (event: PointerEvent) => {
      if (event.pointerType === "touch") {
        touchIdsRef.current.delete(event.pointerId);
      }
      if (
        machineRef.current.phase === "VIEWPORT_GESTURE" &&
        touchIdsRef.current.size === 0
      ) {
        publishMachine(applyViewportGestureEnd(machineRef.current));
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const result = applyEscape(machineRef.current);
      applyCommit(result.drop, true);
      releaseCapture();
      clearRouteBase();
      publishMachine(result.state);
    };
    window.addEventListener("pointerdown", onWindowPointerDown, true);
    window.addEventListener("pointerup", onWindowPointerUp, true);
    window.addEventListener("pointercancel", onWindowPointerUp, true);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onWindowPointerDown, true);
      window.removeEventListener("pointerup", onWindowPointerUp, true);
      window.removeEventListener("pointercancel", onWindowPointerUp, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [applyCommit, clearRouteBase, enabled, publishMachine, releaseCapture]);

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const selectCard = useCallback(
    (cardId: string | null) => {
      publishMachine(applySelectCard(machineRef.current, cardId));
    },
    [publishMachine],
  );

  return {
    selectedCardId,
    selectedGroup,
    draggingCardId,
    draggingGroup,
    selectCard,
    onCardPointerDown,
    onCardPointerMove,
    onCardPointerUp,
    onGroupHandlePointerDown,
    onSurfacePointerDown,
  };
}
