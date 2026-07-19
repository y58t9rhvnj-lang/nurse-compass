"use client";

// Compass Version2 — 学生導線の「患者トップ」（受け持ち対象の入口）。
//
// 役割: 受け持ち患者の基本情報を静かに示し、電子カルテ・会話・様式2 への入口を提供する。
//   ここでは診断・アセスメント・答えは提示しない（学生が自分で確認・整理するための入口）。
// 共通 AppShell（mode="v2"）のメイン領域に表示する純表示コンポーネント。

import { ClipboardList, FileText, MessagesSquare } from "lucide-react";
import type { Patient } from "@/lib/wardData";

export default function StudentPatientTop({
  patient,
  onOpenChart,
  onOpenConversation,
  onOpenForm2,
}: {
  patient: Patient;
  onOpenChart: () => void;
  onOpenConversation: () => void;
  onOpenForm2: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-[820px] px-5 py-6 sm:px-6">
      <header className="rounded-3xl border border-[#EBEBF0] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <p className="text-[12px] font-medium text-[#8E8E93]">受け持ち対象</p>
        <h1 className="mt-0.5 text-[22px] font-bold text-[#1D1D1F]">
          {patient.name}
        </h1>
        <p className="mt-1 text-[13px] text-[#6E6E73]">
          {patient.room}号室 ・ {patient.age}歳
        </p>
        <p className="mt-3 text-[12.5px] leading-relaxed text-[#8E8E93]">
          ここは、あなたが患者さんを理解していくための入口です。
          電子カルテを読み、患者さんの話を聴き、様式2へ整理していきましょう。
        </p>
      </header>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <TopLink
          icon={<FileText className="h-5 w-5 text-[#0A6CD6]" strokeWidth={1.9} />}
          title="電子カルテ"
          desc="記録・処方・検査を確認する"
          onClick={onOpenChart}
        />
        <TopLink
          icon={
            <MessagesSquare
              className="h-5 w-5 text-[#0A6CD6]"
              strokeWidth={1.9}
            />
          }
          title="患者との会話"
          desc="患者さんの語りを聴く"
          onClick={onOpenConversation}
        />
        <TopLink
          icon={
            <ClipboardList
              className="h-5 w-5 text-[#0A6CD6]"
              strokeWidth={1.9}
            />
          }
          title="様式2"
          desc="受け持ち対象記録を整理する"
          onClick={onOpenForm2}
        />
      </div>
    </div>
  );
}

function TopLink({
  icon,
  title,
  desc,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[44px] flex-col items-start gap-1.5 rounded-2xl border border-[#EBEBF0] bg-white p-4 text-left transition hover:border-[#0A84FF] hover:bg-[#F7FAFF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A84FF]/40"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F2F2F7]">
        {icon}
      </span>
      <span className="text-[14px] font-semibold text-[#1D1D1F]">{title}</span>
      <span className="text-[12px] leading-relaxed text-[#8E8E93]">{desc}</span>
    </button>
  );
}
