"use client";

// Compass Version2 — Learning Inspector の中身（様式2 Workspace 用）。
//
// 正式構成（Sprint D-1 追加修正 ⑤⑥）:
//   タブではなく、上下 2 領域の縦構成に統一する。
//     上: ノート（NoteZone / Compassメモ）… カルテ・患者情報・会話を見ながら短い気づきを残す。
//     下: Compass Coach（QuestionPanel）… 必要なときに使う思考支援（問い）。
//   電子カルテや左 Workspace パネルと同じデザイン体系（見出し・区切り線・余白・角丸）で統一し、
//   派手な AI チャット風にはしない。
//
// Coach の初期表示（Sprint D-1 追加修正 ④）:
//   開いた直後は Coach の提示を最小限にする（問いを大量に並べない・観察項目や正解候補を先出ししない）。
//   学生が必要なときに展開でき、過去のやり取り（考え中・確認済みにした問い）があれば確認できる。
//   Coach のロジック・Question 生成（questions / controller）は変更しない（初期表示と見せ方のみ調整）。

import { useState } from "react";
import { ChevronDown, MessageCircle } from "lucide-react";
import type { Question, QuestionStatus } from "@/lib/v2/question/questionTypes";
import { QUESTION_STATUS_LABEL } from "@/lib/v2/question/questionTypes";
import type { QuestionPanelController } from "@/hooks/v2/useQuestionPanel";
import QuestionPanel from "@/components/v2/workspace/panels/QuestionPanel";
import LearningSupportAside from "@/components/v2/learning/LearningSupportAside";

export default function LearningInspectorPanels({
  questions,
  questionController,
  patientId,
}: {
  questions: Question[];
  questionController: QuestionPanelController;
  patientId: string;
}) {
  // 患者トップ・会話・電子カルテと同じ共通レイアウト（LearningSupportAside）で統一。
  //   上: Compassノート（主役・独立スクロール） / 下: Compass Coach（折りたたみ）。
  // Coach 見出し・開閉は LearningSupportAside が持つため、InspectorCoach は見出しなしの本文だけを渡す。
  return (
    <LearningSupportAside
      patientId={patientId}
      coach={
        <InspectorCoach questions={questions} controller={questionController} />
      }
    />
  );
}

function InspectorCoach({
  questions,
  controller,
}: {
  questions: Question[];
  controller: QuestionPanelController;
}) {
  // 既定は最小表示（問いを並べない）。学生が必要なときに全問へ展開できる。
  const [expanded, setExpanded] = useState(false);
  // これまでに触れた問い（unread 以外）＝過去のやり取り。履歴として確認できる。
  const touched = questions.filter(
    (q) => controller.statusOf(q.id) !== "unread",
  );

  // Coach 本文のみ（見出し・開閉トグルは LearningSupportAside 側が担当・重複させない）。
  return (
    <div className="px-4 py-3">
      {expanded ? (
        <div className="space-y-2">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="text-[12px] font-medium text-[#8E8E93] transition hover:text-[#3A3A3C]"
            >
              とじる
            </button>
          </div>
          <QuestionPanel questions={questions} controller={controller} />
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-[12px] leading-relaxed text-[#8E8E93]">
            情報を確認したら、考えるための問いをここで受け取れます。答えや観察項目を先には出しません。
          </p>

          {/* 過去のやり取り（あれば確認できる。無ければ出さない）。 */}
          {touched.length > 0 && (
            <div className="rounded-2xl border border-[#EBEBF0] bg-[#FBFAFF] px-3.5 py-3">
              <p className="mb-1.5 text-[11px] font-semibold text-[#8E8E93]">
                これまでに考えた問い（{touched.length}件）
              </p>
              <ul className="space-y-1.5">
                {touched.slice(0, 3).map((q) => (
                  <li key={q.id}>
                    <button
                      type="button"
                      onClick={() => {
                        controller.select(q.id);
                        setExpanded(true);
                      }}
                      className="flex w-full items-start gap-2 rounded-xl px-2 py-1.5 text-left transition hover:bg-white"
                    >
                      <StatusDot status={controller.statusOf(q.id)} />
                      <span className="text-[12.5px] leading-snug text-[#3A3A3C]">
                        {q.prompt}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-full border border-[#E4DAF7] bg-[#F7F2FF] px-3 text-[13px] font-semibold text-[#AF52DE] transition hover:bg-[#F0E6FB]"
          >
            <MessageCircle className="h-4 w-4" strokeWidth={2} />
            問いを開く
            <ChevronDown className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      )}
    </div>
  );
}

// 状態を色＋テキストで示す小さなドット（色のみに依存しない）。
function StatusDot({ status }: { status: QuestionStatus }) {
  const tone: Record<QuestionStatus, string> = {
    unread: "bg-[#C7C7CC]",
    considering: "bg-[#0A84FF]",
    reviewed: "bg-[#34C759]",
  };
  return (
    <span
      className="mt-0.5 inline-flex shrink-0 items-center gap-1"
      aria-label={QUESTION_STATUS_LABEL[status]}
    >
      <span className={`h-2 w-2 rounded-full ${tone[status]}`} />
    </span>
  );
}
