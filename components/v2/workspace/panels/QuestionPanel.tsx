"use client";

// Compass Version2 — Question Panel（Inspector の最初の中身 / 設計書 12）。
//
// 役割: 学生が「次に何を確認・観察・考えるか」に自分で気づくための、静かな問いの一覧。
//   答え・診断・様式2 転記文は出さない（Direct Diagnosis 禁止 / Principles §2）。
// 純表示コンポーネント: 選択・状態は親から渡る controller（useQuestionPanel）で管理し、
//   Inspector を閉じても Workspace 側に保持される。Evidence データは変更しない。

import { Eye, Lightbulb, Search } from "lucide-react";
import type {
  Question,
  QuestionCategory,
  QuestionStatus,
} from "@/lib/v2/question/questionTypes";
import {
  QUESTION_CATEGORY_LABEL,
  QUESTION_CATEGORY_ORDER,
  QUESTION_STATUS_LABEL,
  QUESTION_STATUS_ORDER,
} from "@/lib/v2/question/questionTypes";
import type { QuestionPanelController } from "@/hooks/v2/useQuestionPanel";

const CATEGORY_ICON: Record<
  QuestionCategory,
  React.ComponentType<{ className?: string; strokeWidth?: number }>
> = {
  confirm: Search,
  observe: Eye,
  think: Lightbulb,
};

function byPriority(a: Question, b: Question): number {
  return (a.priority ?? 999) - (b.priority ?? 999);
}

export default function QuestionPanel({
  questions,
  controller,
}: {
  questions: Question[];
  controller: QuestionPanelController;
}) {
  if (questions.length === 0) {
    return <QuestionEmpty />;
  }

  return (
    <div className="space-y-4">
      {/* 冒頭の短い前置き（答えではないことを静かに伝える）。 */}
      <p className="text-[12.5px] leading-relaxed text-[#8E8E93]">
        答えではなく、次に考えるための手がかりです。気になる問いから、自分の言葉で確かめてみましょう。
      </p>

      {QUESTION_CATEGORY_ORDER.map((category) => {
        const items = questions
          .filter((q) => q.category === category)
          .sort(byPriority);
        if (items.length === 0) return null;
        return (
          <section key={category} aria-labelledby={`qcat-${category}`}>
            <QuestionCategoryHeading category={category} />
            <ul className="mt-2 space-y-2">
              {items.map((q) => (
                <QuestionCard
                  key={q.id}
                  question={q}
                  selected={controller.selectedId === q.id}
                  status={controller.statusOf(q.id)}
                  onSelect={() => controller.select(q.id)}
                  onSetStatus={(s) => controller.setStatus(q.id, s)}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function QuestionCategoryHeading({ category }: { category: QuestionCategory }) {
  const Icon = CATEGORY_ICON[category];
  return (
    <h3
      id={`qcat-${category}`}
      className="flex items-center gap-1.5 text-[12px] font-semibold text-[#6E6E73]"
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={1.9} />
      {QUESTION_CATEGORY_LABEL[category]}
    </h3>
  );
}

function QuestionCard({
  question,
  selected,
  status,
  onSelect,
  onSetStatus,
}: {
  question: Question;
  selected: boolean;
  status: QuestionStatus;
  onSelect: () => void;
  onSetStatus: (status: QuestionStatus) => void;
}) {
  const detailId = `qdetail-${question.id}`;
  const relatedCount = question.relatedEvidenceIds?.length ?? 0;

  return (
    <li>
      <div
        className={[
          "rounded-2xl border bg-white transition",
          selected ? "border-[#0A84FF]" : "border-[#EBEBF0]",
        ].join(" ")}
      >
        {/* 選択（問い本文）。展開/折りたたみのトグル。 */}
        <button
          type="button"
          onClick={onSelect}
          aria-current={selected ? "true" : undefined}
          aria-expanded={selected}
          aria-controls={detailId}
          className="flex w-full flex-col gap-1.5 rounded-2xl px-3.5 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A84FF]/40"
        >
          <span className="self-start">
            <StatusPill status={status} />
          </span>
          <span className="text-[13px] leading-relaxed text-[#1D1D1F]">
            {question.prompt}
          </span>
        </button>

        {/* 詳細（選択時のみ）。目的・関連根拠の控えめな表示・状態変更。 */}
        {selected && (
          <div
            id={detailId}
            className="space-y-3 border-t border-[#F0F0F3] px-3.5 py-3"
          >
            {question.purpose && (
              <p className="text-[12.5px] leading-relaxed text-[#6E6E73]">
                {question.purpose}
              </p>
            )}

            {relatedCount > 0 && (
              <p className="text-[12px] text-[#8E8E93]">
                関連する気づき: {relatedCount}件
              </p>
            )}

            <div>
              <p className="mb-1.5 text-[11px] font-semibold text-[#8E8E93]">
                この問いの状態
              </p>
              <div
                role="group"
                aria-label="問いの状態を変更"
                className="flex flex-wrap gap-1.5"
              >
                {QUESTION_STATUS_ORDER.map((s) => {
                  const active = s === status;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => onSetStatus(s)}
                      aria-pressed={active}
                      className={[
                        "min-h-[44px] rounded-full border px-3.5 text-[12px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A84FF]/40",
                        active
                          ? "border-[#0A84FF] bg-[#EAF3FF] font-semibold text-[#0A6CD6]"
                          : "border-[#E5E5EA] bg-white text-[#6E6E73] hover:bg-[#F2F2F5]",
                      ].join(" ")}
                    >
                      {QUESTION_STATUS_LABEL[s]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </li>
  );
}

// 状態バッジ。色だけに依存せず、必ずテキストラベルを併記する。
function StatusPill({ status }: { status: QuestionStatus }) {
  const tone: Record<QuestionStatus, string> = {
    unread: "border-[#E5E5EA] bg-[#F2F2F7] text-[#8E8E93]",
    considering: "border-[#D6E4F7] bg-[#EAF3FF] text-[#0A6CD6]",
    reviewed: "border-[#D8E8D8] bg-[#EFF6EF] text-[#3F7E52]",
  };
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        tone[status],
      ].join(" ")}
    >
      {QUESTION_STATUS_LABEL[status]}
    </span>
  );
}

function QuestionEmpty() {
  return (
    <div className="space-y-2">
      <p className="text-[13px] leading-relaxed text-[#3A3A3C]">
        現在表示する問いはありません。
      </p>
      <div className="rounded-2xl border border-[#EBEBF0] bg-[#F7F9FC] px-3.5 py-3">
        <p className="text-[12.5px] leading-relaxed text-[#8E8E93]">
          患者情報や気づきを確認すると、考えるための問いがここに表示されます。
        </p>
      </div>
    </div>
  );
}
