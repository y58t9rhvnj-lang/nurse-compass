"use client";

/**
 * Form workspace 幅ブレークポイント（R1 / C2 と共通）。
 * Shell と Resizable から共有するため分離。
 */

import { useSyncExternalStore } from "react";

/** Tailwind `lg`（1024px）。幅ベースで 2ペイン / Sheet を切替。 */
export const FORM_WORKSPACE_WIDE_MQ = "(min-width: 1024px)";

export type FormWorkspaceKind = "form2" | "form3";

function subscribeWide(onChange: () => void) {
  const mq = window.matchMedia(FORM_WORKSPACE_WIDE_MQ);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getWideSnapshot() {
  return window.matchMedia(FORM_WORKSPACE_WIDE_MQ).matches;
}

function getWideServerSnapshot() {
  return true;
}

export function useFormWorkspaceWideLayout(): boolean {
  return useSyncExternalStore(
    subscribeWide,
    getWideSnapshot,
    getWideServerSnapshot,
  );
}
