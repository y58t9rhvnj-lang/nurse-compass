"use client";

/**
 * Form3 印刷専用 portal（Form2PrintPortal と同型）。
 *
 * 画面プレビューの scale / fit / zoom とは完全分離。
 * body 直下に A4 等倍 DOM のみを置き、印刷時はそれ以外を非表示にする。
 *
 * 画面非表示は height:0 / left:-9999 を使わず、
 * visibility + opacity + 固定配置でレイアウト寸法（210mm）を維持する（iPad Safari 対策）。
 */

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Form3SheetView from "@/components/v2/form3/Form3SheetView";
import {
  buildForm3PrintLayout,
  buildForm3PrintLayoutFallback,
  type Form3PrintMeta,
} from "@/lib/form3/form3PrintLayout";
import type { Form3DataV2 } from "@/lib/form3/v2/form3V2Types";

export const FORM3_PRINT_PORTAL_ID = "form3-print-portal";

const noopSubscribe = () => () => {};

/** Form2PrintPortal の CSS を Form3 ID / class に置き換えたもの */
const PRINT_PORTAL_CSS = `
#${FORM3_PRINT_PORTAL_ID} {
  position: fixed !important;
  left: 0 !important;
  top: 0 !important;
  width: 210mm !important;
  min-width: 210mm !important;
  max-width: 210mm !important;
  height: auto !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: visible !important;
  opacity: 0 !important;
  visibility: hidden !important;
  pointer-events: none !important;
  z-index: -1 !important;
  background: #ffffff !important;
  transform: none !important;
  zoom: 1 !important;
  scale: none !important;
}
@media print {
  @page {
    size: A4 portrait;
    margin: 0;
  }
  html, body {
    width: auto !important;
    height: auto !important;
    min-height: 0 !important;
    overflow: visible !important;
    background: #ffffff !important;
    margin: 0 !important;
    padding: 0 !important;
    transform: none !important;
    zoom: 1 !important;
    scale: none !important;
    -webkit-text-size-adjust: 100% !important;
    text-size-adjust: 100% !important;
  }
  body > *:not(#form2-print-portal):not(#${FORM3_PRINT_PORTAL_ID}) {
    display: none !important;
  }
  #${FORM3_PRINT_PORTAL_ID} {
    display: block !important;
    position: static !important;
    left: auto !important;
    top: auto !important;
    right: auto !important;
    bottom: auto !important;
    width: 210mm !important;
    min-width: 210mm !important;
    max-width: 210mm !important;
    height: auto !important;
    margin: 0 auto !important;
    padding: 0 !important;
    overflow: visible !important;
    opacity: 1 !important;
    visibility: visible !important;
    pointer-events: none !important;
    z-index: auto !important;
    background: #ffffff !important;
    transform: none !important;
    zoom: 1 !important;
    scale: none !important;
  }
  #${FORM3_PRINT_PORTAL_ID},
  #${FORM3_PRINT_PORTAL_ID} * {
    visibility: visible !important;
    transform: none !important;
    zoom: 1 !important;
    scale: none !important;
  }
  #${FORM3_PRINT_PORTAL_ID} .no-print {
    display: none !important;
  }
  #${FORM3_PRINT_PORTAL_ID} .form3-preview,
  #${FORM3_PRINT_PORTAL_ID} .form3-print-root,
  #${FORM3_PRINT_PORTAL_ID} .form3-pages {
    display: block !important;
    position: static !important;
    left: auto !important;
    top: auto !important;
    width: 210mm !important;
    min-width: 210mm !important;
    max-width: 210mm !important;
    height: auto !important;
    min-height: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    transform: none !important;
    zoom: 1 !important;
    scale: none !important;
    overflow: visible !important;
  }
  #${FORM3_PRINT_PORTAL_ID} .form3-sheet {
    display: flex !important;
    position: relative !important;
    width: 210mm !important;
    min-width: 210mm !important;
    max-width: 210mm !important;
    min-height: 297mm !important;
    height: 297mm !important;
    max-height: 297mm !important;
    margin: 0 !important;
    box-shadow: none !important;
    overflow: hidden !important;
    box-sizing: border-box !important;
    transform: none !important;
    zoom: 1 !important;
    scale: none !important;
  }
  #${FORM3_PRINT_PORTAL_ID} .form3-page {
    margin: 0 !important;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  #${FORM3_PRINT_PORTAL_ID} .form3-page + .form3-page {
    break-before: page;
    page-break-before: always;
  }
  #${FORM3_PRINT_PORTAL_ID} .form3-sheet,
  #${FORM3_PRINT_PORTAL_ID} .form3-sheet * {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  #${FORM3_PRINT_PORTAL_ID} .form3-pattern-heading__text {
    writing-mode: vertical-lr !important;
    text-orientation: upright !important;
    -webkit-text-orientation: upright !important;
    white-space: nowrap !important;
  }
  #${FORM3_PRINT_PORTAL_ID} .form3-vtext {
    writing-mode: vertical-rl !important;
    text-orientation: mixed !important;
    -webkit-text-orientation: mixed !important;
  }
}
`;

