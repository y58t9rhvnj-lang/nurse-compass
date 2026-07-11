"use client";

import { BedDouble } from "lucide-react";
import { getChartData } from "@/lib/chartData";
import type { Patient } from "@/lib/wardData";

// 電子カルテ画面上部の患者バー
export default function ChartPatientBar({ patient }: { patient: Patient }) {
  const info = getChartData(patient.id).patientInfo;

  return (
    <header className="shrink-0 border-b border-[#D6E4F7] bg-gradient-to-r from-[#EAF3FF] to-[#F5F9FF] px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0A84FF] text-white">
          <BedDouble className="h-4 w-4" strokeWidth={2} />
        </span>

        <BarItem label="患者番号" value={info.patientNo} bold />
        <BarDivider />
        <BarItem label="氏名" value={info.name} bold large />
        <BarItem label="性別" value={info.sex} />
        <BarItem label="年齢" value={`${info.age}歳`} />
        <BarItem label="病室" value={`${info.room}号室`} />
        <BarDivider />
        <BarItem label="主治医" value={info.doctor} />
        <BarItem label="担当看護師" value={info.nurse} />
      </div>
    </header>
  );
}

function BarItem({
  label,
  value,
  bold,
  large,
}: {
  label: string;
  value: string;
  bold?: boolean;
  large?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[10px] font-medium text-[#6E8EAE]">{label}</span>
      <span
        className={[
          "text-[#1D1D1F]",
          large ? "text-[15px]" : "text-[13px]",
          bold ? "font-bold" : "font-medium",
        ].join(" ")}
      >
        {value}
      </span>
    </div>
  );
}

function BarDivider() {
  return <span className="hidden h-4 w-px bg-[#C5D9F0] sm:block" />;
}
