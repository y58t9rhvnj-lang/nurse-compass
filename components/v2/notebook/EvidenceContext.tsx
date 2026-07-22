"use client";

// Compass Version2 — Evidence 共有 Context（Sprint D-2A）。
//
// AppShell で 1 度だけ生成した useEvidenceSupabase の値を、Evidence を扱う consumer
//（思考ワークスペース中央の Evidence トレイ 等）へ配る共有 Context。NotesContext と同じ設計。
//
// これにより、Compassメモ からの Evidence 整理・解除が、ページ全体の再読み込みなしに
// ワークスペースへ反映される（AppShell 単一インスタンスの Supabase 版を共有する）。
//
// 型は hook の公開 API から導出し、重複定義しない。

import { createContext, useContext, type ReactNode } from "react";
import type { UseEvidenceSupabaseResult } from "@/hooks/v2/useEvidenceSupabase";

const EvidenceContext = createContext<UseEvidenceSupabaseResult | null>(null);

export function EvidenceProvider({
  value,
  children,
}: {
  value: UseEvidenceSupabaseResult;
  children: ReactNode;
}) {
  return (
    <EvidenceContext.Provider value={value}>
      {children}
    </EvidenceContext.Provider>
  );
}

// Provider 外での利用は明確なエラーにする（配線漏れを早期に検知する）。
// V2 専用画面（思考ワークスペースの Evidence トレイ）のように、必ず Provider 配下で
// 描画される consumer 向け。
export function useEvidenceContext(): UseEvidenceSupabaseResult {
  const ctx = useContext(EvidenceContext);
  if (ctx === null) {
    throw new Error("useEvidenceContext must be used within an EvidenceProvider");
  }
  return ctx;
}

// 非スロー版（Provider 有無に依存しない共有コンポーネント向け）。無ければ null。
export function useOptionalEvidenceContext(): UseEvidenceSupabaseResult | null {
  return useContext(EvidenceContext);
}
