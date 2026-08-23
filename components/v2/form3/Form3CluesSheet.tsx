"use client";

// Compass Version2.1 Day 5 — 「患者理解の手がかり」参照シート。
//
// Constitution:
//   ・様式2 / 「私が捉えた患者さん」は資料（参照）であり転記元ではない。
//   ・転記・コピー・同期用の操作 UI は置かない。
//   ・読み取り専用。編集 UI は出さない。

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import Form2SheetView from "@/components/form2/Form2SheetView";
import { createEmptyForm2, type Form2Data } from "@/lib/form2/form2Types";

export type Form3CluesSheetProps = {
  open: boolean;
  onClose: () => void;
  patientId: string;
  form2Data: Form2Data | null;
  patientOverviewText: string;
};

export default function Form3CluesSheet({
  open,
  onClose,
  patientId,
  form2Data,
  patientOverviewText,
}: Form3CluesSheetProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const sheetData = form2Data ?? createEmptyForm2(patientId);
  const overview = patientOverviewText.trim();

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button
        type="button"
        aria-label="患者理解の手がかりを閉じる"
        className="absolute inset-0 bg-black/35"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex h-full w-full max-w-full flex-col bg-white shadow-xl pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] lg:max-w-[36rem] xl:max-w-[40rem]"
      >
        <header className="flex shrink-0 items-start gap-3 border-b border-[#E5E5EA] px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2
              id={titleId}
              className="text-[15px] font-semibold text-[#1D1D1F]"
            >
              患者理解の手がかり
            </h2>
            <p className="mt-1 text-[12px] leading-relaxed text-[#6E6E73]">
              転記するための資料ではありません。患者さんを考え直すときの手がかりとして参照してください。
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full text-[#6E6E73] hover:bg-[#F2F2F7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A84FF]"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          <section aria-labelledby="clues-overview-heading" className="space-y-2">
            <h3
              id="clues-overview-heading"
              className="text-[13px] font-semibold text-[#1D1D1F]"
            >
              私が捉えた患者さん
            </h3>
            {overview ? (
              <p className="whitespace-pre-wrap break-words rounded-xl border border-[#E5E5EA] bg-[#FBFBFD] px-3 py-3 text-[13.5px] leading-relaxed text-[#3A3A3C]">
                {overview}
              </p>
            ) : (
              <p className="rounded-xl border border-dashed border-[#D1D1D6] bg-[#FBFBFD] px-3 py-3 text-[13px] text-[#8E8E93]">
                まだ記入がありません。患者理解の画面で書いた内容が、ここに参照として現れます。
              </p>
            )}
          </section>

          <div
            className="my-5 border-t border-[#E5E5EA]"
            role="separator"
            aria-hidden
          />

          <section aria-labelledby="clues-form2-heading" className="space-y-2">
            <h3
              id="clues-form2-heading"
              className="text-[13px] font-semibold text-[#1D1D1F]"
            >
              様式2
            </h3>
            <p className="text-[12px] leading-relaxed text-[#8E8E93]">
              読み取り専用です。内容のコピーや転記はしません。
            </p>
            <div className="overflow-x-hidden rounded-xl border border-[#E5E5EA] bg-[#F2F2F7] p-2">
              {/* iPad 全幅 Sheet では読める縮尺。狭い PC サイドでもはみ出さない */}
              <Form2SheetView data={sheetData} maxScreenScale={2.2} />
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}
