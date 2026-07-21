"use client";

// Compass Version2 — 学習支援カラム（共通レイアウト）。
//
// 目的（Sprint D-1 追加修正2 ⑨⑩⑪）:
//   患者トップ・会話・思考ワークスペースで使う「Compassノート（上）＋ Compass Coach（下）」の
//   右カラムを、画面ごとに別デザインにせず 1 つの共通レイアウトへ統一する。
//   ・上下 2 領域に分割し、それぞれ独立してスクロールできる（右カラム全体を 1 本の長い
//     スクロールにしない）。
//   ・高さ配分の目安は ノート 45% / Coach 55%。画面高が低い場合は最小高さ
//     （ノート 220px / Coach 260px）を確保し、収まらないときのみカラム全体をスクロールする。
//
// 中身（note / coach）は各画面から差し込む（Core の会話 Coach＝FacingCoachPanel、
//   思考ワークスペース＝問いベースの Coach など）。本コンポーネントは器のみで、
//   Coach ロジック・Question 生成・保存処理には関与しない。

import type { ReactNode } from "react";

export default function LearningSupportColumn({
  note,
  coach,
}: {
  // 上: Compassノート（NoteZone variant="fill" 等）。自身で見出し固定・一覧スクロール・入力欄下部固定を担う。
  note: ReactNode;
  // 下: Compass Coach（FacingCoachPanel / 問いベース Coach 等）。自身の領域内でスクロールする。
  coach: ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto overscroll-contain bg-white">
      {/* 上: Compassノート（45%・最小 220px） */}
      <section className="flex min-h-[220px] grow-[45] basis-0 flex-col overflow-hidden">
        {note}
      </section>

      {/* 下: Compass Coach（55%・最小 260px）。中身が自前で高さを埋める（InspectorCoach）場合も、
          自然高で収まらない Coach（FacingCoachPanel）の場合も破綻しないよう領域内スクロールを許可。 */}
      <section className="flex min-h-[260px] grow-[55] basis-0 flex-col overflow-y-auto border-t border-[#E5E5EA]">
        {coach}
      </section>
    </div>
  );
}
