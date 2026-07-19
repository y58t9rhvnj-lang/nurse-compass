"use client";

// Architecture Sprint 6 — Core-to-Learning Capture Flow
//
// 患者の 1 発言を Evidence として収集する導線（患者との会話画面用）。
//   ・保存単位は「患者の 1 発言」（既存の会話収集＝EvidencePane と同じ単位）。
//   ・出所 id は原文の content hash（TD-001）。サーバも original_text から同じ値を再計算するため、
//     セッションを跨いでも同一発言＝同一 id となり、二重収集を防げる。
//   ・保存済み表示のため、クライアントでも同じ hash を導出してから収集ボタンを描画する。

import { useEffect, useState } from "react";
import {
  CONVERSATION_SOURCE_KIND,
  conversationSourceId,
} from "@/lib/v2/notebook/conversationSourceId";
import { useEvidenceCapture } from "./EvidenceCaptureContext";
import EvidenceCaptureButton from "./EvidenceCaptureButton";

export default function ConversationCaptureButton({
  text,
  patientName,
  className,
}: {
  text: string;
  patientName: string;
  className?: string;
}) {
  const capture = useEvidenceCapture();
  const [sourceId, setSourceId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const id = await conversationSourceId(text);
      if (!cancelled) setSourceId(id);
    })();
    return () => {
      cancelled = true;
    };
  }, [text]);

  // Provider が無い（V1）／hash 未確定の間は描画しない。
  if (!capture || sourceId === null) return null;

  return (
    <EvidenceCaptureButton
      className={className}
      label="Workspaceへ追加"
      descriptor={{
        sourceType: "patient_conversation",
        sourceLabel: `患者との会話（${patientName}）`,
        typeLabel: "患者本人の言葉",
        // クライアント表示用の id。保存時はサーバが original_text から再計算して確定する。
        sourceReference: { kind: CONVERSATION_SOURCE_KIND, id: sourceId },
        originalText: text,
      }}
    />
  );
}
