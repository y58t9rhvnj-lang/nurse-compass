"use client";

/**
 * ResizableTwoPane — FormWorkspaceShell 用の左右分割。
 * 比率を localStorage に保存。左右を remount しない（style のみ更新）。
 * 初回案内は form-workspace-resize-hint-seen（Form2/Form3/患者理解で共通）。
 */

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";

export const FORM_WORKSPACE_PANE_RATIO_KEY = "form-workspace-pane-ratio";
export const FORM_WORKSPACE_DEFAULT_RATIO = 0.38;
export const FORM_WORKSPACE_RESIZE_HINT_KEY = "form-workspace-resize-hint-seen";

const MIN_LEFT_PX = 320;
const MIN_RIGHT_PX = 520;
const KEYBOARD_STEP = 0.02;
const KEYBOARD_STEP_LARGE = 0.08;
const HINT_AUTO_DISMISS_MS = 7000;
const HINT_WIDTH_PX = 260;

function clampRatio(ratio: number, containerWidth: number): number {
  if (!Number.isFinite(ratio) || containerWidth <= 0) {
    return FORM_WORKSPACE_DEFAULT_RATIO;
  }
  const minR = MIN_LEFT_PX / containerWidth;
  const maxR = 1 - MIN_RIGHT_PX / containerWidth;
  if (minR >= maxR) {
    return Math.min(Math.max(ratio, 0.2), 0.5);
  }
  return Math.min(Math.max(ratio, minR), maxR);
}

function readStoredRatio(): number | null {
  try {
    const raw = localStorage.getItem(FORM_WORKSPACE_PANE_RATIO_KEY);
    if (raw == null) return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0 || n >= 1) return null;
    return n;
  } catch {
    return null;
  }
}

function writeStoredRatio(ratio: number) {
  try {
    localStorage.setItem(FORM_WORKSPACE_PANE_RATIO_KEY, String(ratio));
  } catch {
    // ignore
  }
}

function readHintSeen(): boolean {
  try {
    return localStorage.getItem(FORM_WORKSPACE_RESIZE_HINT_KEY) === "1";
  } catch {
    return true;
  }
}

function writeHintSeen() {
  try {
    localStorage.setItem(FORM_WORKSPACE_RESIZE_HINT_KEY, "1");
  } catch {
    // ignore
  }
}

export type ResizableTwoPaneProps = {
  left: ReactNode;
  right: ReactNode;
  leftLabel?: string;
  rightLabel?: string;
  className?: string;
};

