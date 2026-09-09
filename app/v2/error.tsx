"use client";

/**
 * Version 2 (/v2) error boundary.
 * Keeps failures inside V2 — never links to Version 1 `/`.
 */

import { useEffect } from "react";
import Link from "next/link";

export default function V2Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isDev = process.env.NODE_ENV === "development";

  useEffect(() => {
    // Safe diagnostics only (no snapshot / PII payloads).
    console.error("[v2-error-boundary]", {
      digest: error.digest ?? null,
      name: error.name,
      message: isDev ? error.message : undefined,
    });
  }, [error, isDev]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#EDEDF0] px-6 text-center text-[#1D1D1F]">
      <p className="text-[13px] font-semibold text-[#8E8E93]">Version 2</p>
      <h1 className="text-[18px] font-bold">問題が発生しました</h1>
      <p className="max-w-sm text-[13px] leading-relaxed text-[#6E6E73]">
        Version 2
        の画面読み込み中に予期しないエラーが発生しました。再試行するか、Version 2
        のホームへ戻ってください。
      </p>
      {error.digest ? (
        <p className="max-w-md break-all rounded-lg border border-[#D1D1D6] bg-white px-3 py-2 font-mono text-[12px] text-[#6E6E73]">
          digest: {error.digest}
        </p>
      ) : null}
      {isDev && error.message ? (
        <p className="max-w-md break-words rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-left text-[12px] text-amber-950">
          {error.message}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-[44px] items-center rounded-xl bg-[#0A84FF] px-5 text-[13px] font-semibold text-white transition hover:bg-[#0870DB]"
        >
          再試行
        </button>
        <Link
          href="/v2"
          className="inline-flex min-h-[44px] items-center rounded-xl border border-[#D1D1D6] bg-white px-5 text-[13px] font-semibold text-[#1D1D1F] transition hover:bg-[#F2F2F5]"
        >
          Version 2 ホームへ
        </Link>
        <Link
          href="/v2/teacher"
          className="inline-flex min-h-[44px] items-center rounded-xl border border-[#D1D1D6] bg-white px-5 text-[13px] font-semibold text-[#1D1D1F] transition hover:bg-[#F2F2F5]"
        >
          教員ホームへ
        </Link>
      </div>
    </div>
  );
}
