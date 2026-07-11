import {
  BedDouble,
  CalendarDays,
  ClipboardList,
  Clock,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { ADMITTED_COUNT, MY_PATIENTS, TOTAL_BEDS } from "@/lib/wardData";

function InfoCard({
  icon,
  label,
  value,
  sub,
  subAccent,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub: string;
  subAccent?: string;
}) {
  return (
    <div className="flex h-[84px] flex-col justify-center rounded-2xl border border-[#EBEBF0] bg-white px-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-[11px] font-medium text-[#8E8E93]">{label}</span>
      </div>
      <p className="mt-1 text-[19px] font-bold leading-none text-[#1D1D1F]">
        {value}
      </p>
      <p
        className="mt-1 truncate text-[11px]"
        style={{ color: subAccent ?? "#8E8E93" }}
      >
        {sub}
      </p>
    </div>
  );
}

export default function WardHomeTopBar() {
  const myNames = MY_PATIENTS.map((p) => p.name).join("・");

  return (
    <div className="flex shrink-0 gap-3">
      <div className="grid flex-1 grid-cols-4 gap-3">
        <InfoCard
          icon={<BedDouble className="h-4 w-4 text-[#34C759]" strokeWidth={2} />}
          label="病棟状況"
          value={`在院 ${ADMITTED_COUNT}名`}
          sub={`定員 ${TOTAL_BEDS}名`}
        />
        <InfoCard
          icon={<Users className="h-4 w-4 text-[#0A84FF]" strokeWidth={2} />}
          label="受け持ち患者"
          value={`${MY_PATIENTS.length}名`}
          sub={myNames}
        />
        <InfoCard
          icon={
            <ClipboardList className="h-4 w-4 text-[#FF3B30]" strokeWidth={2} />
          }
          label="申し送り"
          value="未読 2件"
          sub="重要 1件"
          subAccent="#FF3B30"
        />
        <InfoCard
          icon={
            <CalendarDays className="h-4 w-4 text-[#5E5CE6]" strokeWidth={2} />
          }
          label="今日の予定"
          value="5件"
          sub="09:30 〜 17:00"
        />
      </div>

      {/* 現在時刻（分離カード） */}
      <div className="flex h-[84px] w-[150px] shrink-0 flex-col justify-center rounded-2xl border border-[#EBEBF0] bg-white px-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <div className="flex items-center gap-1.5">
          <Clock className="h-4 w-4 text-[#8E8E93]" strokeWidth={2} />
          <span className="text-[11px] font-medium text-[#8E8E93]">
            現在時刻
          </span>
        </div>
        <p className="mt-0.5 text-[26px] font-bold leading-none tracking-tight text-[#1D1D1F]">
          09:30
        </p>
        <p className="mt-1 text-[11px] text-[#8E8E93]">6月1日(日)</p>
      </div>
    </div>
  );
}
