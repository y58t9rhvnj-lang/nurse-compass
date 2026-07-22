import type { ReactNode } from "react";

// 共有UIプリミティブ（電子カルテらしい情報密度）

export function ChartPanel({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-[#F7F7F9] p-2.5">
      {children}
    </div>
  );
}

export function ChartTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: (string | ReactNode)[][];
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[#E5E5EA] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <table className="w-full min-w-[600px] border-collapse text-left text-[12px]">
        <thead>
          <tr className="border-b border-[#E5E5EA] bg-[#F7F7F9]">
            {headers.map((h) => (
              <th
                key={h}
                className="whitespace-nowrap px-3 py-2.5 font-semibold text-[#6E6E73]"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className="border-b border-[#F0F0F2] last:border-0 hover:bg-[#FAFAFC]"
            >
              {row.map((cell, j) => (
                <td
                  key={j}
                  className="px-3 py-2.5 align-top text-[#1D1D1F] leading-snug"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FormGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-0 rounded-xl border border-[#E5E5EA] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] md:grid-cols-3">
      {children}
    </div>
  );
}

export function FormField({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-[#F0F0F2] py-2">
      <dt className="text-[10px] font-medium text-[#AEAEB5]">{label}</dt>
      <dd className="mt-0.5 text-[13px] text-[#1D1D1F]">{value}</dd>
    </div>
  );
}

export function SectionCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[#E5E5EA] bg-white px-3.5 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <h3 className="mb-1.5 text-[12px] font-bold text-[#0A84FF]">{title}</h3>
      <p className="text-[12.5px] leading-relaxed text-[#3A3A3C]">{children}</p>
    </section>
  );
}

export function ProfessionBadge({ profession }: { profession: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    医師: { bg: "#EAF3FF", text: "#0A5FCC" },
    看護: { bg: "#E7F8ED", text: "#248A3D" },
    OT: { bg: "#FFF2E1", text: "#C93400" },
    PSW: { bg: "#F4EBFB", text: "#7B3FA0" },
  };
  const c = colors[profession] ?? { bg: "#F2F2F7", text: "#6E6E73" };
  return (
    <span
      className="inline-flex min-h-[22px] items-center rounded-md px-2 text-[10px] font-semibold"
      style={{ backgroundColor: c.bg, color: c.text }}
    >
      {profession}
    </span>
  );
}

export function TabCount({ count }: { count: number }) {
  return (
    <span className="mb-1.5 block text-[11px] text-[#8E8E93]">
      {count}件の記録
    </span>
  );
}

// 横スクロールのフィルタ／サブタブ用チップ列
export function FilterChips({
  options,
  active,
  onChange,
  compact,
}: {
  options: string[];
  active: string;
  onChange: (value: string) => void;
  // compact: Workspace embedded 用に高さ・余白・文字を 1 段階縮小し、1 行内で横スクロールする。
  compact?: boolean;
}) {
  return (
    // overflow-x-auto は overflow-y を auto（クリップ）に計算するため、上下方向に余白を確保して
    // チップ上端の ring/枠線が見切れないようにする（Sprint D-2D ⑤）。大きな余白は足さない。
    <div
      className={[
        "flex items-center overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        compact ? "gap-1 py-0.5" : "mb-1.5 gap-1.5 py-1",
      ].join(" ")}
    >
      {options.map((opt) => {
        const isActive = opt === active;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            aria-pressed={isActive}
            className={[
              "shrink-0 whitespace-nowrap rounded-full font-medium transition-colors",
              compact
                ? "min-h-[32px] px-2.5 text-[11px]"
                : "min-h-[44px] px-3.5 text-[12px]",
              isActive
                ? "bg-[#0A84FF] text-white shadow-[0_1px_3px_rgba(10,132,255,0.25)]"
                : "bg-white text-[#3A3A3C] ring-1 ring-[#E5E5EA] hover:bg-[#F2F2F7]",
            ].join(" ")}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-dashed border-[#E0E0E5] bg-white px-4 py-8 text-center text-[12px] text-[#AEAEB5]">
      {text}
    </p>
  );
}
