"use client";

/**
 * 患者理解画面用の様式2読み取り専用プレビュー。
 * Form2PrintPortal は使わない（通常画面プレビュー専用）。
 * 表示倍率は Form2ScaledPreview 全体に適用。様式2データ / 印刷には影響しない。
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Form2ScaledPreview, {
  computeFitScale,
} from "@/components/form2/Form2ScaledPreview";
import type { Form2Data } from "@/lib/form2/form2Types";

export type Form2ReadonlyPreviewPaneProps = {
  data: Form2Data;
  hydrated: boolean;
  className?: string;
};

const ZOOM_STORAGE_KEY = "form2-readonly-preview-zoom";
const MIN_SCALE = 0.6;
const MAX_SCALE = 1.6;
const SCALE_STEP = 0.1;
/** fit-width のみ。手動倍率上限とは別 */
const FIT_MAX_SCALE = 2.5;
const VIEWPORT_PAD_X = 16;

type ZoomMode = "fit-width" | "manual";

type ZoomState = {
  mode: ZoomMode;
  scale: number;
};

function clampManual(n: number): number {
  const stepped = Math.round(n / SCALE_STEP) * SCALE_STEP;
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, Number(stepped.toFixed(2))));
}

function readZoomState(): ZoomState {
  try {
    const raw = localStorage.getItem(ZOOM_STORAGE_KEY);
    if (!raw) return { mode: "fit-width", scale: 1 };
    const parsed = JSON.parse(raw) as Partial<ZoomState>;
    if (parsed.mode === "manual" && typeof parsed.scale === "number") {
      return { mode: "manual", scale: clampManual(parsed.scale) };
    }
    return { mode: "fit-width", scale: 1 };
  } catch {
    return { mode: "fit-width", scale: 1 };
  }
}

