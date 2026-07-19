"use client";

// Compass Version2 — Workspace Inspector の開閉 state（CWDS §3/§4）。
//
// 方針:
//   ・開閉状態は Workspace（親）が保持する。Workspace の主要 state（会話・Evidence・
//     様式2 など）とは完全に分離し、Inspector を開閉しても主要 state を壊さない。
//   ・開閉のためだけに大きなグローバル state 管理を導入しない。ローカルな useState で十分。
//   ・将来 Panel を切り替えられるよう activePanel を持つ（登録型 InspectorPanelId）。

import { useCallback, useMemo, useState } from "react";
import type { InspectorPanelId } from "@/components/v2/workspace/inspector/inspectorTypes";

export interface WorkspaceInspectorController {
  open: boolean;
  activePanel: InspectorPanelId | null;
  // 指定パネルで開く（省略時は概要表示）。同じ操作の連打でも安定させるため
  // 常に open=true・panel を確定させる（トグルではない）。
  openPanel: (panel?: InspectorPanelId) => void;
  // 閉じる（activePanel は保持し、開き直しで前回の文脈へ戻れる）。
  close: () => void;
  // トリガーボタン用。開いていれば閉じ、閉じていれば（前回パネルで）開く。
  toggle: (panel?: InspectorPanelId) => void;
}

export function useWorkspaceInspector(
  initialPanel: InspectorPanelId | null = null,
): WorkspaceInspectorController {
  const [open, setOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<InspectorPanelId | null>(
    initialPanel,
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
    () => ({ open, activePanel, openPanel, close, toggle }),
    [open, activePanel, openPanel, close, toggle],
  );
}
