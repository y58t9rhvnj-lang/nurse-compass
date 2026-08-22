"use client";

/**
 * 精神様式3 学校指定シート描画（①〜⑥＋⑦追加用紙）。
 * 列構成は従来どおり 3 列: パターン | 情報（Ｓ・Ｏ） | 解釈・分析。
 * forPrint: A4 等倍（印刷 portal 用。画面縮小なし）。
 */

import type { ReactNode } from "react";
import {
  FORM3_PRINT_FONT_STACK,
  type Form3FieldChunk,
  type Form3PrintContinuationPage,
  type Form3PrintLayout,
  type Form3PrintMeta,
  type Form3PrintPrimaryPage,
} from "@/lib/form3/form3PrintLayout";

export type Form3SheetViewProps = {
  layout: Form3PrintLayout;
  meta?: Form3PrintMeta;
  forPrint?: boolean;
  showGlobalPageNumbers?: boolean;
};

/**
 * 「パターン」見出しのみ。
 * 短い th で vertical-rl が折り返すと ン｜ー｜タ｜パ に見えるため、
 * セル高を確保し nowrap で 1 列縦書きにする。
 * Safari で vertical-rl + upright が逆順になる場合があるため vertical-lr を使用。
 */
const FORM3_PATTERN_HEADING_CSS = `
.form3-pattern-heading {
  position: relative;
  padding: 0 !important;
  overflow: hidden;
  vertical-align: middle;
  text-align: center;
  height: 4.8em;
  min-height: 4.8em;
  box-sizing: border-box;
}
.form3-pattern-heading__wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-height: 4.8em;
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
.form3-pattern-heading__text {
  display: inline-block;
  writing-mode: vertical-lr;
  text-orientation: upright;
  -webkit-text-orientation: upright;
  white-space: nowrap;
  line-height: 1;
  letter-spacing: 0;
  margin: 0;
  padding: 0;
  transform: none;
  font-size: 9pt;
  font-weight: 600;
  color: #000;
}
.form3-info-line {
  display: block;
  margin: 0;
  padding: 0;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
}
`;

/** Assessment 本文（pre-wrap で改行を保持） */
function AnalysisCellText({ chunk }: { chunk: Form3FieldChunk }) {
  return (
    <div
      className="form3-analysis-text whitespace-pre-wrap break-words text-black"
      style={{
        fontSize: `${chunk.fontPt}pt`,
        lineHeight: chunk.lineHeight,
        overflowWrap: "anywhere",
      }}
    >
      {chunk.text}
    </div>
  );
}

/**
 * Information 本文: 1 カード＝1 ブロック。
 * `\n` 区切りを段落として描画し、読点連結や連続文に見えないようにする。
 */
function InformationCellText({ chunk }: { chunk: Form3FieldChunk }) {
  const lines = chunk.text.length === 0 ? [] : chunk.text.split("\n");
  return (
    <div
      className="form3-info-text break-words text-black"
      style={{
        fontSize: `${chunk.fontPt}pt`,
        lineHeight: chunk.lineHeight,
        overflowWrap: "anywhere",
      }}
    >
      {lines.map((line, i) => (
        <p
          key={`info-line-${i}`}
          className="form3-info-line m-0 whitespace-pre-wrap"
        >
          {line.length > 0 ? line : "\u00a0"}
        </p>
      ))}
    </div>
  );
}

/** 表セルは min-height が効きにくいため、内側スペーサで基準高を確保する */
function CellFill({
  heightClass,
  children,
}: {
  heightClass: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`form3-cell-fill box-border w-full ${heightClass}`}>
      {children}
    </div>
  );
}

/** 本文左端 Pattern 名（従来どおり。列構成は変えない） */
function VerticalPatternLabel({
  label,
  className = "",
}: {
  label: string;
  className?: string;
}) {
  return (
    <div
      className={[
        "form3-vtext flex h-full max-h-full w-full items-center justify-center overflow-hidden px-[1px] text-[10.5pt] font-medium leading-none tracking-[0.12em] text-black",
        className,
      ].join(" ")}
      style={{
        writingMode: "vertical-rl",
        textOrientation: "mixed",
        WebkitTextOrientation: "mixed",
      }}
    >
      {label}
    </div>
  );
}

