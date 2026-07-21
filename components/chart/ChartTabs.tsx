"use client";

import { CHART_TABS, type ChartTabId } from "@/lib/chartTabs";

// 電子カルテタブ（横スクロール・セグメントコントロール）
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
        className={[
          "flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          compact ? "px-2 py-1.5" : "px-4 py-2",
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
              onClick={() => onTabChange(id)}
              className={[
                "shrink-0 rounded-xl font-medium transition-colors",
                compact
                  ? "px-3 py-1.5 text-[12px] min-h-[34px]"
                  : "px-4 py-2.5 text-[13px] min-h-[44px]",
                active
                  ? "bg-[#0A84FF] text-white shadow-[0_2px_6px_rgba(10,132,255,0.25)]"
                  : "bg-[#F2F2F7] text-[#3A3A3C] hover:bg-[#E8E8ED]",
              ].join(" ")}
            >
              {id}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
