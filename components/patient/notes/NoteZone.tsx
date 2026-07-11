"use client";

import { useEffect, useRef } from "react";
import { NotebookPen } from "lucide-react";
import { useNotes } from "@/hooks/useNotes";
import NoteComposer from "./NoteComposer";
import NoteList from "./NoteList";

// 患者トップ中央の第3ゾーン「気づきメモ」。
// localStorage 由来のため、hydrated までは一覧をプレースホルダにしてハイドレーション不整合を避ける。
// Compass の問いから誘導された場合は、このゾーンへスクロールする。
export default function NoteZone({
  patientId,
  pendingQuestion,
  onClearPendingQuestion,
}: {
  patientId: string;
  pendingQuestion?: { text: string; token: number } | null;
  onClearPendingQuestion?: () => void;
}) {
  const { notes, hydrated, addNote, updateNote, deleteNote } =
    useNotes(patientId);

  const zoneRef = useRef<HTMLElement>(null);
  const token = pendingQuestion?.token;

  useEffect(() => {
    // 問い選択（token 変化）時に気づきメモゾーンへスクロール
    if (token === undefined) return;
    zoneRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [token]);

  return (
    <section ref={zoneRef}>
      <div className="mb-2.5 flex items-center gap-2">
        <span className="h-4 w-1 rounded-full bg-[#0A84FF]" />
        <h3 className="flex items-center gap-1.5 text-[15px] font-bold text-[#1D1D1F]">
          <NotebookPen className="h-4 w-4 text-[#0A84FF]" strokeWidth={1.75} />
          気づきメモ
        </h3>
        <span className="text-[11px] text-[#AEAEB5]">
          その人を理解するための気づき
        </span>
        {hydrated && notes.length > 0 && (
          <span className="ml-auto rounded-full bg-[#EAF3FF] px-2 py-0.5 text-[11px] font-semibold text-[#0A6CD6]">
            {notes.length}件
          </span>
        )}
      </div>

      <div className="space-y-2.5">
        <NoteComposer
          onSubmit={addNote}
          contextQuestion={pendingQuestion?.text ?? null}
          contextToken={token}
          onClearContext={onClearPendingQuestion}
        />
        {hydrated ? (
          <NoteList notes={notes} onUpdate={updateNote} onDelete={deleteNote} />
        ) : (
          <p className="rounded-2xl border border-dashed border-[#E0E0E5] bg-[#FAFAFC] px-4 py-6 text-center text-[12px] text-[#AEAEB5]">
            メモを読み込み中…
          </p>
        )}
      </div>
    </section>
  );
}
