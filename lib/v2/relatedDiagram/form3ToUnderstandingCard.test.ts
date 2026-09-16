/**
 * Slice 2B-1 Information / Assessment-selection Card tests.
 * Run: npx tsx lib/v2/relatedDiagram/form3ToUnderstandingCard.test.ts
 */

import assert from "node:assert/strict";
import { createEmptySemanticGraph } from "./semanticGraph";
import {
  buildInformationCardFromForm3,
  buildUnderstandingCardFromAssessmentSelection,
  canCommitAssessmentCompose,
  cardHasConnections,
  commitAssessmentCompose,
  createAssessmentComposeDraft,
  form3SourceTrace,
  insertCardEntity,
  isForm3AssessmentSelectionAlreadyOnCanvas,
  isForm3InformationAlreadyOnCanvas,
  removeCardEntity,
} from "./form3ToUnderstandingCard";
import { initialUnderstandingStateFromForm3Classification } from "./form3AssessmentReadModel";
import type { Form3Judgment } from "../../form3/form3Types";
import { buildSchizophreniaForm3ReadModel } from "./fixtures/form3AssessmentSourceFixture";
import {
  applyHistoryCommand,
  emptyDiagramHistory,
  pushDiagramHistory,
  redoDiagramHistory,
  undoDiagramHistory,
} from "./diagramHistory";

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

const model = buildSchizophreniaForm3ReadModel();
const problem = model.assessments.find((a) => a.judgment === "problem")!;
const risk = model.assessments.find((a) =>
  a.assessmentText.includes("クエチアピン"),
)!;
const strength = model.assessments.find((a) => a.judgment === "strength")!;
const infoS = model.informations.find((i) => i.soType === "S")!;
const infoO = model.informations.find((i) => i.soType === "O")!;
const multi = model.informations.find((i) => i.patternKeys.length > 1)!;

function sliceOf(
  source: typeof problem,
  selectedText: string,
) {
  const selectionStart = source.assessmentText.indexOf(selectedText);
  assert.ok(selectionStart >= 0, selectedText);
  return {
    selectedText,
    selectionStart,
    selectionEnd: selectionStart + selectedText.length,
  };
}

function understanding(
  source: typeof problem,
  selection: ReturnType<typeof sliceOf>,
  layout: { x: number; y: number; zIndex: number },
  extras?: {
    editedText?: string;
    state?: "current" | "potential";
    now?: string;
  },
) {
  return buildUnderstandingCardFromAssessmentSelection({
    source,
    selection,
    editedText: extras?.editedText ?? selection.selectedText,
    state:
      extras?.state ?? (source.judgment === "risk" ? "potential" : "current"),
    layout,
    now: extras?.now,
  });
}

function withJudgment(source: typeof problem, judgment: Form3Judgment | null) {
  return { ...source, judgment };
}

test("Information becomes an Information Card with original text and S/O", () => {
  const entity = buildInformationCardFromForm3({
    source: infoS,
    layout: { x: 10, y: 20, zIndex: 1 },
  });
  assert.equal(entity.card.cardType, "information");
  assert.equal(entity.card.origin, "form3_information");
  assert.equal(entity.card.state, null);
  assert.equal(entity.card.text, infoS.content);
  const source = entity.sources[0]!;
  assert.equal(source.sourceType, "form3_information_card");
  assert.equal(source.sourceId, infoS.informationId);
  assert.equal(source.sourceExcerpt, infoS.content);
  assert.equal(source.sourceSoType, "S");
  assert.deepEqual(source.sourcePatterns, infoS.patternKeys);
});

test("O Information preserves soType", () => {
  const entity = buildInformationCardFromForm3({
    source: infoO,
    layout: { x: 10, y: 20, zIndex: 1 },
  });
  assert.equal(entity.sources[0]?.sourceSoType, "O");
});

