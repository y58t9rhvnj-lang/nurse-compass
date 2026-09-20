/**
 * U3 Form2 document history adapter + focus/IME/restore contract.
 * Run: npx tsx lib/form2/form2DocumentHistory.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  applyForm2FieldEditCommit,
  beginForm2FieldEditSession,
  canRedoForm2DocumentHistory,
  canUndoForm2DocumentHistory,
  clearForm2DocumentHistory,
  DOCUMENT_HISTORY_LIMIT,
  emptyForm2DocumentHistory,
  form2DataEqualForHistory,
  form2HistorySessionKey,
  form2UndoRedoDisabled,
  form2UndoRedoLocked,
  pushForm2DocumentHistory,
  redoForm2DocumentHistory,
  setForm2FieldComposing,
  shouldCommitForm2FieldEditSession,
  undoForm2DocumentHistory,
  type Form2DocumentHistory,
  type Form2FieldEditSession,
} from "./form2DocumentHistory";
import { createEmptyForm2, type Form2Data } from "./form2Types";
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
const root = process.cwd();
const src = (rel: string) => readFileSync(join(root, rel), "utf8");
const adapterSrc = src("lib/form2/form2DocumentHistory.ts");
const hookSrc = src("hooks/v2/useForm2DocumentHistory.ts");
const workspaceSrc = src("components/v2/workspace/Form2Workspace.tsx");
const editFormSrc = src("components/form2/Form2EditForm.tsx");
const buttonsSrc = src("components/v2/workspace/DocumentUndoRedoButtons.tsx");
const form3WorkspaceSrc = src("components/v2/form3/Form3PhaseBWorkspace.tsx");
const form3AdapterSrc = src("lib/form3/v2/form3DocumentHistory.ts");
const supabaseSrc = src("hooks/v2/useForm2Supabase.ts");

type Session = {
  data: Form2Data;
  history: Form2DocumentHistory;
  field: Form2FieldEditSession | null;
  flags: { dirty: boolean; scheduled: number; saveStatus: string };
  expectedVersion: number;
  dirtyDuringSave: boolean;
  inFlightPayload: Form2Data | null;
  queuedSaves: Form2Data[];
  submittedSnapshot: Form2Data | null;
};

function createSession(data = createEmptyForm2(PATIENT)): Session {
  return {
    data,
    history: emptyForm2DocumentHistory(),
    field: null,
    flags: { dirty: false, scheduled: 0, saveStatus: "idle" },
    expectedVersion: 4,
    dirtyDuringSave: false,
    inFlightPayload: null,
    queuedSaves: [],
    submittedSnapshot: null,
  };
}

function setField(session: Session, section: "basicInformation" | "history" | "treatment" | "student" | "period", key: string, value: string) {
  if (section === "student" || section === "period") {
    session.data = {
      ...session.data,
      [section]: { ...session.data[section], [key]: value },
    };
  } else {
    session.data = {
      ...session.data,
      [section]: { ...session.data[section], [key]: value },
    };
  }
  session.flags.dirty = true;
  session.flags.scheduled += 1;
  if (session.flags.saveStatus === "saving") session.dirtyDuringSave = true;
}

function focus(session: Session, fieldId: string) {
  if (session.field && session.field.fieldId !== fieldId) {
    blur(session);
  }
  session.field = beginForm2FieldEditSession(fieldId, session.data);
}

function typeMany(session: Session, section: "basicInformation", key: "chiefComplaint", text: string) {
  for (const ch of text) {
    setField(session, section, key, session.data[section][key] + ch);
  }
}

function blur(session: Session) {
  if (!session.field) return;
  if (session.field.composing) {
    session.field = { ...session.field, commitOnCompositionEnd: true };
    return;
  }
  const result = applyForm2FieldEditCommit(
    session.history,
    session.field,
    session.data,
  );
  session.history = result.history;
  session.field = null;
}

function undo(session: Session) {
  if (session.field) {
    const result = applyForm2FieldEditCommit(
      session.history,
      session.field,
      session.data,
      { force: true },
    );
    session.history = result.history;
    session.field = null;
  }
  const undone = undoForm2DocumentHistory(session.history);
  session.history = undone.history;
  if (undone.snapshot) {
    session.data = undone.snapshot;
    session.flags.dirty = true;
    session.flags.scheduled += 1;
    if (session.flags.saveStatus === "saving") session.dirtyDuringSave = true;
  }
  return undone.snapshot;
}

function redo(session: Session) {
  const redone = redoForm2DocumentHistory(session.history);
  session.history = redone.history;
  if (redone.snapshot) {
    session.data = redone.snapshot;
    session.flags.dirty = true;
    session.flags.scheduled += 1;
  }
  return redone.snapshot;
}

test("A initial buttons disabled", () => {
  const history = emptyForm2DocumentHistory();
  const disabled = form2UndoRedoDisabled(history, { mode: "edit" });
  assert.equal(canUndoForm2DocumentHistory(history), false);
  assert.equal(disabled.undo, true);
  assert.equal(disabled.redo, true);
});

test("B C D E F focus 100 keystrokes blur = 1 history / Undo Redo exact", () => {
  const session = createSession();
  focus(session, "basicInformation.chiefComplaint");
  typeMany(session, "basicInformation", "chiefComplaint", "x".repeat(100));
  assert.equal(session.data.basicInformation.chiefComplaint.length, 100);
  assert.equal(session.history.past.length, 0);
  blur(session);
  assert.equal(session.history.past.length, 1);
  const undone = undo(session);
  assert.equal(undone?.basicInformation.chiefComplaint, "");
  const redone = redo(session);
  assert.equal(redone?.basicInformation.chiefComplaint, "x".repeat(100));
});

test("G H I clear field Undo restores full text", () => {
  const data = createEmptyForm2(PATIENT);
  data.basicInformation.chiefComplaint = "元の全文です";
  const session = createSession(data);
  focus(session, "basicInformation.chiefComplaint");
  setField(session, "basicInformation", "chiefComplaint", "");
  blur(session);
  assert.equal(session.history.past.length, 1);
  const undone = undo(session);
  assert.equal(undone?.basicInformation.chiefComplaint, "元の全文です");
});

test("J K L M field A then B are separate actions", () => {
  const session = createSession();
  focus(session, "basicInformation.diagnosis");
  setField(session, "basicInformation", "diagnosis", "統合失調症");
  blur(session);
  focus(session, "history.currentLife");
  setField(session, "history", "currentLife", "日中は臥床");
  blur(session);
  assert.equal(session.history.past.length, 2);
  undo(session);
  assert.equal(session.data.history.currentLife, "");
  assert.equal(session.data.basicInformation.diagnosis, "統合失調症");
  undo(session);
  assert.equal(session.data.basicInformation.diagnosis, "");
});

test("N O focus/blur no change and revert-to-original are NO-OP", () => {
  const data = createEmptyForm2(PATIENT);
  data.treatment.policy = "休息";
  const session = createSession(data);
  focus(session, "treatment.policy");
  blur(session);
  assert.equal(session.history.past.length, 0);
  focus(session, "treatment.policy");
  setField(session, "treatment", "policy", "変更");
  setField(session, "treatment", "policy", "休息");
  blur(session);
  assert.equal(session.history.past.length, 0);
});

test("P Q R S T IME composition does not split history", () => {
  const session = createSession();
  focus(session, "basicInformation.chiefComplaint");
  session.field = setForm2FieldComposing(session.field!, true);
  assert.equal(
    shouldCommitForm2FieldEditSession(session.field!, session.data),
    false,
  );
  setField(session, "basicInformation", "chiefComplaint", "ねつ");
  assert.equal(session.history.past.length, 0);
  blur(session);
  assert.equal(session.history.past.length, 0);
  assert.equal(session.field?.commitOnCompositionEnd, true);
  session.field = setForm2FieldComposing(session.field!, false);
  setField(session, "basicInformation", "chiefComplaint", "発熱");
  const result = applyForm2FieldEditCommit(
    session.history,
    session.field!,
    session.data,
    { force: true },
  );
  session.history = result.history;
  session.field = null;
  assert.equal(session.history.past.length, 1);
  const undone = undo(session);
  assert.equal(undone?.basicInformation.chiefComplaint, "");
  const redone = redo(session);
  assert.equal(redone?.basicInformation.chiefComplaint, "発熱");
});

test("U V W X typing中に戻す = commit then undo / no stale draft", () => {
  const session = createSession();
  focus(session, "basicInformation.chiefComplaint");
  setField(session, "basicInformation", "chiefComplaint", "途中の下書き");
  assert.equal(session.history.past.length, 0);
  const snapshot = undo(session);
  assert.equal(session.history.past.length, 0);
  assert.equal(canRedoForm2DocumentHistory(session.history), true);
  assert.equal(snapshot?.basicInformation.chiefComplaint, "");
  assert.equal(session.field, null);
  assert.equal(session.data.basicInformation.chiefComplaint, "");
  assert.equal(redo(session)?.basicInformation.chiefComplaint, "途中の下書き");
});

test("Y Z AA AB AC AD AE autosave dirty / saving race / version excluded", () => {
  const session = createSession();
  focus(session, "basicInformation.diagnosis");
  setField(session, "basicInformation", "diagnosis", "編集");
  blur(session);
  const versionBefore = session.expectedVersion;
  const afterEdit = session.data;
  session.flags.saveStatus = "saving";
  session.dirtyDuringSave = false;
  session.inFlightPayload = afterEdit;
  focus(session, "basicInformation.diagnosis");
  setField(session, "basicInformation", "diagnosis", "さらに");
  blur(session);
  const undone = undo(session);
  assert.equal(session.flags.dirty, true);
  assert.equal(session.dirtyDuringSave, true);
  assert.ok(session.flags.scheduled >= 1);
  assert.equal(session.expectedVersion, versionBefore);
  const editedDuringSave =
    session.dirtyDuringSave || session.data !== session.inFlightPayload;
  session.expectedVersion += 1;
  if (editedDuringSave) {
    session.queuedSaves.push(session.data);
  }
  assert.equal(session.data, undone);
  assert.notEqual(session.data, session.inFlightPayload);
  assert.equal(session.queuedSaves[0], undone);
  assert.equal("expectedVersion" in session.data, false);
});

test("AF AG conflict / patient change clear", () => {
  const session = createSession();
  focus(session, "student.studentName");
  setField(session, "student", "studentName", "山田");
  blur(session);
  assert.equal(canUndoForm2DocumentHistory(session.history), true);
  session.history = clearForm2DocumentHistory();
  session.data = createEmptyForm2("B");
  assert.equal(canUndoForm2DocumentHistory(session.history), false);
  assert.notEqual(
    form2HistorySessionKey("A", "user"),
    form2HistorySessionKey("B", "user"),
  );
});

test("AH AI AJ preview disables buttons and keeps stack", () => {
  const session = createSession();
  focus(session, "period.start");
  setField(session, "period", "start", "4/1");
  blur(session);
  const preview = form2UndoRedoDisabled(session.history, { mode: "view" });
  assert.equal(preview.undo, true);
  assert.equal(canUndoForm2DocumentHistory(session.history), true);
  assert.equal(form2UndoRedoLocked({ mode: "view" }), true);
  const editAgain = form2UndoRedoDisabled(session.history, { mode: "edit" });
  assert.equal(editAgain.undo, false);
});

test("AK Undo then new edit clears Redo", () => {
  const session = createSession();
  focus(session, "basicInformation.diagnosis");
  setField(session, "basicInformation", "diagnosis", "A");
  blur(session);
  focus(session, "basicInformation.diagnosis");
  setField(session, "basicInformation", "diagnosis", "B");
  blur(session);
  undo(session);
  assert.equal(canRedoForm2DocumentHistory(session.history), true);
  focus(session, "basicInformation.diagnosis");
  setField(session, "basicInformation", "diagnosis", "C");
  blur(session);
  assert.equal(session.history.future.length, 0);
});

test("AL AM AN AO AP UI contract matches Form3 visual", () => {
  assert.match(buttonsSrc, /戻す/);
  assert.match(buttonsSrc, /やり直す/);
  assert.match(buttonsSrc, /↶/);
  assert.match(buttonsSrc, /↷/);
  assert.match(buttonsSrc, /min-h-\[44px\]/);
  assert.match(buttonsSrc, /min-w-\[44px\]/);
  assert.match(buttonsSrc, /no-print/);
  assert.match(buttonsSrc, /sm:px-3/);
  assert.match(workspaceSrc, /DocumentUndoRedoButtons/);
  assert.match(form3WorkspaceSrc, /Form3UndoRedoButtons/);
  const headerStart = workspaceSrc.indexOf("const headerActions");
  const undoIdx = workspaceSrc.indexOf("<DocumentUndoRedoButtons", headerStart);
  const previewIdx = workspaceSrc.indexOf(">プレビュー<", headerStart);
  assert.ok(headerStart > 0 && undoIdx > headerStart && undoIdx < previewIdx);
});

test("AQ AR AS AT AU AV scope: Evidence / reflection / Form3 / RD untouched", () => {
  for (const text of [adapterSrc, hookSrc]) {
    assert.equal(text.includes("form2_evidence_links"), false);
    assert.equal(text.includes("form2_field_reflections"), false);
    assert.equal(text.includes("diagramHistory"), false);
    assert.equal(text.includes("nursingProblemPriority"), false);
    assert.equal(text.includes("saveForm2Action"), false);
  }
  assert.match(workspaceSrc, /restoreFromUserEdit/);
  assert.doesNotMatch(workspaceSrc, /saveForm2Action/);
  assert.match(workspaceSrc, /useDocumentUndoRedoShortcuts/);
  assert.doesNotMatch(workspaceSrc, /window\.addEventListener\("keydown"/);
  assert.match(form3WorkspaceSrc, /markUserEditedV2\(after, reason\)/);
  assert.match(form3AdapterSrc, /documentHistory/);
  assert.match(editFormSrc, /onCompositionStart/);
  assert.match(editFormSrc, /onFieldBlur/);
  assert.match(supabaseSrc, /onDocumentBaselineReset/);
  assert.match(supabaseSrc, /restoreFromUserEdit: onEdited/);
  assert.equal(DOCUMENT_HISTORY_LIMIT, 50);
  assert.equal(DOCUMENT_HISTORY_LIMIT, U1_LIMIT);
  assert.equal(adapterSrc.includes("const DOCUMENT_HISTORY_LIMIT = 50"), false);
});

test("pending field edit enables Undo without prior blur", () => {
  const history = emptyForm2DocumentHistory();
  assert.equal(
    form2UndoRedoDisabled(history, { mode: "edit" }, true).undo,
    false,
  );
});

test("limit 50 inherited / submitted snapshot isolated", () => {
  const submitted = createEmptyForm2(PATIENT);
  submitted.basicInformation.diagnosis = "提出済み";
  const session = createSession();
  session.submittedSnapshot = submitted;
  focus(session, "basicInformation.diagnosis");
  setField(session, "basicInformation", "diagnosis", "作業");
  blur(session);
  undo(session);
  assert.equal(session.submittedSnapshot.basicInformation.diagnosis, "提出済み");
  let history = emptyForm2DocumentHistory();
  let data = createEmptyForm2(PATIENT);
  for (let i = 0; i < 51; i += 1) {
    const after = {
      ...data,
      basicInformation: { ...data.basicInformation, diagnosis: `n${i}` },
    };
    history = pushForm2DocumentHistory(history, {
      before: data,
      after,
      reason: "form2_field_edit",
    });
    data = after;
  }
  assert.equal(history.past.length, 50);
});

test("IME + equal after composition is still NO-OP", () => {
  const data = createEmptyForm2(PATIENT);
  data.student.studentName = "佐藤";
  const session = beginForm2FieldEditSession("student.studentName", data);
  const composing = setForm2FieldComposing(session, true);
  assert.equal(shouldCommitForm2FieldEditSession(composing, data), false);
  const ended = setForm2FieldComposing(composing, false);
  assert.equal(form2DataEqualForHistory(ended.before, data), true);
  const result = applyForm2FieldEditCommit(emptyForm2DocumentHistory(), ended, data);
  assert.equal(result.committed, false);
});

console.log(`\n${passed} tests passed`);
