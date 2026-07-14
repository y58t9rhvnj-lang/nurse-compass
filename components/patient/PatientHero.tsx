import { Star, User } from "lucide-react";
import { LOC, type Patient } from "@/lib/wardData";

// 患者トップの主役。名前を最大に、診断名は補助（小さく）扱い。
export default function PatientHero({ patient }: { patient: Patient }) {
  const loc = LOC[patient.loc];
  return (
    <div className="rounded-2xl border border-[#EBEBF0] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="flex items-center gap-4">
        <div
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full"
          style={{ background: loc.soft }}
        >
          <User
            className="h-8 w-8"
            strokeWidth={1.5}
            style={{ color: loc.color }}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-[26px] font-bold leading-tight text-[#1D1D1F]">
              {patient.name}
            </h2>
            {patient.mine && (
              <Star
                className="h-5 w-5 text-[#FFB800]"
                strokeWidth={2}
                fill="#FFB800"
              />
            )}
            <span
              className="ml-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium"
              style={{ background: loc.soft, color: loc.color }}
            >
              {patient.locNote ?? loc.label}
            </span>
          </div>
          <p className="mt-1 text-[14px] text-[#48484A]">
            {patient.age}歳・{patient.sex}・{patient.room}号室
          </p>
          {/* 診断名は補助（小さく） */}
          <p className="mt-1.5 text-[11px] text-[#AEAEB5]">
            診断：{patient.diagnosis}
          </p>
        </div>
      </div>
    </div>
  );
}
