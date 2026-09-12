"use client";

/**
 * Related Diagram print portal (A3 landscape).
 * Mirrors Form2/Form3 portal pattern so globals.css can hide the app shell.
 */

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const PORTAL_ID = "related-diagram-print-portal";
const PAGE_STYLE_ID = "related-diagram-print-page-style";

export function prepareRelatedDiagramPrint(): void {
  document.documentElement.dataset.rdPrint = "1";
  let style = document.getElementById(PAGE_STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = PAGE_STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = "@page { size: A3 landscape; margin: 0; }";
}

export function cleanupRelatedDiagramPrint(): void {
  delete document.documentElement.dataset.rdPrint;
  document.getElementById(PAGE_STYLE_ID)?.remove();
}

export default function RelatedDiagramPrintPortal({
  children,
}: {
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const onAfter = () => cleanupRelatedDiagramPrint();
    window.addEventListener("afterprint", onAfter);
    return () => {
      window.removeEventListener("afterprint", onAfter);
      cleanupRelatedDiagramPrint();
    };
  }, []);

  if (!mounted || typeof document === "undefined") return null;

  let host = document.getElementById(PORTAL_ID);
  if (!host) {
    host = document.createElement("div");
    host.id = PORTAL_ID;
    document.body.appendChild(host);
  }

  return createPortal(children, host);
}
