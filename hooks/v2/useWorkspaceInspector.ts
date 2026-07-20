"use client";

// Compass Version2 — Learning Inspector の基盤 state（CWDS §3/§4, 設計 13/16 §6）。
//
// 位置づけ: これは全 Workspace 共通の Learning Inspector（右側支援領域）の「器」の状態管理。
//   Architecture Migration（Sprint A）で foundation を明文化した:
//     ・開閉状態管理（open / openPanel / close / toggle）
//     ・状態保持（Workspace が変わっても open / activePanel / width を失わない）
//     ・Panel 差し替え（activePanel = 登録型 InspectorPanelId）
//     ・幅管理（widthClassName。lg 以上での幅を foundation 側で管理。既定は現行の 360px）
//
// 方針:
//   ・開閉状態は Workspace の上位（AppShell）が保持する。Workspace の主要 state（会話・
//     Evidence・様式2 など）とは完全に分離し、Inspector を開閉しても主要 state を壊さない。
//   ・開閉のためだけに大きなグローバル state 管理を導入しない。ローカルな useState で十分。

import { useCallback, useMemo, useState } from "react";
import type { InspectorPanelId } from "@/components/v2/workspace/inspector/inspectorTypes";

// lg 以上での Inspector 既定幅（現行 UI を維持するため 360px）。将来 Workspace ごとに
// 異なる幅を与える場合は setWidthClassName で差し替える（Tailwind の lg: プレフィクス付き幅クラス）。
export const DEFAULT_INSPECTOR_WIDTH_CLASS = "lg:w-[360px]";

export interface WorkspaceInspectorController {
  open: boolean;
  activePanel: InspectorPanelId | null;
  // lg 以上での Inspector 幅（Tailwind クラス）。既定は現行の 360px。
  widthClassName: string;
  // 指定パネルで開く（省略時は概要表示）。同じ操作の連打でも安定させるため
  // 常に open=true・panel を確定させる（トグルではない）。
  openPanel: (panel?: InspectorPanelId) => void;
  // 閉じる（activePanel は保持し、開き直しで前回の文脈へ戻れる）。
  close: () => void;
  // トリガーボタン用。開いていれば閉じ、閉じていれば（前回パネルで）開く。
  toggle: (panel?: InspectorPanelId) => void;
  // 幅を差し替える（Workspace ごとの最適幅を将来与えるための foundation API）。
  setWidthClassName: (widthClassName: string) => void;
}

export function useWorkspaceInspector(
  initialPanel: InspectorPanelId | null = null,
  initialWidthClassName: string = DEFAULT_INSPECTOR_WIDTH_CLASS,
): WorkspaceInspectorController {
  const [open, setOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<InspectorPanelId | null>(
    initialPanel,
  );
  const [widthClassName, setWidthClassName] = useState<string>(
    initialWidthClassName,
  );

  const openPanel = useCallback((panel?: InspectorPanelId) => {
    if (panel !== undefined) setActivePanel(panel);
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  const toggle = useCallback((panel?: InspectorPanelId) => {
    setOpen((prev) => {
      if (!prev && panel !== undefined) setActivePanel(panel);
      return !prev;
    });
  }, []);

  return useMemo(
    () => ({
      open,
      activePanel,
      widthClassName,
      openPanel,
      close,
      toggle,
      setWidthClassName,
    }),
    [open, activePanel, widthClassName, openPanel, close, toggle],
  );
}
