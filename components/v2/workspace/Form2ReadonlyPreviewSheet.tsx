"use client";

/**
 * 狭幅向け：様式2読み取り専用プレビュー Sheet。
 * 電子カルテ Sheet ではない。
 */

import { useEffect, useId, useRef } from "react";
import Form2ReadonlyPreviewPane from "@/components/v2/workspace/Form2ReadonlyPreviewPane";
import type { Form2Data } from "@/lib/form2/form2Types";

export type Form2ReadonlyPreviewSheetProps = {
  open: boolean;
  onClose: () => void;
  data: Form2Data;
  hydrated: boolean;
};

export default function Form2ReadonlyPreviewSheet({
  open,
  onClose,
  data,
  hydrated,
}: Form2ReadonlyPreviewSheetProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

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
    <div className="fixed inset-0 z-40 flex justify-end lg:hidden">
      <button
        type="button"
        aria-label="様式2プレビューを閉じる"
        className="absolute inset-0 bg-black/35"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex h-full w-full max-w-full flex-col bg-white shadow-xl pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] sm:max-w-[28rem]"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[#E5E5EA] px-4 py-3">
          <h2
            id={titleId}
            className="text-[15px] font-semibold text-[#1D1D1F]"
          >
            様式2を参照
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-xl text-[15px] text-[#0A6CD6]"
          >
            閉じる
          </button>
        </header>
        <Form2ReadonlyPreviewPane
          data={data}
          hydrated={hydrated}
          className="min-h-0 flex-1"
        />
      </aside>
    </div>
  );
}
