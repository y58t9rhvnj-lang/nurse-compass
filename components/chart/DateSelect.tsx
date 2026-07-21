"use client";

import { useMemo } from "react";

// 年 / 月 / 日 の3段階で日付を選ぶ共通ピッカー。
// 診療録・フローシート（将来的に検査・処方）で同一UI・同一操作として使う。
// 候補に存在する日付だけを選択でき、年・月を変えると存在する日のみ表示する。

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function fmt(y: number, m: number, d: number) {
  return `${y}/${pad(m)}/${pad(d)}`;
}
function uniqueSortedDesc(arr: number[]) {
  return [...new Set(arr)].sort((a, b) => b - a);
}

export default function DateSelect({
  dates,
  value,
  onChange,
  compact,
}: {
  dates: string[]; // 選択可能な日付（"YYYY/MM/DD"）
  value: string; // 現在の選択日（候補外なら最新日を表示に使う）
  onChange: (date: string) => void;
  // compact: Workspace embedded 用に高さ・余白を縮小（3 セレクトで約 150〜190px を目安）。
  compact?: boolean;
}) {
  const { years, monthsByYear, daysByYM, newest } = useMemo(() => {
    const monthsByYear = new Map<number, number[]>();
    const daysByYM = new Map<string, number[]>();
    const yearsSet: number[] = [];
    for (const s of dates) {
      const [y, m, d] = s.split("/").map(Number);
      yearsSet.push(y);
      const mm = monthsByYear.get(y) ?? [];
      mm.push(m);
      monthsByYear.set(y, mm);
      const key = `${y}-${m}`;
      const dd = daysByYM.get(key) ?? [];
      dd.push(d);
      daysByYM.set(key, dd);
    }
    for (const [y, mm] of monthsByYear) monthsByYear.set(y, uniqueSortedDesc(mm));
    for (const [k, dd] of daysByYM) daysByYM.set(k, uniqueSortedDesc(dd));
    const years = uniqueSortedDesc(yearsSet);
    const sortedDesc = [...dates].sort((a, b) => b.localeCompare(a));
    return { years, monthsByYear, daysByYM, newest: sortedDesc[0] ?? "" };
  }, [dates]);

  if (dates.length === 0) return null;

  const current = dates.includes(value) ? value : newest;
  const [cy, cm, cd] = current.split("/").map(Number);

  const months = monthsByYear.get(cy) ?? [];
  const days = daysByYM.get(`${cy}-${cm}`) ?? [];

  // その年に存在する月へ、さらに存在する日へ解決してから確定
  const resolve = (y: number, m: number, d: number) => {
    const ms = monthsByYear.get(y) ?? [];
    const mm = ms.includes(m) ? m : (ms[0] ?? m);
    const ds = daysByYM.get(`${y}-${mm}`) ?? [];
    const dd = ds.includes(d) ? d : (ds[0] ?? d);
    onChange(fmt(y, mm, dd));
  };

  const cls = compact
    ? "min-h-[32px] rounded-lg border border-[#D1D1D6] bg-white px-1 text-[11px] font-medium text-[#1D1D1F]"
    : "min-h-[44px] rounded-lg border border-[#D1D1D6] bg-white px-2 text-[12px] font-medium text-[#1D1D1F]";

  return (
    <div className={compact ? "flex items-center gap-1" : "flex items-center gap-1.5"}>
      <select
        aria-label="年"
        value={cy}
        onChange={(e) => resolve(Number(e.target.value), cm, cd)}
        className={cls}
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}年
          </option>
        ))}
      </select>
      <select
        aria-label="月"
        value={cm}
        onChange={(e) => resolve(cy, Number(e.target.value), cd)}
        className={cls}
      >
        {months.map((m) => (
          <option key={m} value={m}>
            {m}月
          </option>
        ))}
      </select>
      <select
        aria-label="日"
        value={cd}
        onChange={(e) => resolve(cy, cm, Number(e.target.value))}
        className={cls}
      >
        {days.map((d) => (
          <option key={d} value={d}>
            {d}日
          </option>
        ))}
      </select>
    </div>
  );
}
