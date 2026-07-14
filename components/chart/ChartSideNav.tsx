"use client";

import { ChevronLeft } from "lucide-react";
import { CHART_SIDE_MENU, type ChartSideMenuItem } from "@/lib/chartSideMenu";

// 電子カルテ専用左メニュー（Alpha の機能メニューを Design System で再設計）
export default function ChartSideNav({
  activeItem = "カルテ画面",
  onBackToCompass,
  onMenuSelect,
}: {
  activeItem?: ChartSideMenuItem;
  onBackToCompass: () => void;
  onMenuSelect?: (item: ChartSideMenuItem) => void;
}) {
  return (
    <nav className="flex h-full w-full flex-col bg-[#FAFAFC]">
      <div className="shrink-0 border-b border-[#E5E5EA] p-2">
        <button
          type="button"
          onClick={onBackToCompass}
          className="flex min-h-[44px] w-full items-center gap-1.5 rounded-lg px-2.5 text-left text-[12px] font-semibold text-[#0A84FF] transition hover:bg-[#EAF3FF]"
        >
          <ChevronLeft className="h-4 w-4 shrink-0" strokeWidth={2} />
          Compassへ戻る
        </button>
      </div>

      <ul className="flex-1 overflow-y-auto py-1">
        {CHART_SIDE_MENU.map((item) => {
          const active = item === activeItem;
          return (
            <li key={item}>
              <button
                type="button"
                onClick={() => onMenuSelect?.(item)}
                aria-current={active ? "page" : undefined}
                className={[
                  "flex min-h-[44px] w-full items-center border-l-[3px] px-3 text-left text-[12px] transition-colors",
                  active
                    ? "border-[#0A84FF] bg-white font-semibold text-[#0A84FF]"
                    : "border-transparent font-medium text-[#3A3A3C] hover:bg-white hover:text-[#1D1D1F]",
                ].join(" ")}
              >
                {item}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
