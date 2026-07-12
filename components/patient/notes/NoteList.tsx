"use client";

import type { Note } from "@/lib/notes";
import NoteItem from "./NoteItem";

// メモ一覧（新しい順）。空状態も表示する。
export default function NoteList({
  notes,
  onUpdate,
  onDelete,
  isCollected,
  onCollect,
}: {
  notes: Note[];
  onUpdate: (id: string, text: string) => void;
  onDelete: (id: string) => void;
  isCollected?: (noteId: string) => boolean;
  onCollect?: (note: Note) => void;
}) {
  if (notes.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-[#E0E0E5] bg-[#FAFAFC] px-4 py-6 text-center text-[12px] text-[#AEAEB5]">
        まだ気づきメモはありません。
        <br />
        小さな観察や疑問から書き始めてみましょう。
      </p>
    );
  }

  return (
    <div className="space-y-2.5">
      {notes.map((note) => (
        <NoteItem
          key={note.id}
          note={note}
          onUpdate={onUpdate}
          onDelete={onDelete}
          collected={isCollected?.(note.id) ?? false}
          onCollect={onCollect ? () => onCollect(note) : undefined}
        />
      ))}
    </div>
  );
}
