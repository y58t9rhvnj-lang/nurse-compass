"use client";

// Compass Version2 — 患者理解パネル（Sprint D-2C / Patient Understanding Workspace 右カラム）。
//
// 位置づけ:
//   様式2（情報整理）と様式3（ゴードン）の「あいだ」。学生が気づきを分類する前に、
//   情報同士のつながり・患者さんらしさ・身体/心理/社会面の統合を考えるための場。
//   Compass の教育哲学「分類する前に理解する」を体現する。
//
// 役割:
//   ・Compassノート（気づき）を見直し、学生が選んで「気づきとして整理」→ Supabase(information_cards)。
//     元の Compassノートは残す（sourceReference で参照関係を保持し重複整理を防ぐ）。
//   ・整理した各気づきに対し、学生が「患者理解につながるテーマ」を自分の言葉で書ける（自動生成しない）。
//
// スコープ（Sprint D-2C）:
//   ・様式2 項目へのリンク／Focus／Form2EvidenceLinksProvider は使用しない（本パネルから撤去）。
//   ・様式3（ゴードン）への関連付けはまだ実装しない（Sprint D-3）。
//   ・「患者理解につながるテーマ」は今回 UI/コンポーネント設計のみ（DB 保存は未実装＝ローカル状態）。
//     将来 テーマ → ゴードン → 様式3 へ自然につながるよう、テーマは card 単位で独立させて設計する。

import { useState } from "react";
import { NotebookPen, Sparkles } from "lucide-react";
import CollectionDialog from "@/components/collection/CollectionDialog";
import type { InformationCard } from "@/lib/information/informationCard";
import {
  STUDENT_NOTE_SOURCE_KIND,
  studentNoteSourceReference,
} from "@/lib/information/informationCardAdapters";
import { useNotesContext } from "@/components/v2/notebook/NotesContext";
import { useEvidenceContext } from "@/components/v2/notebook/EvidenceContext";

type DialogState =
  | { mode: "add"; noteId: string; originalText: string; timestamp?: string }
  | { mode: "edit"; id: string; originalText: string; initialContent: string }
  | null;