test("multi-pattern Information is one source Card regardless of viewed pattern", () => {
  let graph = createEmptySemanticGraph();
  const first = buildInformationCardFromForm3({
    source: multi,
    viewedPatternId: multi.patternKeys[0],
    layout: { x: 10, y: 20, zIndex: 1 },
  });
  graph = insertCardEntity(graph, first);
  assert.equal(isForm3InformationAlreadyOnCanvas(graph, multi), true);
  const second = buildInformationCardFromForm3({
    source: multi,
    viewedPatternId: multi.patternKeys[1],
    layout: { x: 40, y: 80, zIndex: 2 },
  });
  graph = insertCardEntity(graph, second);
  assert.equal(graph.cards.length, 1);
  assert.equal(graph.cards[0]?.id, first.card.id);
});

test("Assessment partial selection becomes Understanding text without clipping", () => {
  const selection = sliceOf(problem, "夜間の幻聴");
  const entity = understanding(problem, selection, { x: 40, y: 50, zIndex: 3 });
  assert.equal(entity.card.cardType, "understanding");
  assert.equal(entity.card.origin, "form3_assessment");
  assert.equal(entity.card.text, "夜間の幻聴");
  assert.notEqual(entity.card.text, problem.assessmentText);
  const source = entity.sources[0]!;
  assert.equal(source.sourceExcerpt, problem.assessmentText);
  assert.equal(source.selectedText, "夜間の幻聴");
  assert.equal(
    problem.assessmentText.slice(source.selectionStart!, source.selectionEnd!),
    source.selectedText,
  );
});

test("same Assessment can create multiple overlapping selections", () => {
  let graph = createEmptySemanticGraph();
  const a = sliceOf(problem, "入眠が妨げられ");
  const b = sliceOf(problem, "入眠が妨げられ、翌日の活動に影響している");
  graph = insertCardEntity(
    graph,
    understanding(problem, a, { x: 10, y: 10, zIndex: 1 }),
  );
  graph = insertCardEntity(
    graph,
    understanding(problem, b, { x: 20, y: 90, zIndex: 2 }),
  );
  assert.equal(graph.cards.length, 2);
  assert.equal(
    isForm3AssessmentSelectionAlreadyOnCanvas(graph, {
      form3RecordId: problem.form3RecordId,
      assessmentId: problem.assessmentId,
      ...a,
    }),
    true,
  );
});

test("exact same selection is duplicate-blocked", () => {
  let graph = createEmptySemanticGraph();
  const selection = sliceOf(problem, "夜間の幻聴");
  const entity = understanding(problem, selection, { x: 10, y: 10, zIndex: 1 });
  graph = insertCardEntity(graph, entity);
  graph = insertCardEntity(graph, entity);
  assert.equal(graph.cards.length, 1);
});

test("risk selection keeps potential; origin stays independent of state", () => {
  const entity = understanding(
    risk,
    sliceOf(risk, risk.assessmentText.slice(0, 5)),
    { x: 10, y: 10, zIndex: 1 },
  );
  assert.equal(entity.card.origin, "form3_assessment");
  assert.equal(entity.card.state, "potential");
});

test("source trace routes Information and Assessment separately", () => {
  let graph = createEmptySemanticGraph();
  const info = buildInformationCardFromForm3({
    source: infoS,
    layout: { x: 10, y: 10, zIndex: 1 },
  });
  const assess = understanding(
    problem,
    sliceOf(problem, "夜間の幻聴"),
    { x: 20, y: 20, zIndex: 1 },
  );
  graph = insertCardEntity(graph, info);
  graph = insertCardEntity(graph, assess);
  const infoTrace = form3SourceTrace(graph, info.card.id);
  const assessTrace = form3SourceTrace(graph, assess.card.id);
  assert.equal(infoTrace?.originLabel, "様式3の情報から追加");
  assert.equal(infoTrace?.kind, "information");
  assert.equal(infoTrace?.soType, "S");
  assert.equal(assessTrace?.originLabel, "様式3のアセスメントから追加");
  assert.equal(assessTrace?.selectedText, "夜間の幻聴");
  assert.equal(assessTrace?.assessmentId, problem.assessmentId);
});

