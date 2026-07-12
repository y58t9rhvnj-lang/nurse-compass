"use client";

import { useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import type { Note } from "@/lib/notes";

function formatTimestamp(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// 1件のメモ。表示・インライン編集・削除に対応。
export default function NoteItem({
  note,
  onUpdate,
  onDelete,
  collected = false,
  onCollect,
}: {
  note: Note;
  onUpdate: (id: string, text: string) => void;
  onDelete: (id: string) => void;
  collected?: boolean;
  onCollect?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.text);

  const startEdit = () => {
    setDraft(note.text);
    setEditing(true);
  };

  const save = () => {
    if (!draft.trim()) return;
    onUpdate(note.id, draft);
    setEditing(false);
  };

  const edited = note.updatedAt !== note.createdAt;

  return (
    <div className="rounded-2xl border border-[#EBEBF0] bg-white p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      {editing ? (
        <>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-xl bg-[#F7F7F9] px-3 py-2.5 text-[13px] leading-relaxed text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#0A84FF]/30"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="flex min-h-[44px] items-center gap-1 rounded-lg px-3.5 py-2 text-[12px] font-medium text-[#6E6E73] hover:bg-[#F2F2F5]"
            >
              <X className="h-4 w-4" strokeWidth={2} />
              取消
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!draft.trim()}
              className={[
                "flex min-h-[44px] items-center gap-1 rounded-lg px-3.5 py-2 text-[12px] font-semibold transition",
                draft.trim()
                  ? "bg-[#0A84FF] text-white hover:bg-[#0A6CD6]"
                  : "cursor-not-allowed bg-[#E5E5EA] text-[#AEAEB5]",
              ].join(" ")}
            >
              <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
              保存
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-[#1D1D1F]">
            {note.text}
          </p>
          <div className="mt-2.5 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="shrink-0 text-[11px] text-[#AEAEB5]">
                {formatTimestamp(note.updatedAt)}
                {edited && "（編集済み）"}
              </span>
              {onCollect &&
                (collected ? (
                  <span
                    className="inline-flex min-h-[44px] items-center gap-1 text-[11px] font-semibold text-[#34C759]"
                    aria-label="このメモは収集済みです"
                  >
                    <Check
                      className="h-3.5 w-3.5"
                      strokeWidth={2.5}
                      aria-hidden="true"
                    />
                    収集済み
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={onCollect}
                    aria-label="このメモを収集する"
                    className="inline-flex min-h-[44px] items-center gap-1 text-[11px] font-medium text-[#8E8E93] transition hover:text-[#0A84FF]"
                  >
                    <Plus
                      className="h-3.5 w-3.5"
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                    収集する
                  </button>
                ))}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={startEdit}
                aria-label="メモを編集"
                className="flex h-11 w-11 items-center justify-center rounded-lg text-[#8E8E93] hover:bg-[#F2F2F5] hover:text-[#0A84FF]"
              >
                <Pencil className="h-4 w-4" strokeWidth={1.75} />
              </button>
              <button
                type="button"
                onClick={() => onDelete(note.id)}
                aria-label="メモを削除"
                className="flex h-11 w-11 items-center justify-center rounded-lg text-[#8E8E93] hover:bg-[#FFECEC] hover:text-[#FF3B30]"
              >
                <Trash2 className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
