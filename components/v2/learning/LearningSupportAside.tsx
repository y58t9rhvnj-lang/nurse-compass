"use client";

// Compass Version2 — 学習支援サイド（共通レイアウト）。
//
// 目的（Sprint D-2D 追加修正②）:
//   電子カルテ右ペインで採用した「Compassノート（主役）＋ Compass Coach（折りたたみ）」の構造を、
//   患者トップ・会話・思考ワークスペースなど Compassノート＋Coach を出す全画面へ統一する。
//   画面ごとに右カラムを別実装せず、この 1 コンポーネントへ集約する（薄い器）。
//
// 構造:
//   上段: Compassノート（NoteZone variant="fill"）… 入力欄＋履歴を独立スクロールで常に確認できる。
//         最低高さを確保し、主役として flex-1 で最大化する。
//   下段: Compass Coach（折りたたみ可能）… ヘッダーのトグルで開閉。開いても高さ制限＋内部スクロールで
//         ノート領域を押し潰さない。閉じるとヘッダーのみになり、ノート履歴が残る。
//
// coach（中身）は各画面から差し込む（会話＝FacingCoachPanel / カルテ＝ChartCoachPanel /
//   思考ワークスペース＝問いベース Coach など）。Coach のロジック・Question 生成・保存処理には関与しない。
//   差し込む Coach は自前の見出しを持たない（hideHeading）前提。本コンポーネントが見出しトグルを提供する。

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Sparkles } from "lucide-react";
import NoteZone from "@/components/patient/notes/NoteZone";

export default function LearningSupportAside({
  patientId,
  coach,
  pendingQuestion,
  onClearPendingQuestion,
  coachLabel = "Compass Coach",
  defaultCoachOpen = true,
}: {
  patientId: string;
  // Coach 本体（見出しなし）。この領域内でスクロールする。
  coach: ReactNode;
  // 会話 Coach 等から使う問い引き渡し（NoteZone へ）。任意。
  pendingQuestion?: { text: string; token: number } | null;
  onClearPendingQuestion?: () => void;
  coachLabel?: string;
  defaultCoachOpen?: boolean;
}) {
  const [coachOpen, setCoachOpen] = useState(defaultCoachOpen);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      {/* Compassノート（主役・最小高さ確保・履歴のみ独立スクロール） */}
      <div className="min-h-[220px] min-w-0 flex-1 overflow-hidden border-b border-[#E5E5EA]">
        <NoteZone
          patientId={patientId}
          variant="fill"
          pendingQuestion={pendingQuestion}
          onClearPendingQuestion={onClearPendingQuestion}
        />
      </div>

      {/* Compass Coach（補助・折りたたみ／高さ制限） */}
      <section className="shrink-0">
        <button
          type="button"
          onClick={() => setCoachOpen((v) => !v)}
          aria-expanded={coachOpen}
          className="flex min-h-[40px] w-full items-center gap-1.5 px-3 py-2 text-left transition-colors hover:bg-[#F7F7F9]"
        >
          {coachOpen ? (
            <ChevronDown className="h-4 w-4 text-[#AEAEB5]" strokeWidth={2} />
          ) : (
            <ChevronRight className="h-4 w-4 text-[#AEAEB5]" strokeWidth={2} />
          )}
          <Sparkles className="h-3.5 w-3.5 text-[#AF52DE]/70" strokeWidth={2} />
          <span className="text-[12px] font-semibold text-[#6E6E73]">
            {coachLabel}
          </span>
        </button>
        {coachOpen && (
          <div className="max-h-[34vh] overflow-y-auto overscroll-contain border-t border-[#F0F0F3]">
            {coach}
          </div>
        )}
      </section>
    </div>
  );
}
