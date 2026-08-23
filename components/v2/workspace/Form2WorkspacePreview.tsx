"use client";

/**
 * 様式2 Workspace「プレビュー」モード用。
 * フル幅の外側白カードは置かず、Paper 全体を一体 scale する。
 * 印刷は Form2PrintPortal のみ（ここから scale を渡さない）。
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Form2ScaledPreview, {
  computeFitScale,
} from "@/components/form2/Form2ScaledPreview";
import type { Form2Data } from "@/lib/form2/form2Types";

const MIN_SCALE = 0.6;
const FIT_MAX_SCALE = 2.5;
const VIEWPORT_PAD_X = 12;

export default function Form2WorkspacePreview({
  data,
}: {
  data: Form2Data;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(1);
  const [naturalWidth, setNaturalWidth] = useState(0);
  const [viewportW, setViewportW] = useState(0);

  const recomputeFit = useCallback((natW: number) => {
    const viewport = viewportRef.current;
    if (!viewport || natW <= 0) return;
    setViewportW(viewport.clientWidth);
    setFitScale(
      computeFitScale(
        viewport.clientWidth,
        natW,
        VIEWPORT_PAD_X,
        MIN_SCALE,
        FIT_MAX_SCALE,
      ),
    );
  }, []);

  const onNaturalSizeChange = useCallback(
    (size: { width: number; height: number }) => {
      setNaturalWidth(size.width);
      recomputeFit(size.width);
    },
    [recomputeFit],
  );

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const run = () => {
      if (naturalWidth > 0) recomputeFit(naturalWidth);
    };
    run();
    const ro = new ResizeObserver(run);
    ro.observe(viewport);
    return () => ro.disconnect();
  }, [naturalWidth, recomputeFit, data]);

  const scaledW = naturalWidth > 0 ? naturalWidth * fitScale : 0;
  const shouldCenter =
    viewportW <= 0 ||
    scaledW <= 0 ||
    scaledW <= viewportW - VIEWPORT_PAD_X * 2;

  return (
    <div
      ref={viewportRef}
      data-form2-preview-viewport=""
      className="min-h-0 w-full overflow-auto overscroll-contain rounded-2xl bg-[#F2F2F7] px-3 py-3"
    >
      <div
        className={[
          "flex min-w-0",
          shouldCenter ? "justify-center" : "justify-start",
        ].join(" ")}
      >
        <Form2ScaledPreview
          data={data}
          scale={fitScale}
          onNaturalSizeChange={onNaturalSizeChange}
        />
      </div>
    </div>
  );
}
