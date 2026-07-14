"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChartData, NursingRecord } from "@/lib/chartData";
import {
  DEFAULT_NURSING_SUB_TAB,
  NURSING_SUB_TABS,
  NURSING_SUBNAV_STICKY_CLASS,
  NURSING_TYPE_FILTERS,
  inferNursingType,
  normalizeSoapFields,
  nursingTypeLabel,
  type NursingSubTab,
  type NursingSummaryRecord,
  type NursingTypeFilter,
} from "@/lib/nursingChart";
import { EmptyState, FilterChips, TabCount } from "./ChartUi";

function subTabStorageKey(patientId: string) {
  return `compass-nursing-sub-${patientId}`;
}

function readStoredSubTab(patientId: string): NursingSubTab {
  if (typeof window === "undefined") return DEFAULT_NURSING_SUB_TAB;
  const raw = sessionStorage.getItem(subTabStorageKey(patientId));
  if (raw === "plan" || raw === "summary" || raw === "daily") return raw;
  return DEFAULT_NURSING_SUB_TAB;
}

function NursingSubNav({
  active,
  onChange,
}: {
  active: NursingSubTab;
  onChange: (tab: NursingSubTab) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="看護記録のサブビュー"
      className="flex gap-1 rounded-xl bg-[#ECECEF] p-1"
    >
      {NURSING_SUB_TABS.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={[
              "min-h-[44px] flex-1 rounded-lg px-2 text-[12px] font-semibold transition-colors",
              isActive
                ? "bg-white text-[#1D1D1F] shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                : "text-[#6E6E73] hover:text-[#3A3A3C]",
            ].join(" ")}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function TypeBadge({ type }: { type: ReturnType<typeof inferNursingType> }) {
  const label = nursingTypeLabel(type);
  const styles =
    type === "soap"
      ? "bg-[#E8F5E9] text-[#2E7D32]"
      : type === "pos"
        ? "bg-[#EAF3FF] text-[#0A5FCC]"
        : "bg-[#F2F2F7] text-[#6E6E73]";
  return (
    <span
      className={`inline-flex min-h-[22px] items-center rounded-md px-1.5 text-[10px] font-bold ${styles}`}
    >
      {label}
    </span>
  );
}

function SoapBlock({
  label,
  text,
  empty = false,
}: {
  label: string;
  text: string;
  empty?: boolean;
}) {
  return (
    <div className="flex gap-2 border-t border-[#F0F0F2] pt-1.5 text-[12.5px] leading-[1.55] text-[#3A3A3C] first:border-t-0 first:pt-0">
      <span className="w-4 shrink-0 font-bold text-[#2E7D32]">{label}:</span>
      <p
        className={`min-w-0 flex-1 whitespace-pre-wrap break-words ${
          empty ? "text-[#8E8E93]" : ""
        }`}
      >
        {empty ? "記載なし" : text}
      </p>
    </div>
  );
}

function DailyRecordCard({ record }: { record: NursingRecord }) {
  const type = inferNursingType(record);
  const { s, o, a, p } = normalizeSoapFields(record);

  return (
    <article className="rounded-lg border border-[#E5E5EA] bg-white px-3.5 py-2.5">
      <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <TypeBadge type={type} />
        <time className="text-[12px] font-bold text-[#1D1D1F]">{record.date}</time>
        <span className="text-[12px] tabular-nums text-[#6E6E73]">{record.time}</span>
        <span className="ml-auto text-[11px] text-[#8E8E93]">記録者：{record.author}</span>
      </div>

      {type === "soap" ? (
        <div className="space-y-1.5">
          {(record.problemNumber || record.focus) && (
            <p className="text-[11px] font-semibold text-[#0A5FCC]">
              {record.problemNumber ? `#${record.problemNumber}` : ""}
              {record.problemNumber && record.focus ? " " : ""}
              {record.focus ?? ""}
            </p>
          )}
          <SoapBlock label="S" text={s} empty={s.trim() === ""} />
          <SoapBlock label="O" text={o} empty={o.trim() === ""} />
          <SoapBlock label="A" text={a} empty={a.trim() === ""} />
          <SoapBlock label="P" text={p} empty={p.trim() === ""} />
        </div>
      ) : type === "pos" ? (
        <div className="space-y-1.5 text-[12.5px] leading-[1.55] text-[#3A3A3C]">
          {(record.problemNumber || record.focus) && (
            <p className="font-semibold text-[#0A5FCC]">
              {record.problemNumber ? `#${record.problemNumber}` : "#"}
              {record.focus ?? ""}
            </p>
          )}
          {(record.course ?? record.body) && (
            <div>
              <span className="font-semibold text-[#1D1D1F]">経過:</span>
              <p className="mt-0.5 whitespace-pre-wrap break-words">
                {record.course ?? record.body}
              </p>
            </div>
          )}
          {record.posEvaluation && (
            <div>
              <span className="font-semibold text-[#1D1D1F]">評価:</span>
              <p className="mt-0.5 whitespace-pre-wrap break-words">{record.posEvaluation}</p>
            </div>
          )}
          {record.posPlan && (
            <div>
              <span className="font-semibold text-[#1D1D1F]">計画:</span>
              <p className="mt-0.5 whitespace-pre-wrap break-words">{record.posPlan}</p>
            </div>
          )}
        </div>
      ) : (
        <p className="whitespace-pre-wrap break-words text-[12.5px] leading-[1.55] text-[#3A3A3C]">
          {record.narrative ?? record.content}
        </p>
      )}
    </article>
  );
}

function NursingPlanView({ data }: { data: ChartData }) {
  if (data.nursingPlanItems.length === 0) {
    return <EmptyState text="この患者の看護計画はありません" />;
  }
  return (
    <div className="space-y-2.5">
      {data.nursingPlanItems.map((item) => (
        <article
          key={item.problemNumber}
          className="overflow-hidden rounded-xl border border-[#E5E5EA] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
        >
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-[#F0F0F2] bg-[#FAFAFC] px-3.5 py-2.5">
            <span className="inline-flex min-h-[22px] items-center rounded-md bg-[#EAF3FF] px-2 text-[11px] font-bold text-[#0A5FCC]">
              {item.problemNumber}
            </span>
            <h4 className="text-[13px] font-bold text-[#1D1D1F]">{item.problem}</h4>
            <span className="ml-auto inline-flex rounded-md bg-[#F2F2F7] px-2 py-0.5 text-[10px] font-semibold text-[#6E6E73]">
              {item.status}
            </span>
          </div>
          <dl className="divide-y divide-[#F0F0F2] px-3.5 py-1">
            {(
              [
                ["長期目標", item.longTermGoal],
                ["短期目標", item.shortTermGoal],
                ["OP", item.op],
                ["TP", item.tp],
                ["EP", item.ep],
                ["開始日", item.startDate],
                ["評価日", item.reviewDate],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="py-2">
                <dt className="mb-0.5 text-[11px] font-semibold text-[#6E6E73]">{label}</dt>
                <dd className="text-[12.5px] leading-[1.55] text-[#3A3A3C]">{value}</dd>
              </div>
            ))}
          </dl>
        </article>
      ))}
    </div>
  );
}

const SUMMARY_FIELDS: { key: keyof NursingSummaryRecord; label: string }[] = [
  { key: "living", label: "生活状況" },
  { key: "symptoms", label: "症状" },
  { key: "sleep", label: "睡眠" },
  { key: "medication", label: "服薬" },
  { key: "adl", label: "ADL / セルフケア" },
  { key: "activity", label: "活動" },
  { key: "interpersonal", label: "対人関係" },
  { key: "physical", label: "身体管理" },
  { key: "ongoingIssues", label: "継続課題" },
  { key: "strengths", label: "強み・変化" },
];

function NursingSummaryView({ data }: { data: ChartData }) {
  if (data.nursingSummaries.length === 0) {
    return <EmptyState text="この患者の看護サマリーはありません" />;
  }
  const sorted = [...data.nursingSummaries].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className="space-y-2.5">
      {sorted.map((s) => (
        <article
          key={s.id}
          className="overflow-hidden rounded-xl border border-[#E5E5EA] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
        >
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-[#F0F0F2] bg-[#FAFAFC] px-3.5 py-2.5">
            <h4 className="text-[13px] font-bold text-[#1D1D1F]">{s.title}</h4>
            <span className="text-[11px] text-[#6E6E73]">対象期間：{s.period}</span>
            <time className="text-[12px] tabular-nums text-[#6E6E73]">{s.date}</time>
            <span className="ml-auto text-[11px] text-[#8E8E93]">作成者：{s.author}</span>
          </div>
          <dl className="divide-y divide-[#F0F0F2] px-3.5 py-1">
            {SUMMARY_FIELDS.map(({ key, label }) => (
              <div key={key} className="py-2">
                <dt className="mb-0.5 text-[11px] font-semibold text-[#6E6E73]">{label}</dt>
                <dd className="text-[12.5px] leading-[1.55] text-[#3A3A3C]">{s[key]}</dd>
              </div>
            ))}
          </dl>
        </article>
      ))}
    </div>
  );
}

function DailyRecordsView({ data }: { data: ChartData }) {
  const [typeFilter, setTypeFilter] = useState<NursingTypeFilter>("all");

  const sorted = useMemo(
    () =>
      [...data.nursingRecords].sort((a, b) => {
        const d = b.date.localeCompare(a.date);
        return d !== 0 ? d : b.time.localeCompare(a.time);
      }),
    [data.nursingRecords],
  );

  const filtered = useMemo(() => {
    if (typeFilter === "all") return sorted;
    return sorted.filter((r) => inferNursingType(r) === typeFilter);
  }, [sorted, typeFilter]);

  const filterLabels = NURSING_TYPE_FILTERS.map((f) => f.label);
  const activeLabel =
    NURSING_TYPE_FILTERS.find((f) => f.id === typeFilter)?.label ?? "すべて";

  return (
    <>
      <FilterChips
        options={filterLabels}
        active={activeLabel}
        onChange={(label) => {
          const next = NURSING_TYPE_FILTERS.find((f) => f.label === label);
          if (next) setTypeFilter(next.id);
        }}
      />
      <TabCount count={filtered.length} />
      {filtered.length === 0 ? (
        <EmptyState text="該当する記録はありません" />
      ) : (
        <div className="space-y-2">
          {filtered.map((r, i) => (
            <DailyRecordCard key={r.id ?? `${r.date}-${r.time}-${i}`} record={r} />
          ))}
        </div>
      )}
    </>
  );
}

export default function NursingRecordView({
  data,
  patientId,
}: {
  data: ChartData;
  patientId: string;
}) {
  const [subTab, setSubTab] = useState<NursingSubTab>(() =>
    readStoredSubTab(patientId),
  );

  useEffect(() => {
    sessionStorage.setItem(subTabStorageKey(patientId), subTab);
  }, [patientId, subTab]);

  return (
    // スクロールコンテナ。上部パディングを 0 にして sticky サブナビを上位タブの直下に密着させる
    // （記録本文がバー間の隙間から透けないようにするための Hotfix）。
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-[#F7F7F9]">
      <div className={NURSING_SUBNAV_STICKY_CLASS}>
        <NursingSubNav active={subTab} onChange={setSubTab} />
      </div>
      <div className="px-2.5 pb-2.5 pt-2.5">
        {subTab === "plan" && <NursingPlanView data={data} />}
        {subTab === "summary" && <NursingSummaryView data={data} />}
        {subTab === "daily" && <DailyRecordsView data={data} />}
      </div>
    </div>
  );
}
