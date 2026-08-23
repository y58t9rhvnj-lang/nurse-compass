"use client";

import { formatAssessmentDateTimeJa } from "@/lib/v2/assessment/formatAssessmentDate";
import {
  evaluationTypeLabel,
  formatPatternIdsJa,
  milestoneTypeLabel,
} from "@/lib/v2/assessment/submissionScope";
import type {
  AssessmentSubmissionListItem,
  OpenAssessmentMilestoneItem,
} from "@/lib/v2/assessment/types";
import type { Form3PatternKey } from "@/lib/form3/form3Types";

function scopeNote(m: OpenAssessmentMilestoneItem): string | null {
  const scope = m.submissionScope.form3Scope;
  if (scope?.mode === "selected_patterns") {
    return `対象：${formatPatternIdsJa(scope.patternIds as Form3PatternKey[])}`;
  }
  if (m.submissionScope.includeForm3 && scope?.mode === "all_patterns") {
    return "対象：様式3 全パターン";
  }
  if (m.submissionScope.includeForm2 && !m.submissionScope.includeForm3) {
    return "対象：様式2";
  }
  return null;
}

function submittedBadge(latest: AssessmentSubmissionListItem): {
  label: string;
  className: string;
  statusLine: string;
} {
  if (latest.timingStatus === "on_time") {
    return {
      label: "提出済み",
      className: "border-[#B7D7C2] bg-[#F3FAF4] text-[#2F6B3C]",
      statusLine: "状態：期限内",
    };
  }
  if (latest.lateReviewStatus === "pending") {
    return {
      label: "期限後提出済み",
      className: "border-[#F0D9A8] bg-[#FFF8EC] text-[#8A5A12]",
      statusLine: "状態：教員確認待ち",
    };
  }
  if (latest.lateReviewStatus === "approved") {
    return {
      label: "期限後提出・承認済み",
      className: "border-[#B7D7C2] bg-[#F3FAF4] text-[#2F6B3C]",
      statusLine: "状態：期限後・承認済み",
    };
  }
  if (latest.lateReviewStatus === "rejected") {
    return {
      label: "期限後提出・評価対象外",
      className: "border-[#E5E5EA] bg-[#F5F5F7] text-[#6E6E73]",
      statusLine: "状態：評価対象外",
    };
  }
  return {
    label: "期限後提出済み",
    className: "border-[#F0D9A8] bg-[#FFF8EC] text-[#8A5A12]",
    statusLine: "状態：期限後",
  };
}

/**
 * 受付中の提出課題一覧。cycle 名を明示し、推測選択しない。
 * 提出済みはカードを残し「再提出可能」表示へ切り替える。
 */
export default function AssessmentOpenMilestoneList({
  items,
  selectedId,
  onSelect,
  onSubmit,
  onOpenHistory,
  submitting,
  loading,
}: {
  items: OpenAssessmentMilestoneItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onSubmit: (id: string) => void;
  onOpenHistory?: () => void;
  submitting: boolean;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <p className="no-print text-[12px] text-[#8E8E93]">提出課題を読み込み中…</p>
    );
  }
  if (items.length === 0) {
    return (
      <p className="no-print text-[12px] text-[#8E8E93]">
        現在受付中の提出課題はありません。
      </p>
    );
  }

  return (
    <section className="no-print space-y-2 rounded-2xl border border-[#E5E5EA] bg-white p-3">
      <h3 className="text-[13px] font-semibold text-[#1D1D1F]">提出課題</h3>
      <ul className="space-y-2">
        {items.map((m) => {
          const selected = m.milestoneId === selectedId;
          const patternNote = scopeNote(m);
          const latest = m.latestSubmission ?? null;
          const closed = m.status === "closed";
          const submitted = Boolean(latest);
          const badge = latest ? submittedBadge(latest) : null;
          const count = m.submissionCount ?? latest?.submissionNumber ?? 0;

          return (
            <li
              key={m.milestoneId}
              className={[
                "rounded-xl border px-3 py-2.5",
                selected
                  ? "border-[#0A84FF] bg-[#F2F7FF]"
                  : submitted
                    ? "border-[#D8E8D8] bg-[#FAFCFA]"
                    : "border-[#EBEBF0] bg-[#FAFAFC]",
              ].join(" ")}
            >
              <button
                type="button"
                className="w-full text-left"
                onClick={() => onSelect(m.milestoneId)}
              >
                <p className="text-[11px] font-medium text-[#6E86A8]">
                  {m.cycleTitle}
                </p>
                <div className="mt-0.5 flex flex-wrap items-center gap-2">
                  <p className="text-[14px] font-semibold text-[#1D1D1F]">
                    {m.milestoneTitle}
                  </p>
                  {badge ? (
                    <span
                      className={[
                        "rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                        badge.className,
                      ].join(" ")}
                    >
                      {badge.label}
                    </span>
                  ) : null}
                  {closed ? (
                    <span className="rounded-full border border-[#E5E5EA] bg-[#F5F5F7] px-2 py-0.5 text-[11px] font-semibold text-[#6E6E73]">
                      受付終了
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-[12px] text-[#6E6E73]">
                  {milestoneTypeLabel(m.milestoneType)} ・{" "}
                  {evaluationTypeLabel(m.evaluationType)}
                </p>
                {patternNote ? (
                  <p className="mt-0.5 text-[12px] text-[#6E6E73]">
                    {patternNote}
                  </p>
                ) : null}
                <p className="mt-0.5 text-[12px] text-[#3A3A3C]">
                  期限：{formatAssessmentDateTimeJa(m.deadlineAt)}
                </p>
                {latest && badge ? (
                  <div className="mt-2 space-y-0.5 text-[12px] text-[#3A3A3C]">
                    <p>
                      最終提出：{formatAssessmentDateTimeJa(latest.submittedAt)}
                    </p>
                    <p>提出回数：{count}回</p>
                    <p>{badge.statusLine}</p>
                  </div>
                ) : null}
              </button>

              <div className="mt-2 flex flex-col gap-1.5">
                <button
                  type="button"
                  className="flex h-11 w-full items-center justify-center rounded-xl bg-[#0A84FF] text-[13px] font-semibold text-white disabled:opacity-50"
                  disabled={submitting || closed}
                  onClick={() => onSubmit(m.milestoneId)}
                >
                  {closed
                    ? "受付終了"
                    : submitted
                      ? latest?.timingStatus === "late"
                        ? "再提出"
                        : "修正後に再提出"
                      : "課題を提出"}
                </button>
                {submitted || onOpenHistory ? (
                  <button
                    type="button"
                    className="flex h-10 w-full items-center justify-center rounded-xl border border-[#E5E5EA] bg-white text-[12px] font-medium text-[#0A84FF]"
                    onClick={() => onOpenHistory?.()}
                  >
                    提出履歴
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
