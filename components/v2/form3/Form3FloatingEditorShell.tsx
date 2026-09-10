"use client";

/**
 * Form3 情報/アセスメント用フローティング作業ウィンドウ。
 * 全面 backdrop なし（背景カルテ操作・コピー可）。
 * 小/中は drag handle で移動。全画面は visualViewport + safe-area いっぱいに固定。
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

export type Form3FloatSize = "S" | "M" | "L";

const SIZE_PRESETS: Record<
  Form3FloatSize,
  { width: number; height: number; label: string }
> = {
  S: { width: 320, height: 420, label: "小" },
  M: { width: 420, height: 560, label: "中" },
  L: { width: 0, height: 0, label: "全画面" },
};

type Pos = { x: number; y: number };

type ViewportBox = {
  top: number;
  left: number;
  width: number;
  height: number;
};

function readViewportBox(): ViewportBox {
  if (typeof window === "undefined") {
    return { top: 0, left: 0, width: 800, height: 600 };
  }
  const vv = window.visualViewport;
  if (vv) {
    return {
      top: vv.offsetTop,
      left: vv.offsetLeft,
      width: vv.width,
      height: vv.height,
    };
  }
  return {
    top: 0,
    left: 0,
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

function clampPos(pos: Pos, _size: { width: number; height: number }): Pos {
  const box = readViewportBox();
  const headerH = 52;
  const minVisibleX = 48;
  const maxX = Math.max(0, box.width - minVisibleX);
  const maxY = Math.max(0, box.height - headerH);
  return {
    x: Math.min(Math.max(0, pos.x), maxX),
    y: Math.min(Math.max(0, pos.y), maxY),
  };
}

function defaultPos(size: Form3FloatSize): Pos {
  const preset = SIZE_PRESETS[size];
  const box = readViewportBox();
  const portrait = box.height > box.width;
  const width = size === "L" ? box.width : preset.width;
  const height = size === "L" ? box.height : preset.height;
  if (portrait) {
    return clampPos(
      {
        x: Math.max(8, (box.width - Math.min(width, box.width - 16)) / 2),
        y: Math.max(8, box.height * 0.12),
      },
      { width, height },
    );
  }
  return clampPos(
    {
      x: Math.max(8, box.width - Math.min(width, box.width * 0.92) - 16),
      y: Math.max(8, 72),
    },
    { width, height },
  );
}

function parseStoredSize(raw: string | null): Form3FloatSize | null {
  if (raw === "S" || raw === "M" || raw === "L") return raw;
  return null;
}

type Props = {
  title: string;
  titleId: string;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
  storageKey: string;
};

export default function Form3FloatingEditorShell({
  title,
  titleId,
  onClose,
  children,
  footer,
  storageKey,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const lastFloatingPosRef = useRef<Pos | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const [viewport, setViewport] = useState<ViewportBox>(readViewportBox);
  const [size, setSize] = useState<Form3FloatSize>(() => {
    if (typeof window === "undefined") return "M";
    try {
      return parseStoredSize(sessionStorage.getItem(`${storageKey}:size`)) ?? "M";
    } catch {
      return "M";
    }
  });
  const [pos, setPos] = useState<Pos>(() => {
    let initialSize: Form3FloatSize = "M";
    if (typeof window !== "undefined") {
      try {
        initialSize =
          parseStoredSize(sessionStorage.getItem(`${storageKey}:size`)) ?? "M";
      } catch {
        /* ignore */
      }
    }
    return defaultPos(initialSize === "L" ? "M" : initialSize);
  });

  const isFullscreen = size === "L";

  useEffect(() => {
    try {
      sessionStorage.setItem(`${storageKey}:size`, size);
    } catch {
      /* ignore */
    }
  }, [size, storageKey]);

  const syncViewport = useCallback(() => {
    setViewport(readViewportBox());
    if (size !== "L") {
      setPos((p) => clampPos(p, SIZE_PRESETS[size]));
    }
  }, [size]);

  useEffect(() => {
    syncViewport();
    const onResize = () => syncViewport();
    window.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("scroll", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("scroll", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [syncViewport]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const onHandlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (isFullscreen) return;
    if (e.button !== 0) return;
    const t = e.target as HTMLElement | null;
    if (t?.closest("button, input, textarea, select, a, label")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y,
    };
  };

  const onHandlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (isFullscreen) return;
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    setPos(
      clampPos(
        {
          x: d.origX + (e.clientX - d.startX),
          y: d.origY + (e.clientY - d.startY),
        },
        SIZE_PRESETS[size],
      ),
    );
  };

  const onHandlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const applySize = (next: Form3FloatSize) => {
    if (next === size) return;
    if (next === "L") {
      lastFloatingPosRef.current = pos;
      dragRef.current = null;
      setSize(next);
      return;
    }
    const restored = lastFloatingPosRef.current ?? defaultPos(next);
    setSize(next);
    setPos(clampPos(restored, SIZE_PRESETS[next]));
  };

  const resetLayout = () => {
    lastFloatingPosRef.current = null;
    dragRef.current = null;
    const next: Form3FloatSize = "M";
    setSize(next);
    setPos(defaultPos(next));
  };

  const preset = SIZE_PRESETS[size];
  const width = Math.min(preset.width, Math.max(280, viewport.width - 16));
  const height = Math.min(preset.height, Math.max(280, viewport.height - 24));

  return (
    <div
      className="pointer-events-none fixed z-50"
      aria-hidden={false}
      style={{
        top: viewport.top,
        left: viewport.left,
        width: viewport.width,
        height: viewport.height,
        padding: isFullscreen
          ? "max(8px, env(safe-area-inset-top, 0px)) max(8px, env(safe-area-inset-right, 0px)) max(8px, env(safe-area-inset-bottom, 0px)) max(8px, env(safe-area-inset-left, 0px))"
          : undefined,
        boxSizing: "border-box",
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        className={`pointer-events-auto absolute flex flex-col overflow-hidden border border-[#E5E5EA] bg-white shadow-[0_12px_40px_rgba(0,0,0,0.18)] ${
          isFullscreen ? "rounded-xl" : "rounded-2xl"
        }`}
        style={
          isFullscreen
            ? {
                left: 0,
                top: 0,
                width: "100%",
                height: "100%",
                maxWidth: "none",
                maxHeight: "none",
              }
            : {
                left: pos.x,
                top: pos.y,
                width,
                height,
                maxWidth: "calc(100% - 8px)",
                maxHeight: "calc(100% - 8px)",
              }
        }
      >
        <div
          className={`flex shrink-0 flex-wrap items-center gap-2 border-b border-[#E5E5EA] bg-[#F9F9FB] px-2 py-1.5 ${
            isFullscreen ? "cursor-default" : "cursor-grab touch-none active:cursor-grabbing"
          }`}
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
          onPointerCancel={onHandlePointerUp}
        >
          {!isFullscreen ? (
            <span className="select-none px-1 text-[11px] text-[#8E8E93]" aria-hidden>
              ⋮⋮
            </span>
          ) : null}
          <h2
            id={titleId}
            className="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-tight text-[#1D1D1F]"
          >
            {title}
          </h2>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
            {(["S", "M", "L"] as const).map((key) => (
              <button
                key={key}
                type="button"
                className={`inline-flex min-h-11 items-center justify-center rounded-lg px-2 text-xs font-semibold ${
                  key === "L" ? "min-w-[3.25rem]" : "min-w-11"
                } ${
                  size === key
                    ? "bg-[#1D1D1F] text-white"
                    : "border border-[#E5E5EA] bg-white text-[#1D1D1F]"
                }`}
                aria-pressed={size === key}
                onClick={() => applySize(key)}
              >
                {SIZE_PRESETS[key].label}
              </button>
            ))}
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#E5E5EA] bg-white px-2 text-[11px] font-medium text-[#1D1D1F]"
              onClick={resetLayout}
            >
              位置リセット
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-[22px] leading-none text-[#8E8E93]"
              aria-label="閉じる"
            >
              ×
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch] px-4 py-3">
          {children}
        </div>

        <div className="shrink-0 border-t border-[#E5E5EA] bg-white px-4 py-3">
          {footer}
        </div>
      </div>
    </div>
  );
}
