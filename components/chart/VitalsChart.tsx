"use client";

import { useRef, useState } from "react";

// 統合バイタルグラフ（Alphaの情報構造を参考・Apple HIGで再設計）
// 体温＝右軸 / 脈拍・収縮期血圧・拡張期血圧＝左軸。1枚に重ねて表示。
// 色覚に依存しないよう「色 + 線種 + ポイント形状 + 凡例名」で区別する。
//   体温：青・実線・丸 / 脈拍：赤・実線・三角
//   収縮期血圧：黒・実線・四角 / 拡張期血圧：黒・破線・ひし形（中抜き）

export interface VitalPoint {
  date: string; // MM/DD
  temp: number | null;
  pulse: number | null;
  sysBP: number | null;
  diaBP: number | null;
}

type Shape = "circle" | "triangle" | "square" | "diamond";

const COLORS = {
  temp: "#0A84FF", // 青
  pulse: "#FF3B30", // 赤
  sysBP: "#1D1D1F", // 黒
  diaBP: "#1D1D1F", // 黒（破線で区別）
};

const VB_W = 720;
const VB_H = 260;
const PAD_L = 40;
const PAD_R = 38;
const PAD_T = 20;
const PAD_B = 38;
const PLOT_W = VB_W - PAD_L - PAD_R;
const PLOT_H = VB_H - PAD_T - PAD_B;

function niceRange(values: number[], padRatio = 0.15, minSpan = 0) {
  const vals = values.filter((v) => Number.isFinite(v));
  if (vals.length === 0) return { min: 0, max: 1 };
  let min = Math.min(...vals);
  let max = Math.max(...vals);
  if (max - min < minSpan) {
    const mid = (min + max) / 2;
    min = mid - minSpan / 2;
    max = mid + minSpan / 2;
  }
  const pad = (max - min) * padRatio || 1;
  return { min: min - pad, max: max + pad };
}

// 中心座標にポイント形状を描画
function Marker({
  cx,
  cy,
  shape,
  color,
  r,
  hollow,
}: {
  cx: number;
  cy: number;
  shape: Shape;
  color: string;
  r: number;
  hollow?: boolean;
}) {
  const fill = hollow ? "#FFFFFF" : color;
  const common = { fill, stroke: color, strokeWidth: hollow ? 1.5 : 0.5 };
  if (shape === "circle") return <circle cx={cx} cy={cy} r={r} {...common} />;
  if (shape === "square")
    return (
      <rect x={cx - r} y={cy - r} width={r * 2} height={r * 2} {...common} />
    );
  if (shape === "triangle")
    return (
      <polygon
        points={`${cx},${cy - r} ${cx + r},${cy + r} ${cx - r},${cy + r}`}
        {...common}
      />
    );
  // diamond
  return (
    <polygon
      points={`${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`}
      {...common}
    />
  );
}

