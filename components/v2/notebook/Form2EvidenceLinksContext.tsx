"use client";

// Compass Version2 — Learning Layer (Sprint D-2B)
// Evidence–様式2 根拠リンクの共有コンテキスト。
//
// Evidence 整理ビュー（第2段階）の左右カラム（EvidenceOrganizePanel と WorkspaceForm2Section）は、
// 同じリンク状態と「対象欄フォーカス」要求を共有する必要がある（「様式2で使う」→項目選択→対象欄フォーカス）。
// そのため EvidenceReviewWorkspace が useForm2EvidenceLinks とフォーカス状態を生成し、本コンテキストで配る。
//
// 第1段階の思考ワークスペースや「様式2」レビュー画面など Provider が無い場所では、
// useOptionalForm2EvidenceLinksContext が null を返し、根拠リンク UI を出さない（様式2 を主役に保つ）。

import { createContext, useContext, type ReactNode } from "react";
import type { UseForm2EvidenceLinksResult } from "@/hooks/v2/useForm2EvidenceLinks";

export interface Form2EvidenceLinksContextValue extends UseForm2EvidenceLinksResult {
  // 「様式2で使う」で選ばれた項目（section.field のドットパス）。フォーカス対象。
  focusFieldKey: string | null;
  // 同じ項目を連続で選んでも再フォーカスできるよう、要求ごとに増える。
  focusToken: number;
  requestFocusField: (fieldKey: string) => void;
}

const Ctx = createContext<Form2EvidenceLinksContextValue | null>(null);

export function Form2EvidenceLinksProvider({
  value,
  children,
}: {
  value: Form2EvidenceLinksContextValue;
  children: ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useForm2EvidenceLinksContext(): Form2EvidenceLinksContextValue {
  const ctx = useContext(Ctx);
  if (ctx === null) {
    throw new Error(
      "useForm2EvidenceLinksContext must be used within a Form2EvidenceLinksProvider",
    );
  }
  return ctx;
}

export function useOptionalForm2EvidenceLinksContext(): Form2EvidenceLinksContextValue | null {
  return useContext(Ctx);
}
