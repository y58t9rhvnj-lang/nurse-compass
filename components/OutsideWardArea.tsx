"use client";

import {
  Activity,
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
    icon: <Activity className="h-4 w-4" strokeWidth={2} />,
    color: "#34C759",
    soft: "#E7F8ED",
    patient: "Aさん", // 外出（OT）中
  },
  {
    name: "SST室",
    sub: "社会生活技能訓練",
    icon: <Users className="h-4 w-4" strokeWidth={2} />,
    color: "#0A84FF",
    soft: "#E9F2FF",
  },
  {
    name: "売店",
    sub: "ショッピング",
    icon: <ShoppingBag className="h-4 w-4" strokeWidth={2} />,
    color: "#FF9500",
    soft: "#FFF2E1",
  },
  {
    name: "中庭",
    sub: "リフレッシュ",
    icon: <TreePine className="h-4 w-4" strokeWidth={2} />,
    color: "#34C759",
    soft: "#E7F8ED",
  },
  {
    name: "リハビリ室",
    sub: "リハビリテーション",
    icon: <Dumbbell className="h-4 w-4" strokeWidth={2} />,
    color: "#0A84FF",
    soft: "#E9F2FF",
  },
];

export default function OutsideWardArea() {
  const outColor = LOC.out.color;
  const outSoft = LOC.out.soft;

  return (
    <div className="shrink-0">
      <p className="mb-1 px-1 text-[11px] font-medium text-[#8E8E93]">
        病棟外エリア
      </p>
      {/* Sprint D-2D 追加修正①: 病棟マップ・患者マークを最優先にするため、病棟外エリアは
          「低い高さの補助領域」として 1 行に固定する。カード（2 列グリッド）で高さを取ると
          マップ本体が圧迫され 4 人部屋の患者マークが潰れるため、コンパクトなチップを横 1 列に並べ、
          収まらない場合はこの領域内だけ横スクロールさせる（病棟ホーム全体には横スクロールを出さない）。
          Desktop の十分な横幅では 5 件がそのまま 1 列に収まる。サブラベルは省略して高さを抑える。 */}
      <div className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {areas.map((a) => (
          <button
            key={a.name}
            type="button"
            className="flex min-h-[40px] shrink-0 items-center gap-2 rounded-xl border border-[#EBEBF0] bg-white px-2.5 py-1.5 text-left shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-all hover:shadow-[0_4px_14px_rgba(0,0,0,0.07)]"
          >
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
              style={{ background: a.soft, color: a.color }}
            >
              {a.icon}
            </span>
            <span className="whitespace-nowrap text-[12px] font-semibold text-[#1D1D1F]">
              {a.name}
            </span>
            {a.patient && (
              <span
                className="whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                style={{ background: outSoft, color: outColor }}
              >
                {a.patient}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