function SheetChrome({
  formLabel,
  title,
  meta,
  forPrint,
  children,
  pageIndex,
  totalPages,
  showGlobalPageNumbers,
}: {
  formLabel: string;
  title: ReactNode;
  meta?: Form3PrintMeta;
  forPrint: boolean;
  children: React.ReactNode;
  pageIndex: number;
  totalPages: number;
  showGlobalPageNumbers: boolean;
}) {
  const pageClass = forPrint
    ? "form3-sheet form3-page relative box-border flex h-[297mm] min-h-[297mm] w-[210mm] flex-col bg-white px-[12mm] py-[10mm] text-black"
    : "form3-sheet form3-page relative flex min-h-[277mm] w-[190mm] flex-col bg-white px-[8mm] py-[8mm] text-black shadow-sm ring-1 ring-[#E5E5EA]";

  return (
    <section className={pageClass} data-form3-sheet="">
      <div className="text-right text-[9pt] text-black">{formLabel}</div>
      <div className="mt-1 text-center text-[14pt] font-bold tracking-[0.12em] text-black">
        {title}
      </div>
      <div className="mb-2 mt-3 flex justify-end gap-10 pr-2 text-[10pt] text-black">
        <span>
          学籍番号　{meta?.studentNumber?.trim() || "　　　　　　"}
        </span>
        <span>氏名　{meta?.studentName?.trim() || "　　　　　　"}</span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-start">{children}</div>

      <div className="mt-2 flex items-end justify-between text-[8.5pt] text-black">
        {showGlobalPageNumbers ? (
          <span className="tabular-nums">
            {pageIndex} / {totalPages}
          </span>
        ) : (
          <span />
        )}
        <span>熊本市医師会看護専門学校　第１看護学科</span>
      </div>
    </section>
  );
}

function AssessmentTableHeader() {
  return (
    <>
      <tr>
        <td
          colSpan={3}
          className="border border-black py-1 text-center text-[11pt] font-semibold"
        >
          アセスメント
        </td>
      </tr>
      <tr>
        <th className="form3-pattern-heading border border-black">
          <div className="form3-pattern-heading__wrap">
            <span className="form3-pattern-heading__text">パターン</span>
          </div>
        </th>
        <th className="border border-black px-2 py-1 text-center text-[10pt] font-semibold">
          情報（Ｓ・Ｏ）
        </th>
        <th className="border border-black px-2 py-1 text-center text-[10pt] font-semibold">
          解釈・分析・
          <span className="underline">援助の必要性</span>
        </th>
      </tr>
    </>
  );
}

