"use client";

/**
 * Form2 印刷専用 portal（Round 2 B1 / Round 3 M3 / Round 6 print fix）。
 *
 * 画面プレビュー（Form2ScaledPreview / fit / zoom）とは完全分離。
 * body 直下に A4 等倍 DOM のみを置き、印刷時はそれ以外を非表示にする。
 *
 * 画面非表示は height:0 / left:-9999 を使わず、
 * visibility + 固定配置でレイアウト寸法（210mm）を維持する（iPad Safari 対策）。
 */

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Form2SheetView from "@/components/form2/Form2SheetView";
import type { Form2Data } from "@/lib/form2/form2Types";

export const FORM2_PRINT_PORTAL_ID = "form2-print-portal";

const noopSubscribe = () => () => {};

const PRINT_PORTAL_CSS = `
#${FORM2_PRINT_PORTAL_ID} {
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
  body > *:not(#${FORM2_PRINT_PORTAL_ID}):not(#form3-print-portal) {
    display: none !important;
  }
  #${FORM2_PRINT_PORTAL_ID} {
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
  #${FORM2_PRINT_PORTAL_ID},
  #${FORM2_PRINT_PORTAL_ID} * {
    visibility: visible !important;
    transform: none !important;
    zoom: 1 !important;
    scale: none !important;
  }
  #${FORM2_PRINT_PORTAL_ID} .no-print {
    display: none !important;
  }
  #${FORM2_PRINT_PORTAL_ID} .form2-preview,
  #${FORM2_PRINT_PORTAL_ID} .form2-scale-wrap,
  #${FORM2_PRINT_PORTAL_ID} .form2-print-root,
  #${FORM2_PRINT_PORTAL_ID} .form2-pages {
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
  #${FORM2_PRINT_PORTAL_ID} .form2-sheet {
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
  #${FORM2_PRINT_PORTAL_ID} .form2-page {
    margin: 0 !important;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  #${FORM2_PRINT_PORTAL_ID} .form2-page + .form2-page {
    break-before: page;
    page-break-before: always;
  }
  #${FORM2_PRINT_PORTAL_ID} .form2-sheet,
  #${FORM2_PRINT_PORTAL_ID} .form2-sheet * {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
`;

export default function Form2PrintPortal({ data }: { data: Form2Data }) {
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <>
      <style data-form2-print-portal-css="">{PRINT_PORTAL_CSS}</style>
      <div
        id={FORM2_PRINT_PORTAL_ID}
        data-form2-print-portal=""
        data-form2-print-mode="print"
        aria-hidden
      >
        {/* forPrint: 画面 scale / fit / zoom を一切適用しない印刷専用 DOM */}
        <Form2SheetView data={data} forPrint />
      </div>
    </>,
    document.body,
  );
}
