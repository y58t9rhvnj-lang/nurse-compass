"use client";

import { useEffect, useId, useRef } from "react";
import Form3FinalReferencePanel from "@/components/v2/form3/Form3FinalReferencePanel";
import type {
  Form3AssessmentCardV2,
  Form3InformationCardV2,
} from "@/lib/form3/v2/form3V2Types";

export type Form3FinalReferenceSheetProps = {
  open: boolean;
  onClose: () => void;
  informationCards: Form3InformationCardV2[];
  assessmentCards: Form3AssessmentCardV2[];
};

/** iPad / 狭い画面向け Final 参照 Sheet（転記なし） */
export default function Form3FinalReferenceSheet({
  open,
  onClose,
  informationCards,
  assessmentCards,
}: Form3FinalReferenceSheetProps) {
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
    <div className="fixed inset-0 z-40 flex justify-end xl:hidden">
      <button
        type="button"
        aria-label="Workspace 参照を閉じる"
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
            Workspace 参照
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
        <Form3FinalReferencePanel
          informationCards={informationCards}
          assessmentCards={assessmentCards}
          className="min-h-0 flex-1"
        />
      </aside>
    </div>
  );
}
