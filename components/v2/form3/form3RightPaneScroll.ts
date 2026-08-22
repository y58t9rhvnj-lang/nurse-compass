/**
 * Form3 右ペイン縦スクロールのロック／復元。
 * Dialog 表示中に背景ペインが一緒に動かないようにする（iPad Safari 対策）。
 */

const ATTR = "data-form3-right-scroll";

export function getForm3RightScrollEl(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return document.querySelector(`[${ATTR}]`);
}

export function lockForm3RightPaneScroll(): void {
  const el = getForm3RightScrollEl();
  if (!el) return;
  if (el.dataset.form3ScrollLocked === "1") return;
  el.dataset.form3ScrollTop = String(el.scrollTop);
  el.dataset.form3ScrollLocked = "1";
  el.style.overflow = "hidden";
  el.style.touchAction = "none";
}

export function unlockForm3RightPaneScroll(): void {
  const el = getForm3RightScrollEl();
  if (!el) return;
  if (el.dataset.form3ScrollLocked !== "1") return;
  const top = Number(el.dataset.form3ScrollTop ?? "0");
  el.style.overflow = "";
  el.style.touchAction = "";
  delete el.dataset.form3ScrollLocked;
  delete el.dataset.form3ScrollTop;
  // Restore after style clear so layout re-enables scrolling at same offset.
  requestAnimationFrame(() => {
    el.scrollTop = top;
  });
}

export const FORM3_RIGHT_SCROLL_ATTR = ATTR;
