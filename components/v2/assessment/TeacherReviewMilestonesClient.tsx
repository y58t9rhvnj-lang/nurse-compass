"use client";

import { useRouter } from "next/navigation";
import type { TeacherReviewMilestoneSummary } from "@/lib/v2/assessment/teacherReviewRepository";
import { formatAssessmentDateTimeJa } from "@/lib/v2/assessment/formatAssessmentDate";
import {
  evaluationTypeLabel,
  formatSubmissionScopeJa,
  statusLabel,
} from "@/lib/v2/assessment/submissionScope";
import { caseDisplayLabel } from "@/lib/v2/assessment/teacherReviewLabels";

type Props = {
  milestones: TeacherReviewMilestoneSummary[];
  activeStudentTotal: number;
};

export default function TeacherReviewMilestonesClient({
  milestones,
  activeStudentTotal,
}: Props) {
  const router = useRouter();

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
        実学生 {milestones[0]?.realStudentCount ?? activeStudentTotal}名で提出状況を集計しています（
        検証用アカウントは本番 AI 評価対象外。受入テストでは利用可能）。
      </div>

      {milestones.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          提出課題がまだありません。「提出課題・期限設定」で課題を作成してください。
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[880px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
                <th className="px-3 py-3">講義・課題グループ</th>
                <th className="px-3 py-3">課題名</th>
                <th className="px-3 py-3">対象事例</th>
                <th className="px-3 py-3">提出種別</th>
                <th className="px-3 py-3">評価</th>
                <th className="px-3 py-3">提出期限</th>
                <th className="px-3 py-3">状態</th>
                <th className="px-3 py-3 text-right">提出</th>
                <th className="px-3 py-3 text-right">未提出</th>
                <th className="px-3 py-3 text-right">期限後</th>
                <th className="px-3 py-3 text-right">AI評価</th>
                <th className="px-3 py-3 text-right">未評価</th>
                <th className="px-3 py-3 text-right">検証用</th>
              </tr>
            </thead>
            <tbody>
              {milestones.map((m) => (
                <tr
                  key={m.milestoneId}
                  role="link"
                  tabIndex={0}
                  className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50 focus-visible:bg-sky-50 focus-visible:outline-none"
                  onClick={() =>
                    router.push(`/v2/teacher/reviews/${m.milestoneId}`)
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push(`/v2/teacher/reviews/${m.milestoneId}`);
                    }
                  }}
                >
                  <td className="min-h-11 px-3 py-3 font-medium text-slate-800">
                    {m.cycleTitle}
                  </td>
                  <td className="px-3 py-3 font-semibold text-slate-900">
                    {m.title}
                  </td>
                  <td className="px-3 py-3">{caseDisplayLabel(m.caseId)}</td>
                  <td className="px-3 py-3">
                    {formatSubmissionScopeJa(
                      m.milestoneType,
                      m.submissionScope,
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {evaluationTypeLabel(m.evaluationType)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-xs">
                    {formatAssessmentDateTimeJa(m.deadlineAt)}
                  </td>
                  <td className="px-3 py-3">{statusLabel(m.status)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {m.submittedStudentCount}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-500">
                    {m.unsubmittedStudentCount}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-amber-800">
                    {m.lateStudentCount}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-emerald-800">
                    {m.candidateStudentCount}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-sky-800">
                    {m.unevaluatedStudentCount}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-500">
                    {m.verificationStudentCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
