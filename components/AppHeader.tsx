export default function AppHeader() {
  return (
    <header className="shrink-0 border-b border-[#E5E7EB] bg-white">
      <div className="flex h-[48px] items-center justify-between px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#0F2742]">
            <span className="text-sm font-bold text-white">N</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-[#0F2742]">Nurse Compass</p>
            <p className="text-[10px] text-[#9CA3AF]">
              看護師としての判断の羅針盤
            </p>
          </div>
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
