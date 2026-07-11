"use client";

import { PenLine, Sparkles } from "lucide-react";
import type { Patient } from "@/lib/wardData";
import type { CompassExtra } from "@/lib/compassPatientData";

// ④ Compass Coach: 答えではなく問いを返す。最初の問い＋患者別の問いカード。
export default function CompassCoachCard({
  patient,
  extra,
  onUseQuestion,
}: {
  patient: Patient;
  extra: CompassExtra;
  onUseQuestion: (question: string) => void;
}) {
  const questions = patient.profile?.coachQuestions ?? [];
  return (
    <section className="rounded-2xl border border-[#E4DAF7] bg-gradient-to-b from-[#F7F2FF] to-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#AF52DE]/12">
          <Sparkles className="h-3.5 w-3.5 text-[#AF52DE]" strokeWidth={2} />
        </span>
        <h3 className="text-[13px] font-semibold text-[#1D1D1F]">
          Compass Coach
        </h3>
      </div>

      {/* 最初の問い（大きめ） */}
      <div className="rounded-xl bg-[#AF52DE]/8 px-3.5 py-3">
        <p className="text-[14px] font-semibold leading-relaxed text-[#6B3FA0]">
          {extra.coachPrompt}
        </p>
        <button
          type="button"
          onClick={() => onUseQuestion(extra.coachPrompt)}
          className="mt-1 flex min-h-[44px] w-fit items-center gap-1 text-[12px] font-semibold text-[#AF52DE] transition hover:text-[#8E3FBE]"
        >
          <PenLine className="h-4 w-4" strokeWidth={2} />
          この問いをメモする
        </button>
      </div>

      {/* 患者別の問い */}
      {questions.length > 0 && (
        <ul className="mt-3 space-y-2">
          {questions.map((q) => (
            <li
              key={q}
              className="rounded-xl bg-white/80 px-3 py-2.5 text-[12.5px] leading-relaxed text-[#4A3A66]"
            >
              <p>{q}</p>
              <button
                type="button"
                onClick={() => onUseQuestion(q)}
                className="mt-0.5 flex min-h-[44px] w-fit items-center gap-1 text-[12px] font-semibold text-[#AF52DE] transition hover:text-[#8E3FBE]"
              >
                <PenLine className="h-4 w-4" strokeWidth={2} />
                この問いをメモする
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
