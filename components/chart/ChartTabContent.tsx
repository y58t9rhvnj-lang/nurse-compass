"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pill } from "lucide-react";
import type { ChartData, ClinicalRecord } from "@/lib/chartData";
import type { ChartTabId } from "@/lib/chartTabs";
import type { ChartFocus, ChartNavRequest } from "@/lib/chartNav";
import {
  ChartPanel,
  ChartTable,
  EmptyState,
  FilterChips,
  FormField,
  FormGrid,
  ProfessionBadge,
  SectionCard,
  TabCount,
} from "./ChartUi";
import DateSelect from "./DateSelect";
import ExamsView from "./ExamsView";
import FlowsheetView from "./FlowsheetView";
import PrescriptionsView from "./PrescriptionsView";

const CLINICAL_PAGE_SIZE = 20;

export default function ChartTabContent({
  tab,
  data,
  nav,
  onNavigate,
}: {
  tab: ChartTabId;
  data: ChartData;
  nav: ChartNavRequest | null;
  onNavigate: (tab: ChartTabId, focus: ChartFocus) => void;
}) {
  switch (tab) {
    case "診療録":
      return (
        <ClinicalRecordsTab
          data={data}
          focus={nav && nav.tab === "診療録" ? nav : null}
          onNavigate={onNavigate}
        />
      );
    case "患者情報":
      return <PatientInfoTab data={data} />;
    case "生活歴":
      return <LifeHistoryTab data={data} />;
    case "エピソード":
      return <EpisodesTab data={data} />;
    case "看護記録":
      return <NursingTab data={data} />;
    case "OT":
      return <OTTab data={data} />;
    case "PSW":
      return <PSWTab data={data} />;
    case "フローシート":
      return <FlowsheetView data={data} onNavigate={onNavigate} />;
    case "検査":
      return <ExamsView data={data} />;
    case "処方":
      return (
        <PrescriptionsView
          data={data}
          focus={nav && nav.tab === "処方" ? nav : null}
          onNavigate={onNavigate}
        />
      );
  }
}

type Highlight = { kind: "key" | "date" | "event"; value: string } | null;

