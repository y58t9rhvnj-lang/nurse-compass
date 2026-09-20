/**
 * U4 shared document Undo/Redo shortcuts + race contract.
 * Run: npx tsx lib/v2/history/documentUndoRedoShortcuts.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  isEditableUndoRedoTarget,
  resolveDocumentUndoRedoShortcut,
  type DocumentUndoRedoShortcutEvent,
  type EditableTargetLike,
} from "./documentUndoRedoShortcuts";
import { createEmptyForm2, type Form2Data } from "../../form2/form2Types";

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

const root = process.cwd();
const src = (rel: string) => readFileSync(join(root, rel), "utf8");
const shortcutSrc = src("lib/v2/history/documentUndoRedoShortcuts.ts");
const hookSrc = src("hooks/v2/useDocumentUndoRedoShortcuts.ts");
const form2WorkspaceSrc = src("components/v2/workspace/Form2Workspace.tsx");
const form3WorkspaceSrc = src("components/v2/form3/Form3PhaseBWorkspace.tsx");
const form2HookSrc = src("hooks/v2/useForm2Supabase.ts");
const form3HookSrc = src("hooks/v2/useForm3Supabase.ts");
const reflectionHookSrc = src("hooks/v2/useForm2FieldReflections.ts");
const overviewHookSrc = src("hooks/v2/usePatientUnderstanding.ts");
const u1Src = src("lib/v2/history/documentHistory.ts");

function key(
  partial: Partial<DocumentUndoRedoShortcutEvent> & { key: string },
): DocumentUndoRedoShortcutEvent {
  return {
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    repeat: false,
    isComposing: false,
    ...partial,
  };
}

function resolve(
  event: DocumentUndoRedoShortcutEvent,
  extra: {
    enabled?: boolean;
    canUndo?: boolean;
    canRedo?: boolean;
    target?: unknown;
  } = {},
) {
  return resolveDocumentUndoRedoShortcut({
    event,
    enabled: extra.enabled ?? true,
    canUndo: extra.canUndo ?? true,
    canRedo: extra.canRedo ?? true,
    target: extra.target,
  });
}

test("A Cmd+Z → Undo", () => {
  const result = resolve(key({ key: "z", metaKey: true }));
  assert.equal(result.action, "undo");
  assert.equal(result.preventDefault, true);
});

test("B Ctrl+Z → Undo", () => {
  const result = resolve(key({ key: "z", ctrlKey: true }));
  assert.equal(result.action, "undo");
});

test("C Cmd+Shift+Z → Redo", () => {
  const result = resolve(key({ key: "z", metaKey: true, shiftKey: true }));
  assert.equal(result.action, "redo");
});

test("D Ctrl+Shift+Z → Redo", () => {
  const result = resolve(key({ key: "z", ctrlKey: true, shiftKey: true }));
  assert.equal(result.action, "redo");
});

test("E Ctrl+Y → Redo", () => {
  const result = resolve(key({ key: "y", ctrlKey: true }));
  assert.equal(result.action, "redo");
});

test("F G canUndo/canRedo false → no action", () => {
  assert.equal(
    resolve(key({ key: "z", metaKey: true }), { canUndo: false }).action,
    null,
  );
  assert.equal(
    resolve(key({ key: "z", metaKey: true, shiftKey: true }), { canRedo: false })
      .action,
    null,
  );
});

test("H disabled → no action", () => {
  const result = resolve(key({ key: "z", metaKey: true }), { enabled: false });
  assert.equal(result.action, null);
  assert.equal(result.preventDefault, false);
});

test("I J TEXTAREA / INPUT focus → global Undoなし", () => {
  const textarea: EditableTargetLike = { tagName: "TEXTAREA" };
  const input: EditableTargetLike = { tagName: "INPUT" };
  assert.equal(isEditableUndoRedoTarget(textarea), true);
  assert.equal(isEditableUndoRedoTarget(input), true);
  assert.equal(
    resolve(key({ key: "z", metaKey: true }), { target: textarea }).action,
    null,
  );
  assert.equal(
    resolve(key({ key: "z", metaKey: true }), { target: input }).action,
    null,
  );
});

test("K L contenteditable and nested → global Undoなし", () => {
  const editable: EditableTargetLike = {
    tagName: "DIV",
    isContentEditable: true,
  };
  const nested: EditableTargetLike = {
    tagName: "SPAN",
    isContentEditable: false,
    parentElement: { tagName: "DIV", isContentEditable: true },
  };
  assert.equal(isEditableUndoRedoTarget(editable), true);
  assert.equal(isEditableUndoRedoTarget(nested), true);
  assert.equal(
    resolve(key({ key: "z", metaKey: true }), { target: nested }).action,
    null,
  );
});

test("M editable内 Redo → globalなし", () => {
  const textarea: EditableTargetLike = { tagName: "TEXTAREA" };
  assert.equal(
    resolve(key({ key: "z", metaKey: true, shiftKey: true }), {
      target: textarea,
    }).action,
    null,
  );
  assert.equal(
    resolve(key({ key: "y", ctrlKey: true }), { target: textarea }).action,
    null,
  );
});

test("N composition → globalなし", () => {
  assert.equal(
    resolve(key({ key: "z", metaKey: true, isComposing: true })).action,
    null,
  );
  assert.equal(
    resolve(key({ key: "z", ctrlKey: true, keyCode: 229 })).action,
    null,
  );
});

test("O repeat → globalなし", () => {
  assert.equal(
    resolve(key({ key: "z", metaKey: true, repeat: true })).action,
    null,
  );
});

test("P Q preventDefault only when action runs", () => {
  const acted = resolve(key({ key: "z", metaKey: true }));
  assert.equal(acted.preventDefault, true);
  const skipped = resolve(key({ key: "z", metaKey: true }), {
    target: { tagName: "TEXTAREA" },
  });
  assert.equal(skipped.preventDefault, false);
  const unknown = resolve(key({ key: "k", metaKey: true }));
  assert.equal(unknown.action, null);
  assert.equal(unknown.preventDefault, false);
});

test("R S T Form2 / Understanding / preview routing", () => {
  assert.match(form2WorkspaceSrc, /useDocumentUndoRedoShortcuts/);
  assert.match(
    form2WorkspaceSrc,
    /inUnderstandingPanel \? handleUnderstandingUndo : handleUndo/,
  );
  assert.match(
    form2WorkspaceSrc,
    /inUnderstandingPanel \? handleUnderstandingRedo : handleRedo/,
  );
  assert.match(
    form2WorkspaceSrc,
    /enabled: inUnderstandingPanel \|\| mode === "edit"/,
  );
  assert.match(form2WorkspaceSrc, /form2UndoRedoLocked/);
});

test("U V W X Form3 workspace / dialog / preview routing", () => {
  assert.match(form3WorkspaceSrc, /useDocumentUndoRedoShortcuts/);
  assert.match(form3WorkspaceSrc, /enabled: !historyLocked/);
  assert.match(form3WorkspaceSrc, /onUndo: handleUndo/);
  assert.match(form3WorkspaceSrc, /onRedo: handleRedo/);
  assert.match(form3WorkspaceSrc, /dialogOpen: formDialogOpen/);
  assert.match(form3WorkspaceSrc, /form3UndoRedoLocked/);
});

type Form2Race = {
  data: Form2Data;
  inFlight: boolean;
  dirtyDuringSave: boolean;
  saveStatus: "idle" | "dirty" | "saving" | "saved";
  persisted: Form2Data | null;
};

function form2OnEdited(session: Form2Race, next: Form2Data) {
  session.data = next;
  if (session.inFlight) {
    session.dirtyDuringSave = true;
    return;
  }
  session.saveStatus = "dirty";
}

function form2SaveStart(session: Form2Race): Form2Data {
  session.inFlight = true;
  session.dirtyDuringSave = false;
  session.saveStatus = "saving";
  return session.data;
}

function form2SaveResponse(session: Form2Race, inflight: Form2Data) {
  session.inFlight = false;
  // existing hook never writes response payload over local dataRef
  if (session.dirtyDuringSave || session.data !== inflight) {
    session.saveStatus = "dirty";
    session.persisted = session.data;
    return;
  }
  session.persisted = session.data;
  session.saveStatus = "saved";
}

function setDiagnosis(data: Form2Data, value: string): Form2Data {
  return {
    ...data,
    basicInformation: { ...data.basicInformation, diagnosis: value },
  };
}

test("Y Z AA Form2 in-flight Undo / stale no overwrite / follow-up = Undo", () => {
  const empty = createEmptyForm2("p");
  const session: Form2Race = {
    data: empty,
    inFlight: false,
    dirtyDuringSave: false,
    saveStatus: "idle",
    persisted: null,
  };
  form2OnEdited(session, setDiagnosis(session.data, "B"));
  const inflight = form2SaveStart(session);
  form2OnEdited(session, setDiagnosis(empty, "A"));
  assert.equal(session.data.basicInformation.diagnosis, "A");
  form2SaveResponse(session, inflight);
  assert.equal(session.data.basicInformation.diagnosis, "A");
  assert.equal(session.persisted?.basicInformation.diagnosis, "A");
  assert.notEqual(session.saveStatus, "saved");
});

test("AB AC Form2 Undo→Redo while save in-flight", () => {
  const empty = createEmptyForm2("p");
  const session: Form2Race = {
    data: setDiagnosis(empty, "A"),
    inFlight: false,
    dirtyDuringSave: false,
    saveStatus: "idle",
    persisted: null,
  };
  form2OnEdited(session, setDiagnosis(session.data, "B"));
  const inflight = form2SaveStart(session);
  form2OnEdited(session, setDiagnosis(empty, "A"));
  form2OnEdited(session, setDiagnosis(empty, "B"));
  form2SaveResponse(session, inflight);
  assert.equal(session.data.basicInformation.diagnosis, "B");
  assert.equal(session.persisted?.basicInformation.diagnosis, "B");
});

type UnderstandingRace = {
  latestRef: { reflections: Record<string, string>; overviewText: string };
  pending: { reflections: Record<string, boolean>; overview: boolean };
  busy: { reflections: Record<string, boolean>; overview: boolean };
};

function understandingChange(
  session: UnderstandingRace,
  kind: "reflection" | "overview",
  text: string,
  key = "basicInformation.diagnosis",
) {
  if (kind === "reflection") {
    session.latestRef.reflections[key] = text;
    if (session.busy.reflections[key]) session.pending.reflections[key] = true;
  } else {
    session.latestRef.overviewText = text;
    if (session.busy.overview) session.pending.overview = true;
  }
}

test("AD AE AF AG Understanding in-flight Undo/Redo / latestRef / no stale overwrite", () => {
  const session: UnderstandingRace = {
    latestRef: { reflections: { "basicInformation.diagnosis": "B" }, overviewText: "概観B" },
    pending: { reflections: {}, overview: false },
    busy: { reflections: { "basicInformation.diagnosis": true }, overview: true },
  };
  understandingChange(session, "reflection", "A");
  understandingChange(session, "overview", "概観A");
  assert.equal(session.latestRef.reflections["basicInformation.diagnosis"], "A");
  assert.equal(session.latestRef.overviewText, "概観A");
  assert.equal(session.pending.reflections["basicInformation.diagnosis"], true);
  assert.equal(session.pending.overview, true);
  understandingChange(session, "reflection", "B");
  understandingChange(session, "overview", "概観B");
  assert.equal(session.latestRef.reflections["basicInformation.diagnosis"], "B");
  assert.equal(session.latestRef.overviewText, "概観B");
  assert.doesNotMatch(reflectionHookSrc, /setTexts\(res/);
  assert.doesNotMatch(overviewHookSrc, /setText\(res/);
  assert.match(reflectionHookSrc, /latestRef\.current\[key\] = next/);
  assert.match(overviewHookSrc, /latestRef\.current = next/);
});

type Form3Race = {
  data: { text: string };
  inflightPayload: { text: string } | null;
  dirtyDuringSave: boolean;
  saveStatus: "idle" | "dirty" | "saving" | "saved";
  persisted: { text: string } | null;
};

function form3Edit(session: Form3Race, text: string) {
  session.data = { text };
  if (session.saveStatus === "saving") session.dirtyDuringSave = true;
}

function form3SaveStart(session: Form3Race) {
  session.dirtyDuringSave = false;
  session.saveStatus = "saving";
  session.inflightPayload = session.data;
}

function form3SaveResponse(session: Form3Race) {
  const edited =
    session.dirtyDuringSave || session.data !== session.inflightPayload;
  if (edited) {
    session.saveStatus = "dirty";
    session.persisted = session.data;
  } else {
    session.persisted = session.data;
    session.saveStatus = "saved";
  }
  session.inflightPayload = null;
}

test("AH AI AJ AK Form3 in-flight Undo/Redo / stale no overwrite / queued latest", () => {
  const session: Form3Race = {
    data: { text: "A" },
    inflightPayload: null,
    dirtyDuringSave: false,
    saveStatus: "idle",
    persisted: null,
  };
  form3Edit(session, "B");
  form3SaveStart(session);
  form3Edit(session, "A");
  form3SaveResponse(session);
  assert.equal(session.data.text, "A");
  assert.equal(session.persisted?.text, "A");
  form3Edit(session, "B");
  form3SaveStart(session);
  form3Edit(session, "A");
  form3Edit(session, "B");
  form3SaveResponse(session);
  assert.equal(session.data.text, "B");
  assert.equal(session.persisted?.text, "B");
  assert.match(form3HookSrc, /dirtyDuringSaveV2Ref/);
  assert.match(form3HookSrc, /dataV2Ref\.current !== payloadToSave/);
});

test("AL AM AN rapid A→B→C Undo Undo Redo Redo", () => {
  const empty = createEmptyForm2("p");
  const session: Form2Race = {
    data: empty,
    inFlight: false,
    dirtyDuringSave: false,
    saveStatus: "idle",
    persisted: null,
  };
  const a = setDiagnosis(empty, "A");
  const b = setDiagnosis(empty, "B");
  const c = setDiagnosis(empty, "C");
  form2OnEdited(session, a);
  form2OnEdited(session, b);
  form2OnEdited(session, c);
  const inflight = form2SaveStart(session);
  form2OnEdited(session, b);
  form2OnEdited(session, a);
  form2OnEdited(session, b);
  form2OnEdited(session, c);
  form2SaveResponse(session, inflight);
  assert.equal(session.data.basicInformation.diagnosis, "C");
  assert.equal(session.persisted?.basicInformation.diagnosis, "C");
});

test("saveStatus does not become saved before latest payload", () => {
  assert.match(form2HookSrc, /dirtyDuringSaveRef\.current/);
  assert.match(form2HookSrc, /scheduleSave\(\)/);
  assert.match(
    form2HookSrc,
    /setSaveStatus\(\(prev\) => \(prev === "saving" \? prev : "dirty"\)\)/,
  );
  assert.match(form3HookSrc, /saveStatus: "dirty"/);
});

test("scope: shared hook only / U1 unchanged / no RD Priority", () => {
  assert.match(hookSrc, /resolveDocumentUndoRedoShortcut/);
  assert.match(hookSrc, /window\.addEventListener\("keydown"/);
  assert.doesNotMatch(shortcutSrc, /pushDocumentHistory/);
  assert.doesNotMatch(shortcutSrc, /diagramHistory/);
  assert.doesNotMatch(shortcutSrc, /nursingProblemPriority/);
  assert.doesNotMatch(hookSrc, /saveForm2Action/);
  assert.match(u1Src, /export const DOCUMENT_HISTORY_LIMIT = 50/);
  assert.match(form2HookSrc, /onDocumentBaselineResetRef/);
  assert.match(form3HookSrc, /onDocumentBaselineResetRef/);
  assert.match(form2WorkspaceSrc, /onDocumentBaselineReset: clearHistory/);
  assert.doesNotMatch(
    form2WorkspaceSrc,
    /onDocumentBaselineReset:[\s\S]*clearUnderstanding/,
  );
});

console.log(`\n${passed} tests passed`);
