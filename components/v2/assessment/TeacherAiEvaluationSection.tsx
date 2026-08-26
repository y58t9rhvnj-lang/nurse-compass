"use client";

import { useState, type ReactNode, type ToggleEvent } from "react";

type Props = {
  id: string;
  title: string;
  /** 初期開閉のみ。DOM の defaultOpen 属性には渡さない */
  defaultOpen?: boolean;
  badge?: string | null;
  children: ReactNode;
};

/** 教員向け AI 候補パネル用の開閉セクション（表示のみ） */
export default function TeacherAiEvaluationSection({
  id,
  title,
  defaultOpen = false,
  badge,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  const onToggle = (e: ToggleEvent<HTMLDetailsElement>) => {
    setOpen(e.currentTarget.open);
  };

  return (
    <details
      id={id}
      className="group rounded-lg border border-slate-200 bg-white open:border-slate-300"
      open={open}
      onToggle={onToggle}
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-sm font-semibold text-slate-900 [-webkit-tap-highlight-color:transparent] [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1 truncate">
          {title}
          {badge ? (
            <span className="ml-1.5 text-xs font-normal text-slate-500">
              {badge}
            </span>
          ) : null}
        </span>
        <span
          aria-hidden
          className="shrink-0 text-slate-400 transition-transform group-open:rotate-180"
        >
          ▾
        </span>
      </summary>
      <div className="border-t border-slate-100 px-3 py-2.5">{children}</div>
    </details>
  );
}
