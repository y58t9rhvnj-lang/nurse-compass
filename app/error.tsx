"use client";

import Link from "next/link";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#EDEDF0] px-6 text-center text-[#1D1D1F]">
      <h1 className="text-[18px] font-bold">問題が発生しました</h1>
      <p className="max-w-sm text-[13px] leading-relaxed text-[#6E6E73]">
        画面の読み込み中に予期しないエラーが発生しました。再読み込みをお試しください。
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-[44px] items-center rounded-xl bg-[#0A84FF] px-5 text-[13px] font-semibold text-white transition hover:bg-[#0870DB]"
        >
          再読み込み
        </button>
        <Link
          href="/"
          className="inline-flex min-h-[44px] items-center rounded-xl border border-[#D1D1D6] bg-white px-5 text-[13px] font-semibold text-[#1D1D1F] transition hover:bg-[#F2F2F5]"
        >
          トップへ戻る
        </Link>
      </div>
    </div>
  );
}
