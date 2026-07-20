"use client";

// Compass Version2 — 思考ワークスペース左ペイン（Compassメモの振り返り ＋ Evidence の整理）。
//
// 用語（正式決定）: Information Card ＝ Evidence。ここに保持するのは「事実（根拠）」のみ。
//   解釈・推論・患者理解・看護判断は書かせない（将来フェーズで別に扱う）。
//
// 正式導線（docs/version2/15_learning_design.md）:
//   Compassメモ（自由記載の個人メモ）→ 本ペインで振り返り → 学生が明示的に選んで Evidence として整理
//   → Supabase(information_cards) へ保存 → 右ペインの様式2 を書く。
//   ここは「情報を集める場所」ではなく「情報を見直して意味を考え、必要な根拠を選ぶ場所」。
//   Compassメモは NoteZone と同一インスタンス（AppShell 単一の Supabase 版共有 Context）を参照する
//   （別 state を作らない）。保存の正は Supabase。確認・整形は既存 CollectionDialog を再利用する。

import { useEffect, useState } from "react";
import { Check, Plus, Quote, Trash2 } from "lucide-react";
import CollectionDialog from "@/components/collection/CollectionDialog";
import { getEntryId, type FacingEntry } from "@/lib/patientFacingData";
import type { InformationCard } from "@/lib/information/informationCard";
import {
  STUDENT_NOTE_SOURCE_KIND,
  studentNoteSourceReference,
} from "@/lib/information/informationCardAdapters";
import { useNotesContext } from "@/components/v2/notebook/NotesContext";
import {
  CONVERSATION_SOURCE_KIND,
  conversationSourceId,
} from "@/lib/v2/notebook/conversationSourceId";
import type { UseEvidenceSupabaseResult } from "@/hooks/v2/useEvidenceSupabase";

const CONVERSATION_KIND = CONVERSATION_SOURCE_KIND;

// 会話発言の「直接収集」導線の有効/無効。
// 学生は会話をそのまま Evidence にせず、Compassメモ に自分の言葉で記録 → 本ワークスペースで整理する設計へ移行中。
// 現在は無効（false）＝会話発言の収集候補を一切表示しない。
// collectUtterance / conversationSourceId 等のコードは削除せず残す（将来の再有効化に備える一時的な非表示）。
const CONVERSATION_CAPTURE_ENABLED = false;

// Compassメモとは別の「自由入力からの直接収集」欄の有効/無効。
// 正式導線では Evidence 化の中心は Compassメモの整理であり、別の自由入力欄は混乱を招くため非表示にする。
// collectMemo・submitMemo 等のコードは削除せず残す（将来の再利用に備える一時的な非表示）。
const MEMO_FREE_INPUT_ENABLED = false;

// 収集候補（未収集の患者発言）。sourceId は原文の content hash（TD-001）。
type Collectable = { key: string; originalText: string; sourceId: string };

type DialogState =
  | {
      mode: "add";
      originalText: string;
      sourceLabel: string;
      // Compassメモ由来のときは元メモ ID。付けると sourceReference として保持し重複防止に使う。
      noteId?: string;
      timestamp?: string;
    }
  | {
      mode: "edit";
      id: string;
      originalText: string;
      initialContent: string;
      sourceLabel: string;
    }
  | null;

