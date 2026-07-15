"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, FileText, Pencil } from "lucide-react";
import Form2EditForm from "./Form2EditForm";
import Form2SheetView from "./Form2SheetView";
import { useForm2 } from "@/hooks/useForm2";
import { buildForm2AutoData } from "@/lib/form2/form2AutoData";
import type { ChartTabId } from "@/lib/chartTabs";
import type { Patient } from "@/lib/wardData";

type Mode = "edit" | "view";

// 情報収集導線。存在する電子カルテタブと患者会話へ移動する。
// （「指示」は独立タブが無いため対象外。処方・検査等から確認する。）
const INFO_NAV: { label: string; tab?: ChartTabId; conversation?: boolean }[] = [
  { label: "患者会話", conversation: true },
  { label: "患者基本情報", tab: "患者情報" },
  { label: "医療サマリー", tab: "医療サマリー" },
  { label: "診療録", tab: "診療録" },
  { label: "看護記録", tab: "看護記録" },
  { label: "処方", tab: "処方" },
  { label: "検査", tab: "検査" },
];

function formatTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Form2Workspace({
  patient,
  onExit,
  onOpenConversation,
  onOpenChart,
}: {
  patient: Patient;
  onExit: () => void;
  onOpenConversation: () => void;
  onOpenChart: (tab: ChartTabId) => void;
}) {
  const {
    data,
    hydrated,
    saveStatus,
    lastSavedAt,
    updateSection,
    updateStudent,
    updatePeriod,
    reset,
  } = useForm2(patient.id);

  const [mode, setMode] = useState<Mode>("edit");
  const [confirmReset, setConfirmReset] = useState(false);

  const auto = useMemo(() => buildForm2AutoData(patient), [patient]);

  const savedTime = formatTime(lastSavedAt);
  const saveLabel =
    saveStatus === "saving"
      ? "保存中…"
      : hydrated && savedTime
        ? `保存済み ・ 最終保存 ${savedTime}`
        : hydrated
          ? "未保存"
          : "";

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#EDEDF0]">
      {/* ヘッダー */}
      <header className="shrink-0 border-b border-[#E5E5EA] bg-white">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
          <button
            type="button"
            onClick={onExit}
            className="flex min-h-[44px] items-center gap-1.5 text-[13px] text-[#3A3A3C] hover:text-[#0A84FF]"
          >
            <ArrowLeft className="h-4 w-4" />
            患者トップ
          </button>
          <div className="min-w-0">
            <p className="text-[11px] leading-tight text-[#8E8E93]">精神様式2</p>
            <h1 className="truncate text-[15px] font-semibold leading-tight text-[#1D1D1F]">
              受け持ち対象記録
              <span className="ml-2 text-[12px] font-normal text-[#6E6E73]">
                {patient.name}
              </span>
            </h1>
          </div>

          <div className="ml-auto flex items-center gap-3">
            {/* 保存状態（小さく表示） */}
            <span
              aria-live="polite"
              className="text-[12px] text-[#6E6E73]"
              suppressHydrationWarning
            >
              {saveLabel}
            </span>

            {/* 編集 / 様式表示 切替 */}
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

            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="min-h-[36px] rounded-lg border border-[#D1D1D6] px-3 text-[13px] text-[#C0392B] hover:bg-[#FBEAE8]"
            >
              様式2を初期化
            </button>
          </div>
        </div>

        {/* 情報収集導線 */}
        <div className="flex flex-wrap items-center gap-2 border-t border-[#F0F0F2] px-4 py-2">
          <span className="text-[12px] text-[#8E8E93]">情報を確認：</span>
          {INFO_NAV.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() =>
                item.conversation
                  ? onOpenConversation()
                  : item.tab && onOpenChart(item.tab)
              }
              className="min-h-[32px] rounded-full border border-[#D1D1D6] bg-white px-3 text-[12px] text-[#3A3A3C] hover:border-[#0A84FF] hover:text-[#0A84FF]"
            >
              {item.label}
            </button>
          ))}
          <span className="text-[11px] text-[#B0B0B5]">
            移動しても入力内容は自動保存され失われません
          </span>
        </div>
      </header>

      {/* 本文（独自スクロール） */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
        {mode === "edit" ? (
          <Form2EditForm
            auto={auto}
            data={data}
            updateSection={updateSection}
            updateStudent={updateStudent}
            updatePeriod={updatePeriod}
          />
        ) : (
          <Form2SheetView auto={auto} data={data} />
        )}
      </div>

      {/* 初期化の確認ダイアログ */}
      {confirmReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="form2-reset-title"
            className="w-full max-w-[400px] rounded-2xl bg-white p-5 shadow-xl"
          >
            <h2
              id="form2-reset-title"
              className="text-[15px] font-semibold text-[#1D1D1F]"
            >
              様式2を初期化しますか？
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-[#3A3A3C]">
              {patient.name}の「精神様式2」の入力内容がすべて削除されます。
              この操作は取り消せません。患者会話・気づきメモ・看護記録などは削除されません。
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="min-h-[40px] rounded-lg border border-[#D1D1D6] px-4 text-[13px] text-[#3A3A3C] hover:bg-[#F2F2F5]"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => {
                  reset();
                  setConfirmReset(false);
                  setMode("edit");
                }}
                className="min-h-[40px] rounded-lg bg-[#C0392B] px-4 text-[13px] font-semibold text-white hover:bg-[#A93226]"
              >
                初期化する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
