"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronLeft,
  MessagesSquare,
  NotebookPen,
  Plus,
  Send,
} from "lucide-react";
import type { Patient } from "@/lib/wardData";
import {
  type FacingConvoState,
  advanceConversation,
  getEntryId,
  getObservation,
} from "@/lib/patientFacingData";
import { useInformationCards } from "@/hooks/useInformationCards";
import CollectionDialog from "@/components/collection/CollectionDialog";
import PatientPresence from "./PatientPresence";

// Sprint10.8A: 中央は患者との対話に専念する。
// Compass Coach とヒント・関連情報は右ペイン（FacingCoachPanel）へ移設済み。
// チャットには「学生の発言」「患者の発言」「初回の空状態ガイド」のみを表示する。
// 会話状態は親（AppShell）が患者別に保持するため、カルテ往復しても維持される。
export default function FacingPatient({
  patient,
  onBack,
  state,
  onChange,
  onOpenWorkspace,
}: {
  patient: Patient;
  onBack: () => void;
  state: FacingConvoState;
  onChange: (next: FacingConvoState) => void;
  onOpenWorkspace?: () => void;
}) {
  const observation = getObservation(patient.id);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  // 「収集済み」は収集データ（Information Card）store から導出（UI ローカル state では管理しない）。
  const { hydrated, isEntryCollected, collectPatientUtterance } =
    useInformationCards(patient.id);
  // 収集する対象の患者発言（共通収集ダイアログで確認・確定する）。
  const [collectTarget, setCollectTarget] = useState<{
    entryId: string;
    text: string;
  } | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [state.history.length]);

  const send = (raw: string) => {
    const text = raw.trim();
    if (text === "") return;
    onChange(advanceConversation(patient.id, state, text));
    setDraft("");
  };

  return (
    <div className="flex h-full flex-col gap-3 px-6 py-4">
      {/* 上部：戻る＋患者ステータス（固定） */}
      <div className="shrink-0 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onBack}
            className="flex min-h-[44px] w-fit items-center gap-1 rounded-full bg-white px-4 py-2 text-[13px] font-medium text-[#0A84FF] shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:bg-[#F2F7FF]"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={2} />
            病棟へ戻る
          </button>
          {onOpenWorkspace && (
            <button
              type="button"
              onClick={onOpenWorkspace}
              className="flex min-h-[44px] w-fit items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[13px] font-medium text-[#3A3A3C] shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:bg-[#F2F2F5]"
            >
              <NotebookPen className="h-4 w-4 text-[#0A84FF]" strokeWidth={1.75} />
              情報整理ノート
            </button>
          )}
        </div>
        <PatientPresence patient={patient} observation={observation} />
      </div>

      {/* 中央：チャット（スクロール・学生／患者の発言のみ） */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto rounded-3xl border border-[#EBEBF0] bg-[#F7F9FC] p-4"
      >
        {state.history.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <MessagesSquare className="h-8 w-8 text-[#C7C7CC]" strokeWidth={1.5} />
            <p className="text-[13px] font-medium text-[#8E8E93]">
              話しかけてみましょう
            </p>
            <p className="max-w-xs text-[11.5px] leading-relaxed text-[#AEAEB5]">
              患者さんは、あなたが声をかけると答えてくれます。右のヒントを参考に、まずは挨拶から。
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {state.history.map((item, i) => {
              if (item.role === "coach") return null;
              const isStudent = item.role === "student";
              const entryId = getEntryId(patient.id, item, i);
              if (isStudent) {
                return (
                  <li key={entryId} className="flex justify-end">
                    <Bubble role="student" name="学生" text={item.text} />
                  </li>
                );
              }
              return (
                <li key={entryId} className="flex flex-col items-start">
                  <Bubble role="patient" name={patient.name} text={item.text} />
                  {hydrated && (
                    <CollectButton
                      collected={isEntryCollected(entryId)}
                      onCollect={() =>
                        setCollectTarget({ entryId, text: item.text })
                      }
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* 下部：入力（固定） */}
      <div className="shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(draft);
          }}
          className="flex items-center gap-2"
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="患者さんに話しかける…"
            aria-label="患者さんに話しかける"
            className="min-h-[44px] flex-1 rounded-full border border-[#E5E5EA] bg-white px-4 text-[13px] text-[#1D1D1F] outline-none transition focus:border-[#0A84FF]"
          />
          <button
            type="submit"
            disabled={draft.trim() === ""}
            className="flex min-h-[44px] items-center gap-1.5 rounded-full bg-[#0A84FF] px-4 text-[13px] font-semibold text-white transition hover:bg-[#0A6CD6] disabled:opacity-40"
          >
            <Send className="h-4 w-4" strokeWidth={2} />
            送信
          </button>
        </form>
      </div>

      {/* 共通収集ダイアログ（患者発言の収集） */}
      <CollectionDialog
        key={collectTarget?.entryId ?? "closed"}
        open={collectTarget !== null}
        mode="add"
        originalText={collectTarget?.text ?? ""}
        initialContent={collectTarget?.text ?? ""}
        sourceLabel="患者との会話"
        onCancel={() => setCollectTarget(null)}
        onConfirm={(content) => {
          if (collectTarget) {
            collectPatientUtterance(
              collectTarget.entryId,
              content,
              collectTarget.text,
            );
          }
          setCollectTarget(null);
        }}
      />
    </div>
  );
}

// 患者発言を収集データとして収集する控えめな操作（吹き出し下・左寄せ）。
// 収集済みは store 由来で、リロード・カルテ往復後も復元される。色だけでなく文字でも状態を示す。
function CollectButton({
  collected,
  onCollect,
}: {
  collected: boolean;
  onCollect: () => void;
}) {
  if (collected) {
    return (
      <span
        className="mt-0.5 -mb-1 inline-flex min-h-[44px] items-center gap-1 px-1 text-[11px] font-semibold text-[#34C759]"
        aria-label="この発言は収集済みです"
      >
        <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
        収集済み
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onCollect}
      aria-label="この患者の発言を収集する"
      className="mt-0.5 -mb-1 inline-flex min-h-[44px] items-center gap-1 px-1 text-[11px] font-medium text-[#8E8E93] transition hover:text-[#0A84FF]"
    >
      <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
      収集する
    </button>
  );
}

function Bubble({
  role,
  name,
  text,
}: {
  role: "student" | "patient";
  name: string;
  text: string;
}) {
  const isStudent = role === "student";
  return (
    <div
      className={[
        "max-w-[78%] rounded-2xl px-3.5 py-2.5",
        isStudent
          ? "bg-[#0A84FF] text-white"
          : "border border-[#EBEBF0] bg-white text-[#1D1D1F]",
      ].join(" ")}
    >
      <p
        className={[
          "mb-0.5 text-[10.5px] font-medium",
          isStudent ? "text-white/70" : "text-[#8E8E93]",
        ].join(" ")}
      >
        {name}
      </p>
      <p className="text-[13px] leading-relaxed">{text}</p>
    </div>
  );
}
