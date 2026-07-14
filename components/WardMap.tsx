"use client";

import {
  Archive,
  ArrowUpDown,
  Bath,
  BedDouble,
  DoorOpen,
  Monitor,
  Sofa,
  Table2,
  Toilet,
  Tv,
  User,
  Users,
  WashingMachine,
} from "lucide-react";
import { useState, type CSSProperties, type ReactNode } from "react";
import { LOC, PATIENTS, ROOM_LAYOUT, type Loc } from "@/lib/wardData";

interface WardMapProps {
  selectedId: string;
  onSelectPatient: (id: string) => void;
}

/* 現在地が facility のエリアにいる患者名（例: デイルーム・面談室） */
function namesByLoc(loc: Loc): string[] {
  return Object.values(PATIENTS)
    .filter((p) => p.loc === loc)
    .map((p) => p.name);
}

/* ---------- ベッド ---------- */
function PatientBed({
  patientId,
  selected,
  onSelect,
}: {
  patientId: string;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const p = PATIENTS[patientId];
  const c = LOC[p.loc];
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onSelect(patientId);
      }}
      title={`${p.name}（${c.label}）`}
      className={[
        "relative flex h-full w-full flex-col items-center justify-center gap-1 overflow-hidden rounded-lg bg-white px-1 py-1.5 transition-all",
        selected
          ? "ring-2 ring-[#0A84FF] ring-offset-1"
          : "border border-[#DCDCE2] hover:border-[#9BC0F5]",
      ].join(" ")}
    >
      {/* ヘッドボード（現在地カラー） */}
      <span
        className="absolute inset-x-0 top-0 h-[3px]"
        style={{ background: c.color }}
      />
      <div
        className="flex h-9 w-9 items-center justify-center rounded-full"
        style={{ background: c.soft, border: `2px solid ${c.color}` }}
      >
        <User className="h-5 w-5" strokeWidth={1.75} style={{ color: c.color }} />
      </div>
      <span className="max-w-full truncate text-[11px] font-semibold text-[#1D1D1F]">
        {p.name}
      </span>
    </button>
  );
}

function EmptyBed() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-[#D2D2D8] bg-[#F6F6F8] px-1 py-1.5">
      <BedDouble className="h-5 w-5 text-[#C2C2C8]" strokeWidth={1.5} />
      <span className="text-[10px] text-[#AEAEB5]">空床</span>
    </div>
  );
}

