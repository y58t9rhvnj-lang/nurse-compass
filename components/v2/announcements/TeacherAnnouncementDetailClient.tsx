"use client";

import { useCallback, useEffect, useState } from "react";
import { getStaffAnnouncementAction } from "@/app/v2/actions/announcements";
import type { AnnouncementRecord } from "@/lib/v2/announcements/announcementTypes";
import TeacherAnnouncementEditor from "./TeacherAnnouncementEditor";

export default function TeacherAnnouncementDetailClient({ id }: { id: string }) {
  const [record, setRecord] = useState<AnnouncementRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await getStaffAnnouncementAction({ id });
    if (!res.ok) {
      setRecord(null);
      setError(res.message);
      setLoading(false);
      return;
    }
    setRecord(res.announcement);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <p className="text-sm text-slate-500">読み込み中…</p>;
  if (error || !record) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
        <p role="alert" className="text-sm text-rose-700">
          {error ?? "お知らせが見つかりません。"}
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-3 inline-flex min-h-[44px] items-center rounded-lg bg-white px-4 text-sm font-medium"
        >
          再試行
        </button>
      </div>
    );
  }
  return <TeacherAnnouncementEditor initial={record} />;
}
