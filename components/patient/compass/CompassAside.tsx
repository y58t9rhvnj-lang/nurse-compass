"use client";

import type { Patient } from "@/lib/wardData";
import { getCompassExtra } from "@/lib/compassPatientData";
import CompassCoachCard from "./CompassCoachCard";
import CompassNav, { type CompassNavTarget } from "./CompassNav";

// Compass Patient（右ペイン）: ④ Compass Coach ＋ ⑤ Navigation。
export default function CompassAside({
  patient,
  onUseQuestion,
  onNavigate,
}: {
  patient: Patient;
  onUseQuestion: (question: string) => void;
  onNavigate: (target: CompassNavTarget) => void;
}) {
  const extra = getCompassExtra(patient.id);
  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <CompassCoachCard
        patient={patient}
        extra={extra}
        onUseQuestion={onUseQuestion}
      />
      <CompassNav onNavigate={onNavigate} />
    </div>
  );
}
