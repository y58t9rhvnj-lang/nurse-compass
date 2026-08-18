"use client";

import {
  FORM3_CLASSIFICATION_LABELS,
  form3PatternShortLabel,
} from "@/components/v2/form3/form3PhaseBLabels";
import type {
  Form3AssessmentCardV2,
  Form3InformationCardV2,
} from "@/lib/form3/v2/form3V2Types";

export type Form3FinalReferencePanelProps = {
  informationCards: Form3InformationCardV2[];
  assessmentCards: Form3AssessmentCardV2[];
  className?: string;
};

/**
 * Final Form 用の Workspace 参照（読取専用）。
 * クリックしても本文は転記しない。
 */
export default function Form3FinalReferencePanel({
  informationCards,
  assessmentCards,
  className = "",
}: Form3FinalReferencePanelProps) {
  const infos = informationCards.filter((c) => c.status === "active");
  const assesses = assessmentCards.filter((c) => c.status !== "archived");

  return (
    <div className={`flex h-full min-h-0 flex-col bg-[#F8F8FA] ${className}`}>
      <div className="shrink-0 border-b border-[#E5E5EA] bg-white px-4 py-4">
        <p className="text-[11px] font-medium tracking-wide text-[#8E8E93]">
          Workspace 参照
        </p>
        <h2 className="mt-1 text-[18px] font-semibold tracking-tight text-[#1D1D1F]">
          Information / Assessment
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-[#6E6E73]">
          参照のみです。タップしても Final へ転記・コピーしません。自分の言葉で書いてください。
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        <section className="mb-6">
          <h3 className="text-[15px] font-semibold text-[#1D1D1F]">
            Information
          </h3>
          {infos.length === 0 ? (
            <p className="mt-3 text-[14px] text-[#8E8E93]">まだありません。</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {infos.map((card, i) => (
                <li
                  key={card.id}
                  className="rounded-2xl bg-white px-3 py-3 ring-1 ring-[#E5E5EA]"
                >
                  <p className="text-[12px] font-medium text-[#8E8E93]">
                    事実 {i + 1}
                    {card.soType ? ` · ${card.soType}` : ""}
                    {card.patternKeys.length > 0
                      ? ` · ${card.patternKeys.map(form3PatternShortLabel).join(" / ")}`
                      : ""}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-[14px] leading-relaxed text-[#1D1D1F]">
                    {card.content.trim() || "（未入力）"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3 className="text-[15px] font-semibold text-[#1D1D1F]">
            Assessment
          </h3>
          {assesses.length === 0 ? (
            <p className="mt-3 text-[14px] text-[#8E8E93]">まだありません。</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {assesses.map((card, i) => (
                <li
                  key={card.id}
                  className="rounded-2xl bg-white px-3 py-3 ring-1 ring-[#E5E5EA]"
                >
                  <p className="text-[12px] font-medium text-[#8E8E93]">
                    Assessment {i + 1}
                    {card.classification
                      ? ` · ${FORM3_CLASSIFICATION_LABELS[card.classification]}`
                      : ""}
                    {card.patternKey
                      ? ` · ${form3PatternShortLabel(card.patternKey)}`
                      : ""}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-[14px] leading-relaxed text-[#1D1D1F]">
                    {card.interpretation.trim() || "（未入力）"}
                  </p>
                  <p className="mt-2 text-[12px] text-[#8E8E93]">
                    Evidence: {card.evidenceInformationIds.length}件
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
