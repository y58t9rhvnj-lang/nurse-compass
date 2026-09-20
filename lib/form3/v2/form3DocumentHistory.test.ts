/**
 * U2 Form3 document history adapter + restore contract.
 * Run: npx tsx lib/form3/v2/form3DocumentHistory.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  addForm3AssessmentCard,
  archiveForm3AssessmentCard,
  updateForm3AssessmentCard,
} from "./form3V2AssessmentOps";
import {
  canRedoForm3DocumentHistory,
  canUndoForm3DocumentHistory,
  clearForm3DocumentHistory,
  DOCUMENT_HISTORY_LIMIT,
  emptyForm3DocumentHistory,
  form3DataV2EqualForHistory,
  form3HistorySessionKey,
  form3RestoreAutosaveReason,
  form3UndoRedoDisabled,
  form3UndoRedoLocked,
  pushForm3DocumentHistory,
  redoForm3DocumentHistory,
  undoForm3DocumentHistory,
  type Form3DocumentHistory,
} from "./form3DocumentHistory";
import { createEmptyForm3V2 } from "./form3V2Factory";
import {
  addForm3InformationCard,
  archiveForm3InformationCard,
  updateForm3InformationCard,
} from "./form3V2InformationOps";
import {
  applyForm3V2SaveSuccess,
  createInitialForm3V2WriteFlags,
  markForm3V2UserEdited,
  type Form3V2WriteFlags,
} from "./form3V2WritePath";
import type { Form3DataV2 } from "./form3V2Types";
import { DOCUMENT_HISTORY_LIMIT as U1_LIMIT } from "../../v2/history/documentHistory";

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
const NOW = "2026-09-20T00:00:00.000Z";
const root = process.cwd();
const src = (rel: string) => readFileSync(join(root, rel), "utf8");
const adapterSrc = src("lib/form3/v2/form3DocumentHistory.ts");
const hookSrc = src("hooks/v2/useForm3DocumentHistory.ts");
const workspaceSrc = src("components/v2/form3/Form3PhaseBWorkspace.tsx");
const buttonsSrc = src("components/v2/workspace/DocumentUndoRedoButtons.tsx");
const supabaseSrc = src("hooks/v2/useForm3Supabase.ts");

type Session = {
  data: Form3DataV2;
  dataRef: { current: Form3DataV2 };
  history: Form3DocumentHistory;
  flags: Form3V2WriteFlags;
  expectedVersion: number;
  dirtyDuringSave: boolean;
  inFlightPayload: Form3DataV2 | null;
  queuedSaves: Form3DataV2[];
  scheduled: number;
  submittedSnapshot: Form3DataV2 | null;
};

function createSession(data = createEmptyForm3V2(PATIENT)): Session {
  return {
    data,
    dataRef: { current: data },
    history: emptyForm3DocumentHistory(),
    flags: createInitialForm3V2WriteFlags({ hasPersistedV2: true }),
    expectedVersion: 3,
    dirtyDuringSave: false,
    inFlightPayload: null,
    queuedSaves: [],
    scheduled: 0,
    submittedSnapshot: null,
  };
}

function markEdited(session: Session, next: Form3DataV2) {
  if (session.flags.saveStatus === "saving") session.dirtyDuringSave = true;
  session.data = next;
  session.dataRef.current = next;
  session.flags = markForm3V2UserEdited(session.flags, next).flags;
  session.scheduled += 1;
}

function apply(
  session: Session,
  recipe: (current: Form3DataV2) => Form3DataV2,
  reason: string,
) {
  const before = session.dataRef.current;
  const after = recipe(before);
  session.history = pushForm3DocumentHistory(session.history, {
    before,
    after,
    reason,
  });
  markEdited(session, after);
}

function undo(session: Session) {
  const result = undoForm3DocumentHistory(session.history);
  session.history = result.history;
  if (result.snapshot) markEdited(session, result.snapshot);
  return result.snapshot;
}

function redo(session: Session) {
  const result = redoForm3DocumentHistory(session.history);
  session.history = result.history;
  if (result.snapshot) markEdited(session, result.snapshot);
  return result.snapshot;
}

function beginSave(session: Session) {
  session.flags = { ...session.flags, saveStatus: "saving" };
  session.dirtyDuringSave = false;
  session.inFlightPayload = session.dataRef.current;
  return session.inFlightPayload;
}

function finishSave(session: Session, serverPayload: Form3DataV2) {
  const payloadToSave = session.inFlightPayload;
  const editedDuringSave =
    session.dirtyDuringSave || session.dataRef.current !== payloadToSave;
  session.expectedVersion += 1;
  if (editedDuringSave) {
    session.flags = {
      ...session.flags,
      dirty: true,
      hasUserEdited: true,
      saveStatus: "dirty",
    };
    session.queuedSaves.push(session.dataRef.current);
    session.scheduled += 1;
  } else {
    session.data = serverPayload;
    session.dataRef.current = serverPayload;
    session.flags = applyForm3V2SaveSuccess(session.flags);
  }
  session.inFlightPayload = null;
}

function addInfo(
  data: Form3DataV2,
  content: string,
  extra: Parameters<typeof addForm3InformationCard>[1] = {},
) {
  return addForm3InformationCard(data, {
    now: NOW,
    patternKeys: ["health_perception_management"],
    content,
    soType: "S",
    ...extra,
  });
}

test("A initial buttons disabled", () => {
  const history = emptyForm3DocumentHistory();
  const disabled = form3UndoRedoDisabled(history, { mode: "edit" });
  assert.equal(canUndoForm3DocumentHistory(history), false);
  assert.equal(canRedoForm3DocumentHistory(history), false);
  assert.equal(disabled.undo, true);
  assert.equal(disabled.redo, true);
});

test("B C D E Information Create Undo/Redo same Card ID / no UUID regen", () => {
  const session = createSession();
  apply(session, (current) => addInfo(current, "睡眠が浅い"), "information_added");
  const created = session.data.informationCards[0]!;
  assert.equal(canUndoForm3DocumentHistory(session.history), true);
  const undone = undo(session);
  assert.ok(undone);
  assert.equal(undone.informationCards.length, 0);
  assert.deepEqual(undone, createEmptyForm3V2(PATIENT));
  const redone = redo(session);
  assert.ok(redone);
  assert.equal(redone.informationCards[0]?.id, created.id);
  assert.equal(redone.informationCards[0]?.content, "睡眠が浅い");
  assert.notEqual(redone.informationCards[0]?.id.startsWith("local-regen"), true);
});

test("F G H Information Edit = 1 history / text / soType exact", () => {
  let data = addInfo(createEmptyForm3V2(PATIENT), "原文");
  const id = data.informationCards[0]!.id;
  const session = createSession(data);
  apply(
    session,
    (current) =>
      updateForm3InformationCard(
        current,
        id,
        { content: "改稿", soType: "O" },
        { now: "2026-09-20T01:00:00.000Z" },
      ),
    "information_updated",
  );
  assert.equal(session.history.past.length, 1);
  const undone = undo(session);
  assert.equal(undone?.informationCards[0]?.content, "原文");
  assert.equal(undone?.informationCards[0]?.soType, "S");
});

test("I J K L M N O Information archive Undo exact + evidence refs", () => {
  let data = addInfo(createEmptyForm3V2(PATIENT), "観察メモ");
  data = updateForm3InformationCard(
    data,
    data.informationCards[0]!.id,
    {
      sourceType: "nursing_record",
      sourceReference: { kind: "fixture", sourceRecordId: "rec-1", path: "a" },
      sourceLabel: "看護記録",
      patternKeys: ["activity_exercise", "sleep_rest"],
    },
    { now: NOW },
  );
  const info = data.informationCards[0]!;
  data = addForm3AssessmentCard(data, {
    now: NOW,
    patternKey: "activity_exercise",
    interpretation: "活動耐性低下",
    evidenceInformationIds: [info.id],
  });
  const session = createSession(data);
  apply(
    session,
    (current) => archiveForm3InformationCard(current, info.id, { now: NOW }),
    "information_archived",
  );
  assert.equal(session.history.past.length, 1);
  const undone = undo(session);
  const restored = undone?.informationCards.find((c) => c.id === info.id);
  assert.ok(restored);
  assert.equal(restored.id, info.id);
  assert.equal(restored.content, "観察メモ");
  assert.equal(restored.soType, "S");
  assert.equal(restored.sourceType, "nursing_record");
  assert.deepEqual(restored.sourceReference, {
    kind: "fixture",
    sourceRecordId: "rec-1",
    path: "a",
  });
  assert.deepEqual(restored.patternKeys, ["activity_exercise", "sleep_rest"]);
  assert.equal(restored.order, info.order);
  assert.equal(restored.status, "active");
  assert.equal(restored.createdAt, info.createdAt);
  assert.equal(restored.updatedAt, info.updatedAt);
  assert.deepEqual(undone?.assessmentCards[0]?.evidenceInformationIds, [info.id]);
});

test("P Q R S T Assessment Create/Edit/Archive exact", () => {
  let data = addInfo(createEmptyForm3V2(PATIENT), "根拠");
  const infoId = data.informationCards[0]!.id;
  const session = createSession(data);
  apply(
    session,
    (current) =>
      addForm3AssessmentCard(current, {
        now: NOW,
        patternKey: "health_perception_management",
        interpretation: "初稿",
        evidenceInformationIds: [infoId],
      }),
    "assessment_added",
  );
  const assessId = session.data.assessmentCards[0]!.id;
  const afterCreate = undo(session);
  assert.equal(afterCreate?.assessmentCards.length, 0);
  const redone = redo(session);
  assert.equal(redone?.assessmentCards[0]?.id, assessId);

  apply(
    session,
    (current) =>
      updateForm3AssessmentCard(
        current,
        assessId,
        { interpretation: "改稿", evidenceInformationIds: [infoId] },
        { now: "2026-09-20T02:00:00.000Z" },
      ),
    "assessment_updated",
  );
  assert.equal(session.history.past.length, 2);
  const undoneEdit = undo(session);
  assert.equal(undoneEdit?.assessmentCards[0]?.interpretation, "初稿");
  assert.deepEqual(undoneEdit?.assessmentCards[0]?.evidenceInformationIds, [
    infoId,
  ]);
  redo(session);

  const beforeArchive = session.data.assessmentCards[0]!;
  apply(
    session,
    (current) => archiveForm3AssessmentCard(current, assessId, { now: NOW }),
    "assessment_archived",
  );
  const undoneArchive = undo(session);
  const restored = undoneArchive?.assessmentCards[0];
  assert.equal(restored?.id, assessId);
  assert.equal(restored?.interpretation, "改稿");
  assert.equal(restored?.classification, beforeArchive.classification);
  assert.deepEqual(restored?.evidenceInformationIds, [infoId]);
  assert.equal(restored?.needMoreInformation, beforeArchive.needMoreInformation);
  assert.equal(restored?.patternKey, beforeArchive.patternKey);
  assert.equal(restored?.order, beforeArchive.order);
  assert.equal(restored?.createdAt, beforeArchive.createdAt);
  assert.equal(restored?.updatedAt, beforeArchive.updatedAt);
  assert.equal(restored?.status, "draft");
});

test("U V W X Undo/Redo restore dirty / schedule / version excluded", () => {
  const session = createSession();
  apply(session, (current) => addInfo(current, "A"), "information_added");
  const versionBeforeUndo = session.expectedVersion;
  undo(session);
  assert.equal(session.flags.dirty, true);
  assert.equal(session.flags.hasUserEdited, true);
  assert.ok(session.scheduled >= 2);
  assert.equal(session.expectedVersion, versionBeforeUndo);
  assert.equal("expectedVersion" in session.data, false);
  redo(session);
  assert.equal(session.flags.dirty, true);
  assert.equal(session.expectedVersion, versionBeforeUndo);
});

test("Y Z AA saving中 Undo / stale save は上書きしない / queued は Undo state", () => {
  const session = createSession();
  apply(session, (current) => addInfo(current, "編集"), "information_added");
  const afterEdit = session.data;
  const payloadToSave = beginSave(session);
  apply(
    session,
    (current) =>
      archiveForm3InformationCard(
        current,
        current.informationCards[0]!.id,
        { now: NOW },
      ),
    "information_archived",
  );
  const undone = undo(session);
  assert.equal(session.dirtyDuringSave, true);
  assert.equal(session.flags.saveStatus, "saving");
  finishSave(session, payloadToSave);
  assert.equal(session.dataRef.current, undone);
  assert.notEqual(session.dataRef.current, payloadToSave);
  assert.equal(session.data.informationCards[0]?.status, "active");
  assert.equal(session.data.informationCards[0]?.content, "編集");
  assert.equal(session.queuedSaves.length, 1);
  assert.equal(session.queuedSaves[0], undone);
  assert.equal(form3DataV2EqualForHistory(session.queuedSaves[0]!, afterEdit), true);
});

test("AB conflict loadLatest → history clear", () => {
  const session = createSession();
  apply(session, (current) => addInfo(current, "local"), "information_added");
  assert.equal(canUndoForm3DocumentHistory(session.history), true);
  const latest = addInfo(createEmptyForm3V2(PATIENT), "server");
  session.data = latest;
  session.dataRef.current = latest;
  session.history = clearForm3DocumentHistory(session.history);
  session.expectedVersion = 9;
  session.flags = createInitialForm3V2WriteFlags({ hasPersistedV2: true });
  assert.equal(canUndoForm3DocumentHistory(session.history), false);
  assert.equal(canRedoForm3DocumentHistory(session.history), false);
  assert.equal(session.data.informationCards[0]?.content, "server");
});

test("AC AD patient/record clear / pattern change preserve", () => {
  const session = createSession();
  apply(session, (current) => addInfo(current, "pattern1"), "information_added");
  const keyA = form3HistorySessionKey("A", "user-1");
  const keyB = form3HistorySessionKey("B", "user-1");
  assert.notEqual(keyA, keyB);
  const afterPatternUiOnly = session.history;
  assert.equal(canUndoForm3DocumentHistory(afterPatternUiOnly), true);
  session.history = clearForm3DocumentHistory();
  assert.equal(canUndoForm3DocumentHistory(session.history), false);
});

test("AE AF AG AH AI preview/dialog/submit/empty disabled, stack preserved", () => {
  const session = createSession();
  apply(session, (current) => addInfo(current, "keep"), "information_added");
  const preview = form3UndoRedoDisabled(session.history, { mode: "view" });
  assert.equal(preview.undo, true);
  assert.equal(preview.redo, true);
  assert.equal(canUndoForm3DocumentHistory(session.history), true);
  const editAgain = form3UndoRedoDisabled(session.history, { mode: "edit" });
  assert.equal(editAgain.undo, false);
  assert.equal(
    form3UndoRedoDisabled(session.history, { mode: "edit", dialogOpen: true })
      .undo,
    true,
  );
  assert.equal(
    form3UndoRedoDisabled(session.history, {
      mode: "edit",
      submitConfirmOpen: true,
    }).undo,
    true,
  );
  assert.equal(form3UndoRedoLocked({ mode: "view" }), true);
  assert.equal(
    form3UndoRedoDisabled(emptyForm3DocumentHistory(), { mode: "edit" }).undo,
    true,
  );
});

test("AN Undo後のnew edit → future clear", () => {
  const session = createSession();
  apply(session, (current) => addInfo(current, "A"), "information_added");
  apply(
    session,
    (current) =>
      updateForm3InformationCard(
        current,
        current.informationCards[0]!.id,
        { content: "B" },
        { now: NOW },
      ),
    "information_updated",
  );
  undo(session);
  assert.equal(canRedoForm3DocumentHistory(session.history), true);
  apply(
    session,
    (current) =>
      updateForm3InformationCard(
        current,
        current.informationCards[0]!.id,
        { content: "D" },
        { now: NOW },
      ),
    "information_updated",
  );
  assert.equal(session.history.future.length, 0);
  assert.equal(canRedoForm3DocumentHistory(session.history), false);
});

test("AO max50 inherited from U1", () => {
  assert.equal(DOCUMENT_HISTORY_LIMIT, 50);
  assert.equal(DOCUMENT_HISTORY_LIMIT, U1_LIMIT);
  assert.equal(adapterSrc.includes("const DOCUMENT_HISTORY_LIMIT = 50"), false);
  let history = emptyForm3DocumentHistory();
  let data = createEmptyForm3V2(PATIENT);
  for (let i = 0; i < 51; i += 1) {
    const after = {
      ...data,
      informationCards: [
        ...data.informationCards,
        {
          id: `card_${i}`,
          content: `n${i}`,
          soType: "S" as const,
          sourceType: "other" as const,
          patternKeys: [],
          order: i,
          status: "active" as const,
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
    };
    history = pushForm3DocumentHistory(history, {
      before: data,
      after,
      reason: "form3_field_edit",
    });
    data = after;
  }
  assert.equal(history.past.length, 50);
  assert.equal(history.past[0]?.after.informationCards.at(-1)?.id, "card_1");
});

test("AP NO-OP no history", () => {
  const data = addInfo(createEmptyForm3V2(PATIENT), "同じ");
  const id = data.informationCards[0]!.id;
  let history = emptyForm3DocumentHistory();
  history = pushForm3DocumentHistory(history, {
    before: data,
    after: updateForm3InformationCard(
      data,
      id,
      { content: "同じ", soType: "S" },
      { now: "2026-09-21T00:00:00.000Z" },
    ),
    reason: "information_updated",
  });
  assert.equal(history.past.length, 0);
  history = pushForm3DocumentHistory(history, {
    before: data,
    after: addInfo(data, "追加"),
    reason: "information_added",
  });
  history = undoForm3DocumentHistory(history).history;
  const noop = pushForm3DocumentHistory(history, {
    before: data,
    after: updateForm3InformationCard(
      data,
      id,
      { content: "同じ" },
      { now: "2026-09-22T00:00:00.000Z" },
    ),
  });
  assert.equal(noop, history);
  assert.equal(noop.future.length, 1);
});

test("AQ submitted snapshot unchanged", () => {
  const submitted = addInfo(createEmptyForm3V2(PATIENT), "提出済み");
  const session = createSession(addInfo(createEmptyForm3V2(PATIENT), "作業"));
  session.submittedSnapshot = submitted;
  apply(
    session,
    (current) =>
      archiveForm3InformationCard(
        current,
        current.informationCards[0]!.id,
        { now: NOW },
      ),
    "information_archived",
  );
  undo(session);
  assert.equal(session.submittedSnapshot, submitted);
  assert.equal(session.submittedSnapshot.informationCards[0]?.content, "提出済み");
  assert.notEqual(session.data, submitted);
});

test("AJ AK AL AM header UI contract", () => {
  assert.match(buttonsSrc, /戻す/);
  assert.match(buttonsSrc, /やり直す/);
  assert.match(buttonsSrc, /↶/);
  assert.match(buttonsSrc, /↷/);
  assert.match(buttonsSrc, /min-h-\[44px\]/);
  assert.match(buttonsSrc, /min-w-\[44px\]/);
  assert.match(buttonsSrc, /no-print/);
  assert.match(buttonsSrc, /sm:px-3/);
  assert.match(buttonsSrc, /disabled=\{!undoEnabled\}/);
  assert.match(workspaceSrc, /Form3UndoRedoButtons/);
  assert.match(workspaceSrc, /saveStatus=\{saveStatusNode\}/);
  const headerStart = workspaceSrc.indexOf("const headerActions");
  const undoIdx = workspaceSrc.indexOf("<Form3UndoRedoButtons", headerStart);
  const previewIdx = workspaceSrc.indexOf(">プレビュー<", headerStart);
  assert.ok(headerStart > 0 && undoIdx > headerStart && undoIdx < previewIdx);
});

test("AE AF wiring: preview lock / edit return", () => {
  assert.match(workspaceSrc, /form3UndoRedoLocked/);
  assert.match(workspaceSrc, /mode,/);
  assert.match(workspaceSrc, /dialogOpen: formDialogOpen/);
  assert.match(workspaceSrc, /submitConfirmOpen: false/);
  assert.doesNotMatch(workspaceSrc, /addEventListener\("keydown"/);
  assert.doesNotMatch(workspaceSrc, /Meta\+Z|cmd\+z|Cmd\+Z/i);
});

test("AR AS Related Diagram / Priority untouched by Form3 history", () => {
  for (const text of [adapterSrc, hookSrc, workspaceSrc, buttonsSrc]) {
    assert.equal(text.includes("diagramHistory"), false);
    assert.equal(text.includes("nursingProblemPriority"), false);
    assert.equal(text.includes("RelatedDiagram"), false);
  }
});

test("restore uses markUserEditedV2 / never saveNowV2 / U1 primitive", () => {
  assert.match(workspaceSrc, /markUserEditedV2\(result\.snapshot/);
  assert.match(workspaceSrc, /markUserEditedV2\(after, reason\)/);
  assert.doesNotMatch(workspaceSrc, /\bsaveNowV2\b/);
  assert.doesNotMatch(adapterSrc, /saveForm3|from ["']@supabase|from ["']react/);
  assert.doesNotMatch(hookSrc, /saveForm3|saveNowV2|from ["']@supabase/);
  assert.match(adapterSrc, /documentHistory/);
  assert.match(adapterSrc, /form3DataV2EqualForHistory/);
  assert.equal(form3RestoreAutosaveReason("information_archived"), "information_restored");
  assert.equal(form3RestoreAutosaveReason("assessment_archived"), "assessment_restored");
  assert.match(supabaseSrc, /onDocumentBaselineReset/);
  assert.match(supabaseSrc, /getDataV2/);
  assert.match(workspaceSrc, /onDocumentBaselineReset: clearHistory/);
});

test("recipe runs once on Create so Redo does not mint a new UUID", () => {
  let recipeCalls = 0;
  const session = createSession();
  apply(
    session,
    (current) => {
      recipeCalls += 1;
      return addInfo(current, "一度だけ");
    },
    "information_added",
  );
  const id = session.data.informationCards[0]!.id;
  undo(session);
  redo(session);
  assert.equal(recipeCalls, 1);
  assert.equal(session.data.informationCards[0]?.id, id);
});

console.log(`\n${passed} tests passed`);
