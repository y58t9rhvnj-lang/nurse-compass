"use client";

import { useCallback, useEffect, useState } from "react";
import { listMyAssessmentSubmissionsAction } from "@/app/v2/actions/assessmentSubmission";
import { formatAssessmentDateTimeJa } from "@/lib/v2/assessment/formatAssessmentDate";
import type { AssessmentSubmissionListItem } from "@/lib/v2/assessment/types";

function statusLabel(item: AssessmentSubmissionListItem): string {
  if (item.timingStatus === "on_time") return "期限内";
  if (item.lateReviewStatus === "pending") return "期限後・教員確認待ち";
  if (item.lateReviewStatus === "approved") return "期限後・承認済み";
  if (item.lateReviewStatus === "rejected") return "期限後・却下";
  return "期限後";
}

/**
 * 学生向け提出履歴（最小 UI）。
 */
export default function AssessmentSubmissionHistory({
  patientId,
  refreshKey = 0,
}: {
  patientId: string;
  refreshKey?: number;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<AssessmentSubmissionListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [deadlineAt, setDeadlineAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await listMyAssessmentSubmissionsAction(patientId);
    setLoading(false);
    if (!res.ok) {
      setError(res.message);
      setItems([]);
      return;
    }
    setItems(res.items);
    setDeadlineAt(res.deadlineAt);
  }, [patientId]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load, refreshKey]);

  return (
    <div className="no-print">
      <button
        type="button"
        className="text-[12px] font-medium text-[#0A84FF] underline-offset-2 hover:underline"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "提出履歴を閉じる" : "提出履歴を見る"}
      </button>

      {open ? (
        <div className="mt-2 rounded-xl border border-[#E5E5EA] bg-white px-3 py-2.5">
          <p className="text-[13px] font-semibold text-[#1D1D1F]">提出履歴</p>
          {deadlineAt ? (
            <p className="mt-0.5 text-[11px] text-[#8E8E93]">
              提出期限：{formatAssessmentDateTimeJa(deadlineAt)}
            </p>
          ) : null}

          {loading ? (
            <p className="mt-2 text-[12px] text-[#8E8E93]">読み込み中…</p>
          ) : error ? (
            <p className="mt-2 text-[12px] text-[#C0392B]">{error}</p>
          ) : items.length === 0 ? (
            <p className="mt-2 text-[12px] text-[#8E8E93]">まだ提出はありません。</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="rounded-lg border border-[#F0F0F3] bg-[#FAFAFC] px-2.5 py-2"
                >
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="text-[13px] font-semibold text-[#1D1D1F]">
                      {item.submissionNumber}回目
                    </span>
                    <span className="text-[12px] text-[#6E6E73]">
                      {formatAssessmentDateTimeJa(item.submittedAt)}
                    </span>
                    <span className="text-[12px] text-[#3A3A3C]">
                      {statusLabel(item)}
                    </span>
                  </div>
                  {item.isEvaluationCandidate ? (
                    <p className="mt-1 text-[11px] font-medium text-[#0A5FCC]">
                      現在の評価候補
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
