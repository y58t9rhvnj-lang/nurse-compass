"use client";

import { Eye, MapPin, PersonStanding, Smile } from "lucide-react";
import type { Patient } from "@/lib/wardData";
import type { FacingObservation } from "@/lib/patientFacingData";

// 画面上部（固定）の患者ステータス。
// 左：患者アバター／右：2×2 のステータスグリッド（表情｜姿勢／視線｜現在地）。
// 各項目は「ラベル＋内容」の2段カード。内容は省略せず、必要に応じて折り返す（truncate 不使用）。
export default function PatientPresence({
  patient,
  observation,
}: {
  patient: Patient;
  observation: FacingObservation;
}) {
  const cells = [
    { icon: Smile, label: "表情", value: observation.expression },
    { icon: PersonStanding, label: "姿勢", value: observation.posture },
    { icon: Eye, label: "視線", value: observation.gaze },
    { icon: MapPin, label: "現在地", value: observation.location },
  ];

  return (
    <section className="flex items-stretch gap-4 rounded-3xl border border-[#EBEBF0] bg-white px-4 py-3.5">
      {/* アバター（小さくなりすぎないように固定サイズ） */}
      <div className="flex shrink-0 flex-col items-center justify-center gap-1.5">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[#E5E5EA] bg-[#F7F9FC] text-[34px] leading-none">
          <span aria-hidden>{observation.avatar}</span>
        </div>
        <div className="text-center">
          <p className="text-[13px] font-semibold leading-tight text-[#1D1D1F]">
            {patient.name}
          </p>
          <p className="text-[10.5px] text-[#8E8E93]">{patient.room}</p>
        </div>
      </div>

      {/* 2×2（狭い場合は2列で自然に折り返し。iPad横は4セルが2×2で並ぶ） */}
      <ul className="grid flex-1 grid-cols-2 gap-2">
        {cells.map(({ icon: Icon, label, value }) => (
          <li
            key={label}
            className="rounded-2xl border border-[#F0F0F3] bg-[#FAFAFC] px-3 py-2"
          >
            <span className="flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wide text-[#AF52DE]">
              <Icon className="h-3 w-3" strokeWidth={2} />
              {label}
            </span>
            <p className="mt-0.5 text-left text-[12px] leading-snug text-[#1D1D1F]">
              {value}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
