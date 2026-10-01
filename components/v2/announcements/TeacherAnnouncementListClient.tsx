"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { listStaffAnnouncementsAction } from "@/app/v2/actions/announcements";
import {
  announcementStatusLabel,
  groupStaffAnnouncements,
} from "@/lib/v2/announcements/announcementDisplay";
import type { AnnouncementRecord } from "@/lib/v2/announcements/announcementTypes";

function Section({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: AnnouncementRecord[];
  empty: string;
}) {
  return (
    <section className="mb-6">
      <h2 className="text-sm font-semibold text-slate-500">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {rows.map((row) => (
            <li key={row.id}>
              <Link
                href={`/v2/teacher/announcements/${row.id}`}
                className="flex min-h-[56px] items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-sky-300"
              >
                <span className="font-medium text-slate-900">{row.title}</span>
                <span className="text-xs text-slate-500">
                  {announcementStatusLabel(row.status)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function TeacherAnnouncementListClient() {
  const [rows, setRows] = useState<AnnouncementRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await listStaffAnnouncementsAction();
    if (!res.ok) {
      setRows(null);
      setError(res.message);
      setLoading(false);
      return;
    }
    setRows(res.announcements);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = rows ? groupStaffAnnouncements(rows) : null;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          同じ組織の全学生向けのお知らせを管理します。取り下げ後の再公開はできません。
        </p>
        <Link
          href="/v2/teacher/announcements/new"
          className="inline-flex min-h-[44px] items-center rounded-lg bg-sky-600 px-4 text-sm font-medium text-white hover:bg-sky-700"
        >
          下書きを作成
        </Link>
      </div>
      {loading ? (
        <p className="text-sm text-slate-500">読み込み中…</p>
      ) : error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
          <p role="alert" className="text-sm text-rose-700">
            {error}
          </p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 inline-flex min-h-[44px] items-center rounded-lg bg-white px-4 text-sm font-medium"
          >
            再試行
          </button>
        </div>
      ) : grouped ? (
        <>
          <Section title="下書き" rows={grouped.drafts} empty="下書きはありません。" />
          <Section
            title="公開中"
            rows={grouped.published}
            empty="公開中のお知らせはありません。"
          />
          <Section
            title="取り下げ済み（履歴）"
            rows={grouped.unpublished}
            empty="取り下げ履歴はありません。"
          />
        </>
      ) : null}
    </div>
  );
}
