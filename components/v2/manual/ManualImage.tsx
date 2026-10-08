"use client";

import { useEffect, useState } from "react";
import type { ManualShot } from "@/lib/v2/manual/types";

function MarkerLayer({
  markers,
  size,
}: {
  markers?: ManualShot["markers"];
  size: "inline" | "zoom";
}) {
  const box =
    size === "zoom"
      ? "h-10 w-10 text-[17px]"
      : "h-8 w-8 text-[15px]";
  const dot = size === "zoom" ? "h-3 w-3" : "h-2.5 w-2.5";
  return (
    <>
      {markers?.map((marker) => {
        const hasPointer =
          marker.tx != null &&
          marker.ty != null &&
          (marker.tx !== marker.x || marker.ty !== marker.y);
        return (
          <span key={marker.n} className="pointer-events-none absolute inset-0">
            {hasPointer ? (
              <>
                <svg
                  className="absolute inset-0 h-full w-full"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  aria-hidden
                >
                  <line
                    x1={marker.x}
                    y1={marker.y}
                    x2={marker.tx}
                    y2={marker.ty}
                    stroke="#0A84FF"
                    strokeWidth={size === "zoom" ? 0.35 : 0.45}
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
                <span
                  className={`absolute ${dot} -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0A84FF] ring-2 ring-white`}
                  style={{ left: `${marker.tx}%`, top: `${marker.ty}%` }}
                />
              </>
            ) : null}
            <span
              aria-hidden
              className={`absolute flex ${box} -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#0A84FF] font-bold text-white shadow`}
              style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
            >
              {marker.n}
            </span>
          </span>
        );
      })}
    </>
  );
}

export default function ManualImage({ image }: { image: ManualShot }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <figure className="mt-3" style={{ touchAction: "pan-y" }}>
      <div
        data-manual-shot-frame="1"
        className="relative overflow-hidden rounded-2xl border border-[#E5E5EA] bg-white"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.src}
          alt={image.alt}
          className="pointer-events-none mx-auto h-auto w-full"
          draggable={false}
        />
        <MarkerLayer markers={image.markers} size="inline" />
      </div>
      <figcaption className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[14px] leading-relaxed text-[#6E6E73]">
        <span>{image.caption}</span>
        <button
          type="button"
          data-manual-image-zoom="1"
          onClick={() => setOpen(true)}
          className="inline-flex min-h-[44px] items-center rounded-full border border-[#E5E5EA] bg-white px-4 text-[15px] font-medium text-[#0A6CD6]"
        >
          拡大する
        </button>
      </figcaption>

      {open ? (
        <div
          data-manual-image-lightbox="1"
          className="fixed inset-0 z-[80] overflow-auto bg-black/80 p-4"
          style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={image.alt}
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mb-3 inline-flex min-h-[44px] items-center rounded-full bg-white px-4 text-[15px] font-medium text-[#1D1D1F]"
          >
            閉じる
          </button>
          <div
            className="relative mx-auto w-[min(1600px,220vw)]"
            onClick={(event) => event.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.src}
              alt={image.alt}
              className="pointer-events-none block h-auto w-full"
              draggable={false}
            />
            <MarkerLayer markers={image.markers} size="zoom" />
          </div>
        </div>
      ) : null}
    </figure>
  );
}
