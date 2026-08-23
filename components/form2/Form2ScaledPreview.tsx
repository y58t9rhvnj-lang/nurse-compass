"use client";

/**
 * 画面プレビュー専用：用紙（Paper）全体を一体で scale する。
 * 印刷 portal（Form2PrintPortal）とは独立。zoom / fit を印刷 DOM へ渡さない。
 *
 * 構造:
 *   PreviewViewport（親）
 *   └─ ScaledLayoutBox  width/height = natural × scale（レイアウト寸法）
 *      └─ Paper         transform: scale; origin top left（見た目）
 *         └─ Form2SheetView lockNaturalSize
 */

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Form2SheetView from "@/components/form2/Form2SheetView";
import type { Form2Data } from "@/lib/form2/form2Types";

const SCROLLBAR_ALLOWANCE = 8;

export type Form2ScaledPreviewProps = {
  data: Form2Data;
  /** 表示倍率（1 = 100%）。親が fit / manual を計算して渡す。 */
  scale: number;
  /** Viewport の横 padding（片側）。fit 計算は親側。 */
  className?: string;
  /** Paper 外周の装飾。workspace プレビューでも用紙と一体にする。 */
  paperClassName?: string;
  /** 自然寸法が変わったとき（ページ数変化など） */
  onNaturalSizeChange?: (size: { width: number; height: number }) => void;
  /** ページ DOM 計測用（親がページ送りする場合） */
  onPaperMount?: (paper: HTMLElement | null) => void;
  children?: ReactNode;
};

/**
 * ScaledLayoutBox + Paper。Viewport は親が用意する。
 */
export default function Form2ScaledPreview({
  data,
  scale,
  className = "",
  paperClassName = "overflow-hidden rounded-xl border border-[#D1D1D6]/90 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] [&_.form2-preview>.no-print]:hidden",
  onNaturalSizeChange,
  onPaperMount,
}: Form2ScaledPreviewProps) {
  const paperRef = useRef<HTMLDivElement>(null);
  const [natural, setNatural] = useState({ width: 0, height: 0 });

  const measure = useCallback(() => {
    const paper = paperRef.current;
    if (!paper) return;
    // transform 祖先があっても offsetWidth/Height はレイアウト（原寸）寸法
    const width = paper.offsetWidth;
    const height = paper.offsetHeight;
    if (width <= 0 || height <= 0) return;
    setNatural((prev) =>
      prev.width === width && prev.height === height
        ? prev
        : { width, height },
    );
    onNaturalSizeChange?.({ width, height });
  }, [onNaturalSizeChange]);

  useLayoutEffect(() => {
    onPaperMount?.(paperRef.current);
    measure();
    const paper = paperRef.current;
    if (!paper) return;
    const ro = new ResizeObserver(() => {
      measure();
    });
    ro.observe(paper);
    return () => {
      ro.disconnect();
      onPaperMount?.(null);
    };
  }, [data, measure, onPaperMount]);

  const safeScale =
    Number.isFinite(scale) && scale > 0 ? scale : 1;
  const layoutW = natural.width > 0 ? natural.width * safeScale : undefined;
  const layoutH = natural.height > 0 ? natural.height * safeScale : undefined;

  return (
    <div
      className={`relative shrink-0 ${className}`.trim()}
      data-form2-scaled-layout=""
      style={{
        width: layoutW != null ? `${layoutW}px` : undefined,
        height: layoutH != null ? `${layoutH}px` : undefined,
      }}
    >
      <div
        data-form2-scaled-paper=""
        className="origin-top-left"
        style={{
          transform: `scale(${safeScale})`,
          transformOrigin: "top left",
          width: natural.width > 0 ? `${natural.width}px` : undefined,
        }}
      >
        <div ref={paperRef} className={paperClassName} data-form2-paper="">
          <Form2SheetView data={data} lockNaturalSize />
        </div>
      </div>
    </div>
  );
}

/** Viewport 幅から fit-width 倍率を算出 */
export function computeFitScale(
  viewportClientWidth: number,
  naturalWidth: number,
  horizontalPadding: number,
  minScale: number,
  maxScale: number,
): number {
  if (naturalWidth <= 0) return 1;
  const available = Math.max(
    0,
    viewportClientWidth - horizontalPadding * 2 - SCROLLBAR_ALLOWANCE,
  );
  if (available <= 0) return minScale;
  const raw = available / naturalWidth;
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  return Math.min(maxScale, Math.max(minScale, raw));
}