function ClinicalRecordsTab({
  data,
  focus,
  onNavigate,
}: {
  data: ChartData;
  focus: ChartNavRequest | null;
  onNavigate: (tab: ChartTabId, focus: ChartFocus) => void;
}) {
  // 古い→新しい順に並べ替え（時系列が自然に追える表示）
  const all = useMemo(
    () =>
      [...data.clinicalRecords].sort((a, b) =>
        `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`),
      ),
    [data.clinicalRecords],
  );
  const [filter, setFilter] = useState("すべて");
  const [page, setPage] = useState(0);
  const [selectedDate, setSelectedDate] = useState("all");
  const [highlight, setHighlight] = useState<Highlight>(null);
  const [scrollKey, setScrollKey] = useState<string | null>(null);
  const [scrollTick, setScrollTick] = useState(0);

  const listRef = useRef<HTMLDivElement>(null);
  const recordRefs = useRef(new Map<string, HTMLElement>());

  const indexByRecord = useMemo(() => {
    const m = new Map<ClinicalRecord, number>();
    all.forEach((r, i) => m.set(r, i));
    return m;
  }, [all]);
  const keyOf = (r: ClinicalRecord) => `c${indexByRecord.get(r)}`;

  const professions = useMemo(() => {
    const seen: string[] = [];
    for (const r of all) if (!seen.includes(r.profession)) seen.push(r.profession);
    return ["すべて", ...seen];
  }, [all]);

  const dateOptions = useMemo(() => {
    const seen: string[] = [];
    for (const r of all) if (!seen.includes(r.date)) seen.push(r.date);
    return seen;
  }, [all]);

  const filtered =
    filter === "すべて" ? all : all.filter((r) => r.profession === filter);
  const pageCount = Math.max(1, Math.ceil(filtered.length / CLINICAL_PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRecords = filtered.slice(
    safePage * CLINICAL_PAGE_SIZE,
    safePage * CLINICAL_PAGE_SIZE + CLINICAL_PAGE_SIZE,
  );

  const scrollListTop = () =>
    listRef.current?.scrollTo({ top: 0, behavior: "smooth" });

  // 対象記録へフィルタ調整・ページ移動・強調をまとめて実行
  const runFocus = (target: ClinicalRecord, hl: Highlight) => {
    let f = filter;
    if (f !== "すべて" && target.profession !== f) {
      f = "すべて";
      setFilter("すべて");
    }
    const list = f === "すべて" ? all : all.filter((r) => r.profession === f);
    const pos = list.indexOf(target);
    if (pos < 0) return;
    setPage(Math.floor(pos / CLINICAL_PAGE_SIZE));
    setHighlight(hl);
    setScrollKey(keyOf(target));
    setScrollTick((t) => t + 1);
  };

  // 他タブ（処方・フローシート）からの遷移要求を処理
  useEffect(() => {
    if (!focus) return;
    const raf = requestAnimationFrame(() => {
      const f = focus.focus;
      if (f.type === "restrictionId") {
        // イベント群のうち最も古い記録へスクロールし、群全体を強調
        const group = all
          .filter((r) => r.restrictionEventId === f.id)
          .sort((a, b) =>
            `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`),
          );
        const target = group[0];
        if (!target) return;
        runFocus(target, { kind: "event", value: f.id });
        return;
      }
      let target: ClinicalRecord | undefined;
      if (f.type === "clinicalId")
        target = all.find((r) => r.medicationChangeId === f.id);
      else if (f.type === "nursingId")
        target = all.find((r) => r.nursingRecordId === f.id);
      else if (f.type === "date") target = all.find((r) => r.date === f.date);
      if (!target) return;
      if (f.type === "date") {
        setSelectedDate(f.date);
        runFocus(target, { kind: "date", value: f.date });
      } else {
        runFocus(target, { kind: "key", value: keyOf(target) });
      }
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.token]);

  // ページ・フィルタ更新後に対象記録へスクロール＋1.5秒で強調解除
  useEffect(() => {
    if (!scrollKey) return;
    const raf = requestAnimationFrame(() => {
      recordRefs.current
        .get(scrollKey)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    const t = window.setTimeout(() => setHighlight(null), 1500);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollTick]);

  const changeFilter = (f: string) => {
    setFilter(f);
    setPage(0);
    setHighlight(null);
    scrollListTop();
  };

  const goPage = (p: number) => {
    setPage(p);
    scrollListTop();
  };

  const changeDate = (d: string) => {
    setSelectedDate(d);
    if (d === "all") {
      setHighlight(null);
      setPage(0);
      scrollListTop();
      return;
    }
    const target = filtered.find((r) => r.date === d) ?? all.find((r) => r.date === d);
    if (target) runFocus(target, { kind: "date", value: d });
  };

  const isHighlighted = (r: ClinicalRecord) =>
    highlight !== null &&
    ((highlight.kind === "key" && keyOf(r) === highlight.value) ||
      (highlight.kind === "date" && r.date === highlight.value) ||
      (highlight.kind === "event" && r.restrictionEventId === highlight.value));

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#F7F7F9]">
      {/* 固定ヘッダー：フィルタ・件数・日付指定 */}
      <div className="shrink-0 space-y-2 border-b border-[#E5E5EA] bg-white px-2.5 pb-2 pt-2.5">
        <FilterChips options={professions} active={filter} onChange={changeFilter} />
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-[#8E8E93]">
            {filtered.length}件の記録
          </span>
          <div className="ml-auto flex items-center gap-1.5 text-[11px] text-[#6E6E73]">
            日付を指定
            <DateSelect
              dates={dateOptions}
              value={selectedDate === "all" ? "" : selectedDate}
              onChange={(d) => changeDate(d)}
            />
            {selectedDate !== "all" && (
              <button
                type="button"
                onClick={() => changeDate("all")}
                className="min-h-[44px] rounded-lg px-2 text-[11px] font-semibold text-[#0A84FF] transition hover:bg-[#EAF3FF]"
              >
                すべて
              </button>
            )}
          </div>
        </div>
      </div>

      {/* スクロール領域：記録本文のみ */}
      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-2.5 py-2.5">
        {filtered.length === 0 ? (
          <EmptyState text="この条件の記録はありません" />
        ) : (
          <div className="overflow-hidden rounded-lg border border-[#E5E5EA] bg-white">
            {pageRecords.map((r) => (
              <article
                key={keyOf(r)}
                ref={(el) => {
                  if (el) recordRefs.current.set(keyOf(r), el);
                  else recordRefs.current.delete(keyOf(r));
                }}
                className={[
                  "border-b border-[#E5E5EA] px-3.5 py-2.5 transition-colors duration-500 last:border-b-0",
                  isHighlighted(r) ? "bg-[#EAF3FF]" : "bg-white",
                ].join(" ")}
              >
                <div className="mb-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
                  <time className="text-[12px] font-bold text-[#1D1D1F]">
                    {r.date}
                  </time>
                  <span className="text-[12px] tabular-nums text-[#6E6E73]">
                    {r.time}
                  </span>
                  <ProfessionBadge profession={r.profession} />
                  {r.restrictionEventId && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-[#F4EBFB] px-1.5 py-0.5 text-[10px] font-semibold text-[#7B3FA0]">
                      行動制限
                      {r.restrictionType ? `・${r.restrictionType}` : ""}
                    </span>
                  )}
                  <span className="ml-auto text-[11px] text-[#8E8E93]">
                    {r.author}
                  </span>
                </div>
                <p className="text-[12.5px] leading-[1.55] text-[#3A3A3C]">
                  {r.content}
                </p>
                {r.medicationChangeId && (
                  <button
                    type="button"
                    onClick={() =>
                      onNavigate("処方", {
                        type: "rxId",
                        id: r.medicationChangeId!,
                      })
                    }
                    className="mt-1.5 inline-flex min-h-[44px] items-center gap-1 rounded-lg bg-[#F4EBFB] px-2.5 text-[11px] font-semibold text-[#7B3FA0] transition hover:bg-[#EAD9F7]"
                  >
                    <Pill className="h-3.5 w-3.5" strokeWidth={2} />
                    処方内容を見る
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
      </div>

      {/* 固定フッター：ページ送り */}
      <div className="flex shrink-0 items-center gap-2 border-t border-[#E5E5EA] bg-white px-2.5 py-1.5">
        <button
          type="button"
          onClick={() => goPage(safePage - 1)}
          disabled={safePage <= 0}
          className="flex min-h-[44px] items-center gap-0.5 rounded-lg px-3 text-[12px] font-semibold text-[#0A84FF] transition enabled:hover:bg-[#EAF3FF] disabled:text-[#C7C7CC]"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={2} />
          前のページ
        </button>
        <span className="flex-1 text-center text-[12px] font-semibold tabular-nums text-[#1D1D1F]">
          {safePage + 1} / {pageCount}
        </span>
        <button
          type="button"
          onClick={() => goPage(safePage + 1)}
          disabled={safePage >= pageCount - 1}
          className="flex min-h-[44px] items-center gap-0.5 rounded-lg px-3 text-[12px] font-semibold text-[#0A84FF] transition enabled:hover:bg-[#EAF3FF] disabled:text-[#C7C7CC]"
        >
          次のページ
          <ChevronRight className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

function PatientInfoTab({ data }: { data: ChartData }) {
  const info = data.patientInfo;
  return (
    <ChartPanel>
      <FormGrid>
        <FormField label="患者番号" value={info.patientNo} />
        <FormField label="氏名" value={info.name} />
        <FormField label="年齢" value={`${info.age}歳`} />
        <FormField label="性別" value={info.sex} />
        <FormField label="病室" value={`${info.room}号室`} />
        <FormField label="診断名" value={info.diagnosis} />
        <FormField label="入院日" value={info.admit} />
        <FormField label="主治医" value={info.doctor} />
        <FormField label="担当看護師" value={info.nurse} />
        <FormField label="血液型" value={info.bloodType} />
        <FormField label="職業" value={info.occupation} />
        <FormField label="家族構成" value={info.family} />
        <FormField label="住所" value={info.address} />
        <FormField label="電話番号" value={info.phone} />
        <FormField label="緊急連絡先" value={info.emergencyContact} />
      </FormGrid>
    </ChartPanel>
  );
}

function LifeHistoryTab({ data }: { data: ChartData }) {
  return (
    <ChartPanel>
      <div className="space-y-2">
        {data.lifeHistory.map((item, i) => (
          <SectionCard key={i} title={item.title}>
            {item.content}
          </SectionCard>
        ))}
      </div>
    </ChartPanel>
  );
}

function EpisodesTab({ data }: { data: ChartData }) {
  return (
    <ChartPanel>
      <TabCount count={data.episodes.length} />
      <ChartTable
        headers={["日付", "種別", "施設", "内容"]}
        rows={data.episodes.map((e, i) => [
          e.date,
          <span
            key={`type-${i}`}
            className="inline-flex rounded-md bg-[#EAF3FF] px-2 py-0.5 text-[11px] font-semibold text-[#0A5FCC]"
          >
            {e.type}
          </span>,
          e.facility,
          e.description,
        ])}
      />
    </ChartPanel>
  );
}

function NursingTab({ data }: { data: ChartData }) {
  return (
    <ChartPanel>
      <TabCount count={data.nursingRecords.length} />
      <ChartTable
        headers={["日付", "時間", "記録者", "観察", "対応", "評価"]}
        rows={data.nursingRecords.map((r) => [
          r.date,
          r.time,
          r.author,
          r.observation,
          r.intervention,
          r.evaluation,
        ])}
      />
    </ChartPanel>
  );
}

function OTTab({ data }: { data: ChartData }) {
  return (
    <ChartPanel>
      <TabCount count={data.otRecords.length} />
      <ChartTable
        headers={["日付", "参加", "活動内容", "集中度", "対人交流", "スタッフ所見"]}
        rows={data.otRecords.map((r) => [
          r.date,
          r.participation,
          r.activity,
          r.concentration,
          r.social,
          r.staffNote,
        ])}
      />
    </ChartPanel>
  );
}

function PSWTab({ data }: { data: ChartData }) {
  return (
    <ChartPanel>
      <TabCount count={data.pswRecords.length} />
      <ChartTable
        headers={["日付", "家族調整", "退院支援", "制度利用", "地域連携"]}
        rows={data.pswRecords.map((r) => [
          r.date,
          r.family,
          r.discharge,
          r.system,
          r.community,
        ])}
      />
    </ChartPanel>
  );
}
