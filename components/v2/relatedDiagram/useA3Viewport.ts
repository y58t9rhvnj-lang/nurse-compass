"use client";

/**
 * Viewport transform for A3 canvas (zoom/pan). Not persisted.
 *
 * Touch (iPad):
 * - 1 finger → no canvas pan (reserved for future Card edit)
 * - 2 fingers → Pointer Events distance = pinch, centroid = pan
 *
 * Safari gesture* is cancelled only (never used as scale source).
 *
 * Desktop:
 * - mouse drag → pan
 * - wheel / trackpad → zoom about cursor
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  A3_HEIGHT_PX,
  A3_MAX_SCALE,
  A3_WIDTH_PX,
  computeFitScale,
  computeFitTranslate,
  computeScaleClamp,
  type ScaleClamp,
} from "@/lib/v2/relatedDiagram/a3Canvas";
import {
  applyTwoFingerViewportTransform,
  pointerCentroid,
  pointerDistance,
  scaleAboutPivot,
  type A3ViewportTransform,
  type TwoFingerGestureStart,
  type ViewportPoint,
} from "@/lib/v2/relatedDiagram/a3ViewportGesture";

export type { A3ViewportTransform };

type PointerSample = { id: number; x: number; y: number; type: string };

function isTouchPointer(type: string): boolean {
  return type === "touch";
}

function pickTwoTouchPointers(
  pointers: Map<number, PointerSample>,
): [PointerSample, PointerSample] | null {
  const pts = [...pointers.values()]
    .filter((p) => isTouchPointer(p.type))
    .sort((a, b) => a.id - b.id);
  if (pts.length < 2) return null;
  return [pts[0]!, pts[1]!];
}

export function useA3Viewport() {
  const [viewportEl, setViewportEl] = useState<HTMLElement | null>(null);
  const [transform, setTransform] = useState<A3ViewportTransform>({
    scale: 1,
    x: 0,
    y: 0,
  });
  const [fitScale, setFitScale] = useState(1);
  const transformRef = useRef(transform);
  transformRef.current = transform;

  const pointersRef = useRef<Map<number, PointerSample>>(new Map());
  const twoFingerRef = useRef<TwoFingerGestureStart | null>(null);
  const scaleClampRef = useRef<ScaleClamp>({ min: 0.25, max: A3_MAX_SCALE });
  const fitScaleRef = useRef(1);
  const mousePanRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const readViewportBox = useCallback(() => {
    if (!viewportEl) return null;
    const rect = viewportEl.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
      left: rect.left,
      top: rect.top,
    };
  }, [viewportEl]);

  const refreshScaleLimits = useCallback(() => {
    const box = readViewportBox();
    if (!box) return null;
    const fit = computeFitScale(box.width, box.height);
    fitScaleRef.current = fit;
    setFitScale(fit);
    // 100% must never rewrite this. Limits follow viewport only.
    scaleClampRef.current = computeScaleClamp(box.width, box.height);
    return { box, fit };
  }, [readViewportBox]);

  const fitToView = useCallback(() => {
    const next = refreshScaleLimits();
    if (!next) return;
    const { box, fit } = next;
    const { x, y } = computeFitTranslate(box.width, box.height, fit);
    setTransform({ scale: fit, x, y });
  }, [refreshScaleLimits]);

  const resetTo100 = useCallback(() => {
    if (!viewportEl) return;
    refreshScaleLimits();
    const rect = viewportEl.getBoundingClientRect();
    setTransform({
      scale: 1,
      x: (rect.width - A3_WIDTH_PX * 1) / 2,
      y: (rect.height - A3_HEIGHT_PX * 1) / 2,
    });
  }, [refreshScaleLimits, viewportEl]);

  useEffect(() => {
    const el = viewportEl;
    if (!el) return;

    const beginTwoFinger = (a: ViewportPoint, b: ViewportPoint) => {
      const t = transformRef.current;
      twoFingerRef.current = {
        dist: pointerDistance(a, b),
        scale: t.scale,
        mid: pointerCentroid(a, b),
        tx: t.x,
        ty: t.y,
      };
    };

    const applyTwoFinger = (a: ViewportPoint, b: ViewportPoint) => {
      if (!twoFingerRef.current) beginTwoFinger(a, b);
      const start = twoFingerRef.current;
      if (!start) return;
      const rect = el.getBoundingClientRect();
      setTransform(
        applyTwoFingerViewportTransform({
          start,
          currentA: a,
          currentB: b,
          viewportLeft: rect.left,
          viewportTop: rect.top,
          scaleClamp: scaleClampRef.current,
        }),
      );
    };

    const applyFromPointers = () => {
      const pair = pickTwoTouchPointers(pointersRef.current);
      if (!pair) return false;
      applyTwoFinger(pair[0], pair[1]);
      return true;
    };

    const onPointerDown = (e: PointerEvent) => {
      pointersRef.current.set(e.pointerId, {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        type: e.pointerType,
      });
      if (isTouchPointer(e.pointerType)) {
        el.setPointerCapture?.(e.pointerId);
        mousePanRef.current = null;
        const pair = pickTwoTouchPointers(pointersRef.current);
        if (pair) beginTwoFinger(pair[0], pair[1]);
        else twoFingerRef.current = null;
        return;
      }
      if (pointersRef.current.size === 1) {
        const t = transformRef.current;
        mousePanRef.current = {
          pointerId: e.pointerId,
          startX: e.clientX,
          startY: e.clientY,
          originX: t.x,
          originY: t.y,
        };
        twoFingerRef.current = null;
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!pointersRef.current.has(e.pointerId)) return;
      pointersRef.current.set(e.pointerId, {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        type: e.pointerType,
      });
      if (applyFromPointers()) {
        if (e.cancelable) e.preventDefault();
        return;
      }
      if (isTouchPointer(e.pointerType)) return;
      if (mousePanRef.current?.pointerId === e.pointerId) {
        const pan = mousePanRef.current;
        setTransform((prev) => ({
          ...prev,
          x: pan.originX + (e.clientX - pan.startX),
          y: pan.originY + (e.clientY - pan.startY),
        }));
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      pointersRef.current.delete(e.pointerId);
      if (mousePanRef.current?.pointerId === e.pointerId) {
        mousePanRef.current = null;
      }
      const pair = pickTwoTouchPointers(pointersRef.current);
      if (pair) beginTwoFinger(pair[0], pair[1]);
      else twoFingerRef.current = null;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const t = transformRef.current;
      const rect = el.getBoundingClientRect();
      const delta = e.deltaY > 0 ? 0.92 : 1.08;
      setTransform(
        scaleAboutPivot({
          transform: t,
          nextScale: t.scale * delta,
          pivotClientX: e.clientX,
          pivotClientY: e.clientY,
          viewportLeft: rect.left,
          viewportTop: rect.top,
          scaleClamp: scaleClampRef.current,
        }),
      );
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        if (e.cancelable) e.preventDefault();
        const a = e.touches[0]!;
        const b = e.touches[1]!;
        beginTwoFinger(
          { x: a.clientX, y: a.clientY },
          { x: b.clientX, y: b.clientY },
        );
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length < 2) return;
      if (e.cancelable) e.preventDefault();
      if (applyFromPointers()) return;
      const a = e.touches[0]!;
      const b = e.touches[1]!;
      applyTwoFinger(
        { x: a.clientX, y: a.clientY },
        { x: b.clientX, y: b.clientY },
      );
    };

    const preventNativeZoom = (e: Event) => {
      if (e.cancelable) e.preventDefault();
    };

    refreshScaleLimits();
    const ro = new ResizeObserver(() => {
      const prevFit = fitScaleRef.current;
      const next = refreshScaleLimits();
      if (!next) return;
      if (Math.abs(transformRef.current.scale - prevFit) < 0.025) {
        const { box, fit } = next;
        const { x, y } = computeFitTranslate(box.width, box.height, fit);
        setTransform({ scale: fit, x, y });
      }
    });
    ro.observe(el);

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    // Cancel Safari page zoom only. Do not read e.scale.
    el.addEventListener("gesturestart", preventNativeZoom, { passive: false });
    el.addEventListener("gesturechange", preventNativeZoom, { passive: false });
    el.addEventListener("gestureend", preventNativeZoom, { passive: false });

    return () => {
      ro.disconnect();
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("gesturestart", preventNativeZoom);
      el.removeEventListener("gesturechange", preventNativeZoom);
      el.removeEventListener("gestureend", preventNativeZoom);
    };
  }, [refreshScaleLimits, viewportEl]);

  return {
    viewportRef: setViewportEl,
    transform,
    fitToView,
    resetTo100,
    fitScale,
    minScale: scaleClampRef.current.min,
    percent: Math.round(transform.scale * 100),
  };
}
