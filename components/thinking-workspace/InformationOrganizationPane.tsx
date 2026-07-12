import { LayoutGrid } from "lucide-react";

// 右ペイン「患者理解のための情報整理」。
// 本 Sprint では空の骨格のみ。テーマ作成・データ追加・S/O分類は次 Sprint で実装する。
export default function InformationOrganizationPane() {
  return (
    <section className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 px-5 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <LayoutGrid className="h-4 w-4 text-[#0A84FF]" strokeWidth={1.75} />
          <h2 className="text-[14px] font-bold text-[#1D1D1F]">
            患者理解のための情報整理
          </h2>
        </div>
        <p className="mt-1 text-[12px] leading-relaxed text-[#8E8E93]">
          収集したデータをテーマごとに整理する場所です。
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
        <div className="flex h-full min-h-[160px] items-center justify-center rounded-2xl border border-dashed border-[#E0E0E5] bg-[#FAFAFC] p-6">
          <p className="text-center text-[12px] text-[#8E8E93]">
            まだテーマはありません。
          </p>
        </div>
      </div>
    </section>
  );
}
