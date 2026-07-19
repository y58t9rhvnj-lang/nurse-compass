"use client";

// Architecture Sprint 6 — Core-to-Learning Capture Flow
//
// Core 画面の各情報源（電子カルテ記録・患者発言 等）に置く共通の収集操作。
//   ・Learning（Provider あり）でのみ描画する。V1 では useEvidenceCapture() が null → 何も出さない。
//   ・押すと収集確認ダイアログ（既存 CollectionDialog を流用）を開き、内容・出典・種別・
//     学生メモを確認してから Evidence として保存する。
//   ・出所参照 {kind,id} を持つ情報源は、保存済みかどうかを表示し、二重収集を防ぐ。
//   ・保存後も同じ Core 画面に留まり、患者文脈・スクロールを維持する（本体を再マウントしない）。

import { useState } from "react";
import { Check, Plus } from "lucide-react";
import type {
  InformationSourceReference,
  InformationSourceType,
} from "@/lib/information/informationCard";
import CollectionDialog from "@/components/collection/CollectionDialog";
import { useEvidenceCapture } from "./EvidenceCaptureContext";
import type { CaptureResult } from "@/hooks/v2/useEvidenceSupabase";

export interface EvidenceCaptureDescriptor {
  sourceType: InformationSourceType;
  sourceLabel: string;
  // {kind,id?,date?,tab?}。id を持つと保存済み表示・二重収集防止が有効になる。
  sourceReference?: InformationSourceReference;
  // 原文（immutable。学生が保存内容を整えても保持する）。
  originalText: string;
  // ダイアログの初期「保存する内容」。未指定なら originalText。
  defaultContent?: string;
  // ダイアログに表示する種別ラベル（例「電子カルテ・診療録」）。
  typeLabel?: string;
  // ダイアログに表示する日時。
  timestamp?: string | null;
}

function errorMessage(kind: string): string {
  switch (kind) {
    case "unauthorized":
      return "ログインが必要です。もう一度ログインしてください。";
    case "network":
      return "通信状況を確認して、もう一度お試しください。";
    case "conflict":
      return "最新の状態に更新されました。もう一度お試しください。";
    case "validation":
      return "保存する内容を確認してください。";
    default:
      return "保存できませんでした。しばらくしてから、もう一度お試しください。";
  }
}

export default function EvidenceCaptureButton({
  descriptor,
  label = "Workspaceへ追加",
  className,
}: {
  descriptor: EvidenceCaptureDescriptor;
  label?: string;
  className?: string;
}) {
  const capture = useEvidenceCapture();
  const [open, setOpen] = useState(false);
  // エラー時は入力を失わずその場で再試行できるよう、直近の入力値を保持して remount する。
  const [dialogKey, setDialogKey] = useState(0);
  const [draft, setDraft] = useState<{ content: string; note?: string } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  // Provider が無い（V1 など）場合は収集 UI を一切描画しない。
  if (!capture) return null;

  const ref = descriptor.sourceReference;
  const collected =
    !!ref?.kind && !!ref?.id ? capture.isCollected(ref.kind, ref.id) : false;
  const working = capture.status === "working";

  if (collected) {
    return (
      <span
        className={[
          "inline-flex min-h-[36px] items-center gap-1 rounded-full bg-[#EEF7EE] px-2.5 text-[11px] font-semibold text-[#2E7D32]",
          className ?? "",
        ].join(" ")}
        aria-label="この情報は収集済みです"
      >
        <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
        保存済み
      </span>
    );
  }

  const handleConfirm = async (content: string, note?: string) => {
    setDraft({ content, note });
    const res: CaptureResult = await capture.collect({
      content,
      sourceType: descriptor.sourceType,
      sourceLabel: descriptor.sourceLabel,
      sourceReference: descriptor.sourceReference,
      originalText: descriptor.originalText,
      note,
    });
    if (res.ok || res.kind === "duplicate") {
      // 成功／既収集：ダイアログを閉じる（ボタンは「保存済み」へ切り替わる）。
      setError(null);
      setDraft(null);
      setOpen(false);
      return;
    }
    // 失敗：入力を失わずダイアログを開いたまま再試行できるよう remount（submit ロック解除）。
    setError(errorMessage(res.kind));
    setDialogKey((k) => k + 1);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setDraft(null);
          setDialogKey((k) => k + 1);
          setOpen(true);
        }}
        disabled={working}
        aria-label={`${label}（${descriptor.sourceLabel}）`}
        className={[
          "inline-flex min-h-[36px] shrink-0 items-center gap-1 rounded-full border border-[#0A84FF]/30 bg-white px-2.5 text-[11px] font-semibold text-[#0A84FF] transition hover:bg-[#F2F7FF] disabled:opacity-40",
          className ?? "",
        ].join(" ")}
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
        {label}
      </button>

      {open && (
        <CollectionDialog
          key={dialogKey}
          open
          mode="add"
          originalText={descriptor.originalText}
          initialContent={draft?.content ?? descriptor.defaultContent ?? descriptor.originalText}
          initialNote={draft?.note ?? ""}
          showNote
          typeLabel={descriptor.typeLabel}
          sourceLabel={descriptor.sourceLabel}
          timestamp={descriptor.timestamp}
          onCancel={() => {
            setOpen(false);
            setError(null);
            setDraft(null);
          }}
          onConfirm={handleConfirm}
        />
      )}

      {error && (
        <span
          role="alert"
          className="inline-flex items-center rounded-full bg-[#FBEAE8] px-2.5 py-0.5 text-[11px] font-medium text-[#C0392B]"
        >
          {error}
        </span>
      )}
    </>
  );
}
