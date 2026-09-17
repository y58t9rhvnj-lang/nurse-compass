"use client";

import { useEffect, useRef } from "react";

function isolate(event: { stopPropagation(): void }) {
  event.stopPropagation();
}

export default function RelatedDiagramCardDeleteConfirm({
  incidentCount,
  onCancel,
  onConfirm,
}: {
  incidentCount: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const connected = incidentCount > 0;
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = [
        ...dialog.querySelectorAll<HTMLElement>(
          "button:not([disabled]), [href], input, textarea, select, [tabindex]:not([tabindex='-1'])",
        ),
      ];
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  return (
    <div
      data-rd-card-delete-confirm
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/25 px-4"
      onPointerDown={isolate}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="カードの削除確認"
        tabIndex={-1}
        className="w-full max-w-[420px] rounded-xl bg-white p-4 shadow-lg outline-none"
        onPointerDown={isolate}
      >
        <p className="text-[15px] leading-relaxed text-[#1D1D1F]">
          {connected
            ? `このカードには${incidentCount}本の接続があります。カードと接続を関連図から削除しますか？`
            : "このカードを関連図から削除しますか？"}
        </p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            data-rd-card-delete-cancel
            onClick={onCancel}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-lg border border-[#E5E5EA] px-3 text-[14px] text-[#1D1D1F]"
          >
            キャンセル
          </button>
          <button
            type="button"
            data-rd-card-delete-confirm-submit
            onClick={onConfirm}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-lg bg-[#C41E3A] px-3 text-[14px] font-medium text-white"
          >
            {connected ? "カードと接続を削除" : "削除"}
          </button>
        </div>
      </div>
    </div>
  );
}
