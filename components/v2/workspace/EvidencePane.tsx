"use client";

// Compass Version2 Sprint1 — Evidence（Information Card）セクション。
//
// 用語（正式決定）: Information Card ＝ Evidence。
// ここに保持するのは「事実」のみ。解釈・推論・患者理解・看護判断は書かせない。
// それらは将来フェーズ（Patient Story 側）で扱う。
//
// 収集導線: 会話（FacingPatient）は Evidence の重要な収集経路。
//   患者の発言を選んで Evidence として収集する（Supabase へ保存）。
// 保存の正は Supabase。収集の確認・整形は V1 の CollectionDialog を再利用する。

import { useState } from "react";
import { Check, Plus, Quote, Trash2 } from "lucide-react";
import CollectionDialog from "@/components/collection/CollectionDialog";
import { getEntryId, type FacingEntry } from "@/lib/patientFacingData";
import type { InformationCard } from "@/lib/information/informationCard";
import type { UseEvidenceSupabaseResult } from "@/hooks/v2/useEvidenceSupabase";

const CONVERSATION_KIND = "patient_conversation";

type DialogState =
  | { mode: "add"; entryId: string; originalText: string }
  | { mode: "edit"; id: string; originalText: string; initialContent: string }
  | null;

export default function EvidencePane({
  patientId,
  history,
  evidence,
}: {
  patientId: string;
  history: FacingEntry[];
  evidence: UseEvidenceSupabaseResult;
}) {
  const { cards, status, message, collectUtterance, updateContent, release, isCollectedBySource } =
    evidence;
  const [dialog, setDialog] = useState<DialogState>(null);

  // 会話履歴のうち、まだ収集していない患者発言（収集候補）。
  const collectable = history
    .map((item, index) => ({ item, entryId: getEntryId(patientId, item, index) }))
    .filter(
      ({ item, entryId }) =>
        item.role === "patient" &&
        !isCollectedBySource(CONVERSATION_KIND, entryId),
    );

  const closeDialog = () => setDialog(null);

  const handleConfirm = async (content: string) => {
    if (!dialog) return;
    if (dialog.mode === "add") {
      await collectUtterance({
        entryId: dialog.entryId,
        content,
        originalText: dialog.originalText,
      });
    } else {
      await updateContent(dialog.id, content);
    }
    setDialog(null);
  };

  return (
    <div className="space-y-4">
      <p className="rounded-xl bg-[#F2F7FF] px-3.5 py-2.5 text-[12px] leading-relaxed text-[#3A6EA5]">
        Evidence には「見たこと・聞いたこと（事実）」だけを残します。解釈や看護判断は、
        後のステップで別に整理します。
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

      {/* 会話から収集 */}
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
            {collectable.map(({ item, entryId }) => (
              <li
                key={entryId}
                className="flex items-start gap-2 rounded-2xl border border-[#EBEBF0] bg-white p-3"
              >
                <Quote className="mt-0.5 h-4 w-4 shrink-0 text-[#C7C7CC]" strokeWidth={2} />
                <p className="min-w-0 flex-1 whitespace-pre-line text-[13px] leading-relaxed text-[#3A3A3C]">
                  {"text" in item ? item.text : ""}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setDialog({
                      mode: "add",
                      entryId,
                      originalText: "text" in item ? item.text : "",
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

      {/* 収集済み Evidence */}
      <section className="space-y-2">
        <h3 className="text-[12px] font-semibold text-[#6E6E73]">
          収集した Evidence（{cards.length}件）
        </h3>
        {cards.length === 0 ? (
          <p className="text-[12.5px] text-[#8E8E93]">
            まだ Evidence はありません。会話や記録から事実を集めましょう。
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
          key={dialog.mode === "add" ? `add-${dialog.entryId}` : `edit-${dialog.id}`}
          open
          mode={dialog.mode}
          originalText={dialog.originalText}
          initialContent={dialog.mode === "edit" ? dialog.initialContent : dialog.originalText}
          sourceLabel="患者との会話"
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
