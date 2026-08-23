"use client";

import { Hand, Highlighter, X } from "lucide-react";
import type { LectureDrawingApi } from "./useLectureDrawing";

const BTN =
  "flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl px-3 text-[13px] font-medium transition-colors";

function toolClass(active: boolean): string {
  return active
    ? `${BTN} bg-[#0A84FF] text-white shadow-[0_2px_8px_rgba(10,132,255,0.28)]`
    : `${BTN} bg-white text-[#3A3A3C] hover:bg-[#F2F2F5]`;
}

/**
 * 講義用の固定バー（白基調・ドラッグ／最小化なし）。
 * 描画ツールはホワイトボード内に限定。
 */
export default function LectureBar({
  api,
  onRequestExit,
}: {
  api: LectureDrawingApi;
  onRequestExit: () => void;
}) {
  const { mode, whiteboardOpen, selectMode, openWhiteboard } = api;

  if (whiteboardOpen) return null;

  return (
    <div
      data-lecture-chrome
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[200] flex justify-center px-3 pb-[max(10px,env(safe-area-inset-bottom))] pt-2"
    >
      <div className="pointer-events-auto flex max-w-[min(100%,420px)] flex-wrap items-center gap-1.5 rounded-2xl border border-[#E5E5EA] bg-white/95 px-2 py-1.5 shadow-[0_4px_16px_rgba(0,0,0,0.08)] backdrop-blur-sm">
        <span className="hidden px-1.5 text-[11px] font-medium text-[#8E8E93] sm:inline">
          講義
        </span>

        <button
          type="button"
          className={toolClass(mode === "off")}
          title="通常操作（学生画面をそのまま使う）"
          aria-label="通常操作"
          aria-pressed={mode === "off"}
          onClick={() => selectMode("off")}
        >
          <Hand className="h-4 w-4" strokeWidth={2} />
          通常
        </button>

        <button
          type="button"
          className={toolClass(false)}
          title="ホワイトボードを開く"
          aria-label="ホワイトボード"
          onClick={openWhiteboard}
        >
          <Highlighter className="h-4 w-4" strokeWidth={2} />
          ホワイトボード
        </button>

        <div className="mx-0.5 h-6 w-px bg-[#EBEBF0]" aria-hidden />

        <button
          type="button"
          className={`${BTN} bg-[#FFF1F0] text-[#FF3B30] hover:bg-[#FFE4E1]`}
          title="講義を終了"
          aria-label="講義を終了"
          onClick={onRequestExit}
        >
          <X className="h-4 w-4" strokeWidth={2} />
          終了
        </button>
      </div>
    </div>
  );
}
