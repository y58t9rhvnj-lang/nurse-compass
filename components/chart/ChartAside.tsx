"use client";

import type { Patient } from "@/lib/wardData";
import ChartCoachPanel from "./ChartCoachPanel";
import ChartNotesPanel from "./ChartNotesPanel";

// Compass Chart 右ペイン：補助的な Notes / Coach（電子カルテ閲覧を邪魔しない）
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
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3">
      <p className="px-1 text-[10px] text-[#AEAEB5]">学習支援（補助）</p>
      <ChartNotesPanel
        patientId={patient.id}
        pendingQuestion={pendingQuestion}
        onClearPendingQuestion={onClearPendingQuestion}
      />
      <ChartCoachPanel patient={patient} onUseQuestion={onUseQuestion} />
    </div>
  );
}
