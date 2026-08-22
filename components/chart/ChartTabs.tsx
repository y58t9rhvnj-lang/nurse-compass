"use client";

import { CHART_TABS, type ChartTabId } from "@/lib/chartTabs";
import {
  BRAND_SELECTED_SEGMENT,
  BRAND_UNSELECTED_PILL,
} from "@/components/v2/workspace/darkSelectedSegment";

// 電子カルテタブ（横スクロール・ピル選択）。青は選択中のみ。
export default function ChartTabs({
  activeTab,
  onTabChange,
  compact,
}: {
  activeTab: ChartTabId;
  onTabChange: (tab: ChartTabId) => void;
  // compact: 思考ワークスペース内の embedded 表示向けに高さ・余白・文字を 1 段階縮小し、
  //   記録本文の閲覧領域を確保する（Sprint D-1 追加修正2 ⑥）。
  compact?: boolean;
}) {
  return (
    <nav
      aria-label="電子カルテタブ"
      className="shrink-0 border-b border-[#E5E5EA] bg-white"
    >
      <div
        role="tablist"
        aria-label="カルテ表示の切替"
        className={[
          "flex gap-1.5 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          compact ? "px-2.5 py-2" : "px-3 py-2.5 sm:px-4",
        ].join(" ")}
      >
        {CHART_TABS.map((id) => {
          const active = id === activeTab;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              onClick={() => onTabChange(id)}
              className={[
                "relative z-[1] shrink-0 whitespace-nowrap rounded-[10px] border border-transparent",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E88E5]",
                "active:scale-[0.98] motion-reduce:active:scale-100",
                compact
                  ? "min-h-[44px] px-3 text-[12px]"
                  : "min-h-[46px] px-3.5 text-[13px] sm:px-4",
                active ? BRAND_SELECTED_SEGMENT : BRAND_UNSELECTED_PILL,
              ].join(" ")}
              data-compass-selected={active ? "true" : "false"}
            >
              {id}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