function writeZoomState(state: ZoomState) {
  try {
    localStorage.setItem(ZOOM_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export default function Form2ReadonlyPreviewPane({
  data,
  hydrated,
  className = "",
}: Form2ReadonlyPreviewPaneProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const paperElRef = useRef<HTMLElement | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [zoom, setZoom] = useState<ZoomState>(() => {
    if (typeof window === "undefined") return { mode: "fit-width", scale: 1 };
    return readZoomState();
  });
  const [fitScale, setFitScale] = useState(1);
  const [naturalWidth, setNaturalWidth] = useState(0);
  const [layoutWidth, setLayoutWidth] = useState(0);

  const syncPageCount = useCallback(() => {
    const root = paperElRef.current;
    if (!root) return;
    const pages = root.querySelectorAll(".form2-page");
    const n = Math.max(1, pages.length);
    setTotalPages(n);
    setPage((p) => Math.min(Math.max(1, p), n));
  }, []);

  const recomputeFit = useCallback(
    (natW: number) => {
      const viewport = viewportRef.current;
      if (!viewport || natW <= 0) return;
      setFitScale(
        computeFitScale(
          viewport.clientWidth,
          natW,
          VIEWPORT_PAD_X,
          MIN_SCALE,
          FIT_MAX_SCALE,
        ),
      );
      setLayoutWidth(viewport.clientWidth);
    },
    [],
  );

  const onNaturalSizeChange = useCallback(
    (size: { width: number; height: number }) => {
      setNaturalWidth(size.width);
      recomputeFit(size.width);
      syncPageCount();
    },
    [recomputeFit, syncPageCount],
  );

  const onPaperMount = useCallback((el: HTMLElement | null) => {
    paperElRef.current = el;
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const viewport = viewportRef.current;
    if (!viewport) return;

    const run = () => {
      if (naturalWidth > 0) recomputeFit(naturalWidth);
      else if (paperElRef.current) {
        const w = paperElRef.current.offsetWidth;
        if (w > 0) {
          setNaturalWidth(w);
          recomputeFit(w);
        }
      }
      syncPageCount();
    };
    run();

    const ro = new ResizeObserver(run);
    ro.observe(viewport);
    return () => ro.disconnect();
  }, [hydrated, data, naturalWidth, recomputeFit, syncPageCount]);

  const applyZoom = useCallback((next: ZoomState) => {
    setZoom(next);
    writeZoomState(next);
  }, []);

  const effectiveScale =
    zoom.mode === "fit-width" ? fitScale : zoom.scale;

  const zoomOut = () => {
    const base = zoom.mode === "manual" ? zoom.scale : fitScale;
    applyZoom({ mode: "manual", scale: clampManual(base - SCALE_STEP) });
  };

  const zoomIn = () => {
    const base = zoom.mode === "manual" ? zoom.scale : fitScale;
    applyZoom({ mode: "manual", scale: clampManual(base + SCALE_STEP) });
  };

  const zoomFit = () => {
    applyZoom({ mode: "fit-width", scale: zoom.scale });
    if (naturalWidth > 0) recomputeFit(naturalWidth);
  };

  const goToPage = (next: number) => {
    const root = paperElRef.current;
    if (!root) return;
    const pages = root.querySelectorAll(".form2-page");
    if (pages.length === 0) return;
    const clamped = Math.min(Math.max(1, next), pages.length);
    setPage(clamped);
    pages[clamped - 1]?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  const percentLabel = `${Math.round(effectiveScale * 100)}%`;
  const scaledW =
    naturalWidth > 0 ? naturalWidth * effectiveScale : 0;
  const shouldCenter =
    layoutWidth <= 0 || scaledW <= 0 || scaledW <= layoutWidth - VIEWPORT_PAD_X * 2;

  return (
    <div
      className={`flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-[#F2F2F7] ${className}`.trim()}
      data-form2-readonly-preview=""
    >
      <header className="no-print flex shrink-0 flex-col gap-2 border-b border-[#E5E5EA] bg-white/90 px-4 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-[#1D1D1F]">
              様式2プレビュー
            </p>
            <p className="mt-0.5 text-[11px] text-[#8E8E93]">
              読み取り専用 · 学校指定様式
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => goToPage(page - 1)}
              className="min-h-[44px] rounded-xl px-3 text-[13px] font-medium text-[#344054] disabled:text-[#C7C7CC]"
            >
              前へ
            </button>
            <span className="min-w-[3.5rem] text-center text-[12px] tabular-nums text-[#6E6E73]">
              {page}/{totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => goToPage(page + 1)}
              className="min-h-[44px] rounded-xl px-3 text-[13px] font-medium text-[#344054] disabled:text-[#C7C7CC]"
            >
              次へ
            </button>
          </div>
        </div>

        <div
          className="flex flex-wrap items-center gap-2"
          aria-label="表示倍率"
        >
          <div className="inline-flex items-center rounded-[10px] bg-[#E8E8ED] p-0.5">
            <button
              type="button"
              onClick={zoomOut}
              disabled={zoom.mode === "manual" && zoom.scale <= MIN_SCALE}
              aria-label="縮小"
              className="inline-flex h-9 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-[17px] font-medium text-[#1D1D1F] transition-colors duration-150 disabled:text-[#C7C7CC] hover:bg-white/70 active:bg-white motion-reduce:transition-none"
            >
              −
            </button>
            <span
              className="min-w-[3.25rem] px-1 text-center text-[12px] font-semibold tabular-nums text-[#1D1D1F]"
              aria-live="polite"
            >
              {percentLabel}
            </span>
            <button
              type="button"
              onClick={zoomIn}
              disabled={zoom.mode === "manual" && zoom.scale >= MAX_SCALE}
              aria-label="拡大"
              className="inline-flex h-9 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-[17px] font-medium text-[#1D1D1F] transition-colors duration-150 disabled:text-[#C7C7CC] hover:bg-white/70 active:bg-white motion-reduce:transition-none"
            >
              ＋
            </button>
          </div>
          <button
            type="button"
            onClick={zoomFit}
            aria-pressed={zoom.mode === "fit-width"}
            className={[
              "min-h-[44px] rounded-xl px-3 text-[12px] font-medium transition-colors duration-150 motion-reduce:transition-none",
              zoom.mode === "fit-width"
                ? "bg-white text-[#1D1D1F] shadow-sm ring-1 ring-[#D1D1D6]"
                : "bg-transparent text-[#6E6E73] hover:bg-[#E8E8ED]",
            ].join(" ")}
          >
            幅に合わせる
          </button>
        </div>
      </header>

      {/* PreviewViewport */}
      <div
        ref={viewportRef}
        data-form2-preview-viewport=""
        className="min-h-0 flex-1 overflow-auto overscroll-contain px-4 py-4"
      >
        {hydrated ? (
          <div
            className={[
              "flex min-w-0",
              shouldCenter ? "justify-center" : "justify-start",
            ].join(" ")}
          >
            <Form2ScaledPreview
              data={data}
              scale={effectiveScale}
              onNaturalSizeChange={onNaturalSizeChange}
              onPaperMount={onPaperMount}
            />
          </div>
        ) : (
          <div className="rounded-2xl border border-[#EBEBF0] bg-white/80 px-4 py-8 text-center text-[12.5px] text-[#8E8E93]">
            様式2を読み込んでいます…
          </div>
        )}
      </div>
    </div>
  );
}
