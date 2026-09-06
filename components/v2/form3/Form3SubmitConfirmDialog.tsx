"use client";

import { useEffect, useId, useRef } from "react";
import type { Form3MissingItem } from "@/lib/form3/v2/collectForm3Missing";
import type { Form3PatternKey } from "@/lib/form3/form3Types";
import { FORM3_PHASE_B_SUBMIT_CONFIRM_BODY } from "@/components/v2/form3/form3PhaseBEducationCopy";

export type Form3SubmitConfirmDialogProps = {
  open: boolean;
  missing: Form3MissingItem[];
  saveLabel: string;
  onClose: () => void;
  onSubmitAnyway: () => void;
  onJumpToPattern?: (patternKey: Form3PatternKey) => void;
};

/**
 * 提出前の未入力確認（warning）。常設パネルは出さない。
 * Pattern 未入力があっても「このまま提出」で続行できる。
 */
export default function Form3SubmitConfirmDialog({
  open,
  missing,
  saveLabel,
  onClose,
  onSubmitAnyway,
  onJumpToPattern,
}: Form3SubmitConfirmDialogProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const patternMissing = missing.filter((m) => m.kind !== "student");
  const studentMissing = missing.filter((m) => m.kind === "student");

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="ダイアログを閉じる"
        className="absolute inset-0 bg-black/35"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex max-h-[100dvh] w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-[0_12px_40px_rgba(0,0,0,0.18)] sm:max-h-[min(88dvh,40rem)] sm:rounded-3xl"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[#E5E5EA] px-5 py-3.5">
          <h2
            id={titleId}
            className="text-[17px] font-semibold tracking-tight text-[#1D1D1F]"
          >
            提出内容を確認
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[22px] leading-none text-[#8E8E93]"
            aria-label="閉じる"
          >
            ×
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <p className="text-[14px] leading-relaxed text-[#3A3A3C]">
            {FORM3_PHASE_B_SUBMIT_CONFIRM_BODY}
          </p>

          <p className="mt-3 text-[13px] text-[#6E6E73]">
            未入力: {missing.length} 件　／　保存状態: {saveLabel}
          </p>

          {studentMissing.length > 0 ? (
            <ul className="mt-3 space-y-1.5">
              {studentMissing.map((item) => (
                <li
                  key={`s-${item.label}`}
                  className="rounded-xl border border-[#F3D6D2] bg-[#FBEAE8] px-3 py-2 text-[13px] text-[#C0392B]"
                >
                  {item.label}
                </li>
              ))}
            </ul>
          ) : null}

          {patternMissing.length > 0 ? (
            <ul className="mt-3 space-y-1.5">
              {patternMissing.map((item) => (
                <li
                  key={`${item.kind}-${item.patternKey ?? item.label}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#E5E5EA] bg-[#F9F9FB] px-3 py-2"
                >
                  <span className="text-[13px] text-[#1D1D1F]">{item.label}</span>
                  {item.patternKey && onJumpToPattern ? (
                    <button
                      type="button"
                      className="text-[12px] font-semibold text-[#1E88E5] underline-offset-2 hover:underline"
                      onClick={() => onJumpToPattern(item.patternKey!)}
                    >
                      この Pattern へ
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-[#E5E5EA] px-5 py-3.5 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-[48px] items-center justify-center rounded-2xl border border-[#D0D5DD] bg-white px-4 text-[14px] font-semibold text-[#344054]"
          >
            戻って確認
          </button>
          <button
            type="button"
            onClick={onSubmitAnyway}
            className="inline-flex min-h-[48px] items-center justify-center rounded-2xl bg-[#1E88E5] px-4 text-[14px] font-semibold text-white"
          >
            このまま提出
          </button>
        </footer>
      </div>
    </div>
  );
}
