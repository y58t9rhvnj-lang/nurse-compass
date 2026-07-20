// Compass 共通の通知バー（Core / Learning 双方で利用）。
// AppShell から切り出した presentational コンポーネント（挙動・見た目は不変）。
// 親（AppShell / CoreLayer / LearningLayer）と子の循環 import を避けるため独立ファイルにする。
export default function Notice({
  text,
  onClose,
}: {
  text: string;
  onClose: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center justify-between rounded-2xl bg-[#EAF3FF] px-4 py-2">
      <p className="text-xs font-medium text-[#0A5FCC]">{text}</p>
      <button
        type="button"
        onClick={onClose}
        className="min-h-[44px] text-[11px] text-[#6E6E73] hover:text-[#1D1D1F]"
      >
        閉じる
      </button>
    </div>
  );
}
