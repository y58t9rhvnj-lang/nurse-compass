"use client";

// Compass Version2 — Question Panel のローカル state（選択 / 状態）。
//
// 方針:
//   ・DB 保存はしない（MVP は静的・決定論）。状態はローカルのみ。
//   ・この state は Workspace（親）側で保持し、Inspector を閉じても失わない
//     （Question Panel の unmount で選択・状態がリセットされないようにする）。
//     リロードやページ遷移ではリセットされる（永続化は将来フェーズ）。
//   ・グローバル state は導入しない。

import { useCallback, useMemo, useState } from "react";
import {
  DEFAULT_QUESTION_STATUS,
  type QuestionStatus,
} from "@/lib/v2/question/questionTypes";

export interface QuestionPanelController {
  selectedId: string | null;
  // 選択トグル（同じ問いを再選択すると閉じる）。
  select: (id: string) => void;
  // 状態変更（未確認 / 考えている / 確認済み）。
  setStatus: (id: string, status: QuestionStatus) => void;
  // 現在の状態（未設定は未確認）。
  statusOf: (id: string) => QuestionStatus;
}

export function useQuestionPanel(): QuestionPanelController {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<Record<string, QuestionStatus>>({});

  const select = useCallback((id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
  }, []);

  const setStatus = useCallback((id: string, status: QuestionStatus) => {
    setStatuses((prev) => ({ ...prev, [id]: status }));
  }, []);

  const statusOf = useCallback(
    (id: string): QuestionStatus => statuses[id] ?? DEFAULT_QUESTION_STATUS,
    [statuses],
  );

  return useMemo(
    () => ({ selectedId, select, setStatus, statusOf }),
    [selectedId, select, setStatus, statusOf],
  );
}
