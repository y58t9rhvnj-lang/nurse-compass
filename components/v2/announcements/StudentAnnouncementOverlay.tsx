"use client";

import AnnouncementPlainText from "./AnnouncementPlainText";
import type { StudentAnnouncementItem } from "@/lib/v2/announcements/announcementTypes";

export default function StudentAnnouncementOverlay({
  item,
  remainingCount,
  error,
  busy,
  onConfirm,
  onDefer,
}: {
  item: StudentAnnouncementItem;
  remainingCount: number;
  error: string | null;
  busy: boolean;
  onConfirm: () => void;
  onDefer: () => void;
}) {
  return (
    <div
      data-student-announcement-overlay="1"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="student-announcement-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-5 shadow-[0_12px_40px_rgba(0,0,0,0.18)]"
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-[12px] font-medium text-[#8E8E93]">
            未確認のお知らせ
            {remainingCount > 1 ? `（残り ${remainingCount} 件）` : ""}
          </p>
          <button
            type="button"
            aria-label="閉じる"
            disabled={busy}
            onClick={onDefer}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-[20px] text-[#6E6E73] hover:bg-[#F2F2F7] disabled:opacity-50"
          >
            ×
          </button>
        </div>
        <h2
          id="student-announcement-title"
          className="mt-1 text-[20px] font-bold text-[#1D1D1F]"
        >
          {item.title}
        </h2>
        <div className="mt-3">
          <AnnouncementPlainText text={item.body} />
        </div>
        {error ? (
          <p role="alert" className="mt-3 rounded-xl bg-[#FFF1F0] px-3 py-2 text-[13px] text-[#C43131]">
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onDefer}
            className="inline-flex min-h-[44px] items-center rounded-full px-5 text-[15px] font-medium text-[#6E6E73] hover:bg-[#F2F2F7] disabled:opacity-50"
          >
            後で
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="inline-flex min-h-[44px] items-center rounded-full bg-[#0A84FF] px-6 text-[15px] font-semibold text-white hover:bg-[#0A6CD6] disabled:opacity-50"
          >
            {busy ? "記録中…" : error ? "再試行" : "確認した"}
          </button>
        </div>
      </div>
    </div>
  );
}
