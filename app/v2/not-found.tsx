import Link from "next/link";

/**
 * Version 2 segment not-found UI (when notFound() is thrown under /v2).
 * Does not link to Version 1 `/`. Root app/not-found.tsx is unchanged.
 */
export default function V2NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#EDEDF0] px-6 text-center text-[#1D1D1F]">
      <p className="text-[13px] font-semibold text-[#8E8E93]">Version 2 · 404</p>
      <h1 className="text-[18px] font-bold">ページが見つかりません</h1>
      <p className="max-w-sm text-[13px] leading-relaxed text-[#6E6E73]">
        お探しの Version 2
        のページは存在しないか、移動した可能性があります。
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Link
          href="/v2"
          className="inline-flex min-h-[44px] items-center rounded-xl bg-[#0A84FF] px-5 text-[13px] font-semibold text-white transition hover:bg-[#0870DB]"
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
