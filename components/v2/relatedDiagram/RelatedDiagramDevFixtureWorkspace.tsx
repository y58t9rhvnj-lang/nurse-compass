"use client";

/**
 * DEV-only Slice 2A A3 workspace for iPad / LAN touch verification.
 * Uses the same viewport + surface + connection renderers as student runtime,
 * but loads resolveDevFixtureReadonlyScene (never used by student production path).
 * Positions stay in local React state. No draft persistence in Slice 2A.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  applySceneFragmentToGraph,
  emptyDiagramHistory,
  isTypingTarget,
  pushDiagramHistory,
  redoDiagramHistory,
  undoDiagramHistory,
  type DiagramHistory,
  type DiagramHistoryAction,
} from "@/lib/v2/relatedDiagram/diagramHistory";
import {
  seedStableRouteState,
  type StableRouteState,
} from "@/lib/v2/relatedDiagram/incrementalRoutes";
import { resolveDevFixtureReadonlyScene } from "@/lib/v2/relatedDiagram/resolveReadonlyScene";
import type { RelatedDiagramRouteTopology } from "@/lib/v2/relatedDiagram/routeTopology";
import type { RelatedDiagramSemanticGraph } from "@/lib/v2/relatedDiagram/types";
import RelatedDiagramA3Surface from "./RelatedDiagramA3Surface";
import RelatedDiagramPrintPortal, {
  prepareRelatedDiagramPrint,
} from "./RelatedDiagramPrintPortal";
import RelatedDiagramWorkspaceToolbar from "./RelatedDiagramWorkspaceToolbar";
import { useA3Viewport } from "./useA3Viewport";
import { useCardInteraction } from "./useCardInteraction";

export default function RelatedDiagramDevFixtureWorkspace() {
  const { viewportRef, transform, fitToView, resetTo100, percent } =
    useA3Viewport();

  const scene = useMemo(
    () => resolveDevFixtureReadonlyScene({ includeStyleDemo: true }),
    [],
  );
  const [routeDebug, setRouteDebug] = useState(false);
  const [routeCost, setRouteCost] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setRouteDebug(
      params.get("rdDebug") === "1" || params.get("rdRouteDebug") === "1",
    );
    setRouteCost(params.get("rdRouteCost") === "1");
  }, []);
  const [graph, setGraph] = useState<RelatedDiagramSemanticGraph>(scene.graph);
  const [topology, setTopology] = useState<
    RelatedDiagramRouteTopology | undefined
  >(scene.routeTopology);
  const [routeState, setRouteState] = useState<StableRouteState>(() =>
    seedStableRouteState(
      scene.graph.cards,
      scene.graph.connections,
      scene.routeTopology,
    ),
  );
  const onGraphChange = useCallback((next: RelatedDiagramSemanticGraph) => {
    setGraph(next);
  }, []);
  const onTopologyChange = useCallback((next: RelatedDiagramRouteTopology) => {
    setTopology(next);
  }, []);
  const onRouteStateChange = useCallback((next: StableRouteState) => {
    setRouteState(next);
  }, []);
  const [history, setHistory] = useState<DiagramHistory>(emptyDiagramHistory);
  const onHistoryPush = useCallback((action: DiagramHistoryAction) => {
    setHistory((prev) => pushDiagramHistory(prev, action));
  }, []);
  const applyFragment = useCallback(
    (fragment: NonNullable<ReturnType<typeof undoDiagramHistory>["fragment"]>) => {
      setGraph((prev) => applySceneFragmentToGraph(prev, fragment));
      setRouteState(fragment.routeState);
      if (fragment.topology) setTopology(fragment.topology);
    },
    [],
  );
  const handleUndo = useCallback(() => {
    const next = undoDiagramHistory(history);
    if (!next.fragment) return;
    applyFragment(next.fragment);
    setHistory(next.history);
  }, [applyFragment, history]);
  const handleRedo = useCallback(() => {
    const next = redoDiagramHistory(history);
    if (!next.fragment) return;
    applyFragment(next.fragment);
    setHistory(next.history);
  }, [applyFragment, history]);

  const {
    selectedCardId,
    selectedGroup,
    draggingCardId,
    onCardPointerDown,
    onCardPointerMove,
    onCardPointerUp,
    onGroupHandlePointerDown,
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

  const handlePrint = () => {
    prepareRelatedDiagramPrint();
    window.print();
  };

  return (
    <main
      data-rd-workspace="dev-fixture"
      data-rd-source="dev_fixture"
      className="relative flex h-[100dvh] min-h-0 min-w-0 flex-col overflow-hidden bg-[#EDEDF0]"
    >
      <RelatedDiagramWorkspaceToolbar
        percent={percent}
        onReset100={resetTo100}
        onFit={fitToView}
        onPrint={handlePrint}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={history.past.length > 0}
        canRedo={history.future.length > 0}
        title="Related Diagram Slice 2A · DEV fixture"
        subtitle={`${scene.knowledgeTitle} · ${scene.knowledgeVersion} · local drag only · not student runtime`}
      />

      <div
        ref={viewportRef}
        data-rd-viewport
        className="relative z-0 min-h-0 flex-1 touch-none overflow-hidden bg-[#D1D1D6]/55"
        style={{ touchAction: "none" }}
      >
        <div
          data-rd-canvas-transform
          className="origin-top-left will-change-transform"
          style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          }}
        >
          <RelatedDiagramA3Surface
            graph={graph}
            knowledgeLabel={scene.knowledgeTitle}
            routeTopology={topology}
            stableRouteState={routeState}
            interactive
            selectedCardId={selectedCardId}
            selectedGroup={selectedGroup}
            previewCardId={draggingCardId}
            onCardPointerDown={onCardPointerDown}
            onCardPointerMove={onCardPointerMove}
            onCardPointerUp={onCardPointerUp}
            onGroupHandlePointerDown={onGroupHandlePointerDown}
            onSurfacePointerDown={onSurfacePointerDown}
            routeDebug={routeDebug}
            routeCost={routeCost}
          />
        </div>
      </div>

      <RelatedDiagramPrintPortal>
        <div className="rd-print-root">
          <RelatedDiagramA3Surface
            graph={graph}
            knowledgeLabel={scene.knowledgeTitle}
            routeTopology={topology}
            stableRouteState={routeState}
          />
        </div>
      </RelatedDiagramPrintPortal>
    </main>
  );
}
