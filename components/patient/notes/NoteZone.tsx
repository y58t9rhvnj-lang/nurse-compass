"use client";

import { useEffect, useRef, useState } from "react";
import { NotebookPen } from "lucide-react";
import { useNotes } from "@/hooks/useNotes";
import { useOptionalNotesContext } from "@/components/v2/notebook/NotesContext";
import { useInformationCards } from "@/hooks/useInformationCards";
import CollectionDialog from "@/components/collection/CollectionDialog";
import { isFeatureEnabled } from "@/lib/featureFlags";
import type { Note } from "@/lib/notes";
import NoteComposer from "./NoteComposer";
import NoteList from "./NoteList";

// Version1（第1回講義）では一時メモの収集操作を学生画面から完全に非表示にする。
const COLLECTION_ENABLED = isFeatureEnabled("collection");

// 気づきメモ（内部名は据え置き）。ユーザー向け表示名は Compass Version2 で「Compassノート」に統一。
// レイアウトは 2 系統:
//   ・"flow"（既定 / Version1）… 見出し → 入力 → 一覧 の素の縦積み（従来どおり・V1 は変更しない）。
//   ・"fill"（Version2 学習支援カラム）… 見出し固定 / 一覧のみスクロール / 入力欄を下部固定。
//     ノートが増えても入力欄が隠れない（Sprint D-1 追加修正2 ⑦⑧）。
// localStorage 由来のため、hydrated までは一覧をプレースホルダにしてハイドレーション不整合を避ける。
// Compass の問いから誘導された場合は、このゾーンへスクロールする。
export default function NoteZone({
  patientId,
  pendingQuestion,
  onClearPendingQuestion,
  variant = "flow",
}: {
  patientId: string;
  pendingQuestion?: { text: string; token: number } | null;
  onClearPendingQuestion?: () => void;
  variant?: "flow" | "fill";
}) {
  // Compassメモ の状態元（Phase 3: localStorage → Supabase 共有インスタンスへ切替）。
  //   ・V2（NotesProvider 配下）かつ現在患者が受け持ち患者のとき: AppShell 単一インスタンスの
  //     Supabase 版を共有し、患者トップ・会話・思考ワークスペース間でリロード無く相互反映する。
  //   ・V1 Core（Provider 無し）／ V2 の非受け持ち患者: 従来どおり localStorage 版（useNotes）。
  //     Core の挙動と非受け持ち患者のメモは変更しない。
  const shared = useOptionalNotesContext();
  const useShared = shared !== null && shared.patientId === patientId;
  const local = useNotes(patientId);
  const notes = useShared ? shared!.notes : local.notes;
  const addNote = useShared ? shared!.addNote : local.addNote;
  const updateNote = useShared ? shared!.updateNote : local.updateNote;
  const deleteNote = useShared ? shared!.deleteNote : local.deleteNote;
  // 共有（Supabase）版はサーバ初期値を保持しており、読み込み中プレースホルダは不要（常に表示可）。
  const hydrated = useShared ? true : local.hydrated;
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

  const composer = (
    <NoteComposer
      onSubmit={addNote}
      contextQuestion={pendingQuestion?.text ?? null}
      contextToken={token}
      onClearContext={onClearPendingQuestion}
    />
  );

  const list = hydrated ? (
    <NoteList
      notes={notes}
      onUpdate={updateNote}
      onDelete={deleteNote}
      isCollected={COLLECTION_ENABLED ? isNoteCollected : undefined}
      onCollect={COLLECTION_ENABLED ? setCollectTarget : undefined}
      emptyText={variant === "fill" ? "まだCompassノートはありません。" : undefined}
    />
  ) : (
    <p className="rounded-2xl border border-dashed border-[#E0E0E5] bg-[#FAFAFC] px-4 py-6 text-center text-[12px] text-[#AEAEB5]">
      メモを読み込み中…
    </p>
  );

  const collectionDialog = COLLECTION_ENABLED && (
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
  );

  // ── Version2 学習支援カラム用: 見出し＋入力欄を上部固定 / 一覧のみスクロール ──
  //   学習の流れを止めないよう、入力欄は常に最上部に見える（ノートが増えても隠れない）。
  if (variant === "fill") {
    return (
      <section ref={zoneRef} className="flex h-full min-h-0 flex-col">
        {/* 見出し（固定） */}
        <div className="flex shrink-0 items-center gap-2 px-4 pt-4 pb-2.5">
          <span className="h-4 w-1 rounded-full bg-[#0A84FF]" />
          <h3 className="flex items-center gap-1.5 text-[15px] font-bold text-[#1D1D1F]">
            <NotebookPen className="h-4 w-4 text-[#0A84FF]" strokeWidth={1.75} />
            Compassノート
          </h3>
          {hydrated && notes.length > 0 && (
            <span className="ml-auto rounded-full bg-[#EAF3FF] px-2 py-0.5 text-[11px] font-semibold text-[#0A6CD6]">
              {notes.length}件
            </span>
          )}
        </div>

        {/* 入力欄（上部固定） */}
        <div className="shrink-0 border-b border-[#F0F0F3] bg-white px-4 pb-3">
          {composer}
        </div>

        {/* 一覧（この領域だけスクロール） */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
          {list}
        </div>

        {collectionDialog}
      </section>
    );
  }

  // ── 既定（flow / Version1）: 従来どおりの素の縦積み ──
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
        {composer}
        {list}
      </div>

      {collectionDialog}
    </section>
  );
}
