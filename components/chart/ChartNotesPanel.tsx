"use client";

import { useEffect, useRef } from "react";
import { NotebookPen } from "lucide-react";
import { useNotes } from "@/hooks/useNotes";
import NoteComposer from "@/components/patient/notes/NoteComposer";
import NoteList from "@/components/patient/notes/NoteList";

// 右ペイン用の控えめな気づきメモ（電子カルテ閲覧を主役にする）
export default function ChartNotesPanel({
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
  const panelRef = useRef<HTMLDivElement>(null);
  const token = pendingQuestion?.token;

  useEffect(() => {
    if (token === undefined) return;
    panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [token]);

  return (
    <section
      ref={panelRef}
      className="rounded-xl border border-[#EBEBF0]/80 bg-[#FAFAFC] p-2.5"
    >
      <div className="mb-2 flex items-center gap-1.5">
        <NotebookPen className="h-3.5 w-3.5 text-[#8E8E93]" strokeWidth={1.75} />
        <h3 className="text-[11px] font-semibold text-[#6E6E73]">
          Compass Notes
        </h3>
        {hydrated && notes.length > 0 && (
          <span className="ml-auto text-[10px] text-[#AEAEB5]">
            {notes.length}件
          </span>
        )}
      </div>

      <div className="space-y-2">
        <NoteComposer
          onSubmit={addNote}
          contextQuestion={pendingQuestion?.text || null}
          contextToken={token}
          onClearContext={onClearPendingQuestion}
        />
        {hydrated && notes.length > 0 && (
          <div className="max-h-[200px] overflow-y-auto">
            <NoteList
              notes={notes.slice(0, 3)}
              onUpdate={updateNote}
              onDelete={deleteNote}
            />
          </div>
        )}
      </div>
    </section>
  );
}