export type Form3PrintPortalProps = {
  data: Form3DataV2;
  meta?: Form3PrintMeta;
};

/** iPad 印刷診断用 */
export function measureForm3PrintPortal(): Record<string, unknown> | null {
  if (typeof document === "undefined") return null;
  const root = document.getElementById(FORM3_PRINT_PORTAL_ID);
  if (!root) return { error: "print portal missing" };
  const cs = window.getComputedStyle(root);
  const page = root.querySelector(".form3-sheet, .form3-page");
  const pageCs = page ? window.getComputedStyle(page) : null;
  const printRoot = root.querySelector(".form3-print-root, .form3-pages");
  const printRootCs = printRoot ? window.getComputedStyle(printRoot) : null;
  const text = root.textContent ?? "";
  const zoomOf = (s: CSSStyleDeclaration) =>
    (s as CSSStyleDeclaration & { zoom?: string }).zoom ?? null;
  return {
    portal: {
      id: root.id,
      width: cs.width,
      height: cs.height,
      transform: cs.transform,
      zoom: zoomOf(cs),
      opacity: cs.opacity,
      visibility: cs.visibility,
      display: cs.display,
      position: cs.position,
      fontSize: cs.fontSize,
    },
    printRoot: printRootCs
      ? {
          width: printRootCs.width,
          height: printRootCs.height,
          transform: printRootCs.transform,
          zoom: zoomOf(printRootCs),
        }
      : null,
    page: pageCs
      ? {
          width: pageCs.width,
          height: pageCs.height,
          transform: pageCs.transform,
          zoom: zoomOf(pageCs),
          fontSize: pageCs.fontSize,
        }
      : null,
    textLength: text.length,
    patternHeadingText:
      root.querySelector(".form3-pattern-heading__text")?.textContent ?? null,
    sheetCount: root.querySelectorAll(".form3-sheet").length,
  };
}

export default function Form3PrintPortal({
  data,
  meta,
}: Form3PrintPortalProps) {
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const [layoutTick, setLayoutTick] = useState(0);

  useEffect(() => {
    const id = window.setTimeout(() => setLayoutTick((n) => n + 1), 50);
    return () => window.clearTimeout(id);
  }, [data]);

  const layout = useMemo(() => {
    void layoutTick;
    return (
      buildForm3PrintLayout(data) ?? buildForm3PrintLayoutFallback(data)
    );
  }, [data, layoutTick]);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <>
      <style data-form3-print-portal-css="">{PRINT_PORTAL_CSS}</style>
      <div
        id={FORM3_PRINT_PORTAL_ID}
        data-form3-print-portal=""
        data-form3-print-mode="print"
        aria-hidden
      >
        {/* forPrint: 画面 scale / fit / zoom を一切適用しない印刷専用 DOM */}
        <Form3SheetView layout={layout} meta={meta} forPrint />
      </div>
    </>,
    document.body,
  );
}
