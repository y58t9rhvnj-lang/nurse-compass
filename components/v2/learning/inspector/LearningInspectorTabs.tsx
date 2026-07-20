"use client";

// Compass Version2 — Learning Inspector のタブ内容（様式2 Workspace 用）。
//
// 設計（docs/version2/13_ui_architecture.md §5 / 16_workspace_mockups.md §3, §6）:
//   Learning Inspector は器（開閉・レイアウト・状態保持）だけを担い、中身は Workspace ごとに
//   差し替わる「Panel の集合（タブ）」。様式2 Workspace では次の 2 タブを表示する。
//     ・Coach        … 情報不足・情報収集・整理漏れへの気づきを促す問い（答えは出さない）。
//                       既存 QuestionPanel（問い一覧）を再利用する（改善はしない）。
//     ・Compass Note … 気付き・疑問・仮説・後で考えたいことを残す個人の思考記録。
//                       既存 NoteZone（Compassメモ）を再利用する（仕様変更はしない）。
//
// 状態保持: タブ切替で下書き・選択状態を失わないよう、両パネルを常時 mount し CSS で可視切替する。
//   アクティブタブ自体は上位（AppShell）の Inspector state（activePanel）で保持する。

import type { Question } from "@/lib/v2/question/questionTypes";
import type { QuestionPanelController } from "@/hooks/v2/useQuestionPanel";
import QuestionPanel from "@/components/v2/workspace/panels/QuestionPanel";
import NoteZone from "@/components/patient/notes/NoteZone";

export type Form2InspectorTab = "coach" | "compassNote";

export default function LearningInspectorTabs({
  activeTab,
  onTabChange,
  questions,
  questionController,
  patientId,
}: {
  activeTab: Form2InspectorTab;
  onTabChange: (tab: Form2InspectorTab) => void;
  questions: Question[];
  questionController: QuestionPanelController;
  patientId: string;
}) {
  return (
    <div className="-mx-4 -my-4 flex min-h-0 flex-1 flex-col">
      {/* タブバー（スクロールしても上部に留める）。器（WorkspaceInspector）の本文内に置く。 */}
      <div
        role="tablist"
        aria-label="学習支援の切り替え"
        className="sticky top-0 z-10 flex gap-1 border-b border-[#EFEFF2] bg-white px-4 py-2"
      >
        <TabButton
          active={activeTab === "coach"}
          onClick={() => onTabChange("coach")}
          label="Coach"
        />
        <TabButton
          active={activeTab === "compassNote"}
          onClick={() => onTabChange("compassNote")}
          label="Compass Note"
        />
      </div>

      {/* 両パネルとも mount 維持（タブ切替で下書き・選択状態を失わない）。CSS で可視切替。 */}
      <div className="min-h-0 flex-1 px-4 py-4">
        <div
          role="tabpanel"
          aria-label="Coach"
          className={activeTab === "coach" ? "block" : "hidden"}
        >
          <QuestionPanel questions={questions} controller={questionController} />
        </div>
        <div
          role="tabpanel"
          aria-label="Compass Note"
          className={activeTab === "compassNote" ? "block" : "hidden"}
        >
          <NoteZone patientId={patientId} />
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={[
        "min-h-[44px] flex-1 rounded-full px-3 text-[13px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A84FF]/40",
        active
          ? "bg-[#1D1D1F] font-semibold text-white"
          : "bg-[#F2F2F5] text-[#3A3A3C] hover:bg-[#E9E9EE]",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
