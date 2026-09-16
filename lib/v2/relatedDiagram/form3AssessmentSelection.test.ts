/**
 * Japanese Assessment selection normalization.
 * Run: npx tsx lib/v2/relatedDiagram/form3AssessmentSelection.test.ts
 */

import assert from "node:assert/strict";
import {
  highlightAssessmentText,
  normalizeAssessmentSelection,
} from "./form3AssessmentSelection";

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

const TEXT =
  "夜間の幻聴で入眠が妨げられ、翌日の活動に影響している。ラジオをつけても途中で目が覚めることがあり、朝は倦怠感が残る。";

test("selectedText === assessmentText.slice(start, end) for Japanese ranges", () => {
  const cases = ["夜間の幻聴", "入眠が妨げられ", "翌日の活動に影響している"];
  for (const selectedText of cases) {
    const start = TEXT.indexOf(selectedText);
    const normalized = normalizeAssessmentSelection({
      assessmentText: TEXT,
      selectedText,
      rawStart: start,
      rawEnd: start + selectedText.length,
    });
    assert.ok(normalized);
    assert.equal(
      TEXT.slice(normalized!.selectionStart, normalized!.selectionEnd),
      normalized!.selectedText,
    );
    assert.equal(normalized!.selectedText, selectedText);
  }
});

test("DOM-like raw offsets are rejected when they do not match 原文", () => {
  const selectedText = "夜間の幻聴";
  const normalized = normalizeAssessmentSelection({
    assessmentText: TEXT,
    selectedText,
    rawStart: 99,
    rawEnd: 101,
  });
  assert.ok(normalized);
  assert.equal(TEXT.slice(normalized!.selectionStart, normalized!.selectionEnd), selectedText);
  assert.equal(normalized!.selectionStart, TEXT.indexOf(selectedText));
});

test("highlight restore uses the same offsets", () => {
  const selectedText = "入眠が妨げられ";
  const start = TEXT.indexOf(selectedText);
  const highlight = highlightAssessmentText(
    TEXT,
    start,
    start + selectedText.length,
  );
  assert.equal(highlight?.selected, selectedText);
  assert.equal(highlight!.before + highlight!.selected + highlight!.after, TEXT);
});

console.log(`\n${passed} passed`);
