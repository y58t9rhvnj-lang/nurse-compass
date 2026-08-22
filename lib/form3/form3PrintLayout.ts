/**
 * 精神様式3（学校指定）印刷レイアウト。
 *
 * - ①〜⑥: 固定パターン配置（学校原稿どおり）
 * - ⑦: 追加用紙。タイトル括弧はパターン名ではなく追加ページ番号
 * - フォント: 10.5pt → 10pt → 9pt（未満へは縮小しない）
 * - 9ptでも収まらない続きは⑦へ送る（切り捨て禁止）
 *
 * 計測はクライアント専用（Form2 layout と同方式）。
 */

import { getForm3PatternDefinition } from "@/lib/form3/form3PatternDefinitions";
import {
  FORM3_PATTERN_ORDER,
  type Form3PatternKey,
} from "@/lib/form3/form3Types";
import { composeForm3PatternPrintTexts } from "@/lib/form3/v2/form3V2PrintCompose";
import type { Form3DataV2 } from "@/lib/form3/v2/form3V2Types";
import { createEmptyForm3V2 } from "@/lib/form3/v2/form3V2Factory";

export const FORM3_PRINT_FONT_STACK =
  '"Hiragino Mincho ProN","Hiragino Mincho Pro","Yu Mincho","MS Mincho",serif';

const MM = 96 / 25.4;

/** 表内容幅（A4 左右余白後のおおよそ） */
const TABLE_W = 186 * MM;
const PATTERN_COL_W = 9 * MM;
const INFO_COL_RATIO = 0.38;
const INFO_COL_W =
  (TABLE_W - PATTERN_COL_W) * INFO_COL_RATIO - 10;
const ANALYSIS_COL_W =
  (TABLE_W - PATTERN_COL_W) * (1 - INFO_COL_RATIO) - 10;

/** 1パターン行の本文可用高（見出し行を除く） */
const ROW_H_SINGLE = 205 * MM;
const ROW_H_HALF = 100 * MM;
/** ⑦ 本文可用高 */
const CONT_BODY_H = 215 * MM;

export type Form3FitStyle = {
  fontPt: number;
  lineHeight: number;
};

const STEPS: Form3FitStyle[] = [
  { fontPt: 10.5, lineHeight: 1.4 },
  { fontPt: 10, lineHeight: 1.3 },
  { fontPt: 9, lineHeight: 1.15 },
];
const MIN_STEP = STEPS[STEPS.length - 1]!;

export type Form3FieldChunk = Form3FitStyle & { text: string };

export type Form3PrintSheetDef = {
  /** 精神様式３－① … ⑥ */
  formMark: "①" | "②" | "③" | "④" | "⑤" | "⑥";
  patterns: readonly Form3PatternKey[];
};

/** 学校指定の固定ページ配置（⑦は追加用紙のため含めない） */
export const FORM3_PRINT_SHEET_DEFS: readonly Form3PrintSheetDef[] = [
  { formMark: "①", patterns: ["health_perception_management"] },
  {
    formMark: "②",
    patterns: ["nutritional_metabolic", "elimination"],
  },
  {
    formMark: "③",
    patterns: ["activity_exercise", "sleep_rest"],
  },
  {
    formMark: "④",
    patterns: ["cognitive_perceptual", "self_perception_self_concept"],
  },
  {
    formMark: "⑤",
    patterns: ["role_relationship", "sexuality_reproductive"],
  },
  {
    formMark: "⑥",
    patterns: ["coping_stress_tolerance", "value_belief"],
  },
] as const;

export type Form3PrintPrimaryRow = {
  patternKey: Form3PatternKey;
  patternLabelJa: string;
  information: Form3FieldChunk;
  analysis: Form3FieldChunk;
};

export type Form3PrintPrimaryPage = {
  kind: "primary";
  formMark: Form3PrintSheetDef["formMark"];
  formLabel: string;
  rows: Form3PrintPrimaryRow[];
};

export type Form3PrintContinuationPage = {
  kind: "continuation";
  formLabel: "精神様式３－⑦";
  /** 同一パターン内の追加ページ番号（1始まり） */
  continuationIndex: number;
  patternKey: Form3PatternKey;
  patternLabelJa: string;
  information: Form3FieldChunk;
  analysis: Form3FieldChunk;
};

export type Form3PrintPage =
  | Form3PrintPrimaryPage
  | Form3PrintContinuationPage;

export type Form3PrintLayout = {
  pages: Form3PrintPage[];
  /** 全体ページ数（①〜⑥＋⑦） */
  totalPages: number;
};

export type Form3PrintMeta = {
  studentNumber?: string;
  studentName?: string;
};

// ── 計測 ──
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
      fontFamily: FORM3_PRINT_FONT_STACK,
    } as CSSStyleDeclaration);
    document.body.appendChild(measurer);
  }
  return measurer;
}

function measureHeight(
  text: string,
  widthPx: number,
  style: Form3FitStyle,
): number {
  const m = getMeasurer();
  if (!m) return 0;
  m.style.width = `${widthPx}px`;
  m.style.fontSize = `${style.fontPt}pt`;
  m.style.lineHeight = `${style.lineHeight}`;
  m.textContent = text.length ? text : " ";
  return m.scrollHeight;
}

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

