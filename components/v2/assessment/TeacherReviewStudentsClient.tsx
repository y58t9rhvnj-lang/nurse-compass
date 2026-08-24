"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  TeacherReviewMilestoneSummary,
  TeacherStudentSubmissionRow,
} from "@/lib/v2/assessment/teacherReviewRepository";
import { formatAssessmentDateTimeJa } from "@/lib/v2/assessment/formatAssessmentDate";
import {
  evaluationStateLabel,
  lateReviewStatusLabel,
  studentIdLabel,
} from "@/lib/v2/assessment/teacherReviewLabels";
import { TeacherTimingDisplayBlock } from "@/components/v2/assessment/TeacherTimingDisplayBlock";

type FilterKey =
  | "all"
  | "unsubmitted"
  | "submitted"
  | "late"
  | "pending"
  | "has_candidate"
  | "no_candidate";

type SortKey = "name" | "submitted_at" | "count";

type Props = {
  milestone: TeacherReviewMilestoneSummary;
  rows: TeacherStudentSubmissionRow[];
};

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: "all", label: "すべて" },
  { key: "unsubmitted", label: "未提出" },
  { key: "submitted", label: "提出済み" },
  { key: "late", label: "期限後" },
  { key: "pending", label: "教員確認待ち" },
  { key: "has_candidate", label: "評価対象あり" },
  { key: "no_candidate", label: "評価対象なし" },
];

function matchesFilter(
  row: TeacherStudentSubmissionRow,
  filter: FilterKey,
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "unsubmitted":
      return row.isUnsubmitted;
    case "submitted":
      return !row.isUnsubmitted;
    case "late":
      return row.isLate;
    case "pending":
      return row.isPendingLateReview;
    case "has_candidate":
      return row.hasCandidate;
    case "no_candidate":
      return !row.isUnsubmitted && !row.hasCandidate;
  }
}

function rowTone(row: TeacherStudentSubmissionRow): string {
  if (row.isUnsubmitted) return "bg-slate-50 text-slate-500";
  if (row.hasCandidate) return "bg-emerald-50/60 text-slate-900";
  if (row.isLate || row.isPendingLateReview) return "bg-amber-50/70 text-amber-950";
  return "text-slate-800";
}

export default function TeacherReviewStudentsClient({
  milestone,
  rows,
}: Props) {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sort, setSort] = useState<SortKey>("name");

  const visible = useMemo(() => {
    const filtered = rows.filter((r) => matchesFilter(r, filter));
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      if (sort === "name") {
        return a.student.displayName.localeCompare(b.student.displayName, "ja");
      }
      if (sort === "count") {
        return b.submissionCount - a.submissionCount;
      }
      const at = a.latestSubmittedAt ?? "";
      const bt = b.latestSubmittedAt ?? "";
      if (!at && !bt) return 0;
      if (!at) return 1;
      if (!bt) return -1;
      return bt.localeCompare(at);
    });
    return sorted;
  }, [rows, filter, sort]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
        現在、対象学生は組織内の有効学生全員で集計しています。
        クラス・講義ごとの対象学生設定は今後追加予定です。
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`flex min-h-11 items-center rounded-lg px-3 text-sm font-medium ${
              filter === f.key
                ? "bg-slate-900 text-white"
                : "border border-slate-300 bg-white text-slate-700"
            }`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
        <label className="ml-auto flex min-h-11 items-center gap-2 text-sm text-slate-600">
          並び替え
          <select
            className="min-h-11 rounded-lg border border-slate-300 bg-white px-3"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
          >
            <option value="name">学生名順</option>
            <option value="submitted_at">最新提出日時順</option>
            <option value="count">提出回数順</option>
          </select>
        </label>
      </div>

      <p className="text-sm text-slate-500">
        {visible.length} / {rows.length} 名表示 ・ 課題「{milestone.title}」
      </p>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[800px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
              <th className="px-3 py-3">学生名</th>
              <th className="px-3 py-3">学籍番号 / ID</th>
              <th className="px-3 py-3">最新提出</th>
              <th className="px-3 py-3 text-right">回数</th>
              <th className="px-3 py-3">提出時判定 / 現在期限</th>
              <th className="px-3 py-3">期限後確認</th>
              <th className="px-3 py-3">評価候補</th>
              <th className="px-3 py-3">提出</th>
              <th className="px-3 py-3">評価状態</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr
                key={row.student.id}
                role="link"
                tabIndex={0}
                className={`cursor-pointer border-b border-slate-100 last:border-0 hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500 ${rowTone(row)}`}
                onClick={() =>
                  router.push(
                    `/v2/teacher/reviews/${milestone.milestoneId}/${row.student.id}`,
                  )
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    router.push(
                      `/v2/teacher/reviews/${milestone.milestoneId}/${row.student.id}`,
                    );
                  }
                }}
              >
                <td className="min-h-11 px-3 py-3 font-semibold">
                  {row.student.displayName}
                </td>
                <td className="px-3 py-3">{studentIdLabel(row.student)}</td>
                <td className="whitespace-nowrap px-3 py-3 text-xs">
                  {row.latestSubmittedAt
                    ? formatAssessmentDateTimeJa(row.latestSubmittedAt)
                    : "—"}
                </td>
                <td className="px-3 py-3 text-right tabular-nums">
                  {row.submissionCount}
                </td>
                <td className="px-3 py-3">
                  {row.isUnsubmitted ? (
                    "—"
                  ) : (
                    <TeacherTimingDisplayBlock
                      timingStatus={row.latestTimingStatus}
                      submittedAt={row.latestSubmittedAt}
                      currentDeadlineAt={milestone.deadlineAt}
                      deadlineAtAtSubmit={row.latestDeadlineAtAtSubmit}
                    />
                  )}
                </td>
                <td className="px-3 py-3">
                  {lateReviewStatusLabel(row.latestLateReviewStatus)}
                </td>
                <td className="px-3 py-3">
                  {row.isUnsubmitted
                    ? "—"
                    : row.hasCandidate
                      ? "あり"
                      : "なし"}
                </td>
                <td className="px-3 py-3">
                  {row.isUnsubmitted ? "未提出" : "提出済み"}
                </td>
                <td className="px-3 py-3">
                  {evaluationStateLabel(row.evaluationState)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">該当する学生はいません。</p>
        ) : null}
      </div>
    </div>
  );
}