// Compassメモの更新時刻（epoch ms）を簡潔に表示する。
function formatNoteTime(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function EvidencePane({
  patientId,
  history,
  evidence,
}: {
  patientId: string;
  history: FacingEntry[];
  evidence: UseEvidenceSupabaseResult;
}) {
  const {
    cards,
    status,
    message,
    collectUtterance,
    collectMemo,
    updateContent,
    release,
    isCollectedBySource,
  } = evidence;
  // Compassメモは NoteZone（患者トップ・会話画面）と同一インスタンスを参照する
  // （AppShell 単一の Supabase 版共有 Context。別 state を作らない）。
  // 本ペインは受け持ち患者のみで描画される（AppShell の Learning ガード）ため、
  // Provider 配下前提の strict な useNotesContext を使う。
  const { notes } = useNotesContext();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [memo, setMemo] = useState("");
  const [collectable, setCollectable] = useState<Collectable[]>([]);

  const submitMemo = async () => {
    const ok = await collectMemo(memo);
    // 収集成功時のみ入力欄をクリアする（失敗時は入力内容を失わせない）。
    if (ok) setMemo("");
  };

  // 会話履歴のうち、まだ収集していない患者発言（収集候補）を非同期に導出する。
  // 収集済み判定は、収集時とまったく同じ content hash（conversationSourceId）で行う（TD-001）。
  // cards が変わると isCollectedBySource の参照も変わるため、収集後は自動的に再計算される。
  useEffect(() => {
    let cancelled = false;
    // 会話発言の直接収集が無効な間は候補を算出しない（常に空 → 候補セクションは非表示）。
    if (CONVERSATION_CAPTURE_ENABLED) {
      (async () => {
        const patientEntries = history
          .map((item, index) => ({ item, index }))
          .filter(({ item }) => item.role === "patient");
        const withId = await Promise.all(
          patientEntries.map(async ({ item, index }) => {
            const originalText = "text" in item ? item.text : "";
            const sourceId = await conversationSourceId(originalText);
            return {
              key: getEntryId(patientId, item, index),
              originalText,
              sourceId,
            };
          }),
        );
        if (cancelled) return;
        setCollectable(
          withId.filter((c) => !isCollectedBySource(CONVERSATION_KIND, c.sourceId)),
        );
      })();
    }
    return () => {
      cancelled = true;
    };
  }, [history, patientId, isCollectedBySource]);

  const closeDialog = () => setDialog(null);

  const handleConfirm = async (content: string) => {
    if (!dialog) return;
    if (dialog.mode === "add") {
      if (dialog.noteId) {
        // Compassメモ由来: 元メモ ID を sourceReference に保持して Evidence として整理する。
        // DB の一意制約（source_reference.kind + id）で同一メモの重複 Evidence 化を防ぐ。
        await collectMemo(content, {
          sourceReference: studentNoteSourceReference(dialog.noteId),
          originalText: dialog.originalText,
          sourceLabel: "Compassメモ",
        });
      } else {
        // 会話発言由来（現在は非表示導線）。将来の再有効化に備えて残す。
        await collectUtterance({
          content,
          originalText: dialog.originalText,
        });
      }
    } else {
      await updateContent(dialog.id, content);
    }
    setDialog(null);
  };

  return (
    <div className="space-y-4">
      <p className="rounded-xl bg-[#F2F7FF] px-3.5 py-2.5 text-[12px] leading-relaxed text-[#3A6EA5]">
        ここは情報を集める場所ではなく、書き留めたことを見直して意味を考え、
        看護問題を考えるための根拠（Evidence）を選んで整理する場所です。
      </p>

      {(status === "error" || status === "conflict") && message && (
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
      )}

      {/* 会話から収集（現在は無効化＝非表示。Compassメモ経由の整理へ一本化） */}
      {CONVERSATION_CAPTURE_ENABLED && (
      <section className="space-y-2">
        <h3 className="text-[12px] font-semibold text-[#6E6E73]">
          会話から収集する
        </h3>
        {collectable.length === 0 ? (
          <p className="text-[12.5px] text-[#8E8E93]">
            {history.some((h) => h.role === "patient")
              ? "会話からの発言はすべて収集済みです。"
              : "患者さんと話すと、ここに収集できる発言が表示されます。"}
          </p>
        ) : (
          <ul className="space-y-2">
            {collectable.map(({ key, originalText }) => (
              <li
                key={key}
                className="flex items-start gap-2 rounded-2xl border border-[#EBEBF0] bg-white p-3"
              >
                <Quote className="mt-0.5 h-4 w-4 shrink-0 text-[#C7C7CC]" strokeWidth={2} />
                <p className="min-w-0 flex-1 whitespace-pre-line text-[13px] leading-relaxed text-[#3A3A3C]">
                  {originalText}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setDialog({
                      mode: "add",
                      originalText,
                      sourceLabel: "患者との会話",
                    })
                  }
                  disabled={status === "working"}
                  className="flex min-h-[36px] shrink-0 items-center gap-1 rounded-full bg-[#0A84FF] px-3 text-[12px] font-semibold text-white transition hover:bg-[#0A6CD6] disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                  収集
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      )}

      {/* Compassメモを振り返る（NoteZone と同一 store）。学生が明示的に選んで Evidence 化する。 */}
      <section className="space-y-2">
        <h3 className="text-[12px] font-semibold text-[#6E6E73]">
          Compassメモを振り返る
        </h3>
        <p className="text-[11.5px] leading-relaxed text-[#8E8E93]">
          患者トップや会話画面で書いたメモを見直し、看護問題を考えるうえで根拠になりそうな内容を
          選んで Evidence として整理します。メモはそのまま残ります。
        </p>
        {notes.length === 0 ? (
          <p className="text-[12.5px] text-[#8E8E93]">
            まだ Compassメモがありません。患者トップや会話画面で、気づいたこと・気になったことを
            書き留めましょう。
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
                  className="rounded-2xl border border-[#EBEBF0] bg-white p-3"
                >
                  <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-[#1D1D1F]">
                    {note.text}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] text-[#AEAEB5]">
                      {formatNoteTime(note.updatedAt)}
                    </span>
                    {organized ? (
                      <span
                        className="inline-flex min-h-[36px] items-center gap-1 text-[11px] font-semibold text-[#34C759]"
                        aria-label="このメモは Evidence として整理済みです"
                      >
                        <Check
                          className="h-3.5 w-3.5"
                          strokeWidth={2.5}
                          aria-hidden="true"
                        />
                        Evidence整理済み
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setDialog({
                            mode: "add",
                            originalText: note.text,
                            sourceLabel: "Compassメモ",
                            noteId: note.id,
                            timestamp: new Date(note.updatedAt).toISOString(),
                          })
                        }
                        disabled={status === "working"}
                        className="flex min-h-[36px] shrink-0 items-center gap-1 rounded-full bg-[#0A84FF] px-3 text-[12px] font-semibold text-white transition hover:bg-[#0A6CD6] disabled:opacity-40"
                      >
                        <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                        Evidenceとして整理する
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 自由入力からの直接収集（Compassメモとは別）。正式導線では非表示。コードは残置。 */}
      {MEMO_FREE_INPUT_ENABLED && (
      <section className="space-y-2">
        <h3 className="text-[12px] font-semibold text-[#6E6E73]">
          一時メモから収集する
        </h3>
        <p className="text-[11.5px] leading-relaxed text-[#8E8E93]">
          観察して気づいた事実を書き留めて、Evidence として残せます。
          メモ自体は保存されません（収集した Evidence だけが残ります）。
        </p>
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          rows={3}
          placeholder="見たこと・聞いたことを、事実のまま書き留めます"
          className="w-full resize-none rounded-2xl border border-[#E5E5EA] bg-white px-3.5 py-2.5 text-[13px] leading-relaxed text-[#1D1D1F] outline-none transition focus:border-[#34C759] focus:ring-2 focus:ring-[#34C759]/20"
        />
        <div className="flex justify-end">
          <button
            type="button"
            onClick={submitMemo}
            disabled={status === "working" || memo.trim() === ""}
            className="flex min-h-[36px] items-center gap-1 rounded-full bg-[#34C759] px-4 text-[12px] font-semibold text-white transition hover:bg-[#2CA349] disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            Evidenceとして収集
          </button>
        </div>
      </section>
      )}

      {/* 整理した Evidence */}
      <section className="space-y-2">
        <h3 className="text-[12px] font-semibold text-[#6E6E73]">
          整理した Evidence（{cards.length}件）
        </h3>
        {cards.length === 0 ? (
          <p className="text-[12.5px] text-[#8E8E93]">
            まだ Evidence はありません。Compassメモを振り返って、
            看護問題を考える根拠になりそうな情報を選びましょう。
          </p>
        ) : (
          <ul className="space-y-2">
            {cards.map((card) => (
              <EvidenceCardRow
                key={card.id}
                card={card}
                disabled={status === "working"}
                onEdit={() =>
                  setDialog({
                    mode: "edit",
                    id: card.id,
                    originalText: card.originalText ?? card.content,
                    initialContent: card.content,
                    sourceLabel: card.sourceLabel,
                  })
                }
                onRelease={() => release(card.id)}
              />
            ))}
          </ul>
        )}
      </section>

      {dialog && (
        <CollectionDialog
          key={
            dialog.mode === "add"
              ? `add-${dialog.noteId ?? dialog.originalText}`
              : `edit-${dialog.id}`
          }
          open
          mode={dialog.mode}
          originalText={dialog.originalText}
          initialContent={dialog.mode === "edit" ? dialog.initialContent : dialog.originalText}
          sourceLabel={dialog.sourceLabel}
          timestamp={dialog.mode === "add" ? dialog.timestamp : undefined}
          onCancel={closeDialog}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  );
}

function EvidenceCardRow({
  card,
  disabled,
  onEdit,
  onRelease,
}: {
  card: InformationCard;
  disabled: boolean;
  onEdit: () => void;
  onRelease: () => void;
}) {
  const [confirmRelease, setConfirmRelease] = useState(false);
  return (
    <li className="rounded-2xl border border-[#EBEBF0] bg-white p-3">
      <p className="whitespace-pre-line text-[13px] leading-relaxed text-[#1D1D1F]">
        {card.content}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="inline-flex items-center gap-1 rounded-full bg-[#EAF3FF] px-2.5 py-0.5 text-[11px] font-medium text-[#0A6CD6]">
          <Check className="h-3 w-3" strokeWidth={2.5} />
          {card.sourceLabel}
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
                className="inline-flex min-h-[32px] items-center gap-1 rounded-lg bg-[#FBEAE8] px-2.5 text-[12px] font-semibold text-[#C0392B] transition hover:bg-[#F6D9D4] disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                解除する
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
              収集解除
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
