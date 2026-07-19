"use client";

// Compass Version2 — Workspace Inspector を開閉するトリガーボタン（CWDS §4, 設計書 12 位置A）。
//
// Workspace ヘッダー右に置く、静かな pill ボタン。Inspector は補助領域なので目立たせすぎない。
// アイコンのみに依存せず可視ラベルを併記し、aria-expanded / aria-controls を付与する。
// フォーカス復帰のため forwardRef でボタンの ref を親へ公開する。

import { forwardRef } from "react";
import { PanelRight } from "lucide-react";
import { INSPECTOR_DOM_ID, INSPECTOR_TITLE } from "./inspectorTypes";

const WorkspaceInspectorToggle = forwardRef<
  HTMLButtonElement,
  {
    open: boolean;
    onToggle: () => void;
    label?: string;
  }
>(function WorkspaceInspectorToggle(
  { open, onToggle, label = INSPECTOR_TITLE },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={INSPECTOR_DOM_ID}
      className={[
        "inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A84FF]/40",
        open
          ? "border-[#0A84FF] bg-[#EAF3FF] text-[#0A6CD6]"
          : "border-[#E5E5EA] bg-white text-[#3A3A3C] hover:bg-[#F2F2F5]",
      ].join(" ")}
    >
      <PanelRight className="h-4 w-4" strokeWidth={1.9} />
      {label}
    </button>
  );
});

export default WorkspaceInspectorToggle;
