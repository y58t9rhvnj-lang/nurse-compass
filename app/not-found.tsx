import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#EDEDF0] px-6 text-center text-[#1D1D1F]">
      <p className="text-[13px] font-semibold text-[#8E8E93]">404</p>
      <h1 className="text-[18px] font-bold">ページが見つかりません</h1>
      <p className="max-w-sm text-[13px] leading-relaxed text-[#6E6E73]">
        お探しのページは存在しないか、移動した可能性があります。
      </p>
      <Link
        href="/"
        className="inline-flex min-h-[44px] items-center rounded-xl bg-[#0A84FF] px-5 text-[13px] font-semibold text-white transition hover:bg-[#0870DB]"
      >
        トップへ戻る
      </Link>
    </div>
  );
}
