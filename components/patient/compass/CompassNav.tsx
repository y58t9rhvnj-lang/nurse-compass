"use client";

import type { ReactNode } from "react";
import { Brain, ChevronRight, FileText, NotebookPen, Send } from "lucide-react";

export type CompassNavTarget =
  | "電子カルテ"
  | "申し送り"
  | "メモ"
  | "Thinking Workspace";

// ⑤ Navigation: 患者理解から各機能へつなぐ導線。
export default function CompassNav({
  onNavigate,
}: {
  onNavigate: (target: CompassNavTarget) => void;
}) {
  return (
    <section className="rounded-2xl border border-[#EBEBF0] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <h3 className="mb-2.5 text-[13px] font-semibold text-[#1D1D1F]">
        関連機能へ
      </h3>
      <div className="space-y-2">
        <NavButton
          icon={<FileText className="h-4 w-4" strokeWidth={1.75} />}
          label="電子カルテ"
          sub="診療・看護記録"
          onClick={() => onNavigate("電子カルテ")}
        />
        <NavButton
          icon={<Send className="h-4 w-4" strokeWidth={1.75} />}
          label="申し送り"
          sub="チームからの共有"
          onClick={() => onNavigate("申し送り")}
        />
        <NavButton
          icon={<NotebookPen className="h-4 w-4" strokeWidth={1.75} />}
          label="メモ"
          sub="気づきメモへ移動"
          onClick={() => onNavigate("メモ")}
        />
        <NavButton
          icon={<Brain className="h-4 w-4" strokeWidth={1.75} />}
          label="Thinking Workspace"
          sub="思考を整理する"
          onClick={() => onNavigate("Thinking Workspace")}
        />
      </div>
    </section>
  );
}

function NavButton({
  icon,
  label,
  sub,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[44px] w-full items-center gap-3 rounded-xl border border-[#EBEBF0] bg-white px-3 py-2.5 text-left transition hover:bg-[#F7F7F9]"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F2F2F7] text-[#0A84FF]">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium text-[#1D1D1F]">
          {label}
        </span>
        <span className="block text-[11px] text-[#8E8E93]">{sub}</span>
      </span>
      <ChevronRight className="h-4 w-4 text-[#C7C7CC]" strokeWidth={1.75} />
    </button>
  );
}