test("add undo/redo restores the exact card id, selection, position, and state", () => {
  const selection = sliceOf(problem, "夜間の幻聴");
  const entity = understanding(problem, selection, { x: 88, y: 99, zIndex: 4 }, {
    now: "2026-09-16T02:00:00.000Z",
  });
  let graph = insertCardEntity(createEmptySemanticGraph(), entity);
  let history = pushDiagramHistory(emptyDiagramHistory(), {
    type: "addCard",
    entity,
  });
  const undone = undoDiagramHistory(history);
  graph = applyHistoryCommand(graph, undone.command);
  history = undone.history;
  assert.equal(graph.cards.length, 0);
  const redone = redoDiagramHistory(history);
  graph = applyHistoryCommand(graph, redone.command);
  const restored = graph.cards[0]!;
  assert.equal(restored.id, entity.card.id);
  assert.equal(restored.text, "夜間の幻聴");
  assert.equal(graph.cardSources[0]?.selectionStart, selection.selectionStart);
  assert.equal(graph.cardSources[0]?.selectionEnd, selection.selectionEnd);
  assert.equal(restored.layout.x, 88);
});

test("delete undo/redo restores Information card + origin + position", () => {
  const entity = buildInformationCardFromForm3({
    source: infoO,
    layout: { x: 120, y: 140, zIndex: 2 },
  });
  let graph = insertCardEntity(createEmptySemanticGraph(), entity);
  graph = removeCardEntity(graph, entity.card.id);
  let history = pushDiagramHistory(emptyDiagramHistory(), {
    type: "deleteCard",
    entity,
  });
  const undone = undoDiagramHistory(history);
  graph = applyHistoryCommand(graph, undone.command);
  history = undone.history;
  assert.equal(graph.cards[0]?.id, entity.card.id);
  assert.equal(graph.cards[0]?.origin, "form3_information");
  assert.equal(graph.cardSources[0]?.sourceSoType, "O");
  const redone = redoDiagramHistory(history);
  graph = applyHistoryCommand(graph, redone.command);
  assert.equal(graph.cards.length, 0);
});

test("connected cards are reported so UI can block delete", () => {
  const entity = understanding(
    problem,
    sliceOf(problem, "夜間の幻聴"),
    { x: 20, y: 20, zIndex: 1 },
  );
  let graph = insertCardEntity(createEmptySemanticGraph(), entity);
  graph = {
    ...graph,
    connections: [
      {
        id: "c1",
        sourceCardId: entity.card.id,
        targetCardId: "other",
        relationType: "current",
        origin: "student_diagram",
        createdAt: entity.card.createdAt,
        updatedAt: entity.card.updatedAt,
      },
    ],
  };
  assert.equal(cardHasConnections(graph, entity.card.id), true);
});

const quote = "睡眠薬とクエチアピン追加により、日中傾眠が生じる可能性が";
const quoteSel = sliceOf(risk, quote);

test("1 selectedText is immutable after expression edit", () => {
  const entity = understanding(risk, quoteSel, { x: 10, y: 10, zIndex: 1 }, {
    editedText: "睡眠薬とクエチアピン追加により、日中傾眠が生じる可能性がある",
    state: "potential",
  });
  assert.equal(entity.sources[0]?.selectedText, quote);
  assert.notEqual(entity.card.text, entity.sources[0]?.selectedText);
});

test("2 editedText becomes card.text", () => {
  const edited = "睡眠薬とクエチアピン追加により、日中傾眠が生じる可能性がある";
  const entity = understanding(risk, quoteSel, { x: 10, y: 10, zIndex: 1 }, {
    editedText: edited,
    state: "potential",
  });
  assert.equal(entity.card.text, edited);
  assert.equal(entity.sources[0]?.editedText, edited);
});

test("3 selection offsets stay on the cited range after edit", () => {
  const entity = understanding(risk, quoteSel, { x: 10, y: 10, zIndex: 1 }, {
    editedText: "日中傾眠が生じる可能性がある",
    state: "potential",
  });
  const source = entity.sources[0]!;
  assert.equal(source.selectionStart, quoteSel.selectionStart);
  assert.equal(source.selectionEnd, quoteSel.selectionEnd);
  assert.equal(
    risk.assessmentText.slice(source.selectionStart!, source.selectionEnd!),
    quote,
  );
  assert.equal(source.selectedText, quote);
});

