"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  Eraser,
  PenLine,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import {
  LECTURE_PEN_COLORS,
  LECTURE_PEN_WIDTHS,
  type LecturePoint,
  type LectureStroke,
} from "./lectureDrawingTypes";
import type { LectureDrawingApi } from "./useLectureDrawing";

const TOOL_BTN =
  "flex h-11 min-w-11 items-center justify-center rounded-xl px-2.5 text-[12px] font-medium transition-colors";

function toolClass(active: boolean): string {
  return active
    ? `${TOOL_BTN} bg-[#0A84FF] text-white`
    : `${TOOL_BTN} bg-white text-[#3A3A3C] ring-1 ring-[#E5E5EA] hover:bg-[#F2F2F5]`;
}

function pointsToPathD(points: LecturePoint[]): string {
  if (points.length === 0) return "";
  const [first, ...rest] = points;
  let d = `M ${first.x} ${first.y}`;
  if (rest.length === 0) {
    d += ` L ${first.x + 0.01} ${first.y}`;
    return d;
  }
  for (const p of rest) d += ` L ${p.x} ${p.y}`;
  return d;
}

function clientToLocal(
  el: Element,
  clientX: number,
  clientY: number,
): LecturePoint {
  const rect = el.getBoundingClientRect();
  const w = (el as HTMLElement).clientWidth || rect.width || 1;
  const h = (el as HTMLElement).clientHeight || rect.height || 1;
  return {
    x: ((clientX - rect.left) / (rect.width || 1)) * w,
    y: ((clientY - rect.top) / (rect.height || 1)) * h,
  };
}

/**
 * 全画面ホワイトボード（学生画面上への描画ではない）。
 * Pointer Events + setPointerCapture で長い線を安定描画。
 */
export default function LectureWhiteboard({
  api,
  onRequestExit,
}: {
  api: LectureDrawingApi;
  onRequestExit: () => void;
}) {
  const {
    mode,
    strokes,
    penColor,
    penWidth,
    setPenColor,
    setPenWidth,
    selectMode,
    closeWhiteboard,
    beginStroke,
    extendStroke,
    endStroke,
    undo,
    clearAll,
    canUndo,
  } = api;

  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const activePointerIdRef = useRef<number | null>(null);

  const syncViewBox = useCallback(() => {
    const svg = svgRef.current;
    const surface = surfaceRef.current;
    if (!svg || !surface) return;
    const w = surface.clientWidth || window.innerWidth;
    const h = surface.clientHeight || window.innerHeight;
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.setAttribute("width", String(w));
    svg.setAttribute("height", String(h));
  }, []);

  useEffect(() => {
    syncViewBox();
    window.addEventListener("resize", syncViewBox);
    window.addEventListener("orientationchange", syncViewBox);
    return () => {
      window.removeEventListener("resize", syncViewBox);
      window.removeEventListener("orientationchange", syncViewBox);
    };
  }, [syncViewBox]);

  const canDraw = mode === "pen" || mode === "eraser";

  const finishPointer = (pointerId: number, target: HTMLElement) => {
    if (activePointerIdRef.current !== pointerId) return;
    activePointerIdRef.current = null;
    try {
      target.releasePointerCapture(pointerId);
    } catch {
      // ignore
    }
    endStroke();
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!canDraw) return;
    if (
      e.target instanceof Element &&
      e.target.closest("[data-lecture-whiteboard-toolbar]")
    ) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    const surface = surfaceRef.current;
    if (!surface) return;
    activePointerIdRef.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = clientToLocal(surface, e.clientX, e.clientY);
    beginStroke(p, mode === "eraser" ? "eraser" : "pen");
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== e.pointerId) return;
    e.preventDefault();
    const surface = surfaceRef.current;
    if (!surface) return;
    extendStroke(clientToLocal(surface, e.clientX, e.clientY));
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    finishPointer(e.pointerId, e.currentTarget);
  };

  const onLostPointerCapture = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== e.pointerId) return;
    activePointerIdRef.current = null;
    endStroke();
  };

  const visible: LectureStroke[] = strokes.filter((s) => s.points.length > 0);

  return (
    <div
      data-lecture-whiteboard
      className="fixed inset-0 z-[210] flex flex-col bg-white"
    >
      <div
        data-lecture-whiteboard-toolbar
        className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-[#E5E5EA] bg-[#FAFAFC] px-3 py-2"
      >
        <span className="mr-1 text-[12px] font-medium text-[#8E8E93]">
          ホワイトボード
        </span>

        <button
          type="button"
          className={toolClass(mode === "pen")}
          title="ペン"
          aria-label="ペン"
          aria-pressed={mode === "pen"}
          onClick={() => selectMode("pen")}
        >
          <PenLine className="h-4 w-4" strokeWidth={2} />
        </button>
        <button
          type="button"
          className={toolClass(mode === "eraser")}
          title="消しゴム"
          aria-label="消しゴム"
          aria-pressed={mode === "eraser"}
          onClick={() => selectMode("eraser")}
        >
          <Eraser className="h-4 w-4" strokeWidth={2} />
        </button>
        <button
          type="button"
          className={toolClass(false)}
          title="元に戻す"
          aria-label="元に戻す"
          disabled={!canUndo}
          onClick={undo}
        >
          <Undo2 className="h-4 w-4" strokeWidth={2} />
        </button>
        <button
          type="button"
          className={toolClass(false)}
          title="全消去"
          aria-label="全消去"
          onClick={clearAll}
        >
          <Trash2 className="h-4 w-4" strokeWidth={2} />
        </button>

        <div className="mx-1 h-6 w-px bg-[#EBEBF0]" aria-hidden />

        {LECTURE_PEN_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            title={`色 ${c}`}
            aria-label={`色 ${c}`}
            className={`h-9 w-9 rounded-full ring-2 ${
              penColor === c ? "ring-[#0A84FF]" : "ring-[#E5E5EA]"
            }`}
            style={{ background: c }}
            onClick={() => setPenColor(c)}
          />
        ))}

        <div className="mx-1 h-6 w-px bg-[#EBEBF0]" aria-hidden />

        {LECTURE_PEN_WIDTHS.map((w) => (
          <button
            key={w}
            type="button"
            className={toolClass(penWidth === w)}
            title={`線幅 ${w}`}
            aria-label={`線幅 ${w}`}
            onClick={() => setPenWidth(w)}
          >
            {w}
          </button>
        ))}

        <div className="flex-1" />

        <button
          type="button"
          className={`${TOOL_BTN} bg-white text-[#3A3A3C] ring-1 ring-[#E5E5EA] hover:bg-[#F2F2F5]`}
          title="ホワイトボードを閉じる"
          aria-label="閉じる"
          onClick={closeWhiteboard}
        >
          <X className="h-4 w-4" strokeWidth={2} />
          閉じる
        </button>
        <button
          type="button"
          className={`${TOOL_BTN} bg-[#FFF1F0] text-[#FF3B30] hover:bg-[#FFE4E1]`}
          title="講義を終了"
          aria-label="講義を終了"
          onClick={onRequestExit}
        >
          終了
        </button>
      </div>

      <div
        ref={surfaceRef}
        className="relative min-h-0 flex-1 touch-none overscroll-none"
        style={{ touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onLostPointerCapture={onLostPointerCapture}
      >
        <svg
          ref={svgRef}
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden
        >
          {visible.map((s) => (
            <path
              key={s.id}
              d={pointsToPathD(s.points)}
              fill="none"
              stroke={s.color}
              strokeWidth={s.width}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </svg>
      </div>
    </div>
  );
}
