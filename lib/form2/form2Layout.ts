// 精神様式2「様式表示・印刷」のページ割り付けエンジン。
//
// 方針:
// - 記入欄の文章が所定領域を超える場合、まず文字サイズと行間を段階的に縮小して
//   1ページ目内に収める（最小 9pt、行間は詰めすぎない）。
// - 9pt・最小行間でも収まらない場合のみ、超過分だけを続紙（2ページ目以降）へ送る。
// - 文章の切り捨て・非表示・要約・省略記号は行わない（全文を必ず表示する）。
// - 分割位置は文字数固定ではなく、実DOM計測（二分探索）で決め、
//   改行→句点→読点→空白→文字単位の優先順で自然な位置に寄せる。
//
// 計測は body に付与した不可視要素で行うため、クライアント専用。
// SSR では null を返し、呼び出し側でフォールバック描画する。

import {
  FORM2_HISTORY_KEYS,
  mergeTreatmentText,
  type Form2Data,
} from "@/lib/form2/form2Types";

// 原本と同じ帳票（A4縦）を基準にした固定寸法。1mm = 96/25.4 px（96dpi）。
const MM = 96 / 25.4;

// 計測・描画で同一のフォントを用い、Webフォント遅延による計測ずれを避ける。
export const FORM2_FONT_STACK =
  '"Hiragino Kaku Gothic ProN","Hiragino Sans","Yu Gothic","Meiryo",sans-serif';

// シート内容幅（190mm - 左右パディング6mm×2 = 178mm）＝表全幅。
const TABLE_W = 178 * MM;

// セル内テキスト幅（列幅からセル padding と罫線分を控えめに差し引く）。
const PADDING_ADJUST = 12;
const COL2_W = 0.52 * TABLE_W - PADDING_ADJUST; // 診断名・入院形態・主訴（左colspan2）
const COL3_W = 0.48 * TABLE_W - PADDING_ADJUST; // 既往歴（右colspan3）
const COL5_W = TABLE_W - PADDING_ADJUST; // 経過・治療方針（全幅colspan5）

// 見出し＋余白の控除量（px）。控えめ（大きめ）に見積もり、はみ出しを防ぐ。
const LABEL_RESERVE = 22;

// 各記入欄の固定高さ（原本比率）→ テキスト可用高（px）。
const H_SMALL = 15 * MM - LABEL_RESERVE;
const H_PAST = 47 * MM - LABEL_RESERVE;
const H_HISTORY = 112 * MM - LABEL_RESERVE;
const H_TREAT = 54 * MM - LABEL_RESERVE;

// 続紙1ページで本文セクションに使える高さ（識別ヘッダー・学校名を除いた領域）。
const CONT_BOX_W = COL5_W;
const CONT_PAGE_H = 851; // ≒ 277mm(印刷可) - パディング - ヘッダー - フッター
const CONT_TITLE_H = 24; // セクション見出しの控除
const CONT_GAP = 18; // セクション間の余白
const CONT_MIN = 60; // 新規セクションを始めるのに必要な最低本文高

// 文字サイズと行間の段階（大→小）。最小は 9pt / 行間 1.15。
export interface FitStyle {
  fontPt: number;
  lineHeight: number;
}
const STEPS: FitStyle[] = [
  { fontPt: 11, lineHeight: 1.5 },
  { fontPt: 10.5, lineHeight: 1.4 },
  { fontPt: 10, lineHeight: 1.3 },
  { fontPt: 9.5, lineHeight: 1.2 },
  { fontPt: 9, lineHeight: 1.15 },
];
const MIN_STEP = STEPS[STEPS.length - 1];

export interface FieldChunk extends FitStyle {
  text: string;
}
export interface ContinuationSection extends FieldChunk {
  title: string;
}
export interface ContinuationPage {
  sections: ContinuationSection[];
}
export type Form2FieldId =
  | "diagnosis"
  | "pastHistory"
  | "admissionType"
  | "chiefComplaint"
  | "history"
  | "treatment";
export interface Form2Layout {
  page1: Record<Form2FieldId, FieldChunk>;
  continuations: ContinuationPage[];
}

// ── 計測（不可視要素） ──
let measurer: HTMLDivElement | null = null;
function getMeasurer(): HTMLDivElement | null {
  if (typeof document === "undefined") return null;
  if (!measurer) {
    measurer = document.createElement("div");
    Object.assign(measurer.style, {
      position: "absolute",
      left: "-99999px",
      top: "0",
      visibility: "hidden",
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
      overflowWrap: "anywhere",
      padding: "0",
      margin: "0",
      border: "0",
      boxSizing: "border-box",
      fontFamily: FORM2_FONT_STACK,
    } as CSSStyleDeclaration);
    document.body.appendChild(measurer);
  }
  return measurer;
}

function measureHeight(
  text: string,
  widthPx: number,
  style: FitStyle,
): number {
  const m = getMeasurer();
  if (!m) return 0;
  m.style.width = `${widthPx}px`;
  m.style.fontSize = `${style.fontPt}pt`;
  m.style.lineHeight = `${style.lineHeight}`;
  // 末尾改行も高さに反映されるよう、空文字は半角スペースで代替。
  m.textContent = text.length ? text : " ";
  return m.scrollHeight;
}

// ── 分割位置（サロゲート・結合文字を壊さない） ──
function isCombining(code: number): boolean {
  return (
    (code >= 0x0300 && code <= 0x036f) ||
    code === 0x3099 ||
    code === 0x309a ||
    (code >= 0xfe20 && code <= 0xfe2f)
  );
}

