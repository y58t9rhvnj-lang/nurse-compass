"use client";

// Phase 2 Step 2: 解釈・分析の追加・編集 Dialog。
// Evidence は Information ID のみ保存。本文はコピーしません。
// Assessment は解釈（Interpretation）です。看護問題名や援助計画ではありません。

import { useEffect, useId, useRef, useState } from "react";
import {
  lockForm3RightPaneScroll,
  unlockForm3RightPaneScroll,
} from "@/components/v2/form3/form3RightPaneScroll";
import {
  FORM3_PHASE_B_ASSESSMENT_DIALOG_HELPER,
  FORM3_PHASE_B_ASSESSMENT_PLACEHOLDER,
  FORM3_PHASE_B_ASSESSMENT_PROMPTS,
} from "@/components/v2/form3/form3PhaseBEducationCopy";
import type { Form3InformationCardV2 } from "@/lib/form3/v2/form3V2Types";

export type Form3AssessmentDialogValues = {
  evidenceInformationIds: string[];
  interpretation: string;
};

export type Form3AssessmentDialogProps = {
  open: boolean;
  mode: "add" | "edit";
  informationOptions: Form3InformationCardV2[];
  initial?: Partial<Form3AssessmentDialogValues> | null;
  onClose: () => void;
  onSubmit: (values: Form3AssessmentDialogValues) => void;
};

function SoBadge({ soType }: { soType: "S" | "O" | null }) {
  if (soType === "S") {
    return (
      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#E3F2FD] text-[12px] font-bold text-[#1E88E5]">
        S
      </span>
    );
  }
  if (soType === "O") {
    return (
      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#ECEFF1] text-[12px] font-bold text-[#455A64]">
        O
      </span>
    );
  }
  return (
    <span className="inline-flex h-6 min-w-[1.5rem] shrink-0 items-center justify-center rounded-md bg-[#F2F2F7] px-1 text-[10px] font-semibold text-[#8E8E93]">
      —
    </span>
  );
}

export default function Form3AssessmentDialog({
  open,
  mode,
  informationOptions,
  initial = null,
  onClose,
  onSubmit,
}: Form3AssessmentDialogProps) {
  const titleId = useId();
  const evidenceLegendId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>(
    () => initial?.evidenceInformationIds ?? [],
  );
  const [interpretation, setInterpretation] = useState(
    () => initial?.interpretation ?? "",
  );
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

  const trimmed = interpretation.trim();
  const evidenceInvalid = attempted && selectedIds.length === 0;
  const contentInvalid = attempted && trimmed.length === 0;

  function toggleEvidence(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function handleSubmit() {
    setAttempted(true);
    if (selectedIds.length === 0 || trimmed.length === 0) return;
    onSubmit({
      evidenceInformationIds: selectedIds,
      interpretation: trimmed,
    });
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
        className="relative z-10 flex max-h-[100dvh] w-full max-w-xl flex-col rounded-t-3xl bg-white shadow-[0_12px_40px_rgba(0,0,0,0.18)] sm:max-h-[min(88dvh,44rem)] sm:rounded-3xl"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[#E5E5EA] px-5 py-3.5">
          <h2
            id={titleId}
            className="text-[17px] font-semibold tracking-tight text-[#1D1D1F]"
          >
            {mode === "add" ? "解釈・分析を追加" : "解釈・分析を編集"}
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
          <p className="text-[12px] leading-relaxed text-[#8E8E93]">
            {FORM3_PHASE_B_ASSESSMENT_DIALOG_HELPER}
          </p>

          <fieldset className="mt-4 m-0 border-0 p-0">
            <legend
              id={evidenceLegendId}
              className="text-[13px] font-semibold text-[#1D1D1F]"
            >
              根拠とした情報を選択（複数選択可）
            </legend>
            {informationOptions.length === 0 ? (
              <p className="mt-2.5 rounded-2xl bg-[#F2F2F7] px-4 py-4 text-[14px] text-[#6E6E73]">
                先にこのパターンへ情報を追加してください。
              </p>
            ) : (
              <ul
                className="mt-2.5 flex flex-col gap-2"
                aria-labelledby={evidenceLegendId}
              >
                {informationOptions.map((info) => {
                  const checked = selectedIds.includes(info.id);
                  return (
                    <li key={info.id}>
                      <label
                        className={[
                          "flex min-h-[48px] cursor-pointer items-start gap-3 rounded-2xl px-3 py-2.5 ring-1 transition-colors",
                          checked
                            ? "bg-[#EAF4FC] ring-[#1E88E5]/35"
                            : "bg-[#F7F7F8] ring-transparent",
                        ].join(" ")}
                      >
                        <input
                          type="checkbox"
                          className="mt-1 h-5 w-5 shrink-0 accent-[#1E88E5]"
                          checked={checked}
                          onChange={() => toggleEvidence(info.id)}
                        />
                        <SoBadge soType={info.soType} />
                        <span className="min-w-0 flex-1 whitespace-pre-wrap text-[14px] leading-snug text-[#1D1D1F]">
                          {info.content.trim() || "（未入力）"}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
            {evidenceInvalid ? (
              <span className="mt-1.5 block text-[12px] text-[#C0392B]">
                根拠とする情報を1つ以上選んでください
              </span>
            ) : null}
          </fieldset>

          <label className="mt-5 block">
            <span className="text-[13px] font-semibold text-[#1D1D1F]">
              解釈・分析の内容
            </span>
            <ul className="mt-2 space-y-1 rounded-2xl bg-[#F7F8FA] px-3.5 py-2.5">
              {FORM3_PHASE_B_ASSESSMENT_PROMPTS.map((prompt) => (
                <li
                  key={prompt}
                  className="text-[12px] leading-snug text-[#667085]"
                >
                  {prompt}
                </li>
              ))}
            </ul>
            <textarea
              className={[
                "mt-2.5 min-h-[12rem] w-full resize-y rounded-2xl border-0 bg-[#F2F2F7] px-4 py-3 text-[16px] leading-relaxed text-[#1D1D1F] outline-none",
                "focus:ring-2 focus:ring-[#1E88E5]/40",
                contentInvalid ? "ring-2 ring-[#FF3B30]/50" : "",
              ].join(" ")}
              placeholder={FORM3_PHASE_B_ASSESSMENT_PLACEHOLDER}
              value={interpretation}
              onChange={(e) => setInterpretation(e.target.value)}
              aria-invalid={contentInvalid}
              aria-required
            />
            {contentInvalid ? (
              <span className="mt-1.5 block text-[12px] text-[#C0392B]">
                解釈・分析を入力してください
              </span>
            ) : null}
          </label>

          <span className="sr-only">
            evidenceInformationIds selected: {selectedIds.join(",")}
          </span>
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
