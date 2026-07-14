"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ChartData, ExamItemRow, ExamRecord } from "@/lib/chartData";

// 検査：一覧 → 詳細の2段階
export default function ExamsView({ data }: { data: ChartData }) {
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-[#F7F7F9] p-2.5">
      {selected === null ? (
        <ExamList exams={data.exams} onSelect={setSelected} />
      ) : (
        <ExamDetail exam={data.exams[selected]} onBack={() => setSelected(null)} />
      )}
    </div>
  );
}

function JudgeBadge({ judgement }: { judgement: string }) {
  const abnormal = judgement.includes("要") || judgement.includes("異常あり");
  return (
    <span
      className={[
        "inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold",
        abnormal ? "bg-[#FFF2E1] text-[#C93400]" : "bg-[#E7F8ED] text-[#248A3D]",
      ].join(" ")}
    >
      {judgement}
    </span>
  );
}

function ExamList({
  exams,
  onSelect,
}: {
  exams: ExamRecord[];
  onSelect: (i: number) => void;
}) {
  return (
    <>
      <span className="mb-1.5 block text-[11px] text-[#8E8E93]">
        {exams.length}件の検査（タップで詳細）
      </span>
      <div className="overflow-hidden rounded-xl border border-[#E5E5EA] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        {exams.map((e, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onSelect(i)}
            className="flex min-h-[44px] w-full items-center gap-3 border-b border-[#F0F0F2] px-3.5 py-2.5 text-left transition last:border-0 hover:bg-[#FAFAFC]"
          >
            <span className="w-[76px] shrink-0 text-[11px] tabular-nums text-[#8E8E93]">
              {e.date}
            </span>
            <span className="w-[132px] shrink-0 text-[12.5px] font-semibold text-[#1D1D1F]">
              {e.category}
            </span>
            <span className="min-w-0 flex-1 truncate text-[12px] text-[#3A3A3C]">
              {e.summary}
            </span>
            <JudgeBadge judgement={e.judgement} />
            <ChevronRight
              className="h-4 w-4 shrink-0 text-[#C7C7CC]"
              strokeWidth={2}
            />
          </button>
        ))}
      </div>
    </>
  );
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="mb-2 flex min-h-[44px] w-fit items-center gap-1 rounded-lg px-2 text-[12px] font-semibold text-[#0A84FF] transition hover:bg-[#EAF3FF]"
    >
      <ChevronLeft className="h-4 w-4" strokeWidth={2} />
      検査一覧へ戻る
    </button>
  );
}

function DetailHeader({ exam }: { exam: ExamRecord }) {
  return (
    <div className="mb-2.5 flex flex-wrap items-center gap-2">
      <h3 className="text-[15px] font-bold text-[#1D1D1F]">{exam.category}</h3>
      <span className="text-[11px] tabular-nums text-[#8E8E93]">{exam.date}</span>
      <JudgeBadge judgement={exam.judgement} />
    </div>
  );
}

function ExamDetail({
  exam,
  onBack,
}: {
  exam: ExamRecord;
  onBack: () => void;
}) {
  return (
    <div>
      <BackButton onBack={onBack} />
      <DetailHeader exam={exam} />

      {exam.kind === "blood" && <BloodDetail rows={exam.rows} />}
      {exam.kind === "psych" && (
        <div className="rounded-xl border border-[#E5E5EA] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
          <DL label="検査名" value={exam.testName} />
          <DL label="実施日" value={exam.date} />
          <DL label="得点" value={exam.score} />
          <DL label="基準" value={exam.reference} />
          <DL label="所見" value={exam.finding} last />
        </div>
      )}
      {exam.kind === "imaging" && (
        <div className="rounded-xl border border-[#E5E5EA] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
          <DL label="実施日" value={exam.date} />
          <DL label="検査目的" value={exam.purpose} />
          <DL label="所見" value={exam.finding} />
          <DL label="判定" value={exam.judgement} last />
        </div>
      )}

      {exam.comment && (
        <p className="mt-2.5 rounded-lg bg-[#F2F2F7] px-3 py-2 text-[12px] leading-relaxed text-[#6E6E73]">
          {exam.comment}
        </p>
      )}
    </div>
  );
}

function DL({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <div
      className={[
        "flex flex-col py-2",
        last ? "" : "border-b border-[#F0F0F2]",
      ].join(" ")}
    >
      <dt className="text-[10px] font-medium text-[#AEAEB5]">{label}</dt>
      <dd className="mt-0.5 text-[13px] leading-relaxed text-[#1D1D1F]">
        {value}
      </dd>
    </div>
  );
}

function BloodDetail({ rows }: { rows: ExamItemRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[#E5E5EA] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <table className="w-full min-w-[420px] border-collapse text-left text-[12.5px]">
        <thead>
          <tr className="border-b border-[#E5E5EA] bg-[#F7F7F9] text-[#6E6E73]">
            <th className="px-3 py-2 font-semibold">項目</th>
            <th className="px-3 py-2 text-right font-semibold">結果</th>
            <th className="px-3 py-2 font-semibold">単位</th>
            <th className="px-3 py-2 text-right font-semibold">正常値</th>
            <th className="px-3 py-2 text-center font-semibold">判定</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-b border-[#F0F0F2] last:border-0">
              <td className="px-3 py-2 font-medium text-[#1D1D1F]">{r.name}</td>
              <td
                className={[
                  "px-3 py-2 text-right tabular-nums",
                  r.flag ? "font-bold text-[#C93400]" : "text-[#1D1D1F]",
                ].join(" ")}
              >
                {r.value}
              </td>
              <td className="px-3 py-2 text-[#8E8E93]">{r.unit}</td>
              <td className="px-3 py-2 text-right tabular-nums text-[#6E6E73]">
                {r.reference}
              </td>
              <td className="px-3 py-2 text-center">
                {r.flag ? (
                  <span className="inline-flex min-w-[24px] justify-center rounded-md bg-[#FFF2E1] px-1.5 py-0.5 text-[11px] font-bold text-[#C93400]">
                    {r.flag}
                  </span>
                ) : (
                  <span className="text-[11px] text-[#248A3D]">正常</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
