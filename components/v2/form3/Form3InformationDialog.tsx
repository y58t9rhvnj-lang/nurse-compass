"use client";

// Phase 2 Step 1: 情報の追加・編集 Dialog。
// 入力は S/O 種別と内容のみ。タグ・ソース・日付は出さない。
// Patient Source から自動入力しません（sourceLabel / sourceReference は触らない）。

import { useEffect, useId, useRef, useState } from "react";
import {
  lockForm3RightPaneScroll,
  unlockForm3RightPaneScroll,
} from "@/components/v2/form3/form3RightPaneScroll";
import type { Form3SoType } from "@/lib/form3/v2/form3V2Types";

export type Form3InformationDialogValues = {
  soType: Form3SoType;
  content: string;
};

export type Form3InformationDialogProps = {
  open: boolean;
  mode: "add" | "edit";
  initial?: Partial<Form3InformationDialogValues> | null;
  onClose: () => void;
  onSubmit: (values: Form3InformationDialogValues) => void;
};

export default function Form3InformationDialog({
  open,
  mode,
  initial = null,
  onClose,
  onSubmit,
}: Form3InformationDialogProps) {
  const titleId = useId();
  const kindGroupId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  // Parent remounts via key on open; seed from initial once.
  const [soType, setSoType] = useState<Form3SoType>(
    () => (initial?.soType === "O" ? "O" : "S"),
  );
  const [content, setContent] = useState(() => initial?.content ?? "");
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    if (!open) return;
    lockForm3RightPaneScroll();
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
      unlockForm3RightPaneScroll();
    };
  }, [open, onClose]);

  if (!open) return null;

  const trimmed = content.trim();
  const contentInvalid = attempted && trimmed.length === 0;

  function handleSubmit() {
    setAttempted(true);
    if (trimmed.length === 0) return;
    onSubmit({ soType, content: trimmed });
  }

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
            {mode === "add" ? "情報を追加" : "情報を編集"}
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

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch] px-5 py-4">
          <fieldset className="m-0 border-0 p-0">
            <legend
              id={kindGroupId}
              className="text-[13px] font-semibold text-[#1D1D1F]"
            >
              情報の種類
            </legend>
            <div
              role="radiogroup"
              aria-labelledby={kindGroupId}
              className="mt-2.5 flex flex-col gap-2"
            >
              <label
                className={[
                  "flex min-h-[48px] cursor-pointer items-center gap-3 rounded-2xl px-3.5 ring-1 transition-colors",
                  soType === "S"
                    ? "bg-[#EAF4FC] ring-[#1E88E5]/35"
                    : "bg-[#F7F7F8] ring-transparent",
                ].join(" ")}
              >
                <input
                  type="radio"
                  name="form3-info-so-type"
                  className="h-5 w-5 accent-[#1E88E5]"
                  checked={soType === "S"}
                  onChange={() => setSoType("S")}
                />
                <span className="text-[15px] font-medium text-[#1D1D1F]">
                  S情報（主観的情報）
                </span>
              </label>
              <label
                className={[
                  "flex min-h-[48px] cursor-pointer items-center gap-3 rounded-2xl px-3.5 ring-1 transition-colors",
                  soType === "O"
                    ? "bg-[#F2F2F7] ring-[#C7C7CC]"
                    : "bg-[#F7F7F8] ring-transparent",
                ].join(" ")}
              >
                <input
                  type="radio"
                  name="form3-info-so-type"
                  className="h-5 w-5 accent-[#1E88E5]"
                  checked={soType === "O"}
                  onChange={() => setSoType("O")}
                />
                <span className="text-[15px] font-medium text-[#1D1D1F]">
                  O情報（客観的情報）
                </span>
              </label>
            </div>
          </fieldset>

          <label className="mt-5 block">
            <span className="text-[13px] font-semibold text-[#1D1D1F]">
              内容
            </span>
            <textarea
              className={[
                "mt-2 min-h-[9rem] w-full resize-y rounded-2xl border-0 bg-[#F2F2F7] px-4 py-3 text-[16px] leading-relaxed text-[#1D1D1F] outline-none",
                "focus:ring-2 focus:ring-[#1E88E5]/40",
                contentInvalid ? "ring-2 ring-[#FF3B30]/50" : "",
              ].join(" ")}
              placeholder="観察や会話で得た事実を記入してください"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              aria-invalid={contentInvalid}
              aria-required
            />
            {contentInvalid ? (
              <span className="mt-1.5 block text-[12px] text-[#C0392B]">
                内容を入力してください
              </span>
            ) : null}
          </label>
        </div>

        <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-[#E5E5EA] px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-[44px] items-center rounded-full px-5 text-[15px] font-medium text-[#6E6E73] hover:bg-[#F2F2F7]"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="inline-flex min-h-[44px] items-center rounded-full bg-[#1E88E5] px-6 text-[15px] font-semibold text-white hover:opacity-95"
          >
            {mode === "add" ? "登録" : "保存"}
          </button>
        </footer>
      </div>
    </div>
  );
}
