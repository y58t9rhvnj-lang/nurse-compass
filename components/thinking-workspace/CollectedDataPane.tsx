import { Database } from "lucide-react";
import type { InformationCard } from "@/lib/information/informationCard";
import {
  formatDataTimestamp,
  sourceTypeLabel,
} from "@/lib/organization/informationDisplay";

// 左ペイン「収集したデータ」。
// Sprint11.1〜11.2 の Information Card store から、現在患者の保存済みデータを一覧表示する。
// 学生向け表現は「データ」。本 Sprint では表示のみ（追加・分類・並び替え・削除・編集・ジャンプは行わない）。
export default function CollectedDataPane({
  cards,
  hydrated,
}: {
  cards: InformationCard[];
  hydrated: boolean;
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
            患者との会話やカルテから、必要だと思うデータを保存してください。
          </p>
        ) : (
          <ul className="divide-y divide-[#EFEFF2]">
            {cards.map((card) => (
              <li key={card.id} className="py-3">
                <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-[#1D1D1F]">
                  {card.content}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[#8E8E93]">
                  <span className="inline-flex items-center rounded-full bg-[#F2F2F5] px-2 py-0.5 font-medium text-[#6E6E73]">
                    {sourceTypeLabel(card.sourceType)}
                  </span>
                  <span className="break-words">{card.sourceLabel}</span>
                  {(() => {
                    const ts = formatDataTimestamp(
                      card.observedAt ?? card.createdAt,
                    );
                    return ts ? <span>· {ts}</span> : null;
                  })()}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
