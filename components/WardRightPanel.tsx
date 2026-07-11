"use client";

import { Compass, Star, User } from "lucide-react";
import { useState } from "react";
import { LOC, type Patient } from "@/lib/wardData";

interface WardRightPanelProps {
  patient: Patient;
  onPatientTopRequest: () => void;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1.5 text-[11px] font-semibold text-[#8E8E93]">{children}</p>
  );
}

const coachItems = [
  "申し送りを確認",
  "電子カルテを開く",
  "患者との会話",
  "観察記録",
] as const;

export default function WardRightPanel({
  patient,
  onPatientTopRequest,
}: WardRightPanelProps) {
  const [coachOpen, setCoachOpen] = useState(false);
  const loc = LOC[patient.loc];

  return (
    <aside className="flex h-full w-full flex-col">
      {/* 固定：患者プロフィール */}
      <div className="shrink-0 border-b border-[#F0F0F3] px-4 pb-3.5 pt-4">
        <div className="flex items-start gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
            style={{ background: loc.soft }}
          >
            <User className="h-6 w-6" strokeWidth={1.5} style={{ color: loc.color }} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <p className="text-[18px] font-bold text-[#1D1D1F]">
                {patient.name}
              </p>
              {patient.mine && (
                <Star
                  className="h-4 w-4 text-[#FFB800]"
                  strokeWidth={2}
                  fill="#FFB800"
                />
              )}
            </div>
            <p className="text-[12px] text-[#8E8E93]">
              {patient.room}号室・{patient.age}歳・{patient.sex}
            </p>
            <span
              className="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{ background: loc.soft, color: loc.color }}
            >
              {patient.locNote ?? loc.label}
            </span>
          </div>
        </div>
      </div>

      {/* スクロール領域 */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
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
          <SectionTitle>今日の目標</SectionTitle>
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
                      active
                        ? "font-semibold text-[#0A84FF]"
                        : "text-[#8E8E93]"
                    }
                  >
                    {s.time}
                  </span>
                  <span
                    className={
                      active
                        ? "font-semibold text-[#0A84FF]"
                        : "text-[#1D1D1F]"
                    }
                  >
                    {s.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <button
          type="button"
          onClick={onPatientTopRequest}
          className="min-h-[44px] w-full rounded-xl border border-[#D8D8DE] bg-white text-[13px] font-semibold text-[#0A84FF] transition-colors hover:bg-[#F5F5F7]"
        >
          患者トップへ
        </button>
      </div>

      {/* Compass Coach */}
      <div className="shrink-0 border-t border-[#F0F0F3] p-3">
        {coachOpen && (
          <div className="mb-2 rounded-2xl bg-[#0F2742] p-3 text-white">
            <p className="text-[11px] leading-snug text-[#AEBCD0]">
              {patient.name}を理解するために、最初に何を確認しますか？
            </p>
            <ul className="mt-2 flex flex-col gap-1.5">
              {coachItems.map((item) => (
                <li key={item}>
                  <label className="flex cursor-pointer items-center gap-2.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-[12px] transition-colors hover:bg-white/15">
                    <input type="checkbox" className="h-3.5 w-3.5 accent-[#0A84FF]" />
                    {item}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}
        <button
          type="button"
          onClick={() => setCoachOpen((v) => !v)}
          className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-2xl bg-[#0A84FF] text-[14px] font-semibold text-white shadow-[0_4px_14px_rgba(10,132,255,0.35)] transition-colors hover:bg-[#0071E3]"
        >
          <Compass className="h-5 w-5" strokeWidth={2} />
          Compass Coach
        </button>
      </div>
    </aside>
  );
}
