"use client";

/**
 * Viewport-chrome toolbar. Must stay outside the A3 canvas transform.
 * Single row: title left, zoom/print controls right.
 */

import type { ReactNode } from "react";

export default function RelatedDiagramWorkspaceToolbar({
  percent,
  onReset100,
  onFit,
  onPrint,
  title,
  subtitle,
  leading,
}: {
  percent: number;
  onReset100: () => void;
  onFit: () => void;
  onPrint: () => void;
  title: string;
  subtitle?: string;
  leading?: ReactNode;
}) {
  const label = subtitle ? `${title} / ${subtitle}` : title;
  return (
    <header
      data-rd-toolbar
      className="rd-no-print sticky top-0 z-50 shrink-0 border-b border-[#E5E5EA] bg-white"
    >
      <div
        data-rd-toolbar-row
        className="flex h-[52px] items-center gap-3 overflow-hidden px-3"
      >
        {leading}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[15px] font-semibold leading-tight text-[#1D1D1F]">
            {label}
          </h1>
        </div>
        <div
          data-rd-toolbar-controls
          className="flex shrink-0 items-center gap-2"
        >
          <span
            data-rd-zoom-percent
            className="tabular-nums text-[13px] font-medium text-[#1D1D1F]"
            aria-live="polite"
          >
            {percent}%
          </span>
          <button
            type="button"
            onClick={onReset100}
            className="min-h-[44px] min-w-[44px] rounded-lg border border-[#E5E5EA] bg-white px-3 text-[13px] text-[#1D1D1F]"
          >
            100%
          </button>
          <button
            type="button"
            onClick={onFit}
            className="min-h-[44px] rounded-lg bg-[#0A5FCC] px-3 text-[13px] font-medium text-white"
          >
            全体表示
          </button>
          <button
            type="button"
            onClick={onPrint}
            className="min-h-[44px] rounded-lg border border-[#E5E5EA] bg-white px-3 text-[13px] text-[#1D1D1F]"
          >
            印刷
          </button>
        </div>
      </div>
    </header>
  );
}