/* ---------- 病室 ---------- */
function Room({
  no,
  style,
  selectedId,
  onSelectPatient,
}: {
  no: string;
  style: CSSProperties;
  selectedId: string;
  onSelectPatient: (id: string) => void;
}) {
  const { type, beds } = ROOM_LAYOUT[no];
  const hasSelected = beds.some((b) => b === selectedId);
  const isQuad = type === "4人部屋";
  return (
    <div
      style={style}
      className={[
        "flex min-h-0 min-w-0 flex-col rounded-xl bg-white p-2",
        hasSelected
          ? "ring-2 ring-[#0A84FF]"
          : "border border-[#CFCFD6]",
      ].join(" ")}
    >
      <div className="mb-1.5 flex shrink-0 items-baseline gap-1.5 border-b border-[#F0F0F3] pb-1">
        <span className="text-[13px] font-bold text-[#1D1D1F]">{no}</span>
        <span className="text-[10px] text-[#8E8E93]">{type}</span>
      </div>
      {isQuad ? (
        <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-1.5">
          {beds.map((b, i) =>
            b ? (
              <PatientBed
                key={i}
                patientId={b}
                selected={b === selectedId}
                onSelect={onSelectPatient}
              />
            ) : (
              <EmptyBed key={i} />
            ),
          )}
        </div>
      ) : (
        <div className="min-h-0 flex-1">
          {beds[0] ? (
            <PatientBed
              patientId={beds[0]}
              selected={beds[0] === selectedId}
              onSelect={onSelectPatient}
            />
          ) : (
            <EmptyBed />
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- 施設 ---------- */
function Facility({
  title,
  tone = "gray",
  style,
  className = "",
  onClick,
  children,
}: {
  title: string;
  tone?: "gray" | "blue" | "green" | "purple" | "bath";
  style?: CSSProperties;
  className?: string;
  onClick: () => void;
  children?: ReactNode;
}) {
  const tones: Record<string, string> = {
    gray: "bg-[#F7F7F9] border-[#CFCFD6]",
    blue: "bg-[#EEF5FF] border-[#C9DEF9]",
    green: "bg-[#EEFAF1] border-[#CBE9D4]",
    purple: "bg-[#F5EFFB] border-[#E1CDF2]",
    bath: "bg-[#E7F3FB] border-[#C6E1F2]",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      style={style}
      className={[
        "flex min-h-0 min-w-0 flex-col rounded-xl border p-2 text-left transition-all hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)]",
        tones[tone],
        className,
      ].join(" ")}
    >
      <span className="shrink-0 text-[11px] font-semibold text-[#1D1D1F]">
        {title}
      </span>
      {children && (
        <div className="flex min-h-0 flex-1 items-center justify-center">
          {children}
        </div>
      )}
    </button>
  );
}

/* 右側水回りの1マス（アイコン中心・視認性重視） */
function UtilityRoom({
  title,
  icon,
  tone = "gray",
  className = "",
  onClick,
  chips,
}: {
  title: string;
  icon: ReactNode;
  tone?: "gray" | "purple" | "bath";
  className?: string;
  onClick: () => void;
  chips?: { label: string; color: string; soft: string }[];
}) {
  const tones: Record<string, string> = {
    gray: "bg-[#F7F7F9] border-[#CFCFD6]",
    purple: "bg-[#F5EFFB] border-[#E1CDF2]",
    bath: "bg-[#E7F3FB] border-[#C6E1F2]",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex min-h-0 min-w-0 flex-col items-center justify-center gap-1 rounded-xl border p-1.5 text-center transition-all hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)]",
        tones[tone],
        className,
      ].join(" ")}
    >
      {icon}
      <span className="text-[11px] font-semibold text-[#1D1D1F]">{title}</span>
      {chips?.map((ch) => (
        <span
          key={ch.label}
          className="rounded-full px-1.5 py-[1px] text-[10px] font-medium"
          style={{ background: ch.soft, color: ch.color }}
        >
          {ch.label}
        </span>
      ))}
    </button>
  );
}

/* デイルームの簡略家具 */
function Furniture({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 text-[#9C7B45]">
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </div>
  );
}

/* 廊下（点線のセンターライン＋ラベル） */
function Corridor({ style }: { style: CSSProperties }) {
  return (
    <div
      style={style}
      className="flex items-center justify-center gap-2 rounded-full bg-[#F4F1EA]"
    >
      <span className="h-px flex-1 border-t border-dashed border-[#D0C8B8]" />
      <span className="shrink-0 text-[9px] font-medium tracking-widest text-[#B4AA98]">
        廊下
      </span>
      <span className="h-px flex-1 border-t border-dashed border-[#D0C8B8]" />
    </div>
  );
}

const LEGEND: Loc[] = ["room", "dayroom", "interview", "out", "exam"];

export default function WardMap({ selectedId, onSelectPatient }: WardMapProps) {
  const [toast, setToast] = useState<string | null>(null);
  const ping = (msg: string) => {
    setToast(msg);
    window.clearTimeout((ping as { _t?: number })._t);
    (ping as { _t?: number })._t = window.setTimeout(() => setToast(null), 1600);
  };

  const dayroomNames = namesByLoc("dayroom");
  const interviewNames = namesByLoc("interview");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* 平面図（外壁） */}
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border-2 border-[#B9B9C1] bg-[#EAE6DE] shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <div
          className="grid min-h-0 flex-1 gap-2 p-3"
          style={{
            gridTemplateColumns: "168px repeat(10, 1fr) 116px",
            gridTemplateRows: "1fr 22px 1.3fr 22px 1fr",
          }}
        >
          {/* 左上：ナースステーション（L字カウンター・PC・スタッフ） */}
          <Facility
            title="ナースステーション"
            tone="blue"
            onClick={() => ping("ナースステーション")}
            style={{ gridColumn: "1 / 2", gridRow: "1 / 4" }}
          >
            <div className="flex w-full flex-col items-center gap-2 px-1">
              {/* PC 2台 */}
              <div className="flex gap-2 text-[#0A84FF]">
                <Monitor className="h-5 w-5" strokeWidth={1.75} />
                <Monitor className="h-5 w-5" strokeWidth={1.75} />
              </div>
              {/* L字カウンター＋スタッフ */}
              <div className="relative h-9 w-[78%]">
                <span className="absolute inset-x-0 top-0 h-2 rounded-full bg-[#BBD5F7]" />
                <span className="absolute bottom-0 left-0 top-0 w-2 rounded-full bg-[#BBD5F7]" />
                <span className="absolute bottom-0 right-1 flex items-center gap-0.5 text-[#0A84FF]">
                  <Users className="h-5 w-5" strokeWidth={1.75} />
                </span>
              </div>
              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-[#0A84FF]">
                日勤スタッフ 6名
              </span>
            </div>
          </Facility>

          {/* 上段病室 */}
          <Room no="307" selectedId={selectedId} onSelectPatient={onSelectPatient} style={{ gridColumn: "2 / 4", gridRow: "1 / 2" }} />
          <Room no="308" selectedId={selectedId} onSelectPatient={onSelectPatient} style={{ gridColumn: "4 / 8", gridRow: "1 / 2" }} />
          <Room no="309" selectedId={selectedId} onSelectPatient={onSelectPatient} style={{ gridColumn: "8 / 10", gridRow: "1 / 2" }} />
          <Room no="310" selectedId={selectedId} onSelectPatient={onSelectPatient} style={{ gridColumn: "10 / 12", gridRow: "1 / 2" }} />

          {/* 右バンド：浴室・洗濯室・トイレ・物品庫・面談室 */}
          <div
            className="flex flex-col gap-2"
            style={{ gridColumn: "12 / 13", gridRow: "1 / 6" }}
          >
            <UtilityRoom
              title="浴室"
              tone="bath"
              className="flex-[1.3]"
              icon={<Bath className="h-6 w-6 text-[#32ADE6]" strokeWidth={1.6} />}
              onClick={() => ping("浴室")}
            />
            <UtilityRoom
              title="洗濯室"
              className="flex-1"
              icon={<WashingMachine className="h-5 w-5 text-[#6E6E73]" strokeWidth={1.6} />}
              onClick={() => ping("洗濯室")}
            />
            <UtilityRoom
              title="トイレ"
              className="flex-1"
              icon={<Toilet className="h-5 w-5 text-[#6E6E73]" strokeWidth={1.6} />}
              onClick={() => ping("トイレ")}
            />
            <UtilityRoom
              title="物品庫"
              className="flex-1"
              icon={<Archive className="h-5 w-5 text-[#6E6E73]" strokeWidth={1.6} />}
              onClick={() => ping("物品庫")}
            />
            <UtilityRoom
              title="面談室"
              tone="purple"
              className="flex-[1.3]"
              icon={<Users className="h-6 w-6 text-[#AF52DE]" strokeWidth={1.6} />}
              onClick={() => ping("面談室")}
              chips={interviewNames.map((n) => ({
                label: n,
                color: LOC.interview.color,
                soft: LOC.interview.soft,
              }))}
            />
          </div>

          {/* 廊下 */}
          <Corridor style={{ gridColumn: "2 / 12", gridRow: "2 / 3" }} />

          {/* 中央：デイルーム・食堂（TV・ソファ・テーブル） */}
          <button
            type="button"
            onClick={() => ping("デイルーム・食堂")}
            className="flex min-h-0 min-w-0 flex-col rounded-xl border border-[#E0D3BC] bg-[#F5EEDF] p-2.5 text-left transition-all hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)]"
            style={{ gridColumn: "2 / 12", gridRow: "3 / 4" }}
          >
            <span className="shrink-0 text-center text-[13px] font-bold text-[#8A6D42]">
              デイルーム・食堂
            </span>
            <div className="flex min-h-0 flex-1 items-center justify-center gap-8">
              <Furniture icon={<Tv className="h-7 w-7" strokeWidth={1.4} />} label="TV" />
              <Furniture icon={<Sofa className="h-7 w-7" strokeWidth={1.4} />} label="ソファ" />
              <Furniture icon={<Table2 className="h-7 w-7" strokeWidth={1.4} />} label="テーブル" />
              {dayroomNames.length > 0 && (
                <div className="flex flex-col items-start gap-1 border-l border-[#E0D3BC] pl-4">
                  <span className="text-[10px] text-[#8A6D42]">在室</span>
                  <div className="flex flex-wrap gap-1">
                    {dayroomNames.map((n) => (
                      <span
                        key={n}
                        className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                        style={{
                          background: LOC.dayroom.soft,
                          color: LOC.dayroom.color,
                        }}
                      >
                        {n}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </button>

          {/* 廊下 */}
          <Corridor style={{ gridColumn: "2 / 12", gridRow: "4 / 5" }} />

          {/* 左下：病棟入口・エレベーター */}
          <Facility
            title="病棟入口"
            tone="green"
            onClick={() => ping("病棟入口 ／ エレベーター")}
            style={{ gridColumn: "1 / 2", gridRow: "4 / 6" }}
          >
            <div className="flex flex-col items-center gap-1.5">
              <DoorOpen className="h-6 w-6 text-[#34C759]" strokeWidth={1.6} />
              <div className="flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-[#48484A]">
                <ArrowUpDown className="h-4 w-4" strokeWidth={1.75} />
                <span className="text-[10px] font-medium">エレベーター</span>
              </div>
            </div>
          </Facility>

          {/* 下段病室 */}
          <Room no="311" selectedId={selectedId} onSelectPatient={onSelectPatient} style={{ gridColumn: "2 / 6", gridRow: "5 / 6" }} />
          <Room no="312" selectedId={selectedId} onSelectPatient={onSelectPatient} style={{ gridColumn: "6 / 10", gridRow: "5 / 6" }} />
          <Corridor style={{ gridColumn: "10 / 12", gridRow: "5 / 6" }} />

          {toast && (
            <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-full border border-[#EBEBF0] bg-white/95 px-4 py-1.5 text-[12px] font-medium text-[#1D1D1F] shadow-lg backdrop-blur">
              {toast}
            </div>
          )}
        </div>
      </div>

      {/* 凡例：患者の現在の場所 */}
      <div className="mt-2 flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 px-1">
        <span className="text-[11px] font-medium text-[#8E8E93]">
          患者の現在の場所
        </span>
        {LEGEND.map((k) => (
          <span key={k} className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: LOC[k].color }}
            />
            <span className="text-[11px] text-[#48484A]">{LOC[k].label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
