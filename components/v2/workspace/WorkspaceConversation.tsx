"use client";

// Compass Version2 — 思考ワークスペース左ペイン専用の「会話ビュー（簡略版）」。
//
// 目的（Sprint D-1 追加修正 ③）:
//   様式2 を整理するために会話履歴を参照しやすくする。表情・視線・姿勢などの状態表示や
//   補助演出を持たず、会話履歴の縦領域を最大化する。学生の発言・患者の発言・順序・
//   スクロール・継続入力のみを扱う。
//
// 重要:
//   ・Core 側の会話機能（FacingPatient）は変更しない。ここは「Workspace 内で表示する会話ビュー」の
//     簡略版であり、会話ロジック（advanceConversation）は既存関数をそのまま再利用する。
//   ・会話状態（history 等）は上位（AppShell）が患者別に保持する facingState を共有する。
//     本コンポーネントは常時 mount（Form2Workspace が CSS で可視切替）されるため、
//     会話タブから離れて戻ってもスクロール位置・履歴を保持する。

import { useEffect, useRef, useState } from "react";
import { MessagesSquare, Send } from "lucide-react";
import type { Patient } from "@/lib/wardData";
import {
  type FacingConvoState,
  advanceConversation,
  getEntryId,
} from "@/lib/patientFacingData";

export default function WorkspaceConversation({
  patient,
  state,
  onChange,
}: {
  patient: Patient;
  state: FacingConvoState;
  onChange: (next: FacingConvoState) => void;
}) {
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
    <div className="flex h-full flex-col gap-2 px-3 py-3">
      {/* 会話履歴（主役・縦方向を最大化）。学生／患者の発言と順序のみ。 */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-2xl border border-[#EBEBF0] bg-[#F7F9FC] p-3"
      >
        {state.history.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <MessagesSquare className="h-7 w-7 text-[#C7C7CC]" strokeWidth={1.5} />
            <p className="text-[12.5px] font-medium text-[#8E8E93]">
              話しかけてみましょう
            </p>
            <p className="max-w-[220px] text-[11px] leading-relaxed text-[#AEAEB5]">
              患者さんは、あなたが声をかけると答えてくれます。まずは挨拶から。
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {state.history.map((item, i) => {
              if (item.role === "coach") return null;
              const isStudent = item.role === "student";
              const entryId = getEntryId(patient.id, item, i);
              return (
                <li
                  key={entryId}
                  className={isStudent ? "flex justify-end" : "flex justify-start"}
                >
                  <Bubble
                    role={isStudent ? "student" : "patient"}
                    name={isStudent ? "学生" : patient.name}
                    text={item.text}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* 継続入力（固定） */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
        className="flex shrink-0 items-center gap-2"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="患者さんに話しかける…"
          aria-label="患者さんに話しかける"
          className="min-h-[40px] flex-1 rounded-full border border-[#E5E5EA] bg-white px-3.5 text-[13px] text-[#1D1D1F] outline-none transition focus:border-[#0A84FF]"
        />
        <button
          type="submit"
          disabled={draft.trim() === ""}
          className="flex min-h-[40px] items-center gap-1.5 rounded-full bg-[#0A84FF] px-3.5 text-[13px] font-semibold text-white transition hover:bg-[#0A6CD6] disabled:opacity-40"
        >
          <Send className="h-4 w-4" strokeWidth={2} />
          送信
        </button>
      </form>
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
        "max-w-[85%] rounded-2xl px-3 py-2",
        isStudent
          ? "bg-[#0A84FF] text-white"
          : "border border-[#EBEBF0] bg-white text-[#1D1D1F]",
      ].join(" ")}
    >
      <p
        className={[
          "mb-0.5 text-[10px] font-medium",
          isStudent ? "text-white/70" : "text-[#8E8E93]",
        ].join(" ")}
      >
        {name}
      </p>
      <p className="whitespace-pre-line text-[12.5px] leading-relaxed">{text}</p>
    </div>
  );
}
