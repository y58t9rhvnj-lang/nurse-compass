"use client";

import {
  Activity,
  ChevronRight,
  Dumbbell,
  ShoppingBag,
  TreePine,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { LOC } from "@/lib/wardData";

const areas: {
  name: string;
  sub: string;
  icon: ReactNode;
  color: string;
  soft: string;
  patient?: string; // 現在そのエリアにいる患者
}[] = [
  {
    name: "OT室",
    sub: "作業療法",
    icon: <Activity className="h-5 w-5" strokeWidth={2} />,
    color: "#34C759",
    soft: "#E7F8ED",
    patient: "Aさん", // 外出（OT）中
  },
  {
    name: "SST室",
    sub: "社会生活技能訓練",
    icon: <Users className="h-5 w-5" strokeWidth={2} />,
    color: "#0A84FF",
    soft: "#E9F2FF",
  },
  {
    name: "売店",
    sub: "ショッピング",
    icon: <ShoppingBag className="h-5 w-5" strokeWidth={2} />,
    color: "#FF9500",
    soft: "#FFF2E1",
  },
  {
    name: "中庭",
    sub: "リフレッシュ",
    icon: <TreePine className="h-5 w-5" strokeWidth={2} />,
    color: "#34C759",
    soft: "#E7F8ED",
  },
  {
    name: "リハビリ室",
    sub: "リハビリテーション",
    icon: <Dumbbell className="h-5 w-5" strokeWidth={2} />,
    color: "#0A84FF",
    soft: "#E9F2FF",
  },
];

export default function OutsideWardArea() {
  const outColor = LOC.out.color;
  const outSoft = LOC.out.soft;

  return (
    <div className="shrink-0">
      <p className="mb-1.5 px-1 text-[11px] font-medium text-[#8E8E93]">
        病棟外エリア
      </p>
      <div className="grid grid-cols-5 gap-3">
        {areas.map((a) => (
          <button
            key={a.name}
            type="button"
            className="flex items-center gap-3 rounded-2xl border border-[#EBEBF0] bg-white px-3 py-2.5 text-left shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-all hover:shadow-[0_4px_14px_rgba(0,0,0,0.07)]"
          >
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ background: a.soft, color: a.color }}
            >
              {a.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold text-[#1D1D1F]">
                {a.name}
              </span>
              <span className="block truncate text-[10px] text-[#8E8E93]">
                {a.sub}
              </span>
              {a.patient && (
                <span
                  className="mt-1 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                  style={{ background: outSoft, color: outColor }}
                >
                  {a.patient}
                </span>
              )}
            </span>
            <ChevronRight
              className="h-4 w-4 shrink-0 text-[#C7C7CC]"
              strokeWidth={2}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
