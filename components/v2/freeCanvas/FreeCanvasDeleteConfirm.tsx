"use client";

import { useEffect, useId } from "react";

export default function FreeCanvasDeleteConfirm({
  open,
  title,
  busy = false,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!busy) onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, open, onCancel]);

  if (!open) return null;

  return (
    <div
      data-free-canvas-delete-confirm="1"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-3xl bg-white p-5 shadow-[0_12px_40px_rgba(0,0,0,0.18)]"
      >
        <div className="flex items-start justify-between gap-3">
          <h2
            id={titleId}
            className="text-[16px] font-bold text-[#1D1D1F]"
          >
            キャンバスを削除しますか？
          </h2>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[22px] leading-none text-[#8E8E93] disabled:opacity-50"
            aria-label="閉じる"
          >
            ×
          </button>
        </div>
        <p className="mt-3 text-[14px] leading-relaxed text-[#3A3A3C]">
          「{title}」を削除します。この操作は取り消せません。
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="inline-flex min-h-[44px] items-center rounded-full px-5 text-[14px] text-[#6E6E73] hover:bg-[#F2F2F7] disabled:opacity-50"
          >
            キャンセル
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            data-free-canvas-delete-submit="1"
            className="inline-flex min-h-[44px] items-center rounded-full bg-[#FF3B30] px-6 text-[14px] font-semibold text-white disabled:opacity-50"
          >
            {busy ? "処理中…" : "削除する"}
          </button>
        </div>
      </div>
    </div>
  );
}
