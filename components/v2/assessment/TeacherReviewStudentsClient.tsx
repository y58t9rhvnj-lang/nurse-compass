"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  bulkCompleteTeacherAssessmentReviewsAction,
  type BulkCompleteItemResult,
} from "@/app/v2/actions/assessmentReviewWrite";
import { listTeacherStudentSubmissionRowsAction } from "@/app/v2/actions/assessmentReviews";
import type {
  TeacherReviewMilestoneSummary,
  TeacherStudentSubmissionRow,
} from "@/lib/v2/assessment/teacherReviewRepository";
import { formatAssessmentDateTimeJa } from "@/lib/v2/assessment/formatAssessmentDate";
import {
  caseDisplayLabel,
  lateReviewStatusLabel,
  reviewDisplayStatusLabel,
  studentIdLabel,
} from "@/lib/v2/assessment/teacherReviewLabels";
import { saveTeacherReviewOrder } from "@/lib/v2/assessment/teacherReviewOrderStorage";
import { teacherTimingJudgmentLabel } from "@/lib/v2/assessment/teacherReviewTimingDisplay";
import {
  evaluationTypeLabel,
  formatSubmissionScopeJa,
  statusLabel,
} from "@/lib/v2/assessment/submissionScope";

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

function compareRows(
  a: TeacherStudentSubmissionRow,
  b: TeacherStudentSubmissionRow,
  sort: SortKey,
): number {
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
}

/** student.id で1行に正規化 */
function dedupeByStudentId(
  list: TeacherStudentSubmissionRow[],
): TeacherStudentSubmissionRow[] {
  const seen = new Set<string>();
  const out: TeacherStudentSubmissionRow[] = [];
  for (const row of list) {
    if (seen.has(row.student.id)) continue;
    seen.add(row.student.id);
    out.push(row);
  }
  return out;
}

