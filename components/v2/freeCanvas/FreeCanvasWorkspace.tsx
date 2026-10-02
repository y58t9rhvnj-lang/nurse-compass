"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  getFreeCanvasAction,
  renameFreeCanvasAction,
  saveFreeCanvasAction,
} from "@/app/v2/actions/freeCanvas";
import { requestWorkspaceBack } from "@/components/v2/workspace/requestWorkspaceBack";
import { clientToLogical } from "@/lib/v2/relatedDiagram/a3PointerMath";
import {
  createCardConnectIntent,
  createCardDeleteIntent,
  createCardEditIntent,
  type CardActionIntent,
} from "@/lib/v2/relatedDiagram/cardActionIntents";
import { getCardActionCapabilities } from "@/lib/v2/relatedDiagram/cardActionCapabilities";
import {
  commitStudentConnectionCreate,
  connectNoticeForCode,
  evaluateConnectTarget,
  type RelationComposeDraft,
} from "@/lib/v2/relatedDiagram/cardConnectionCreate";
import {
  changeStudentConnectionRelation,
  connectionPermissions,
  deleteManagedConnection,
  REVERSE_CONNECTION_NOTICE,
  reverseStudentConnection,
} from "@/lib/v2/relatedDiagram/cardConnectionManage";
import {
  incidentConnectionCount,
  incidentConnections,
  pruneStableRoutesForConnections,
  pruneTopologyForConnections,
  removeCardAndIncidentConnections,
  snapshotCardForDelete,
} from "@/lib/v2/relatedDiagram/cardDelete";
import {
  canOpenDirectCardTypeChooser,
  commitDirectNursingProblemCreate,
  commitDirectUnderstandingCreate,
  directCardCreateSelectionUi,
  resolveAddCardAnchorRect,
  type DirectCardCreateType,
  type DirectCardPlacementNotice,
} from "@/lib/v2/relatedDiagram/cardDirectCreate";
import {
  canCommitDirectInsightCompose,
  emptyDirectInsightComposeDraft,
  type DirectInsightComposeDraft,
} from "@/lib/v2/relatedDiagram/cardDirectInsight";
import {
  applyCardDisplayEdit,
  canCommitCardEdit,
  cardEditDraftFromCard,
  patchCardInGraph,
  type CardEditDraft,
} from "@/lib/v2/relatedDiagram/cardEdit";
import {
  armCardTapSuppression,
  consumeSyntheticClickAfterDrag,
  idleTapSuppression,
  shouldArmClickSuppression,
  shouldRevealCardActionsAfterRelease,
  suppressionAfterPointerDown,
} from "@/lib/v2/relatedDiagram/cardTapGesture";
import {
  cloneCardEntity,
} from "@/lib/v2/relatedDiagram/form3ToUnderstandingCard";
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
import type { ContextBarModel } from "@/lib/v2/relatedDiagram/editorContextBar";
import { resolveRelatedDiagramEditorMode } from "@/lib/v2/relatedDiagram/editorUiState";
import {
  cloneStableRouteState,
  seedInitialAutoRouteState,
  seedStableRouteState,
  type StableRouteState,
} from "@/lib/v2/relatedDiagram/incrementalRoutes";
import {
  canSetNursingProblemPriority,
  commitNursingProblemPriorityPickerSelection,
  nursingProblemPriorityPickerOptions,
} from "@/lib/v2/relatedDiagram/nursingProblemPriorityUi";
import { restoreRouteScene } from "@/lib/v2/relatedDiagram/routeScene";
import type { RelatedDiagramRouteTopology } from "@/lib/v2/relatedDiagram/routeTopology";
import { createEmptySemanticGraph } from "@/lib/v2/relatedDiagram/semanticGraph";
import type { RelatedDiagramSemanticGraph } from "@/lib/v2/relatedDiagram/types";
import {
  trackPointerDown,
  trackPointerUp,
} from "@/lib/v2/relatedDiagram/actionPopoverGesture";
import {
  cardScreenRect,
  connectionActionBarDockRect,
} from "@/lib/v2/relatedDiagram/actionPopoverPlacement";
import {
  freeCanvasPersistLabel,
  type FreeCanvasPersistStatus,
} from "@/lib/v2/freeCanvas/freeCanvasDisplay";
import RelatedDiagramA3Surface from "@/components/v2/relatedDiagram/RelatedDiagramA3Surface";
import RelatedDiagramActionPopover from "@/components/v2/relatedDiagram/RelatedDiagramActionPopover";
import RelatedDiagramCardDeleteConfirm from "@/components/v2/relatedDiagram/RelatedDiagramCardDeleteConfirm";
import RelatedDiagramCardEditDrawer from "@/components/v2/relatedDiagram/RelatedDiagramCardEditDrawer";
import RelatedDiagramCardTypeChooser from "@/components/v2/relatedDiagram/RelatedDiagramCardTypeChooser";
import RelatedDiagramConnectionActionBar from "@/components/v2/relatedDiagram/RelatedDiagramConnectionActionBar";
import RelatedDiagramContextBar from "@/components/v2/relatedDiagram/RelatedDiagramContextBar";
import RelatedDiagramDirectInsightDrawer from "@/components/v2/relatedDiagram/RelatedDiagramDirectInsightDrawer";
import RelatedDiagramDirectNursingProblemDrawer from "@/components/v2/relatedDiagram/RelatedDiagramDirectNursingProblemDrawer";
import RelatedDiagramEditorToolbar from "@/components/v2/relatedDiagram/RelatedDiagramEditorToolbar";
import RelatedDiagramPriorityPicker from "@/components/v2/relatedDiagram/RelatedDiagramPriorityPicker";
import RelatedDiagramPrintPortal, {
  prepareRelatedDiagramPrint,
} from "@/components/v2/relatedDiagram/RelatedDiagramPrintPortal";
import RelatedDiagramRelationComposeBar from "@/components/v2/relatedDiagram/RelatedDiagramRelationComposeBar";
import { useA3Viewport } from "@/components/v2/relatedDiagram/useA3Viewport";
import { useCardInteraction } from "@/components/v2/relatedDiagram/useCardInteraction";
import { useConnectionRouteInteraction } from "@/components/v2/relatedDiagram/useConnectionRouteInteraction";

