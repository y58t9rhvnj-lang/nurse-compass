"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { listPublishedAnnouncementsAction } from "@/app/v2/actions/announcements";
import { unreadStudentAnnouncements } from "@/lib/v2/announcements/announcementDisplay";
import type { StudentAnnouncementItem } from "@/lib/v2/announcements/announcementTypes";
import AnnouncementPlainText from "./AnnouncementPlainText";

export default function StudentAnnouncementsWorkspace({
  onUnreadCountChange,
}: {
  onUnreadCountChange?: (count: number | null) => void;
}) {
  const [items, setItems] = useState<StudentAnnouncementItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const onUnreadCountChangeRef = useRef(onUnreadCountChange);
  onUnreadCountChangeRef.current = onUnreadCountChange;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await listPublishedAnnouncementsAction();
    if (!res.ok) {
      setItems(null);
      setError(res.message);
      onUnreadCountChangeRef.current?.(null);
      setLoading(false);
      return;
    }
    setItems(res.items);
    onUnreadCountChangeRef.current?.(
      unreadStudentAnnouncements(res.items).length,
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="min-h-0 flex-1 overflow-y-auto bg-[#F2F2F7] px-5 py-6">
      <div className="mx-auto w-full max-w-[720px]">
        <h1 className="text-[22px] font-bold text-[#1D1D1F]">お知らせ</h1>
        <p className="mt-1 text-[13px] text-[#8E8E93]">
          公開中のお知らせを、いつでも読み返せます。
        </p>
        {loading ? (
          <p className="mt-6 text-[14px] text-[#8E8E93]">読み込み中…</p>
        ) : error ? (
          <div className="mt-6 rounded-2xl border border-[#F4C7C3] bg-[#FFF1F0] p-4">
            <p role="alert" className="text-[14px] text-[#C43131]">
              {error}
            </p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-3 inline-flex min-h-[44px] items-center rounded-full bg-white px-5 text-[14px] font-medium text-[#1D1D1F]"
            >
              再試行
            </button>
          </div>
        ) : items && items.length === 0 ? (
          <p className="mt-6 text-[14px] text-[#8E8E93]">
            公開中のお知らせはありません。
          </p>
        ) : (
          <ul className="mt-5 space-y-3">
            {items?.map((item) => (
              <li
                key={item.id}
                className="rounded-2xl border border-[#EBEBF0] bg-white p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-[16px] font-semibold text-[#1D1D1F]">
                    {item.title}
                  </h2>
                  {item.readAt ? (
                    <span className="text-[11px] text-[#8E8E93]">確認済み</span>
                  ) : (
                    <span className="text-[11px] font-semibold text-[#0A6CD6]">
                      未確認
                    </span>
                  )}
                </div>
                <div className="mt-2">
                  <AnnouncementPlainText text={item.body} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
