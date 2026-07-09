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

const areas: {
  name: string;
  sub: string;
  icon: ReactNode;
  color: string;
  soft: string;
  grad: string;
}[] = [
  {
    name: "OT室",
    sub: "作業療法",
    icon: <Activity className="h-4 w-4" strokeWidth={2.25} />,
    color: "#34C759",
    soft: "#E7F8ED",
    grad: "linear-gradient(135deg,#EAF9EF,#F6FBEF)",
  },
  {
    name: "SST室",
    sub: "社会生活技能訓練",
    icon: <Users className="h-4 w-4" strokeWidth={2.25} />,
    color: "#0A84FF",
    soft: "#E9F2FF",
    grad: "linear-gradient(135deg,#E9F2FF,#EFF6FF)",
  },
  {
    name: "売店",
    sub: "ショッピング",
    icon: <ShoppingBag className="h-4 w-4" strokeWidth={2.25} />,
    color: "#FF2D92",
    soft: "#FFEAF3",
    grad: "linear-gradient(135deg,#FFEAF3,#FFF0F6)",
  },
  {
    name: "中庭",
    sub: "リフレッシュ",
    icon: <TreePine className="h-4 w-4" strokeWidth={2.25} />,
    color: "#FF9500",
    soft: "#FFF2E1",
    grad: "linear-gradient(135deg,#FFF3E3,#FBF7EC)",
  },
  {
    name: "リハビリ室",
    sub: "リハビリテーション",
    icon: <Dumbbell className="h-4 w-4" strokeWidth={2.25} />,
    color: "#30B0C7",
    soft: "#E4F6F9",
    grad: "linear-gradient(135deg,#E4F6F9,#EEF9FB)",
  },
];

export default function OutsideWardArea() {
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
            className="flex items-center gap-2.5 rounded-2xl border border-[#EBEBF0] px-3 py-2.5 text-left shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-all hover:shadow-[0_4px_14px_rgba(0,0,0,0.07)]"
            style={{ background: a.grad }}
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
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
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-[#C7C7CC]" strokeWidth={2} />
          </button>
        ))}
      </div>
    </div>
  );
}
