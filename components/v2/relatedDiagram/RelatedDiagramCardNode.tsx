"use client";

import type { PointerEvent as ReactPointerEvent } from "react";
import type { RelatedDiagramCard } from "@/lib/v2/relatedDiagram/types";
import { A3_BODY_PT } from "@/lib/v2/relatedDiagram/a3Canvas";
import { isCardLayoutMovable } from "@/lib/v2/relatedDiagram/cardInteractionState";
import { formatNursingProblemPriorityBadge } from "@/lib/v2/relatedDiagram/nursingProblemPriority";
import { resolveCardBorderVisual } from "@/lib/v2/relatedDiagram/visualStyle";

export default function RelatedDiagramCardNode({
  card,
  selected = false,
  connectRole = null,
  interactive = false,
  priority = null,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  card: RelatedDiagramCard;
  selected?: boolean;
  connectRole?: "source" | "target" | null;
  interactive?: boolean;
  priority?: number | null;
  onPointerDown?: (
    card: RelatedDiagramCard,
    event: ReactPointerEvent<HTMLElement>,
  ) => void;
  onPointerMove?: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp?: (event: ReactPointerEvent<HTMLElement>) => void;
}) {
  const visual = resolveCardBorderVisual(card.cardType, card.state);
  const { x, y, width, height } = card.layout;
  const isKnowledge = card.cardType === "knowledge";
  const movable = isCardLayoutMovable(card);
  const priorityBadge =
    card.cardType === "nursing_problem"
      ? formatNursingProblemPriorityBadge(priority)
      : null;

  return (
    <div
      data-rd-card-id={card.id}
      data-rd-card-type={card.cardType}
      data-rd-card-state={card.state ?? "none"}
      data-rd-selected={selected ? "true" : undefined}
      data-rd-connect-role={connectRole ?? undefined}
      aria-selected={selected}
      data-rd-movable={movable ? "true" : "false"}
      className="absolute box-border rounded-[2px]"
      style={{
        left: x,
        top: y,
        width,
        height,
        zIndex: card.layout.zIndex + 2 + (selected ? 24 : 0),
        outline: selected ? "2px solid #8E8E93" : "none",
        outlineOffset: 2,
        boxShadow: selected ? "0 2px 8px rgba(0,0,0,0.10)" : undefined,
        touchAction: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
        cursor: interactive ? (movable ? "grab" : "default") : "default",
      }}
      draggable={false}
      onDragStart={
        interactive
          ? (event) => {
              event.preventDefault();
            }
          : undefined
      }
      onPointerDown={
        interactive && onPointerDown
          ? (event) => onPointerDown(card, event)
          : undefined
      }
      onPointerMove={interactive ? onPointerMove : undefined}
      onPointerUp={interactive ? onPointerUp : undefined}
      onPointerCancel={interactive ? onPointerUp : undefined}
    >
      <div
        className="h-full w-full overflow-hidden rounded-[2px]"
        style={{
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
      {priorityBadge ? (
        <span
          data-rd-np-priority-badge
          data-rd-np-priority={priority}
          className="pointer-events-none absolute right-[5px] top-[4px] text-[8pt] font-semibold leading-none text-[#0A5FCC]"
        >
          {priorityBadge}
        </span>
      ) : null}
    </div>
  );
}
