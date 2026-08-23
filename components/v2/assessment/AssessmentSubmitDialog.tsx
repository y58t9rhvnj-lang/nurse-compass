"use client";

import {
  formatAssessmentDateTimeJa,
  formatAssessmentTimeJa,
} from "@/lib/v2/assessment/formatAssessmentDate";
import type { AssessmentSubmitPreview } from "@/lib/v2/assessment/types";

/**
 * 課題提出の確認 Dialog（期限内／期限後）。
 * 「最終提出」という表現は使わない。
 */
export default function AssessmentSubmitDialog({
  open,
  preview,
  submitting,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  preview: AssessmentSubmitPreview | null;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open || !preview) return null;

  const late = preview.wouldBeLate;
  const deadlineLabel = formatAssessmentDateTimeJa(preview.deadlineAt);
  const deadlineTime = formatAssessmentTimeJa(preview.deadlineAt);

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/35 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="assessment-submit-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-[#E5E5EA] bg-white p-5 shadow-[0_12px_40px_rgba(0,0,0,0.18)]">
        <h2
          id="assessment-submit-title"
          className="text-[16px] font-semibold text-[#1D1D1F]"
        >
          {late ? "期限後提出の確認" : "課題を提出"}
        </h2>

        <p className="mt-2 text-[13px] text-[#6E6E73]">
          提出期限：{deadlineLabel}
        </p>
        <p className="mt-1 text-[12px] text-[#8E8E93]">
          {deadlineTime}
          以降の提出は期限後として記録されます
        </p>

        {late ? (
          <div className="mt-4 rounded-xl border border-[#F5C6C2] bg-[#FFF1F0] px-3 py-3 text-[13px] leading-relaxed text-[#9B2C2C]">
            <p>提出期限を過ぎています。</p>
            <p className="mt-2">
              この提出は「期限後提出」として記録されます。教員が承認した場合に評価対象となります。
            </p>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-[#E5E5EA] bg-[#FAFAFC] px-3 py-3 text-[13px] leading-relaxed text-[#3A3A3C]">
            <p>現在の内容を提出します。</p>
            <p className="mt-2">
              提出後も期限までは修正して、再度提出できます。
            </p>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="flex h-11 min-w-[96px] items-center justify-center rounded-xl border border-[#E5E5EA] bg-white px-4 text-[13px] font-medium text-[#3A3A3C] hover:bg-[#F2F2F5] disabled:opacity-50"
            onClick={onCancel}
            disabled={submitting}
          >
            キャンセル
          </button>
          <button
            type="button"
            className={[
              "flex h-11 min-w-[120px] items-center justify-center rounded-xl px-4 text-[13px] font-semibold text-white disabled:opacity-50",
              late ? "bg-[#C0392B] hover:opacity-90" : "bg-[#0A84FF] hover:opacity-90",
            ].join(" ")}
            onClick={onConfirm}
            disabled={submitting}
          >
            {submitting
              ? "提出中…"
              : late
                ? "期限後として提出"
                : "提出"}
          </button>
        </div>
      </div>
    </div>
  );
}
