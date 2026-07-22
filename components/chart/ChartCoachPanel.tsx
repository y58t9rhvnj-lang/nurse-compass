"use client";

import { PenLine, Sparkles } from "lucide-react";
import type { Patient } from "@/lib/wardData";
import { getCompassExtra } from "@/lib/compassPatientData";

// 右ペイン用の控えめな Compass Coach（1問い＋補助問い1件まで）
// hideHeading: 親が見出し（折りたたみトグル等）を持つ場合に内部見出しを省く（Sprint D-2D ④）。
export default function ChartCoachPanel({
  patient,
  onUseQuestion,
  hideHeading,
}: {
  patient: Patient;
  onUseQuestion: (question: string) => void;
  hideHeading?: boolean;
}) {
  const extra = getCompassExtra(patient.id);
  const subQuestion = patient.profile?.coachQuestions?.[0];

  return (
    <section className="rounded-xl border border-[#E8E0F5]/60 bg-[#FAF8FF] p-2.5">
      {!hideHeading && (
        <div className="mb-2 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-[#AF52DE]/70" strokeWidth={2} />
          <h3 className="text-[11px] font-semibold text-[#6E6E73]">
            Compass Coach
          </h3>
        </div>
      )}

      <p className="text-[12px] leading-relaxed text-[#5C4A7A]">
        {extra.coachPrompt}
      </p>
      <button
        type="button"
        onClick={() => onUseQuestion(extra.coachPrompt)}
        className="mt-1.5 flex min-h-[44px] w-fit items-center gap-1 text-[11px] font-medium text-[#AF52DE] transition hover:text-[#8E3FBE]"
      >
        <PenLine className="h-3.5 w-3.5" strokeWidth={2} />
        メモする
      </button>

      {subQuestion && (
        <div className="mt-2 border-t border-[#E8E0F5]/60 pt-2">
          <p className="text-[11px] leading-relaxed text-[#7A6B94]">
            {subQuestion}
          </p>
          <button
            type="button"
            onClick={() => onUseQuestion(subQuestion)}
            className="mt-1 flex min-h-[44px] w-fit items-center gap-1 text-[11px] font-medium text-[#AF52DE] transition hover:text-[#8E3FBE]"
          >
            <PenLine className="h-3.5 w-3.5" strokeWidth={2} />
            メモする
          </button>
        </div>
      )}
    </section>
  );
}
