"use client";

/**
 * DEV ONLY — Route Editing Demo Patient workspace.
 * Daily Manual Route Editing check. Not Patient A. No Junction. No Form3 write-back.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cardScreenRect } from "@/lib/v2/relatedDiagram/actionPopoverPlacement";
import { A3_HEIGHT_PX, A3_WIDTH_PX } from "@/lib/v2/relatedDiagram/a3Canvas";
import {
  ROUTE_EDITING_DEMO_KIND,
  buildRouteEditingDemoPatient,
} from "@/lib/v2/relatedDiagram/buildRouteEditingDemoPatient";
import { getCardActionCapabilities } from "@/lib/v2/relatedDiagram/cardActionCapabilities";
import {
  applyHistoryCommand,
  applySceneFragmentToGraph,
  emptyDiagramHistory,
  isTypingTarget,
  pushDiagramHistory,
  redoDiagramHistory,
  undoDiagramHistory,
  type DiagramHistory,
  type DiagramHistoryAction,
} from "@/lib/v2/relatedDiagram/diagramHistory";
import { selectedCardIdFromSelection } from "@/lib/v2/relatedDiagram/diagramSelection";
import {
  truncateContextTitle,
  type ContextBarModel,
} from "@/lib/v2/relatedDiagram/editorContextBar";
import {
  seedInitialAutoRouteState,
  type StableRouteState,
} from "@/lib/v2/relatedDiagram/incrementalRoutes";
import type { RelatedDiagramRouteTopology } from "@/lib/v2/relatedDiagram/routeTopology";
import type { RelatedDiagramSemanticGraph } from "@/lib/v2/relatedDiagram/types";
import RelatedDiagramA3Surface from "./RelatedDiagramA3Surface";
import RelatedDiagramActionPopover from "./RelatedDiagramActionPopover";
import RelatedDiagramContextBar from "./RelatedDiagramContextBar";
import RelatedDiagramEditorToolbar from "./RelatedDiagramEditorToolbar";
import { useA3Viewport } from "./useA3Viewport";
import { useCardInteraction } from "./useCardInteraction";
import { useConnectionRouteInteraction } from "./useConnectionRouteInteraction";

export default function RelatedDiagramRouteEditingDemoWorkspace() {
  const scene = useMemo(() => buildRouteEditingDemoPatient(), []);
  const {
    viewportRef: setViewportEl,
    transform,
    fitToView,
    resetTo100,
    percent,
  } = useA3Viewport();
  const viewportElRef = useRef<HTMLElement | null>(null);
  const viewportRef = useCallback(
    (el: HTMLElement | null) => {
      viewportElRef.current = el;
      setViewportEl(el);
    },
    [setViewportEl],
  );

  const [graph, setGraph] = useState<RelatedDiagramSemanticGraph>(scene.graph);
  const [topology, setTopology] = useState<RelatedDiagramRouteTopology | undefined>(
    scene.topology,
  );
  const [routeState, setRouteState] = useState<StableRouteState>(() =>
    seedInitialAutoRouteState(
      scene.graph.cards,
      scene.graph.connections,
      scene.topology,
    ),
  );
  const [history, setHistory] = useState<DiagramHistory>(emptyDiagramHistory);

  const onGraphChange = useCallback((next: RelatedDiagramSemanticGraph) => {
    setGraph(next);
  }, []);
  const onTopologyChange = useCallback(
    (next: RelatedDiagramRouteTopology | undefined) => {
      setTopology(next);
    },
    [],
  );
  const onRouteStateChange = useCallback((next: StableRouteState) => {
    setRouteState(next);
  }, []);
  const onHistoryPush = useCallback((action: DiagramHistoryAction) => {
    setHistory((prev) => pushDiagramHistory(prev, action));
  }, []);

  const applyFragment = useCallback(
    (fragment: NonNullable<ReturnType<typeof undoDiagramHistory>["fragment"]>) => {
      setGraph((prev) => applySceneFragmentToGraph(prev, fragment));
      setRouteState(fragment.routeState);
      setTopology(fragment.topology);
    },
    [],
  );
  const handleUndo = useCallback(() => {
    const next = undoDiagramHistory(history);
    if (next.command.kind === "none") return;
    if (next.command.kind === "applyFragment") {
      applyFragment(next.command.fragment);
    } else {
      setGraph((prev) => applyHistoryCommand(prev, next.command));
      if ("routeState" in next.command && next.command.routeState) {
        setRouteState(next.command.routeState);
      }
      if ("topology" in next.command && next.command.topology) {
        setTopology(next.command.topology);
      }
    }
    setHistory(next.history);
  }, [applyFragment, history]);
  const handleRedo = useCallback(() => {
    const next = redoDiagramHistory(history);
    if (next.command.kind === "none") return;
    if (next.command.kind === "applyFragment") {
      applyFragment(next.command.fragment);
    } else {
      setGraph((prev) => applyHistoryCommand(prev, next.command));
      if ("routeState" in next.command && next.command.routeState) {
        setRouteState(next.command.routeState);
      }
      if ("topology" in next.command && next.command.topology) {
        setTopology(next.command.topology);
      }
    }
    setHistory(next.history);
  }, [applyFragment, history]);

  const {
    selectedCardId,
    draggingCardId,
    dragTransient,
    selectCard,
    onCardPointerDown,
    onCardPointerMove,
    onCardPointerUp,
    onSurfacePointerDown,
  } = useCardInteraction({
    enabled: true,
    graph,
    onGraphChange,
    scale: transform.scale,
    topology,
    routeState,
    onTopologyChange,
    onRouteStateChange,
    onHistoryPush,
  });

  const {
    selectedConnectionId,
    handleConnectionPointerDown,
    handleSurfacePointerDownGuard,
    clearConnectionSelection,
    routeEditPreview,
    diagramSelection,
  } = useConnectionRouteInteraction({
    graph,
    routeState,
    topology,
    selectedCardId,
    selectCard,
    draggingCardId,
    transform,
    viewportEl: () => viewportElRef.current,
    onRouteStateChange,
    onTopologyChange,
    onHistoryPush,
  });

  const selectedCard = useMemo(
    () =>
      graph.cards.find(
        (card) => card.id === selectedCardIdFromSelection(diagramSelection),
      ) ?? null,
    [diagramSelection, graph.cards],
  );
  const selectedCapabilities = useMemo(
    () => (selectedCard ? getCardActionCapabilities(selectedCard) : null),
    [selectedCard],
  );

  const handleSurfacePointerDownWrapped = useCallback(
    (event: Parameters<typeof onSurfacePointerDown>[0]) => {
      if (handleSurfacePointerDownGuard(event.target)) return;
      clearConnectionSelection();
      onSurfacePointerDown(event);
    },
    [clearConnectionSelection, handleSurfacePointerDownGuard, onSurfacePointerDown],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      const key = event.key.toLowerCase();
      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;
      if (key === "z" && event.shiftKey) {
        event.preventDefault();
        handleRedo();
        return;
      }
      if (key === "z") {
        event.preventDefault();
        handleUndo();
        return;
      }
      if (key === "y") {
        event.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleRedo, handleUndo]);

  useEffect(() => {
    const id = requestAnimationFrame(() => fitToView());
    return () => cancelAnimationFrame(id);
  }, [fitToView]);

  const contextBarModel: ContextBarModel =
    selectedCard && selectedCapabilities
      ? {
          kind: "card",
          cardId: selectedCard.id,
          title: truncateContextTitle(selectedCard.text),
          capabilities: {
            ...selectedCapabilities,
            canConnect: false,
            canDelete: false,
          },
          canOpenSource: false,
        }
      : { kind: "none" };

  return (
    <main
      data-rd-workspace="route-editing-demo"
      data-rd-source={ROUTE_EDITING_DEMO_KIND}
      className="fixed inset-0 flex min-h-0 min-w-0 flex-col overflow-hidden overscroll-none bg-[#EDEDF0]"
    >
      <RelatedDiagramEditorToolbar
        percent={percent}
        onReset100={resetTo100}
        onFit={fitToView}
        onPrint={() => undefined}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={history.past.length > 0}
        canRedo={history.future.length > 0}
        title="Route Editing Demo"
        caseLabel={`${scene.graph.cards.length} cards / ${scene.graph.connections.length} connections`}
        form3Open={false}
        onOpenForm3={() => undefined}
        onAddCard={() => undefined}
        onArrange={() => undefined}
        canArrange={false}
        showForm3={false}
        showAddCard={false}
        devTitle="DEV ONLY · Route Editing Demo · not Patient A · no Junction · no write-back"
      />
      <p
        data-rd-route-editing-demo-banner
        className="rd-no-print shrink-0 border-b border-[#E5E5EA] bg-[#F2F2F7] px-3 py-1 text-[11px] text-[#6E6E73]"
      >
        {scene.caseLabel} · 日常の Route Trace / Segment Drag 確認用 · Patient A は
        /dev/related-diagram-patient-a
      </p>
      <div
        data-rd-canvas-shell
        className="relative min-h-0 min-w-0 flex-1 overflow-hidden"
      >
        <div
          ref={viewportRef}
          data-rd-viewport
          className="relative z-0 h-full min-h-0 touch-none overflow-hidden bg-[#D1D1D6]/55"
          style={{ touchAction: "none" }}
        >
          <div
            data-rd-canvas-transform
            className="origin-top-left will-change-transform"
            style={{
              transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            }}
          >
            <div
              className="relative"
              style={{ width: A3_WIDTH_PX, height: A3_HEIGHT_PX }}
            >
              <RelatedDiagramA3Surface
                graph={graph}
                knowledgeLabel=""
                routeTopology={topology}
                stableRouteState={routeState}
                interactive
                selectedCardId={selectedCardId}
                selectedConnectionId={selectedConnectionId}
                dragTransient={dragTransient}
                routeEditPreview={routeEditPreview}
                onCardPointerDown={onCardPointerDown}
                onCardPointerMove={onCardPointerMove}
                onCardPointerUp={onCardPointerUp}
                onSurfacePointerDown={handleSurfacePointerDownWrapped}
                onConnectionPointerDown={handleConnectionPointerDown}
              />
            </div>
          </div>
        </div>
        {selectedCard && contextBarModel.kind === "card" && !draggingCardId ? (
          <RelatedDiagramActionPopover
            kind="card"
            anchor={cardScreenRect(
              selectedCard,
              {
                left: viewportElRef.current?.getBoundingClientRect().left ?? 0,
                top: viewportElRef.current?.getBoundingClientRect().top ?? 0,
              },
              transform,
            )}
            viewport={
              viewportElRef.current
                ? {
                    x: viewportElRef.current.getBoundingClientRect().left,
                    y: viewportElRef.current.getBoundingClientRect().top,
                    width: viewportElRef.current.getBoundingClientRect().width,
                    height: viewportElRef.current.getBoundingClientRect().height,
                  }
                : { x: 0, y: 0, width: 0, height: 0 }
            }
            estimatedSize={{ width: 220, height: 48 }}
            onDismiss={() => selectCard(null)}
          >
            <RelatedDiagramContextBar model={contextBarModel} />
          </RelatedDiagramActionPopover>
        ) : null}
      </div>
    </main>
  );
}
