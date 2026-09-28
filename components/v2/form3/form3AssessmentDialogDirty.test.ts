/**
 * Form3 Assessment dialog dirty-close contract.
 * Run: ./node_modules/.bin/jiti components/v2/form3/form3AssessmentDialogDirty.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { form3AssessmentDialogHasChanges } from "./form3AssessmentDialogDirty";

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

test("add: empty draft is not dirty", () => {
  assert.equal(
    form3AssessmentDialogHasChanges(
      { evidenceInformationIds: [], interpretation: "" },
      null,
    ),
    false,
  );
});

test("add: typed text is dirty; reverting is not", () => {
  assert.equal(
    form3AssessmentDialogHasChanges(
      { evidenceInformationIds: [], interpretation: "幻覚を認める" },
      null,
    ),
    true,
  );
  assert.equal(
    form3AssessmentDialogHasChanges(
      { evidenceInformationIds: [], interpretation: "" },
      null,
    ),
    false,
  );
});

test("add: evidence toggle is dirty even without text", () => {
  assert.equal(
    form3AssessmentDialogHasChanges(
      { evidenceInformationIds: ["info-1"], interpretation: "" },
      null,
    ),
    true,
  );
});

test("edit: same values are not dirty; text or evidence change is", () => {
  const initial = {
    evidenceInformationIds: ["info-1", "info-2"],
    interpretation: "現状の解釈",
  };
  assert.equal(
    form3AssessmentDialogHasChanges(
      {
        evidenceInformationIds: ["info-2", "info-1"],
        interpretation: "現状の解釈",
      },
      initial,
    ),
    false,
  );
  assert.equal(
    form3AssessmentDialogHasChanges(
      {
        evidenceInformationIds: ["info-1", "info-2"],
        interpretation: "現状の解釈を更新",
      },
      initial,
    ),
    true,
  );
  assert.equal(
    form3AssessmentDialogHasChanges(
      {
        evidenceInformationIds: ["info-1"],
        interpretation: "現状の解釈",
      },
      initial,
    ),
    true,
  );
});

test("dialog warns only when dirty; save path stays onSubmit", () => {
  const dialog = src("./Form3AssessmentDialog.tsx");
  assert.ok(dialog.includes("function requestClose"));
  assert.ok(dialog.includes("onClick={requestClose}"));
  assert.ok(dialog.includes("onClose={requestClose}"));
  assert.ok(dialog.includes("入力内容を破棄して閉じる"));
  assert.ok(dialog.includes("編集を続ける"));
  assert.ok(dialog.includes("if (!dirty)"));
  const submitFn = dialog.slice(
    dialog.indexOf("function handleSubmit"),
    dialog.indexOf("function requestClose"),
  );
  assert.ok(submitFn.includes("onSubmit({"));
  assert.equal(submitFn.includes("setDiscardOpen"), false);
  assert.equal(submitFn.includes("onClose("), false);
});

test("information dialog cancel path is unchanged", () => {
  const info = src("./Form3InformationDialog.tsx");
  assert.equal(info.includes("requestClose"), false);
  assert.equal(info.includes("入力内容を破棄して閉じる"), false);
  assert.ok(info.includes("onClick={onClose}"));
});

console.log(`\n${passed} passed`);
