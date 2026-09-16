"use client";

/**
 * DEV-only Slice 2A / 2B-1 A3 workspace for iPad / LAN touch verification.
 * Uses the same viewport + surface + connection renderers as student runtime,
 * but loads resolveDevFixtureReadonlyScene (never used by student production path).
 * Positions stay in local React state. No draft persistence.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FORM3_PATTERN_ORDER, type Form3PatternKey } from "@/lib/form3/form3Types";
import { clientToLogical } from "@/lib/v2/relatedDiagram/a3PointerMath";
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
import {
  buildInformationCardFromForm3,
  buildUnderstandingCardFromAssessmentSelection,
  cardHasConnections,
  cloneCardEntity,
  form3SourceTrace,
  insertCardEntity,
  isForm3AssessmentSelectionAlreadyOnCanvas,
  isForm3InformationAlreadyOnCanvas,
  nextCardZIndex,
  originKeyFromCardSource,
  removeCardEntity,
} from "@/lib/v2/relatedDiagram/form3ToUnderstandingCard";
import { buildSchizophreniaForm3ReadModel } from "@/lib/v2/relatedDiagram/fixtures/form3AssessmentSourceFixture";
import {
  seedStableRouteState,
  type StableRouteState,
} from "@/lib/v2/relatedDiagram/incrementalRoutes";
import { placeForm3UnderstandingCard } from "@/lib/v2/relatedDiagram/placeForm3UnderstandingCard";
import { resolveDevFixtureReadonlyScene } from "@/lib/v2/relatedDiagram/resolveReadonlyScene";
import type { RelatedDiagramRouteTopology } from "@/lib/v2/relatedDiagram/routeTopology";
import type { RelatedDiagramSemanticGraph } from "@/lib/v2/relatedDiagram/types";
import type {
  RelatedDiagramForm3AssessmentSource,
  RelatedDiagramForm3InformationSource,
} from "@/lib/v2/relatedDiagram/form3AssessmentReadModel";
import type { NormalizedAssessmentSelection } from "@/lib/v2/relatedDiagram/form3AssessmentSelection";
import RelatedDiagramA3Surface from "./RelatedDiagramA3Surface";
import RelatedDiagramForm3Drawer, {
  type Form3DrawerMode,
} from "./RelatedDiagramForm3Drawer";
import RelatedDiagramForm3SourceTrace from "./RelatedDiagramForm3SourceTrace";
import RelatedDiagramPrintPortal, {
  prepareRelatedDiagramPrint,
} from "./RelatedDiagramPrintPortal";
import RelatedDiagramWorkspaceToolbar from "./RelatedDiagramWorkspaceToolbar";
import { useA3Viewport } from "./useA3Viewport";
import { useCardInteraction } from "./useCardInteraction";

export default function RelatedDiagramDevFixtureWorkspace() {
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
  const form3Model = useMemo(() => buildSchizophreniaForm3ReadModel(), []);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedPatternId, setSelectedPatternId] = useState<Form3PatternKey>(
    FORM3_PATTERN_ORDER[0]!,
  );
  const [drawerMode, setDrawerMode] = useState<Form3DrawerMode>("information");
  const [focusedAssessmentId, setFocusedAssessmentId] = useState<string | null>(
    null,
  );
  const [focusedInformationId, setFocusedInformationId] = useState<string | null>(
    null,
  );
  const [highlightRange, setHighlightRange] = useState<{
    start: number;
    end: number;
  } | null>(null);

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
    if (next.command.kind === "none") return;
    if (next.command.kind === "applyFragment") {
      applyFragment(next.command.fragment);
    } else {
      setGraph((prev) => applyHistoryCommand(prev, next.command));
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
    }
    setHistory(next.history);
  }, [applyFragment, history]);

  const {
    selectedCardId,
    selectedGroup,
    draggingCardId,
    selectCard,
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

  const addedOriginKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const source of graph.cardSources) {
      const key = originKeyFromCardSource(source);
      if (key) keys.add(key);
    }
    return keys;
  }, [graph.cardSources]);

  const viewportCenter = useCallback(() => {
    const viewport = viewportElRef.current;
    if (!viewport) return undefined;
    const rect = viewport.getBoundingClientRect();
    return clientToLogical(
      { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
      { x: rect.left, y: rect.top },
      transform,
    );
  }, [transform]);

  const selectedForm3Source = useMemo(() => {
    if (!selectedCardId) return null;
    const trace = form3SourceTrace(graph, selectedCardId);
    if (!trace) return null;
    const pattern = form3Model.patterns.find(
      (row) => row.patternId === trace.patternId,
    );
    return {
      cardId: selectedCardId,
      kind: trace.kind,
      originLabel: trace.originLabel,
      soType: trace.soType,
      patternId: trace.patternId,
      patternName: pattern?.patternName ?? trace.patternId,
      assessmentId: trace.assessmentId,
      informationId: trace.informationId,
      selectionStart: trace.selectionStart,
      selectionEnd: trace.selectionEnd,
      cardState: trace.cardState,
      selectedText: trace.selectedText,
      cardText: trace.cardText,
      hasConnections: cardHasConnections(graph, selectedCardId),
    };
  }, [form3Model.patterns, graph, selectedCardId]);

  const handleAddInformation = useCallback(
    (source: RelatedDiagramForm3InformationSource) => {
      if (isForm3InformationAlreadyOnCanvas(graph, source)) return;
      const placed = placeForm3UnderstandingCard({
        desiredCenter: viewportCenter(),
        otherCards: graph.cards,
      });
      const entity = buildInformationCardFromForm3({
        source,
        viewedPatternId: selectedPatternId,
        layout: {
          x: placed.x,
          y: placed.y,
          zIndex: nextCardZIndex(graph),
        },
      });
      setGraph(insertCardEntity(graph, entity));
      onHistoryPush({ type: "addCard", entity: cloneCardEntity(entity) });
      selectCard(entity.card.id);
    },
    [graph, onHistoryPush, selectCard, selectedPatternId, viewportCenter],
  );

  const handleAddAssessmentSelection = useCallback(
    (
      source: RelatedDiagramForm3AssessmentSource,
      selection: NormalizedAssessmentSelection,
      compose: { editedText: string; state: "current" | "potential" },
    ) => {
      if (
        isForm3AssessmentSelectionAlreadyOnCanvas(graph, {
          form3RecordId: source.form3RecordId,
          assessmentId: source.assessmentId,
          selectionStart: selection.selectionStart,
          selectionEnd: selection.selectionEnd,
        })
      ) {
        return;
      }
      const placed = placeForm3UnderstandingCard({
        desiredCenter: viewportCenter(),
        otherCards: graph.cards,
      });
      const entity = buildUnderstandingCardFromAssessmentSelection({
        source,
        selection,
        editedText: compose.editedText,
        state: compose.state,
        layout: {
          x: placed.x,
          y: placed.y,
          zIndex: nextCardZIndex(graph),
        },
      });
      setGraph(insertCardEntity(graph, entity));
      onHistoryPush({ type: "addCard", entity: cloneCardEntity(entity) });
      selectCard(entity.card.id);
    },
    [graph, onHistoryPush, selectCard, viewportCenter],
  );

  const handleDeleteSelected = useCallback(() => {
    if (!selectedForm3Source) return;
    if (selectedForm3Source.hasConnections) return;
    const card = graph.cards.find((row) => row.id === selectedForm3Source.cardId);
    if (!card) return;
    const entity = cloneCardEntity({
      card,
      sources: graph.cardSources.filter(
        (row) => row.cardId === selectedForm3Source.cardId,
      ),
    });
    setGraph(removeCardEntity(graph, selectedForm3Source.cardId));
    onHistoryPush({ type: "deleteCard", entity });
    selectCard(null);
  }, [graph, onHistoryPush, selectCard, selectedForm3Source]);

  const handleOpenSource = useCallback(() => {
    if (!selectedForm3Source?.patternId) return;
    setSelectedPatternId(selectedForm3Source.patternId as Form3PatternKey);
    setDrawerMode(selectedForm3Source.kind);
    setFocusedAssessmentId(selectedForm3Source.assessmentId);
    setFocusedInformationId(selectedForm3Source.informationId);
    setHighlightRange(
      selectedForm3Source.kind === "assessment" &&
        selectedForm3Source.selectionStart != null &&
        selectedForm3Source.selectionEnd != null
        ? {
            start: selectedForm3Source.selectionStart,
            end: selectedForm3Source.selectionEnd,
          }
        : null,
    );
    setDrawerOpen(true);
  }, [selectedForm3Source]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      if (event.key !== "Backspace" && event.key !== "Delete") return;
      if (!selectedForm3Source || selectedForm3Source.hasConnections) return;
      event.preventDefault();
      handleDeleteSelected();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleDeleteSelected, selectedForm3Source]);

  return (
    <main
      data-rd-workspace="dev-fixture"
      data-rd-source="dev_fixture"
      data-rd-slice="2b1"
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
        title="Related Diagram Slice 2B-1 · DEV fixture"
        subtitle={`${scene.knowledgeTitle} · ${scene.knowledgeVersion} · Form3 read-only · not student runtime`}
        leading={
          <button
            type="button"
            data-rd-form3-open
            aria-label="様式3"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen((open) => !open)}
            className="inline-flex min-h-[44px] items-center rounded-lg border border-[#E5E5EA] px-3 text-[14px] text-[#1D1D1F]"
          >
            様式3
          </button>
        }
      />

      {selectedForm3Source ? (
        <RelatedDiagramForm3SourceTrace
          originLabel={selectedForm3Source.originLabel}
          patternName={selectedForm3Source.patternName}
          soType={selectedForm3Source.soType}
          cardState={selectedForm3Source.cardState}
          selectedText={selectedForm3Source.selectedText}
          cardText={selectedForm3Source.cardText}
          canDelete={!selectedForm3Source.hasConnections}
          deleteBlockedReason={
            selectedForm3Source.hasConnections
              ? "接続を解除してから削除してください"
              : null
          }
          onOpenSource={handleOpenSource}
          onDelete={handleDeleteSelected}
        />
      ) : null}

      <div className="relative min-h-0 flex-1">
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
      <RelatedDiagramForm3Drawer
        open={drawerOpen}
        model={form3Model}
        selectedPatternId={selectedPatternId}
        mode={drawerMode}
        focusedAssessmentId={focusedAssessmentId}
        focusedInformationId={focusedInformationId}
        highlightStart={highlightRange?.start}
        highlightEnd={highlightRange?.end}
        addedOriginKeys={addedOriginKeys}
        onClose={() => setDrawerOpen(false)}
        onSelectPattern={setSelectedPatternId}
        onSelectMode={setDrawerMode}
        onAddInformation={handleAddInformation}
        onAddAssessmentSelection={handleAddAssessmentSelection}
      />
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
