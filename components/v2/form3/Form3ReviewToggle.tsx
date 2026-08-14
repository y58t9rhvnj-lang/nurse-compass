"use client";

import {
  FORM3_REVIEW_ISSUE_LABELS,
} from "@/components/v2/form3/form3UiLabels";
import type { Form3ReviewIssue } from "@/lib/form3/form3Validation";
export type Form3ReviewToggleProps = {
  isReviewed: boolean;
  issues: Form3ReviewIssue[];
  onMarkReviewed: () => { ok: true } | { ok: false; issues: Form3ReviewIssue[] };
  onUnmarkReviewed: () => void;
};

/**
 * 「整理済み」は提出・最終確定ではない。
 * 現在の整理が一区切りついた状態として扱う。
 */
export default function Form3ReviewToggle({
  isReviewed,
  issues,
  onMarkReviewed,
  onUnmarkReviewed,
}: Form3ReviewToggleProps) {
  if (isReviewed) {
    return (
      <section
        aria-label="整理の状態"
        className="rounded-xl border border-[#A8D5B5] bg-[#EAF7EE] px-3.5 py-3"
      >
        <p className="text-[13px] font-semibold text-[#1B4332]">
          このパターンの整理は一区切りです
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-[#2D6A4F]">
          提出や最終確定ではありません。必要なら解除して、考え直せます。
        </p>
        <button
          type="button"
          onClick={onUnmarkReviewed}
          className="mt-3 inline-flex min-h-[44px] items-center rounded-lg border border-[#2D6A4F]/30 bg-white px-3 text-[13px] font-medium text-[#1B4332] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2D6A4F]"
        >
          整理済みを解除して再編集する
        </button>
      </section>
    );
  }

  return (
    <section aria-label="整理の完了" className="space-y-2">
      <button
        type="button"
        onClick={() => {
          onMarkReviewed();
        }}
        className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-[#1D1D1F] bg-[#1D1D1F] px-4 text-[14px] font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A84FF] sm:w-auto"
      >
        このパターンの整理を完了する
      </button>
      <p className="text-[12px] leading-relaxed text-[#6E6E73]">
        判断と根拠がそろったとき、いまの整理に一区切りをつけます。あとからいつでも直せます。
      </p>
      {issues.length > 0 ? (
        <ul className="space-y-1 rounded-lg border border-[#F3D6D2] bg-[#FBEAE8] px-3 py-2" role="alert">
          {issues.map((issue) => (
            <li key={issue} className="text-[12px] font-medium text-[#C0392B]">
              {FORM3_REVIEW_ISSUE_LABELS[issue]}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
