"use client";

import {
  formatForm3OverallProgressLabel,
  getForm3SaveStatusView,
} from "@/components/v2/form3/form3UiLabels";
import type { Form3SaveStatus } from "@/lib/v2/notebook/form3HookLogic";

export type Form3HeaderProps = {
  patientName?: string;
  saveStatus: Form3SaveStatus;
  lastSavedAt: string;
  hydrated: boolean;
  reviewedCount: number;
  totalPatterns: number;
  onLoadLatest?: () => void;
};

export default function Form3Header({
  patientName,
  saveStatus,
  lastSavedAt,
  hydrated,
  reviewedCount,
  totalPatterns,
  onLoadLatest,
}: Form3HeaderProps) {
  const saveView = getForm3SaveStatusView(saveStatus, lastSavedAt, hydrated);
  const progressLabel = formatForm3OverallProgressLabel(
    reviewedCount,
    totalPatterns,
  );

  const toneClass =
    saveView.tone === "error" || saveView.tone === "conflict"
      ? "text-[#C0392B]"
      : saveView.tone === "warn"
        ? "text-[#8A6D3B]"
        : saveView.tone === "busy"
          ? "text-[#0A6CD6]"
          : "text-[#6E6E73]";

  return (
    <header className="shrink-0 border-b border-[#E5E5EA] bg-white">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3 sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] leading-tight text-[#8E8E93]">様式3</p>
          <h1 className="text-[16px] font-semibold leading-tight text-[#1D1D1F] sm:text-[17px]">
            アセスメント
            {patientName ? (
              <span className="ml-2 text-[13px] font-normal text-[#6E6E73]">
                {patientName}
              </span>
            ) : null}
          </h1>
          <p className="mt-0.5 text-[12px] text-[#8E8E93]">
            1つの健康パターンに集中して、患者理解を深めます
          </p>
        </div>

        <div className="flex w-full flex-col items-stretch gap-1.5 sm:ml-auto sm:w-auto sm:items-end">
          <p
            className="text-[12px] font-medium tabular-nums text-[#3A3A3C]"
            aria-label={progressLabel}
          >
            {progressLabel}
          </p>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {saveView.label ? (
              <span
                aria-live="polite"
                className={`text-[11px] sm:text-[12px] ${toneClass}`}
                suppressHydrationWarning
              >
                {saveView.label}
              </span>
            ) : null}
            {saveView.showLoadLatest && onLoadLatest ? (
              <button
                type="button"
                onClick={onLoadLatest}
                className="inline-flex min-h-[44px] items-center rounded-lg border border-[#F3D6D2] bg-[#FBEAE8] px-3 text-[12px] font-semibold text-[#C0392B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C0392B]"
              >
                最新版を読み込む
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
