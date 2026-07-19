"use client";

// Architecture Sprint 6 — Core-to-Learning Capture Flow
//
// Core 画面（電子カルテ・患者との会話 等）に散在する収集ボタンへ、Learning Layer の
// Evidence 収集 API を配る最小の Context。
//
// 方針:
//   ・Provider は Learning（/v2/student の v2 モード）でのみ AppShell が設置する。
//     V1（mode !== "v2"）には Provider が無いため、収集ボタンは何も描画しない
//     （useEvidenceCapture() が null を返す）。これにより「V1 に収集ボタンが誤表示されない」。
//   ・API は既存 useEvidenceSupabase の一部（収集・収集済み判定・状態）をそのまま束ねるだけで、
//     新しい永続化 state や大きな共有基盤は作らない。
//   ・患者・caseId・studentId は Provider 側（AppShell が保持する evidence コントローラ）が
//     内包するため、各収集ボタンは出所情報のみを渡せばよい。

import { createContext, useContext } from "react";
import type {
  CaptureResult,
  CaptureSourceArgs,
  EvidenceStatus,
} from "@/hooks/v2/useEvidenceSupabase";

export interface EvidenceCaptureApi {
  status: EvidenceStatus;
  // 出所参照（kind,id）で既に収集済みかを判定する（id を持つ情報源のみ意味を持つ）。
  isCollected: (kind: string, id: string) => boolean;
  // 収集を実行する（収集確認ダイアログ確定後に呼ぶ）。
  collect: (args: CaptureSourceArgs) => Promise<CaptureResult>;
}

const EvidenceCaptureContext = createContext<EvidenceCaptureApi | null>(null);

export function EvidenceCaptureProvider({
  value,
  children,
}: {
  value: EvidenceCaptureApi | null;
  children: React.ReactNode;
}) {
  return (
    <EvidenceCaptureContext.Provider value={value}>
      {children}
    </EvidenceCaptureContext.Provider>
  );
}

// Provider が無い（V1 など）場合は null を返す。呼び出し側は null のとき収集 UI を描画しない。
export function useEvidenceCapture(): EvidenceCaptureApi | null {
  return useContext(EvidenceCaptureContext);
}
