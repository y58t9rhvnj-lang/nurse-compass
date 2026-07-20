import NurseCompassLogo from "@/components/v2/brand/NurseCompassLogo";

export default function AppHeader() {
  return (
    <header className="shrink-0 border-b border-[#E5E7EB] bg-white">
      <div className="flex h-[48px] items-center justify-between px-5">
        {/* ブランド（共有ロゴ素材）。狭幅=シンボルのみ / sm 以上=横長ロゴへ縮退。
            ヘッダー高さ(48px)は変えない（size=28 に収める）。 */}
        <div className="flex items-center">
          <NurseCompassLogo
            variant="symbol"
            size={28}
            priority
            className="sm:hidden"
          />
          <NurseCompassLogo
            variant="horizontal"
            size={28}
            priority
            className="hidden sm:block"
          />
        </div>

        <div className="text-center">
          <p className="text-sm font-semibold text-[#0F2742]">
            Aims Medical Center
          </p>
          <p className="text-[10px] text-[#9CA3AF]">精神科 南3病棟</p>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-[#F0F5FF] px-2 py-1 text-[10px] font-medium text-[#2563EB]">
            Sprint 3
          </span>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2563EB] text-xs font-semibold text-white">
            N
          </div>
        </div>
      </div>
    </header>
  );
}
