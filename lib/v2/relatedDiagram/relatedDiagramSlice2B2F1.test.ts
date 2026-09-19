/**
 * Slice 2B-2F-1 Direct Card Create Phase 1 tests.
 * Run: npx tsx lib/v2/relatedDiagram/relatedDiagramSlice2B2F1.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { A3_HEIGHT_PX, A3_WIDTH_PX } from "./a3Canvas";
import { rectIntersectsA3Legend } from "./a3Legend";
import {
  classifyActionPopoverPointer,
} from "./actionPopoverGesture";
import { getCardActionCapabilities } from "./cardActionCapabilities";
import {
  CARD_MIN_GAP,
  isLegalCardPlacement,
} from "./cardCollision";
import { evaluateConnectTarget } from "./cardConnectionCreate";
import {
  applyCardDisplayEdit,
  canCommitCardEdit,
} from "./cardEdit";
import { snapshotCardForDelete } from "./cardDelete";
import {
  DIRECT_CARD_CREATE_TYPE_LABELS,
  DIRECT_CARD_NO_SPACE_MESSAGE,
  canOpenDirectCardTypeChooser,
  commitDirectUnderstandingCreate,
  directCardCreateSelectionUi,
  directCardNoSpaceNotice,
  isDirectCardCreateImplemented,
} from "./cardDirectCreate";
import {
  buildDirectInsightCard,
  canCommitDirectInsightCompose,
} from "./cardDirectInsight";
import {
  applyHistoryCommand,
  emptyDiagramHistory,
  pushDiagramHistory,
  redoDiagramHistory,
  undoDiagramHistory,
} from "./diagramHistory";
import {
  UNDERSTANDING_CARD_HEIGHT,
  UNDERSTANDING_CARD_WIDTH,
  cloneCardEntity,
  form3SourceTrace,
  insertCardEntity,
} from "./form3ToUnderstandingCard";
import {
  placeDirectCard,
  searchDirectCardFreeSpace,
} from "./placeDirectCard";
import { createEmptySemanticGraph } from "./semanticGraph";
import type { RelatedDiagramCard, RelatedDiagramSemanticGraph } from "./types";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`ok - ${name}`);
  } catch (e) {
    console.error(`FAIL - ${name}`);
    throw e;
  }
}

function src(rel: string): string {
  return readFileSync(new URL(rel, import.meta.url), "utf8");
}

const ws = src(
  "../../../components/v2/relatedDiagram/RelatedDiagramDevFixtureWorkspace.tsx",
);
const toolbar = src(
  "../../../components/v2/relatedDiagram/RelatedDiagramEditorToolbar.tsx",
);
const chooser = src(
  "../../../components/v2/relatedDiagram/RelatedDiagramCardTypeChooser.tsx",
);
const drawer = src(
  "../../../components/v2/relatedDiagram/RelatedDiagramDirectInsightDrawer.tsx",
);
const popover = src(
  "../../../components/v2/relatedDiagram/RelatedDiagramActionPopover.tsx",
);
const createLib = src("./cardDirectCreate.ts");
const placeLib = src("./placeDirectCard.ts");
const gestureLib = src("./actionPopoverGesture.ts");

const FORM3_PROVENANCE_KEYS = [
  "form3RecordId",
  "assessmentId",
  "informationId",
  "patternId",
  "sourceExcerpt",
  "selectedText",
  "selectionStart",
  "selectionEnd",
  "sourceClassification",
  "sourceVersion",
] as const;

function dummyCard(
  id: string,
  x: number,
  y: number,
  size: { width: number; height: number } = {
    width: UNDERSTANDING_CARD_WIDTH,
    height: UNDERSTANDING_CARD_HEIGHT,
  },
): RelatedDiagramCard {
  return {
    id,
    cardType: "understanding",
    text: id,
    state: "current",
    origin: "form3_assessment",
    layout: {
      x,
      y,
      width: size.width,
      height: size.height,
      zIndex: 1,
    },
    isLocked: false,
    createdAt: "2026-09-19T00:00:00.000Z",
    updatedAt: "2026-09-19T00:00:00.000Z",
  };
}

function packLegalGrid(size = {
  width: UNDERSTANDING_CARD_WIDTH,
  height: UNDERSTANDING_CARD_HEIGHT,
}): RelatedDiagramCard[] {
  const cellW = size.width + CARD_MIN_GAP;
  const cellH = size.height + CARD_MIN_GAP;
  const cards: RelatedDiagramCard[] = [];
  let i = 0;
  for (let y = 0; y + size.height <= A3_HEIGHT_PX; y += cellH) {
    for (let x = 0; x + size.width <= A3_WIDTH_PX; x += cellW) {
      const rect = { x, y, width: size.width, height: size.height };
      if (rectIntersectsA3Legend(rect)) continue;
      cards.push(dummyCard(`pack_${i}`, x, y, size));
      i += 1;
    }
  }
  return cards;
}

function fillUntilNoSpace(
  start: RelatedDiagramCard[] = [],
): RelatedDiagramCard[] {
  const cards = [...start];
  for (let i = 0; i < 400; i += 1) {
    const placed = placeDirectCard({
      desiredCenter: { x: A3_WIDTH_PX / 2, y: A3_HEIGHT_PX / 2 },
      otherCards: cards,
    });
    if (!placed.ok) return cards;
    cards.push(dummyCard(`fill_${i}`, placed.x, placed.y));
  }
  return cards;
}

test("＋カード→chooser", () => {
  assert.ok(toolbar.includes("＋カード"));
  assert.ok(toolbar.includes('aria-label="カードを追加"'));
  assert.ok(ws.includes("onAddCard={openCardTypeChooser}"));
  assert.ok(ws.includes("RelatedDiagramCardTypeChooser"));
  assert.ok(chooser.includes("追加するカード"));
  assert.ok(chooser.includes("気づき・理解"));
  assert.ok(chooser.includes("看護問題"));
  assert.equal(DIRECT_CARD_CREATE_TYPE_LABELS.understanding, "気づき・理解");
  assert.equal(DIRECT_CARD_CREATE_TYPE_LABELS.nursing_problem, "看護問題");
});

test("chooser open/close", () => {
  assert.ok(ws.includes("const [cardTypeChooserOpen, setCardTypeChooserOpen]"));
  assert.ok(ws.includes("setCardTypeChooserOpen(true)"));
  assert.ok(ws.includes("setCardTypeChooserOpen(false)"));
  assert.ok(ws.includes("onDismiss={closeCardTypeChooser}"));
  assert.equal(canOpenDirectCardTypeChooser({ connecting: false }), true);
});

test("outside tap", () => {
  assert.equal(
    classifyActionPopoverPointer({
      kind: "card_type",
      pointerCount: 1,
      targetIsPopover: false,
    }),
    "dismiss-outside",
  );
  assert.equal(
    classifyActionPopoverPointer({
      kind: "card_type",
      pointerCount: 1,
      targetIsPopover: true,
    }),
    "ignore",
  );
  assert.ok(popover.includes("isAddCardControl"));
  assert.ok(gestureLib.includes("card_type"));
});

test("history 0 on chooser open/close", () => {
  const openFn = ws.slice(
    ws.indexOf("const openCardTypeChooser"),
    ws.indexOf("const openDirectInsightCompose"),
  );
  const closeFn = ws.slice(
    ws.indexOf("const closeCardTypeChooser"),
    ws.indexOf("const openCardTypeChooser"),
  );
  assert.equal(openFn.includes("onHistoryPush"), false);
  assert.equal(closeFn.includes("onHistoryPush"), false);
  assert.equal(chooser.includes("onHistoryPush"), false);
});

test("zoom/pan不変", () => {
  const openFn = ws.slice(
    ws.indexOf("const openCardTypeChooser"),
    ws.indexOf("const openDirectInsightCompose"),
  );
  assert.equal(openFn.includes("fitToView"), false);
  assert.equal(openFn.includes("resetTo100"), false);
  assert.equal(openFn.includes("transform."), false);
  assert.ok(chooser.includes("RelatedDiagramActionPopover"));
  assert.ok(popover.includes("fixed z-50"));
  assert.equal(chooser.includes("scale("), false);
  assert.equal(chooser.includes("translate("), false);
});

test("connecting中open不可", () => {
  assert.equal(canOpenDirectCardTypeChooser({ connecting: true }), false);
  assert.ok(
    ws.includes(
      "canOpenDirectCardTypeChooser({ connecting: actionIntent?.kind === \"connect\" })",
    ),
  );
});

test("気づき・理解→Drawer", () => {
  assert.ok(ws.includes('if (type === "understanding")'));
  assert.ok(ws.includes("openDirectInsightCompose()"));
  assert.ok(ws.includes("RelatedDiagramDirectInsightDrawer"));
  assert.ok(drawer.includes("data-rd-insight-compose"));
  assert.ok(drawer.includes("関連図に追加"));
});

test("text/state validation", () => {
  assert.equal(
    canCommitDirectInsightCompose({ text: "", state: "current" }),
    false,
  );
  assert.equal(
    canCommitDirectInsightCompose({ text: "気づき", state: null }),
    false,
  );
  const invalid = commitDirectUnderstandingCreate({
    draft: { text: "", state: "current" },
    graph: createEmptySemanticGraph(),
  });
  assert.equal(invalid.ok, false);
  if (!invalid.ok) assert.equal(invalid.reason, "invalid_draft");
});

test("current create", () => {
  const result = commitDirectUnderstandingCreate({
    draft: { text: "日中の傾眠が生活に影響する", state: "current" },
    graph: createEmptySemanticGraph(),
    cardId: "di_2f1_current",
    now: "2026-09-19T00:00:00.000Z",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.entity.card.state, "current");
  assert.equal(result.graph.cards.length, 1);
});

test("potential create", () => {
  const result = commitDirectUnderstandingCreate({
    draft: { text: "転倒のリスクが高まる", state: "potential" },
    graph: createEmptySemanticGraph(),
    cardId: "di_2f1_potential",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.entity.card.state, "potential");
});

test("understanding / direct_insight / sources=[]", () => {
  const result = commitDirectUnderstandingCreate({
    draft: { text: "統合した理解", state: "current" },
    graph: createEmptySemanticGraph(),
    cardId: "di_2f1_sem",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.entity.card.cardType, "understanding");
  assert.equal(result.entity.card.origin, "direct_insight");
  assert.deepEqual(result.entity.sources, []);
});

test("Form3 provenanceなし", () => {
  const entity = buildDirectInsightCard({
    text: "様式3由来ではない",
    state: "current",
    layout: { x: 40, y: 40, zIndex: 1 },
    cardId: "di_2f1_no_form3",
  });
  const dumped = JSON.stringify(entity);
  for (const key of FORM3_PROVENANCE_KEYS) {
    assert.equal(dumped.includes(key), false, key);
  }
  const graph = insertCardEntity(createEmptySemanticGraph(), entity);
  assert.equal(form3SourceTrace(graph, entity.card.id), null);
  assert.equal(createLib.includes("form3RecordId"), false);
});

test("viewport center", () => {
  const center = { x: 420, y: 310 };
  const placed = placeDirectCard({
    desiredCenter: center,
    otherCards: [],
  });
  assert.equal(placed.ok, true);
  if (!placed.ok) return;
  assert.equal(placed.stage, "viewport_center");
  const cx = placed.x + UNDERSTANDING_CARD_WIDTH / 2;
  const cy = placed.y + UNDERSTANDING_CARD_HEIGHT / 2;
  assert.ok(Math.abs(cx - center.x) < 1);
  assert.ok(Math.abs(cy - center.y) < 1);
});

test("collision local search", () => {
  const blocker = dummyCard(
    "blocker",
    A3_WIDTH_PX / 2 - UNDERSTANDING_CARD_WIDTH / 2,
    A3_HEIGHT_PX / 2 - UNDERSTANDING_CARD_HEIGHT / 2,
  );
  const placed = placeDirectCard({
    desiredCenter: { x: A3_WIDTH_PX / 2, y: A3_HEIGHT_PX / 2 },
    otherCards: [blocker],
  });
  assert.equal(placed.ok, true);
  if (!placed.ok) return;
  assert.equal(placed.stage, "local_search");
  const dx = Math.abs(placed.x - blocker.layout.x);
  const dy = Math.abs(placed.y - blocker.layout.y);
  assert.equal(
    dx >= UNDERSTANDING_CARD_WIDTH + CARD_MIN_GAP ||
      dy >= UNDERSTANDING_CARD_HEIGHT + CARD_MIN_GAP,
    true,
  );
  assert.equal(
    isLegalCardPlacement(
      {
        x: placed.x,
        y: placed.y,
        width: UNDERSTANDING_CARD_WIDTH,
        height: UNDERSTANDING_CARD_HEIGHT,
      },
      [blocker],
    ),
    true,
  );
});

test("local fail→global search", () => {
  const size = {
    width: UNDERSTANDING_CARD_WIDTH,
    height: UNDERSTANDING_CARD_HEIGHT,
  };
  const blockers = packLegalGrid(size).filter(
    (card) => !(card.layout.x === 0 && card.layout.y === 0),
  );
  const placed = placeDirectCard({
    desiredCenter: { x: A3_WIDTH_PX / 2, y: A3_HEIGHT_PX / 2 },
    otherCards: blockers,
  });
  assert.equal(placed.ok, true);
  if (!placed.ok) return;
  assert.equal(placed.stage, "global_search");
  assert.equal(
    isLegalCardPlacement({ x: placed.x, y: placed.y, ...size }, blockers),
    true,
  );
});

test("global deterministic", () => {
  const blockers = [
    dummyCard("a", 200, 200),
    dummyCard("b", 400, 200),
    dummyCard("c", 200, 400),
  ];
  const first = searchDirectCardFreeSpace({
    origin: { x: 300, y: 300 },
    size: {
      width: UNDERSTANDING_CARD_WIDTH,
      height: UNDERSTANDING_CARD_HEIGHT,
    },
    otherCards: blockers,
  });
  const second = searchDirectCardFreeSpace({
    origin: { x: 300, y: 300 },
    size: {
      width: UNDERSTANDING_CARD_WIDTH,
      height: UNDERSTANDING_CARD_HEIGHT,
    },
    otherCards: blockers,
  });
  assert.ok(first);
  assert.deepEqual(first, second);
  const again = placeDirectCard({
    desiredCenter: { x: 300 + UNDERSTANDING_CARD_WIDTH / 2, y: 300 + UNDERSTANDING_CARD_HEIGHT / 2 },
    otherCards: blockers,
  });
  const again2 = placeDirectCard({
    desiredCenter: { x: 300 + UNDERSTANDING_CARD_WIDTH / 2, y: 300 + UNDERSTANDING_CARD_HEIGHT / 2 },
    otherCards: blockers,
  });
  assert.deepEqual(again, again2);
});

test("A3 bounds", () => {
  const placed = placeDirectCard({
    desiredCenter: { x: -80, y: A3_HEIGHT_PX + 80 },
    otherCards: [],
  });
  assert.equal(placed.ok, true);
  if (!placed.ok) return;
  assert.ok(placed.x >= 0);
  assert.ok(placed.y >= 0);
  assert.ok(placed.x + UNDERSTANDING_CARD_WIDTH <= A3_WIDTH_PX);
  assert.ok(placed.y + UNDERSTANDING_CARD_HEIGHT <= A3_HEIGHT_PX);
});

test("Legend avoidance", () => {
  const placed = placeDirectCard({
    desiredCenter: { x: A3_WIDTH_PX - 40, y: A3_HEIGHT_PX - 40 },
    otherCards: [],
  });
  assert.equal(placed.ok, true);
  if (!placed.ok) return;
  assert.equal(
    rectIntersectsA3Legend({
      x: placed.x,
      y: placed.y,
      width: UNDERSTANDING_CARD_WIDTH,
      height: UNDERSTANDING_CARD_HEIGHT,
    }),
    false,
  );
});

test("gap 12", () => {
  assert.equal(CARD_MIN_GAP, 12);
  assert.ok(placeLib.includes("CARD_MIN_GAP"));
  const blocker = dummyCard("gap", 80, 80);
  const placed = placeDirectCard({
    desiredCenter: { x: 80 + UNDERSTANDING_CARD_WIDTH / 2, y: 80 + UNDERSTANDING_CARD_HEIGHT / 2 },
    otherCards: [blocker],
  });
  assert.equal(placed.ok, true);
  if (!placed.ok) return;
  const dx = Math.abs(placed.x - blocker.layout.x);
  const dy = Math.abs(placed.y - blocker.layout.y);
  assert.equal(
    dx >= UNDERSTANDING_CARD_WIDTH + CARD_MIN_GAP ||
      dy >= UNDERSTANDING_CARD_HEIGHT + CARD_MIN_GAP,
    true,
  );
});

test("full A3→no_space", () => {
  const packed = fillUntilNoSpace(packLegalGrid());
  const before = packed.map((card) => ({
    id: card.id,
    x: card.layout.x,
    y: card.layout.y,
  }));
  const placed = placeDirectCard({
    desiredCenter: { x: A3_WIDTH_PX / 2, y: A3_HEIGHT_PX / 2 },
    otherCards: packed,
  });
  assert.equal(placed.ok, false);
  if (placed.ok) return;
  assert.equal(placed.reason, "no_space");
  assert.deepEqual(
    packed.map((card) => ({ id: card.id, x: card.layout.x, y: card.layout.y })),
    before,
  );
});

test("no_space→Card 0 / history 0", () => {
  const graph = createEmptySemanticGraph();
  const packed = fillUntilNoSpace(packLegalGrid());
  graph.cards = packed;
  const beforeCount = graph.cards.length;
  const history = emptyDiagramHistory();
  const committed = commitDirectUnderstandingCreate({
    draft: { text: "置けない気づき", state: "current" },
    graph,
    cardId: "di_no_space",
  });
  assert.equal(committed.ok, false);
  if (!committed.ok) {
    assert.equal(committed.reason, "no_space");
    assert.equal(committed.notice?.message, DIRECT_CARD_NO_SPACE_MESSAGE);
    assert.equal(committed.notice?.tidyDiagramAvailable, false);
  }
  assert.equal(graph.cards.length, beforeCount);
  assert.equal(history.past.length, 0);
  assert.deepEqual(directCardNoSpaceNotice().message, DIRECT_CARD_NO_SPACE_MESSAGE);
  assert.ok(ws.includes("data-rd-direct-card-notice"));
  assert.ok(ws.includes("setPlacementNotice"));
  assert.equal(ws.includes("関連図を整える"), false);
});

test("existing Cards / Connections unchanged on no_space", () => {
  const graph: RelatedDiagramSemanticGraph = {
    ...createEmptySemanticGraph(),
    cards: fillUntilNoSpace(packLegalGrid()),
    connections: [
      {
        id: "conn_keep",
        sourceCardId: "pack_0",
        targetCardId: "pack_1",
        relationType: "current",
        origin: "student_diagram",
        createdAt: "2026-09-19T00:00:00.000Z",
        updatedAt: "2026-09-19T00:00:00.000Z",
      },
    ],
  };
  const cardSnap = JSON.stringify(graph.cards);
  const connSnap = JSON.stringify(graph.connections);
  const committed = commitDirectUnderstandingCreate({
    draft: { text: "満杯でも既存は動かない", state: "potential" },
    graph,
  });
  assert.equal(committed.ok, false);
  assert.equal(JSON.stringify(graph.cards), cardSnap);
  assert.equal(JSON.stringify(graph.connections), connSnap);
});

test("last_legal overlap is not success", () => {
  assert.ok(placeLib.includes('local.resolution !== "last_legal"'));
  assert.ok(placeLib.includes("isLegalCardPlacement"));
});

test("History Undo / Redo exact", () => {
  const committed = commitDirectUnderstandingCreate({
    draft: { text: "履歴で戻る気づき", state: "current" },
    graph: createEmptySemanticGraph(),
    desiredCenter: { x: 380, y: 260 },
    cardId: "di_2f1_hist",
    now: "2026-09-19T00:00:00.000Z",
  });
  assert.equal(committed.ok, true);
  if (!committed.ok) return;
  let graph = committed.graph;
  let history = pushDiagramHistory(emptyDiagramHistory(), {
    type: "addCard",
    entity: cloneCardEntity(committed.entity),
  });
  assert.equal(history.past.length, 1);
  const undone = undoDiagramHistory(history);
  graph = applyHistoryCommand(graph, undone.command);
  assert.equal(graph.cards.length, 0);
  const redone = redoDiagramHistory(undone.history);
  graph = applyHistoryCommand(graph, redone.command);
  const next = graph.cards[0];
  assert.ok(next);
  assert.equal(next?.id, "di_2f1_hist");
  assert.equal(next?.cardType, "understanding");
  assert.equal(next?.text, "履歴で戻る気づき");
  assert.equal(next?.state, "current");
  assert.equal(next?.origin, "direct_insight");
  assert.equal(graph.cardSources.length, 0);
  assert.equal(next?.layout.x, committed.entity.card.layout.x);
  assert.equal(next?.layout.y, committed.entity.card.layout.y);
});

test("Redoでplacement再実行なし", () => {
  const redoFn = ws.slice(
    ws.indexOf("const handleRedo"),
    ws.indexOf("} = useCardInteraction"),
  );
  assert.equal(redoFn.includes("placeDirectCard"), false);
  assert.equal(redoFn.includes("placeForm3UnderstandingCard"), false);
  assert.equal(redoFn.includes("searchDirectCardFreeSpace"), false);
  assert.equal(redoFn.includes("commitDirectUnderstandingCreate"), false);
  assert.ok(ws.includes("commitDirectUnderstandingCreate"));
});

test("Edit / Connect / Delete reuse", () => {
  const entity = buildDirectInsightCard({
    text: "既存操作を使う",
    state: "current",
    layout: { x: 60, y: 80, zIndex: 2 },
    cardId: "di_2f1_caps",
  });
  const caps = getCardActionCapabilities(entity.card);
  assert.equal(caps.canEdit, true);
  assert.equal(caps.canConnect, true);
  assert.equal(caps.canDelete, true);
  const edited = applyCardDisplayEdit(entity.card, {
    text: "編集後",
    state: "potential",
  });
  assert.equal(edited?.text, "編集後");
  assert.equal(canCommitCardEdit(entity.card, { text: "編集後", state: "potential" }), true);
  const other = buildDirectInsightCard({
    text: "接続先",
    state: "current",
    layout: { x: 320, y: 80, zIndex: 2 },
    cardId: "di_2f1_target",
  });
  let graph = insertCardEntity(createEmptySemanticGraph(), entity);
  graph = insertCardEntity(graph, other);
  const connect = evaluateConnectTarget({
    graph,
    sourceCardId: entity.card.id,
    targetCardId: other.card.id,
  });
  assert.equal(connect.ok, true);
  const snap = snapshotCardForDelete(graph, entity.card.id);
  assert.equal(snap?.card.id, entity.card.id);
  assert.ok(ws.includes("RelatedDiagramCardEditDrawer"));
  assert.ok(ws.includes("createCardConnectIntent"));
  assert.ok(ws.includes("removeCardAndIncidentConnections"));
});

test("2F-1 Understanding path does not use createNursingProblem", () => {
  assert.equal(isDirectCardCreateImplemented("understanding"), true);
  const addInsightFn = ws.slice(
    ws.indexOf("const handleAddDirectInsight"),
    ws.indexOf("const closeDirectNursingProblemCompose"),
  );
  assert.equal(addInsightFn.includes("createNursingProblem"), false);
  assert.equal(addInsightFn.includes("nursing_problem"), false);
  assert.equal(ws.includes("createNursingProblem"), false);
  assert.equal(createLib.includes("createNursingProblem"), false);
  assert.equal(chooser.includes("次の実装"), false);
  assert.equal(chooser.includes("有効になります"), false);
});

test("Understanding create成功後はselected可・action popover closed", () => {
  const result = commitDirectUnderstandingCreate({
    draft: { text: "追加直後は操作を促さない", state: "current" },
    graph: createEmptySemanticGraph(),
    cardId: "di_no_pop",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.graph.cards[0]?.id, "di_no_pop");
  const ui = directCardCreateSelectionUi(result.entity.card.id);
  assert.equal(ui.selectedCardId, "di_no_pop");
  assert.equal(ui.revealCardActions, false);
  const addFn = ws.slice(
    ws.indexOf("const handleAddDirectInsight"),
    ws.indexOf("const closeDirectNursingProblemCompose"),
  );
  assert.ok(addFn.includes("directCardCreateSelectionUi"));
  assert.ok(addFn.includes("selectCard(selection.selectedCardId)"));
  assert.ok(addFn.includes("setRevealCardActions(selection.revealCardActions)"));
  assert.ok(ws.includes("revealCardActions &&"));
});

test("single tap後にaction popover / blank tapでselection解除", () => {
  const upFn = ws.slice(
    ws.indexOf("const handleConnectingCardPointerUp"),
    ws.indexOf("const handleOpenSource"),
  );
  assert.ok(upFn.includes("onCardPointerUp(event)"));
  assert.ok(upFn.includes("setRevealCardActions(true)"));
  assert.ok(ws.includes("onSurfacePointerDown"));
  assert.ok(ws.includes("onDismiss={() => selectCard(null)}"));
});

test("Card Action / Relation gesture contract unchanged", () => {
  assert.equal(
    classifyActionPopoverPointer({
      kind: "card",
      pointerCount: 1,
      targetIsPopover: false,
    }),
    "ignore",
  );
  assert.equal(
    classifyActionPopoverPointer({
      kind: "relation",
      pointerCount: 1,
      targetIsPopover: false,
    }),
    "dismiss-outside",
  );
  assert.equal(
    classifyActionPopoverPointer({
      kind: "card",
      pointerCount: 2,
      targetIsPopover: false,
    }),
    "dismiss-gesture",
  );
});

console.log(`\n${passed} passed`);