function findSplit(
  text: string,
  widthPx: number,
  heightPx: number,
  style: Form3FitStyle,
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

function fitField(
  text: string,
  widthPx: number,
  heightPx: number,
): { chunk: Form3FieldChunk; remainder: string } {
  if (text.trim().length === 0) {
    return { chunk: { ...STEPS[0]!, text }, remainder: "" };
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

function patternLabel(key: Form3PatternKey): string {
  return getForm3PatternDefinition(key).labelJa;
}

function rowHeightForSheet(patternCount: number): number {
  return patternCount <= 1 ? ROW_H_SINGLE : ROW_H_HALF;
}

/**
 * Information / Assessment カードから学校指定印刷ページ列を生成。
 * Final 2欄（informationSO 等）は正本にしない。
 * SSR / 計測不可時は null（呼び出し側でフォールバック）。
 */
export function buildForm3PrintLayout(
  data: Form3DataV2,
): Form3PrintLayout | null {
  if (typeof document === "undefined") return null;
  if (!getMeasurer()) return null;

  const pages: Form3PrintPage[] = [];
  /** パターンごとの未出力残り */
  const remainders = new Map<
    Form3PatternKey,
    { so: string; analysis: string }
  >();

  for (const def of FORM3_PRINT_SHEET_DEFS) {
    const h = rowHeightForSheet(def.patterns.length);
    const rows: Form3PrintPrimaryRow[] = [];
    for (const key of def.patterns) {
      const texts = composeForm3PatternPrintTexts(data, key);
      const soFit = fitField(texts.informationSO, INFO_COL_W, h);
      const anFit = fitField(
        texts.interpretationAnalysisCareNeed,
        ANALYSIS_COL_W,
        h,
      );
      rows.push({
        patternKey: key,
        patternLabelJa: patternLabel(key),
        information: soFit.chunk,
        analysis: anFit.chunk,
      });
      if (soFit.remainder || anFit.remainder) {
        remainders.set(key, {
          so: soFit.remainder,
          analysis: anFit.remainder,
        });
      }
    }
    pages.push({
      kind: "primary",
      formMark: def.formMark,
      formLabel: `精神様式３－${def.formMark}`,
      rows,
    });
  }

  // ⑦: パターン順に、同一パターン内で追加番号を 1 から連番
  for (const key of FORM3_PATTERN_ORDER) {
    let rem = remainders.get(key);
    if (!rem) continue;
    let continuationIndex = 0;
    while (rem.so.length > 0 || rem.analysis.length > 0) {
      continuationIndex += 1;
      const soFit = fitField(rem.so, INFO_COL_W, CONT_BODY_H);
      const anFit = fitField(rem.analysis, ANALYSIS_COL_W, CONT_BODY_H);
      // 進捗保証（空のまま無限ループしない）
      if (
        soFit.remainder === rem.so &&
        anFit.remainder === rem.analysis &&
        (rem.so.length > 0 || rem.analysis.length > 0)
      ) {
        // 1文字も進まない場合は強制1文字送り
        if (rem.so.length > 0) {
          const cut = Math.max(1, findSplit(rem.so, INFO_COL_W, CONT_BODY_H, MIN_STEP));
          soFit.chunk = { ...MIN_STEP, text: rem.so.slice(0, cut) };
          soFit.remainder = rem.so.slice(cut);
        }
        if (rem.analysis.length > 0 && anFit.remainder === rem.analysis) {
          const cut = Math.max(
            1,
            findSplit(rem.analysis, ANALYSIS_COL_W, CONT_BODY_H, MIN_STEP),
          );
          anFit.chunk = { ...MIN_STEP, text: rem.analysis.slice(0, cut) };
          anFit.remainder = rem.analysis.slice(cut);
        }
      }
      pages.push({
        kind: "continuation",
        formLabel: "精神様式３－⑦",
        continuationIndex,
        patternKey: key,
        patternLabelJa: patternLabel(key),
        information: soFit.chunk,
        analysis: anFit.chunk,
      });
      rem = { so: soFit.remainder, analysis: anFit.remainder };
      if (continuationIndex > 200) break; // safety
    }
  }

  return { pages, totalPages: pages.length };
}

/** 印刷プレビュー用の簡易フォールバック（計測なし） */
export function buildForm3PrintLayoutFallback(
  data: Form3DataV2,
): Form3PrintLayout {
  const pages: Form3PrintPage[] = FORM3_PRINT_SHEET_DEFS.map((def) => ({
    kind: "primary" as const,
    formMark: def.formMark,
    formLabel: `精神様式３－${def.formMark}`,
    rows: def.patterns.map((key) => {
      const texts = composeForm3PatternPrintTexts(data, key);
      return {
        patternKey: key,
        patternLabelJa: patternLabel(key),
        information: {
          ...STEPS[0]!,
          text: texts.informationSO,
        },
        analysis: {
          ...STEPS[0]!,
          text: texts.interpretationAnalysisCareNeed,
        },
      };
    }),
  }));
  return { pages, totalPages: pages.length };
}

/** @deprecated Final 2欄正本は廃止。カード合成を使う。 */
export function buildForm3PrintLayoutFromFinalForm(
  dataOrEmptyPatientId: Form3DataV2 | string,
): Form3PrintLayout | null {
  const data =
    typeof dataOrEmptyPatientId === "string"
      ? createEmptyForm3V2(dataOrEmptyPatientId)
      : dataOrEmptyPatientId;
  return buildForm3PrintLayout(data);
}
