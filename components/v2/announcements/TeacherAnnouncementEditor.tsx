"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  createAnnouncementDraftAction,
  publishAnnouncementAction,
  unpublishAnnouncementAction,
  updateAnnouncementDraftAction,
} from "@/app/v2/actions/announcements";
import {
  canEditAnnouncementContent,
  nextStatusForPublish,
} from "@/lib/v2/announcements/announcementPolicy";
import {
  announcementStatusLabel,
  publishConfirmCopy,
  unpublishConfirmCopy,
} from "@/lib/v2/announcements/announcementDisplay";
import type { AnnouncementRecord } from "@/lib/v2/announcements/announcementTypes";
import AnnouncementPlainText from "./AnnouncementPlainText";
import AnnouncementStaffConfirmDialog from "./AnnouncementStaffConfirmDialog";

export default function TeacherAnnouncementEditor({
  initial,
}: {
  initial: AnnouncementRecord | null;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [record, setRecord] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<"publish" | "unpublish" | null>(null);

  const status = record?.status ?? "draft";
  const editable = !record || canEditAnnouncementContent(status);
  const canPublish = nextStatusForPublish(status) === "published";
  const canUnpublish = status === "published";

  async function saveDraft() {
    setBusy(true);
    setError(null);
    const res = record
      ? await updateAnnouncementDraftAction({ id: record.id, title, body })
      : await createAnnouncementDraftAction({ title, body });
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setRecord(res.announcement);
    if (!record) router.replace(`/v2/teacher/announcements/${res.announcement.id}`);
  }

  async function confirmPublish() {
    if (!record) return;
    setBusy(true);
    setError(null);
    const res = await publishAnnouncementAction({ id: record.id });
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setRecord(res.announcement);
    setConfirm(null);
  }

  async function confirmUnpublish() {
    if (!record) return;
    setBusy(true);
    setError(null);
    const res = await unpublishAnnouncementAction({ id: record.id });
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setRecord(res.announcement);
    setConfirm(null);
  }

  const publishCopy = publishConfirmCopy(title.trim() || record?.title || "無題");
  const unpublishCopy = unpublishConfirmCopy(record?.title || title);

  return (
    <div>
      <p className="text-sm text-slate-500">
        状態: {announcementStatusLabel(status)}
      </p>
      {editable ? (
        <form
          className="mt-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void saveDraft();
          }}
        >
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              タイトル
            </span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              required
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              本文（プレーンテキスト）
            </span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              required
            />
          </label>
          {error ? (
            <p role="alert" className="text-sm text-rose-700">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex min-h-[44px] items-center rounded-lg bg-slate-800 px-4 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy ? "保存中…" : "下書きを保存"}
            </button>
            {canPublish && record ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirm("publish")}
                className="inline-flex min-h-[44px] items-center rounded-lg bg-sky-600 px-4 text-sm font-medium text-white disabled:opacity-50"
              >
                公開する
              </button>
            ) : null}
          </div>
        </form>
      ) : (
        <div className="mt-4 space-y-4">
          <h2 className="text-xl font-bold text-slate-900">{record?.title}</h2>
          <AnnouncementPlainText text={record?.body ?? ""} />
          {error ? (
            <p role="alert" className="text-sm text-rose-700">
              {error}
            </p>
          ) : null}
          {canUnpublish ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirm("unpublish")}
              className="inline-flex min-h-[44px] items-center rounded-lg bg-rose-600 px-4 text-sm font-medium text-white disabled:opacity-50"
            >
              取り下げる
            </button>
          ) : (
            <p className="text-sm text-slate-500">
              取り下げ済みの履歴です。再公開はできません。新しい下書きを作成してください。
            </p>
          )}
        </div>
      )}

      <AnnouncementStaffConfirmDialog
        open={confirm === "publish"}
        title={publishCopy.title}
        audience={publishCopy.audience}
        result={publishCopy.result}
        subject={publishCopy.subject}
        confirmLabel="公開する"
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void confirmPublish()}
      />
      <AnnouncementStaffConfirmDialog
        open={confirm === "unpublish"}
        title={unpublishCopy.title}
        audience={unpublishCopy.audience}
        result={unpublishCopy.result}
        subject={unpublishCopy.subject}
        confirmLabel="取り下げる"
        destructive
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void confirmUnpublish()}
      />
    </div>
  );
}
