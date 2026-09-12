"use client";

import type { RelatedDiagramRouteTopology } from "@/lib/v2/relatedDiagram/routeTopology";
import type { RelatedDiagramSemanticGraph } from "@/lib/v2/relatedDiagram/types";
import {
  A3_HEIGHT_MM,
  A3_HEIGHT_PX,
  A3_WIDTH_MM,
  A3_WIDTH_PX,
} from "@/lib/v2/relatedDiagram/a3Canvas";
import RelatedDiagramCardNode from "./RelatedDiagramCardNode";
import RelatedDiagramConnectionLayer from "./RelatedDiagramConnectionLayer";
import RelatedDiagramLegend from "./RelatedDiagramLegend";

/**
 * Logical A3 landscape paper. Positions are in A3_PX units (≈96dpi).
 * Print uses mm page size; screen uses same aspect via px dimensions.
 */
export default function RelatedDiagramA3Surface({
  graph,
  knowledgeLabel,
  routeTopology,
}: {
  graph: RelatedDiagramSemanticGraph;
  knowledgeLabel?: string | null;
  routeTopology?: RelatedDiagramRouteTopology;
}) {
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
      />
      {graph.cards.map((card) => (
        <RelatedDiagramCardNode key={card.id} card={card} />
      ))}
      <RelatedDiagramLegend />
    </div>
  );
}