function formatDateTime(input: string | number): string {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function EvidenceOrganizePanel() {
  const evidence = useEvidenceContext();
  const { notes } = useNotesContext();
  const {
    cards,
    status,
    message,
    collectMemo,
    updateContent,
    release,
    isCollectedBySource,
  } = evidence;

  const [dialog, setDialog] = useState<DialogState>(null);

  // 「患者理解につながるテーマ」（Sprint D-2C は UI のみ・DB 未保存）。card 単位のローカル状態。
  // 将来（D-3）は card ごとにテーマ→ゴードン→様式3 へ引き継ぐため、card.id をキーに独立管理する。
  const [themes, setThemes] = useState<Record<string, string>>({});
  const setTheme = (cardId: string, value: string) =>
    setThemes((prev) => ({ ...prev, [cardId]: value }));

  const handleConfirm = async (content: string) => {
    if (!dialog) return;
    if (dialog.mode === "add") {
      await collectMemo(content, {
        sourceReference: studentNoteSourceReference(dialog.noteId),
        originalText: dialog.originalText,
        sourceLabel: "Compassノート",
      });
    } else {
      await updateContent(dialog.id, content);
    }
    setDialog(null);
  };

  const busy = status === "working";

  return (
    <section
      aria-label="患者理解"
      className="flex min-h-0 flex-col bg-white"
    >
      {/* ヘッダー（固定・件数を控えめに表示） */}
      <header className="shrink-0 border-b border-[#EBEBF0] px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 shrink-0 text-[#0A84FF]" strokeWidth={1.75} />
          <h2 className="text-[14px] font-bold text-[#1D1D1F]">患者理解</h2>
          <span className="text-[12px] text-[#8E8E93]">{cards.length}件</span>
        </div>
        <p className="mt-1 text-[11.5px] leading-relaxed text-[#8E8E93]">
          気づきを見直し、患者理解につながるテーマとして整理します。分類する前に、情報のつながりや患者さんらしさを考えましょう。
        </p>
      </header>

      {/* 本文（縦スクロール） */}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-3.5">
        {(status === "error" || status === "conflict") && message ? (
          <p
            className={[
              "rounded-xl px-3.5 py-2 text-[12px]",
              status === "error"
                ? "bg-[#FBEAE8] text-[#C0392B]"
                : "bg-[#FFF7E6] text-[#8A6D3B]",
            ].join(" ")}
            aria-live="polite"
          >
            {message}
          </p>
        ) : null}

        {/* Compassノートから気づきを整理 */}
        <div className="space-y-2">
          <h3 className="flex items-center gap-1.5 text-[12px] font-semibold text-[#6E6E73]">
            <NotebookPen className="h-3.5 w-3.5 text-[#0A84FF]" strokeWidth={1.75} />
            Compassノートから整理
          </h3>
          {notes.length === 0 ? (
            <p className="text-[12px] text-[#8E8E93]">
              まだCompassノートがありません。情報収集中に気づいたことをCompassノートに書き留めましょう。
            </p>
          ) : (
            <ul className="space-y-2">
              {notes.map((note) => {
                const organized = isCollectedBySource(
                  STUDENT_NOTE_SOURCE_KIND,
                  note.id,
                );
                return (
                  <li
                    key={note.id}
                    className="rounded-xl border border-[#EBEBF0] bg-white p-2.5"
                  >
                    <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-[#1D1D1F]">
                      {note.text}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] text-[#AEAEB5]">
                        {formatDateTime(note.updatedAt)}
                      </span>
                      {organized ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#F2F2F7] px-2.5 py-0.5 text-[11px] font-medium text-[#6E6E73]">
                          整理済み
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setDialog({
                              mode: "add",
                              noteId: note.id,
                              originalText: note.text,
                              timestamp: new Date(note.updatedAt).toISOString(),
                            })
                          }
                          disabled={busy}
                          className="min-h-[32px] rounded-full border border-[#D6E6FA] bg-[#F2F7FF] px-3 text-[12px] font-semibold text-[#0A6CD6] transition hover:bg-[#E4EFFF] disabled:opacity-40"
                        >
                          気づきとして整理
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* 整理した気づき → 患者理解につながるテーマ */}
        <div className="space-y-2">
          <h3 className="text-[12px] font-semibold text-[#6E6E73]">
            整理した気づき（{cards.length}件）
          </h3>
          {cards.length === 0 ? (
            <p className="text-[12px] text-[#8E8E93]">
              まだ整理した気づきはありません。Compassノートを振り返り、大切だと思う内容を選びましょう。
            </p>
          ) : (
            <ul className="space-y-2">
              {cards.map((card) => (
                <EvidenceRow
                  key={card.id}
                  card={card}
                  disabled={busy}
                  theme={themes[card.id] ?? ""}
                  onChangeTheme={(value) => setTheme(card.id, value)}
                  onEdit={() =>
                    setDialog({
                      mode: "edit",
                      id: card.id,
                      originalText: card.originalText ?? card.content,
                      initialContent: card.content,
                    })
                  }
                  onRelease={() => release(card.id)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      {dialog && (
        <CollectionDialog
          key={dialog.mode === "add" ? `add-${dialog.noteId}` : `edit-${dialog.id}`}
          open
          mode={dialog.mode}
          originalText={dialog.originalText}
          initialContent={
            dialog.mode === "edit" ? dialog.initialContent : dialog.originalText
          }
          sourceLabel="Compassノート"
          timestamp={dialog.mode === "add" ? dialog.timestamp : undefined}
          onCancel={() => setDialog(null)}
          onConfirm={handleConfirm}
        />
      )}
    </section>
  );
}

function EvidenceRow({
  card,
  disabled,
  theme,
  onChangeTheme,
  onEdit,
  onRelease,
}: {
  card: InformationCard;
  disabled: boolean;
  // 「患者理解につながるテーマ」（UI のみ・未保存）。
  theme: string;
  onChangeTheme: (value: string) => void;
  onEdit: () => void;
  onRelease: () => void;
}) {
  const [confirmRelease, setConfirmRelease] = useState(false);

  return (
    <li className="rounded-xl border border-[#EBEBF0] bg-white p-2.5">
      <p className="whitespace-pre-line text-[12.5px] leading-relaxed text-[#1D1D1F]">
        {card.content}
      </p>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="inline-flex items-center rounded-full bg-[#F2F2F7] px-2 py-0.5 text-[11px] text-[#6E6E73]">
          {card.sourceLabel}
        </span>
        <span className="text-[11px] text-[#AEAEB5]">
          {formatDateTime(card.createdAt)}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={onEdit}
            disabled={disabled}
            className="min-h-[32px] rounded-lg px-2.5 text-[12px] text-[#0A84FF] transition hover:bg-[#F2F7FF] disabled:opacity-40"
          >
            修正
          </button>
          {confirmRelease ? (
            <>
              <button
                type="button"
                onClick={() => {
                  onRelease();
                  setConfirmRelease(false);
                }}
                disabled={disabled}
                className="min-h-[32px] rounded-lg bg-[#F2F2F7] px-2.5 text-[12px] font-semibold text-[#C0392B] transition hover:bg-[#EAEAEF] disabled:opacity-40"
              >
                外す
              </button>
              <button
                type="button"
                onClick={() => setConfirmRelease(false)}
                className="min-h-[32px] rounded-lg px-2.5 text-[12px] text-[#6E6E73] transition hover:bg-[#F2F2F5]"
              >
                やめる
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmRelease(true)}
              disabled={disabled}
              className="min-h-[32px] rounded-lg px-2.5 text-[12px] text-[#8E8E93] transition hover:bg-[#F2F2F5] disabled:opacity-40"
            >
              整理から外す
            </button>
          )}
        </div>
      </div>

      {/* 患者理解につながるテーマ（UI のみ・自由入力。分類ではなく理解を目的とする）。 */}
      <div className="mt-2 border-t border-[#F2F2F5] pt-2">
        <label className="mb-1 block text-[11px] font-semibold text-[#8E8E93]">
          患者理解につながるテーマ
        </label>
        <input
          type="text"
          value={theme}
          onChange={(e) => onChangeTheme(e.target.value)}
          placeholder="この気づきから見えてくることは？（例: 睡眠リズムが乱れている）"
          className="w-full rounded-lg border border-[#E1E1E8] bg-[#FBFBFD] px-2.5 py-1.5 text-[12.5px] text-[#1D1D1F] placeholder:text-[#B7B7BF] focus:border-[#0A84FF] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0A84FF]/20"
        />
      </div>
    </li>
  );
}
