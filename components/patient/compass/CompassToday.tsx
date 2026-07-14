import type { ReactNode } from "react";
import { Activity, Clock, Moon, Smile, Sun, UtensilsCrossed } from "lucide-react";
import type { Patient } from "@/lib/wardData";
import type { CompassExtra } from "@/lib/compassPatientData";

// ③ Today: 今日の様子（睡眠・食事・活動・表情）と予定。
export default function CompassToday({
  patient,
  extra,
}: {
  patient: Patient;
  extra: CompassExtra;
}) {
  const t = extra.today;
  return (
    <section className="rounded-3xl border border-[#EBEBF0] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="mb-3.5 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FF9500]/12">
          <Sun className="h-4 w-4 text-[#FF9500]" strokeWidth={1.75} />
        </span>
        <h2 className="text-[16px] font-bold text-[#1D1D1F]">今日の様子</h2>
      </div>

      {/* 総評 */}
      <p className="mb-3.5 rounded-2xl bg-[#FFF7ED] px-4 py-3 text-[13px] leading-relaxed text-[#8A5A18]">
        {t.summary}
      </p>

      {/* 睡眠・食事・活動・表情 */}
      <div className="grid grid-cols-2 gap-3">
        <StatusTile
          icon={<Moon className="h-4 w-4 text-[#5E5CE6]" strokeWidth={1.75} />}
          label="睡眠"
          value={t.sleep}
        />
        <StatusTile
          icon={
            <UtensilsCrossed
              className="h-4 w-4 text-[#FF9500]"
              strokeWidth={1.75}
            />
          }
          label="食事"
          value={t.meal}
        />
        <StatusTile
          icon={
            <Activity className="h-4 w-4 text-[#34C759]" strokeWidth={1.75} />
          }
          label="活動"
          value={t.activity}
        />
        <StatusTile
          icon={<Smile className="h-4 w-4 text-[#0A84FF]" strokeWidth={1.75} />}
          label="表情"
          value={t.expression}
        />
      </div>

      {/* 予定 */}
      <div className="mt-4">
        <div className="mb-2 flex items-center gap-1.5">
          <Clock className="h-4 w-4 text-[#8E8E93]" strokeWidth={1.75} />
          <span className="text-[12px] font-semibold text-[#8E8E93]">
            今日の予定
          </span>
        </div>
        <ul className="space-y-1.5">
          {patient.schedule.map((s, i) => {
            const active = i === patient.activeScheduleIndex;
            return (
              <li
                key={`${s.time}-${s.label}`}
                className={[
                  "flex items-center gap-3 rounded-xl px-3 py-2 text-[13px]",
                  active ? "bg-[#EAF3FF]" : "bg-[#FAFAFC]",
                ].join(" ")}
              >
                <span
                  className={[
                    "font-semibold tabular-nums",
                    active ? "text-[#0A6CD6]" : "text-[#6E6E73]",
                  ].join(" ")}
                >
                  {s.time}
                </span>
                <span className="text-[#3A3A3C]">{s.label}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function StatusTile({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-[#FAFAFC] p-3.5">
      <div className="mb-1.5 flex items-center gap-1.5">
        {icon}
        <span className="text-[11px] font-semibold text-[#8E8E93]">
          {label}
        </span>
      </div>
      <p className="text-[13px] leading-relaxed text-[#3A3A3C]">{value}</p>
    </div>
  );
}
