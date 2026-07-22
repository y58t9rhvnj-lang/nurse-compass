"use client";

import type { Patient } from "@/lib/wardData";
import LearningSupportAside from "@/components/v2/learning/LearningSupportAside";
import ChartCoachPanel from "./ChartCoachPanel";

// Compass Chart 右ペイン（Sprint D-2D ④⑥ / 追加修正②）:
//   患者トップ・会話・思考ワークスペースと同一の共通レイアウト（LearningSupportAside）へ統一する。
//   ・Compassノート（主役）… 入力欄＋履歴を独立スクロールで常に確認できる（NoteZone variant="fill"）。
//     カルテで入力したメモも他画面と同一の共有ストア（AppShell の Supabase 版 NotesContext）へ
//     保存され、統合表示される（重複しない）。
//   ・Compass Coach（補助）… 折りたたみ可能＋高さ制限。閉じても Compassノートは残る。
export default function ChartAside({
  patient,
  pendingQuestion,
  onClearPendingQuestion,
  onUseQuestion,
}: {
  patient: Patient;
  pendingQuestion?: { text: string; token: number } | null;
  onClearPendingQuestion?: () => void;
  onUseQuestion: (question: string) => void;
}) {
  return (
    <LearningSupportAside
      patientId={patient.id}
      pendingQuestion={pendingQuestion}
      onClearPendingQuestion={onClearPendingQuestion}
      coach={
        <div className="px-3 py-2.5">
          <ChartCoachPanel
            patient={patient}
            onUseQuestion={onUseQuestion}
            hideHeading
          />
        </div>
      }
    />
  );
}
