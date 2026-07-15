"use client";

import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { FORM2_HISTORY_KEYS, type Form2Data } from "@/lib/form2/form2Types";
import {
  computeForm2Layout,
  FORM2_FONT_STACK,
  type FieldChunk,
  type Form2FieldId,
} from "@/lib/form2/form2Layout";

// 原本（受け持ち対象記録・精神様式2 / 熊本市医師会看護専門学校）の書式を維持する。
const FORM_NO = "精神様式２";
const FORM_NO_CONT = "精神様式２（続紙）";
const SHEET_TITLE = "受け持ち対象記録";
const SCHOOL_LINE = "熊本市医師会看護専門学校　第１看護学科";

// SSR=false / クライアント=true を setState なしで得る（ハイドレーション不整合回避）。
const noopSubscribe = () => () => {};

function CellLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[8.5pt] font-medium leading-tight text-black">
      {children}
    </div>
  );
}

// 記入欄の本文。文字サイズ・行間はフィット結果に従う。切り捨て・スクロールはしない。
function CellText({
  chunk,
  className = "",
}: {
  chunk: FieldChunk;
  className?: string;
}) {
  return (
    <div
      className={`mt-1 min-h-0 flex-1 whitespace-pre-wrap break-words text-black ${className}`}
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

export default function Form2SheetView({ data }: { data: Form2Data }) {
  const b = data.basicInformation;
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);

  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

  const historyMerged = useMemo(
    () =>
      FORM2_HISTORY_KEYS.map((key) => data.history[key].trim())
        .filter((t) => t.length > 0)
        .join("\n\n"),
    [data.history],
  );

  // クライアントで実DOM計測してページ割り付けを決める。SSR/初回描画は null。
  const layout = useMemo(
    () => (hydrated ? computeForm2Layout(data) : null),
    [hydrated, data],
  );

  const fallback = (text: string): FieldChunk => ({
    fontPt: 11,
    lineHeight: 1.4,
    text,
  });
  const page1: Record<Form2FieldId, FieldChunk> = layout?.page1 ?? {
    diagnosis: fallback(b.diagnosis),
    pastHistory: fallback(b.pastHistory),
    admissionType: fallback(b.admissionType),
    chiefComplaint: fallback(b.chiefComplaint),
    history: fallback(historyMerged),
    treatment: fallback(data.treatment.policyAndContent),
  };
  const continuations = layout?.continuations ?? [];
  const totalPages = 1 + continuations.length;

  // A4を原寸(mm)で描画し、画面では横幅に合わせて縮小プレビューする
  // （縦横比固定・構造は変形しない）。印刷では CSS 側で等倍に戻す。
  useEffect(() => {
    const container = containerRef.current;
    const wrap = wrapRef.current;
    const pages = pagesRef.current;
    if (!container || !wrap || !pages) return;

    const apply = () => {
      const naturalW = pages.offsetWidth;
      const naturalH = pages.offsetHeight;
      if (naturalW === 0) return;
      const scale = Math.min(1, container.clientWidth / naturalW);
      pages.style.transformOrigin = "top left";
      pages.style.transform = `scale(${scale})`;
      wrap.style.width = `${naturalW * scale}px`;
      wrap.style.height = `${naturalH * scale}px`;
    };

    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(container);
    ro.observe(pages);
    return () => ro.disconnect();
  }, []);

  const period = `${data.period.start || "　月　日"}　～　${
    data.period.end || "　月　日"
  }`;
  const cell = "border border-black p-1 align-top";

  return (
    <div ref={containerRef} className="form2-preview w-full">
      {/* ページ数表示（印刷しない） */}
      <div className="no-print mb-2 text-center text-xs text-slate-500">
        全 {totalPages} ページ
      </div>

      <div ref={wrapRef} className="form2-scale-wrap mx-auto">
        <div className="form2-print-root">
          <div
            ref={pagesRef}
            className="form2-pages"
            style={{ fontFamily: FORM2_FONT_STACK }}
          >
            {/* ── 1ページ目：原本レイアウト ── */}
            <section className="form2-sheet form2-page relative flex min-h-[277mm] w-[190mm] flex-col bg-white px-[6mm] py-[6mm] text-black">
              <span className="no-print absolute right-1 top-1 text-[10px] text-slate-400">
                1 / {totalPages}
              </span>

              <div className="text-right text-[8.5pt] font-medium text-black">
                {FORM_NO}
              </div>
              <div className="mt-1 text-center text-[14pt] font-bold tracking-[0.25em] text-black">
                {SHEET_TITLE}
              </div>

              {/* 表上：学籍番号 / 氏名（学生） */}
              <div className="mb-1 mt-2 flex gap-12 pl-[46%] text-[9pt] text-black">
                <span>学籍番号　{data.student.studentNumber}</span>
                <span>氏名　{data.student.studentName}</span>
              </div>

              <table className="w-full table-fixed border-collapse text-black">
                <colgroup>
                  <col style={{ width: "42%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "15%" }} />
                  <col style={{ width: "19%" }} />
                  <col style={{ width: "14%" }} />
                </colgroup>
                <tbody>
                  {/* 最上段：受け持ち期間｜氏名｜年齢｜性別 */}
                  <tr>
                    <td className={cell}>
                      <CellLabel>受け持ち期間</CellLabel>
                      <div className="mt-1 text-center text-[9pt] text-black">
                        {period}
                      </div>
                    </td>
                    <td colSpan={2} className={cell}>
                      <CellLabel>氏名</CellLabel>
                      <div className="mt-1 flex min-h-[6mm] items-end justify-end text-[9pt] text-black">
                        <span>{b.patientName}</span>
                        <span className="ml-2">氏</span>
                      </div>
                    </td>
                    <td className={cell}>
                      <CellLabel>年齢</CellLabel>
                      <div className="mt-1 text-right text-[9pt] text-black">
                        {b.age || "　"}
                        <span className="ml-1">歳代</span>
                      </div>
                    </td>
                    <td className={cell}>
                      <CellLabel>性　別</CellLabel>
                      <div className="mt-1 text-center text-[9pt] text-black">
                        {b.sex}
                      </div>
                    </td>
                  </tr>

                  {/* 診断名（左）／既往歴（右・3段縦結合） */}
                  <tr>
                    <td colSpan={2} className={cell}>
                      <div className="flex h-[15mm] flex-col">
                        <CellLabel>診断名</CellLabel>
                        <CellText chunk={page1.diagnosis} />
                      </div>
                    </td>
                    <td colSpan={3} rowSpan={3} className={cell}>
                      <div className="flex h-[47mm] flex-col">
                        <CellLabel>既往歴</CellLabel>
                        <CellText chunk={page1.pastHistory} />
                      </div>
                    </td>
                  </tr>

                  {/* 入院形態 */}
                  <tr>
                    <td colSpan={2} className={cell}>
                      <div className="flex h-[15mm] flex-col">
                        <CellLabel>入院形態</CellLabel>
                        <CellText chunk={page1.admissionType} />
                      </div>
                    </td>
                  </tr>

                  {/* 主訴 */}
                  <tr>
                    <td colSpan={2} className={cell}>
                      <div className="flex h-[15mm] flex-col">
                        <CellLabel>主訴</CellLabel>
                        <CellText chunk={page1.chiefComplaint} />
                      </div>
                    </td>
                  </tr>

                  {/* 受け持つまでの経過（生育歴・現病歴）— 13項目を統合 */}
                  <tr>
                    <td colSpan={5} className={cell}>
                      <div className="flex h-[112mm] flex-col">
                        <CellLabel>
                          受け持つまでの経過（生育歴・現病歴）
                        </CellLabel>
                        <CellText chunk={page1.history} />
                      </div>
                    </td>
                  </tr>

                  {/* 医師の治療方針・治療内容 */}
                  <tr>
                    <td colSpan={5} className={cell}>
                      <div className="flex h-[54mm] flex-col">
                        <CellLabel>医師の治療方針・治療内容</CellLabel>
                        <CellText chunk={page1.treatment} />
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="mt-auto pt-2 text-right text-[9pt] text-black">
                {SCHOOL_LINE}
              </div>
            </section>

            {/* ── 2ページ目以降：続紙 ── */}
            {continuations.map((page, i) => (
              <section
                key={`cont-${i}`}
                className="form2-sheet form2-page relative mt-8 flex min-h-[277mm] w-[190mm] flex-col bg-white px-[6mm] py-[6mm] text-black"
              >
                <span className="no-print absolute right-1 top-1 text-[10px] text-slate-400">
                  {i + 2} / {totalPages}
                </span>

                <div className="text-right text-[8.5pt] font-medium text-black">
                  {FORM_NO_CONT}
                </div>
                <div className="mt-1 text-center text-[14pt] font-bold tracking-[0.25em] text-black">
                  {SHEET_TITLE}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-10 gap-y-1 text-[9pt] text-black">
                  <span>学籍番号　{data.student.studentNumber}</span>
                  <span>氏名　{data.student.studentName}</span>
                  <span>患者氏名　{b.patientName}</span>
                </div>

                <div className="mt-3 flex flex-1 flex-col gap-4">
                  {page.sections.map((sec, j) => (
                    <div
                      key={`sec-${i}-${j}`}
                      className="border border-black p-2"
                    >
                      <div className="text-[9pt] font-bold text-black">
                        {sec.title}
                      </div>
                      <CellText chunk={sec} />
                    </div>
                  ))}
                </div>

                <div className="mt-auto pt-2 text-right text-[9pt] text-black">
                  {SCHOOL_LINE}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
