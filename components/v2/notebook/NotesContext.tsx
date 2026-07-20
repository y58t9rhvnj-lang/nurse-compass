"use client";

// Compass Version2 — Compass Memo Supabase Integration (Phase 2)
// AppShell で 1 度だけ生成した useNotesSupabase の値を、Compassメモ を扱う複数の consumer
//（患者トップ・患者との会話の NoteZone・思考ワークスペースの EvidencePane 等）へ配る共有 Context。
//
// これにより、どの画面で追加・編集・削除しても同一インスタンスの state を共有し、
// リロード無しで相互反映される（localStorage singleton が担っていた自動共有を Supabase 版で再現）。
//
// 型は hook の公開 API から導出し、重複定義しない。

import { createContext, useContext, type ReactNode } from "react";
import type { UseNotesSupabaseResult } from "@/hooks/v2/useNotesSupabase";

const NotesContext = createContext<UseNotesSupabaseResult | null>(null);

export function NotesProvider({
  value,
  children,
}: {
  value: UseNotesSupabaseResult;
  children: ReactNode;
}) {
  return <NotesContext.Provider value={value}>{children}</NotesContext.Provider>;
}

// Provider 外での利用は明確なエラーにする（配線漏れを早期に検知する）。
// V2 専用画面（思考ワークスペースの EvidencePane 等）のように、必ず Provider 配下で
// 描画される consumer 向け。
export function useNotesContext(): UseNotesSupabaseResult {
  const ctx = useContext(NotesContext);
  if (ctx === null) {
    throw new Error("useNotesContext must be used within a NotesProvider");
  }
  return ctx;
}

// V1 Core と V2 の双方で描画される共有コンポーネント（NoteZone 等）向けの非スロー版。
// Provider が無い（V1 Core）場合は null を返し、呼び出し側が localStorage 版へフォールバックする。
export function useOptionalNotesContext(): UseNotesSupabaseResult | null {
  return useContext(NotesContext);
}
