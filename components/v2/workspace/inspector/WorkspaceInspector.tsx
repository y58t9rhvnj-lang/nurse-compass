"use client";

// Compass Version2 — Workspace Inspector（CWDS §4/§7 の「器」）。
//
// 責務は器のみ: 開閉・レイアウト（PC=右サイドパネル / iPad=下シート）・オーバーレイ・
// スクロール・no-print・アクセシビリティ。ドメイン知識（Question 等）は持たない。
// 中身は children として親（PatientWorkspace）から差し替える（登録型）。
//
// Workspace First: Inspector は補助領域。開いても Workspace 本体は消えず、
//   本体の state（会話・Evidence・様式2・スクロール位置）はここでは一切触らない。
//   開閉 state・フォーカス復帰は親（PatientWorkspace）が制御する。
//
// レイアウト（単一 DOM をレスポンシブ class で切替。中身の state を二重化しない）:
//   ・<lg（iPad 縦など、右が狭い場合）: 画面下から出る下シート（薄い背景＋タップで閉じる）。
//   ・lg 以上（PC / iPad 横）: Workspace 右にドックするサイドパネル（本体と横に共存）。

import { useEffect, useId, useRef } from "react";
import { LifeBuoy, X } from "lucide-react";
import { INSPECTOR_DOM_ID, INSPECTOR_TITLE } from "./inspectorTypes";

export default function WorkspaceInspector({
  title = INSPECTOR_TITLE,
  onClose,
  children,
  // lg 以上での幅クラス（Learning Inspector foundation 管理）。既定は現行の 360px。
  widthClassName = "lg:w-[360px]",
  // 本文領域のクラス。既定は「余白付き・単一スクロール」。
  //   中身が自前で上下 2 領域の独立スクロールを持つ場合（学習支援カラム）は
  //   "min-h-0 flex-1"（余白・スクロール無し）を渡し、中身に高さを丸ごと委譲する。
  bodyClassName = "min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4",
}: {
  title?: string;
  // Close ボタン / Esc / 背景タップ すべてこの onClose を呼ぶ。
  // フォーカス復帰（トリガーへ戻す）は親側で行う。
  onClose: () => void;
  children: React.ReactNode;
  widthClassName?: string;
  bodyClassName?: string;
}) {
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // 開いた直後、閉じるボタンへフォーカスを移す（自然な初期フォーカス）。
  // このコンポーネントは open の時だけ mount されるため、mount 時に一度実行する。
  useEffect(() => {
    // preventScroll: 初期フォーカス移動で Workspace のスクロール位置を動かさない。
    const t = window.setTimeout(
      () => closeButtonRef.current?.focus({ preventScroll: true }),
      0,
    );
    return () => window.clearTimeout(t);
  }, []);

  // Esc で閉じる（下シート・サイドパネルどちらでも）。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      {/* 背景（下シート時のみ）。lg 以上のドック表示では出さない。
          Inspector は補助（非モーダル）なので背景は薄く、タップで閉じる。 */}
      <div
        className="no-print fixed inset-0 z-40 bg-black/25 lg:hidden"
        aria-hidden="true"
        onMouseDown={onClose}
      />

      {/* 本体。<lg=下シート（fixed）/ lg=右ドック（static flex child）。 */}
      <aside
        id={INSPECTOR_DOM_ID}
        role="complementary"
        aria-labelledby={titleId}
        className={[
          "no-print flex flex-col bg-white",
          // <lg: 画面下から出る下シート
          "fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] rounded-t-3xl border border-[#EBEBF0]",
          "shadow-[0_-8px_40px_rgba(0,0,0,0.14)]",
          // lg 以上: Workspace 右にドックするサイドパネル（本体と横に共存）。幅は foundation 管理。
          "lg:static lg:inset-auto lg:z-auto lg:h-full lg:max-h-none lg:shrink-0",
          widthClassName,
          "lg:rounded-none lg:border-y-0 lg:border-r-0 lg:border-l lg:shadow-[-1px_0_3px_rgba(0,0,0,0.05)]",
        ].join(" ")}
      >
        {/* ヘッダー（固定・Title / Close） */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#EFEFF2] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#F2F2F7]">
              <LifeBuoy className="h-4 w-4 text-[#0A6CD6]" strokeWidth={1.9} />
            </span>
            <h2 id={titleId} className="text-[15px] font-bold text-[#1D1D1F]">
              {title}
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label={`${title}を閉じる`}
            className="-mr-1.5 flex h-11 w-11 items-center justify-center rounded-full text-[#8E8E93] transition hover:bg-[#F2F2F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A84FF]/40"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        {/* 本文。既定は独立スクロール＋余白。学習支援カラムは自前で高さ・スクロールを管理する。 */}
        <div className={bodyClassName}>{children}</div>
      </aside>
    </>
  );
}
