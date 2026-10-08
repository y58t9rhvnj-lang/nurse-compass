"use client";

import { useState } from "react";
import Link from "next/link";
import { MANUAL_CATALOG } from "@/lib/v2/manual/catalog";
import type { ManualAudience, ManualChapter } from "@/lib/v2/manual/types";
import ManualImage from "./ManualImage";

function audienceLabel(audience: ManualAudience): string {
  if (audience === "student") return "学生向け";
  if (audience === "teacher") return "教員向け";
  return "管理者向け";
}

function TocList({
  chapters,
  onPick,
}: {
  chapters: ManualChapter[];
  onPick?: () => void;
}) {
  return (
    <ol className="space-y-1">
      {chapters.map((chapter) => (
        <li key={chapter.id}>
          <a
            href={`#${chapter.id}`}
            onClick={onPick}
            className="flex min-h-[44px] items-center rounded-xl px-2 text-[15px] text-[#0A6CD6] hover:bg-[#F2F2F7]"
          >
            {chapter.title}
          </a>
        </li>
      ))}
    </ol>
  );
}

function ChapterSection({ chapter }: { chapter: ManualChapter }) {
  return (
    <article
      id={chapter.id}
      className="scroll-mt-[7.5rem] rounded-3xl border border-[#E5E5EA] bg-white p-5 shadow-sm"
    >
      <p className="text-[12px] font-medium text-[#8E8E93]">
        {audienceLabel(chapter.audience)}
      </p>
      <h2 className="mt-1 text-[22px] font-bold text-[#1D1D1F]">{chapter.title}</h2>
      <div className="mt-3 rounded-2xl bg-[#F5F5F7] px-4 py-3">
        <p className="text-[13px] font-semibold text-[#6E6E73]">この画面でできること</p>
        <p className="mt-1 text-[16px] leading-relaxed text-[#1D1D1F]">
          {chapter.about}
        </p>
      </div>
      <div className="mt-6 space-y-10">
        {chapter.ops.map((op) => (
          <section key={op.title}>
            <h3 className="text-[18px] font-semibold text-[#1D1D1F]">{op.title}</h3>
            {op.shots.map((shot) => (
              <ManualImage key={shot.src + shot.alt} image={shot} />
            ))}
            {op.steps.length > 0 ? (
              <ol className="mt-3 space-y-2">
                {op.steps.map((step) => (
                  <li
                    key={`${op.title}-${step.n}`}
                    className="flex gap-3 text-[16px] leading-relaxed text-[#1D1D1F]"
                  >
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0A84FF] text-[14px] font-bold text-white">
                      {step.n}
                    </span>
                    <span>{step.text}</span>
                  </li>
                ))}
              </ol>
            ) : null}
            {op.result ? (
              <p className="mt-3 rounded-xl border border-[#D1F0D8] bg-[#F2FFF5] px-3 py-2 text-[15px] leading-relaxed text-[#1D1D1F]">
                操作後：{op.result}
              </p>
            ) : null}
          </section>
        ))}
      </div>
    </article>
  );
}

export default function ManualViewer({
  audience,
  chapters,
  backHref,
  backLabel,
}: {
  audience: ManualAudience;
  chapters: ManualChapter[];
  backHref: string;
  backLabel: string;
}) {
  const [tocOpen, setTocOpen] = useState(false);
  const groups = [
    {
      label: "学生向け",
      items: chapters.filter((chapter) => chapter.audience === "student"),
    },
    {
      label: "教員向け",
      items: chapters.filter((chapter) => chapter.audience === "teacher"),
    },
    {
      label: "管理者向け",
      items: chapters.filter((chapter) => chapter.audience === "admin"),
    },
  ].filter((group) => group.items.length > 0);

  return (
    <div data-manual-viewer={audience} className="bg-[#F2F2F7] text-[#1D1D1F]">
      <header className="sticky top-0 z-20 border-b border-[#E5E5EA] bg-white/95 px-4 py-3 backdrop-blur">
        <Link
          href={backHref}
          className="inline-flex min-h-[44px] items-center text-[15px] text-[#0A6CD6]"
        >
          {backLabel}
        </Link>
        <h1 className="text-[22px] font-bold">{MANUAL_CATALOG.versionLabel} 操作説明</h1>
      </header>

      <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-5 lg:grid-cols-[240px_minmax(0,1fr)]">
        <div className="lg:hidden">
          <button
            type="button"
            aria-expanded={tocOpen}
            onClick={() => setTocOpen((open) => !open)}
            className="flex min-h-[44px] w-full items-center justify-between rounded-2xl border border-[#E5E5EA] bg-white px-4 text-[16px] font-semibold"
          >
            目次
            <span className="text-[14px] font-normal text-[#6E6E73]">
              {tocOpen ? "閉じる" : "開く"}
            </span>
          </button>
          {tocOpen ? (
            <nav
              aria-label="操作説明の目次"
              className="mt-2 max-h-[50vh] overflow-y-auto overscroll-contain rounded-2xl border border-[#E5E5EA] bg-white p-3"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              {groups.map((group) => (
                <div key={group.label} className="mt-2 first:mt-0">
                  {groups.length > 1 ? (
                    <p className="px-2 text-[12px] font-medium text-[#8E8E93]">
                      {group.label}
                    </p>
                  ) : null}
                  <TocList
                    chapters={group.items}
                    onPick={() => setTocOpen(false)}
                  />
                </div>
              ))}
            </nav>
          ) : null}
        </div>

        <nav
          aria-label="操作説明の目次"
          className="hidden max-h-[calc(100dvh-8rem)] overflow-y-auto overscroll-contain rounded-3xl border border-[#E5E5EA] bg-white p-4 lg:sticky lg:top-28 lg:block lg:self-start"
        >
          <p className="text-[13px] font-semibold text-[#6E6E73]">目次</p>
          {groups.map((group) => (
            <div key={group.label} className="mt-3">
              {groups.length > 1 ? (
                <p className="text-[12px] font-medium text-[#8E8E93]">{group.label}</p>
              ) : null}
              <TocList chapters={group.items} />
            </div>
          ))}
        </nav>

        <div className="space-y-6 pb-20">
          {chapters.map((chapter) => (
            <ChapterSection key={chapter.id} chapter={chapter} />
          ))}
        </div>
      </div>
    </div>
  );
}
