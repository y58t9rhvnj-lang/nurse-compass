"use client";

import {
  FORM3_PHASE_B_OPENING_GUIDE,
  FORM3_PHASE_B_PATTERNS_NOTE,
  FORM3_PHASE_B_THINKING_STEPS,
  FORM3_PHASE_B_THINKING_STEPS_NOTE,
} from "@/components/v2/form3/form3PhaseBEducationCopy";

/**
 * Form3 Phase B 冒頭のコンパクトな教育ガイド。
 * wizard / modal / step state ではない。
 */
export default function Form3PhaseBEducationGuide() {
  return (
    <aside
      aria-label="様式3の進め方"
      className="rounded-[14px] bg-[#F7F8FA] px-3.5 py-3 ring-1 ring-[#E8EAED] sm:px-4"
    >
      <p className="text-[13px] leading-relaxed text-[#3A3A3C]">
        {FORM3_PHASE_B_OPENING_GUIDE}
      </p>

      <ol className="mt-2.5 flex flex-col gap-0.5 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-2 sm:gap-y-0.5">
        {FORM3_PHASE_B_THINKING_STEPS.map((step, index) => (
          <li
            key={step}
            className="text-[12px] font-medium leading-snug text-[#52606D]"
          >
            {step}
            {index < FORM3_PHASE_B_THINKING_STEPS.length - 1 ? (
              <span
                className="mx-1 hidden text-[#98A2B3] sm:inline"
                aria-hidden
              >
                →
              </span>
            ) : null}
          </li>
        ))}
      </ol>
      <p className="mt-1 text-[11px] leading-snug text-[#8E8E93]">
        {FORM3_PHASE_B_THINKING_STEPS_NOTE}
      </p>

      <p className="mt-2.5 border-t border-[#E8EAED] pt-2.5 text-[12px] leading-relaxed text-[#667085]">
        {FORM3_PHASE_B_PATTERNS_NOTE}
      </p>
    </aside>
  );
}