function PrimaryPage({
  page,
  meta,
  forPrint,
  pageIndex,
  totalPages,
  showGlobalPageNumbers,
}: {
  page: Form3PrintPrimaryPage;
  meta?: Form3PrintMeta;
  forPrint: boolean;
  pageIndex: number;
  totalPages: number;
  showGlobalPageNumbers: boolean;
}) {
  // 学校指定の基準行高（文章量で縮めない）。計測側 ROW_H_* と同寸法。
  // 固定 height + overflow:hidden で縦書き Pattern 列の伸びと flex 伸びを防ぐ。
  // 収まらない本文は layout 側で⑦へ送る。
  const rowFillH =
    page.rows.length <= 1
      ? forPrint
        ? "h-[205mm] min-h-[205mm] max-h-[205mm] overflow-hidden"
        : "min-h-[190mm]"
      : forPrint
        ? "h-[100mm] min-h-[100mm] max-h-[100mm] overflow-hidden"
        : "min-h-[92mm]";

  return (
    <SheetChrome
      formLabel={page.formLabel}
      title="受け持ち対象記録"
      meta={meta}
      forPrint={forPrint}
      pageIndex={pageIndex}
      totalPages={totalPages}
      showGlobalPageNumbers={showGlobalPageNumbers}
    >
      <table className="w-full shrink-0 table-fixed border-collapse border border-black">
        <colgroup>
          <col style={{ width: "5%" }} />
          <col style={{ width: "36%" }} />
          <col style={{ width: "59%" }} />
        </colgroup>
        <thead>
          <AssessmentTableHeader />
        </thead>
        <tbody>
          {page.rows.map((row) => (
            <tr key={row.patternKey}>
              <td className="border border-black p-0 align-middle">
                <CellFill heightClass={rowFillH}>
                  <VerticalPatternLabel label={row.patternLabelJa} />
                </CellFill>
              </td>
              <td className="border border-black p-1.5 align-top">
                <CellFill heightClass={rowFillH}>
                  <InformationCellText chunk={row.information} />
                </CellFill>
              </td>
              <td className="border border-black p-1.5 align-top">
                <CellFill heightClass={rowFillH}>
                  <AnalysisCellText chunk={row.analysis} />
                </CellFill>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </SheetChrome>
  );
}

function ContinuationPage({
  page,
  meta,
  forPrint,
  pageIndex,
  totalPages,
  showGlobalPageNumbers,
}: {
  page: Form3PrintContinuationPage;
  meta?: Form3PrintMeta;
  forPrint: boolean;
  pageIndex: number;
  totalPages: number;
  showGlobalPageNumbers: boolean;
}) {
  // ⑦ 本文可用高（計測側 CONT_BODY_H と同寸法）。短文でも縮めない。
  const bodyFillH = forPrint
    ? "h-[215mm] min-h-[215mm] max-h-[215mm] overflow-hidden"
    : "min-h-[200mm]";
  return (
    <SheetChrome
      formLabel={page.formLabel}
      title={
        <>受け持ち対象記録追加―（{page.continuationIndex}）</>
      }
      meta={meta}
      forPrint={forPrint}
      pageIndex={pageIndex}
      totalPages={totalPages}
      showGlobalPageNumbers={showGlobalPageNumbers}
    >
      <table className="w-full shrink-0 table-fixed border-collapse border border-black">
        <colgroup>
          <col style={{ width: "5%" }} />
          <col style={{ width: "36%" }} />
          <col style={{ width: "59%" }} />
        </colgroup>
        <thead>
          <AssessmentTableHeader />
        </thead>
        <tbody>
          <tr>
            <td className="border border-black p-0 align-middle">
              <CellFill heightClass={bodyFillH}>
                <VerticalPatternLabel label={page.patternLabelJa} />
              </CellFill>
            </td>
            <td className="border border-black p-1.5 align-top">
              <CellFill heightClass={bodyFillH}>
                <InformationCellText chunk={page.information} />
              </CellFill>
            </td>
            <td className="border border-black p-1.5 align-top">
              <CellFill heightClass={bodyFillH}>
                <AnalysisCellText chunk={page.analysis} />
              </CellFill>
            </td>
          </tr>
        </tbody>
      </table>
    </SheetChrome>
  );
}

export default function Form3SheetView({
  layout,
  meta,
  forPrint = false,
  showGlobalPageNumbers = true,
}: Form3SheetViewProps) {
  return (
    <div
      className={
        forPrint
          ? "form3-preview form3-preview--print-portal w-[210mm]"
          : "form3-preview flex w-full flex-col items-center gap-8"
      }
      style={{ fontFamily: FORM3_PRINT_FONT_STACK }}
      data-form3-sheet-mode={forPrint ? "print" : "screen"}
    >
      <style data-form3-pattern-heading-css="">{FORM3_PATTERN_HEADING_CSS}</style>
      {forPrint ? null : (
        <div className="no-print text-center text-xs text-slate-500">
          全 {layout.totalPages} ページ
        </div>
      )}
      <div
        className={
          forPrint
            ? "form3-pages form3-print-root"
            : "flex flex-col items-center gap-8"
        }
      >
        {layout.pages.map((page, i) =>
          page.kind === "primary" ? (
            <PrimaryPage
              key={`p-${page.formMark}-${i}`}
              page={page}
              meta={meta}
              forPrint={forPrint}
              pageIndex={i + 1}
              totalPages={layout.totalPages}
              showGlobalPageNumbers={showGlobalPageNumbers}
            />
          ) : (
            <ContinuationPage
              key={`c-${page.patternKey}-${page.continuationIndex}`}
              page={page}
              meta={meta}
              forPrint={forPrint}
              pageIndex={i + 1}
              totalPages={layout.totalPages}
              showGlobalPageNumbers={showGlobalPageNumbers}
            />
          ),
        )}
      </div>
    </div>
  );
}