export default function VitalsChart({ points }: { points: VitalPoint[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const n = points.length;

  const left = niceRange(
    points.flatMap((p) =>
      [p.pulse, p.sysBP, p.diaBP].filter((v): v is number => v !== null),
    ),
  );
  const right = niceRange(
    points.map((p) => p.temp).filter((v): v is number => v !== null),
    0.2,
    1.5,
  );

  const x = (i: number) =>
    n <= 1 ? PAD_L + PLOT_W / 2 : PAD_L + (i / (n - 1)) * PLOT_W;
  const yL = (v: number) =>
    PAD_T + (1 - (v - left.min) / (left.max - left.min)) * PLOT_H;
  const yR = (v: number) =>
    PAD_T + (1 - (v - right.min) / (right.max - right.min)) * PLOT_H;

  const line = (
    accessor: (p: VitalPoint) => number | null,
    scale: (v: number) => number,
  ) =>
    points
      .map((p, i) => {
        const v = accessor(p);
        return v === null ? null : `${x(i)},${scale(v)}`;
      })
      .filter((s): s is string => s !== null)
      .join(" ");

  const handlePointer = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg || n === 0) return;
    const rect = svg.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * VB_W;
    if (n === 1) {
      setActive(0);
      return;
    }
    const step = PLOT_W / (n - 1);
    const idx = Math.round((relX - PAD_L) / step);
    setActive(Math.max(0, Math.min(n - 1, idx)));
  };

  const leftTicks = 4;
  const ap = active !== null ? points[active] : null;

  return (
    <div className="rounded-xl border border-[#E5E5EA] bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      {/* 凡例（色＋線種＋形状で区別） */}
      <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1">
        <Legend color={COLORS.temp} shape="circle" label="体温(℃)" />
        <Legend color={COLORS.pulse} shape="triangle" label="脈拍(回/分)" />
        <Legend color={COLORS.sysBP} shape="square" label="収縮期血圧(mmHg・実線)" />
        <Legend
          color={COLORS.diaBP}
          shape="diamond"
          dashed
          hollow
          label="拡張期血圧(mmHg・破線)"
        />
      </div>

      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className="block h-auto w-full touch-none"
          role="img"
          aria-label="バイタルサインの推移グラフ"
          onPointerMove={handlePointer}
          onPointerDown={handlePointer}
          onPointerLeave={() => setActive(null)}
        >
          {/* 横グリッド＋左軸目盛（脈拍・血圧） */}
          {Array.from({ length: leftTicks + 1 }).map((_, t) => {
            const v = left.min + ((left.max - left.min) * t) / leftTicks;
            const yy = yL(v);
            return (
              <g key={`g${t}`}>
                <line
                  x1={PAD_L}
                  y1={yy}
                  x2={PAD_L + PLOT_W}
                  y2={yy}
                  stroke="#F0F0F2"
                  strokeWidth={1}
                />
                <text
                  x={PAD_L - 6}
                  y={yy + 3}
                  textAnchor="end"
                  className="fill-[#AEAEB5]"
                  style={{ fontSize: "9px" }}
                >
                  {Math.round(v)}
                </text>
              </g>
            );
          })}

          {/* 右軸目盛（体温＝青） */}
          {Array.from({ length: leftTicks + 1 }).map((_, t) => {
            const v = right.min + ((right.max - right.min) * t) / leftTicks;
            const yy = yR(v);
            return (
              <text
                key={`r${t}`}
                x={PAD_L + PLOT_W + 6}
                y={yy + 3}
                textAnchor="start"
                className="fill-[#0A84FF]"
                style={{ fontSize: "9px" }}
              >
                {v.toFixed(1)}
              </text>
            );
          })}

          {/* アクティブ日の縦ガイド */}
          {active !== null && (
            <line
              x1={x(active)}
              y1={PAD_T}
              x2={x(active)}
              y2={PAD_T + PLOT_H}
              stroke="#C7C7CC"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          )}

          {/* 系列（血圧：収縮期＝実線 / 拡張期＝破線・細線） */}
          <polyline points={line((p) => p.diaBP, yL)} fill="none" stroke={COLORS.diaBP} strokeWidth={1.2} strokeDasharray="5 4" strokeLinejoin="round" strokeLinecap="round" />
          <polyline points={line((p) => p.sysBP, yL)} fill="none" stroke={COLORS.sysBP} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          <polyline points={line((p) => p.pulse, yL)} fill="none" stroke={COLORS.pulse} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          <polyline points={line((p) => p.temp, yR)} fill="none" stroke={COLORS.temp} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          {/* 点（形状で区別） */}
          {points.map((p, i) => {
            const r = active === i ? 4 : 2.6;
            return (
              <g key={i}>
                {p.diaBP !== null && <Marker cx={x(i)} cy={yL(p.diaBP)} shape="diamond" color={COLORS.diaBP} r={r} hollow />}
                {p.sysBP !== null && <Marker cx={x(i)} cy={yL(p.sysBP)} shape="square" color={COLORS.sysBP} r={r} />}
                {p.pulse !== null && <Marker cx={x(i)} cy={yL(p.pulse)} shape="triangle" color={COLORS.pulse} r={r} />}
                {p.temp !== null && <Marker cx={x(i)} cy={yR(p.temp)} shape="circle" color={COLORS.temp} r={r} />}
              </g>
            );
          })}

          {/* x軸ラベル（日付） */}
          {points.map((p, i) => (
            <text
              key={`x${i}`}
              x={x(i)}
              y={VB_H - 12}
              textAnchor="middle"
              className={active === i ? "fill-[#1D1D1F]" : "fill-[#AEAEB5]"}
              style={{ fontSize: "9px", fontWeight: active === i ? 700 : 400 }}
            >
              {p.date}
            </text>
          ))}
        </svg>

        {/* ツールチップ */}
        {ap && (
          <div
            className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 rounded-lg border border-[#E5E5EA] bg-white/95 px-2.5 py-1.5 shadow-[0_4px_12px_rgba(0,0,0,0.1)] backdrop-blur"
            style={{ left: `${(x(active!) / VB_W) * 100}%` }}
          >
            <p className="mb-0.5 text-[10px] font-bold text-[#1D1D1F]">
              {ap.date}
            </p>
            <TipRow color={COLORS.temp} shape="circle" label="体温" value={ap.temp !== null ? `${ap.temp}℃` : "—"} />
            <TipRow color={COLORS.pulse} shape="triangle" label="脈拍" value={ap.pulse !== null ? `${ap.pulse}` : "—"} />
            <TipRow color={COLORS.sysBP} shape="square" label="収縮期" value={ap.sysBP !== null ? `${ap.sysBP}` : "—"} />
            <TipRow color={COLORS.diaBP} shape="diamond" hollow label="拡張期" value={ap.diaBP !== null ? `${ap.diaBP}` : "—"} />
          </div>
        )}
      </div>
    </div>
  );
}

// 凡例・ツールチップ用の小さな線＋マーカーサンプル
function Sample({
  color,
  shape,
  dashed,
  hollow,
}: {
  color: string;
  shape: Shape;
  dashed?: boolean;
  hollow?: boolean;
}) {
  return (
    <svg width={26} height={12} viewBox="0 0 26 12" className="shrink-0">
      <line
        x1={1}
        y1={6}
        x2={25}
        y2={6}
        stroke={color}
        strokeWidth={dashed ? 1.2 : 2}
        strokeDasharray={dashed ? "4 3" : undefined}
      />
      <Marker cx={13} cy={6} shape={shape} color={color} r={3.4} hollow={hollow} />
    </svg>
  );
}

function Legend({
  color,
  shape,
  label,
  dashed,
  hollow,
}: {
  color: string;
  shape: Shape;
  label: string;
  dashed?: boolean;
  hollow?: boolean;
}) {
  return (
    <span className="flex items-center gap-1 text-[10px] text-[#6E6E73]">
      <Sample color={color} shape={shape} dashed={dashed} hollow={hollow} />
      {label}
    </span>
  );
}

function TipRow({
  color,
  shape,
  label,
  value,
  hollow,
}: {
  color: string;
  shape: Shape;
  label: string;
  value: string;
  hollow?: boolean;
}) {
  return (
    <p className="flex items-center gap-1.5 text-[10px] leading-tight text-[#3A3A3C]">
      <Sample color={color} shape={shape} hollow={hollow} />
      <span className="text-[#8E8E93]">{label}</span>
      <span className="ml-auto font-semibold tabular-nums">{value}</span>
    </p>
  );
}
