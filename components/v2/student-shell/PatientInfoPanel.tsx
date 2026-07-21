"use client";

// Compass Version2 — 受け持ち患者の基本情報パネル（患者理解の一次情報）。
//
// Sprint D-1（Learning Workspace Foundation）で追加。
//   ・患者トップ（患者理解の入口）と Workspace 左ペインの「患者情報」タブで共有する純表示。
//   ・表示は 基本情報 / 学習目標 / 観察ポイント / リスク / 今日の予定 のみ。
//     様式2（受け持ち対象記録）はここには置かない（Workspace 中央の主役）。
//   ・データは既存 wardData（Patient）を参照するのみ（DB / Supabase には触れない）。
//
// 高さ・スクロールは呼び出し側が制御する（本コンポーネントはセクションの縦積みのみ）。

import type { Patient } from "@/lib/wardData";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1.5 text-[11px] font-semibold text-[#8E8E93]">{children}</p>
  );
}

export default function PatientInfoPanel({ patient }: { patient: Patient }) {
  return (
    <div className="space-y-4">
      <section>
        <SectionTitle>基本情報</SectionTitle>
        <div className="text-[12px]">
          {[
            ["診断名", patient.diagnosis],
            ["入院日", patient.admit],
            ["主治医", patient.doctor],
          ].map(([k, v], i) => (
            <div
              key={k}
              className={[
                "flex items-center justify-between py-1.5",
                i < 2 ? "border-b border-[#F2F2F5]" : "",
              ].join(" ")}
            >
              <span className="text-[#8E8E93]">{k}</span>
              <span className="font-medium text-[#1D1D1F]">{v}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle>学習目標</SectionTitle>
        <div className="rounded-xl bg-[#F5F5F7] px-3 py-2.5 text-[12px] leading-relaxed text-[#3A3A3C]">
          {patient.goal}
        </div>
      </section>

      <section>
        <SectionTitle>観察ポイント</SectionTitle>
        <ul className="space-y-1 text-[12px] text-[#3A3A3C]">
          {patient.observations.map((t) => (
            <li key={t} className="flex gap-1.5">
              <span className="text-[#0A84FF]">・</span>
              {t}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <SectionTitle>リスク</SectionTitle>
        <ul className="space-y-1 text-[12px] text-[#3A3A3C]">
          {patient.risks.map((t) => (
            <li key={t} className="flex gap-1.5">
              <span className="text-[#FF9500]">・</span>
              {t}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <SectionTitle>今日の予定</SectionTitle>
        <ul className="space-y-1">
          {patient.schedule.map((s, i) => {
            const active = i === patient.activeScheduleIndex;
            return (
              <li
                key={s.time}
                className={[
                  "flex items-center gap-3 rounded-lg px-2.5 py-1.5 text-[12px]",
                  active ? "bg-[#EAF3FF]" : "",
                ].join(" ")}
              >
                <span
                  className={
                    active ? "font-semibold text-[#0A84FF]" : "text-[#8E8E93]"
                  }
                >
                  {s.time}
                </span>
                <span
                  className={
                    active ? "font-semibold text-[#0A84FF]" : "text-[#1D1D1F]"
                  }
                >
                  {s.label}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