test("4 problem initial compose state is current", () => {
  assert.equal(
    initialUnderstandingStateFromForm3Classification("problem"),
    "current",
  );
  const draft = createAssessmentComposeDraft(
    problem,
    sliceOf(problem, "夜間の幻聴"),
  );
  assert.equal(draft.state, "current");
  assert.equal(draft.editedText, "夜間の幻聴");
});

test("5 risk initial compose state is potential", () => {
  assert.equal(
    initialUnderstandingStateFromForm3Classification("risk"),
    "potential",
  );
  assert.equal(createAssessmentComposeDraft(risk, quoteSel).state, "potential");
});

test("6 strength has no initial compose state", () => {
  assert.equal(
    initialUnderstandingStateFromForm3Classification("strength"),
    null,
  );
  const draft = createAssessmentComposeDraft(
    strength,
    sliceOf(strength, strength.assessmentText.slice(0, 6)),
  );
  assert.equal(draft.state, null);
  assert.equal(canCommitAssessmentCompose(draft), false);
});

test("7 functioning_normally has no initial compose state", () => {
  assert.equal(
    initialUnderstandingStateFromForm3Classification("functioning_normally"),
    null,
  );
  const draft = createAssessmentComposeDraft(
    withJudgment(problem, "functioning_normally"),
    sliceOf(problem, "夜間の幻聴"),
  );
  assert.equal(draft.state, null);
});

test("8 insufficient_information has no initial compose state", () => {
  assert.equal(
    initialUnderstandingStateFromForm3Classification(
      "insufficient_information",
    ),
    null,
  );
});

test("9 null classification has no initial compose state", () => {
  assert.equal(initialUnderstandingStateFromForm3Classification(null), null);
  const draft = createAssessmentComposeDraft(
    withJudgment(problem, null),
    sliceOf(problem, "夜間の幻聴"),
  );
  assert.equal(draft.state, null);
  assert.equal(canCommitAssessmentCompose(draft), false);
});

test("10 student can choose current", () => {
  const entity = understanding(
    strength,
    sliceOf(strength, strength.assessmentText.slice(0, 6)),
    { x: 10, y: 10, zIndex: 1 },
    { state: "current" },
  );
  assert.equal(entity.card.state, "current");
});

test("11 student can choose potential", () => {
  const entity = understanding(
    strength,
    sliceOf(strength, strength.assessmentText.slice(0, 6)),
    { x: 10, y: 10, zIndex: 1 },
    { state: "potential" },
  );
  assert.equal(entity.card.state, "potential");
});

test("12 student can override problem → potential", () => {
  const entity = understanding(
    problem,
    sliceOf(problem, "夜間の幻聴"),
    { x: 10, y: 10, zIndex: 1 },
    { state: "potential" },
  );
  assert.equal(entity.card.state, "potential");
  assert.equal(entity.sources[0]?.sourceClassification, "problem");
});

test("13 student can override risk → current", () => {
  const entity = understanding(risk, quoteSel, { x: 10, y: 10, zIndex: 1 }, {
    state: "current",
  });
  assert.equal(entity.card.state, "current");
  assert.equal(entity.sources[0]?.sourceClassification, "risk");
});

test("14 unselected state cannot commit", () => {
  const draft = createAssessmentComposeDraft(
    strength,
    sliceOf(strength, strength.assessmentText.slice(0, 6)),
  );
  assert.equal(canCommitAssessmentCompose(draft), false);
  assert.equal(
    commitAssessmentCompose(draft, { x: 10, y: 10, zIndex: 1 }),
    null,
  );
});

test("15 cancel creates no card and no history", () => {
  const graph = createEmptySemanticGraph();
  const history = emptyDiagramHistory();
  const draft = createAssessmentComposeDraft(risk, quoteSel);
  draft.editedText = "日中傾眠が生じる可能性がある";
  draft.state = "potential";
  assert.equal(graph.cards.length, 0);
  assert.equal(history.past.length, 0);
  assert.equal(history.future.length, 0);
  assert.ok(draft);
});

