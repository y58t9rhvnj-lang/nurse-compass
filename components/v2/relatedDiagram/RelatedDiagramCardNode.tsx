"use client";

import type { RelatedDiagramCard } from "@/lib/v2/relatedDiagram/types";
import { A3_BODY_PT } from "@/lib/v2/relatedDiagram/a3Canvas";
import { resolveCardBorderVisual } from "@/lib/v2/relatedDiagram/visualStyle";

export default function RelatedDiagramCardNode({
  card,
}: {
  card: RelatedDiagramCard;
}) {
  const visual = resolveCardBorderVisual(card.cardType, card.state);
  const { x, y, width, height } = card.layout;
  const isKnowledge = card.cardType === "knowledge";

  return (
    <div
      data-rd-card-id={card.id}
      data-rd-card-type={card.cardType}
      data-rd-card-state={card.state ?? "none"}
      className="absolute box-border overflow-hidden rounded-[2px]"
      style={{
        left: x,
        top: y,
        width,
        height,
        zIndex: card.layout.zIndex + 2,
        background: visual.background,
        borderStyle: visual.borderStyle,
        borderWidth: `${visual.borderWidthPx}px`,
        borderColor: visual.borderColor,
        padding: isKnowledge ? "5px 7px" : "6px 8px",
        fontSize: `${A3_BODY_PT}pt`,
        lineHeight: 1.35,
        color: "#1D1D1F",
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Noto Sans JP', sans-serif",
      }}
    >
      {visual.showByotaiLabel ? (
        <span
          className="mb-0.5 inline-block rounded-[2px] px-1 text-[8pt] font-medium tracking-wide text-[#6E6E73]"
          style={{ border: "1px solid #C7C7CC" }}
        >
          病態
        </span>
      ) : null}
      {visual.showNursingProblemLabel ? (
        <span className="mb-0.5 block text-[8pt] font-semibold text-[#0A5FCC]">
          看護問題
        </span>
      ) : null}
      <div className="whitespace-pre-wrap break-words">{card.text}</div>
    </div>
  );
}
