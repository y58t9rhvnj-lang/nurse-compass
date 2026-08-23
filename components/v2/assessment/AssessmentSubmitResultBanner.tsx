"use client";

import { CheckCircle2 } from "lucide-react";
import { formatAssessmentDateTimeJa } from "@/lib/v2/assessment/formatAssessmentDate";
import type { AssessmentSubmitSuccess } from "@/lib/v2/assessment/types";

export default function AssessmentSubmitResultBanner({
  result,
}: {
  result: AssessmentSubmitSuccess;
}) {
  const when = formatAssessmentDateTimeJa(result.submittedAt);
  const late = result.timingStatus === "late";

  return (
    <div className="no-print rounded-xl border border-[#D8E8D8] bg-[#F3FAF4] px-3 py-2.5 text-[13px] text-[#2F6B3C]">
      <p className="flex items-center gap-1.5 font-semibold">
        <CheckCircle2 className="h-4 w-4 shrink-0" strokeWidth={2} />
        {late
          ? "期限後提出として受け付けました"
          : "提出しました"}
      </p>
      <ul className="mt-1.5 space-y-0.5 pl-5 text-[12px] text-[#3F7E52]">
        <li>提出日時：{when}</li>
        {!late ? (
          <li>提出回数：{result.submissionNumber}回目</li>
        ) : null}
        <li>
          状態：
          {late ? "教員確認待ち" : "期限内"}
        </li>
      </ul>
    </div>
  );
}
