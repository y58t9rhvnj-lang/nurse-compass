"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createFreeCanvasAction,
  deleteFreeCanvasAction,
  listFreeCanvasesAction,
  renameFreeCanvasAction,
} from "@/app/v2/actions/freeCanvas";
import type { FreeCanvasListItem } from "@/lib/v2/freeCanvas/freeCanvasTypes";
import FreeCanvasDeleteConfirm from "@/components/v2/freeCanvas/FreeCanvasDeleteConfirm";

export default function FreeCanvasListClient() {
  const router = useRouter();
  const [items, setItems] = useState<FreeCanvasListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [pendingDelete, setPendingDelete] = useState<FreeCanvasListItem | null>(
    null,
  );
  const deleteInFlightRef = useRef(false);

  const load = useCallback(async () => {
    const res = await listFreeCanvasesAction();
    if (!res.ok) {
      setItems(null);
      setError(res.message);
      return;
    }
    setItems(res.items);
    setError(null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate() {
    setBusy(true);
    const res = await createFreeCanvasAction();
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    router.push(`/v2/student/canvases/${res.canvas.id}`);
  }

  async function handleRename(id: string) {
    setBusy(true);
    const res = await renameFreeCanvasAction({ id, title: renameDraft });
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setRenamingId(null);
    await load();
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    if (deleteInFlightRef.current) return;
    deleteInFlightRef.current = true;
    setBusy(true);
    try {
      const res = await deleteFreeCanvasAction({ id: pendingDelete.id });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setPendingDelete(null);
      if (renamingId === pendingDelete.id) setRenamingId(null);
      await load();
    } finally {
      deleteInFlightRef.current = false;
      setBusy(false);
    }
  }

  return (
    <div data-free-canvas-list="1">
      <div className="mb-6 flex items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          患者Aの関連図とは別です。提出・AI評価・教員評価の対象にはなりません。
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleCreate()}
          className="inline-flex min-h-[44px] items-center rounded-lg bg-sky-600 px-4 text-sm font-medium text-white disabled:opacity-50"
        >
          新規作成
        </button>
      </div>
      {error ? (
        <p role="alert" className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
      {items == null && !error ? (
        <p className="text-sm text-slate-500">読み込み中…</p>
      ) : items && items.length === 0 ? (
        <p className="text-sm text-slate-500">まだキャンバスはありません。新規作成から白紙で始められます。</p>
      ) : (
        <ul className="space-y-2">
          {items?.map((item) => (
            <li
              key={item.id}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3"
            >
              {renamingId === item.id ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={renameDraft}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    className="min-h-[44px] flex-1 rounded-lg border border-slate-200 px-3"
                  />
                  <button
                    type="button"
                    onClick={() => void handleRename(item.id)}
                    className="min-h-[44px] rounded-lg bg-slate-900 px-4 text-sm text-white"
                  >
                    保存
                  </button>
                  <button
                    type="button"
                    onClick={() => setRenamingId(null)}
                    className="min-h-[44px] px-3 text-sm text-slate-500"
                  >
                    キャンセル
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => router.push(`/v2/student/canvases/${item.id}`)}
                    className="min-h-[44px] text-left font-medium text-slate-900"
                  >
                    {item.title}
                  </button>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setRenamingId(item.id);
                        setRenameDraft(item.title);
                      }}
                      className="min-h-[44px] text-sm text-slate-500"
                    >
                      名前を変更
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setPendingDelete(item)}
                      className="min-h-[44px] text-sm text-rose-600"
                    >
                      削除
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <FreeCanvasDeleteConfirm
        open={pendingDelete != null}
        title={pendingDelete?.title ?? ""}
        busy={busy}
        onCancel={() => {
          if (!busy) setPendingDelete(null);
        }}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
