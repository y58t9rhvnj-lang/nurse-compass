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
 * - mouse drag on blank canvas → pan
 * - mouse drag on a Card → Card interaction (no canvas pan)
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
import { scaleAboutPivot, type A3ViewportTransform } from "@/lib/v2/relatedDiagram/a3ViewportGesture";
import {
  applyViewportOwnedPointerDown,
  applyViewportOwnedPointerMove,
  applyViewportOwnedPointerUp,
  classifyDiagramPointerTarget,
  createIdleViewportOwnership,
  viewportShouldCapturePointer,
} from "@/lib/v2/relatedDiagram/diagramGestureOwnership";
import {
  isRelatedDiagramInteractionTarget,
  shouldBeginViewportMousePan,
} from "@/lib/v2/relatedDiagram/cardInteractionState";

export type { A3ViewportTransform };

function isTouchPointer(type: string): boolean {
  return type === "touch";
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

  const ownershipRef = useRef(createIdleViewportOwnership({ scale: 1, x: 0, y: 0 }));
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

    const onPointerDown = (e: PointerEvent) => {
      ownershipRef.current = {
        ...ownershipRef.current,
        transform: transformRef.current,
      };
      const next = applyViewportOwnedPointerDown(ownershipRef.current, {
        pointerId: e.pointerId,
        clientX: e.clientX,
        clientY: e.clientY,
        pointerType: e.pointerType,
        target: classifyDiagramPointerTarget(e.target),
      });
      ownershipRef.current = next.state;
      if (
        next.capture ||
        viewportShouldCapturePointer({
          pointerType: e.pointerType,
          touchCountAfter: next.state.pointers.filter((p) => p.type === "touch")
            .length,
        })
      ) {
        el.setPointerCapture?.(e.pointerId);
      }
      if (isTouchPointer(e.pointerType)) {
        mousePanRef.current = null;
        return;
      }
      if (
        !shouldBeginViewportMousePan({
          pointerType: e.pointerType,
          targetIsCard: isRelatedDiagramInteractionTarget(e.target),
        })
      ) {
        mousePanRef.current = null;
        return;
      }
      if (next.state.pointers.length === 1) {
        const t = transformRef.current;
        mousePanRef.current = {
          pointerId: e.pointerId,
          startX: e.clientX,
          startY: e.clientY,
          originX: t.x,
          originY: t.y,
        };
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      ownershipRef.current = {
        ...ownershipRef.current,
        transform: transformRef.current,
      };
      const next = applyViewportOwnedPointerMove(ownershipRef.current, {
        pointerId: e.pointerId,
        clientX: e.clientX,
        clientY: e.clientY,
        viewportLeft: el.getBoundingClientRect().left,
        viewportTop: el.getBoundingClientRect().top,
        scaleClamp: scaleClampRef.current,
      });
      ownershipRef.current = next.state;
      if (next.applied) {
        setTransform(next.state.transform);
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
      ownershipRef.current = applyViewportOwnedPointerUp(
        {
          ...ownershipRef.current,
          transform: transformRef.current,
        },
        e.pointerId,
      );
      if (mousePanRef.current?.pointerId === e.pointerId) {
        mousePanRef.current = null;
      }
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
      if (e.touches.length >= 2 && e.cancelable) e.preventDefault();
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length < 2) return;
      if (e.cancelable) e.preventDefault();
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

    el.addEventListener("pointerdown", onPointerDown, true);
    el.addEventListener("pointermove", onPointerMove, true);
    el.addEventListener("pointerup", onPointerUp, true);
    el.addEventListener("pointercancel", onPointerUp, true);
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    // Cancel Safari page zoom only. Do not read e.scale.
    el.addEventListener("gesturestart", preventNativeZoom, { passive: false });
    el.addEventListener("gesturechange", preventNativeZoom, { passive: false });
    el.addEventListener("gestureend", preventNativeZoom, { passive: false });

    return () => {
      ro.disconnect();
      el.removeEventListener("pointerdown", onPointerDown, true);
      el.removeEventListener("pointermove", onPointerMove, true);
      el.removeEventListener("pointerup", onPointerUp, true);
      el.removeEventListener("pointercancel", onPointerUp, true);
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
