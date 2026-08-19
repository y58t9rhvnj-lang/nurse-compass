"use client";

import Form3AssessmentCardEditor from "@/components/v2/form3/Form3AssessmentCardEditor";
import type { Form3Judgment, Form3PatternKey } from "@/lib/form3/form3Types";
import type {
  Form3AssessmentCardV2,
  Form3InformationCardV2,
} from "@/lib/form3/v2/form3V2Types";

export type Form3AssessmentCardListProps = {
  cards: Form3AssessmentCardV2[];
  informationOptions: Form3InformationCardV2[];
  showArchived: boolean;
  onToggleShowArchived: () => void;
  onAdd: () => void;
  onPatch: (
    cardId: string,
    patch: {
      interpretation?: string;
      classification?: Form3Judgment | null;
      evidenceInformationIds?: string[];
      needMoreInformation?: string;
      patternKey?: Form3PatternKey | null;
    },
  ) => void;
  onArchive: (cardId: string) => void;
  onUnarchive: (cardId: string) => void;
  emptyTitle?: string;
  emptyBody?: string;
};

export default function Form3AssessmentCardList({
  cards,
  informationOptions,
  showArchived,
  onToggleShowArchived,
  onAdd,
  onPatch,
  onArchive,
  onUnarchive,
  emptyTitle = "まだ解釈がありません",
  emptyBody = "Information を見ながら、「＋ Assessment」で解釈を追加してください。",
}: Form3AssessmentCardListProps) {
  const visible = showArchived
    ? cards
    : cards.filter((c) => c.status !== "archived");
  const empty = visible.length === 0;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-28 pt-4 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[22px] font-semibold tracking-tight text-[#1D1D1F]">
            Assessment
          </h2>
          <p className="mt-1 text-[15px] leading-relaxed text-[#6E6E73]">
            Information を根拠に、1カードに1つの解釈を書きます。
          </p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="min-h-[48px] rounded-2xl bg-[#0A6CD6] px-5 text-[16px] font-semibold text-white"
        >
          ＋ Assessment
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
            {emptyTitle}
          </p>
          <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-[#6E6E73]">
            {emptyBody}
          </p>
          <button
            type="button"
            onClick={onAdd}
            className="mt-8 min-h-[48px] rounded-2xl bg-[#0A6CD6] px-6 text-[16px] font-semibold text-white"
          >
            ＋ Assessment
          </button>
        </div>
      ) : (
        <ul className="mt-8 flex flex-col gap-6">
          {visible.map((card, i) => (
            <li key={card.id}>
              <Form3AssessmentCardEditor
                card={card}
                indexLabel={i + 1}
                informationOptions={informationOptions}
                onChange={(patch) => onPatch(card.id, patch)}
                onArchive={() => onArchive(card.id)}
                onUnarchive={() => onUnarchive(card.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
