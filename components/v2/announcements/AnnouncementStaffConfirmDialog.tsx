"use client";

export default function AnnouncementStaffConfirmDialog({
  open,
  title,
  audience,
  result,
  subject,
  confirmLabel,
  destructive = false,
  busy = false,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  audience: string;
  result: string;
  subject: string;
  confirmLabel: string;
  destructive?: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="announcement-staff-confirm-title"
        className="w-full max-w-md rounded-3xl bg-white p-5 shadow-[0_12px_40px_rgba(0,0,0,0.18)]"
      >
        <h2
          id="announcement-staff-confirm-title"
          className="text-[16px] font-bold text-[#1D1D1F]"
        >
          {title}
        </h2>
        <dl className="mt-3 space-y-2 text-[13px]">
          <div>
            <dt className="font-medium text-[#8E8E93]">対象</dt>
            <dd className="text-[#1D1D1F]">{audience}</dd>
          </div>
          <div>
            <dt className="font-medium text-[#8E8E93]">結果</dt>
            <dd className="text-[#1D1D1F]">{result}</dd>
          </div>
          <div>
            <dt className="font-medium text-[#8E8E93]">お知らせ</dt>
            <dd className="text-[#1D1D1F]">{subject}</dd>
          </div>
        </dl>
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
            className={[
              "inline-flex min-h-[44px] items-center rounded-full px-6 text-[14px] font-semibold text-white disabled:opacity-50",
              destructive ? "bg-[#FF3B30]" : "bg-[#0A84FF]",
            ].join(" ")}
          >
            {busy ? "処理中…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
