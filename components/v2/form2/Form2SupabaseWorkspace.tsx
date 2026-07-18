"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, Pencil, Printer } from "lucide-react";
import Form2EditForm from "@/components/form2/Form2EditForm";
import Form2SheetView from "@/components/form2/Form2SheetView";
import { useForm2Supabase } from "@/hooks/v2/useForm2Supabase";
import type { Form2Snapshot } from "@/lib/v2/notebook/types";

type Mode = "edit" | "view";

function formatTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}

// V2（Supabase 接続）版の精神様式2 ワークスペース。
// 表示層（Form2EditForm / Form2SheetView）は V1 を変更せず再利用する。
export default function Form2SupabaseWorkspace({
  patientId,
  patientName,
  userId,
  initial,
}: {
  patientId: string;
  patientName: string;
  userId: string;
  initial: Form2Snapshot | null;
}) {
  const {
    data,
    hydrated,
    saveStatus,
    lastSavedAt,
    hasConflict,
    pendingDraft,
    updateBasic,
    updateHistory,
    updateTreatment,
    updateStudent,
    updatePeriod,
    saveNow,
    retry,
    loadLatest,
    restoreDraft,
    discardDraft,
  } = useForm2Supabase({ patientId, userId, initial });

  const [mode, setMode] = useState<Mode>("edit");

  const savedTime = formatTime(lastSavedAt);
  // 失敗時は決して「保存済み」を表示しない。
  const saveLabel = !hydrated
    ? ""
    : saveStatus === "saving"
      ? "保存中…"
      : saveStatus === "error"
        ? "保存できませんでした。通信状況を確認して、もう一度お試しください。"
        : saveStatus === "conflict"
          ? "他の端末で更新されました"
          : saveStatus === "dirty"
            ? "未保存の変更があります"
            : savedTime
              ? `保存済み ・ 最終保存 ${savedTime}`
              : "未保存";
  const saveTone =
    saveStatus === "error" || saveStatus === "conflict"
      ? "text-[#C0392B]"
      : "text-[#6E6E73]";

  return (
    <div className="flex min-h-screen flex-col bg-[#EDEDF0]">
      <header className="no-print shrink-0 border-b border-[#E5E5EA] bg-white">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
          <Link
            href="/v2/student"
            className="flex min-h-[44px] items-center gap-1.5 text-[13px] text-[#3A3A3C] hover:text-[#0A84FF]"
          >
            <ArrowLeft className="h-4 w-4" />
            学生ホーム
          </Link>
          <div className="min-w-0">
            <p className="text-[11px] leading-tight text-[#8E8E93]">精神様式2</p>
            <h1 className="truncate text-[15px] font-semibold leading-tight text-[#1D1D1F]">
              受け持ち対象記録
              <span className="ml-2 text-[12px] font-normal text-[#6E6E73]">
                {patientName}
              </span>
            </h1>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <span aria-live="polite" className={`text-[12px] ${saveTone}`} suppressHydrationWarning>
              {saveLabel}
            </span>

            {(saveStatus === "error" || saveStatus === "dirty") && (
              <button
                type="button"
                onClick={saveStatus === "error" ? retry : saveNow}
                className="min-h-[36px] rounded-lg border border-[#D1D1D6] px-3 text-[13px] text-[#3A3A3C] hover:bg-[#F2F2F5]"
              >
                {saveStatus === "error" ? "再試行" : "今すぐ保存"}
              </button>
            )}

            <div className="flex overflow-hidden rounded-lg border border-[#D1D1D6]">
              <button
                type="button"
                onClick={() => setMode("edit")}
                aria-pressed={mode === "edit"}
                className={[
                  "flex min-h-[36px] items-center gap-1 px-3 text-[13px]",
                  mode === "edit"
                    ? "bg-[#1D1D1F] font-semibold text-white"
                    : "bg-white text-[#3A3A3C] hover:bg-[#F2F2F5]",
                ].join(" ")}
              >
                <Pencil className="h-3.5 w-3.5" />
                編集
              </button>
              <button
                type="button"
                onClick={() => setMode("view")}
                aria-pressed={mode === "view"}
                className={[
                  "flex min-h-[36px] items-center gap-1 border-l border-[#D1D1D6] px-3 text-[13px]",
                  mode === "view"
                    ? "bg-[#1D1D1F] font-semibold text-white"
                    : "bg-white text-[#3A3A3C] hover:bg-[#F2F2F5]",
                ].join(" ")}
              >
                <FileText className="h-3.5 w-3.5" />
                様式表示
              </button>
            </div>

            {mode === "view" && (
              <button
                type="button"
                onClick={() => window.print()}
                className="flex min-h-[36px] items-center gap-1 rounded-lg border border-[#D1D1D6] px-3 text-[13px] text-[#3A3A3C] hover:bg-[#F2F2F5]"
              >
                <Printer className="h-3.5 w-3.5" />
                印刷
              </button>
            )}
          </div>
        </div>

        {/* 競合バナー（最新を読み込むのみ） */}
        {hasConflict && (
          <div className="flex flex-wrap items-center gap-3 border-t border-[#F3D6D2] bg-[#FBEAE8] px-4 py-2">
            <span className="text-[12px] text-[#C0392B]">
              他の端末でこの様式2が更新されました。入力内容は端末内に退避しています。
            </span>
            <button
              type="button"
              onClick={loadLatest}
              className="min-h-[32px] rounded-lg bg-[#C0392B] px-3 text-[12px] font-semibold text-white hover:bg-[#A93226]"
            >
              最新を読み込む
            </button>
          </div>
        )}

        {/* 下書き復元バナー */}
        {pendingDraft && !hasConflict && (
          <div className="flex flex-wrap items-center gap-3 border-t border-[#FCE9C6] bg-[#FFF7E6] px-4 py-2">
            <span className="text-[12px] text-[#8A6D3B]">
              前回、保存できなかった入力内容が端末内に残っています。復元しますか？
            </span>
            <button
              type="button"
              onClick={restoreDraft}
              className="min-h-[32px] rounded-lg border border-[#E0B75B] bg-white px-3 text-[12px] font-semibold text-[#8A6D3B] hover:bg-[#FFF1D6]"
            >
              下書きを復元
            </button>
            <button
              type="button"
              onClick={discardDraft}
              className="min-h-[32px] rounded-lg border border-[#D1D1D6] px-3 text-[12px] text-[#6E6E73] hover:bg-[#F2F2F5]"
            >
              破棄
            </button>
          </div>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
        {mode === "edit" ? (
          <Form2EditForm
            data={data}
            updateBasic={updateBasic}
            updateHistory={updateHistory}
            updateTreatment={updateTreatment}
            updateStudent={updateStudent}
            updatePeriod={updatePeriod}
          />
        ) : (
          <Form2SheetView data={data} />
        )}
      </div>
    </div>
  );
}
