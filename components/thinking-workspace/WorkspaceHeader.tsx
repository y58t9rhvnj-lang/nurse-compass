import { ChevronLeft } from "lucide-react";

// 情報整理ノート（Clinical Thinking Workspace）の上部ヘッダー。
// 「← 患者へ戻る」／タイトル／患者名／将来の「様式2へ進む」領域を持つ。
// 「様式2へ進む」は今回未実装のため、無効状態で表示する（機能がないボタンを有効にしない）。
export default function WorkspaceHeader({
  patientName,
  onBack,
}: {
  patientName?: string;
  onBack: () => void;
}) {
  return (
    <header className="flex shrink-0 items-center gap-3 border-b border-[#E5E5EA] bg-white px-4 py-3">
      <button
        type="button"
        onClick={onBack}
        className="flex min-h-[44px] items-center gap-1 rounded-full px-3 text-[13px] font-medium text-[#0A84FF] transition hover:bg-[#F2F7FF]"
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={2} />
        患者へ戻る
      </button>

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[15px] font-bold text-[#1D1D1F]">
          情報整理ノート
        </h1>
        {patientName && (
          <p className="truncate text-[11px] text-[#8E8E93]">{patientName}</p>
        )}
      </div>

      {/* 将来の導線（今回は無効） */}
      <button
        type="button"
        disabled
        aria-disabled="true"
        title="様式2は今後のSprintで実装予定です"
        className="min-h-[44px] shrink-0 cursor-not-allowed rounded-full border border-[#E5E5EA] px-4 text-[13px] font-medium text-[#C7C7CC]"
      >
        様式2へ進む
      </button>
    </header>
  );
}
