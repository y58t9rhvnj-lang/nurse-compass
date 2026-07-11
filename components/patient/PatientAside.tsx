"use client";

import { ExternalLink, FileText, Inbox, PenLine, Sparkles } from "lucide-react";
import type { Patient } from "@/lib/wardData";
import PatientInfoCard from "./PatientInfoCard";

// 患者トップ右ペイン: Compass Coach の問い＋情報BOX/電子カルテ導線を中心に、
// 診断名など事務情報は補助（下部）に配置する。
// 患者別の問いが未入力の場合の汎用フォールバック。
const FALLBACK_QUESTIONS = [
  "この人が入院前に大切にしていた暮らしは？",
  "回復した先で、どんな一日を取り戻したいのだろう？",
  "今日の関わりで、安心を一つ増やせるとしたら？",
];

export default function PatientAside({
  patient,
  onLink,
  onUseQuestion,
}: {
  patient: Patient;
  onLink: (label: string) => void;
  onUseQuestion: (question: string) => void;
}) {
  const questions =
    patient.profile?.coachQuestions?.length
      ? patient.profile.coachQuestions
      : FALLBACK_QUESTIONS;
  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      {/* Compass Coach の問い */}
      <section className="rounded-2xl border border-[#E4DAF7] bg-gradient-to-b from-[#F7F2FF] to-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <div className="mb-2.5 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#AF52DE]/12">
            <Sparkles className="h-3.5 w-3.5 text-[#AF52DE]" strokeWidth={2} />
          </span>
          <h3 className="text-[13px] font-semibold text-[#1D1D1F]">
            Compass Coach の問い
          </h3>
        </div>
        <ul className="space-y-2">
          {questions.map((q) => (
            <li
              key={q}
              className="rounded-xl bg-white/80 px-3 py-2.5 text-[12.5px] leading-relaxed text-[#4A3A66]"
            >
              <p>{q}</p>
              <button
                type="button"
                onClick={() => onUseQuestion(q)}
                className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-[#AF52DE] transition hover:text-[#8E3FBE]"
              >
                <PenLine className="h-3.5 w-3.5" strokeWidth={2} />
                この問いをメモする
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* 導線 */}
      <section className="rounded-2xl border border-[#EBEBF0] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <h3 className="mb-2.5 text-[13px] font-semibold text-[#1D1D1F]">
          関連情報を開く
        </h3>
        <div className="space-y-2">
          <LinkButton
            icon={<Inbox className="h-4 w-4" strokeWidth={1.75} />}
            label="情報BOX"
            sub="申し送り・共有メモ"
            onClick={() => onLink("情報BOX")}
          />
          <LinkButton
            icon={<FileText className="h-4 w-4" strokeWidth={1.75} />}
            label="電子カルテ"
            sub={`${patient.name} の記録`}
            onClick={() => onLink("電子カルテ")}
          />
        </div>
      </section>

      {/* 補助情報 */}
      <PatientInfoCard patient={patient} />
    </div>
  );
}

function LinkButton({
  icon,
  label,
  sub,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-[#EBEBF0] bg-white px-3 py-2.5 text-left transition hover:bg-[#F7F7F9]"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F2F2F7] text-[#0A84FF]">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium text-[#1D1D1F]">
          {label}
        </span>
        <span className="block text-[11px] text-[#8E8E93]">{sub}</span>
      </span>
      <ExternalLink className="h-4 w-4 text-[#C7C7CC]" strokeWidth={1.75} />
    </button>
  );
}
