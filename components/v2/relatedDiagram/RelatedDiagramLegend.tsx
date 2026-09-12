"use client";

/**
 * Compact A3-local legend (not semantic graph).
 * Pans / zooms / prints with the canvas. Not selectable or persisted.
 * Panel size === reserved bounds; all samples stay inside A3 + margin.
 */

import { getA3LegendBounds } from "@/lib/v2/relatedDiagram/a3Legend";
import { resolveCardBorderVisual } from "@/lib/v2/relatedDiagram/visualStyle";

function MiniCard({
  cardType,
  state,
  label,
}: {
  cardType: "understanding" | "nursing_problem";
  state: "current" | "potential";
  label: string;
}) {
  const v = resolveCardBorderVisual(cardType, state);
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span
        data-rd-legend-card-sample={cardType}
        data-rd-legend-card-state={state}
        className="inline-block shrink-0"
        style={{
          width: 22,
          height: 14,
          boxSizing: "border-box",
          background: v.background,
          borderStyle: v.borderStyle,
          borderWidth: Math.max(1, v.borderWidthPx * 0.7),
          borderColor: v.borderColor,
        }}
      />
      <span className="min-w-0 truncate">{label}</span>
    </div>
  );
}

function LineSample({
  kind,
  label,
}: {
  kind: "current" | "potential" | "treatment";
  label: string;
}) {
  const w = kind === "treatment" ? 3.2 : 1.5;
  const dash = kind === "potential" ? "4 3" : undefined;
  return (
    <div className="flex items-center gap-2">
      <svg
        data-rd-legend-line-sample={kind}
        width={52}
        height={16}
        viewBox="0 0 52 16"
        aria-hidden
        className="shrink-0"
      >
        <path
          d="M 3 8 L 40 8"
          fill="none"
          stroke="#1D1D1F"
          strokeWidth={w}
          strokeDasharray={dash}
          markerEnd={
            kind === "treatment"
              ? "url(#rd-legend-arrow-thick)"
              : "url(#rd-legend-arrow)"
          }
        />
      </svg>
      <span>{label}</span>
    </div>
  );
}

export default function RelatedDiagramLegend() {
  const bounds = getA3LegendBounds();
  return (
    <aside
      data-rd-legend
      data-rd-legend-print="1"
      aria-label="関連図の見方"
      className="pointer-events-none absolute box-border text-[#1D1D1F]"
      style={{
        left: bounds.x,
        top: bounds.y,
        width: bounds.width,
        height: bounds.height,
        zIndex: 30,
        background: "rgba(255,255,255,0.96)",
        border: "1px solid #C7C7CC",
        padding: "8px 9px 8px",
        fontSize: "9pt",
        lineHeight: 1.35,
        overflow: "hidden",
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Noto Sans JP', sans-serif",
      }}
    >
      <svg width={0} height={0} className="absolute" aria-hidden>
        <defs>
          <marker
            id="rd-legend-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#1D1D1F" />
          </marker>
          <marker
            id="rd-legend-arrow-thick"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#1D1D1F" />
          </marker>
        </defs>
      </svg>
      <div className="mb-1.5 text-[10pt] font-semibold tracking-tight">
        関連図の見方
      </div>
      <div className="mb-0.5 text-[8.5pt] font-semibold text-[#6E6E73]">
        カード
      </div>
      <div className="mb-2 flex flex-col gap-1">
        <MiniCard cardType="understanding" state="current" label="顕在" />
        <MiniCard cardType="understanding" state="potential" label="潜在" />
        <MiniCard cardType="nursing_problem" state="current" label="看護問題" />
      </div>
      <div className="mb-0.5 text-[8.5pt] font-semibold text-[#6E6E73]">線</div>
      <div className="flex flex-col gap-1">
        <LineSample kind="current" label="顕在" />
        <LineSample kind="potential" label="潜在" />
        <LineSample kind="treatment" label="治療" />
      </div>
    </aside>
  );
}