export default function ResizableTwoPane({
  left,
  right,
  leftLabel = "患者参照",
  rightLabel = "様式作業",
  className = "",
}: ResizableTwoPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const separatorRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const ratioRef = useRef(FORM_WORKSPACE_DEFAULT_RATIO);
  const [ratio, setRatio] = useState(FORM_WORKSPACE_DEFAULT_RATIO);
  const [containerWidth, setContainerWidth] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [hintOpen, setHintOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return !readHintSeen();
  });
  /** 吹き出しをグリップの右(true) / 左(false) に出す */
  const [hintOnRight, setHintOnRight] = useState(true);
  const separatorId = useId();
  const hintId = useId();
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyRatio = useCallback((next: number, persist: boolean) => {
    const width = containerRef.current?.clientWidth ?? 0;
    const clamped = clampRatio(next, width);
    ratioRef.current = clamped;
    setRatio(clamped);
    if (persist) writeStoredRatio(clamped);
  }, []);

  const dismissHint = useCallback(() => {
    setHintOpen(false);
    writeHintSeen();
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const sync = () => {
      const w = el.clientWidth;
      setContainerWidth(w);
      const stored = readStoredRatio();
      applyRatio(stored ?? ratioRef.current, false);
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [applyRatio]);

  useLayoutEffect(() => {
    if (!hintOpen || !separatorRef.current) return;
    const rect = separatorRef.current.getBoundingClientRect();
    const spaceRight = window.innerWidth - rect.right;
    const spaceLeft = rect.left;
    // 右に足りなければ左へ
    setHintOnRight(spaceRight >= HINT_WIDTH_PX + 16 || spaceRight >= spaceLeft);
  }, [hintOpen, ratio, containerWidth]);

  useEffect(() => {
    if (!hintOpen) return;
    hintTimerRef.current = setTimeout(() => dismissHint(), HINT_AUTO_DISMISS_MS);
    return () => {
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    };
  }, [hintOpen, dismissHint]);

  useEffect(() => {
    if (!hintOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        dismissHint();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hintOpen, dismissHint]);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    dismissHint();
    draggingRef.current = true;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const next = (e.clientX - rect.left) / rect.width;
    applyRatio(next, false);
  };

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
    writeStoredRatio(ratioRef.current);
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? KEYBOARD_STEP_LARGE : KEYBOARD_STEP;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      applyRatio(ratioRef.current - step, true);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      applyRatio(ratioRef.current + step, true);
    } else if (e.key === "Home") {
      e.preventDefault();
      applyRatio(0, true);
    } else if (e.key === "End") {
      e.preventDefault();
      applyRatio(1, true);
    }
  };

  const leftPct = `${(ratio * 100).toFixed(3)}%`;
  const valueNow = Math.round(ratio * 100);
  const valueMin = containerWidth
    ? Math.round(clampRatio(0, containerWidth) * 100)
    : 0;
  const valueMax = containerWidth
    ? Math.round(clampRatio(1, containerWidth) * 100)
    : 100;

  return (
    <div
      ref={containerRef}
      className={`flex min-h-0 min-w-0 flex-1 overflow-hidden ${className}`.trim()}
      data-resizable-two-pane=""
    >
      <aside
        aria-label={leftLabel}
        className="flex h-full min-h-0 min-w-0 shrink-0 flex-col overflow-hidden"
        style={{ width: leftPct, maxWidth: "100%" }}
        data-form-workspace-pane="patient-reference"
      >
        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {left}
        </div>
      </aside>

      <div
        ref={separatorRef}
        id={separatorId}
        role="separator"
        aria-orientation="vertical"
        aria-valuemin={valueMin}
        aria-valuemax={valueMax}
        aria-valuenow={valueNow}
        aria-label="左右の表示幅を調整"
        aria-describedby={hintOpen ? hintId : undefined}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        className={[
          "group relative z-10 flex w-11 shrink-0 cursor-col-resize touch-none items-center justify-center",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#667085]",
        ].join(" ")}
        style={{ touchAction: "none" }}
      >
        {/* 境界線はグリップ上下のみ（内部を通さない → 十字/+ に見えない） */}
        <span
          aria-hidden
          className={[
            "pointer-events-none absolute left-1/2 top-0 w-px -translate-x-1/2 transition-colors duration-150 motion-reduce:transition-none",
            "bottom-[calc(50%+20px)]",
            dragging ? "bg-[#667085]/55" : "bg-[#C7C7CC]",
          ].join(" ")}
        />
        <span
          aria-hidden
          className={[
            "pointer-events-none absolute left-1/2 bottom-0 w-px -translate-x-1/2 transition-colors duration-150 motion-reduce:transition-none",
            "top-[calc(50%+20px)]",
            dragging ? "bg-[#667085]/55" : "bg-[#C7C7CC]",
          ].join(" ")}
        />

        {/* 視覚 ~11×36 / hit ≥44。半透明カプセル + 1列ドット */}
        <span
          aria-hidden
          className={[
            "relative z-[1] flex h-9 w-[11px] flex-col items-center justify-center gap-[5px] rounded-[6px] border transition-[background-color,border-color] duration-150 motion-reduce:transition-none",
            "bg-white/70 backdrop-blur-[12px] supports-[backdrop-filter]:bg-white/55",
            dragging
              ? "border-[#667085]/50"
              : "border-black/10 group-hover:border-black/18 group-hover:bg-white/85 group-focus-visible:border-black/18 group-focus-visible:bg-white/85",
          ].join(" ")}
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <span
              key={i}
              className={[
                "h-[2.5px] w-[2.5px] rounded-full transition-colors duration-150 motion-reduce:transition-none",
                dragging ? "bg-[#344054]" : "bg-[#8E8E93]",
              ].join(" ")}
            />
          ))}
        </span>

        {dragging ? (
          <span className="pointer-events-none absolute top-3 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-md bg-[#344054] px-2 py-1 text-[11px] text-white">
            左 {valueNow}% / 右 {100 - valueNow}%
          </span>
        ) : null}

        {hintOpen ? (
          <div
            id={hintId}
            role="status"
            aria-live="polite"
            onPointerDown={(e) => e.stopPropagation()}
            className={[
              "absolute top-1/2 z-30 w-[min(260px,calc(100vw-2rem))] -translate-y-1/2 rounded-xl border border-[#D1D1D6] bg-white px-3 py-2.5 text-left shadow-sm",
              hintOnRight
                ? "left-[calc(100%+10px)]"
                : "right-[calc(100%+10px)]",
            ].join(" ")}
          >
            <span
              aria-hidden
              className={[
                "absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rotate-45 border border-[#D1D1D6] bg-white",
                hintOnRight
                  ? "left-[-6px] border-r-0 border-t-0"
                  : "right-[-6px] border-b-0 border-l-0",
              ].join(" ")}
            />
            <p className="text-[12.5px] leading-snug text-[#1D1D1F]">
              中央の点があるつまみを左右に動かすと、左右の表示幅を調整できます
            </p>
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  dismissHint();
                }}
                className="min-h-[44px] rounded-xl bg-[#F4F6F8] px-3 text-[13px] font-semibold text-[#344054]"
              >
                わかりました
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <section
        aria-label={rightLabel}
        className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
        data-form-workspace-pane="workspace"
      >
        {right}
      </section>
    </div>
  );
}

export function resetFormWorkspacePaneRatio() {
  writeStoredRatio(FORM_WORKSPACE_DEFAULT_RATIO);
}
