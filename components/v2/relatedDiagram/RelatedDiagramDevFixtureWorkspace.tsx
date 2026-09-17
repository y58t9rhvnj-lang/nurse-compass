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
  cloneCardEntity,
  form3SourceTrace,
  insertCardEntity,
  isForm3AssessmentSelectionAlreadyOnCanvas,
  isForm3InformationAlreadyOnCanvas,
  nextCardZIndex,
  originKeyFromCardSource,
} from "@/lib/v2/relatedDiagram/form3ToUnderstandingCard";
import { buildSchizophreniaForm3ReadModel } from "@/lib/v2/relatedDiagram/fixtures/form3AssessmentSourceFixture";
import { placeForm3UnderstandingCard } from "@/lib/v2/relatedDiagram/placeForm3UnderstandingCard";
import { resolveDevFixtureReadonlyScene } from "@/lib/v2/relatedDiagram/resolveReadonlyScene";
import type { RelatedDiagramRouteTopology } from "@/lib/v2/relatedDiagram/routeTopology";
import { getCardActionCapabilities } from "@/lib/v2/relatedDiagram/cardActionCapabilities";
import { getCardSourceCapabilities } from "@/lib/v2/relatedDiagram/cardSourceCapabilities";
import type { ContextBarModel } from "@/lib/v2/relatedDiagram/editorContextBar";
import { resolveRelatedDiagramEditorMode } from "@/lib/v2/relatedDiagram/editorUiState";
import {
  incidentConnectionCount,
  incidentConnections,
  pruneStableRoutesForConnections,
  pruneTopologyForConnections,
  removeCardAndIncidentConnections,
  snapshotCardForDelete,
} from "@/lib/v2/relatedDiagram/cardDelete";
import {
  applyCardDisplayEdit,
  canCommitCardEdit,
  cardEditDraftFromCard,
  patchCardInGraph,
  type CardEditDraft,
} from "@/lib/v2/relatedDiagram/cardEdit";
import {
  createCardConnectIntent,
  createCardDeleteIntent,
  createCardEditIntent,
  type CardActionIntent,
} from "@/lib/v2/relatedDiagram/cardActionIntents";
import {
  cloneStableRouteState,
  seedStableRouteState,
  type StableRouteState,
} from "@/lib/v2/relatedDiagram/incrementalRoutes";
import {
  selectedCardIdFromSelection,
  selectionFromCardId,
} from "@/lib/v2/relatedDiagram/diagramSelection";
import type { RelatedDiagramSemanticGraph } from "@/lib/v2/relatedDiagram/types";
import type {
  RelatedDiagramForm3AssessmentSource,
  RelatedDiagramForm3InformationSource,
} from "@/lib/v2/relatedDiagram/form3AssessmentReadModel";
import type { NormalizedAssessmentSelection } from "@/lib/v2/relatedDiagram/form3AssessmentSelection";
import RelatedDiagramA3Surface from "./RelatedDiagramA3Surface";
import RelatedDiagramCardDeleteConfirm from "./RelatedDiagramCardDeleteConfirm";
import RelatedDiagramCardEditDrawer from "./RelatedDiagramCardEditDrawer";
import RelatedDiagramContextBar from "./RelatedDiagramContextBar";
import RelatedDiagramEditorToolbar from "./RelatedDiagramEditorToolbar";
import RelatedDiagramForm3Drawer, {
  type Form3DrawerMode,
} from "./RelatedDiagramForm3Drawer";
import RelatedDiagramPrintPortal, {
  prepareRelatedDiagramPrint,
} from "./RelatedDiagramPrintPortal";
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

  const diagramSelection = useMemo(
    () => selectionFromCardId(selectedCardId),
    [selectedCardId],
  );
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
  const [actionIntent, setActionIntent] = useState<CardActionIntent | null>(
    null,
  );
  const [editDraft, setEditDraft] = useState<CardEditDraft | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const editorMode = resolveRelatedDiagramEditorMode({
    selection: diagramSelection,
    form3Open: drawerOpen,
    editOpen: editDraft != null && actionIntent?.kind === "edit",
    connecting: actionIntent?.kind === "connect",
  });
  const selectedSourceCaps = selectedCard
    ? getCardSourceCapabilities(selectedCard)
    : null;
  const contextBarModel = ((): ContextBarModel => {
    if (actionIntent?.kind === "connect") {
      const source =
        graph.cards.find((card) => card.id === actionIntent.sourceCardId) ??
        selectedCard;
      return {
        kind: "connecting",
        sourceCardId: actionIntent.sourceCardId,
        sourceTitle: source?.text ?? "",
      };
    }
    if (selectedCard && selectedCapabilities) {
      return {
        kind: "card",
        cardId: selectedCard.id,
        title: selectedCard.text,
        capabilities: selectedCapabilities,
        canOpenSource: selectedSourceCaps?.canOpenSource === true,
        editDisabledReason:
          selectedCapabilities.editMode === "forbidden_original"
            ? "様式3の情報は原文のまま使用します"
            : null,
      };
    }
    return { kind: "none" };
  })();

  useEffect(() => {
    if (actionIntent?.kind === "connect") return;
    setActionIntent(null);
    setEditDraft(null);
    setDeleteConfirmOpen(false);
  }, [selectedCardId]);

  useEffect(() => {
    if (actionIntent?.kind !== "connect") return;
    if (selectedCardId !== actionIntent.sourceCardId) {
      selectCard(actionIntent.sourceCardId);
    }
  }, [actionIntent, selectCard, selectedCardId]);

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
    };
  }, [form3Model.patterns, graph, selectedCardId]);

  const focusContextAction = useCallback((action: string) => {
    requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(`[data-rd-context-action="${action}"]`)
        ?.focus();
    });
  }, []);

  const closeEditDrawer = useCallback(() => {
    setEditDraft(null);
    if (actionIntent?.kind === "edit") setActionIntent(null);
    focusContextAction("edit");
  }, [actionIntent, focusContextAction]);

  const closeForm3Drawer = useCallback(() => {
    setDrawerOpen(false);
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>("[data-rd-form3-open]")?.focus();
    });
  }, []);

  const openForm3Drawer = useCallback(() => {
    if (actionIntent?.kind === "connect") return;
    setEditDraft(null);
    if (actionIntent?.kind === "edit") setActionIntent(null);
    setDrawerOpen((open) => !open);
  }, [actionIntent]);

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

  const requestDeleteSelected = useCallback(() => {
    if (!selectedCard) return;
    const intent = createCardDeleteIntent(selectedCard);
    if (!intent) return;
    setActionIntent(intent);
    setDeleteConfirmOpen(true);
  }, [selectedCard]);

  const handleConfirmDelete = useCallback(() => {
    if (!selectedCard) return;
    const entity = snapshotCardForDelete(graph, selectedCard.id);
    if (!entity) return;
    const connections = incidentConnections(graph, selectedCard.id);
    const connectionIds = connections.map((row) => row.id);
    const routeStateBefore = cloneStableRouteState(routeState);
    const routeStateAfter = pruneStableRoutesForConnections(
      routeState,
      connectionIds,
    );
    const topologyBefore = topology;
    const topologyAfter = pruneTopologyForConnections(topology, connectionIds);
    setGraph(removeCardAndIncidentConnections(graph, selectedCard.id));
    setRouteState(routeStateAfter);
    if (topologyAfter) setTopology(topologyAfter);
    onHistoryPush({
      type: "deleteCard",
      entity,
      connections,
      routeStateBefore,
      routeStateAfter,
      topologyBefore,
      topologyAfter,
    });
    setDeleteConfirmOpen(false);
    setActionIntent(null);
    selectCard(null);
  }, [graph, onHistoryPush, routeState, selectCard, selectedCard, topology]);

  const handleCardEdit = useCallback(() => {
    if (!selectedCard) return;
    const intent = createCardEditIntent(selectedCard);
    if (!intent) return;
    setDrawerOpen(false);
    setActionIntent(intent);
    setEditDraft(cardEditDraftFromCard(selectedCard));
  }, [selectedCard]);

  const handleSaveCardEdit = useCallback(() => {
    if (!selectedCard || !editDraft) return;
    const nextCard = applyCardDisplayEdit(selectedCard, editDraft);
    if (!nextCard) return;
    if (
      nextCard.text === selectedCard.text &&
      nextCard.state === selectedCard.state
    ) {
      setEditDraft(null);
      setActionIntent(null);
      return;
    }
    setGraph(patchCardInGraph(graph, nextCard));
    onHistoryPush({
      type: "editCard",
      cardId: selectedCard.id,
      before: { text: selectedCard.text, state: selectedCard.state },
      after: { text: nextCard.text, state: nextCard.state },
    });
    setEditDraft(null);
    setActionIntent(null);
    focusContextAction("edit");
  }, [editDraft, focusContextAction, graph, onHistoryPush, selectedCard]);

  const handleCardConnect = useCallback(() => {
    if (!selectedCard) return;
    const intent = createCardConnectIntent(selectedCard);
    if (!intent) return;
    setDrawerOpen(false);
    setEditDraft(null);
    setActionIntent(intent);
  }, [selectedCard]);

  const handleCancelConnect = useCallback(() => {
    setActionIntent(null);
    focusContextAction("connect");
  }, [focusContextAction]);

  const handleOpenSource = useCallback(() => {
    if (actionIntent?.kind === "connect") return;
    if (!selectedForm3Source?.patternId) return;
    setEditDraft(null);
    if (actionIntent?.kind === "edit") setActionIntent(null);
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
  }, [actionIntent, selectedForm3Source]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      if (event.key !== "Backspace" && event.key !== "Delete") return;
      if (!selectedCard || !selectedCapabilities?.canDelete) return;
      event.preventDefault();
      requestDeleteSelected();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [requestDeleteSelected, selectedCapabilities, selectedCard]);

  return (
    <main
      data-rd-workspace="dev-fixture"
      data-rd-source="dev_fixture"
      data-rd-slice="2b1"
      data-rd-2b2a="true"
      data-rd-2b2b="true"
      data-rd-2b2c="true"
      data-rd-editor-mode={editorMode}
      data-rd-editor-selection={diagramSelection.kind}
      className="relative flex h-[100dvh] min-h-0 min-w-0 flex-col overflow-hidden bg-[#EDEDF0]"
    >
      <RelatedDiagramEditorToolbar
        percent={percent}
        onReset100={resetTo100}
        onFit={fitToView}
        onPrint={handlePrint}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={history.past.length > 0}
        canRedo={history.future.length > 0}
        title="関連図"
        caseLabel="統合失調症の事例"
        form3Open={drawerOpen}
        onOpenForm3={openForm3Drawer}
        onAddCardPlaceholder={() => {
          /* UI placeholder only — no Direct Card. */
        }}
        devTitle={`Slice 2B-2C · DEV fixture · ${scene.knowledgeTitle} · ${scene.knowledgeVersion} · not student runtime`}
      />

      <RelatedDiagramContextBar
        model={contextBarModel}
        onEdit={handleCardEdit}
        onConnect={handleCardConnect}
        onDelete={requestDeleteSelected}
        onOpenSource={handleOpenSource}
        onCancelConnect={handleCancelConnect}
      />

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
        onClose={closeForm3Drawer}
        onSelectPattern={setSelectedPatternId}
        onSelectMode={setDrawerMode}
        onAddInformation={handleAddInformation}
        onAddAssessmentSelection={handleAddAssessmentSelection}
      />
      {selectedCard && editDraft && actionIntent?.kind === "edit" ? (
        <RelatedDiagramCardEditDrawer
          editMode={actionIntent.editMode}
          draft={editDraft}
          canSave={canCommitCardEdit(selectedCard, editDraft)}
          onChangeText={(text) =>
            setEditDraft((current) =>
              current ? { ...current, text } : current,
            )
          }
          onChangeState={(state) =>
            setEditDraft((current) =>
              current ? { ...current, state } : current,
            )
          }
          onCancel={closeEditDrawer}
          onSave={handleSaveCardEdit}
        />
      ) : null}
      {deleteConfirmOpen && selectedCard ? (
        <RelatedDiagramCardDeleteConfirm
          incidentCount={incidentConnectionCount(graph, selectedCard.id)}
          onCancel={() => {
            setDeleteConfirmOpen(false);
            if (actionIntent?.kind === "delete") setActionIntent(null);
            focusContextAction("delete");
          }}
          onConfirm={handleConfirmDelete}
        />
      ) : null}
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
