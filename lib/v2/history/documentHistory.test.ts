/**
 * U1 document history primitive tests.
 * Run: npx tsx lib/v2/history/documentHistory.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  canRedoDocumentHistory,
  canUndoDocumentHistory,
  clearDocumentHistory,
  DOCUMENT_HISTORY_LIMIT,
  emptyDocumentHistory,
  pushDocumentHistory,
  redoDocumentHistory,
  undoDocumentHistory,
} from "./documentHistory";

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

type Doc = {
  id: string;
  text: string;
  tags: string[];
  updatedAt: string;
  nested: { score: number };
};

function doc(partial: Partial<Doc> & Pick<Doc, "id" | "text">): Doc {
  return {
    tags: [],
    updatedAt: "2026-09-20T00:00:00.000Z",
    nested: { score: 0 },
    ...partial,
  };
}

const lib = readFileSync(new URL("./documentHistory.ts", import.meta.url), "utf8");

test("A initial past/future empty", () => {
  const history = emptyDocumentHistory<Doc>();
  assert.deepEqual(history.past, []);
  assert.deepEqual(history.future, []);
});

test("B C initial canUndo/canRedo false", () => {
  const history = emptyDocumentHistory<Doc>();
  assert.equal(canUndoDocumentHistory(history), false);
  assert.equal(canRedoDocumentHistory(history), false);
});

test("D E push1 → canUndo true / future empty", () => {
  const a = doc({ id: "card_1", text: "A" });
  const b = doc({ id: "card_1", text: "B" });
  const history = pushDocumentHistory(emptyDocumentHistory<Doc>(), {
    before: a,
    after: b,
    reason: "form3_assessment_updated",
  });
  assert.equal(canUndoDocumentHistory(history), true);
  assert.equal(canRedoDocumentHistory(history), false);
  assert.equal(history.future.length, 0);
  assert.equal(history.past.length, 1);
});

test("F G H I undo/redo chain A→B→C", () => {
  const a = doc({ id: "card_1", text: "A" });
  const b = doc({ id: "card_1", text: "B" });
  const c = doc({ id: "card_1", text: "C" });
  let history = pushDocumentHistory(emptyDocumentHistory<Doc>(), {
    before: a,
    after: b,
  });
  history = pushDocumentHistory(history, { before: b, after: c });
  const firstUndo = undoDocumentHistory(history);
  assert.deepEqual(firstUndo.snapshot, b);
  history = firstUndo.history;
  const secondUndo = undoDocumentHistory(history);
  assert.deepEqual(secondUndo.snapshot, a);
  history = secondUndo.history;
  const firstRedo = redoDocumentHistory(history);
  assert.deepEqual(firstRedo.snapshot, b);
  history = firstRedo.history;
  const secondRedo = redoDocumentHistory(history);
  assert.deepEqual(secondRedo.snapshot, c);
  assert.equal(canRedoDocumentHistory(secondRedo.history), false);
  assert.equal(canUndoDocumentHistory(secondRedo.history), true);
});

test("J undo後のnew pushでfuture clear", () => {
  const a = doc({ id: "card_1", text: "A" });
  const b = doc({ id: "card_1", text: "B" });
  const c = doc({ id: "card_1", text: "C" });
  const d = doc({ id: "card_1", text: "D" });
  let history = pushDocumentHistory(emptyDocumentHistory<Doc>(), {
    before: a,
    after: b,
  });
  history = pushDocumentHistory(history, { before: b, after: c });
  history = undoDocumentHistory(history).history;
  assert.equal(canRedoDocumentHistory(history), true);
  history = pushDocumentHistory(history, { before: b, after: d });
  assert.equal(history.future.length, 0);
  assert.equal(canRedoDocumentHistory(history), false);
  assert.deepEqual(undoDocumentHistory(history).snapshot, b);
});

test("K clear → both empty", () => {
  let history = pushDocumentHistory(emptyDocumentHistory<Doc>(), {
    before: doc({ id: "card_1", text: "A" }),
    after: doc({ id: "card_1", text: "B" }),
  });
  history = undoDocumentHistory(history).history;
  history = clearDocumentHistory(history);
  assert.deepEqual(history.past, []);
  assert.deepEqual(history.future, []);
  assert.equal(canUndoDocumentHistory(history), false);
  assert.equal(canRedoDocumentHistory(history), false);
});

test("L limit 50 → 51件目でoldest drop", () => {
  assert.equal(DOCUMENT_HISTORY_LIMIT, 50);
  let history = emptyDocumentHistory<number>();
  for (let i = 0; i < 50; i += 1) {
    history = pushDocumentHistory(history, { before: i, after: i + 1 });
  }
  assert.equal(history.past.length, 50);
  assert.equal(history.past[0]?.before, 0);
  assert.equal(history.past[49]?.after, 50);
  history = pushDocumentHistory(history, { before: 50, after: 51 });
  assert.equal(history.past.length, 50);
  assert.equal(history.past[0]?.before, 1);
  assert.equal(history.past[49]?.after, 51);
});

test("M N same snapshot NO-OP / futureを消さない", () => {
  const a = doc({ id: "card_1", text: "A" });
  const b = doc({ id: "card_1", text: "B" });
  let history = pushDocumentHistory(emptyDocumentHistory<Doc>(), {
    before: a,
    after: b,
  });
  history = undoDocumentHistory(history).history;
  assert.equal(history.future.length, 1);
  const sameRef = pushDocumentHistory(history, { before: a, after: a });
  assert.equal(sameRef, history);
  assert.equal(sameRef.past.length, 0);
  assert.equal(sameRef.future.length, 1);
  const sameByEqual = pushDocumentHistory(history, {
    before: doc({ id: "card_1", text: "A" }),
    after: doc({ id: "card_1", text: "A" }),
    equal: (left, right) => left.text === right.text && left.id === right.id,
  });
  assert.equal(sameByEqual, history);
  assert.equal(sameByEqual.future.length, 1);
});

test("O P Q R nested / arrays / IDs / timestamps exact", () => {
  const before = doc({
    id: "info_42",
    text: "原文",
    tags: ["sleep", "nutrition"],
    updatedAt: "2026-09-19T10:00:00.000Z",
    nested: { score: 3 },
  });
  const after = doc({
    id: "info_42",
    text: "改稿",
    tags: ["sleep"],
    updatedAt: "2026-09-19T10:01:00.000Z",
    nested: { score: 7 },
  });
  const history = pushDocumentHistory(emptyDocumentHistory<Doc>(), {
    before,
    after,
    reason: "form3_information_archived",
  });
  const undone = undoDocumentHistory(history);
  assert.deepEqual(undone.snapshot, before);
  assert.equal(undone.snapshot?.id, "info_42");
  assert.deepEqual(undone.snapshot?.tags, ["sleep", "nutrition"]);
  assert.equal(undone.snapshot?.updatedAt, "2026-09-19T10:00:00.000Z");
  assert.deepEqual(undone.snapshot?.nested, { score: 3 });
  const redone = redoDocumentHistory(undone.history);
  assert.deepEqual(redone.snapshot, after);
  assert.equal(redone.snapshot?.id, "info_42");
  assert.deepEqual(redone.snapshot?.tags, ["sleep"]);
  assert.equal(redone.snapshot?.updatedAt, "2026-09-19T10:01:00.000Z");
  assert.deepEqual(redone.snapshot?.nested, { score: 7 });
});

test("S recorded snapshotはcaller mutationから独立", () => {
  const before = doc({ id: "card_1", text: "A", tags: ["keep"] });
  const after = doc({ id: "card_1", text: "B", tags: ["keep"] });
  const history = pushDocumentHistory(emptyDocumentHistory<Doc>(), {
    before,
    after,
  });
  before.text = "mutated";
  before.tags.push("extra");
  after.text = "mutated-after";
  const undone = undoDocumentHistory(history);
  assert.equal(undone.snapshot?.text, "A");
  assert.deepEqual(undone.snapshot?.tags, ["keep"]);
  const redone = redoDocumentHistory(undone.history);
  assert.equal(redone.snapshot?.text, "B");
});

test("T undo返却objectをmutationしてもredo snapshotは壊れない", () => {
  const history = pushDocumentHistory(emptyDocumentHistory<Doc>(), {
    before: doc({ id: "card_1", text: "A", nested: { score: 1 } }),
    after: doc({ id: "card_1", text: "B", nested: { score: 2 } }),
  });
  const undone = undoDocumentHistory(history);
  undone.snapshot!.text = "mutated-return";
  undone.snapshot!.nested.score = 99;
  const redone = redoDocumentHistory(undone.history);
  assert.equal(redone.snapshot?.text, "B");
  assert.equal(redone.snapshot?.nested.score, 2);
  const undoneAgain = undoDocumentHistory(redone.history);
  assert.equal(undoneAgain.snapshot?.text, "A");
  assert.equal(undoneAgain.snapshot?.nested.score, 1);
});

test("U reason保持", () => {
  const history = pushDocumentHistory(emptyDocumentHistory<Doc>(), {
    before: doc({ id: "card_1", text: "A" }),
    after: doc({ id: "card_1", text: "B" }),
    reason: "form2_field_edit",
  });
  assert.equal(history.past[0]?.reason, "form2_field_edit");
  const undone = undoDocumentHistory(history);
  assert.equal(undone.history.future[0]?.reason, "form2_field_edit");
  const redone = redoDocumentHistory(undone.history);
  assert.equal(redone.history.past[0]?.reason, "form2_field_edit");
});

test("V DB/version概念なし / React・autosave非依存", () => {
  assert.equal(lib.includes("expectedVersion"), false);
  assert.equal(lib.includes("optimistic"), false);
  assert.equal(lib.includes("supabase"), false);
  assert.equal(lib.includes("saveForm2"), false);
  assert.equal(lib.includes("saveForm3"), false);
  assert.equal(lib.includes("saveForm"), false);
  assert.equal(lib.includes("Autosave"), false);
  assert.equal(lib.includes("from \"react\""), false);
  assert.equal(lib.includes("from 'react'"), false);
  assert.equal(lib.includes("diagramHistory"), false);
  assert.equal(lib.includes("composition"), false);
  assert.equal(lib.includes("JSON.stringify"), false);
});

test("empty undo/redoはNO-OP", () => {
  const history = emptyDocumentHistory<Doc>();
  const undone = undoDocumentHistory(history);
  assert.equal(undone.snapshot, null);
  assert.equal(undone.history, history);
  const redone = redoDocumentHistory(history);
  assert.equal(redone.snapshot, null);
  assert.equal(redone.history, history);
});

console.log(`\n${passed} tests passed`);
