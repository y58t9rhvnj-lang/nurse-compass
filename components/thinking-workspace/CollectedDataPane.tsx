"use client";

import { Database, Pencil, Trash2 } from "lucide-react";
import type { InformationCard } from "@/lib/information/informationCard";
import { formatDataTimestamp } from "@/lib/organization/informationDisplay";

// 元データ（originalText）が保存内容（content）と異なる場合だけ「元データあり」を控えめに示す。
function hasDistinctOriginal(card: InformationCard): boolean {
  return (
    typeof card.originalText === "string" &&
    card.originalText.trim() !== "" &&
    card.originalText.trim() !== card.content.trim()
  );
}

// 左ペイン「収集したデータ」。
// 患者発言・一時メモから学生が明示的に収集した Information Card を一覧表示する。
// 各データは「内容を修正」「収集解除」が可能。元データ全文は常時表示しない（一覧を圧迫しない）。
export default function CollectedDataPane({
  cards,
  hydrated,
  onEdit,
  onRelease,
}: {
  cards: InformationCard[];
  hydrated: boolean;
  onEdit?: (card: InformationCard) => void;
  onRelease?: (card: InformationCard) => void;
}) {
  return (
    <section className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-2 px-4 pt-4 pb-2">
        <Database className="h-4 w-4 text-[#0A84FF]" strokeWidth={1.75} />
        <h2 className="text-[14px] font-bold text-[#1D1D1F]">収集したデータ</h2>
        {hydrated && cards.length > 0 && (
          <span className="ml-auto rounded-full bg-[#EAF3FF] px-2 py-0.5 text-[11px] font-semibold text-[#0A6CD6]">
            {cards.length}件
          </span>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {!hydrated ? (
          <p className="rounded-2xl border border-dashed border-[#E0E0E5] bg-[#FAFAFC] px-4 py-6 text-center text-[12px] text-[#AEAEB5]">
            データを読み込み中…
          </p>
        ) : cards.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[#E0E0E5] bg-[#FAFAFC] px-4 py-6 text-center text-[12px] leading-relaxed text-[#8E8E93]">
            まだ収集したデータがありません。
            <br />
            患者との会話や一時メモから、残しておきたいデータを収集してください。
          </p>
        ) : (
          <ul className="divide-y divide-[#EFEFF2]">
            {cards.map((card) => (
              <li key={card.id} className="py-3">
                <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-[#1D1D1F]">
                  {card.content}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[#8E8E93]">
                  <span className="break-words">{card.sourceLabel}</span>
                  {(() => {
                    const ts = formatDataTimestamp(
                      card.observedAt ?? card.createdAt,
                    );
                    return ts ? <span>· {ts}</span> : null;
                  })()}
                  {hasDistinctOriginal(card) && (
                    <span className="inline-flex items-center rounded-full bg-[#F2F2F5] px-2 py-0.5 font-medium text-[#8E8E93]">
                      元データあり
                    </span>
                  )}
                </div>

                {(onEdit || onRelease) && (
                  <div className="mt-1.5 flex items-center gap-1">
                    {onEdit && (
                      <button
                        type="button"
                        onClick={() => onEdit(card)}
                        aria-label="この収集データの内容を修正する"
                        className="inline-flex min-h-[44px] items-center gap-1 rounded-lg px-2 text-[11px] font-medium text-[#6E6E73] transition hover:bg-[#F2F2F5] hover:text-[#0A84FF]"
                      >
                        <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                        内容を修正
                      </button>
                    )}
                    {onRelease && (
                      <button
                        type="button"
                        onClick={() => onRelease(card)}
                        aria-label="この収集データを収集解除する"
                        className="inline-flex min-h-[44px] items-center gap-1 rounded-lg px-2 text-[11px] font-medium text-[#6E6E73] transition hover:bg-[#FFECEC] hover:text-[#FF3B30]"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                        収集解除
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