export default function FreeCanvasWorkspace({ canvasId }: { canvasId: string }) {
  const router = useRouter();
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

  const [title, setTitle] = useState("無題のキャンバス");
  const [titleDraft, setTitleDraft] = useState("無題のキャンバス");
  const [renaming, setRenaming] = useState(false);
  const [graph, setGraph] = useState<RelatedDiagramSemanticGraph>(
    createEmptySemanticGraph,
  );
  const [routeState, setRouteState] = useState<StableRouteState>(() =>
    seedInitialAutoRouteState([], []),
  );
  const [topology, setTopology] = useState<RelatedDiagramRouteTopology | undefined>();
  const [history, setHistory] = useState<DiagramHistory>(emptyDiagramHistory);
  const [persistStatus, setPersistStatus] =
    useState<FreeCanvasPersistStatus>("unsaved");
  const [persistMessage, setPersistMessage] = useState<string | null>(null);
  const [recordVersion, setRecordVersion] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const persistRef = useRef({
    graph,
    routeState,
    topology,
    version: recordVersion,
    persistStatus,
  });
  persistRef.current = {
    graph,
    routeState,
    topology,
    version: recordVersion,
    persistStatus,
  };

  const markDirty = useCallback(() => {
    setPersistStatus((prev) => (prev === "saving" ? prev : "unsaved"));
  }, []);
  const onHistoryPush = useCallback(
    (action: DiagramHistoryAction) => {
      setHistory((prev) => pushDiagramHistory(prev, action));
      markDirty();
    },
    [markDirty],
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

  const {
    selectedCardId,
    selectedGroup,
    draggingCardId,
    draggingGroup,
    dragTransient,
    selectCard,
    onCardPointerDown,
    onCardPointerMove,
    onCardPointerUp,
    onGroupHandlePointerDown,
    onSurfacePointerDown,
  } = useCardInteraction({
    enabled: hydrated,
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
    diagramSelection,
    selectedConnectionId,
    selectedConnection,
    connectionAnchor,
    handleConnectionPointerDown,
    handleSurfacePointerDownGuard,
    clearConnectionSelection,
    routeEditPreview,
  } = useConnectionRouteInteraction({
    graph,
    routeState,
    topology,
    selectedCardId,
    selectCard,
    draggingCardId,
    transform,
    viewportEl: () => viewportElRef.current,
    blocked: false,
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

  const [actionIntent, setActionIntent] = useState<CardActionIntent | null>(null);
  const [editDraft, setEditDraft] = useState<CardEditDraft | null>(null);
  const [insightDraft, setInsightDraft] = useState<DirectInsightComposeDraft | null>(
    null,
  );
  const [nursingProblemDraft, setNursingProblemDraft] =
    useState<DirectInsightComposeDraft | null>(null);
  const [cardTypeChooserOpen, setCardTypeChooserOpen] = useState(false);
  const [revealCardActions, setRevealCardActions] = useState(true);
  const [placementNotice, setPlacementNotice] =
    useState<DirectCardPlacementNotice | null>(null);
  const [relationCompose, setRelationCompose] =
    useState<RelationComposeDraft | null>(null);
  const [connectNotice, setConnectNotice] = useState<string | null>(null);
  const connectTapRef = useRef<{
    cardId: string;
    x: number;
    y: number;
  } | null>(null);
  const suppressConnectTapRef = useRef(false);
  const tapSuppressionRef = useRef(idleTapSuppression());
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [priorityPickerOpen, setPriorityPickerOpen] = useState(false);

  const editorMode = resolveRelatedDiagramEditorMode({
    selection: diagramSelection,
    form3Open: false,
    editOpen: editDraft != null && actionIntent?.kind === "edit",
    connecting: actionIntent?.kind === "connect",
    directInsightOpen: insightDraft != null,
    directNursingProblemOpen: nursingProblemDraft != null,
  });

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
        canOpenSource: false,
        canSetPriority: canSetNursingProblemPriority(graph, selectedCard.id),
        editDisabledReason: null,
      };
    }
    return { kind: "none" };
  })();

  useEffect(() => {
    let cancelled = false;
    void getFreeCanvasAction({ id: canvasId }).then((res) => {
      if (cancelled) return;
      if (!res.ok) {
        setLoadError(res.message);
        return;
      }
      setTitle(res.canvas.title);
      setTitleDraft(res.canvas.title);
      setGraph(res.canvas.semanticGraph);
      setRecordVersion(res.canvas.version);
      if (res.canvas.routeScene == null) {
        setRouteState(
          seedInitialAutoRouteState(
            res.canvas.semanticGraph.cards,
            res.canvas.semanticGraph.connections,
          ),
        );
        setTopology(undefined);
        setPersistStatus("unsaved");
      } else {
        const restored = restoreRouteScene({
          graph: res.canvas.semanticGraph,
          routeScene: res.canvas.routeScene,
        });
        if (restored.supported) {
          setRouteState(restored.routeState);
          setTopology(restored.topology);
          setPersistStatus("saved");
        } else {
          setRouteState(
            seedStableRouteState(
              res.canvas.semanticGraph.cards,
              res.canvas.semanticGraph.connections,
            ),
          );
          setPersistStatus("unsaved");
        }
      }
      setHistory(emptyDiagramHistory());
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [canvasId]);

  useEffect(() => {
    const id = requestAnimationFrame(() => fitToView());
    return () => cancelAnimationFrame(id);
  }, [fitToView]);

  useEffect(() => {
    if (actionIntent?.kind === "connect") return;
    setActionIntent(null);
    setEditDraft(null);
    setInsightDraft(null);
    setNursingProblemDraft(null);
    setCardTypeChooserOpen(false);
    setRelationCompose(null);
    setDeleteConfirmOpen(false);
    setPriorityPickerOpen(false);
  }, [selectedCardId]);

  useEffect(() => {
    if (!selectedCardId) return;
    clearConnectionSelection();
  }, [clearConnectionSelection, selectedCardId]);

  useEffect(() => {
    if (actionIntent?.kind !== "connect") return;
    if (selectedCardId !== actionIntent.sourceCardId) {
      selectCard(actionIntent.sourceCardId);
    }
  }, [actionIntent, selectCard, selectedCardId]);

  useEffect(() => {
    if (!connectNotice) return;
    const id = window.setTimeout(() => setConnectNotice(null), 2500);
    return () => window.clearTimeout(id);
  }, [connectNotice]);

  useEffect(() => {
    if (!placementNotice) return;
    const id = window.setTimeout(() => setPlacementNotice(null), 4000);
    return () => window.clearTimeout(id);
  }, [placementNotice]);

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
    markDirty();
  }, [applyFragment, history, markDirty]);

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
    markDirty();
  }, [applyFragment, history, markDirty]);

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

  const handleSave = useCallback(async () => {
    const snap = persistRef.current;
    if (snap.persistStatus === "saving" || snap.version == null) return;
    setPersistStatus("saving");
    const res = await saveFreeCanvasAction({
      id: canvasId,
      expectedVersion: snap.version,
      semanticGraph: snap.graph,
      routeState: snap.routeState,
      topology: snap.topology,
    });
    if (!res.ok) {
      setPersistStatus(res.kind === "conflict" ? "conflict" : "error");
      setPersistMessage(res.message);
      return;
    }
    setRecordVersion(res.canvas.version);
    setPersistStatus("saved");
    setPersistMessage(null);
  }, [canvasId]);

  const canSave =
    hydrated &&
    recordVersion != null &&
    (persistStatus === "unsaved" ||
      persistStatus === "conflict" ||
      persistStatus === "error");

  const handleBack = useCallback(() => {
    const proceed = () => {
      router.push("/v2/student/canvases");
    };
    if (persistStatus === "saving") {
      requestWorkspaceBack({ kind: "saving", onProceed: proceed });
      return;
    }
    if (persistStatus === "error") {
      requestWorkspaceBack({ kind: "error", onProceed: proceed });
      return;
    }
    if (persistStatus === "conflict") {
      requestWorkspaceBack({ kind: "conflict", onProceed: proceed });
      return;
    }
    if (persistStatus === "unsaved") {
      requestWorkspaceBack({ kind: "draft", onProceed: proceed });
      return;
    }
    requestWorkspaceBack({ kind: "saved", onProceed: proceed });
  }, [persistStatus, router]);

  const handleRenameCommit = useCallback(async () => {
    const res = await renameFreeCanvasAction({ id: canvasId, title: titleDraft });
    if (!res.ok) {
      setConnectNotice(res.message);
      return;
    }
    setTitle(res.canvas.title);
    setTitleDraft(res.canvas.title);
    setRenaming(false);
  }, [canvasId, titleDraft]);

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

  const closeCardTypeChooser = useCallback(() => {
    setCardTypeChooserOpen(false);
  }, []);

  const openCardTypeChooser = useCallback(() => {
    if (!canOpenDirectCardTypeChooser({ connecting: actionIntent?.kind === "connect" })) {
      return;
    }
    if (cardTypeChooserOpen) {
      setCardTypeChooserOpen(false);
      return;
    }
    setEditDraft(null);
    setInsightDraft(null);
    setNursingProblemDraft(null);
    if (actionIntent?.kind === "edit") setActionIntent(null);
    setCardTypeChooserOpen(true);
  }, [actionIntent, cardTypeChooserOpen]);

  const openDirectInsightCompose = useCallback(() => {
    if (actionIntent?.kind === "connect") return;
    setCardTypeChooserOpen(false);
    setEditDraft(null);
    setNursingProblemDraft(null);
    if (actionIntent?.kind === "edit") setActionIntent(null);
    setInsightDraft(emptyDirectInsightComposeDraft());
  }, [actionIntent]);

  const openDirectNursingProblemCompose = useCallback(() => {
    if (actionIntent?.kind === "connect") return;
    setCardTypeChooserOpen(false);
    setEditDraft(null);
    setInsightDraft(null);
    if (actionIntent?.kind === "edit") setActionIntent(null);
    setNursingProblemDraft(emptyDirectInsightComposeDraft());
  }, [actionIntent]);

  const handleChooseCardType = useCallback(
    (type: DirectCardCreateType) => {
      setCardTypeChooserOpen(false);
      if (type === "understanding") {
        openDirectInsightCompose();
        return;
      }
      if (type === "nursing_problem") {
        openDirectNursingProblemCompose();
      }
    },
    [openDirectInsightCompose, openDirectNursingProblemCompose],
  );

  const closeDirectInsightCompose = useCallback(() => {
    setInsightDraft(null);
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>("[data-rd-add-card]")?.focus();
    });
  }, []);

  const handleAddDirectInsight = useCallback(() => {
    if (!insightDraft || !canCommitDirectInsightCompose(insightDraft)) return;
    if (insightDraft.state !== "current" && insightDraft.state !== "potential") {
      return;
    }
    const committed = commitDirectUnderstandingCreate({
      draft: insightDraft,
      graph,
      desiredCenter: viewportCenter(),
    });
    if (!committed.ok) {
      if (committed.reason === "no_space" && committed.notice) {
        setPlacementNotice(committed.notice);
      }
      return;
    }
    setInsightDraft(null);
    setGraph(committed.graph);
    onHistoryPush({ type: "addCard", entity: cloneCardEntity(committed.entity) });
    const selection = directCardCreateSelectionUi(committed.entity.card.id);
    selectCard(selection.selectedCardId);
    setRevealCardActions(selection.revealCardActions);
  }, [graph, insightDraft, onHistoryPush, selectCard, viewportCenter]);

  const closeDirectNursingProblemCompose = useCallback(() => {
    setNursingProblemDraft(null);
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>("[data-rd-add-card]")?.focus();
    });
  }, []);

  const handleAddDirectNursingProblem = useCallback(() => {
    if (!nursingProblemDraft || !canCommitDirectInsightCompose(nursingProblemDraft)) {
      return;
    }
    if (
      nursingProblemDraft.state !== "current" &&
      nursingProblemDraft.state !== "potential"
    ) {
      return;
    }
    const committed = commitDirectNursingProblemCreate({
      draft: nursingProblemDraft,
      graph,
      desiredCenter: viewportCenter(),
    });
    if (!committed.ok) {
      if (committed.reason === "no_space" && committed.notice) {
        setPlacementNotice(committed.notice);
      }
      return;
    }
    setNursingProblemDraft(null);
    setGraph(committed.graph);
    onHistoryPush({ type: "addCard", entity: cloneCardEntity(committed.entity) });
    const selection = directCardCreateSelectionUi(committed.entity.card.id);
    selectCard(selection.selectedCardId);
    setRevealCardActions(selection.revealCardActions);
  }, [graph, nursingProblemDraft, onHistoryPush, selectCard, viewportCenter]);

  const requestDeleteSelected = useCallback(() => {
    if (!selectedCard) return;
    const intent = createCardDeleteIntent(selectedCard);
    if (!intent) return;
    setPriorityPickerOpen(false);
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
    const nursingProblemsBefore = graph.nursingProblems.map((row) => ({
      ...row,
    }));
    const nextGraph = removeCardAndIncidentConnections(graph, selectedCard.id);
    const nursingProblemsAfter = nextGraph.nursingProblems.map((row) => ({
      ...row,
    }));
    setGraph(nextGraph);
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
      nursingProblemsBefore,
      nursingProblemsAfter,
    });
    setDeleteConfirmOpen(false);
    setActionIntent(null);
    selectCard(null);
  }, [graph, onHistoryPush, routeState, selectCard, selectedCard, topology]);

  const handleCardEdit = useCallback(() => {
    if (!selectedCard) return;
    const intent = createCardEditIntent(selectedCard);
    if (!intent) return;
    setInsightDraft(null);
    setPriorityPickerOpen(false);
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
    setInsightDraft(null);
    setEditDraft(null);
    setRelationCompose(null);
    setConnectNotice(null);
    setPriorityPickerOpen(false);
    suppressConnectTapRef.current = false;
    clearConnectionSelection();
    setActionIntent(intent);
  }, [clearConnectionSelection, selectedCard]);

  const handleOpenPriorityPicker = useCallback(() => {
    if (!selectedCard) return;
    if (!canSetNursingProblemPriority(graph, selectedCard.id)) return;
    setPriorityPickerOpen(true);
  }, [graph, selectedCard]);

  const handlePriorityPickerSelect = useCallback(
    (priority: number | null) => {
      if (!selectedCard) return;
      const result = commitNursingProblemPriorityPickerSelection({
        graph,
        cardId: selectedCard.id,
        priority,
      });
      if (result.ok && result.changed) {
        setGraph(result.graph);
        onHistoryPush(result.action);
      }
      setPriorityPickerOpen(false);
    },
    [graph, onHistoryPush, selectedCard],
  );

  const handleCancelConnect = useCallback(() => {
    suppressConnectTapRef.current = true;
    connectTapRef.current = null;
    setRelationCompose(null);
    setConnectNotice(null);
    setActionIntent(null);
    focusContextAction("connect");
  }, [focusContextAction]);

  useEffect(() => {
    if (actionIntent?.kind !== "connect" || relationCompose) return;
    const pointers = new Set<number>();
    const onDown = (event: PointerEvent) => {
      if (trackPointerDown(pointers, event.pointerId) >= 2) {
        handleCancelConnect();
      }
    };
    const onUp = (event: PointerEvent) => {
      trackPointerUp(pointers, event.pointerId);
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("pointerup", onUp, true);
    document.addEventListener("pointercancel", onUp, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("pointerup", onUp, true);
      document.removeEventListener("pointercancel", onUp, true);
    };
  }, [actionIntent, handleCancelConnect, relationCompose]);

  const handleConnectTargetTap = useCallback(
    (targetCardId: string) => {
      if (actionIntent?.kind !== "connect") return;
      const evaluated = evaluateConnectTarget({
        graph,
        sourceCardId: actionIntent.sourceCardId,
        targetCardId,
      });
      if (!evaluated.ok) {
        setConnectNotice(evaluated.message);
        if (evaluated.code === "self_connection") return;
        setRelationCompose(null);
        return;
      }
      setConnectNotice(null);
      setRelationCompose({
        sourceCardId: actionIntent.sourceCardId,
        targetCardId,
      });
    },
    [actionIntent, graph],
  );

  const handleCancelRelationCompose = useCallback(() => {
    suppressConnectTapRef.current = true;
    connectTapRef.current = null;
    setRelationCompose(null);
    setConnectNotice(null);
    setActionIntent(null);
  }, []);

  const handleChooseRelation = useCallback(
    (relationType: "current" | "potential" | "treatment") => {
      if (actionIntent?.kind !== "connect" || !relationCompose) return;
      const created = commitStudentConnectionCreate({
        graph,
        routeState,
        topology,
        sourceCardId: relationCompose.sourceCardId,
        targetCardId: relationCompose.targetCardId,
        relationType,
      });
      if (!created.ok) {
        setConnectNotice(connectNoticeForCode(created.code));
        return;
      }
      setGraph(created.graph);
      setRouteState(created.routeState);
      if (created.topology) setTopology(created.topology);
      onHistoryPush({
        type: "addConnection",
        connection: created.connection,
        routeStateBefore: cloneStableRouteState(routeState),
        routeStateAfter: cloneStableRouteState(created.routeState),
        topologyBefore: topology,
        topologyAfter: created.topology,
      });
      setRelationCompose(null);
      setConnectNotice(null);
      setActionIntent(null);
      selectCard(null);
    },
    [
      actionIntent,
      graph,
      onHistoryPush,
      relationCompose,
      routeState,
      selectCard,
      topology,
    ],
  );

  const handleStudentConnectionRelationChange = useCallback(
    (relationType: "current" | "potential" | "treatment") => {
      if (!selectedConnection) return;
      const result = changeStudentConnectionRelation({
        graph,
        connectionId: selectedConnection.id,
        relationType,
        now: new Date().toISOString(),
      });
      if (!result.ok || result.kind === "unchanged") return;
      setGraph(result.graph);
      onHistoryPush({
        type: "editConnectionRelation",
        before: result.before,
        after: result.after,
      });
    },
    [graph, onHistoryPush, selectedConnection],
  );

  const handleManagedConnectionDelete = useCallback(() => {
    if (!selectedConnection) return;
    const result = deleteManagedConnection({
      graph,
      routeState,
      topology,
      connectionId: selectedConnection.id,
    });
    if (!result.ok) return;
    setGraph(result.graph);
    setRouteState(result.routeState);
    if (result.topology) setTopology(result.topology);
    onHistoryPush({
      type: "deleteConnection",
      connection: result.connection,
      routeStateBefore: cloneStableRouteState(routeState),
      routeStateAfter: cloneStableRouteState(result.routeState),
      topologyBefore: topology,
      topologyAfter: result.topology,
    });
    clearConnectionSelection();
  }, [
    clearConnectionSelection,
    graph,
    onHistoryPush,
    routeState,
    selectedConnection,
    topology,
  ]);

  const handleStudentConnectionReverse = useCallback(() => {
    if (!selectedConnection) return;
    const result = reverseStudentConnection({
      graph,
      routeState,
      topology,
      connectionId: selectedConnection.id,
      now: new Date().toISOString(),
    });
    if (!result.ok) {
      if (result.code === "reverse_failed") {
        setConnectNotice(result.notice ?? REVERSE_CONNECTION_NOTICE);
      }
      return;
    }
    setGraph(result.graph);
    setRouteState(result.routeState);
    if (result.topology) setTopology(result.topology);
    onHistoryPush({
      type: "reverseConnection",
      before: result.before,
      after: result.after,
      routeStateBefore: cloneStableRouteState(routeState),
      routeStateAfter: cloneStableRouteState(result.routeState),
      topologyBefore: topology,
      topologyAfter: result.topology,
    });
  }, [graph, onHistoryPush, routeState, selectedConnection, topology]);

  const handleConnectionPointerDownGuarded = useCallback(
    (event: ReactPointerEvent<SVGPathElement>) => {
      if (actionIntent?.kind === "connect") return;
      if (priorityPickerOpen) return;
      handleConnectionPointerDown(event);
    },
    [actionIntent, handleConnectionPointerDown, priorityPickerOpen],
  );

  const handleSurfacePointerDownWrapped = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (priorityPickerOpen) return;
      if (handleSurfacePointerDownGuard(event.target)) return;
      clearConnectionSelection();
      onSurfacePointerDown(event);
    },
    [
      clearConnectionSelection,
      handleSurfacePointerDownGuard,
      onSurfacePointerDown,
      priorityPickerOpen,
    ],
  );

  useEffect(() => {
    if (draggingCardId != null || draggingGroup) {
      setRevealCardActions(false);
    }
  }, [draggingCardId, draggingGroup]);

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

  const handleConnectingCardPointerDown = useCallback(
    (
      card: Parameters<typeof onCardPointerDown>[0],
      event: Parameters<typeof onCardPointerDown>[1],
    ) => {
      if (actionIntent?.kind === "connect") {
        if (suppressConnectTapRef.current) return;
        connectTapRef.current = {
          cardId: card.id,
          x: event.clientX,
          y: event.clientY,
        };
        return;
      }
      if (priorityPickerOpen) return;
      onCardPointerDown(card, event);
    },
    [actionIntent, onCardPointerDown, priorityPickerOpen],
  );

  const handleConnectingCardPointerUp = useCallback(
    (event: Parameters<typeof onCardPointerUp>[0]) => {
      if (suppressConnectTapRef.current) {
        suppressConnectTapRef.current = false;
        connectTapRef.current = null;
        return;
      }
      if (actionIntent?.kind === "connect" && connectTapRef.current) {
        const start = connectTapRef.current;
        connectTapRef.current = null;
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        if (dx * dx + dy * dy > 256) return;
        handleConnectTargetTap(start.cardId);
        return;
      }
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
    [actionIntent, handleConnectTargetTap, onCardPointerUp],
  );

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

  const emptyHint = hydrated && graph.cards.length === 0;

  if (loadError) {
    return (
      <main
        data-free-canvas-workspace="1"
        data-free-canvas-missing="1"
        className="mx-auto w-full max-w-3xl px-6 py-10"
      >
        <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {loadError}
        </p>
        <button
          type="button"
          onClick={() => router.push("/v2/student/canvases")}
          className="mt-4 inline-flex min-h-[44px] items-center text-sm text-slate-600 hover:underline"
        >
          一覧へ戻る
        </button>
      </main>
    );
  }

  if (!hydrated) {
    return (
      <main
        data-free-canvas-workspace="1"
        className="mx-auto w-full max-w-3xl px-6 py-10"
      >
        <p className="text-sm text-slate-500">読み込み中…</p>
      </main>
    );
  }

  return (
    <main
      data-free-canvas-workspace="1"
      data-free-canvas-id={canvasId}
      data-rd-editor-mode={editorMode}
      data-rd-editor-selection={diagramSelection.kind}
      data-rd-persist-status={persistStatus}
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
        title={title}
        caseLabel=""
        form3Open={false}
        onOpenForm3={() => undefined}
        showForm3={false}
        showArrange={false}
        onAddCard={openCardTypeChooser}
        addCardOpen={cardTypeChooserOpen}
        onArrange={() => undefined}
        persistStatus={persistStatus}
        persistLabel={persistMessage ?? freeCanvasPersistLabel(persistStatus)}
        onSave={() => {
          void handleSave();
        }}
        canSave={canSave}
        onBack={handleBack}
        renaming={renaming}
        renameDraft={titleDraft}
        onRenameDraftChange={setTitleDraft}
        onRenameCommit={() => {
          void handleRenameCommit();
        }}
        onRenameCancel={() => {
          setTitleDraft(title);
          setRenaming(false);
        }}
        onStartRename={() => {
          setTitleDraft(title);
          setRenaming(true);
        }}
      />

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
            <RelatedDiagramA3Surface
              graph={graph}
              knowledgeLabel={null}
              routeTopology={topology}
              stableRouteState={routeState}
              interactive
              selectedCardId={selectedCardId}
              selectedConnectionId={selectedConnectionId}
              routeEditPreview={routeEditPreview}
              onConnectionPointerDown={
                actionIntent?.kind === "connect"
                  ? undefined
                  : handleConnectionPointerDownGuarded
              }
              connectSourceCardId={
                actionIntent?.kind === "connect" ? actionIntent.sourceCardId : null
              }
              connectTargetCardId={relationCompose?.targetCardId ?? null}
              selectedGroup={selectedGroup}
              dragTransient={dragTransient}
              onCardPointerDown={handleConnectingCardPointerDown}
              onCardPointerMove={onCardPointerMove}
              onCardPointerUp={handleConnectingCardPointerUp}
              onGroupHandlePointerDown={
                actionIntent?.kind === "connect" || priorityPickerOpen
                  ? undefined
                  : onGroupHandlePointerDown
              }
              onSurfacePointerDown={
                actionIntent?.kind === "connect"
                  ? undefined
                  : handleSurfacePointerDownWrapped
              }
            />
          </div>
        </div>
        {emptyHint ? (
          <p className="pointer-events-none absolute inset-x-0 top-6 text-center text-[14px] text-[#6E6E73]">
            白紙です。カードを追加して自由に配置できます。
          </p>
        ) : null}
        {(() => {
          const viewportBox = viewportElRef.current?.getBoundingClientRect();
          const viewportRect = viewportBox
            ? {
                x: viewportBox.left,
                y: viewportBox.top,
                width: viewportBox.width,
                height: viewportBox.height,
              }
            : { x: 0, y: 0, width: 0, height: 0 };
          const viewportOrigin = viewportBox
            ? { left: viewportBox.left, top: viewportBox.top }
            : { left: 0, top: 0 };
          const priorityOptions =
            selectedCard != null
              ? nursingProblemPriorityPickerOptions(graph, selectedCard.id)
              : null;
          const showPriorityPicker =
            priorityPickerOpen &&
            selectedCard != null &&
            priorityOptions != null &&
            editDraft == null &&
            !deleteConfirmOpen &&
            actionIntent?.kind !== "connect";
          const showCardPopover =
            selectedCard != null &&
            revealCardActions &&
            contextBarModel.kind === "card" &&
            editDraft == null &&
            !deleteConfirmOpen &&
            !showPriorityPicker &&
            actionIntent?.kind !== "connect";
          const targetCard = relationCompose
            ? graph.cards.find((card) => card.id === relationCompose.targetCardId)
            : null;
          return (
            <>
              {showCardPopover && selectedCard ? (
                <RelatedDiagramActionPopover
                  kind="card"
                  anchor={cardScreenRect(selectedCard, viewportOrigin, transform)}
                  viewport={viewportRect}
                  estimatedSize={{ width: 220, height: 60 }}
                  onDismiss={() => selectCard(null)}
                >
                  <RelatedDiagramContextBar
                    model={contextBarModel}
                    onEdit={handleCardEdit}
                    onConnect={handleCardConnect}
                    onPriority={handleOpenPriorityPicker}
                    onDelete={requestDeleteSelected}
                    onCancelConnect={handleCancelConnect}
                  />
                </RelatedDiagramActionPopover>
              ) : null}
              {showPriorityPicker && selectedCard && priorityOptions ? (
                <RelatedDiagramActionPopover
                  kind="priority"
                  anchor={cardScreenRect(selectedCard, viewportOrigin, transform)}
                  viewport={
                    typeof window === "undefined"
                      ? viewportRect
                      : {
                          x: 0,
                          y: 0,
                          width: window.innerWidth,
                          height: window.innerHeight,
                        }
                  }
                  estimatedSize={{
                    width: 216,
                    height: Math.min(320, 28 + 44 * priorityOptions.length),
                  }}
                  onDismiss={() => setPriorityPickerOpen(false)}
                >
                  <RelatedDiagramPriorityPicker
                    options={priorityOptions}
                    onSelect={handlePriorityPickerSelect}
                  />
                </RelatedDiagramActionPopover>
              ) : null}
              {selectedConnection && connectionAnchor ? (
                <RelatedDiagramActionPopover
                  kind="connection"
                  anchor={connectionActionBarDockRect(viewportRect)}
                  viewport={viewportRect}
                  estimatedSize={{ width: 280, height: 188 }}
                  onDismiss={clearConnectionSelection}
                >
                  <RelatedDiagramConnectionActionBar
                    relation={selectedConnection.relationType}
                    permissions={connectionPermissions(selectedConnection)}
                    onChangeRelation={
                      connectionPermissions(selectedConnection).relationEditable
                        ? handleStudentConnectionRelationChange
                        : undefined
                    }
                    onReverse={
                      connectionPermissions(selectedConnection).reversible
                        ? handleStudentConnectionReverse
                        : undefined
                    }
                    onDelete={
                      connectionPermissions(selectedConnection).deletable
                        ? handleManagedConnectionDelete
                        : undefined
                    }
                  />
                </RelatedDiagramActionPopover>
              ) : null}
              {relationCompose && targetCard ? (
                <RelatedDiagramActionPopover
                  kind="relation"
                  anchor={cardScreenRect(targetCard, viewportOrigin, transform)}
                  viewport={viewportRect}
                  estimatedSize={{ width: 280, height: 168 }}
                  onDismiss={handleCancelRelationCompose}
                >
                  <RelatedDiagramRelationComposeBar
                    sourceTitle={
                      graph.cards.find(
                        (card) => card.id === relationCompose.sourceCardId,
                      )?.text ?? ""
                    }
                    targetTitle={targetCard.text}
                    onChooseRelation={handleChooseRelation}
                    onCancel={handleCancelRelationCompose}
                  />
                </RelatedDiagramActionPopover>
              ) : null}
              {contextBarModel.kind === "connecting" && !relationCompose ? (
                <div className="pointer-events-none absolute inset-x-0 top-2 z-40 flex justify-center">
                  <RelatedDiagramContextBar
                    model={contextBarModel}
                    onCancelConnect={handleCancelConnect}
                  />
                </div>
              ) : null}
              {connectNotice ? (
                <p
                  data-rd-connect-notice
                  role="status"
                  className="pointer-events-none absolute left-3 top-14 z-50 rounded-md bg-[#1D1D1F] px-3 py-2 text-[13px] text-white"
                >
                  {connectNotice}
                </p>
              ) : null}
              {placementNotice ? (
                <p
                  data-rd-direct-card-notice={placementNotice.kind}
                  role="status"
                  className="pointer-events-none absolute left-3 top-14 z-50 max-w-[min(360px,calc(100vw-24px))] rounded-md bg-[#1D1D1F] px-3 py-2 text-[13px] text-white"
                >
                  {placementNotice.message}
                </p>
              ) : null}
              {cardTypeChooserOpen ? (
                <RelatedDiagramCardTypeChooser
                  anchor={resolveAddCardAnchorRect()}
                  viewport={
                    typeof window === "undefined"
                      ? viewportRect
                      : {
                          x: 0,
                          y: 0,
                          width: window.innerWidth,
                          height: window.innerHeight,
                        }
                  }
                  onDismiss={closeCardTypeChooser}
                  onChoose={handleChooseCardType}
                />
              ) : null}
            </>
          );
        })()}
        {insightDraft ? (
          <RelatedDiagramDirectInsightDrawer
            draft={insightDraft}
            canAdd={canCommitDirectInsightCompose(insightDraft)}
            onChangeText={(text) =>
              setInsightDraft((current) =>
                current ? { ...current, text } : current,
              )
            }
            onChangeState={(state) =>
              setInsightDraft((current) =>
                current ? { ...current, state } : current,
              )
            }
            onCancel={closeDirectInsightCompose}
            onAdd={handleAddDirectInsight}
          />
        ) : null}
        {nursingProblemDraft ? (
          <RelatedDiagramDirectNursingProblemDrawer
            draft={nursingProblemDraft}
            canAdd={canCommitDirectInsightCompose(nursingProblemDraft)}
            onChangeText={(text) =>
              setNursingProblemDraft((current) =>
                current ? { ...current, text } : current,
              )
            }
            onChangeState={(state) =>
              setNursingProblemDraft((current) =>
                current ? { ...current, state } : current,
              )
            }
            onCancel={closeDirectNursingProblemCompose}
            onAdd={handleAddDirectNursingProblem}
          />
        ) : null}
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
            knowledgeLabel={null}
            routeTopology={topology}
            stableRouteState={routeState}
          />
        </div>
      </RelatedDiagramPrintPortal>
    </main>
  );
}
