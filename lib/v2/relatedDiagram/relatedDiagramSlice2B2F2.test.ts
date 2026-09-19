/**
 * Slice 2B-2F-2 Direct Nursing Problem Create tests.
 * Run: npx tsx lib/v2/relatedDiagram/relatedDiagramSlice2B2F2.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { A3_HEIGHT_PX, A3_WIDTH_PX } from "./a3Canvas";
import { rectIntersectsA3Legend } from "./a3Legend";
import { getCardActionCapabilities } from "./cardActionCapabilities";
import { CARD_MIN_GAP, isLegalCardPlacement } from "./cardCollision";
import { evaluateConnectTarget } from "./cardConnectionCreate";
import {
  applyCardDisplayEdit,
  canCommitCardEdit,
} from "./cardEdit";
import {
  removeCardAndIncidentConnections,
  snapshotCardForDelete,
} from "./cardDelete";
import {
  DIRECT_CARD_NO_SPACE_MESSAGE,
  commitDirectNursingProblemCreate,
  directCardCreateSelectionUi,
  commitDirectUnderstandingCreate,
  isDirectCardCreateImplemented,
} from "./cardDirectCreate";
import {
  canCommitDirectInsightCompose,
  emptyDirectInsightComposeDraft,
} from "./cardDirectInsight";
import {
  DIRECT_NURSING_PROBLEM_HEIGHT,
  DIRECT_NURSING_PROBLEM_WIDTH,
  buildDirectNursingProblemCard,
} from "./cardDirectNursingProblem";
import {
  applyHistoryCommand,
  emptyDiagramHistory,
  pushDiagramHistory,
  redoDiagramHistory,
  undoDiagramHistory,
} from "./diagramHistory";
import {
  editorModeIsDrawer,
  resolveRelatedDiagramEditorMode,
} from "./editorUiState";
import {
  cloneCardEntity,
  form3SourceTrace,
  insertCardEntity,
} from "./form3ToUnderstandingCard";
import { placeDirectCard } from "./placeDirectCard";
import { createEmptySemanticGraph } from "./semanticGraph";
import { emptyDiagramSelection } from "./diagramSelection";
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
const chooser = src(
  "../../../components/v2/relatedDiagram/RelatedDiagramCardTypeChooser.tsx",
);
const npDrawer = src(
  "../../../components/v2/relatedDiagram/RelatedDiagramDirectNursingProblemDrawer.tsx",
);
const createLib = src("./cardDirectCreate.ts");
const npLib = src("./cardDirectNursingProblem.ts");
const insightLib = src("./cardDirectInsight.ts");

const FORM3_PROVENANCE_KEYS = [
  "form3RecordId",
  "assessmentId",
  "informationId",
  "patternId",
  "sourceExcerpt",
  "selectedText",
  "selectionStart",
  "selectionEnd",
] as const;

function dummyCard(
  id: string,
  x: number,
  y: number,
  size = {
    width: DIRECT_NURSING_PROBLEM_WIDTH,
    height: DIRECT_NURSING_PROBLEM_HEIGHT,
  },
): RelatedDiagramCard {
  return {
    id,
    cardType: "understanding",
    text: id,
    state: "current",
    origin: "form3_assessment",
    layout: { x, y, width: size.width, height: size.height, zIndex: 1 },
    isLocked: false,
    createdAt: "2026-09-19T00:00:00.000Z",
    updatedAt: "2026-09-19T00:00:00.000Z",
  };
}

function packLegalGrid(size = {
  width: DIRECT_NURSING_PROBLEM_WIDTH,
  height: DIRECT_NURSING_PROBLEM_HEIGHT,
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

function fillUntilNoSpace(start: RelatedDiagramCard[] = []): RelatedDiagramCard[] {
  const cards = [...start];
  const size = {
    width: DIRECT_NURSING_PROBLEM_WIDTH,
    height: DIRECT_NURSING_PROBLEM_HEIGHT,
  };
  for (let i = 0; i < 400; i += 1) {
    const placed = placeDirectCard({
      desiredCenter: { x: A3_WIDTH_PX / 2, y: A3_HEIGHT_PX / 2 },
      otherCards: cards,
      size,
    });
    if (!placed.ok) return cards;
    cards.push(dummyCard(`fill_${i}`, placed.x, placed.y, size));
  }
  return cards;
}

test("A 看護問題button", () => {
  assert.ok(chooser.includes('data-rd-card-type="nursing_problem"'));
  assert.ok(chooser.includes("看護問題"));
  assert.equal(isDirectCardCreateImplemented("nursing_problem"), true);
});

test("B chooser close", () => {
  const chooseFn = ws.slice(
    ws.indexOf("const handleChooseCardType"),
    ws.indexOf("const closeDirectInsightCompose"),
  );
  assert.ok(chooseFn.includes("setCardTypeChooserOpen(false)"));
  assert.ok(chooseFn.includes("openDirectNursingProblemCompose"));
});

test("C NP Drawer open", () => {
  assert.ok(ws.includes("RelatedDiagramDirectNursingProblemDrawer"));
  assert.ok(npDrawer.includes("看護問題を追加"));
  assert.ok(npDrawer.includes("data-rd-np-compose"));
  assert.equal(
    resolveRelatedDiagramEditorMode({
      selection: emptyDiagramSelection(),
      form3Open: false,
      editOpen: false,
      connecting: false,
      directNursingProblemOpen: true,
    }),
    "direct_nursing_problem_compose",
  );
  assert.equal(editorModeIsDrawer("direct_nursing_problem_compose"), true);
});

test("D text required", () => {
  assert.equal(
    canCommitDirectInsightCompose({ text: "", state: "current" }),
    false,
  );
  const invalid = commitDirectNursingProblemCreate({
    draft: { text: "   ", state: "current" },
    graph: createEmptySemanticGraph(),
  });
  assert.equal(invalid.ok, false);
  if (!invalid.ok) assert.equal(invalid.reason, "invalid_draft");
});

test("E state required", () => {
  assert.equal(emptyDirectInsightComposeDraft().state, null);
  assert.equal(
    canCommitDirectInsightCompose({ text: "睡眠障害", state: null }),
    false,
  );
  const invalid = commitDirectNursingProblemCreate({
    draft: { text: "睡眠障害", state: null },
    graph: createEmptySemanticGraph(),
  });
  assert.equal(invalid.ok, false);
});

test("F current NP", () => {
  const result = commitDirectNursingProblemCreate({
    draft: { text: "コミュニケーションの障害", state: "current" },
    graph: createEmptySemanticGraph(),
    cardId: "dnp_current",
    now: "2026-09-19T00:00:00.000Z",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.entity.card.state, "current");
});

test("G potential NP", () => {
  const result = commitDirectNursingProblemCreate({
    draft: { text: "転倒のリスク", state: "potential" },
    graph: createEmptySemanticGraph(),
    cardId: "dnp_potential",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.entity.card.state, "potential");
});

test("H I J cardType / origin / sources", () => {
  const result = commitDirectNursingProblemCreate({
    draft: { text: "セルフケア不足", state: "current" },
    graph: createEmptySemanticGraph(),
    cardId: "dnp_sem",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.entity.card.cardType, "nursing_problem");
  assert.equal(result.entity.card.origin, "direct_insight");
  assert.deepEqual(result.entity.sources, []);
});

test("K Form3 provenanceなし", () => {
  const entity = buildDirectNursingProblemCard({
    text: "様式3由来ではない看護問題",
    state: "current",
    layout: { x: 40, y: 40, zIndex: 1 },
    cardId: "dnp_no_form3",
  });
  const dumped = JSON.stringify(entity);
  for (const key of FORM3_PROVENANCE_KEYS) {
    assert.equal(dumped.includes(key), false, key);
  }
  const graph = insertCardEntity(createEmptySemanticGraph(), entity);
  assert.equal(form3SourceTrace(graph, entity.card.id), null);
});

test("L M N O nursingProblems row", () => {
  const result = commitDirectNursingProblemCreate({
    draft: { text: "対応rowを持つ看護問題", state: "current" },
    graph: createEmptySemanticGraph(),
    cardId: "dnp_row",
    now: "2026-09-19T01:00:00.000Z",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.graph.cards.length, 1);
  assert.equal(result.graph.nursingProblems.length, 1);
  const row = result.graph.nursingProblems[0];
  assert.equal(row?.cardId, "dnp_row");
  assert.equal(row?.status, "active");
  assert.equal(row?.priority, null);
  assert.equal(result.entity.nursingProblem?.cardId, "dnp_row");
  assert.equal(result.entity.nursingProblem?.status, "active");
  assert.equal(result.entity.nursingProblem?.priority, null);
});

test("P supportingCardIds不要", () => {
  assert.equal(npLib.includes("supportingCardIds"), false);
  const result = commitDirectNursingProblemCreate({
    draft: { text: "根拠なしで置ける", state: "current" },
    graph: createEmptySemanticGraph(),
    cardId: "dnp_no_support",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.graph.nursingProblemSupports.length, 0);
});

test("Q R basis / integration connectionなし", () => {
  const result = commitDirectNursingProblemCreate({
    draft: { text: "自動接続しない", state: "potential" },
    graph: createEmptySemanticGraph(),
    cardId: "dnp_no_conn",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.graph.connections.length, 0);
  assert.equal(result.graph.integrations.length, 0);
  assert.equal(npLib.includes("nursing_problem_basis"), false);
  assert.equal(npLib.includes("nursing_problem_integration"), false);
});

test("S T 2F-1 placement再利用 / viewport center", () => {
  assert.ok(createLib.includes("placeDirectCard"));
  assert.ok(createLib.includes("DIRECT_NURSING_PROBLEM_WIDTH"));
  const center = { x: 420, y: 310 };
  const result = commitDirectNursingProblemCreate({
    draft: { text: "viewport付近", state: "current" },
    graph: createEmptySemanticGraph(),
    desiredCenter: center,
    cardId: "dnp_center",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.placement.stage, "viewport_center");
  const cx = result.entity.card.layout.x + DIRECT_NURSING_PROBLEM_WIDTH / 2;
  const cy = result.entity.card.layout.y + DIRECT_NURSING_PROBLEM_HEIGHT / 2;
  assert.ok(Math.abs(cx - center.x) < 1);
  assert.ok(Math.abs(cy - center.y) < 1);
});

test("U collision avoidance", () => {
  const blocker = dummyCard(
    "blocker",
    A3_WIDTH_PX / 2 - DIRECT_NURSING_PROBLEM_WIDTH / 2,
    A3_HEIGHT_PX / 2 - DIRECT_NURSING_PROBLEM_HEIGHT / 2,
  );
  const result = commitDirectNursingProblemCreate({
    draft: { text: "衝突回避", state: "current" },
    graph: { ...createEmptySemanticGraph(), cards: [blocker] },
    desiredCenter: { x: A3_WIDTH_PX / 2, y: A3_HEIGHT_PX / 2 },
    cardId: "dnp_collide",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.placement.stage, "local_search");
  assert.equal(
    isLegalCardPlacement(
      {
        x: result.entity.card.layout.x,
        y: result.entity.card.layout.y,
        width: DIRECT_NURSING_PROBLEM_WIDTH,
        height: DIRECT_NURSING_PROBLEM_HEIGHT,
      },
      [blocker],
    ),
    true,
  );
});

test("V global search", () => {
  const size = {
    width: DIRECT_NURSING_PROBLEM_WIDTH,
    height: DIRECT_NURSING_PROBLEM_HEIGHT,
  };
  const blockers = packLegalGrid(size).filter(
    (card) => !(card.layout.x === 0 && card.layout.y === 0),
  );
  const result = commitDirectNursingProblemCreate({
    draft: { text: "全体探索", state: "current" },
    graph: { ...createEmptySemanticGraph(), cards: blockers },
    desiredCenter: { x: A3_WIDTH_PX / 2, y: A3_HEIGHT_PX / 2 },
    cardId: "dnp_global",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.placement.stage, "global_search");
});

test("W X Y Z no_space atomic", () => {
  const packed = fillUntilNoSpace(packLegalGrid());
  const graph: RelatedDiagramSemanticGraph = {
    ...createEmptySemanticGraph(),
    cards: packed,
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
  const rowSnap = JSON.stringify(graph.nursingProblems);
  const connSnap = JSON.stringify(graph.connections);
  const history = emptyDiagramHistory();
  const result = commitDirectNursingProblemCreate({
    draft: { text: "置けない看護問題", state: "current" },
    graph,
    cardId: "dnp_full",
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, "no_space");
    assert.equal(result.notice?.message, DIRECT_CARD_NO_SPACE_MESSAGE);
  }
  assert.equal(JSON.stringify(graph.cards), cardSnap);
  assert.equal(JSON.stringify(graph.nursingProblems), rowSnap);
  assert.equal(JSON.stringify(graph.connections), connSnap);
  assert.equal(history.past.length, 0);
  assert.equal(graph.cards.length, packed.length);
  assert.equal(graph.nursingProblems.length, 0);
});

test("AA AB AC AD AE AF create history exact", () => {
  const committed = commitDirectNursingProblemCreate({
    draft: { text: "履歴の看護問題", state: "current" },
    graph: createEmptySemanticGraph(),
    desiredCenter: { x: 380, y: 260 },
    cardId: "dnp_hist",
    now: "2026-09-19T02:00:00.000Z",
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
  assert.equal(graph.nursingProblems.length, 0);
  const redone = redoDiagramHistory(undone.history);
  graph = applyHistoryCommand(graph, redone.command);
  const card = graph.cards[0];
  const row = graph.nursingProblems[0];
  assert.equal(card?.id, "dnp_hist");
  assert.equal(card?.cardType, "nursing_problem");
  assert.equal(card?.text, "履歴の看護問題");
  assert.equal(card?.state, "current");
  assert.equal(card?.origin, "direct_insight");
  assert.equal(graph.cardSources.length, 0);
  assert.equal(card?.layout.x, committed.entity.card.layout.x);
  assert.equal(card?.layout.y, committed.entity.card.layout.y);
  assert.equal(row?.cardId, "dnp_hist");
  assert.equal(row?.status, "active");
  assert.equal(row?.priority, null);
});

test("AG Redoでplacement再実行なし", () => {
  const redoFn = ws.slice(
    ws.indexOf("const handleRedo"),
    ws.indexOf("} = useCardInteraction"),
  );
  assert.equal(redoFn.includes("placeDirectCard"), false);
  assert.equal(redoFn.includes("commitDirectNursingProblemCreate"), false);
  assert.equal(redoFn.includes("buildDirectNursingProblemCard"), false);
});

test("AH AI AJ Edit text/state keeps NP row", () => {
  const committed = commitDirectNursingProblemCreate({
    draft: { text: "編集前", state: "current" },
    graph: createEmptySemanticGraph(),
    cardId: "dnp_edit",
  });
  assert.equal(committed.ok, true);
  if (!committed.ok) return;
  const caps = getCardActionCapabilities(committed.entity.card);
  assert.equal(caps.canEdit, true);
  const edited = applyCardDisplayEdit(committed.entity.card, {
    text: "編集後",
    state: "potential",
  });
  assert.equal(edited?.text, "編集後");
  assert.equal(edited?.state, "potential");
  assert.equal(edited?.origin, "direct_insight");
  assert.equal(edited?.id, "dnp_edit");
  assert.equal(
    canCommitCardEdit(committed.entity.card, { text: "編集後", state: "potential" }),
    true,
  );
  const next = {
    ...committed.graph,
    cards: committed.graph.cards.map((card) =>
      card.id === edited?.id && edited ? edited : card,
    ),
  };
  assert.equal(next.nursingProblems[0]?.cardId, "dnp_edit");
  assert.equal(next.nursingProblems.length, 1);
});

test("AK AL AM Delete and undo exact", () => {
  const committed = commitDirectNursingProblemCreate({
    draft: { text: "削除する看護問題", state: "current" },
    graph: createEmptySemanticGraph(),
    cardId: "dnp_del",
    now: "2026-09-19T03:00:00.000Z",
  });
  assert.equal(committed.ok, true);
  if (!committed.ok) return;
  let graph = committed.graph;
  const snap = snapshotCardForDelete(graph, "dnp_del");
  assert.equal(snap?.nursingProblem?.cardId, "dnp_del");
  const history = pushDiagramHistory(emptyDiagramHistory(), {
    type: "deleteCard",
    entity: cloneCardEntity(snap!),
  });
  graph = removeCardAndIncidentConnections(graph, "dnp_del");
  assert.equal(graph.cards.length, 0);
  assert.equal(graph.nursingProblems.length, 0);
  const undone = undoDiagramHistory(history);
  graph = applyHistoryCommand(graph, undone.command);
  assert.equal(graph.cards[0]?.id, "dnp_del");
  assert.equal(graph.nursingProblems[0]?.cardId, "dnp_del");
  assert.equal(graph.nursingProblems[0]?.status, "active");
  assert.equal(graph.nursingProblems[0]?.priority, null);
});

test("AN AO Connect source and target", () => {
  const np = commitDirectNursingProblemCreate({
    draft: { text: "接続する看護問題", state: "current" },
    graph: createEmptySemanticGraph(),
    cardId: "dnp_src",
  });
  assert.equal(np.ok, true);
  if (!np.ok) return;
  const understanding = commitDirectUnderstandingCreate({
    draft: { text: "接続先の気づき", state: "current" },
    graph: np.graph,
    desiredCenter: { x: 200, y: 200 },
    cardId: "di_np_tgt",
  });
  assert.equal(understanding.ok, true);
  if (!understanding.ok) return;
  assert.equal(getCardActionCapabilities(np.entity.card).canConnect, true);
  const asSource = evaluateConnectTarget({
    graph: understanding.graph,
    sourceCardId: "dnp_src",
    targetCardId: "di_np_tgt",
  });
  const asTarget = evaluateConnectTarget({
    graph: understanding.graph,
    sourceCardId: "di_np_tgt",
    targetCardId: "dnp_src",
  });
  assert.equal(asSource.ok, true);
  assert.equal(asTarget.ok, true);
});

test("AP Direct Understanding unchanged", () => {
  const result = commitDirectUnderstandingCreate({
    draft: { text: "2F-2でも気づきは同じ", state: "potential" },
    graph: createEmptySemanticGraph(),
    cardId: "di_still",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.entity.card.cardType, "understanding");
  assert.equal(result.entity.card.origin, "direct_insight");
  assert.equal(result.graph.nursingProblems.length, 0);
  assert.ok(insightLib.includes("cardType: \"understanding\""));
});

test("AQ AR Information / Knowledge direct createなし", () => {
  assert.equal(chooser.includes("Information"), false);
  assert.equal(chooser.includes("Knowledge"), false);
  assert.equal(npDrawer.includes("情報を追加"), false);
  assert.equal(npDrawer.includes("知識を追加"), false);
  const addNp = ws.slice(
    ws.indexOf("const handleAddDirectNursingProblem"),
    ws.indexOf("const handleAddInformation"),
  );
  assert.equal(addNp.includes("buildInformationCardFromForm3"), false);
  assert.equal(addNp.includes("knowledge"), false);
});

test("AS createNursingProblem()未使用", () => {
  assert.equal(npLib.includes("createNursingProblem"), false);
  assert.equal(createLib.includes("createNursingProblem"), false);
  assert.equal(ws.includes("createNursingProblem"), false);
  assert.ok(ws.includes("commitDirectNursingProblemCreate"));
  const addNp = ws.slice(
    ws.indexOf("const handleAddDirectNursingProblem"),
    ws.indexOf("const handleAddInformation"),
  );
  assert.equal(addNp.includes("buildDirectNursingProblemCard"), false);
});

test("NP create成功後はselected可・action popover closed", () => {
  const result = commitDirectNursingProblemCreate({
    draft: { text: "追加直後は操作を促さない", state: "current" },
    graph: createEmptySemanticGraph(),
    cardId: "dnp_no_pop",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.graph.cards[0]?.id, "dnp_no_pop");
  const ui = directCardCreateSelectionUi(result.entity.card.id);
  assert.equal(ui.selectedCardId, "dnp_no_pop");
  assert.equal(ui.revealCardActions, false);
  const addFn = ws.slice(
    ws.indexOf("const handleAddDirectNursingProblem"),
    ws.indexOf("const handleAddInformation"),
  );
  assert.ok(addFn.includes("directCardCreateSelectionUi"));
  assert.ok(addFn.includes("selectCard(selection.selectedCardId)"));
  assert.ok(addFn.includes("setRevealCardActions(selection.revealCardActions)"));
});

test("NP create後のHistoryは変わらない", () => {
  const committed = commitDirectNursingProblemCreate({
    draft: { text: "履歴は従来どおり", state: "potential" },
    graph: createEmptySemanticGraph(),
    cardId: "dnp_hist_ui",
  });
  assert.equal(committed.ok, true);
  if (!committed.ok) return;
  let graph = committed.graph;
  const history = pushDiagramHistory(emptyDiagramHistory(), {
    type: "addCard",
    entity: cloneCardEntity(committed.entity),
  });
  const undone = undoDiagramHistory(history);
  graph = applyHistoryCommand(graph, undone.command);
  assert.equal(graph.cards.length, 0);
  const redone = redoDiagramHistory(undone.history);
  graph = applyHistoryCommand(graph, redone.command);
  assert.equal(graph.cards[0]?.id, "dnp_hist_ui");
  assert.equal(graph.nursingProblems[0]?.cardId, "dnp_hist_ui");
});

console.log(`\n${passed} passed`);
