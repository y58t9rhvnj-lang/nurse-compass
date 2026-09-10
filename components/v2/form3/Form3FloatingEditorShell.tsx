"use client";

/**
 * Form3 情報/アセスメント用フローティング作業ウィンドウ。
 * 全面 backdrop なし（背景カルテ操作・コピー可）。drag handle で移動、S/M/L サイズ。
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
  L: { width: 520, height: 680, label: "大" },
};

type Pos = { x: number; y: number };

function clampPos(
  pos: Pos,
  size: { width: number; height: number },
): Pos {
  const vv = typeof window !== "undefined" ? window.visualViewport : null;
  const vw = vv?.width ?? window.innerWidth;
  const vh = vv?.height ?? window.innerHeight;
  const headerH = 52;
  const minVisibleX = 48;
  const maxX = Math.max(0, vw - minVisibleX);
  const maxY = Math.max(0, vh - headerH);
  return {
    x: Math.min(Math.max(0, pos.x), maxX),
    y: Math.min(Math.max(0, pos.y), maxY),
  };
}

function defaultPos(size: Form3FloatSize): Pos {
  const preset = SIZE_PRESETS[size];
  const vv = typeof window !== "undefined" ? window.visualViewport : null;
  const vw = vv?.width ?? (typeof window !== "undefined" ? window.innerWidth : 800);
  const vh = vv?.height ?? (typeof window !== "undefined" ? window.innerHeight : 600);
  const portrait = vh > vw;
  if (portrait) {
    return clampPos(
      {
        x: Math.max(8, (vw - Math.min(preset.width, vw - 16)) / 2),
        y: Math.max(8, vh * 0.12),
      },
      preset,
    );
  }
  return clampPos(
    {
      x: Math.max(8, vw - Math.min(preset.width, vw * 0.92) - 16),
      y: Math.max(8, 72),
    },
    preset,
  );
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
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const [size, setSize] = useState<Form3FloatSize>(() => {
    if (typeof window === "undefined") return "M";
    try {
      const raw = sessionStorage.getItem(`${storageKey}:size`);
      if (raw === "S" || raw === "M" || raw === "L") return raw;
    } catch {
      /* ignore */
    }
    return "M";
  });
  const [pos, setPos] = useState<Pos>(() => {
    let initialSize: Form3FloatSize = "M";
    if (typeof window !== "undefined") {
      try {
        const raw = sessionStorage.getItem(`${storageKey}:size`);
        if (raw === "S" || raw === "M" || raw === "L") initialSize = raw;
      } catch {
        /* ignore */
      }
    }
    return defaultPos(initialSize);
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(`${storageKey}:size`, size);
    } catch {
      /* ignore */
    }
  }, [size, storageKey]);

  const reclamp = useCallback(() => {
    setPos((p) => clampPos(p, SIZE_PRESETS[size]));
  }, [size]);

  useEffect(() => {
    reclamp();
    const onResize = () => reclamp();
    window.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [reclamp]);

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

  const resetLayout = () => {
    const next: Form3FloatSize = "M";
    setSize(next);
    setPos(defaultPos(next));
  };

  const preset = SIZE_PRESETS[size];
  const vv = typeof window !== "undefined" ? window.visualViewport : null;
  const vw = vv?.width ?? 800;
  const width = Math.min(preset.width, Math.max(280, vw - 16));
  const height = Math.min(
    preset.height,
    Math.max(280, (vv?.height ?? 600) - 24),
  );

  return (
    <div
      className="pointer-events-none fixed inset-0 z-50"
      aria-hidden={false}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        className="pointer-events-auto absolute flex flex-col overflow-hidden rounded-2xl border border-[#E5E5EA] bg-white shadow-[0_12px_40px_rgba(0,0,0,0.18)]"
        style={{
          left: pos.x,
          top: pos.y,
          width,
          height,
          maxWidth: "calc(100vw - 16px)",
          maxHeight: "calc(100dvh - 16px)",
        }}
      >
        <div
          className="flex shrink-0 cursor-grab touch-none items-center gap-2 border-b border-[#E5E5EA] bg-[#F9F9FB] px-2 py-1.5 active:cursor-grabbing"
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
          onPointerCancel={onHandlePointerUp}
        >
          <span className="select-none px-1 text-[11px] text-[#8E8E93]" aria-hidden>
            ⋮⋮
          </span>
          <h2
            id={titleId}
            className="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-tight text-[#1D1D1F]"
          >
            {title}
          </h2>
          <div className="flex shrink-0 items-center gap-1">
            {(["S", "M", "L"] as const).map((key) => (
              <button
                key={key}
                type="button"
                className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-xs font-semibold ${
                  size === key
                    ? "bg-[#1D1D1F] text-white"
                    : "border border-[#E5E5EA] bg-white text-[#1D1D1F]"
                }`}
                aria-pressed={size === key}
                onClick={() => {
                  setSize(key);
                  setPos((p) => clampPos(p, SIZE_PRESETS[key]));
                }}
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

        <div className="shrink-0 border-t border-[#E5E5EA] bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {footer}
        </div>
      </div>
    </div>
  );
}
