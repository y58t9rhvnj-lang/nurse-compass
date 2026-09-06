"use client";

// 情報（S・O）大枠: カード正本を文章形式で表示。Dialog で追加・編集。
// 個別の白い箱カードは並べない。タグ・日付・ソースは表示しない。

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import ConfirmDialog from "@/components/collection/ConfirmDialog";
import Form3InformationDialog, {
  type Form3InformationDialogValues,
} from "@/components/v2/form3/Form3InformationDialog";
import { FORM3_PHASE_B_INFORMATION_HELPER } from "@/components/v2/form3/form3PhaseBEducationCopy";
import {
  lockForm3RightPaneScroll,
  unlockForm3RightPaneScroll,
} from "@/components/v2/form3/form3RightPaneScroll";
import type {
  Form3InformationCardV2,
  Form3SoType,
} from "@/lib/form3/v2/form3V2Types";

export type Form3InformationCardListProps = {
  cards: Form3InformationCardV2[];
  onAdd: (values: Form3InformationDialogValues) => void;
  onPatch: (
    cardId: string,
    patch: {
      content?: string;
      soType?: Form3SoType | null;
    },
  ) => void;
  onArchive: (cardId: string) => void;
  onDialogOpenChange?: (open: boolean) => void;
};

function soPrefix(soType: Form3SoType | null): string {
  if (soType === "O") return "O";
  if (soType === "S") return "S";
  return "—";
}

export default function Form3InformationCardList({
  cards,
  onAdd,
  onPatch,
  onArchive,
  onDialogOpenChange,
}: Form3InformationCardListProps) {
  const visible = cards.filter((c) => c.status === "active");
  const empty = visible.length === 0;

  const [dialog, setDialog] = useState<
    | { mode: "add" }
    | { mode: "edit"; card: Form3InformationCardV2 }
    | null
  >(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const pendingScrollRef = useRef(false);
  const listRef = useRef<HTMLUListElement>(null);

  useLayoutEffect(() => {
    if (!pendingScrollRef.current) return;
    pendingScrollRef.current = false;
    const last = listRef.current?.querySelector(
      "[data-form3-info-card]:last-of-type",
    );
    last?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [visible.length]);

  function setDialogOpen(
    next:
      | { mode: "add" }
      | { mode: "edit"; card: Form3InformationCardV2 }
      | null,
  ) {
    setDialog(next);
    onDialogOpenChange?.(next !== null || pendingDeleteId !== null);
  }

  function setDeleteId(id: string | null) {
    if (id) lockForm3RightPaneScroll();
    else unlockForm3RightPaneScroll();
    setPendingDeleteId(id);
    onDialogOpenChange?.(dialog !== null || id !== null);
  }

  return (
    <section
      aria-label="情報（S・O）"
      className="rounded-[16px] bg-white ring-1 ring-[#E5E5EA]"
    >
      <div className="flex items-center justify-between gap-3 border-b border-[#EFEFF4] px-4 py-3 sm:px-5">
        <h2 className="text-[15px] font-semibold tracking-tight text-[#1D1D1F]">
          情報（S・O）
        </h2>
        <button
          type="button"
          onClick={() => setDialogOpen({ mode: "add" })}
          className="inline-flex min-h-[36px] items-center gap-1 rounded-full px-2.5 text-[13px] font-semibold text-[#1E88E5] hover:bg-[#EAF4FC]"
        >
          <Plus className="h-4 w-4" strokeWidth={2.25} aria-hidden />
          情報を追加
        </button>
      </div>

      <p className="border-b border-[#EFEFF4] px-4 py-2 text-[12px] leading-relaxed text-[#6E6E73] sm:px-5">
        {FORM3_PHASE_B_INFORMATION_HELPER}
      </p>

      <div className="px-4 py-3 sm:px-5 sm:py-4">
        {empty ? (
          <div className="py-6 text-center">
            <p className="text-[14px] text-[#6E6E73]">
              このパターンの情報はまだありません
            </p>
            <button
              type="button"
              onClick={() => setDialogOpen({ mode: "add" })}
              className="mt-3 inline-flex min-h-[40px] items-center gap-1 rounded-full bg-[#1E88E5] px-4 text-[13px] font-semibold text-white"
            >
              <Plus className="h-4 w-4" strokeWidth={2.25} aria-hidden />
              情報を追加
            </button>
          </div>
        ) : (
          <ul ref={listRef} className="flex flex-col gap-1">
            {visible.map((card) => (
              <li key={card.id} data-form3-info-card="">
                <div className="group flex items-start gap-2 rounded-lg px-1 py-1.5 hover:bg-[#F7F7F8]/80">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => setDialogOpen({ mode: "edit", card })}
                  >
                    <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-[#1D1D1F]">
                      <span className="font-semibold text-[#1D1D1F]">
                        {soPrefix(card.soType)}：
                      </span>
                      {card.content.trim() || "（未入力）"}
                    </p>
                  </button>
                  <div className="flex shrink-0 items-center gap-0.5 opacity-70 group-hover:opacity-100">
                    <button
                      type="button"
                      className="inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg text-[#667085] hover:bg-white"
                      aria-label="情報を編集"
                      onClick={() => setDialogOpen({ mode: "edit", card })}
                    >
                      <Pencil
                        className="h-3.5 w-3.5"
                        strokeWidth={1.9}
                        aria-hidden
                      />
                    </button>
                    <button
                      type="button"
                      className="inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg text-[#C0392B] hover:bg-white"
                      aria-label="情報を削除"
                      onClick={() => setDeleteId(card.id)}
                    >
                      <Trash2
                        className="h-3.5 w-3.5"
                        strokeWidth={1.9}
                        aria-hidden
                      />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {dialog ? (
        <Form3InformationDialog
          key={
            dialog.mode === "edit" ? `edit-${dialog.card.id}` : "add-info"
          }
          open
          mode={dialog.mode}
          initial={
            dialog.mode === "edit"
              ? {
                  soType: dialog.card.soType === "O" ? "O" : "S",
                  content: dialog.card.content,
                }
              : null
          }
          onClose={() => setDialogOpen(null)}
          onSubmit={(values) => {
            if (dialog.mode === "edit") {
              onPatch(dialog.card.id, {
                content: values.content,
                soType: values.soType,
              });
            } else {
              pendingScrollRef.current = true;
              onAdd(values);
            }
            setDialogOpen(null);
          }}
        />
      ) : null}

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="この情報を削除しますか？"
        description="削除した情報はアーカイブされます。解釈・分析の根拠として参照されている場合も、既存の参照はそのまま残ります。"
        confirmLabel="削除"
        destructive
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (pendingDeleteId) onArchive(pendingDeleteId);
          setDeleteId(null);
        }}
      />
    </section>
  );
}
