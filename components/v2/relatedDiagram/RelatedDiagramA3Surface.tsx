"use client";

import type { PointerEvent as ReactPointerEvent } from "react";
import type { StableRouteState } from "@/lib/v2/relatedDiagram/incrementalRoutes";
import type { RelatedDiagramRouteTopology } from "@/lib/v2/relatedDiagram/routeTopology";
import type {
  RelatedDiagramCard,
  RelatedDiagramSemanticGraph,
} from "@/lib/v2/relatedDiagram/types";
import {
  A3_HEIGHT_MM,
  A3_HEIGHT_PX,
  A3_WIDTH_MM,
  A3_WIDTH_PX,
} from "@/lib/v2/relatedDiagram/a3Canvas";
import {
  knowledgeGroupBounds,
  knowledgeGroupHandleBounds,
} from "@/lib/v2/relatedDiagram/knowledgeGroupLayout";
import RelatedDiagramCardNode from "./RelatedDiagramCardNode";
import RelatedDiagramConnectionLayer from "./RelatedDiagramConnectionLayer";
import RelatedDiagramLegend from "./RelatedDiagramLegend";
import RelatedDiagramRouteDebugOverlay from "./RelatedDiagramRouteDebugOverlay";

/**
 * Logical A3 landscape paper. Positions are in A3_PX units (≈96dpi).
 * Print uses mm page size; screen uses same aspect via px dimensions.
 */
export default function RelatedDiagramA3Surface({
  graph,
  knowledgeLabel,
  routeTopology,
  interactive = false,
  selectedCardId = null,
  connectSourceCardId = null,
  connectTargetCardId = null,
  selectedGroup = false,
  previewCardId = null,
  onCardPointerDown,
  onCardPointerMove,
  onCardPointerUp,
  onGroupHandlePointerDown,
  onSurfacePointerDown,
  routeDebug = false,
  routeCost = false,
  stableRouteState,
}: {
  graph: RelatedDiagramSemanticGraph;
  knowledgeLabel?: string | null;
  routeTopology?: RelatedDiagramRouteTopology;
  stableRouteState?: StableRouteState;
  interactive?: boolean;
  selectedCardId?: string | null;
  connectSourceCardId?: string | null;
  connectTargetCardId?: string | null;
  selectedGroup?: boolean;
  previewCardId?: string | null;
  onCardPointerDown?: (
    card: RelatedDiagramCard,
    event: ReactPointerEvent<HTMLElement>,
  ) => void;
  onCardPointerMove?: (event: ReactPointerEvent<HTMLElement>) => void;
  onCardPointerUp?: (event: ReactPointerEvent<HTMLElement>) => void;
  onGroupHandlePointerDown?: (event: ReactPointerEvent<HTMLElement>) => void;
  onSurfacePointerDown?: (event: ReactPointerEvent<HTMLElement>) => void;
  /** DEV query-param overlay only. Never on in production student UI. */
  routeDebug?: boolean;
  routeCost?: boolean;
}) {
  const knowledgeBbox = interactive ? knowledgeGroupBounds(graph.cards) : null;
  const handleBounds = knowledgeBbox
    ? knowledgeGroupHandleBounds(knowledgeBbox)
    : null;

  return (
    <div
      data-rd-a3-surface
      className="rd-a3-surface relative bg-white text-[#1D1D1F] shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
      style={{
        width: A3_WIDTH_PX,
        height: A3_HEIGHT_PX,
        // CSS mm for print alignment (overridden in @media print)
        ["--rd-a3-w" as string]: `${A3_WIDTH_MM}mm`,
        ["--rd-a3-h" as string]: `${A3_HEIGHT_MM}mm`,
        boxSizing: "border-box",
        overflow: "visible",
        border: "1px solid #C7C7CC",
        outline: "1px dashed #AEAEB2",
        outlineOffset: "-10px",
      }}
      onPointerDown={interactive ? onSurfacePointerDown : undefined}
    >
      <div className="pointer-events-none absolute left-3 top-2 z-10 text-[9pt] text-[#8E8E93]">
        A3 よこ（論理キャンバス）
        {knowledgeLabel ? ` · ${knowledgeLabel}` : null}
      </div>
      <RelatedDiagramConnectionLayer
        cards={graph.cards}
        connections={graph.connections}
        width={A3_WIDTH_PX}
        height={A3_HEIGHT_PX}
        routeTopology={routeTopology}
        previewCardId={previewCardId}
        stableRouteState={stableRouteState}
      />
      {routeDebug || routeCost ? (
        <RelatedDiagramRouteDebugOverlay
          cards={graph.cards}
          connections={graph.connections}
          width={A3_WIDTH_PX}
          height={A3_HEIGHT_PX}
          routeTopology={routeTopology}
          stableRouteState={stableRouteState}
          routeCost={routeCost}
        />
      ) : null}
      {selectedGroup && knowledgeBbox ? (
        <div
          data-rd-knowledge-group-outline
          className="pointer-events-none absolute"
          style={{
            left: knowledgeBbox.x,
            top: knowledgeBbox.y,
            width: knowledgeBbox.width,
            height: knowledgeBbox.height,
            outline: "2px solid #8E8E93",
            outlineOffset: 4,
          }}
        />
      ) : null}
      {interactive && handleBounds ? (
        <div
          data-rd-knowledge-group-handle
          role="button"
          tabIndex={0}
          className="absolute box-border select-none rounded-[2px] text-center text-[8pt] font-medium tracking-wide text-[#6E6E73]"
          style={{
            left: handleBounds.x,
            top: handleBounds.y,
            width: handleBounds.width,
            height: handleBounds.height,
            lineHeight: `${handleBounds.height}px`,
            border: "1px solid #8E8E93",
            background: "#F5F5F7",
            touchAction: "none",
            userSelect: "none",
            WebkitUserSelect: "none",
            cursor: "grab",
            zIndex: 40,
          }}
          onPointerDown={onGroupHandlePointerDown}
          onPointerMove={onCardPointerMove}
          onPointerUp={onCardPointerUp}
          onPointerCancel={onCardPointerUp}
        >
          病態
        </div>
      ) : null}
      {graph.cards.map((card) => (
        <RelatedDiagramCardNode
          key={card.id}
          card={card}
          selected={card.id === selectedCardId}
          connectRole={
            card.id === connectSourceCardId
              ? "source"
              : card.id === connectTargetCardId
                ? "target"
                : null
          }
          interactive={interactive}
          onPointerDown={onCardPointerDown}
          onPointerMove={onCardPointerMove}
          onPointerUp={onCardPointerUp}
        />
      ))}
      <RelatedDiagramLegend />
    </div>
  );
}
