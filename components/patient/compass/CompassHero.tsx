import { MapPin, Star, Target, User } from "lucide-react";
import { LOC, type Patient } from "@/lib/wardData";
import type { CompassExtra } from "@/lib/compassPatientData";

// ① Hero: 患者を「一人の人」として最初に受けとめる。診断名は出さない（下部へ）。
export default function CompassHero({
  patient,
  extra,
}: {
  patient: Patient;
  extra: CompassExtra;
}) {
  const loc = LOC[patient.loc];
  return (
    <section className="rounded-3xl border border-[#EBEBF0] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="flex items-center gap-5">
        {/* 患者イラスト（Line Icon アバター） */}
        <div
          className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full"
          style={{ background: loc.soft }}
        >
          <User
            className="h-12 w-12"
            strokeWidth={1.25}
            style={{ color: loc.color }}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-[32px] font-bold leading-tight tracking-tight text-[#1D1D1F]">
              {patient.name}
            </h1>
            {patient.mine && (
              <Star
                className="h-6 w-6 text-[#FFB800]"
                strokeWidth={2}
                fill="#FFB800"
              />
            )}
          </div>
          <p className="mt-1 text-[15px] text-[#48484A]">
            {patient.age}歳・{patient.sex}・受け持ち{extra.caregivingDays}日目
          </p>
          <div className="mt-2.5 flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[12px] font-medium"
              style={{ background: loc.soft, color: loc.color }}
            >
              <MapPin className="h-3.5 w-3.5" strokeWidth={2} />
              {patient.locNote ?? loc.label}
            </span>
          </div>
        </div>
      </div>

      {/* 今日の目標 */}
      <div className="mt-5 flex items-start gap-3 rounded-2xl bg-[#EAF3FF] px-4 py-3.5">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0A84FF]/12">
          <Target className="h-4 w-4 text-[#0A84FF]" strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-[#0A6CD6]">今日の目標</p>
          <p className="mt-0.5 text-[14px] leading-relaxed text-[#1D1D1F]">
            {patient.goal}
          </p>
        </div>
      </div>
    </section>
  );
}
