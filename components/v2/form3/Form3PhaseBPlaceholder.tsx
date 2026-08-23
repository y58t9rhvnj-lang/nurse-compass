"use client";

/**
 * Form3 Phase B 入口（B0）。
 * Cards / Final / Source は未実装。Feature Flag ON 時の安全な Placeholder。
 */

export default function Form3PhaseBPlaceholder({
  patientName,
}: {
  patientName?: string;
}) {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#EDEDF0]">
      <header className="shrink-0 border-b border-[#D8D8DE] bg-white px-4 py-3">
        <p className="text-[11px] font-medium tracking-wide text-[#6B6B76]">
          様式3 · Phase B
        </p>
        <h1 className="mt-1 text-[17px] font-semibold text-[#1A1A1F]">
          Form3 Phase B（準備中）
        </h1>
        {patientName ? (
          <p className="mt-1 text-[13px] text-[#6B6B76]">{patientName}</p>
        ) : null}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
        <p className="max-w-prose text-[14px] leading-relaxed text-[#1A1A1F]">
          Information Cards / Assessment Cards / Final Form
          の実装はこれから進めます。Version2.1 では Form3PhaseBWorkspace
          が正式な様式3です。
        </p>
      </div>
    </div>
  );
}
