"use client";

// Compass Version2 — 学生導線の「患者トップ」中央エリア（受け持ち対象＝患者理解の入口）。
//
// 役割（Sprint D-1 追加修正2 ①）:
//   患者トップは 3 カラム（左メニュー / 中央 / 右学習支援）。本コンポーネントは中央エリアのみ。
//   Compassノート・Compass Coach は右カラム（CoreLayer 側の LearningSupportAside）へ移設した。
//
//   中央に表示するもの:
//     ・患者の基本情報のみ（氏名 / 年齢 / 性別 / 病室 / 入院日 / 主な診断名 / 受け持ち表示）。
//     ・主要導線: 思考ワークスペース / 電子カルテ / 会話（優先順位: ワークスペース→カルテ→会話。
//       ただしワークスペースだけを過度に強調しない）。
//
//   中央に表示しないもの:
//     ・観察ポイント / リスク / 学習目標 / 今日の予定 / 様式2 / Compassノート / Compass Coach。
//
//   スクロール: 画面高が不足しても中央エリア内で縦スクロールできる（ページ全体を不自然に伸ばさない）。

import { ClipboardList, FileText, MessagesSquare, Star } from "lucide-react";
import type { Patient } from "@/lib/wardData";

export default function StudentPatientTop({
  patient,
  onOpenChart,
  onOpenConversation,
  onOpenWorkspace,
}: {
  patient: Patient;
  onOpenChart: () => void;
  onOpenConversation: () => void;
  // 思考ワークスペース（情報を様式2 へ整理する場）を開く。患者トップの主導線。
  onOpenWorkspace: () => void;
}) {
  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <div className="mx-auto w-full max-w-[820px] px-5 py-6 sm:px-6">
        {/* 基本情報（のみ） */}
        <header className="rounded-3xl border border-[#EBEBF0] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-2">
            <p className="text-[12px] font-medium text-[#8E8E93]">受け持ち対象</p>
            {patient.mine && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF7E0] px-2 py-0.5 text-[10.5px] font-semibold text-[#B8860B]">
                <Star className="h-3 w-3" strokeWidth={2} fill="#FFB800" />
                受け持ち
              </span>
            )}
          </div>
          <h1 className="mt-0.5 text-[22px] font-bold text-[#1D1D1F]">
            {patient.name}
          </h1>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
            <InfoField label="年齢" value={`${patient.age}歳`} />
            <InfoField label="性別" value={patient.sex} />
            <InfoField label="病室" value={`${patient.room}号室`} />
            <InfoField label="入院日" value={patient.admit} />
            <InfoField label="主な診断名" value={patient.diagnosis} wide />
          </dl>
        </header>

        {/* 主要導線: 思考ワークスペース / 電子カルテ / 会話 */}
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <TopLink
            icon={
              <ClipboardList
                className="h-5 w-5 text-[#0A6CD6]"
                strokeWidth={1.9}
              />
            }
            title="思考ワークスペース"
            desc="集めた情報を様式2へ整理する"
            onClick={onOpenWorkspace}
            primary
          />
          <TopLink
            icon={
              <FileText className="h-5 w-5 text-[#0A6CD6]" strokeWidth={1.9} />
            }
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
            title="会話"
            desc="患者さんの語りを聴く"
            onClick={onOpenConversation}
          />
        </div>
      </div>
    </div>
  );
}

function InfoField({
  label,
  value,
  wide,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "col-span-2 sm:col-span-3" : ""}>
      <dt className="text-[11px] font-medium text-[#8E8E93]">{label}</dt>
      <dd className="mt-0.5 text-[13.5px] font-medium text-[#1D1D1F]">
        {value}
      </dd>
    </div>
  );
}

function TopLink({
  icon,
  title,
  desc,
  onClick,
  primary,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex min-h-[44px] flex-col items-start gap-1.5 rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A84FF]/40",
        primary
          ? "border-[#0A84FF] bg-[#F5FAFF] hover:bg-[#EAF3FF]"
          : "border-[#EBEBF0] bg-white hover:border-[#0A84FF] hover:bg-[#F7FAFF]",
      ].join(" ")}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F2F2F7]">
        {icon}
      </span>
      <span className="text-[14px] font-semibold text-[#1D1D1F]">{title}</span>
      <span className="text-[12px] leading-relaxed text-[#8E8E93]">{desc}</span>
    </button>
  );
}
