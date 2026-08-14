"use client";

import { useId, useState, type ReactNode } from "react";
import type { Form3PatternDefinition } from "@/lib/form3/form3Types";

export type Form3PatternGuideProps = {
  definition: Form3PatternDefinition;
};

/**
 * 静的ガイド（定義・視点・情報収集）。答えや患者固有判断は含めない。
 * 初期は折りたたみ。編集不可。
 */
export default function Form3PatternGuide({
  definition,
}: Form3PatternGuideProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <section className="rounded-xl border border-[#E5E5EA] bg-[#FBFBFD]">
      <h3 className="sr-only">このパターンのガイド</h3>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full min-h-[44px] items-center justify-between gap-3 px-3.5 py-2.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A84FF]"
      >
        <span className="text-[13px] font-medium text-[#3A3A3C]">
          ガイドを{open ? "閉じる" : "開く"}
          <span className="ml-2 font-normal text-[#8E8E93]">
            （定義・視点・情報収集の手がかり）
          </span>
        </span>
        <span aria-hidden className="text-[12px] text-[#8E8E93]">
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open ? (
        <div
          id={panelId}
          className="space-y-4 border-t border-[#E5E5EA] px-3.5 py-3.5 text-[13px] leading-relaxed text-[#3A3A3C]"
        >
          <GuideBlock title="このパターンの定義">
            <p className="whitespace-pre-wrap break-words">
              {definition.definition}
            </p>
          </GuideBlock>

          <GuideBlock title="アセスメントの視点">
            <ul className="list-disc space-y-1.5 pl-5">
              {definition.assessmentPerspectives.map((item) => (
                <li key={item} className="break-words">
                  {item}
                </li>
              ))}
            </ul>
          </GuideBlock>

          <GuideBlock title="情報収集の手がかり">
            <ul className="list-disc space-y-1.5 pl-5">
              {definition.informationChecklist.map((item) => (
                <li key={item} className="break-words">
                  {item}
                </li>
              ))}
            </ul>
          </GuideBlock>
        </div>
      ) : null}
    </section>
  );
}

function GuideBlock({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <h4 className="mb-1.5 text-[12px] font-semibold text-[#1D1D1F]">
        {title}
      </h4>
      {children}
    </div>
  );
}
