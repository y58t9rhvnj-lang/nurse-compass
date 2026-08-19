"use client";

// Form3 Phase B R2 — ゴードン 11 Pattern 横スクロールナビ。
// Final は含めない。選択は Workspace の UI 状態のみ。

import { getForm3PatternDefinition } from "@/lib/form3/form3PatternDefinitions";
import {
  FORM3_PATTERN_ORDER,
  type Form3PatternKey,
} from "@/lib/form3/form3Types";

export type Form3PhaseBPatternTabBarProps = {
  selectedPatternKey: Form3PatternKey;
  onSelect: (key: Form3PatternKey) => void;
  onOpenList?: () => void;
  panelId?: string;
};

/** 学校指定順ラベル（定義の ― を ・ に揃える） */
export function form3PhaseBPatternTabLabel(key: Form3PatternKey): string {
  return getForm3PatternDefinition(key).labelJa.replace(/―/g, "・");
}

export default function Form3PhaseBPatternTabBar({
  selectedPatternKey,
  onSelect,
  onOpenList,
  panelId = "form3-phase-b-pattern-panel",
}: Form3PhaseBPatternTabBarProps) {
  return (
    <div className="flex min-w-0 items-stretch gap-2 border-b border-[#E5E5EA] bg-white px-2 py-2 sm:px-3">
      <div
        role="tablist"
        aria-label="ゴードンの11の機能的健康パターン"
        className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {FORM3_PATTERN_ORDER.map((key, index) => {
          const selected = key === selectedPatternKey;
          const label = form3PhaseBPatternTabLabel(key);
          return (
            <button
              key={key}
              type="button"
              role="tab"
              id={`form3-phase-b-pattern-tab-${key}`}
              aria-selected={selected}
              aria-controls={panelId}
              tabIndex={selected ? 0 : -1}
              onClick={() => onSelect(key)}
              className={[
                "inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl px-3 text-left text-[13px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A84FF]",
                selected
                  ? "bg-[#1D1D1F] text-white"
                  : "bg-[#F2F2F7] text-[#1D1D1F] hover:bg-[#E8E8ED]",
              ].join(" ")}
            >
              <span className="tabular-nums opacity-70">{index + 1}</span>
              <span className="whitespace-nowrap">{label}</span>
            </button>
          );
        })}
      </div>
      {onOpenList ? (
        <button
          type="button"
          onClick={onOpenList}
          className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-xl border border-[#E5E5EA] bg-white px-3 text-[13px] font-semibold text-[#1D1D1F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A84FF]"
        >
          一覧
        </button>
      ) : null}
    </div>
  );
}
