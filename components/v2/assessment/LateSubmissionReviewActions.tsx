"use client";

import { useState, useTransition } from "react";
import {
  approveLateAssessmentSubmissionAction,
  rejectLateAssessmentSubmissionAction,
} from "@/app/v2/actions/assessmentLateReview";
import { lateReviewStatusLabel } from "@/lib/v2/assessment/teacherReviewLabels";
import type { AssessmentLateReviewStatus } from "@/lib/v2/assessment/types";

type Props = {
  submissionId: string;
  lateReviewStatus: AssessmentLateReviewStatus | null;
  timingIsLate: boolean;
  onDone: (result: {
    candidateChanged: boolean;
    previousCandidateSubmissionId: string | null;
    newCandidateSubmissionId: string | null;
    submissionNumber: number;
    decision: "approved" | "rejected";
  }) => void;
};

export default function LateSubmissionReviewActions({
  submissionId,
  lateReviewStatus,
  timingIsLate,
  onDone,
}: Props) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!timingIsLate || !lateReviewStatus) {
    return <span className="text-xs text-slate-500">—</span>;
  }

  if (lateReviewStatus !== "pending") {
    return (
      <span className="text-xs font-medium text-slate-700">
        {lateReviewStatusLabel(lateReviewStatus)}
      </span>
    );
  }

  const run = (decision: "approved" | "rejected") => {
    const confirmMsg =
      decision === "approved"
        ? "この期限後提出を評価対象として承認します。\n現在の評価対象が変更される場合があります。"
        : "この期限後提出を評価対象外とします。";
    if (!window.confirm(confirmMsg)) return;
    setError(null);
    startTransition(async () => {
      const res =
        decision === "approved"
          ? await approveLateAssessmentSubmissionAction({
              submissionId,
              note,
            })
          : await rejectLateAssessmentSubmissionAction({
              submissionId,
              note,
            });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setNote("");
      onDone({
        candidateChanged: res.candidateChanged,
        previousCandidateSubmissionId: res.previousCandidateSubmissionId,
        newCandidateSubmissionId: res.newCandidateSubmissionId,
        submissionNumber: res.submissionNumber,
        decision: res.decision,
      });
    });
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-amber-900">教員確認待ち</p>
      <textarea
        className="min-h-16 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
        placeholder="理由（任意・1000文字以内）"
        maxLength={1000}
        value={note}
        disabled={pending}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          className="flex min-h-11 items-center rounded-lg bg-emerald-700 px-3 text-sm font-medium text-white disabled:opacity-50"
          onClick={() => run("approved")}
        >
          承認
        </button>
        <button
          type="button"
          disabled={pending}
          className="flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 disabled:opacity-50"
          onClick={() => run("rejected")}
        >
          却下
        </button>
      </div>
      {error ? <p className="text-xs text-rose-700">{error}</p> : null}
    </div>
  );
}
