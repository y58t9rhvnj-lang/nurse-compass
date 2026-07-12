import { Lightbulb } from "lucide-react";

// 下部「手がかり」領域。
// 本 Sprint では空状態のみ（入力欄・追加ボタン・Cue モデルは実装しない）。
// 高さを取りすぎず、左右ペインの作業領域を優先する。
export default function CuePane() {
  return (
    <section className="flex flex-col px-4 py-3">
      <div className="flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-[#0A84FF]" strokeWidth={1.75} />
        <h2 className="text-[14px] font-bold text-[#1D1D1F]">手がかり</h2>
        <span className="text-[11px] text-[#AEAEB5]">
          整理した情報をもとに、気付いたことや確認したいことを考える場所です。
        </span>
      </div>

      <p className="mt-2 rounded-2xl border border-dashed border-[#E0E0E5] bg-[#FAFAFC] px-4 py-3 text-center text-[12px] text-[#8E8E93]">
        まだ手がかりはありません。
      </p>
    </section>
  );
}
