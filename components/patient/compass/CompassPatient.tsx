"use client";

import { ChevronLeft } from "lucide-react";
import type { Patient } from "@/lib/wardData";
import { getCompassExtra } from "@/lib/compassPatientData";
import NoteZone from "@/components/patient/notes/NoteZone";
import CompassHero from "./CompassHero";
import CompassPerson from "./CompassPerson";
import CompassStory from "./CompassStory";
import CompassToday from "./CompassToday";

// Compass Patient（中央）: 患者を「一人の人」として理解する画面。
// ① Hero → ② Person → ③ Today → 気づきメモ → 診断名（下部に小さく）。
export default function CompassPatient({
  patient,
  onBack,
  pendingQuestion,
  onClearPendingQuestion,
}: {
  patient: Patient;
  onBack: () => void;
  pendingQuestion?: { text: string; token: number } | null;
  onClearPendingQuestion?: () => void;
}) {
  const extra = getCompassExtra(patient.id);

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-5">
      <button
        type="button"
        onClick={onBack}
        className="flex min-h-[44px] w-fit items-center gap-1 rounded-full bg-white px-4 py-2 text-[13px] font-medium text-[#0A84FF] shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:bg-[#F2F7FF]"
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={2} />
        病棟ホームへ戻る
      </button>

      <CompassHero patient={patient} extra={extra} />
      <CompassPerson patient={patient} extra={extra} />
      <CompassStory patient={patient} />
      <CompassToday patient={patient} extra={extra} />

      <NoteZone
        patientId={patient.id}
        pendingQuestion={pendingQuestion}
        onClearPendingQuestion={onClearPendingQuestion}
      />

      {/* 診断名は補助情報として下部に小さく表示（患者像を優先） */}
      <p className="px-1 pb-1 text-[11px] text-[#AEAEB5]">
        診断：{patient.diagnosis}　/　入院日：{patient.admit}　/　主治医：
        {patient.doctor}
      </p>
    </div>
  );
}
