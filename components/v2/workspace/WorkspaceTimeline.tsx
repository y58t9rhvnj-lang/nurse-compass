"use client";

// Compass Version2 Sprint1 — Patient Workspace 内の Timeline セクション。
//
// 方針（正式決定）:
//   ・ここで表示するのは現在の Clinical Timeline（診療録＋看護記録）である。
//   ・Understanding Timeline ではない（Version2 では実装しない）。
//   ・読取専用。元データ（V1）は変更・複製しない。表示時変換の buildClinicalTimeline を再利用する。

import { useMemo } from "react";
import { HeartPulse, Stethoscope } from "lucide-react";
import { getChartData } from "@/lib/chartData";
import {
  buildClinicalTimeline,
  RECORD_TYPE_LABEL,
  type TimelineRecord,
} from "@/lib/chartTimeline";

function byNewestFirst(a: TimelineRecord, b: TimelineRecord): number {
  return b.recordedAt.localeCompare(a.recordedAt);
}

export default function WorkspaceTimeline({ patientId }: { patientId: string }) {
  const records = useMemo(
    () => buildClinicalTimeline(getChartData(patientId), patientId).sort(byNewestFirst),
    [patientId],
  );

  if (records.length === 0) {
    return (
      <p className="text-[13px] text-[#8E8E93]">記録はまだありません。</p>
    );
  }

  return (
    <ul className="space-y-2.5">
      {records.map((r) => (
        <li
          key={r.id}
          className="rounded-2xl border border-[#EBEBF0] bg-white p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
        >
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <RecordBadge type={r.recordType} />
            <span className="text-[12.5px] font-semibold text-[#1D1D1F]">
              {r.date} {r.time}
            </span>
            <span className="text-[12px] text-[#8E8E93]">
              {r.profession}・{r.author}
            </span>
          </div>

          {r.focus && (
            <p className="mt-1.5 text-[12.5px] font-medium text-[#0A84FF]">
              # {r.focus}
            </p>
          )}

          {r.soap ? (
            <dl className="mt-1.5 space-y-1">
              <SoapRow label="S" value={r.soap.s} />
              <SoapRow label="O" value={r.soap.o} />
              <SoapRow label="A" value={r.soap.a} />
              <SoapRow label="P" value={r.soap.p} />
            </dl>
          ) : (
            r.content && (
              <p className="mt-1.5 whitespace-pre-line text-[13px] leading-relaxed text-[#3A3A3C]">
                {r.content}
              </p>
            )
          )}
        </li>
      ))}
    </ul>
  );
}

function RecordBadge({ type }: { type: TimelineRecord["recordType"] }) {
  const isNursing = type === "nursing";
  const Icon = isNursing ? HeartPulse : Stethoscope;
  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        isNursing
          ? "bg-[#FCEEF1] text-[#C2185B]"
          : "bg-[#E8F1FE] text-[#0A6CD6]",
      ].join(" ")}
    >
      <Icon className="h-3 w-3" strokeWidth={2} />
      {RECORD_TYPE_LABEL[type]}
    </span>
  );
}

function SoapRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex gap-2">
      <dt className="w-4 shrink-0 text-[12px] font-bold text-[#8E8E93]">{label}</dt>
      <dd className="whitespace-pre-line text-[13px] leading-relaxed text-[#3A3A3C]">
        {value}
      </dd>
    </div>
  );
}
