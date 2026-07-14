"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, History } from "lucide-react";
import type {
  ChartData,
  PrescriptionCategory,
  PrescriptionOrder,
} from "@/lib/chartData";
import type { ChartTabId } from "@/lib/chartTabs";
import type { ChartFocus, ChartNavRequest } from "@/lib/chartNav";

// 処方：一覧表ではなく「医師オーダー」として Rp 単位で読む画面
export default function PrescriptionsView({
  data,
  focus,
  onNavigate,
}: {
  data: ChartData;
  focus: ChartNavRequest | null;
  onNavigate: (tab: ChartTabId, focus: ChartFocus) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const orderRefs = useRef(new Map<string, HTMLDivElement>());
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [scrollTick, setScrollTick] = useState(0);
  const [scrollId, setScrollId] = useState<string | null>(null);

  // 対応する診療録記録が存在する処方のみ「関連する診療録を見る」を表示
  const clinicalIds = useMemo(
    () =>
      new Set(
        data.clinicalRecords
          .filter((r) => r.medicationChangeId)
          .map((r) => r.medicationChangeId as string),
      ),
    [data.clinicalRecords],
  );

  useEffect(() => {
    if (!focus || focus.focus.type !== "rxId") return;
    const id = focus.focus.id;
    const raf = requestAnimationFrame(() => {
      setHighlightId(id);
      setScrollId(id);
      setScrollTick((t) => t + 1);
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.token]);

  useEffect(() => {
    if (!scrollId) return;
    const raf = requestAnimationFrame(() => {
      orderRefs.current
        .get(scrollId)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    const t = window.setTimeout(() => setHighlightId(null), 1500);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollTick]);

  return (
    <div
      ref={scrollRef}
      className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto bg-[#F7F7F9] p-2.5"
    >
      <h3 className="px-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#8E8E93]">
        処方オーダー
      </h3>
      {data.prescriptionOrders.map((order, i) => {
        const id = order.medicationChangeId;
        const hasClinical = !!id && clinicalIds.has(id);
        return (
          <div
            key={i}
            ref={(el) => {
              if (id) {
                if (el) orderRefs.current.set(id, el);
                else orderRefs.current.delete(id);
              }
            }}
            className={[
              "rounded-xl transition-all duration-500",
              highlightId && id === highlightId
                ? "ring-2 ring-[#7B3FA0]/50 ring-offset-2"
                : "",
            ].join(" ")}
          >
            <OrderBlock
              order={order}
              onSeeClinical={
                hasClinical
                  ? () =>
                      onNavigate("診療録", { type: "clinicalId", id: id! })
                  : undefined
              }
            />
          </div>
        );
      })}

      <h3 className="mt-1.5 px-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#8E8E93]">
        処方履歴
      </h3>
      <HistoryTimeline items={data.prescriptionHistory} />
    </div>
  );
}

function CategoryBadge({ category }: { category: PrescriptionCategory }) {
  const style: Record<PrescriptionCategory, string> = {
    定期: "bg-[#EAF3FF] text-[#0A5FCC]",
    頓服: "bg-[#FFF2E1] text-[#C93400]",
    注射: "bg-[#F4EBFB] text-[#7B3FA0]",
    臨時: "bg-[#E7F8ED] text-[#1E7A3D]",
  };
  return (
    <span
      className={[
        "rounded-md px-2 py-0.5 text-[11px] font-semibold",
        style[category],
      ].join(" ")}
    >
      {category}
    </span>
  );
}

function StatusBadge({ status }: { status: NonNullable<PrescriptionOrder["status"]> }) {
  const style: Record<NonNullable<PrescriptionOrder["status"]>, string> = {
    active: "bg-[#E7F8ED] text-[#1E7A3D]",
    discontinued: "bg-[#F2F2F7] text-[#6E6E73]",
    completed: "bg-[#EAF3FF] text-[#0A5FCC]",
  };
  const label: Record<NonNullable<PrescriptionOrder["status"]>, string> = {
    active: "継続中",
    discontinued: "中止",
    completed: "完了",
  };
  return (
    <span className={["rounded-md px-2 py-0.5 text-[10.5px] font-semibold", style[status]].join(" ")}>
      {label[status]}
    </span>
  );
}

function OrderBlock({
  order,
  onSeeClinical,
}: {
  order: PrescriptionOrder;
  onSeeClinical?: () => void;
}) {
  return (
    <article className="overflow-hidden rounded-xl border border-[#E5E5EA] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[#F0F0F2] bg-[#FAFAFC] px-3.5 py-2.5">
        <time className="text-[13px] font-bold tabular-nums text-[#1D1D1F]">
          {order.datetime}
        </time>
        <CategoryBadge category={order.category} />
        {order.status && <StatusBadge status={order.status} />}
        {order.endDate && (
          <span className="text-[11px] text-[#8E8E93]">〜{order.endDate}</span>
        )}
        <span className="ml-auto text-[12px] text-[#3A3A3C]">
          {order.doctor}
        </span>
      </div>

      <div className="px-3.5 py-3">
        <p className="mb-1.5 text-[13px] font-bold text-[#1D1D1F]">Rp</p>
        <div className="space-y-3">
          {order.groups.map((g) => (
            <div key={g.no} className="flex gap-2">
              <span className="mt-0.5 w-5 shrink-0 text-[13px] font-semibold text-[#6E6E73]">
                {g.no}）
              </span>
              <div className="min-w-0 flex-1">
                {g.drugs.map((d, di) => (
                  <div
                    key={di}
                    className="flex items-baseline justify-between gap-3 border-b border-dashed border-[#F0F0F2] py-1 last:border-0"
                  >
                    <span className="text-[13px] text-[#1D1D1F]">{d.name}</span>
                    <span className="shrink-0 text-[13px] font-semibold tabular-nums text-[#1D1D1F]">
                      {d.amount}
                    </span>
                  </div>
                ))}
                <div className="mt-1 flex flex-col items-end gap-0.5">
                  <span className="text-[12.5px] font-medium text-[#0A5FCC]">
                    {g.usage}
                  </span>
                  {g.days && (
                    <span className="text-[12px] text-[#6E6E73]">{g.days}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {(order.reason || order.comment) && (
          <div className="mt-3 space-y-1.5 border-t border-[#F0F0F2] pt-2.5">
            {order.reason && (
              <p className="flex gap-2 text-[12px] leading-relaxed text-[#3A3A3C]">
                <span className="shrink-0 rounded bg-[#F2F2F7] px-1.5 py-0.5 text-[10px] font-semibold text-[#6E6E73]">
                  変更理由
                </span>
                {order.reason}
              </p>
            )}
            {order.comment && (
              <p className="flex gap-2 text-[12px] leading-relaxed text-[#3A3A3C]">
                <span className="shrink-0 rounded bg-[#FFF2E1] px-1.5 py-0.5 text-[10px] font-semibold text-[#C93400]">
                  コメント
                </span>
                {order.comment}
              </p>
            )}
          </div>
        )}

        {onSeeClinical && (
          <button
            type="button"
            onClick={onSeeClinical}
            className="mt-3 inline-flex min-h-[44px] items-center gap-1 rounded-lg bg-[#EAF3FF] px-2.5 text-[11px] font-semibold text-[#0A5FCC] transition hover:bg-[#DCE9FB]"
          >
            <FileText className="h-3.5 w-3.5" strokeWidth={2} />
            関連する診療録を見る
          </button>
        )}
      </div>
    </article>
  );
}

function HistoryTimeline({ items }: { items: ChartData["prescriptionHistory"] }) {
  return (
    <div className="rounded-xl border border-[#E5E5EA] bg-white px-3.5 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <ol className="relative ml-1 border-l border-[#E5E5EA]">
        {items.map((it, i) => (
          <li key={i} className="mb-3 pl-4 last:mb-0">
            <span className="absolute -left-[5px] mt-1 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-[#0A84FF]" />
            <time className="text-[12px] font-bold tabular-nums text-[#1D1D1F]">
              {it.date}
            </time>
            <p className="mt-0.5 flex items-center gap-1 text-[12.5px] text-[#3A3A3C]">
              <History className="h-3 w-3 shrink-0 text-[#AEAEB5]" strokeWidth={2} />
              {it.label}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
