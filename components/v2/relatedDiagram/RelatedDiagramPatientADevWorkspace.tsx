"use client";

/**
 * DEV ONLY — Patient A Form3 skeleton visualization.
 * READ ONLY SNAPSHOT. DO NOT WRITE BACK.
 * Does not load the schizophrenia demo fixture, Knowledge, or NP demo.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { A3_HEIGHT_PX, A3_WIDTH_PX } from "@/lib/v2/relatedDiagram/a3Canvas";
import {
  arrangeNoticeMessage,
  arrangeRelatedDiagramScene,
  arrangeRelatedDiagramUiLocked,
} from "@/lib/v2/relatedDiagram/applyRelatedDiagramLayout";
import { buildPatientAForm3Skeleton } from "@/lib/v2/relatedDiagram/buildPatientAForm3Skeleton";
import { buildPatientAStudentReconstruction } from "@/lib/v2/relatedDiagram/buildPatientAStudentReconstruction";
import {
  PATIENT_A_DEFAULT_CARD_SIZE_SCALE,
  applyPatientACardSizeScale,
  patientADevCardChrome,
  type PatientACardSizeScale,
} from "@/lib/v2/relatedDiagram/patientACardSizeExperiment";
import {
  arrangeThenReattachPatientAMergeJunctions,
  attachPatientAMergeJunctions,
} from "@/lib/v2/relatedDiagram/patientAMergeJunctionTopology";
import {
  PATIENT_A_DEV_UNINTEGRATED_POOL_LABEL,
  applyPatientAReasoningUnitLayout,
} from "@/lib/v2/relatedDiagram/layoutPatientAReasoningUnits";
import { getCardActionCapabilities } from "@/lib/v2/relatedDiagram/cardActionCapabilities";
import {
  applyCardDisplayEdit,
  canCommitCardEdit,
  cardEditDraftFromCard,
  type CardEditDraft,
} from "@/lib/v2/relatedDiagram/cardEdit";
import {
  createCardEditIntent,
  type CardActionIntent,
} from "@/lib/v2/relatedDiagram/cardActionIntents";
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
  truncateContextTitle,
  type ContextBarModel,
} from "@/lib/v2/relatedDiagram/editorContextBar";
import { seedInitialAutoRouteState, type StableRouteState } from "@/lib/v2/relatedDiagram/incrementalRoutes";
import {
  armCardTapSuppression,
  consumeSyntheticClickAfterDrag,
  idleTapSuppression,
  shouldArmClickSuppression,
  shouldRevealCardActionsAfterRelease,
  suppressionAfterPointerDown,
} from "@/lib/v2/relatedDiagram/cardTapGesture";
import type { RelatedDiagramRouteTopology } from "@/lib/v2/relatedDiagram/routeTopology";
import type { RelatedDiagramSemanticGraph } from "@/lib/v2/relatedDiagram/types";
import { cardScreenRect } from "@/lib/v2/relatedDiagram/actionPopoverPlacement";
import { selectedCardIdFromSelection } from "@/lib/v2/relatedDiagram/diagramSelection";
import RelatedDiagramA3Surface from "./RelatedDiagramA3Surface";
import RelatedDiagramActionPopover from "./RelatedDiagramActionPopover";
import RelatedDiagramCardEditDrawer from "./RelatedDiagramCardEditDrawer";
import RelatedDiagramContextBar from "./RelatedDiagramContextBar";
import RelatedDiagramEditorToolbar from "./RelatedDiagramEditorToolbar";
import { useConnectionRouteInteraction } from "./useConnectionRouteInteraction";
import RelatedDiagramPrintPortal, {
  prepareRelatedDiagramPrint,
} from "./RelatedDiagramPrintPortal";
import { useA3Viewport } from "./useA3Viewport";
import { useCardInteraction } from "./useCardInteraction";

export default function RelatedDiagramPatientADevWorkspace() {
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

  const reconstructionScene = useMemo(
    () => buildPatientAStudentReconstruction(),
    [],
  );
  const scatterScene = useMemo(() => buildPatientAForm3Skeleton(), []);
  const reasoningScene = useMemo(
    () => applyPatientAReasoningUnitLayout(scatterScene),
    [scatterScene],
  );
  const [layoutMode, setLayoutMode] = useState<
    "reconstruction" | "scatter" | "reasoning_unit"
  >("reconstruction");
  const [cardSizeScale, setCardSizeScale] = useState<PatientACardSizeScale>(
    PATIENT_A_DEFAULT_CARD_SIZE_SCALE,
  );
  const [junctionMode, setJunctionMode] = useState(false);
  const [graph, setGraph] = useState<RelatedDiagramSemanticGraph>(
    reconstructionScene.graph,
  );
  const [topology, setTopology] = useState<RelatedDiagramRouteTopology | undefined>(
    undefined,
  );
  const [routeState, setRouteState] = useState<StableRouteState>(() =>
    seedInitialAutoRouteState(
      reconstructionScene.graph.cards,
      reconstructionScene.graph.connections,
    ),
  );
  const [history, setHistory] = useState<DiagramHistory>(emptyDiagramHistory);
  const [revealCardActions, setRevealCardActions] = useState(true);
  const [actionIntent, setActionIntent] = useState<CardActionIntent | null>(
    null,
  );
  const [editDraft, setEditDraft] = useState<CardEditDraft | null>(null);
  const [arrangeNotice, setArrangeNotice] = useState<string | null>(null);
  const tapSuppressionRef = useRef(idleTapSuppression());
  const plainArrangeRouteStateRef = useRef<StableRouteState | null>(null);

  const graphForMode = useCallback(
    (
      mode: "reconstruction" | "scatter" | "reasoning_unit",
      scale: PatientACardSizeScale,
    ) => {
      if (mode === "reconstruction") {
        return applyPatientACardSizeScale(reconstructionScene.graph, scale);
      }
      return mode === "reasoning_unit"
        ? reasoningScene.graph
        : scatterScene.graph;
    },
    [reconstructionScene.graph, reasoningScene.graph, scatterScene.graph],
  );

  const applyScene = useCallback(
    (nextGraph: RelatedDiagramSemanticGraph, withJunctions = false) => {
      if (withJunctions) {
        const attached = attachPatientAMergeJunctions({
          graph: nextGraph,
          cardKeys: reconstructionScene.cardKeys,
        });
        setGraph(attached.graph);
        setTopology(attached.topology);
        setRouteState(attached.routeState);
      } else {
        setGraph(nextGraph);
        setTopology(undefined);
        setRouteState(
          seedInitialAutoRouteState(nextGraph.cards, nextGraph.connections),
        );
      }
      setHistory(emptyDiagramHistory());
      setRevealCardActions(true);
      setActionIntent(null);
      setEditDraft(null);
      setArrangeNotice(null);
      plainArrangeRouteStateRef.current = null;
    },
    [reconstructionScene.cardKeys],
  );

  const applyLayoutMode = useCallback(
    (mode: "reconstruction" | "scatter" | "reasoning_unit") => {
      setLayoutMode(mode);
      const useJunctions = mode === "reconstruction" && junctionMode && cardSizeScale === 90;
      applyScene(graphForMode(mode, cardSizeScale), useJunctions);
    },
    [applyScene, cardSizeScale, graphForMode, junctionMode],
  );

  const applyCardSizeScale = useCallback(
    (scale: PatientACardSizeScale) => {
      setCardSizeScale(scale);
      const nextJunction = scale === 90 ? junctionMode : false;
      if (scale !== 90) setJunctionMode(false);
      if (layoutMode !== "reconstruction") return;
      applyScene(graphForMode("reconstruction", scale), nextJunction);
    },
    [applyScene, graphForMode, junctionMode, layoutMode],
  );

  const applyJunctionMode = useCallback(
    (enabled: boolean) => {
      setJunctionMode(enabled);
      if (layoutMode !== "reconstruction" || cardSizeScale !== 90) return;
      applyScene(graphForMode("reconstruction", 90), enabled);
    },
    [applyScene, cardSizeScale, graphForMode, layoutMode],
  );

  const reconstructionChrome = useMemo(
    () =>
      layoutMode === "reconstruction"
        ? patientADevCardChrome(cardSizeScale)
        : undefined,
    [cardSizeScale, layoutMode],
  );

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

  const handleSurfacePointerDownWrapped = useCallback(
    (event: Parameters<typeof onSurfacePointerDown>[0]) => {
      if (handleSurfacePointerDownGuard(event.target)) return;
      clearConnectionSelection();
      onSurfacePointerDown(event);
    },
    [
      clearConnectionSelection,
      handleSurfacePointerDownGuard,
      onSurfacePointerDown,
    ],
  );
  const selectedCapabilities = useMemo(
    () => (selectedCard ? getCardActionCapabilities(selectedCard) : null),
    [selectedCard],
  );

  useEffect(() => {
    if (draggingCardId != null) setRevealCardActions(false);
  }, [draggingCardId]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      tapSuppressionRef.current = suppressionAfterPointerDown(
        tapSuppressionRef.current,
        { pointerId: event.pointerId, pointerType: event.pointerType },
      );
    };
    const onClick = (event: MouseEvent) => {
      const result = consumeSyntheticClickAfterDrag(tapSuppressionRef.current);
      tapSuppressionRef.current = result.next;
      if (!result.consume) return;
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("click", onClick, true);
    };
  }, []);

  const handleCardPointerUp = useCallback(
    (event: Parameters<typeof onCardPointerUp>[0]) => {
      const kind = onCardPointerUp(event);
      if (shouldRevealCardActionsAfterRelease(kind)) {
        setRevealCardActions(true);
        return;
      }
      setRevealCardActions(false);
      if (shouldArmClickSuppression(kind)) {
        tapSuppressionRef.current = armCardTapSuppression(
          event.pointerId,
          event.pointerType,
        );
      }
    },
    [onCardPointerUp],
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

  const arrangeLocked = arrangeRelatedDiagramUiLocked({
    connecting: false,
    editOpen: editDraft != null && actionIntent?.kind === "edit",
    composeOpen: false,
    chooserOpen: false,
    deleteConfirmOpen: false,
    priorityPickerOpen: false,
    dragging: draggingCardId != null,
  });
  const handleArrange = useCallback(() => {
    if (arrangeLocked) return;
    if (
      junctionMode &&
      layoutMode === "reconstruction" &&
      cardSizeScale === 90
    ) {
      const { arranged, attached, plainRouteState } =
        arrangeThenReattachPatientAMergeJunctions({
          graph,
          cardKeys: reconstructionScene.cardKeys,
          previousPlainRouteState: plainArrangeRouteStateRef.current ?? undefined,
        });
      setArrangeNotice(arrangeNoticeMessage(arranged));
      if (arranged.kind === "noop") return;
      plainArrangeRouteStateRef.current = plainRouteState;
      setGraph(attached.graph);
      setTopology(attached.topology);
      setRouteState(attached.routeState);
      onHistoryPush(arranged.historyAction);
      return;
    }
    const result = arrangeRelatedDiagramScene({
      graph,
      routeState,
      topology,
    });
    setArrangeNotice(arrangeNoticeMessage(result));
    if (result.kind === "noop") return;
    setGraph(result.graph);
    setRouteState(result.routeState);
    if (result.topology) setTopology(result.topology);
    onHistoryPush(result.historyAction);
  }, [
    arrangeLocked,
    cardSizeScale,
    graph,
    junctionMode,
    layoutMode,
    onHistoryPush,
    reconstructionScene.cardKeys,
    routeState,
    topology,
  ]);

  useEffect(() => {
    if (!arrangeNotice) return;
    const id = window.setTimeout(() => setArrangeNotice(null), 4000);
    return () => window.clearTimeout(id);
  }, [arrangeNotice]);

  useEffect(() => {
    const id = requestAnimationFrame(() => fitToView());
    return () => cancelAnimationFrame(id);
  }, [fitToView]);

  const handleCardEdit = useCallback(() => {
    if (!selectedCard) return;
    const intent = createCardEditIntent(selectedCard);
    if (!intent) return;
    setActionIntent(intent);
    setEditDraft(cardEditDraftFromCard(selectedCard));
  }, [selectedCard]);

  const handleSaveCardEdit = useCallback(() => {
    if (!selectedCard || !editDraft) return;
    const nextCard = applyCardDisplayEdit(selectedCard, editDraft);
    if (!nextCard) return;
    setGraph((prev) => ({
      ...prev,
      cards: prev.cards.map((card) =>
        card.id === nextCard.id ? nextCard : card,
      ),
    }));
    setEditDraft(null);
    setActionIntent(null);
  }, [editDraft, selectedCard]);

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

  const showCardPopover =
    selectedCard != null &&
    revealCardActions &&
    contextBarModel.kind === "card" &&
    editDraft == null &&
    actionIntent?.kind !== "edit";

  return (
    <main
      data-rd-workspace="patient-a-form3-skeleton"
      data-rd-source="patient_a_form3_skeleton_dev_only"
      className="fixed inset-0 flex min-h-0 min-w-0 flex-col overflow-hidden overscroll-none bg-[#EDEDF0]"
    >
      <RelatedDiagramEditorToolbar
        percent={percent}
        onReset100={resetTo100}
        onFit={fitToView}
        onPrint={() => {
          prepareRelatedDiagramPrint();
          window.print();
        }}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={history.past.length > 0}
        canRedo={history.future.length > 0}
        title="患者A 学生関連図再現"
        caseLabel={
          layoutMode === "reconstruction"
            ? `${reconstructionScene.stats.information} Information / ${reconstructionScene.stats.understanding} Understanding / ${reconstructionScene.stats.nursingProblem} NP / ${reconstructionScene.stats.connections} connections`
            : `${scatterScene.stats.information} Information / ${scatterScene.stats.understanding} Understanding / ${scatterScene.stats.evidence} Evidence`
        }
        form3Open={false}
        onOpenForm3={() => undefined}
        onAddCard={() => undefined}
        onArrange={handleArrange}
        canArrange={!arrangeLocked}
        showForm3={false}
        showAddCard={false}
        devTitle="DEV ONLY · READ ONLY SNAPSHOT · DO NOT WRITE BACK · not student runtime"
      />
      <p
        data-rd-patient-a-banner
        className="rd-no-print shrink-0 border-b border-[#E5E5EA] bg-[#F2F2F7] px-3 py-1 text-[11px] text-[#6E6E73]"
      >
        {layoutMode === "reconstruction"
          ? `患者A 学生関連図再現 · カード${cardSizeScale}%${cardSizeScale === 90 ? (junctionMode ? " Junction" : " 通常") : ""} · ${reconstructionScene.stats.information} Information / ${reconstructionScene.stats.understanding} Understanding / ${reconstructionScene.stats.knowledge} Knowledge / ${reconstructionScene.stats.nursingProblem} NP / ${reconstructionScene.stats.connections} DEV connections`
          : `患者A Form3 Skeleton · ${scatterScene.stats.information} Information / ${scatterScene.stats.understanding} Understanding / ${scatterScene.stats.evidence} Evidence · 比較用`}
      </p>
      <div
        data-rd-patient-a-layout-toggle
        className="rd-no-print flex shrink-0 items-center gap-2 border-b border-[#E5E5EA] bg-white px-3 py-1.5"
      >
        <button
          type="button"
          data-rd-patient-a-layout="reconstruction"
          aria-pressed={layoutMode === "reconstruction"}
          onClick={() => applyLayoutMode("reconstruction")}
          className={`inline-flex h-[36px] items-center rounded-md border px-3 text-[12px] ${
            layoutMode === "reconstruction"
              ? "border-[#0A5FCC] bg-[#0A5FCC] text-white"
              : "border-[#E5E5EA] bg-white text-[#1D1D1F]"
          }`}
        >
          学生関連図再現
        </button>
        <button
          type="button"
          data-rd-patient-a-layout="scatter"
          aria-pressed={layoutMode === "scatter"}
          onClick={() => applyLayoutMode("scatter")}
          className={`inline-flex h-[36px] items-center rounded-md border px-3 text-[12px] ${
            layoutMode === "scatter"
              ? "border-[#0A5FCC] bg-[#0A5FCC] text-white"
              : "border-[#E5E5EA] bg-white text-[#1D1D1F]"
          }`}
        >
          通常配置
        </button>
        <button
          type="button"
          data-rd-patient-a-layout="reasoning_unit"
          aria-pressed={layoutMode === "reasoning_unit"}
          onClick={() => applyLayoutMode("reasoning_unit")}
          className={`inline-flex h-[36px] items-center rounded-md border px-3 text-[12px] ${
            layoutMode === "reasoning_unit"
              ? "border-[#0A5FCC] bg-[#0A5FCC] text-white"
              : "border-[#E5E5EA] bg-white text-[#1D1D1F]"
          }`}
        >
          Reasoning Unit配置
        </button>
        <span className="text-[11px] text-[#6E6E73]">
          既定は学生関連図再現 · 通常/RUは比較用
        </span>
      </div>
      {layoutMode === "reconstruction" ? (
        <div
          data-rd-patient-a-card-size
          className="rd-no-print flex shrink-0 items-center gap-2 border-b border-[#E5E5EA] bg-white px-3 py-1.5"
        >
          <span className="text-[11px] text-[#6E6E73]">カードサイズ</span>
          {([100, 90, 85] as const).map((scale) => (
            <button
              key={scale}
              type="button"
              data-rd-patient-a-card-size-scale={scale}
              aria-pressed={cardSizeScale === scale}
              onClick={() => applyCardSizeScale(scale)}
              className={`inline-flex h-[36px] items-center rounded-md border px-3 text-[12px] ${
                cardSizeScale === scale
                  ? "border-[#0A5FCC] bg-[#0A5FCC] text-white"
                  : "border-[#E5E5EA] bg-white text-[#1D1D1F]"
              }`}
            >
              {scale}%
            </button>
          ))}
          <span className="text-[11px] text-[#6E6E73]">
            論理サイズ比較 · 既定100% · CSS scaleなし
          </span>
        </div>
      ) : null}
      {layoutMode === "reconstruction" && cardSizeScale === 90 ? (
        <div
          data-rd-patient-a-junction-toggle
          className="rd-no-print flex shrink-0 items-center gap-2 border-b border-[#E5E5EA] bg-white px-3 py-1.5"
        >
          <span className="text-[11px] text-[#6E6E73]">90% routing</span>
          <button
            type="button"
            data-rd-patient-a-junction-mode="plain"
            aria-pressed={!junctionMode}
            onClick={() => applyJunctionMode(false)}
            className={`inline-flex h-[36px] items-center rounded-md border px-3 text-[12px] ${
              !junctionMode
                ? "border-[#0A5FCC] bg-[#0A5FCC] text-white"
                : "border-[#E5E5EA] bg-white text-[#1D1D1F]"
            }`}
          >
            90% 通常
          </button>
          <button
            type="button"
            data-rd-patient-a-junction-mode="junction"
            aria-pressed={junctionMode}
            onClick={() => applyJunctionMode(true)}
            className={`inline-flex h-[36px] items-center rounded-md border px-3 text-[12px] ${
              junctionMode
                ? "border-[#0A5FCC] bg-[#0A5FCC] text-white"
                : "border-[#E5E5EA] bg-white text-[#1D1D1F]"
            }`}
          >
            90% Junction
          </button>
          <span className="text-[11px] text-[#6E6E73]">
            explicit 4 merges · connection 64維持
          </span>
        </div>
      ) : null}

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
              cardChrome={reconstructionChrome}
              interactive
              selectedCardId={selectedCardId}
              selectedConnectionId={selectedConnectionId}
              dragTransient={dragTransient}
              routeEditPreview={routeEditPreview}
              onCardPointerDown={onCardPointerDown}
              onCardPointerMove={onCardPointerMove}
              onCardPointerUp={handleCardPointerUp}
              onSurfacePointerDown={handleSurfacePointerDownWrapped}
              onConnectionPointerDown={handleConnectionPointerDown}
            />
            {layoutMode === "reasoning_unit" ? (
              <div
                data-rd-dev-unintegrated-pool-label
                className="pointer-events-none absolute z-10 text-[11px] text-[#6E6E73]"
                style={{
                  left: reasoningScene.isolatedPool.x,
                  top: Math.max(0, reasoningScene.isolatedPool.y - 18),
                }}
              >
                {PATIENT_A_DEV_UNINTEGRATED_POOL_LABEL}
              </div>
            ) : null}
            </div>
          </div>
        </div>
        {showCardPopover && selectedCard && contextBarModel.kind === "card" ? (
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
            estimatedSize={{ width: 220, height: 60 }}
            onDismiss={() => selectCard(null)}
          >
            <RelatedDiagramContextBar
              model={contextBarModel}
              onEdit={handleCardEdit}
            />
          </RelatedDiagramActionPopover>
        ) : null}
        {arrangeNotice ? (
          <p className="pointer-events-none absolute bottom-3 left-1/2 z-30 -translate-x-1/2 rounded-md bg-black/70 px-3 py-1 text-[12px] text-white">
            {arrangeNotice}
          </p>
        ) : null}
      </div>
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
          onCancel={() => {
            setEditDraft(null);
            setActionIntent(null);
          }}
          onSave={handleSaveCardEdit}
        />
      ) : null}
      <RelatedDiagramPrintPortal>
        <div className="rd-print-root">
          <RelatedDiagramA3Surface
            graph={graph}
            knowledgeLabel=""
            routeTopology={topology}
            stableRouteState={routeState}
            cardChrome={reconstructionChrome}
          />
        </div>
      </RelatedDiagramPrintPortal>
    </main>
  );
}
