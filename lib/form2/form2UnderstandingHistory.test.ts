/**
 * U3b Understanding document history adapter + focus/IME/restore contract.
 * Run: npx tsx lib/form2/form2UnderstandingHistory.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  applyForm2UnderstandingFieldEditCommit,
  applyForm2UnderstandingRestore,
  beginForm2UnderstandingFieldEditSession,
  canRedoForm2UnderstandingHistory,
  canUndoForm2UnderstandingHistory,
  clearForm2UnderstandingHistory,
  createEmptyForm2UnderstandingDocument,
  diffForm2UnderstandingDocument,
  DOCUMENT_HISTORY_LIMIT,
  emptyForm2UnderstandingHistory,
  form2UnderstandingEqualForHistory,
  form2UnderstandingHistorySessionKey,
  form2UnderstandingUndoRedoDisabled,
  pushForm2UnderstandingHistory,
  redoForm2UnderstandingHistory,
  setForm2UnderstandingFieldComposing,
  shouldCommitForm2UnderstandingFieldEditSession,
  UNDERSTANDING_OVERVIEW_FIELD_ID,
  undoForm2UnderstandingHistory,
  understandingReflectionFieldId,
  type Form2UnderstandingDocument,
  type Form2UnderstandingFieldEditSession,
  type Form2UnderstandingHistory,
} from "./form2UnderstandingHistory";
import { DOCUMENT_HISTORY_LIMIT as U1_LIMIT } from "../v2/history/documentHistory";

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

const PATIENT = "A";
const FIELD_A = "basicInformation.diagnosis";
const FIELD_B = "history.currentLife";
const HIDDEN = "treatment.policy";
const root = process.cwd();
const src = (rel: string) => readFileSync(join(root, rel), "utf8");
const adapterSrc = src("lib/form2/form2UnderstandingHistory.ts");
const hookSrc = src("hooks/v2/useForm2UnderstandingHistory.ts");
const workspaceSrc = src("components/v2/workspace/Form2Workspace.tsx");
const reflectionSrc = src("components/v2/workspace/Form2ReflectionSection.tsx");
const overviewSrc = src("components/v2/workspace/PatientOverviewEditor.tsx");
const evidenceSrc = src("components/v2/workspace/EvidenceReviewWorkspace.tsx");
const buttonsSrc = src("components/v2/workspace/DocumentUndoRedoButtons.tsx");
const reflectionHookSrc = src("hooks/v2/useForm2FieldReflections.ts");
const overviewHookSrc = src("hooks/v2/usePatientUnderstanding.ts");
const form2AdapterSrc = src("lib/form2/form2DocumentHistory.ts");
const form2HookSrc = src("hooks/v2/useForm2DocumentHistory.ts");
const form3AdapterSrc = src("lib/form3/v2/form3DocumentHistory.ts");
const form3WorkspaceSrc = src("components/v2/form3/Form3PhaseBWorkspace.tsx");
const snapshotSrc = src("lib/v2/assessment/snapshotBuilder.ts");
const u1Src = src("lib/v2/history/documentHistory.ts");

type Session = {
  document: Form2UnderstandingDocument;
  history: Form2UnderstandingHistory;
  field: Form2UnderstandingFieldEditSession | null;
  latestRef: Form2UnderstandingDocument;
  pendingRef: { reflections: Record<string, boolean>; overview: boolean };
  busyRef: { reflections: Record<string, boolean>; overview: boolean };
  saveCalls: { kind: "reflection" | "overview"; key?: string; text: string }[];
  submitted: Form2UnderstandingDocument;
  intentRuns: number;
  intentGuard: boolean;
};

function cloneDoc(document: Form2UnderstandingDocument): Form2UnderstandingDocument {
  return {
    reflections: { ...document.reflections },
    overviewText: document.overviewText,
  };
}

function createSession(
  document = createEmptyForm2UnderstandingDocument(),
): Session {
  const next = cloneDoc(document);
  return {
    document: next,
    history: emptyForm2UnderstandingHistory(),
    field: null,
    latestRef: cloneDoc(next),
    pendingRef: { reflections: {}, overview: false },
    busyRef: { reflections: {}, overview: false },
    saveCalls: [],
    submitted: {
      reflections: { [FIELD_A]: "提出済み考察" },
      overviewText: "提出済み全体像",
    },
    intentRuns: 0,
    intentGuard: false,
  };
}

function onChangeReflection(session: Session, fieldKey: string, text: string) {
  session.document = {
    ...session.document,
    reflections: { ...session.document.reflections, [fieldKey]: text },
  };
  session.latestRef = {
    ...session.latestRef,
    reflections: { ...session.latestRef.reflections, [fieldKey]: text },
  };
  session.saveCalls.push({ kind: "reflection", key: fieldKey, text });
  if (session.busyRef.reflections[fieldKey]) {
    session.pendingRef.reflections[fieldKey] = true;
  }
}

function onChangeText(session: Session, text: string) {
  session.document = { ...session.document, overviewText: text };
  session.latestRef = { ...session.latestRef, overviewText: text };
  session.saveCalls.push({ kind: "overview", text });
  if (session.busyRef.overview) session.pendingRef.overview = true;
}

function focus(session: Session, fieldId: string) {
  if (session.field && session.field.fieldId !== fieldId) blur(session);
  session.field = beginForm2UnderstandingFieldEditSession(
    fieldId,
    session.document,
  );
}

function typeReflection(session: Session, fieldKey: string, text: string) {
  for (const ch of text) {
    onChangeReflection(
      session,
      fieldKey,
      (session.document.reflections[fieldKey] ?? "") + ch,
    );
  }
}

function blur(session: Session) {
  if (!session.field) return;
  if (session.field.composing) {
    session.field = { ...session.field, commitOnCompositionEnd: true };
    return;
  }
  const result = applyForm2UnderstandingFieldEditCommit(
    session.history,
    session.field,
    session.document,
  );
  session.history = result.history;
  session.field = null;
}

function restore(session: Session, snapshot: Form2UnderstandingDocument) {
  applyForm2UnderstandingRestore(
    session.document,
    snapshot,
    (fieldKey, text) => onChangeReflection(session, fieldKey, text),
    (text) => onChangeText(session, text),
  );
}

function undo(session: Session) {
  if (session.field) {
    const result = applyForm2UnderstandingFieldEditCommit(
      session.history,
      session.field,
      session.document,
      { force: true },
    );
    session.history = result.history;
    session.field = null;
  }
  const undone = undoForm2UnderstandingHistory(session.history);
  session.history = undone.history;
  if (undone.snapshot) restore(session, undone.snapshot);
  return undone.snapshot;
}

function redo(session: Session) {
  const redone = redoForm2UnderstandingHistory(session.history);
  session.history = redone.history;
  if (redone.snapshot) restore(session, redone.snapshot);
  return redone.snapshot;
}

function runUndoIntent(session: Session) {
  if (session.intentGuard) return;
  session.intentGuard = true;
  session.intentRuns += 1;
  undo(session);
}

test("A initial empty history / buttons disabled", () => {
  const history = emptyForm2UnderstandingHistory();
  const disabled = form2UnderstandingUndoRedoDisabled(history);
  assert.equal(canUndoForm2UnderstandingHistory(history), false);
  assert.equal(canRedoForm2UnderstandingHistory(history), false);
  assert.equal(disabled.undo, true);
  assert.equal(disabled.redo, true);
  assert.deepEqual(createEmptyForm2UnderstandingDocument(), {
    reflections: {},
    overviewText: "",
  });
});

test("B C reflection edit 100 keystrokes = 1 history", () => {
  const session = createSession();
  focus(session, understandingReflectionFieldId(FIELD_A));
  typeReflection(session, FIELD_A, "あ".repeat(100));
  assert.equal(session.document.reflections[FIELD_A]?.length, 100);
  assert.equal(session.history.past.length, 0);
  blur(session);
  assert.equal(session.history.past.length, 1);
});

test("D E reflection Undo / Redo exact", () => {
  const session = createSession();
  focus(session, understandingReflectionFieldId(FIELD_A));
  onChangeReflection(session, FIELD_A, "発熱から感染を疑う");
  blur(session);
  const undone = undo(session);
  assert.equal(undone?.reflections[FIELD_A] ?? "", "");
  assert.equal(session.document.reflections[FIELD_A], "");
  const redone = redo(session);
  assert.equal(redone?.reflections[FIELD_A], "発熱から感染を疑う");
  assert.equal(session.document.reflections[FIELD_A], "発熱から感染を疑う");
});

test("F G H overview edit / Undo / Redo exact", () => {
  const session = createSession();
  focus(session, UNDERSTANDING_OVERVIEW_FIELD_ID);
  onChangeText(session, "日中臥床が目立つ患者さん");
  assert.equal(session.history.past.length, 0);
  blur(session);
  assert.equal(session.history.past.length, 1);
  const undone = undo(session);
  assert.equal(undone?.overviewText, "");
  assert.equal(session.document.overviewText, "");
  const redone = redo(session);
  assert.equal(redone?.overviewText, "日中臥床が目立つ患者さん");
});

test("I J K reflection A → overview → reflection B Undo order", () => {
  const session = createSession();
  focus(session, understandingReflectionFieldId(FIELD_A));
  onChangeReflection(session, FIELD_A, "A考察");
  blur(session);
  focus(session, UNDERSTANDING_OVERVIEW_FIELD_ID);
  onChangeText(session, "全体像");
  blur(session);
  focus(session, understandingReflectionFieldId(FIELD_B));
  onChangeReflection(session, FIELD_B, "B考察");
  blur(session);
  assert.equal(session.history.past.length, 3);
  undo(session);
  assert.equal(session.document.reflections[FIELD_B] ?? "", "");
  assert.equal(session.document.overviewText, "全体像");
  assert.equal(session.document.reflections[FIELD_A], "A考察");
  undo(session);
  assert.equal(session.document.overviewText, "");
  assert.equal(session.document.reflections[FIELD_A], "A考察");
  undo(session);
  assert.equal(session.document.reflections[FIELD_A] ?? "", "");
});

test("L M clear reflection / overview Undo restores full text", () => {
  const session = createSession({
    reflections: { [FIELD_A]: "元の全文です" },
    overviewText: "元の全体像です",
  });
  focus(session, understandingReflectionFieldId(FIELD_A));
  onChangeReflection(session, FIELD_A, "");
  blur(session);
  undo(session);
  assert.equal(session.document.reflections[FIELD_A], "元の全文です");
  focus(session, UNDERSTANDING_OVERVIEW_FIELD_ID);
  onChangeText(session, "");
  blur(session);
  undo(session);
  assert.equal(session.document.overviewText, "元の全体像です");
});

test("N empty → text → Undo returns empty", () => {
  const session = createSession();
  focus(session, understandingReflectionFieldId(FIELD_A));
  onChangeReflection(session, FIELD_A, "新規");
  blur(session);
  undo(session);
  assert.equal(session.document.reflections[FIELD_A], "");
  focus(session, UNDERSTANDING_OVERVIEW_FIELD_ID);
  onChangeText(session, "新規全体像");
  blur(session);
  undo(session);
  assert.equal(session.document.overviewText, "");
});

test("O P Q IME composition does not snapshot mid-conversion", () => {
  const session = createSession();
  focus(session, understandingReflectionFieldId(FIELD_A));
  session.field = setForm2UnderstandingFieldComposing(session.field!, true);
  assert.equal(
    shouldCommitForm2UnderstandingFieldEditSession(session.field!, session.document),
    false,
  );
  onChangeReflection(session, FIELD_A, "かんじゃ");
  assert.equal(session.history.past.length, 0);
  blur(session);
  assert.equal(session.history.past.length, 0);
  assert.equal(session.field?.commitOnCompositionEnd, true);
  session.field = setForm2UnderstandingFieldComposing(session.field!, false);
  onChangeReflection(session, FIELD_A, "患者");
  const result = applyForm2UnderstandingFieldEditCommit(
    session.history,
    session.field!,
    session.document,
    { force: true },
  );
  session.history = result.history;
  session.field = null;
  assert.equal(session.history.past.length, 1);
  const undone = undo(session);
  assert.equal(undone?.reflections[FIELD_A] ?? "", "");
  const redone = redo(session);
  assert.equal(redone?.reflections[FIELD_A], "患者");
});

test("R S T U typing中 Undo commits current edit then undoes once", () => {
  const session = createSession();
  focus(session, understandingReflectionFieldId(FIELD_A));
  onChangeReflection(session, FIELD_A, "途中の下書き");
  assert.equal(session.history.past.length, 0);
  runUndoIntent(session);
  runUndoIntent(session);
  assert.equal(session.intentRuns, 1);
  assert.equal(session.history.past.length, 0);
  assert.equal(canRedoForm2UnderstandingHistory(session.history), true);
  assert.equal(session.document.reflections[FIELD_A], "");
  assert.equal(session.field, null);
  assert.equal(redo(session)?.reflections[FIELD_A], "途中の下書き");
});

test("V W X changed-only restore", () => {
  const current: Form2UnderstandingDocument = {
    reflections: { [FIELD_A]: "A1", [FIELD_B]: "B1", [HIDDEN]: "hidden" },
    overviewText: "全体1",
  };
  const target: Form2UnderstandingDocument = {
    reflections: { [FIELD_A]: "A2", [FIELD_B]: "B1", [HIDDEN]: "hidden" },
    overviewText: "全体1",
  };
  const reflectionKeys: string[] = [];
  let overviewCalls = 0;
  const change = applyForm2UnderstandingRestore(
    current,
    target,
    (fieldKey) => reflectionKeys.push(fieldKey),
    () => {
      overviewCalls += 1;
    },
  );
  assert.deepEqual(change.reflections.map((item) => item.fieldKey), [FIELD_A]);
  assert.deepEqual(reflectionKeys, [FIELD_A]);
  assert.equal(change.overviewText, null);
  assert.equal(overviewCalls, 0);
  const overviewOnly = diffForm2UnderstandingDocument(current, {
    ...current,
    overviewText: "全体2",
  });
  assert.equal(overviewOnly.reflections.length, 0);
  assert.equal(overviewOnly.overviewText, "全体2");
});

test("Y Z AA AB AC Undo uses onChange path / latestRef / pending / no stale overwrite", () => {
  const session = createSession();
  focus(session, understandingReflectionFieldId(FIELD_A));
  onChangeReflection(session, FIELD_A, "編集後");
  blur(session);
  session.busyRef.reflections[FIELD_A] = true;
  const inflight = session.latestRef.reflections[FIELD_A];
  undo(session);
  assert.equal(session.latestRef.reflections[FIELD_A], "");
  assert.equal(session.pendingRef.reflections[FIELD_A], true);
  assert.notEqual(session.latestRef.reflections[FIELD_A], inflight);
  const staleResponseText = inflight;
  assert.notEqual(session.document.reflections[FIELD_A], staleResponseText);
  assert.ok(session.saveCalls.some((call) => call.kind === "reflection" && call.text === ""));
  focus(session, UNDERSTANDING_OVERVIEW_FIELD_ID);
  onChangeText(session, "概観");
  blur(session);
  session.busyRef.overview = true;
  undo(session);
  assert.equal(session.latestRef.overviewText, "");
  assert.equal(session.pendingRef.overview, true);
});

test("AD AE AF Undo then new edit clears future / limit 50 / NO-OP", () => {
  const session = createSession();
  focus(session, understandingReflectionFieldId(FIELD_A));
  onChangeReflection(session, FIELD_A, "A");
  blur(session);
  focus(session, understandingReflectionFieldId(FIELD_A));
  onChangeReflection(session, FIELD_A, "B");
  blur(session);
  undo(session);
  assert.equal(canRedoForm2UnderstandingHistory(session.history), true);
  focus(session, understandingReflectionFieldId(FIELD_A));
  onChangeReflection(session, FIELD_A, "C");
  blur(session);
  assert.equal(session.history.future.length, 0);
  focus(session, understandingReflectionFieldId(FIELD_B));
  blur(session);
  assert.equal(
    form2UnderstandingEqualForHistory(session.document, session.document),
    true,
  );
  const noOp = pushForm2UnderstandingHistory(session.history, {
    before: session.document,
    after: cloneDoc(session.document),
  });
  assert.equal(noOp.past.length, session.history.past.length);

  let history = emptyForm2UnderstandingHistory();
  let document = createEmptyForm2UnderstandingDocument();
  for (let i = 0; i < 51; i += 1) {
    const after = {
      reflections: { [FIELD_A]: `n${i}` },
      overviewText: "",
    };
    history = pushForm2UnderstandingHistory(history, {
      before: document,
      after,
    });
    document = after;
  }
  assert.equal(history.past.length, 50);
});

test("AG AH AI patient change clears / panel and Coach preserve", () => {
  const session = createSession();
  focus(session, understandingReflectionFieldId(FIELD_A));
  onChangeReflection(session, FIELD_A, "山田");
  blur(session);
  assert.equal(canUndoForm2UnderstandingHistory(session.history), true);
  const preserved = session.history;
  assert.equal(canUndoForm2UnderstandingHistory(preserved), true);
  session.history = clearForm2UnderstandingHistory();
  assert.equal(canUndoForm2UnderstandingHistory(session.history), false);
  assert.notEqual(
    form2UnderstandingHistorySessionKey("A", "user"),
    form2UnderstandingHistorySessionKey("B", "user"),
  );
  assert.match(hookSrc, /sessionKeyRef\.current !== sessionKey/);
  assert.match(workspaceSrc, /inUnderstanding \? understandingHeaderActions : headerActions/);
  assert.match(workspaceSrc, /form2UndoRedoLocked\(\{[\s\S]*understandingOpen: workspacePanel === "understanding"/);
  assert.doesNotMatch(evidenceSrc, /clearForm2UnderstandingHistory/);
  assert.doesNotMatch(evidenceSrc, /clear\(/);
  assert.match(evidenceSrc, /CoachPrompts/);
  assert.doesNotMatch(evidenceSrc, /beginUnderstandingField/);
});

test("AJ AK AL AM AN understanding header uses shared buttons", () => {
  const headerStart = workspaceSrc.indexOf("const understandingHeaderActions");
  const undoIdx = workspaceSrc.indexOf("<DocumentUndoRedoButtons", headerStart);
  const backIdx = workspaceSrc.indexOf("様式2へ戻る", headerStart);
  assert.ok(headerStart > 0 && undoIdx > headerStart && undoIdx < backIdx);
  assert.match(buttonsSrc, /戻す/);
  assert.match(buttonsSrc, /やり直す/);
  assert.match(buttonsSrc, /↶/);
  assert.match(buttonsSrc, /↷/);
  assert.match(buttonsSrc, /min-h-\[44px\]/);
  assert.match(buttonsSrc, /min-w-\[44px\]/);
  assert.match(buttonsSrc, /no-print/);
  assert.match(buttonsSrc, /sm:px-3/);
  assert.match(reflectionSrc, /onCompositionStart/);
  assert.match(overviewSrc, /onCompositionStart/);
  assert.match(workspaceSrc, /onUnderstandingCompositionStart/);
});

test("AO AP AQ AR AS AT scope: Form2 / Form3 / Evidence / submission / RD / Priority", () => {
  assert.match(workspaceSrc, /useForm2DocumentHistory/);
  assert.match(workspaceSrc, /restoreFromUserEdit/);
  assert.match(workspaceSrc, /form2UndoRedoLocked/);
  assert.match(form2AdapterSrc, /form2_field_edit/);
  assert.match(form2HookSrc, /beginForm2FieldEditSession/);
  assert.match(form3WorkspaceSrc, /markUserEditedV2\(after, reason\)/);
  assert.match(form3AdapterSrc, /documentHistory/);
  assert.doesNotMatch(adapterSrc, /diagramHistory/);
  assert.doesNotMatch(hookSrc, /diagramHistory/);
  assert.doesNotMatch(adapterSrc, /nursingProblemPriority/);
  assert.doesNotMatch(hookSrc, /nursingProblemPriority/);
  assert.doesNotMatch(adapterSrc, /form2_evidence_links/);
  assert.match(snapshotSrc, /fieldReflections: reflections\.rows/);
  assert.match(snapshotSrc, /patientUnderstanding: understanding\.row/);
  assert.doesNotMatch(adapterSrc, /buildAssessmentSnapshot/);
  assert.doesNotMatch(adapterSrc, /saveForm2Action/);
  assert.match(u1Src, /export const DOCUMENT_HISTORY_LIMIT = 50/);
  assert.equal(DOCUMENT_HISTORY_LIMIT, 50);
  assert.equal(DOCUMENT_HISTORY_LIMIT, U1_LIMIT);
  assert.equal(adapterSrc.includes("const DOCUMENT_HISTORY_LIMIT = 50"), false);
  assert.match(adapterSrc, /from "\.\.\/v2\/history\/documentHistory"/);
});

test("pending understanding edit enables Undo without blur", () => {
  const history = emptyForm2UnderstandingHistory();
  assert.equal(form2UnderstandingUndoRedoDisabled(history, true).undo, false);
});

test("hidden reflection stays in working document / not deleted", () => {
  const before: Form2UnderstandingDocument = {
    reflections: { [FIELD_A]: "表示中", [HIDDEN]: "非表示の考察" },
    overviewText: "",
  };
  const after: Form2UnderstandingDocument = {
    reflections: { [FIELD_A]: "表示中を更新", [HIDDEN]: "非表示の考察" },
    overviewText: "",
  };
  let history = emptyForm2UnderstandingHistory();
  history = pushForm2UnderstandingHistory(history, { before, after });
  const undone = undoForm2UnderstandingHistory(history);
  assert.equal(undone.snapshot?.reflections[HIDDEN], "非表示の考察");
  const change = diffForm2UnderstandingDocument(after, undone.snapshot!);
  assert.deepEqual(change.reflections.map((item) => item.fieldKey), [FIELD_A]);
});

test("same identity / no UUID regeneration / empty upsert not DELETE", () => {
  assert.equal(understandingReflectionFieldId(FIELD_A), `reflection:${FIELD_A}`);
  assert.equal(UNDERSTANDING_OVERVIEW_FIELD_ID, "overview");
  assert.doesNotMatch(adapterSrc, /crypto\.randomUUID/);
  assert.doesNotMatch(hookSrc, /crypto\.randomUUID/);
  assert.match(reflectionHookSrc, /reflectionText: latestRef\.current\[key\] \?\? ""/);
  assert.doesNotMatch(reflectionHookSrc, /DELETE/);
  assert.match(overviewHookSrc, /overviewText: latestRef\.current/);
  const session = createSession();
  session.submitted.reflections[FIELD_A] = "提出済み考察";
  focus(session, understandingReflectionFieldId(FIELD_A));
  onChangeReflection(session, FIELD_A, "作業中");
  blur(session);
  undo(session);
  assert.equal(session.submitted.reflections[FIELD_A], "提出済み考察");
  assert.equal(session.submitted.overviewText, "提出済み全体像");
});

test("restore and IME wiring stay on existing onChange paths", () => {
  assert.match(workspaceSrc, /applyForm2UnderstandingRestore/);
  assert.match(workspaceSrc, /reflections\.onChangeReflection/);
  assert.match(workspaceSrc, /overview\.onChangeText/);
  assert.match(hookSrc, /intentGuardRef/);
  assert.match(hookSrc, /queueMicrotask/);
  assert.match(hookSrc, /commitActiveField\(\{ force: true \}\)/);
  assert.match(reflectionHookSrc, /latestRef\.current\[key\] = next/);
  assert.match(overviewHookSrc, /latestRef\.current = next/);
  assert.doesNotMatch(reflectionHookSrc, /setTexts\(res/);
  assert.doesNotMatch(overviewHookSrc, /setText\(res/);
  assert.match(reflectionHookSrc, /DEBOUNCE_MS = 800/);
  assert.match(overviewHookSrc, /DEBOUNCE_MS = 800/);
  assert.match(workspaceSrc, /understandingError/);
  assert.match(workspaceSrc, /understandingSaving/);
});

test("two stacks stay separate", () => {
  assert.match(workspaceSrc, /useForm2DocumentHistory/);
  assert.match(workspaceSrc, /useForm2UnderstandingHistory/);
  assert.notEqual(
    form2UnderstandingHistorySessionKey("A", "u"),
    "u:A",
  );
  assert.match(form2AdapterSrc, /understandingOpen/);
});

console.log(`\n${passed} tests passed`);
