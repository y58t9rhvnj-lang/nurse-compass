"use client";

import { CHART_TABS, type ChartTabId } from "@/lib/chartTabs";

// 電子カルテタブ（横スクロール・セグメントコントロール）
export default function ChartTabs({
  activeTab,
  onTabChange,
}: {
  activeTab: ChartTabId;
  onTabChange: (tab: ChartTabId) => void;
}) {
  return (
    <nav
      aria-label="電子カルテタブ"
      className="shrink-0 border-b border-[#E5E5EA] bg-white"
    >
      <div className="flex gap-1 overflow-x-auto px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                "shrink-0 rounded-xl px-4 py-2.5 text-[13px] font-medium transition-colors",
                "min-h-[44px]",
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
