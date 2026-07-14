"use client";

import { useEffect, useId } from "react";

// 汎用の確認ダイアログ。収集解除など「元に戻せる操作の前の一度の確認」に使う。
// Esc・背景タップ・キャンセルで閉じ、確定時のみ onConfirm を呼ぶ。
export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "OK",
  cancelLabel = "キャンセル",
  destructive = false,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="my-auto w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-[0_12px_40px_rgba(0,0,0,0.18)]"
      >
        <div className="px-5 py-4">
          <h2 id={titleId} className="text-[15px] font-bold text-[#1D1D1F]">
            {title}
          </h2>
          {description && (
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#6E6E73]">
              {description}
            </p>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-[#EFEFF2] px-5 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex min-h-[44px] items-center rounded-full px-5 text-[13px] font-medium text-[#6E6E73] transition hover:bg-[#F2F2F5]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={[
              "flex min-h-[44px] items-center rounded-full px-6 text-[13px] font-semibold text-white transition",
              destructive
                ? "bg-[#FF3B30] hover:bg-[#E0342A]"
                : "bg-[#0A84FF] hover:bg-[#0A6CD6]",
            ].join(" ")}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
