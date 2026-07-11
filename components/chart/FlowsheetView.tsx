"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, ShieldAlert } from "lucide-react";
import {
  deriveMedSlots,
  deriveRestrictionMap,
  parseVitals,
  type ChartData,
  type DailyRestriction,
  type FlowsheetDay,
  type MedAdminStatus,
  type MedSlot,
} from "@/lib/chartData";
import type { ChartTabId } from "@/lib/chartTabs";
import type { ChartFocus } from "@/lib/chartNav";
import DateSelect from "./DateSelect";
import VitalsChart, { type VitalPoint } from "./VitalsChart";

const PAGE_SIZE = 7;

function shortDate(d: string) {
  const p = d.split("/");
  return p.length === 3 ? `${p[1]}/${p[2]}` : d;
}

// フローシート：1枚の縦スクロール文書。7日単位でページ送り。
// 行動制限の詳細は診療録に一元化し、ここでは日別の派生マークとリンクのみを持つ。
export default function FlowsheetView({
  data,
  onNavigate,
}: {
  data: ChartData;
  onNavigate: (tab: ChartTabId, focus: ChartFocus) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // 診療録の行動制限記録から日別マークを導出（手入力の二重管理をしない）
  const restrictionMap = useMemo(
    () => deriveRestrictionMap(data.clinicalRecords),
    [data.clinicalRecords],
  );

  // 服薬スロット（朝昼夕就寝前のどれに定期薬があるか）を処方から導出
  const medSlots = useMemo(
    () => deriveMedSlots(data.prescriptionOrders),
    [data.prescriptionOrders],
  );

  // 時系列（古い→新しい）に並べ替えた全日。代表週（連続7日ブロック）が並ぶ。
  const chronoDays: FlowsheetDay[] = useMemo(
    () => [...data.flowsheet].sort((a, b) => a.date.localeCompare(b.date)),
    [data.flowsheet],
  );
  // 日付ピッカー候補：その患者のフローシート日付
  const dateOptions = useMemo(
    () => chronoDays.map((d) => d.date),
    [chronoDays],
  );
  const lastWeekStart = Math.max(
    0,
    Math.floor((chronoDays.length - 1) / PAGE_SIZE) * PAGE_SIZE,
  );

  // 「現在表示中の日付」state。将来的に診療録・検査・処方と共有できるよう、
  // ページ番号ではなく日付で保持する（表示ウィンドウは日付から導出）。
  const [currentDate, setCurrentDate] = useState<string>(
    () => chronoDays[chronoDays.length - 1]?.date ?? "",
  );

  // currentDate を含む代表週（7日ブロック）を導出。
  const rawIndex = chronoDays.findIndex((d) => d.date === currentDate);
  const idx = rawIndex < 0 ? chronoDays.length - 1 : rawIndex;
  const weekStart = Math.floor(idx / PAGE_SIZE) * PAGE_SIZE;
  const windowDays = chronoDays.slice(weekStart, weekStart + PAGE_SIZE);

  const rangeLabel =
    windowDays.length > 0
      ? `${windowDays[0].date}〜${windowDays[windowDays.length - 1].date}`
      : "—";

  const canOlder = weekStart > 0;
  const canNewer = weekStart < lastWeekStart;

  const goOlder = () => {
    const s = Math.max(0, weekStart - PAGE_SIZE);
    setCurrentDate(chronoDays[s]?.date ?? currentDate);
  };
  const goNewer = () => {
    const s = Math.min(lastWeekStart, weekStart + PAGE_SIZE);
    setCurrentDate(chronoDays[s]?.date ?? currentDate);
  };

  const points: VitalPoint[] = windowDays.map((d) => {
    const v = parseVitals(d.vitals);
    return {
      date: shortDate(d.date),
      temp: v.temp,
      pulse: v.pulse,
      sysBP: v.sysBP,
      diaBP: v.diaBP,
    };
  });

  // 特記事項タイトル → 診療録タブの大元の看護記録へ
  const openNursingRecord = (id: string) =>
    onNavigate("診療録", { type: "nursingId", id });

  // 行動制限マーク → 診療録タブの該当イベント群へ
  const openRestriction = (eventId: string) =>
    onNavigate("診療録", { type: "restrictionId", id: eventId });

  return (
    <div
      ref={scrollRef}
      className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto bg-[#F7F7F9] p-2.5"
    >
      {/* ① 期間表示＋日付指定 */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#E5E5EA] bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <span className="text-[12px] font-semibold text-[#1D1D1F]">
          フローシート
        </span>
        <span className="rounded-full bg-[#EAF3FF] px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-[#0A5FCC]">
          {rangeLabel}
        </span>
        <div className="ml-auto flex items-center gap-1.5 text-[11px] text-[#6E6E73]">
          表示期間
          <DateSelect
            dates={dateOptions}
            value={windowDays[0]?.date ?? currentDate}
            onChange={setCurrentDate}
          />
        </div>
      </div>

      {/* ② 統合グラフ */}
      <Section title="バイタルサイン">
        <VitalsChart points={points} />
      </Section>

      {/* ③ 日別フロー表 */}
      <Section title="日別フロー">
        <FlowTable
          days={windowDays}
          restrictionMap={restrictionMap}
          medSlots={medSlots}
          onOpenNursing={openNursingRecord}
          onOpenRestriction={openRestriction}
        />
      </Section>

      {/* 7日ページ送り（日付指定と同期） */}
      <div className="flex items-center gap-2 rounded-xl border border-[#E5E5EA] bg-white px-2.5 py-2 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <button
          type="button"
          onClick={goOlder}
          disabled={!canOlder}
          className="flex min-h-[44px] items-center gap-0.5 rounded-lg px-2.5 text-[12px] font-semibold text-[#0A84FF] transition enabled:hover:bg-[#EAF3FF] disabled:text-[#C7C7CC]"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={2} />
          前の7日
        </button>
        <span className="flex-1 text-center text-[12px] font-semibold tabular-nums text-[#1D1D1F]">
          {rangeLabel}
        </span>
        <button
          type="button"
          onClick={goNewer}
          disabled={!canNewer}
          className="flex min-h-[44px] items-center gap-0.5 rounded-lg px-2.5 text-[12px] font-semibold text-[#0A84FF] transition enabled:hover:bg-[#EAF3FF] disabled:text-[#C7C7CC]"
        >
          次の7日
          <ChevronRight className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
  anchorRef,
  highlighted,
}: {
  title: string;
  children: ReactNode;
  anchorRef?: React.RefObject<HTMLDivElement | null>;
  highlighted?: boolean;
}) {
  return (
    <div
      ref={anchorRef}
      className={[
        "scroll-mt-2 rounded-xl transition-all duration-500",
        highlighted ? "ring-2 ring-[#7B3FA0]/45 ring-offset-2" : "",
      ].join(" ")}
    >
      <h3 className="mb-1.5 px-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#8E8E93]">
        {title}
      </h3>
      {children}
    </div>
  );
}

const MED_SLOTS: MedSlot[] = ["朝", "昼", "夕", "就寝前"];

// 服薬実施状況の記号 → 落ち着いた識別色
const MED_STYLE: Record<MedAdminStatus, string> = {
  自: "bg-[#EAF5EC] text-[#2E7D46]", // 自立（緑）
  促: "bg-[#EAF3FF] text-[#0A5FCC]", // 声かけ（青）
  介: "bg-[#F4EBFB] text-[#7B3FA0]", // 介助（紫）
  拒: "bg-[#FFF2E1] text-[#C93400]", // 拒否（橙）
  保: "bg-[#F2F2F7] text-[#6E6E73]", // 保留（灰）
  未: "bg-[#F2F2F7] text-[#8E8E93]", // 未実施（灰）
};
const MED_LABEL: Record<MedAdminStatus, string> = {
  自: "自立",
  促: "声かけ",
  介: "介助",
  拒: "拒否",
  保: "保留",
  未: "未実施",
};

function FlowTable({
  days,
  restrictionMap,
  medSlots,
  onOpenNursing,
  onOpenRestriction,
}: {
  days: FlowsheetDay[];
  restrictionMap: Map<string, DailyRestriction>;
  medSlots: Record<MedSlot, boolean>;
  onOpenNursing: (id: string) => void;
  onOpenRestriction: (eventId: string) => void;
}) {
  const rows: { label: string; render: (d: FlowsheetDay) => ReactNode }[] = [
    { label: "体温", render: (d) => `${parseVitals(d.vitals).temp ?? "—"}` },
    { label: "脈拍", render: (d) => `${parseVitals(d.vitals).pulse ?? "—"}` },
    {
      label: "血圧",
      render: (d) => {
        const v = parseVitals(d.vitals);
        return v.sysBP && v.diaBP ? `${v.sysBP}/${v.diaBP}` : "—";
      },
    },
    { label: "睡眠", render: (d) => d.sleep },
    { label: "食事", render: (d) => d.meal },
    { label: "排泄", render: (d) => d.elimination },
    { label: "活動", render: (d) => d.activity },
  ];

  // 服薬区分ごとの実施状況（既定：処方から導出したスロット=「自」）
  const medStatus = (d: FlowsheetDay, slot: MedSlot): MedAdminStatus | null => {
    const override = d.medicationAdmin?.[slot];
    if (override) return override;
    return medSlots[slot] ? "自" : null;
  };

  return (
    <div className="space-y-1.5">
    <div className="max-h-[56vh] overflow-auto rounded-xl border border-[#E5E5EA] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <table className="border-collapse text-left text-[11.5px]">
        <thead>
          <tr className="border-b border-[#E5E5EA]">
            {/* 左上コーナー：縦横どちらのスクロールでも固定 */}
            <th className="sticky left-0 top-0 z-30 min-w-[64px] border-b border-[#E5E5EA] bg-[#F7F7F9] px-2.5 py-2 font-semibold text-[#6E6E73]">
              項目
            </th>
            {days.map((d) => (
              <th
                key={d.date}
                className="sticky top-0 z-20 min-w-[104px] whitespace-nowrap border-b border-[#E5E5EA] bg-[#F7F7F9] px-2.5 py-2 text-center font-semibold text-[#1D1D1F]"
              >
                <div>{shortDate(d.date)}</div>
                <div className="text-[9px] font-normal text-[#AEAEB5]">
                  {d.dayOfStay}日目
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-[#F0F0F2]">
              <th className="sticky left-0 z-10 bg-white px-2.5 py-2 text-left font-medium text-[#6E6E73]">
                {row.label}
              </th>
              {days.map((d) => (
                <td key={d.date} className="px-2.5 py-2 align-top text-[#1D1D1F]">
                  {row.render(d)}
                </td>
              ))}
            </tr>
          ))}

          {/* 服薬（朝・昼・夕・就寝前の実施状況。記号のみ、詳細は処方タブ） */}
          {MED_SLOTS.map((slot, si) => (
            <tr key={`med-${slot}`} className="border-b border-[#F0F0F2]">
              <th className="sticky left-0 z-10 bg-white px-2.5 py-2 text-left font-medium text-[#6E6E73]">
                {si === 0 && (
                  <span className="mr-1 text-[10px] font-normal text-[#AEAEB5]">
                    服薬
                  </span>
                )}
                {slot}
              </th>
              {days.map((d) => {
                const st = medStatus(d, slot);
                return (
                  <td key={d.date} className="px-1.5 py-1.5 text-center align-top">
                    {st ? (
                      <span
                        title={MED_LABEL[st]}
                        aria-label={`${slot}：${MED_LABEL[st]}`}
                        className={[
                          "inline-flex h-7 w-full min-w-[36px] items-center justify-center rounded-lg text-[12px] font-bold",
                          MED_STYLE[st],
                        ].join(" ")}
                      >
                        {st}
                      </span>
                    ) : (
                      <span className="text-[#C7C7CC]">—</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}

          {/* 行動制限 */}
          <tr className="border-b border-[#F0F0F2]">
            <th className="sticky left-0 z-10 bg-white px-2.5 py-2 text-left font-medium text-[#6E6E73]">
              行動制限
            </th>
            {days.map((d) => {
              const rest = restrictionMap.get(d.date);
              return (
                <td key={d.date} className="px-1.5 py-1.5 text-center align-top">
                  {rest ? (
                    <button
                      type="button"
                      onClick={() => onOpenRestriction(rest.eventId)}
                      aria-label={`${d.date}の行動制限（${rest.label}）の診療録へ`}
                      className="inline-flex min-h-[44px] w-full items-center justify-center gap-1 rounded-lg bg-[#F4EBFB] px-1 text-[11px] font-semibold text-[#7B3FA0] transition hover:bg-[#EAD9F7]"
                    >
                      <ShieldAlert className="h-3 w-3 shrink-0" strokeWidth={2} />
                      {rest.label}
                    </button>
                  ) : (
                    <span className="text-[#C7C7CC]">—</span>
                  )}
                </td>
              );
            })}
          </tr>

          {/* 看護記録：特記事項タイトル */}
          <tr>
            <th className="sticky left-0 z-10 bg-white px-2.5 py-2 text-left font-medium text-[#6E6E73]">
              看護記録
            </th>
            {days.map((d) => (
              <td key={d.date} className="px-1.5 py-1.5 align-top">
                {d.specialNote && d.nursingRecordId ? (
                  <button
                    type="button"
                    onClick={() => onOpenNursing(d.nursingRecordId!)}
                    aria-label={`${d.date}の看護記録へ：${d.specialNote}`}
                    className="line-clamp-2 min-h-[44px] w-full rounded-lg bg-[#EAF3FF] px-1.5 py-1 text-left text-[11px] font-medium leading-snug text-[#0A5FCC] transition hover:bg-[#DCE9FB]"
                  >
                    {d.specialNote}
                  </button>
                ) : (
                  <span className="block px-1 py-1 text-center text-[11px] text-[#AEAEB5]">
                    特記事項なし
                  </span>
                )}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
      {/* 服薬記号の凡例 */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[10px] text-[#8E8E93]">
        <span className="font-medium text-[#6E6E73]">服薬</span>
        {(Object.keys(MED_LABEL) as MedAdminStatus[]).map((k) => (
          <span key={k} className="flex items-center gap-1">
            <span
              className={[
                "inline-flex h-4 w-4 items-center justify-center rounded text-[10px] font-bold",
                MED_STYLE[k],
              ].join(" ")}
            >
              {k}
            </span>
            {MED_LABEL[k]}
          </span>
        ))}
        <span className="text-[#AEAEB5]">／ 詳細は処方タブで確認</span>
      </div>
    </div>
  );
}

