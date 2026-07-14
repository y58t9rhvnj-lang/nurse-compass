"use client";

import { useEffect, useRef, useState } from "react";
import { NotebookPen } from "lucide-react";
import { useNotes } from "@/hooks/useNotes";
import { useInformationCards } from "@/hooks/useInformationCards";
import CollectionDialog from "@/components/collection/CollectionDialog";
import { isFeatureEnabled } from "@/lib/featureFlags";
import type { Note } from "@/lib/notes";
import NoteComposer from "./NoteComposer";
import NoteList from "./NoteList";

// Version1（第1回講義）では一時メモの収集操作を学生画面から完全に非表示にする。
const COLLECTION_ENABLED = isFeatureEnabled("collection");

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
  // 一時メモの収集（収集データ store 由来で「収集済み」を判定する）。
  const { isNoteCollected, collectTemporaryMemo } =
    useInformationCards(patientId);
  // 収集する対象の一時メモ（共通収集ダイアログで確認・確定する）。
  const [collectTarget, setCollectTarget] = useState<Note | null>(null);

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
          <NoteList
            notes={notes}
            onUpdate={updateNote}
            onDelete={deleteNote}
            isCollected={COLLECTION_ENABLED ? isNoteCollected : undefined}
            onCollect={COLLECTION_ENABLED ? setCollectTarget : undefined}
          />
        ) : (
          <p className="rounded-2xl border border-dashed border-[#E0E0E5] bg-[#FAFAFC] px-4 py-6 text-center text-[12px] text-[#AEAEB5]">
            メモを読み込み中…
          </p>
        )}
      </div>

      {/* 共通収集ダイアログ（一時メモの収集）。Version1 では非表示。 */}
      {COLLECTION_ENABLED && (
        <CollectionDialog
          key={collectTarget?.id ?? "closed"}
          open={collectTarget !== null}
          mode="add"
          originalText={collectTarget?.text ?? ""}
          initialContent={collectTarget?.text ?? ""}
          sourceLabel="一時メモ"
          timestamp={
            collectTarget
              ? new Date(collectTarget.createdAt).toISOString()
              : undefined
          }
          onCancel={() => setCollectTarget(null)}
          onConfirm={(content) => {
            if (collectTarget) {
              collectTemporaryMemo(
                collectTarget.id,
                content,
                collectTarget.text,
                new Date(collectTarget.createdAt).toISOString(),
              );
            }
            setCollectTarget(null);
          }}
        />
      )}
    </section>
  );
}
