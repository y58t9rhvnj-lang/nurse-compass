"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, MessagesSquare, Send } from "lucide-react";
import type { Patient } from "@/lib/wardData";
import {
  type FacingConvoState,
  advanceConversation,
  getObservation,
} from "@/lib/patientFacingData";
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
}: {
  patient: Patient;
  onBack: () => void;
  state: FacingConvoState;
  onChange: (next: FacingConvoState) => void;
}) {
  const observation = getObservation(patient.id);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

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
        <button
          type="button"
          onClick={onBack}
          className="flex min-h-[44px] w-fit items-center gap-1 rounded-full bg-white px-4 py-2 text-[13px] font-medium text-[#0A84FF] shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:bg-[#F2F7FF]"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={2} />
          病棟へ戻る
        </button>
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
              return (
                <li
                  key={i}
                  className={isStudent ? "flex justify-end" : "flex justify-start"}
                >
                  <Bubble
                    role={item.role}
                    name={isStudent ? "学生" : patient.name}
                    text={item.text}
                  />
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
    </div>
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
