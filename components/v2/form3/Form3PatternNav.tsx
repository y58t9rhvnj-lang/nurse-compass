"use client";

import type { Form3NavItem } from "@/components/v2/form3/form3UiModel";
import { form3ProgressToneClass } from "@/components/v2/form3/form3UiModel";
import type { Form3PatternKey } from "@/lib/form3/form3Types";

export type Form3PatternNavProps = {
  items: Form3NavItem[];
  onSelect: (key: Form3PatternKey) => void;
};

export default function Form3PatternNav({
  items,
  onSelect,
}: Form3PatternNavProps) {
  return (
    <nav
      aria-label="健康パターン一覧"
      className="shrink-0 border-b border-[#E5E5EA] bg-white xl:border-b-0 xl:border-r"
    >
      {/* iPad First: xl 未満は横スクロールチップ。xl 以上のみ PC 縦ナビ。 */}
      <ul className="flex gap-2 overflow-x-auto overscroll-x-contain px-3 py-2.5 [-ms-overflow-style:none] [scrollbar-width:none] xl:hidden [&::-webkit-scrollbar]:hidden">
        {items.map((item) => (
          <li key={item.key} className="shrink-0">
            <NavChip item={item} onSelect={onSelect} />
          </li>
        ))}
      </ul>

      {/* PC（広い画面）: 縦リスト */}
      <ul className="hidden max-h-full overflow-y-auto overscroll-contain p-2 xl:block xl:w-[13.5rem] 2xl:w-[15rem]">
        {items.map((item) => (
          <li key={item.key}>
            <NavRow item={item} onSelect={onSelect} />
          </li>
        ))}
      </ul>
    </nav>
  );
}

function NavChip({
  item,
  onSelect,
}: {
  item: Form3NavItem;
  onSelect: (key: Form3PatternKey) => void;
}) {
  const selected = item.selected;
  return (
    <button
      type="button"
      aria-current={selected ? "true" : undefined}
      aria-label={`${item.index}. ${item.shortLabel}（${item.progressLabel}）`}
      onClick={() => onSelect(item.key)}
      data-compass-selected={selected ? "true" : "false"}
      className={[
        "relative z-[1] inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-3 text-left text-[12px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E88E5]",
        "transition-[background-color,color,border-color] duration-150 ease-out motion-reduce:transition-none",
        selected
          ? "border-[#1E88E5] bg-[#1E88E5] font-semibold text-[#FFFFFF] [color:#FFFFFF] [-webkit-text-fill-color:#FFFFFF]"
          : form3ProgressToneClass(item.progress),
      ].join(" ")}
    >
      <span
        className={[
          "relative z-[1] tabular-nums",
          selected
            ? "text-[#FFFFFF] [-webkit-text-fill-color:#FFFFFF] opacity-90"
            : "text-[#667085]",
        ].join(" ")}
      >
        {item.index}
      </span>
      <span className="relative z-[1] font-medium">{item.shortLabel}</span>
      <span
        className={[
          "relative z-[1] rounded-full px-1.5 py-0.5 text-[10px]",
          selected
            ? "bg-white/15 text-[#FFFFFF] [-webkit-text-fill-color:#FFFFFF]"
            : "bg-black/5",
        ].join(" ")}
      >
        {item.progressLabel}
      </span>
    </button>
  );
}

function NavRow({
  item,
  onSelect,
}: {
  item: Form3NavItem;
  onSelect: (key: Form3PatternKey) => void;
}) {
  const selected = item.selected;
  return (
    <button
      type="button"
      aria-current={selected ? "true" : undefined}
      aria-label={`${item.index}. ${item.fullLabel}（${item.progressLabel}）`}
      onClick={() => onSelect(item.key)}
      data-compass-selected={selected ? "true" : "false"}
      className={[
        "relative z-[1] mb-1 flex w-full min-h-[44px] items-start gap-2 rounded-xl border px-2.5 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E88E5]",
        "transition-[background-color,color,border-color] duration-150 ease-out motion-reduce:transition-none",
        selected
          ? "border-[#1E88E5] bg-[#1E88E5] font-semibold text-[#FFFFFF] [color:#FFFFFF] [-webkit-text-fill-color:#FFFFFF]"
          : "border-transparent bg-transparent text-[#344054] [color:#344054] [-webkit-text-fill-color:#344054] hover:bg-[#F4F6F8]",
      ].join(" ")}
    >
      <span
        className={[
          "relative z-[1] mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums",
          selected
            ? "bg-white/15 text-[#FFFFFF] [-webkit-text-fill-color:#FFFFFF]"
            : "bg-[#F4F6F8] text-[#667085]",
        ].join(" ")}
      >
        {item.index}
      </span>
      <span className="relative z-[1] min-w-0 flex-1">
        <span className="block text-[13px] font-medium leading-snug">
          {item.shortLabel}
        </span>
        <span
          className={[
            "mt-1 inline-flex rounded-full border px-1.5 py-0.5 text-[10px]",
            selected
              ? "border-white/25 bg-white/10 text-[#FFFFFF] [-webkit-text-fill-color:#FFFFFF]"
              : form3ProgressToneClass(item.progress),
          ].join(" ")}
        >
          {item.progressLabel}
        </span>
      </span>
    </button>
  );
}
