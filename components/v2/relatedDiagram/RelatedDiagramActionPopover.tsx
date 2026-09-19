"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  classifyActionPopoverPointer,
  isActionPopoverSurface,
  isAddCardControl,
  trackPointerDown,
  trackPointerUp,
} from "@/lib/v2/relatedDiagram/actionPopoverGesture";
import {
  placeActionPopover,
  type ScreenRect,
  type ScreenSize,
} from "@/lib/v2/relatedDiagram/actionPopoverPlacement";

function isolateSinglePointer(event: ReactPointerEvent) {
  if (event.pointerType === "touch" && !event.isPrimary) return;
  event.stopPropagation();
}

export default function RelatedDiagramActionPopover({
  kind,
  anchor,
  viewport,
  estimatedSize,
  onDismiss,
  children,
}: {
  kind: "card" | "relation" | "card_type" | "connection";
  anchor: ScreenRect;
  viewport: ScreenRect;
  estimatedSize: ScreenSize;
  onDismiss: () => void;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const [size, setSize] = useState(estimatedSize);
  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    if (
      Math.abs(box.width - size.width) > 1 ||
      Math.abs(box.height - size.height) > 1
    ) {
      setSize({ width: box.width, height: box.height });
    }
  }, [children, size.height, size.width]);

  useEffect(() => {
    const pointers = new Set<number>();
    const onDown = (event: PointerEvent) => {
      const count = trackPointerDown(pointers, event.pointerId);
      if (kind === "card_type" && isAddCardControl(event.target)) return;
      const decision = classifyActionPopoverPointer({
        kind,
        pointerCount: count,
        targetIsPopover: isActionPopoverSurface(event.target),
      });
      if (decision === "ignore") return;
      onDismissRef.current();
    };
    const onUp = (event: PointerEvent) => {
      trackPointerUp(pointers, event.pointerId);
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("pointerup", onUp, true);
    document.addEventListener("pointercancel", onUp, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("pointerup", onUp, true);
      document.removeEventListener("pointercancel", onUp, true);
      pointers.clear();
    };
  }, [kind]);

  const placed = placeActionPopover({
    anchor,
    popover: size,
    viewport,
  });

  return (
    <div
      ref={panelRef}
      data-rd-action-popover
      data-rd-action-popover-kind={kind}
      data-rd-action-popover-side={placed.side}
      className="fixed z-50 max-w-[min(360px,calc(100vw-16px))] rounded-[18px] border border-black/[0.06] bg-white/80 p-2 shadow-[0_8px_28px_rgba(0,0,0,0.14)] backdrop-blur-xl"
      style={{ left: placed.x, top: placed.y }}
      onPointerDown={isolateSinglePointer}
      onPointerMove={isolateSinglePointer}
      onPointerUp={isolateSinglePointer}
    >
      {children}
    </div>
  );
}
