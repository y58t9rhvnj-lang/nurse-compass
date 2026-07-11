"use client";

import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import type { Patient } from "@/lib/wardData";
import PatientHero from "./PatientHero";
import StoryCard from "./StoryCard";
import ValuesCard from "./ValuesCard";
import PersonCard from "./PersonCard";
import StrengthsCard from "./StrengthsCard";
import WorriesCard from "./WorriesCard";
import DischargeHopeCard from "./DischargeHopeCard";
import NoteZone from "./notes/NoteZone";

// 患者トップ（中央）: 「一人の人」として理解するための物語中心の画面。
// 「その人を知る」→「回復に向けて」の2ゾーンで意味のまとまりを作る。
export default function PatientTop({
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
  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-5">
      <button
        type="button"
        onClick={onBack}
        className="flex w-fit items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[13px] font-medium text-[#0A84FF] shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:bg-[#F2F7FF]"
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={2} />
        病棟ホームへ戻る
      </button>

      <PatientHero patient={patient} />

      <Zone label="その人を知る" caption="経歴・価値観・人物像">
        <div className="col-span-2">
          <StoryCard patient={patient} />
        </div>
        <ValuesCard patient={patient} />
        <PersonCard patient={patient} />
      </Zone>

      <Zone label="回復に向けて" caption="強み・困りごと・退院への思い">
        <StrengthsCard patient={patient} />
        <WorriesCard patient={patient} />
        <div className="col-span-2">
          <DischargeHopeCard patient={patient} />
        </div>
      </Zone>

      <NoteZone
        patientId={patient.id}
        pendingQuestion={pendingQuestion}
        onClearPendingQuestion={onClearPendingQuestion}
      />
    </div>
  );
}

function Zone({
  label,
  caption,
  children,
}: {
  label: string;
  caption: string;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-2.5 flex items-center gap-2">
        <span className="h-4 w-1 rounded-full bg-[#0A84FF]" />
        <h3 className="text-[15px] font-bold text-[#1D1D1F]">{label}</h3>
        <span className="text-[11px] text-[#AEAEB5]">{caption}</span>
      </div>
      <div className="grid grid-cols-2 gap-4">{children}</div>
    </section>
  );
}
