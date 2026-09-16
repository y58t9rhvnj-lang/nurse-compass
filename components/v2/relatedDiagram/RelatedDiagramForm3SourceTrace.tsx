"use client";

import { useState } from "react";
import type { RelatedDiagramCardState } from "@/lib/v2/relatedDiagram/types";

function cardStateLabel(state: RelatedDiagramCardState): string {
  return state === "current" ? "顕在" : "潜在";
}

export default function RelatedDiagramForm3SourceTrace({
  originLabel,
  patternName,
  soType,
  cardState,
  selectedText,
  cardText,
  canDelete,
  deleteBlockedReason,
  onOpenSource,
  onDelete,
}: {
  originLabel: string;
  patternName: string | null;
  soType?: "S" | "O" | null;
  cardState?: RelatedDiagramCardState | null;
  selectedText?: string | null;
  cardText?: string | null;
  canDelete: boolean;
  deleteBlockedReason?: string | null;
  onOpenSource: () => void;
  onDelete: () => void;
}) {
  const [detailOpen, setDetailOpen] = useState(false);
  const showState = cardState === "current" || cardState === "potential";
  const showQuoteDetail =
    selectedText != null && selectedText.length > 0;

  return (
    <div
      data-rd-form3-source-trace
      className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[#E5E5EA] bg-white px-3 py-2"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <p className="min-w-0 flex-1 text-[13px] text-[#1D1D1F]">
        <span className="font-medium">{originLabel}</span>
        {soType ? ` · ${soType}` : ""}
        {patternName ? ` · ${patternName}` : ""}
        {showState ? ` · 状態：${cardStateLabel(cardState)}` : ""}
      </p>
      <button
        type="button"
        data-rd-form3-open-source
        onClick={onOpenSource}
        className="inline-flex min-h-[44px] items-center rounded-lg border border-[#E5E5EA] px-3 text-[13px] text-[#0A5FCC]"
      >
        元の様式3を見る
      </button>
      <button
        type="button"
        data-rd-form3-delete
        disabled={!canDelete}
        title={deleteBlockedReason ?? undefined}
        onClick={onDelete}
        className="inline-flex min-h-[44px] items-center rounded-lg border border-[#E5E5EA] px-3 text-[13px] text-[#1D1D1F] disabled:opacity-40"
      >
        削除
      </button>
      {showQuoteDetail ? (
        <button
          type="button"
          data-rd-form3-source-detail-toggle
          aria-expanded={detailOpen}
          onClick={() => setDetailOpen((open) => !open)}
          className="inline-flex min-h-[44px] items-center rounded-lg border border-[#E5E5EA] px-3 text-[13px] text-[#1D1D1F]"
        >
          詳細
        </button>
      ) : null}
      {deleteBlockedReason ? (
        <p className="basis-full text-[12px] text-[#6E6E73]">
          {deleteBlockedReason}
        </p>
      ) : null}
      {showQuoteDetail && detailOpen ? (
        <div
          data-rd-form3-source-detail
          className="basis-full space-y-2 text-[13px] text-[#1D1D1F]"
        >
          <p>
            <span className="text-[#6E6E73]">引用：</span>
            「{selectedText}」
          </p>
          <p>
            <span className="text-[#6E6E73]">カード：</span>
            「{cardText ?? ""}」
          </p>
        </div>
      ) : null}
    </div>
  );
}