export default function TeacherReviewStudentsClient({
  milestone,
  rows: initialRows,
}: Props) {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sort, setSort] = useState<SortKey>("name");
  const [rows, setRows] = useState(() => dedupeByStudentId(initialRows));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkResults, setBulkResults] = useState<BulkCompleteItemResult[] | null>(
    null,
  );
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const visible = useMemo(() => {
    const filtered = dedupeByStudentId(rows).filter((r) =>
      matchesFilter(r, filter),
    );
    const sorted = [...filtered];
    sorted.sort((a, b) => compareRows(a, b, sort));
    return sorted;
  }, [rows, filter, sort]);

  const orderedStudentIds = useMemo(() => {
    const sorted = dedupeByStudentId([...rows]);
    sorted.sort((a, b) => compareRows(a, b, sort));
    return sorted.map((r) => r.student.id);
  }, [rows, sort]);

  const persistOrderAndOpen = (studentId: string) => {
    saveTeacherReviewOrder({
      milestoneId: milestone.milestoneId,
      studentIds: orderedStudentIds,
      filter,
      sort,
    });
    router.push(
      `/v2/teacher/reviews/${milestone.milestoneId}/${studentId}`,
    );
  };

  const selectableIds = useMemo(() => {
    const ids = new Set<string>();
    for (const row of visible) {
      if (
        row.reviewSummary.canBulkComplete &&
        row.reviewSummary.reviewId &&
        row.reviewSummary.updatedAt &&
        row.candidateSubmissionId
      ) {
        ids.add(row.student.id);
      }
    }
    return ids;
  }, [visible]);

  const selectedCount = [...selected].filter((id) => selectableIds.has(id)).length;

  const toggleSelect = (studentId: string, checked: boolean) => {
    if (!selectableIds.has(studentId)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(studentId);
      else next.delete(studentId);
      return next;
    });
  };

  const toggleSelectAllVisible = (checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of selectableIds) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };

  const refreshRows = () => {
    startTransition(async () => {
      const res = await listTeacherStudentSubmissionRowsAction(
        milestone.milestoneId,
      );
      if (!res.ok) {
        setBulkError("一覧の再取得に失敗しました。");
        return;
      }
      setRows(dedupeByStudentId(res.rows));
    });
  };

  const onBulkComplete = () => {
    const items = visible
      .filter((r) => selected.has(r.student.id) && selectableIds.has(r.student.id))
      .map((r) => ({
        studentId: r.student.id,
        submissionId: r.candidateSubmissionId!,
        reviewId: r.reviewSummary.reviewId!,
        baseUpdatedAt: r.reviewSummary.updatedAt!,
      }));
    if (items.length === 0) return;
    const ok = window.confirm(
      `選択した${items.length}件の評価を確定します。\n学生への返却はまだ行われません。`,
    );
    if (!ok) return;

    setBulkError(null);
    setBulkResults(null);
    startTransition(async () => {
      const res = await bulkCompleteTeacherAssessmentReviewsAction({
        milestoneId: milestone.milestoneId,
        items,
      });
      if (!res.ok) {
        setBulkError(res.message);
        return;
      }
      setBulkResults(res.results);
      setSelected((prev) => {
        const next = new Set(prev);
        for (const r of res.results) {
          if (r.ok) next.delete(r.studentId);
        }
        return next;
      });
      const listed = await listTeacherStudentSubmissionRowsAction(
        milestone.milestoneId,
      );
      if (listed.ok) setRows(dedupeByStudentId(listed.rows));
    });
  };

  const allSelectableChecked =
    selectableIds.size > 0 &&
    [...selectableIds].every((id) => selected.has(id));

  const bulkFailByStudent = useMemo(() => {
    const map = new Map<string, string>();
    if (!bulkResults) return map;
    for (const r of bulkResults) {
      if (!r.ok) map.set(r.studentId, r.message);
    }
    return map;
  }, [bulkResults]);

  const bulkSuccessCount = bulkResults?.filter((r) => r.ok).length ?? 0;
  const bulkFailCount = bulkResults?.filter((r) => !r.ok).length ?? 0;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      {/* 上部固定（親が h-full のため sticky 不要・常時表示） */}
      <div className="shrink-0 space-y-3 border-b border-slate-200 bg-slate-50 px-4 pb-3 pt-4 sm:px-6">
        <div>
          <Link
            href="/v2/teacher/reviews"
            className="inline-flex min-h-11 items-center text-sm text-slate-500 hover:underline"
          >
            ← 課題一覧
          </Link>
          <h1 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">
            {milestone.title}
          </h1>
          <p className="mt-1 text-xs text-slate-600 sm:text-sm">
            {milestone.cycleTitle} ・ {caseDisplayLabel(milestone.caseId)} ・{" "}
            {formatSubmissionScopeJa(
              milestone.milestoneType,
              milestone.submissionScope,
            )}{" "}
            ・ {evaluationTypeLabel(milestone.evaluationType)} ・{" "}
            {statusLabel(milestone.status)}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            提出期限：{formatAssessmentDateTimeJa(milestone.deadlineAt)} ・ 提出{" "}
            {milestone.submittedStudentCount}名・未提出{" "}
            {milestone.unsubmittedStudentCount}名・評価対象{" "}
            {milestone.candidateStudentCount}名
          </p>
        </div>

        <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-950 sm:text-sm">
          現在、対象学生は組織内の有効学生全員で集計しています。
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
          <label className="flex min-h-11 items-center gap-2 text-sm text-slate-600 sm:ml-auto">
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

        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-slate-500">
            {visible.length} / {dedupeByStudentId(rows).length} 名表示
          </p>
          <button
            type="button"
            disabled={selectedCount === 0 || pending}
            className="flex min-h-11 items-center rounded-lg bg-emerald-700 px-4 text-sm font-medium text-white disabled:opacity-40"
            onClick={onBulkComplete}
          >
            選択した評価を確定
            {selectedCount > 0 ? `（${selectedCount}）` : ""}
          </button>
          <button
            type="button"
            disabled={pending}
            className="flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 disabled:opacity-50"
            onClick={refreshRows}
          >
            再読み込み
          </button>
          {bulkResults ? (
            <p className="text-sm text-slate-700">
              一括確定：{bulkSuccessCount}件成功
              {bulkFailCount > 0 ? `・${bulkFailCount}件失敗` : ""}
            </p>
          ) : null}
        </div>

        {bulkError ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
            {bulkError}
          </p>
        ) : null}
      </div>

      {/* 表スクロール領域（縦・横ともこの中。thead sticky） */}
      <div className="min-h-0 flex-1 overflow-auto overscroll-contain bg-white px-4 pb-8 sm:px-6">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead className="sticky top-0 z-20">
            <tr className="border-b border-slate-200 bg-white text-xs font-semibold text-slate-500 shadow-[0_1px_0_0_rgba(15,23,42,0.08)]">
              <th className="bg-white px-3 py-3">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={allSelectableChecked}
                  disabled={selectableIds.size === 0}
                  onChange={(e) => toggleSelectAllVisible(e.target.checked)}
                  aria-label="表示中の確定可能な下書きをすべて選択"
                />
              </th>
              <th className="bg-white px-3 py-3">学生</th>
              <th className="bg-white px-3 py-3">提出</th>
              <th className="bg-white px-3 py-3 text-right">回数</th>
              <th className="bg-white px-3 py-3">判定</th>
              <th className="bg-white px-3 py-3">確認</th>
              <th className="bg-white px-3 py-3">評価</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const canSelect = selectableIds.has(row.student.id);
              const failMsg = bulkFailByStudent.get(row.student.id);
              const rs = row.reviewSummary;
              return (
                <tr
                  key={row.student.id}
                  className={`border-b border-slate-100 last:border-0 ${rowTone(row)}`}
                >
                  <td
                    className="px-3 py-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      disabled={!canSelect || pending}
                      checked={selected.has(row.student.id)}
                      onChange={(e) =>
                        toggleSelect(row.student.id, e.target.checked)
                      }
                      aria-label={`${row.student.displayName}の評価を選択`}
                    />
                  </td>
                  <td
                    role="link"
                    tabIndex={0}
                    className="min-w-[8rem] max-w-[14rem] cursor-pointer px-3 py-3 hover:underline"
                    onClick={() => persistOrderAndOpen(row.student.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        persistOrderAndOpen(row.student.id);
                      }
                    }}
                  >
                    <span className="block truncate font-semibold">
                      {row.student.displayName}
                    </span>
                    <span className="block truncate text-xs font-normal text-slate-500">
                      {studentIdLabel(row.student)}
                    </span>
                    {failMsg ? (
                      <span className="mt-1 block text-xs font-normal text-rose-700">
                        {failMsg}
                      </span>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-xs">
                    {row.isUnsubmitted
                      ? "未提出"
                      : row.latestSubmittedAt
                        ? formatAssessmentDateTimeJa(row.latestSubmittedAt)
                        : "提出済み"}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {row.submissionCount}
                  </td>
                  <td className="px-3 py-3 text-xs">
                    {row.isUnsubmitted
                      ? "—"
                      : teacherTimingJudgmentLabel(row.latestTimingStatus).replace(
                          "提出時判定：",
                          "",
                        )}
                  </td>
                  <td className="px-3 py-3 text-xs">
                    {lateReviewStatusLabel(row.latestLateReviewStatus)}
                  </td>
                  <td className="px-3 py-3">
                    <div className="space-y-0.5">
                      <p className="font-medium">
                        {reviewDisplayStatusLabel(rs.status)}
                      </p>
                      {rs.status === "draft" || rs.status === "completed" ? (
                        <>
                          <p className="text-xs tabular-nums text-slate-600">
                            項目 {rs.scoredCount}/{rs.rubricTotal}
                            {rs.hasOverallComment ? " ・総合あり" : ""}
                          </p>
                          <p className="text-xs text-slate-500">
                            {rs.status === "completed" && rs.completedAt
                              ? `確定 ${formatAssessmentDateTimeJa(rs.completedAt)}`
                              : rs.updatedAt
                                ? `保存 ${formatAssessmentDateTimeJa(rs.updatedAt)}`
                                : null}
                            {rs.updatedByName
                              ? ` ・${rs.updatedByName}`
                              : null}
                          </p>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {visible.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">該当する学生はいません。</p>
        ) : null}
      </div>
    </div>
  );
}
