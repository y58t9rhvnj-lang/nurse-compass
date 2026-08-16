"use client";

import Form3InformationCardEditor from "@/components/v2/form3/Form3InformationCardEditor";
import type { Form3PatternKey } from "@/lib/form3/form3Types";
import type {
  Form3InformationCardV2,
  Form3InformationSourceType,
  Form3SoType,
} from "@/lib/form3/v2/form3V2Types";

export type Form3InformationCardListProps = {
  cards: Form3InformationCardV2[];
  showArchived: boolean;
  onToggleShowArchived: () => void;
  onAdd: () => void;
  onPatch: (
    cardId: string,
    patch: {
      content?: string;
      soType?: Form3SoType | null;
      sourceType?: Form3InformationSourceType;
      patternKeys?: Form3PatternKey[];
    },
  ) => void;
  onArchive: (cardId: string) => void;
  onUnarchive: (cardId: string) => void;
  onMoveUp: (cardId: string) => void;
  onMoveDown: (cardId: string) => void;
};

export default function Form3InformationCardList({
  cards,
  showArchived,
  onToggleShowArchived,
  onAdd,
  onPatch,
  onArchive,
  onUnarchive,
  onMoveUp,
  onMoveDown,
}: Form3InformationCardListProps) {
  const visible = showArchived
    ? cards
    : cards.filter((c) => c.status === "active");
  const empty = visible.length === 0;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-28 pt-4 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[22px] font-semibold tracking-tight text-[#1D1D1F]">
            Information
          </h2>
          <p className="mt-1 text-[15px] leading-relaxed text-[#6E6E73]">
            患者から得た事実を、1カードに1つずつ残します。
          </p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="min-h-[48px] rounded-2xl bg-[#0A6CD6] px-5 text-[16px] font-semibold text-white"
        >
          ＋ Information
        </button>
      </div>

      <div className="mt-4">
        <label className="inline-flex min-h-[44px] items-center gap-2 text-[14px] text-[#6E6E73]">
          <input
            type="checkbox"
            className="h-5 w-5 rounded border-[#C7C7CC]"
            checked={showArchived}
            onChange={onToggleShowArchived}
          />
          アーカイブも表示
        </label>
      </div>

      {empty ? (
        <div className="mt-10 rounded-3xl bg-white px-6 py-14 text-center ring-1 ring-[#E5E5EA]">
          <p className="text-[18px] font-semibold text-[#1D1D1F]">
            まだ事実がありません
          </p>
          <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-[#6E6E73]">
            「＋ Information」から、会話・観察・記録で得たひとつの事実を追加してください。
          </p>
          <button
            type="button"
            onClick={onAdd}
            className="mt-8 min-h-[48px] rounded-2xl bg-[#0A6CD6] px-6 text-[16px] font-semibold text-white"
          >
            ＋ Information
          </button>
        </div>
      ) : (
        <ul className="mt-8 flex flex-col gap-6">
          {visible.map((card, i) => (
            <li key={card.id}>
              <Form3InformationCardEditor
                card={card}
                indexLabel={i + 1}
                totalVisible={visible.length}
                onChange={(patch) => onPatch(card.id, patch)}
                onArchive={() => onArchive(card.id)}
                onUnarchive={() => onUnarchive(card.id)}
                onMoveUp={() => onMoveUp(card.id)}
                onMoveDown={() => onMoveDown(card.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
