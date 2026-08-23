"use client";

import { useEffect, useId, useRef } from "react";
import { form3PhaseBPatternTabLabel } from "@/components/v2/form3/Form3PhaseBPatternTabBar";
import {
  FORM3_PATTERN_ORDER,
  type Form3PatternKey,
} from "@/lib/form3/form3Types";

export type Form3PhaseBPatternPickerSheetProps = {
  open: boolean;
  onClose: () => void;
  selectedPatternKey: Form3PatternKey;
  onSelect: (key: Form3PatternKey) => void;
};

/**
 * 狭幅向け Pattern 一覧 Sheet（R2 最小）。
 * 横スクロールタブの補助導線。
 */
export default function Form3PhaseBPatternPickerSheet({
  open,
  onClose,
  selectedPatternKey,
  onSelect,
}: Form3PhaseBPatternPickerSheetProps) {
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
    <div className="fixed inset-0 z-40 flex justify-end">
      <button
        type="button"
        aria-label="パターン一覧を閉じる"
        className="absolute inset-0 bg-black/35"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex h-full w-full max-w-full flex-col bg-white shadow-xl pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] sm:max-w-[22rem]"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[#E5E5EA] px-4 py-3">
          <h2
            id={titleId}
            className="text-[15px] font-semibold text-[#1D1D1F]"
          >
            パターン一覧
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
        <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
          {FORM3_PATTERN_ORDER.map((key, index) => {
            const selected = key === selectedPatternKey;
            return (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(key);
                    onClose();
                  }}
                  className={[
                    "mb-1 flex w-full min-h-[44px] items-center gap-3 rounded-xl px-3 text-left text-[15px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A84FF]",
                    selected
                      ? "bg-[#1E88E5] font-semibold text-white"
                      : "bg-transparent font-medium text-[#344054] hover:bg-[#F4F6F8]",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "tabular-nums",
                      selected ? "text-white/80" : "text-[#667085]",
                    ].join(" ")}
                  >
                    {index + 1}
                  </span>
                  <span>{form3PhaseBPatternTabLabel(key)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>
    </div>
  );
}
