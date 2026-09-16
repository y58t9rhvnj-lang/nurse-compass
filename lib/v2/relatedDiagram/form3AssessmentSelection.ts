/**
 * Normalize a student text selection onto Form3 Assessment 原文.
 * DOM offsets are never stored as-is.
 * Invariant: selectedText === assessmentText.slice(start, end)
 */

export type NormalizedAssessmentSelection = {
  selectedText: string;
  selectionStart: number;
  selectionEnd: number;
};

function tryOffsets(
  assessmentText: string,
  selectedText: string,
  start: number,
  end: number,
): NormalizedAssessmentSelection | null {
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end > assessmentText.length ||
    start >= end
  ) {
    return null;
  }
  if (assessmentText.slice(start, end) !== selectedText) return null;
  return { selectedText, selectionStart: start, selectionEnd: end };
}

export function normalizeAssessmentSelection(input: {
  assessmentText: string;
  selectedText: string;
  rawStart?: number | null;
  rawEnd?: number | null;
}): NormalizedAssessmentSelection | null {
  const assessmentText = input.assessmentText;
  const selectedText = input.selectedText;
  if (!selectedText) return null;

  if (input.rawStart != null && input.rawEnd != null) {
    const exact = tryOffsets(
      assessmentText,
      selectedText,
      input.rawStart,
      input.rawEnd,
    );
    if (exact) return exact;
  }

  const hits: number[] = [];
  let from = 0;
  while (from <= assessmentText.length) {
    const index = assessmentText.indexOf(selectedText, from);
    if (index < 0) break;
    hits.push(index);
    from = index + 1;
  }
  if (hits.length === 0) return null;

  let start = hits[0]!;
  if (input.rawStart != null) {
    let best = hits[0]!;
    let bestDist = Math.abs(best - input.rawStart);
    for (const hit of hits) {
      const dist = Math.abs(hit - input.rawStart);
      if (dist < bestDist) {
        best = hit;
        bestDist = dist;
      }
    }
    start = best;
  }
  return {
    selectedText,
    selectionStart: start,
    selectionEnd: start + selectedText.length,
  };
}

/** Collect text-node offsets of a Range that lives inside `container`. */
export function rawOffsetsFromRange(
  container: HTMLElement,
  range: Range,
): { rawStart: number; rawEnd: number; selectedText: string } | null {
  if (!container.contains(range.commonAncestorContainer)) return null;
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let offset = 0;
  let rawStart: number | null = null;
  let rawEnd: number | null = null;
  let node = walker.nextNode();
  while (node) {
    const text = node.textContent ?? "";
    if (node === range.startContainer) {
      rawStart = offset + range.startOffset;
    }
    if (node === range.endContainer) {
      rawEnd = offset + range.endOffset;
    }
    offset += text.length;
    node = walker.nextNode();
  }
  if (rawStart == null || rawEnd == null || rawStart >= rawEnd) return null;
  return {
    rawStart,
    rawEnd,
    selectedText: range.toString(),
  };
}

export function selectionFromWindow(
  container: HTMLElement,
  assessmentText: string,
): NormalizedAssessmentSelection | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  const raw = rawOffsetsFromRange(container, range);
  return normalizeAssessmentSelection({
    assessmentText,
    selectedText: raw?.selectedText ?? sel.toString(),
    rawStart: raw?.rawStart,
    rawEnd: raw?.rawEnd,
  });
}

export function highlightAssessmentText(
  assessmentText: string,
  start: number | null | undefined,
  end: number | null | undefined,
): { before: string; selected: string; after: string } | null {
  if (
    start == null ||
    end == null ||
    start < 0 ||
    end > assessmentText.length ||
    start >= end
  ) {
    return null;
  }
  return {
    before: assessmentText.slice(0, start),
    selected: assessmentText.slice(start, end),
    after: assessmentText.slice(end),
  };
}
