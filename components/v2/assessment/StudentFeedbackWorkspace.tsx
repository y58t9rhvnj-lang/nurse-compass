"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getStudentReturnedReviewDetailAction,
  listStudentReturnedReviewsAction,
  type StudentReturnedReviewDetail,
  type StudentReturnedReviewListItem,
} from "@/app/v2/actions/assessmentStudentFeedback";
import {
  ASSESSMENT_RUBRIC_KEYS,
  ASSESSMENT_RUBRIC_LABELS,
  ASSESSMENT_RUBRIC_LEVELS,
} from "@/lib/v2/assessment/assessmentRubric";
import { formatAssessmentDateTimeJa } from "@/lib/v2/assessment/formatAssessmentDate";
import { evaluationTypeLabel } from "@/lib/v2/assessment/submissionScope";

function levelLabel(value: number | null | undefined): string {
  if (value == null) return "評価なし";
  const found = ASSESSMENT_RUBRIC_LEVELS.find((l) => l.value === value);
  return found?.label ?? "評価なし";
}

export default function StudentFeedbackWorkspace({
  onCountChange,
}: {
  onCountChange?: (count: number) => void;
}) {
  const [items, setItems] = useState<StudentReturnedReviewListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<StudentReturnedReviewDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await listStudentReturnedReviewsAction();
    setLoading(false);
    if (!res.ok) {
      setError(res.message);
      setItems([]);
      onCountChange?.(0);
      return;
    }
    setItems(res.items);
    onCountChange?.(res.count);
  }, [onCountChange]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await getStudentReturnedReviewDetailAction(selectedId);
      if (cancelled) return;
      if (!res.ok) {
        setError(res.message);
        setDetail(null);
        return;
      }
      setDetail(res.review);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-white">
      <header className="shrink-0 border-b border-slate-200 px-4 py-4 sm:px-6">
        <h1 className="text-xl font-bold text-slate-900">フィードバック</h1>
        <p className="mt-1 text-sm text-slate-600">
          教員から返却された評価とコメントを確認できます。
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
        {loading ? (
          <p className="text-sm text-slate-500">読み込み中…</p>
        ) : null}
        {error ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
            {error}
          </p>
        ) : null}

        {!loading && items.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
            まだ返却されたフィードバックはありません。
          </p>
        ) : null}

        <ul className="space-y-3">
          {items.map((item) => {
            const open = selectedId === item.reviewId;
            return (
              <li key={item.reviewId}>
                <button
                  type="button"
                  className={`flex min-h-11 w-full flex-col items-start rounded-xl border px-4 py-3 text-left ${
                    open
                      ? "border-sky-400 bg-sky-50"
                      : "border-slate-200 bg-white"
                  }`}
                  onClick={() =>
                    setSelectedId(open ? null : item.reviewId)
                  }
                >
                  <span className="text-sm font-semibold text-slate-900">
                    {item.cycleTitle}
                  </span>
                  <span className="mt-0.5 text-sm font-medium text-slate-800">
                    {item.milestoneTitle}
                  </span>
                  <span className="mt-0.5 text-xs text-slate-600">
                    {evaluationTypeLabel(item.evaluationType)} ・ 第
                    {item.submissionNumber}回提出
                  </span>
                  <span className="mt-1 text-xs text-slate-500">
                    返却：
                    {item.returnedAt
                      ? formatAssessmentDateTimeJa(item.returnedAt)
                      : "—"}
                  </span>
                </button>

                {open && detail && detail.reviewId === item.reviewId ? (
                  <div className="mt-2 space-y-4 rounded-xl border border-slate-200 bg-white p-4">
                    <section>
                      <h2 className="text-sm font-semibold text-slate-800">
                        評価項目
                      </h2>
                      <ul className="mt-2 space-y-2">
                        {ASSESSMENT_RUBRIC_KEYS.map((key) => {
                          const score = detail.rubricScores[key];
                          const n =
                            typeof score === "number" ? score : null;
                          return (
                            <li
                              key={key}
                              className="rounded-lg bg-slate-50 px-3 py-2"
                            >
                              <p className="text-sm font-medium text-slate-900">
                                {ASSESSMENT_RUBRIC_LABELS[key]}
                              </p>
                              <p className="mt-0.5 text-sm text-slate-700">
                                {n == null
                                  ? "評価なし"
                                  : `${n} / 5　${levelLabel(n)}`}
                              </p>
                            </li>
                          );
                        })}
                      </ul>
                    </section>

                    {detail.overallComment.trim() ? (
                      <CommentSection
                        title="総合コメント"
                        body={detail.overallComment}
                      />
                    ) : null}
                    {detail.strengthsComment.trim() ? (
                      <CommentSection
                        title="良かった点"
                        body={detail.strengthsComment}
                      />
                    ) : null}
                    {detail.nextStepsComment.trim() ? (
                      <CommentSection
                        title="次に考えてほしいこと"
                        body={detail.nextStepsComment}
                      />
                    ) : null}
                    {detail.missingInformationComment.trim() ? (
                      <CommentSection
                        title="不足情報・再確認事項"
                        body={detail.missingInformationComment}
                      />
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}

function CommentSection({ title, body }: { title: string; body: string }) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
        {body}
      </p>
    </section>
  );
}