test("16 redo restores exact editedText and state", () => {
  const edited = "睡眠薬とクエチアピン追加により、日中傾眠が生じる可能性がある";
  const entity = understanding(risk, quoteSel, { x: 44, y: 55, zIndex: 3 }, {
    editedText: edited,
    state: "current",
  });
  let graph = insertCardEntity(createEmptySemanticGraph(), entity);
  let history = pushDiagramHistory(emptyDiagramHistory(), {
    type: "addCard",
    entity,
  });
  const undone = undoDiagramHistory(history);
  graph = applyHistoryCommand(graph, undone.command);
  history = undone.history;
  assert.equal(graph.cards.length, 0);
  const redone = redoDiagramHistory(history);
  graph = applyHistoryCommand(graph, redone.command);
  assert.equal(graph.cards[0]?.text, edited);
  assert.equal(graph.cards[0]?.state, "current");
  assert.equal(graph.cards[0]?.id, entity.card.id);
  assert.equal(graph.cardSources[0]?.selectedText, quote);
  assert.equal(graph.cardSources[0]?.editedText, edited);
});

test("17 duplicate identity ignores editedText and state", () => {
  let graph = createEmptySemanticGraph();
  const first = understanding(risk, quoteSel, { x: 10, y: 10, zIndex: 1 }, {
    editedText: "日中傾眠が生じる可能性がある",
    state: "potential",
  });
  const second = understanding(risk, quoteSel, { x: 80, y: 90, zIndex: 2 }, {
    editedText: "日中傾眠の可能性がある",
    state: "current",
  });
  graph = insertCardEntity(graph, first);
  assert.equal(
    isForm3AssessmentSelectionAlreadyOnCanvas(graph, {
      form3RecordId: risk.form3RecordId,
      assessmentId: risk.assessmentId,
      selectionStart: quoteSel.selectionStart,
      selectionEnd: quoteSel.selectionEnd,
    }),
    true,
  );
  graph = insertCardEntity(graph, second);
  assert.equal(graph.cards.length, 1);
  assert.equal(graph.cards[0]?.text, first.card.text);
  assert.equal(graph.cards[0]?.state, "potential");
});

test("18 sourceClassification is preserved as Form3 metadata", () => {
  const entity = understanding(risk, quoteSel, { x: 10, y: 10, zIndex: 1 }, {
    state: "current",
  });
  const graph = insertCardEntity(createEmptySemanticGraph(), entity);
  assert.equal(graph.cardSources[0]?.sourceClassification, "risk");
  assert.equal(graph.cards[0]?.state, "current");
  assert.notEqual(graph.cardSources[0]?.sourceClassification, graph.cards[0]?.state);
});

test("19 source trace distinguishes quote, card wording, and student state", () => {
  const edited = "睡眠薬とクエチアピン追加により、日中傾眠が生じる可能性がある";
  const entity = understanding(risk, quoteSel, { x: 10, y: 10, zIndex: 1 }, {
    editedText: edited,
    state: "potential",
  });
  const graph = insertCardEntity(createEmptySemanticGraph(), entity);
  const trace = form3SourceTrace(graph, entity.card.id);
  assert.equal(trace?.originLabel, "様式3のアセスメントから追加");
  assert.equal(trace?.selectedText, quote);
  assert.equal(trace?.cardText, edited);
  assert.equal(trace?.editedText, edited);
  assert.equal(trace?.cardState, "potential");
  assert.equal(trace?.sourceClassification, "risk");
  assert.notEqual(trace?.selectedText, trace?.cardText);
});

test("20 Information cards stay outside compose", () => {
  const entity = buildInformationCardFromForm3({
    source: infoS,
    layout: { x: 10, y: 10, zIndex: 1 },
  });
  assert.equal(entity.card.state, null);
  assert.equal(entity.sources[0]?.editedText, undefined);
  assert.equal(entity.sources[0]?.sourceClassification, undefined);
  const graph = insertCardEntity(createEmptySemanticGraph(), entity);
  const trace = form3SourceTrace(graph, entity.card.id);
  assert.equal(trace?.kind, "information");
  assert.equal(trace?.cardState, null);
  assert.equal(trace?.selectedText, null);
});

console.log(`\n${passed} passed`);
