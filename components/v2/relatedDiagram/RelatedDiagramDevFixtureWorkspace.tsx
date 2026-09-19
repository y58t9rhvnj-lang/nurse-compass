"use client";

/**
 * DEV-only Slice 2A / 2B-1 A3 workspace for iPad / LAN touch verification.
 * Uses the same viewport + surface + connection renderers as student runtime,
 * but loads resolveDevFixtureReadonlyScene (never used by student production path).
 * Positions stay in local React state. No draft persistence.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
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
import {
  commitStudentConnectionCreate,
  connectNoticeForCode,
  evaluateConnectTarget,
  type RelationComposeDraft,
} from "@/lib/v2/relatedDiagram/cardConnectionCreate";
import {
  canCommitDirectInsightCompose,
  emptyDirectInsightComposeDraft,
  type DirectInsightComposeDraft,
} from "@/lib/v2/relatedDiagram/cardDirectInsight";
import {
  canOpenDirectCardTypeChooser,
  commitDirectNursingProblemCreate,
  commitDirectUnderstandingCreate,
  directCardCreateSelectionUi,
  resolveAddCardAnchorRect,
  type DirectCardCreateType,
  type DirectCardPlacementNotice,
} from "@/lib/v2/relatedDiagram/cardDirectCreate";
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
  applyConnectionTapCancel,
  applyConnectionTapPointerDown,
  applyConnectionTapPointerUp,
  applyConnectionTapSecondPointer,
  changeStudentConnectionRelation,
  connectionPermissions,
  connectionTapAnchorRect,
  createIdleConnectionTap,
  deleteManagedConnection,
  isRelatedDiagramConnectionHitTarget,
  pickSelectableConnectionAtPoint,
  REVERSE_CONNECTION_NOTICE,
  reverseStudentConnection,
} from "@/lib/v2/relatedDiagram/cardConnectionManage";
import {
  cloneStableRouteState,
  seedStableRouteState,
  stableRoutesList,
  type StableRouteState,
} from "@/lib/v2/relatedDiagram/incrementalRoutes";
import {
  selectedCardIdFromSelection,
  selectedConnectionIdFromSelection,
  selectionFromCardId,
} from "@/lib/v2/relatedDiagram/diagramSelection";
import type { RelatedDiagramSemanticGraph } from "@/lib/v2/relatedDiagram/types";
import type {
  RelatedDiagramForm3AssessmentSource,
  RelatedDiagramForm3InformationSource,
} from "@/lib/v2/relatedDiagram/form3AssessmentReadModel";
import type { NormalizedAssessmentSelection } from "@/lib/v2/relatedDiagram/form3AssessmentSelection";
import {
  trackPointerDown,
  trackPointerUp,
} from "@/lib/v2/relatedDiagram/actionPopoverGesture";
import { cardScreenRect } from "@/lib/v2/relatedDiagram/actionPopoverPlacement";
import RelatedDiagramA3Surface from "./RelatedDiagramA3Surface";
import RelatedDiagramActionPopover from "./RelatedDiagramActionPopover";
import RelatedDiagramConnectionActionBar from "./RelatedDiagramConnectionActionBar";
import RelatedDiagramCardDeleteConfirm from "./RelatedDiagramCardDeleteConfirm";
import RelatedDiagramCardEditDrawer from "./RelatedDiagramCardEditDrawer";
import RelatedDiagramContextBar from "./RelatedDiagramContextBar";
import RelatedDiagramCardTypeChooser from "./RelatedDiagramCardTypeChooser";
import RelatedDiagramDirectInsightDrawer from "./RelatedDiagramDirectInsightDrawer";
import RelatedDiagramDirectNursingProblemDrawer from "./RelatedDiagramDirectNursingProblemDrawer";
import RelatedDiagramEditorToolbar from "./RelatedDiagramEditorToolbar";
import RelatedDiagramRelationComposeBar from "./RelatedDiagramRelationComposeBar";
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

  const [selectedConnectionId, setSelectedConnectionId] = useState<
    string | null
  >(null);
  const [connectionAnchor, setConnectionAnchor] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const connectionTapRef = useRef(createIdleConnectionTap());
  const connectionPointersRef = useRef(new Set<number>());

  const diagramSelection = useMemo(() => {
    if (selectedConnectionId) {
      return {
        kind: "connection" as const,
        connectionId: selectedConnectionId,
      };
    }
    return selectionFromCardId(selectedCardId);
  }, [selectedCardId, selectedConnectionId]);
  const selectedCard = useMemo(
    () =>
      graph.cards.find(
        (card) => card.id === selectedCardIdFromSelection(diagramSelection),
      ) ?? null,
    [diagramSelection, graph.cards],
  );
  const selectedConnection = useMemo(() => {
    const connectionId = selectedConnectionIdFromSelection(diagramSelection);
    if (!connectionId) return null;
    const connection =
      graph.connections.find((row) => row.id === connectionId) ?? null;
    if (!connection || !connectionPermissions(connection).selectable) {
      return null;
    }
    return connection;
  }, [diagramSelection, graph.connections]);
  const selectedCapabilities = useMemo(
    () => (selectedCard ? getCardActionCapabilities(selectedCard) : null),
    [selectedCard],
  );
  const [actionIntent, setActionIntent] = useState<CardActionIntent | null>(
    null,
  );
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
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const editorMode = resolveRelatedDiagramEditorMode({
    selection: diagramSelection,
    form3Open: drawerOpen,
    editOpen: editDraft != null && actionIntent?.kind === "edit",
    connecting: actionIntent?.kind === "connect",
    directInsightOpen: insightDraft != null,
    directNursingProblemOpen: nursingProblemDraft != null,
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
    setInsightDraft(null);
    setNursingProblemDraft(null);
    setCardTypeChooserOpen(false);
    setRelationCompose(null);
    setDeleteConfirmOpen(false);
  }, [selectedCardId]);

  useEffect(() => {
    if (!selectedCardId) return;
    setSelectedConnectionId(null);
    setConnectionAnchor(null);
    connectionTapRef.current = createIdleConnectionTap();
  }, [selectedCardId]);

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
    setInsightDraft(null);
    setNursingProblemDraft(null);
    setCardTypeChooserOpen(false);
    if (actionIntent?.kind === "edit") setActionIntent(null);
    setDrawerOpen((open) => !open);
  }, [actionIntent]);

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
    setDrawerOpen(false);
    setEditDraft(null);
    setInsightDraft(null);
    setNursingProblemDraft(null);
    if (actionIntent?.kind === "edit") setActionIntent(null);
    setCardTypeChooserOpen(true);
  }, [actionIntent, cardTypeChooserOpen]);

  const openDirectInsightCompose = useCallback(() => {
    if (actionIntent?.kind === "connect") return;
    setCardTypeChooserOpen(false);
    setDrawerOpen(false);
    setEditDraft(null);
    setNursingProblemDraft(null);
    if (actionIntent?.kind === "edit") setActionIntent(null);
    setInsightDraft(emptyDirectInsightComposeDraft());
  }, [actionIntent]);

  const openDirectNursingProblemCompose = useCallback(() => {
    if (actionIntent?.kind === "connect") return;
    setCardTypeChooserOpen(false);
    setDrawerOpen(false);
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
    setInsightDraft(null);
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
    setInsightDraft(null);
    setEditDraft(null);
    setRelationCompose(null);
    setConnectNotice(null);
    suppressConnectTapRef.current = false;
    setSelectedConnectionId(null);
    setConnectionAnchor(null);
    connectionTapRef.current = createIdleConnectionTap();
    setActionIntent(intent);
  }, [selectedCard]);

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

  const clearConnectionSelection = useCallback(() => {
    connectionTapRef.current = createIdleConnectionTap();
    setSelectedConnectionId(null);
    setConnectionAnchor(null);
  }, []);

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

  const handleConnectionPointerDown = useCallback(
    (event: ReactPointerEvent<SVGPathElement>) => {
      if (actionIntent?.kind === "connect") return;
      if (event.pointerType === "touch" && event.isPrimary === false) return;
      const viewport = viewportElRef.current?.getBoundingClientRect();
      if (!viewport) return;
      const picked = pickSelectableConnectionAtPoint({
        point: clientToLogical(
          { x: event.clientX, y: event.clientY },
          { x: viewport.left, y: viewport.top },
          transform,
        ),
        cards: graph.cards,
        connections: graph.connections,
        routes: stableRoutesList(routeState),
      });
      if (!picked) return;
      connectionTapRef.current = applyConnectionTapPointerDown(
        connectionTapRef.current,
        {
          pointerId: event.pointerId,
          connectionId: picked.connectionId,
          clientX: event.clientX,
          clientY: event.clientY,
          isPrimary: event.isPrimary,
          pointerCount: Math.max(1, connectionPointersRef.current.size),
        },
      );
    },
    [actionIntent, graph.cards, graph.connections, routeState, transform],
  );

  const handleSurfacePointerDownWrapped = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (isRelatedDiagramConnectionHitTarget(event.target)) return;
      clearConnectionSelection();
      onSurfacePointerDown(event);
    },
    [clearConnectionSelection, onSurfacePointerDown],
  );

  useEffect(() => {
    const pointers = connectionPointersRef.current;
    const onDown = (event: PointerEvent) => {
      const count = trackPointerDown(pointers, event.pointerId);
      if (count >= 2) {
        connectionTapRef.current = applyConnectionTapSecondPointer(
          connectionTapRef.current,
        );
      }
    };
    const onUp = (event: PointerEvent) => {
      trackPointerUp(pointers, event.pointerId);
      const result = applyConnectionTapPointerUp(
        connectionTapRef.current,
        event.pointerId,
      );
      connectionTapRef.current = result.state;
      if (!result.commit) return;
      selectCard(null);
      setSelectedConnectionId(result.commit.connectionId);
      setConnectionAnchor(
        connectionTapAnchorRect(result.commit.clientX, result.commit.clientY),
      );
    };
    const onCancel = (event: PointerEvent) => {
      trackPointerUp(pointers, event.pointerId);
      connectionTapRef.current = applyConnectionTapCancel(
        connectionTapRef.current,
      );
    };
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("pointercancel", onCancel, true);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", onCancel, true);
    };
  }, [selectCard]);

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
      onCardPointerDown(card, event);
    },
    [actionIntent, onCardPointerDown],
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
      onCardPointerUp(event);
      setRevealCardActions(true);
    },
    [actionIntent, handleConnectTargetTap, onCardPointerUp],
  );

  const handleOpenSource = useCallback(() => {
    if (actionIntent?.kind === "connect") return;
    if (!selectedForm3Source?.patternId) return;
    setEditDraft(null);
    setInsightDraft(null);
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
      data-rd-2b2d="true"
      data-rd-2b2e1="true"
      data-rd-2b2f1="true"
      data-rd-2b2f2="true"
      data-rd-2b2g1="true"
      data-rd-editor-mode={editorMode}
      data-rd-editor-selection={diagramSelection.kind}
      className="fixed inset-0 flex min-h-0 min-w-0 flex-col overflow-hidden overscroll-none bg-[#EDEDF0]"
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
        onAddCard={openCardTypeChooser}
        addCardOpen={cardTypeChooserOpen}
        devTitle={`Slice 2B-2G-1 · DEV fixture · ${scene.knowledgeTitle} · ${scene.knowledgeVersion} · not student runtime`}
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
            knowledgeLabel={scene.knowledgeTitle}
            routeTopology={topology}
            stableRouteState={routeState}
            interactive
            selectedCardId={selectedCardId}
            selectedConnectionId={selectedConnectionId}
            onConnectionPointerDown={
              actionIntent?.kind === "connect"
                ? undefined
                : handleConnectionPointerDown
            }
            connectSourceCardId={
              actionIntent?.kind === "connect" ? actionIntent.sourceCardId : null
            }
            connectTargetCardId={relationCompose?.targetCardId ?? null}
            selectedGroup={selectedGroup}
            previewCardId={draggingCardId}
            onCardPointerDown={handleConnectingCardPointerDown}
            onCardPointerMove={onCardPointerMove}
            onCardPointerUp={handleConnectingCardPointerUp}
            onGroupHandlePointerDown={
              actionIntent?.kind === "connect"
                ? undefined
                : onGroupHandlePointerDown
            }
            onSurfacePointerDown={
              actionIntent?.kind === "connect"
                ? undefined
                : handleSurfacePointerDownWrapped
            }
            routeDebug={routeDebug}
            routeCost={routeCost}
          />
        </div>
      </div>
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
        const showCardPopover =
          selectedCard != null &&
          revealCardActions &&
          contextBarModel.kind === "card" &&
          editDraft == null &&
          !deleteConfirmOpen &&
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
                  onDelete={requestDeleteSelected}
                  onOpenSource={handleOpenSource}
                  onCancelConnect={handleCancelConnect}
                />
              </RelatedDiagramActionPopover>
            ) : null}
            {selectedConnection && connectionAnchor ? (
              <RelatedDiagramActionPopover
                kind="connection"
                anchor={connectionAnchor}
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
            {placementNotice ? (
              <p
                data-rd-direct-card-notice={placementNotice.kind}
                role="status"
                className="pointer-events-none absolute left-3 top-14 z-50 max-w-[min(360px,calc(100vw-24px))] rounded-md bg-[#1D1D1F] px-3 py-2 text-[13px] text-white"
              >
                {placementNotice.message}
              </p>
            ) : null}
          </>
        );
      })()}
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
            knowledgeLabel={scene.knowledgeTitle}
            routeTopology={topology}
            stableRouteState={routeState}
          />
        </div>
      </RelatedDiagramPrintPortal>
    </main>
  );
}
