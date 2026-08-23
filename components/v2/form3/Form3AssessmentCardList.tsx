"use client";

// 解釈・分析・援助の必要性 大枠: Assessment カード正本を文章表示。
// Evidence は ID 参照のまま小さく補足。Dialog で追加・編集。

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import ConfirmDialog from "@/components/collection/ConfirmDialog";
import Form3AssessmentDialog, {
  type Form3AssessmentDialogValues,
} from "@/components/v2/form3/Form3AssessmentDialog";
import {
  lockForm3RightPaneScroll,
  unlockForm3RightPaneScroll,
} from "@/components/v2/form3/form3RightPaneScroll";
import type {
  Form3AssessmentCardV2,
  Form3InformationCardV2,
} from "@/lib/form3/v2/form3V2Types";

export type Form3AssessmentCardListProps = {
  cards: Form3AssessmentCardV2[];
  informationOptions: Form3InformationCardV2[];
  informationLookup: Form3InformationCardV2[];
  onAdd: (values: Form3AssessmentDialogValues) => void;
  onPatch: (
    cardId: string,
    patch: {
      interpretation?: string;
      evidenceInformationIds?: string[];
    },
  ) => void;
  onArchive: (cardId: string) => void;
  onDialogOpenChange?: (open: boolean) => void;
};

export default function Form3AssessmentCardList({
  cards,
  informationOptions,
  informationLookup,
  onAdd,
  onPatch,
  onArchive,
  onDialogOpenChange,
}: Form3AssessmentCardListProps) {
  const visible = cards.filter((c) => c.status !== "archived");
  const empty = visible.length === 0;
  const byId = useMemo(() => {
    const map = new Map<string, Form3InformationCardV2>();
    for (const c of informationLookup) map.set(c.id, c);
    return map;
  }, [informationLookup]);

  const [dialog, setDialog] = useState<
    | { mode: "add" }
    | { mode: "edit"; card: Form3AssessmentCardV2 }
    | null
  >(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const pendingScrollRef = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!pendingScrollRef.current) return;
    pendingScrollRef.current = false;
    const last = listRef.current?.querySelector(
      "[data-form3-assess-card]:last-of-type",
    );
    last?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [visible.length]);

  function setDialogOpen(
    next:
      | { mode: "add" }
      | { mode: "edit"; card: Form3AssessmentCardV2 }
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
      aria-label="解釈・分析・援助の必要性"
      className="rounded-[16px] bg-white ring-1 ring-[#E5E5EA]"
    >
      <div className="flex items-center justify-between gap-3 border-b border-[#EFEFF4] px-4 py-3 sm:px-5">
        <h2 className="text-[15px] font-semibold tracking-tight text-[#1D1D1F]">
          解釈・分析・援助の必要性
        </h2>
        <button
          type="button"
          onClick={() => setDialogOpen({ mode: "add" })}
          className="inline-flex min-h-[36px] items-center gap-1 rounded-full px-2.5 text-[13px] font-semibold text-[#1E88E5] hover:bg-[#EAF4FC]"
        >
          <Plus className="h-4 w-4" strokeWidth={2.25} aria-hidden />
          解釈・分析を追加
        </button>
      </div>

      <div className="px-4 py-3 sm:px-5 sm:py-4">
        {empty ? (
          <div className="py-6 text-center">
            <p className="text-[14px] text-[#6E6E73]">
              解釈・分析はまだありません
            </p>
            <button
              type="button"
              onClick={() => setDialogOpen({ mode: "add" })}
              className="mt-3 inline-flex min-h-[40px] items-center gap-1 rounded-full bg-[#1E88E5] px-4 text-[13px] font-semibold text-white"
            >
              <Plus className="h-4 w-4" strokeWidth={2.25} aria-hidden />
              解釈・分析を追加
            </button>
          </div>
        ) : (
          <div ref={listRef} className="flex flex-col">
            {visible.map((card, index) => {
              const evidence = card.evidenceInformationIds
                .map((id) => byId.get(id))
                .filter(Boolean) as Form3InformationCardV2[];
              return (
                <div
                  key={card.id}
                  data-form3-assess-card=""
                  className={
                    index > 0
                      ? "mt-4 border-t border-[#E5E5EA] pt-4"
                      : undefined
                  }
                >
                  <div className="group flex items-start gap-2">
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => setDialogOpen({ mode: "edit", card })}
                    >
                      <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-[#1D1D1F]">
                        {card.interpretation.trim() || "（未入力）"}
                      </p>
                      {evidence.length > 0 ? (
                        <p className="mt-2 text-[12px] leading-snug text-[#8E8E93]">
                          根拠:{" "}
                          {evidence
                            .map((info) => {
                              const p =
                                info.soType === "O"
                                  ? "O"
                                  : info.soType === "S"
                                    ? "S"
                                    : "—";
                              const t = info.content.trim() || "（未入力）";
                              const short =
                                t.length > 40 ? `${t.slice(0, 40)}…` : t;
                              return `${p}「${short}」`;
                            })
                            .join("　")}
                        </p>
                      ) : null}
                    </button>
                    <div className="flex shrink-0 items-center gap-0.5 opacity-70 group-hover:opacity-100">
                      <button
                        type="button"
                        className="inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg text-[#667085] hover:bg-[#F7F7F8]"
                        aria-label="解釈・分析を編集"
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
                        className="inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg text-[#C0392B] hover:bg-[#F7F7F8]"
                        aria-label="解釈・分析を削除"
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
                </div>
              );
            })}
          </div>
        )}
      </div>

      {dialog ? (
        <Form3AssessmentDialog
          key={
            dialog.mode === "edit" ? `edit-${dialog.card.id}` : "add-assess"
          }
          open
          mode={dialog.mode}
          informationOptions={informationOptions}
          initial={
            dialog.mode === "edit"
              ? {
                  evidenceInformationIds: dialog.card.evidenceInformationIds,
                  interpretation: dialog.card.interpretation,
                }
              : null
          }
          onClose={() => setDialogOpen(null)}
          onSubmit={(values) => {
            if (dialog.mode === "edit") {
              onPatch(dialog.card.id, {
                interpretation: values.interpretation,
                evidenceInformationIds: values.evidenceInformationIds,
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
        title="この解釈・分析を削除しますか？"
        description="削除した解釈・分析はアーカイブされます。他のカードには影響しません。Evidence ID 参照はカードごと保持／削除されます。"
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