function surrogateSafe(text: string, idx: number): number {
  if (idx <= 0 || idx >= text.length) return idx;
  const prev = text.charCodeAt(idx - 1);
  const cur = text.charCodeAt(idx);
  if (prev >= 0xd800 && prev <= 0xdbff && cur >= 0xdc00 && cur <= 0xdfff) {
    return idx - 1;
  }
  if (isCombining(cur)) return surrogateSafe(text, idx - 1);
  return idx;
}

// 分割候補を、改行→句点→読点→空白の優先で自然な位置へ寄せる（後退のみ）。
function adjustToBoundary(text: string, idx: number): number {
  const WINDOW = 60;
  const start = Math.max(1, idx - WINDOW);
  const seg = text.slice(0, idx);

  const nl = seg.lastIndexOf("\n");
  if (nl >= start) return nl + 1;
  for (const ch of ["。", "、"]) {
    const p = seg.lastIndexOf(ch);
    if (p >= start) return p + 1;
  }
  const sp = Math.max(seg.lastIndexOf(" "), seg.lastIndexOf("\u3000"));
  if (sp >= start) return sp + 1;
  return idx;
}

// height に収まる最大の分割位置（文字index）を二分探索で求める。必ず1以上を返す。
function findSplit(
  text: string,
  widthPx: number,
  heightPx: number,
  style: FitStyle,
): number {
  let lo = 1;
  let hi = text.length;
  let best = 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (measureHeight(text.slice(0, mid), widthPx, style) <= heightPx) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  best = adjustToBoundary(text, best);
  best = surrogateSafe(text, best);
  return Math.max(1, best);
}

// 1欄分のフィット結果（1ページ目チャンク＋続紙送りの残り）。
function fitField(
  text: string,
  widthPx: number,
  heightPx: number,
): { chunk: FieldChunk; remainder: string } {
  if (text.trim().length === 0) {
    return { chunk: { ...STEPS[0], text }, remainder: "" };
  }
  for (const step of STEPS) {
    if (measureHeight(text, widthPx, step) <= heightPx) {
      return { chunk: { ...step, text }, remainder: "" };
    }
  }
  const cut = findSplit(text, widthPx, heightPx, MIN_STEP);
  return {
    chunk: { ...MIN_STEP, text: text.slice(0, cut) },
    remainder: text.slice(cut),
  };
}

// 続紙の詰め込み。複数の超過欄を、収まる限り同一ページに独立セクションとして配置。
function packContinuations(
  blocks: { title: string; remainder: string }[],
): ContinuationPage[] {
  const pages: ContinuationPage[] = [];
  let sections: ContinuationSection[] = [];
  let remaining = CONT_PAGE_H;

  const flushPage = () => {
    if (sections.length > 0) pages.push({ sections });
    sections = [];
    remaining = CONT_PAGE_H;
  };

  for (const block of blocks) {
    let text = block.remainder;
    while (text.length > 0) {
      const avail = remaining - CONT_TITLE_H - CONT_GAP;
      if (avail < CONT_MIN) {
        flushPage();
        continue;
      }
      // まず残り全文が入るか（大きい文字から）試す。
      let placed: FieldChunk | null = null;
      for (const step of STEPS) {
        if (measureHeight(text, CONT_BOX_W, step) <= avail) {
          placed = { ...step, text };
          break;
        }
      }
      if (placed) {
        const used = measureHeight(placed.text, CONT_BOX_W, placed);
        sections.push({ title: `${block.title} 続き`, ...placed });
        remaining -= CONT_TITLE_H + CONT_GAP + used;
        text = "";
      } else {
        const cut = findSplit(text, CONT_BOX_W, avail, MIN_STEP);
        sections.push({
          title: `${block.title} 続き`,
          ...MIN_STEP,
          text: text.slice(0, cut),
        });
        text = text.slice(cut);
        flushPage();
      }
    }
  }
  flushPage();
  return pages;
}

export function computeForm2Layout(data: Form2Data): Form2Layout | null {
  if (typeof document === "undefined") return null;

  const historyMerged = FORM2_HISTORY_KEYS.map((key) =>
    (data.history[key] ?? "").trim(),
  )
    .filter((t) => t.length > 0)
    .join("\n\n");

  const specs: {
    id: Form2FieldId;
    title: string;
    text: string;
    w: number;
    h: number;
  }[] = [
    {
      id: "diagnosis",
      title: "診断名",
      text: data.basicInformation.diagnosis,
      w: COL2_W,
      h: H_SMALL,
    },
    {
      id: "pastHistory",
      title: "既往歴",
      text: data.basicInformation.pastHistory,
      w: COL3_W,
      h: H_PAST,
    },
    {
      id: "admissionType",
      title: "入院形態",
      text: data.basicInformation.admissionType,
      w: COL2_W,
      h: H_SMALL,
    },
    {
      id: "chiefComplaint",
      title: "主訴",
      text: data.basicInformation.chiefComplaint,
      w: COL2_W,
      h: H_SMALL,
    },
    {
      id: "history",
      title: "受け持つまでの経過（生育歴・現病歴）",
      text: historyMerged,
      w: COL5_W,
      h: H_HISTORY,
    },
    {
      id: "treatment",
      title: "医師の治療方針・治療内容",
      text: mergeTreatmentText(data.treatment),
      w: COL5_W,
      h: H_TREAT,
    },
  ];

  const page1 = {} as Record<Form2FieldId, FieldChunk>;
  const blocks: { title: string; remainder: string }[] = [];
  for (const spec of specs) {
    const { chunk, remainder } = fitField(spec.text, spec.w, spec.h);
    page1[spec.id] = chunk;
    if (remainder.length > 0) {
      blocks.push({ title: spec.title, remainder });
    }
  }

  return { page1, continuations: packContinuations(blocks) };
}
