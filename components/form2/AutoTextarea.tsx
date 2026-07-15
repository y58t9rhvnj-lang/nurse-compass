"use client";

import { useLayoutEffect, useRef } from "react";

// 内容に応じて高さが伸び、上限を超えたら内部スクロールする textarea。
// 高さは DOM を直接操作して調整する（state を使わないため再描画を増やさない）。
const MAX_HEIGHT_PX = 480;

export default function AutoTextarea({
  value,
  onChange,
  placeholder,
  id,
  ariaLabel,
  minRows = 3,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  ariaLabel?: string;
  minRows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const next = Math.min(el.scrollHeight, MAX_HEIGHT_PX);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > MAX_HEIGHT_PX ? "auto" : "hidden";
  }, [value]);

  return (
    <textarea
      ref={ref}
      id={id}
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={minRows}
      className="w-full resize-none rounded-md border border-[#C9C9CE] bg-white px-3 py-2 text-[14px] leading-relaxed text-[#1D1D1F] outline-none placeholder:text-[#B0B0B5] focus:border-[#0A84FF] focus:ring-1 focus:ring-[#0A84FF]"
    />
  );
}
