"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  ChevronLeft,
  HeartPulse,
  Lightbulb,
  LineChart,
  MessagesSquare,
  Pill,
  Send,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import type { ChartTabId } from "@/lib/chartTabs";
import type { ChartFocus } from "@/lib/chartNav";
import type { Patient } from "@/lib/wardData";
import {
  type FacingConvoState,
  type RelatedResource,
  advanceConversation,
  getCoachHint,
  getObservation,
  requestHint,
  resourceToNav,
} from "@/lib/patientFacingData";
import PatientPresence from "./PatientPresence";

// Sprint10.5「Coachによる患者対話ガイド」中央（対話式・制御コンポーネント）。
// 会話状態は親（AppShell）が患者別に保持するため、カルテ往復しても維持される。
// Coach は正解を出さず、第1段階（方向）→第2段階（質問例）で段階的に支援する。
export default function FacingPatient({
  patient,
  onBack,
  onOpenChart,
  state,
  onChange,
}: {
  patient: Patient;
  onBack: () => void;
  onOpenChart: (tab: ChartTabId, focus?: ChartFocus) => void;
  state: FacingConvoState;
  onChange: (next: FacingConvoState) => void;
}) {
  const observation = getObservation(patient.id);
  const hint = getCoachHint(patient.id, state);
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

  const askForHint = () => onChange(requestHint(state));

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

      {/* 中央：チャット（スクロール） */}
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
              患者さんは、あなたが声をかけると答えてくれます。下のヒントを参考に、まずは挨拶から。
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {state.history.map((item, i) => {
              if (item.role === "coach") {
                return (
                  <li key={i} className="flex justify-start">
                    <RelatedResourcesPanel
                      resources={item.resources}
                      onOpenChart={onOpenChart}
                    />
                  </li>
                );
              }
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

      {/* 下部：Coach ヒント（遅延・段階的）＋入力（固定） */}
      <div className="shrink-0 space-y-2">
        <CoachHintStrip
          hint={hint}
          hintLevel={state.hintLevel}
          onAskHint={askForHint}
        />
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

// 患者発言に関連する情報一覧。学生がどれを見るか選択する。
function RelatedResourcesPanel({
  resources,
  onOpenChart,
}: {
  resources: RelatedResource[];
  onOpenChart: (tab: ChartTabId, focus?: ChartFocus) => void;
}) {
  return (
    <div className="w-full max-w-[92%] rounded-2xl border border-[#E4DAF7] bg-gradient-to-b from-[#F7F2FF] to-white p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="mb-1 flex items-center gap-1.5">
        <Sparkles className="h-3.5 w-3.5 text-[#AF52DE]" strokeWidth={2} />
        <span className="text-[12px] font-semibold text-[#6B3FA0]">
          Compass Coach
        </span>
      </div>
      <p className="text-[12.5px] leading-relaxed text-[#4A3A66]">
        患者さんの発言に関連する情報があります。
      </p>
      <p className="mt-0.5 text-[11px] font-medium text-[#8E8E93]">
        関連情報（{resources.length}件）
      </p>
      <ul className="mt-2.5 space-y-1.5">
        {resources.map((res, i) => (
          <li key={i}>
            <ResourceCard
              resource={res}
              onOpen={() => {
                const { tab, focus } = resourceToNav(res);
                onOpenChart(tab, focus);
              }}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

const RESOURCE_ICON: Record<
  RelatedResource["type"],
  typeof Stethoscope
> = {
  診療録: Stethoscope,
  看護記録: HeartPulse,
  フローシート: LineChart,
  処方: Pill,
  生活歴: BookOpen,
};

function ResourceCard({
  resource,
  onOpen,
}: {
  resource: RelatedResource;
  onOpen: () => void;
}) {
  const Icon = RESOURCE_ICON[resource.type];
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-[44px] w-full items-center gap-3 rounded-xl border border-[#EBEBF0] bg-white px-3 py-2.5 text-left transition hover:border-[#D1D1FF] hover:bg-[#FAFAFF]"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F2F2F7]">
        <Icon className="h-4 w-4 text-[#0A84FF]" strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10.5px] font-medium text-[#8E8E93]">
          {resource.type}
        </span>
        <span className="block text-[13px] font-medium text-[#1D1D1F]">
          {resource.title}
        </span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-[#C7C7CC]" strokeWidth={2} />
    </button>
  );
}

// 入力欄の上の Coach 支援。序盤は控えめな案内のみ。
// hintLevel 0=控えめ（ボタンで要求可）／1=方向のみ／2=質問例まで。
function CoachHintStrip({
  hint,
  hintLevel,
  onAskHint,
}: {
  hint: ReturnType<typeof getCoachHint>;
  hintLevel: 0 | 1 | 2;
  onAskHint: () => void;
}) {
  if (hint.done) {
    return (
      <div className="flex items-start gap-2 rounded-2xl border border-[#E4DAF7] bg-[#F7F2FF] px-3.5 py-2.5">
        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#AF52DE]" strokeWidth={2} />
        <p className="text-[12.5px] leading-relaxed text-[#4A3A66]">
          {hint.direction}
        </p>
      </div>
    );
  }

  if (hintLevel === 0) {
    return (
      <div className="flex items-center justify-between rounded-2xl border border-[#EBEBF0] bg-white px-3.5 py-1.5">
        <p className="text-[11.5px] text-[#8E8E93]">
          困ったときはヒントを確認できます
        </p>
        <button
          type="button"
          onClick={onAskHint}
          className="flex min-h-[44px] items-center gap-1 rounded-full px-2.5 text-[11.5px] font-semibold text-[#AF52DE] transition hover:text-[#8E3FBE]"
        >
          <Lightbulb className="h-3.5 w-3.5" strokeWidth={2} />
          ヒントを見る
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#E4DAF7] bg-[#F7F2FF] px-3.5 py-2.5">
      <div className="flex items-start gap-2">
        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#AF52DE]" strokeWidth={2} />
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] font-semibold text-[#AF52DE]">Compass Coach</p>
          <p className="text-[12.5px] leading-relaxed text-[#4A3A66]">
            {hint.direction}
          </p>
          {hintLevel >= 2 && hint.example && (
            <p className="mt-1 rounded-lg bg-white/70 px-2.5 py-1.5 text-[12px] leading-relaxed text-[#6B3FA0]">
              {hint.example}
            </p>
          )}
        </div>
        {hintLevel < 2 && (
          <button
            type="button"
            onClick={onAskHint}
            className="flex min-h-[44px] shrink-0 items-center gap-1 rounded-full px-2.5 text-[11.5px] font-semibold text-[#AF52DE] transition hover:text-[#8E3FBE]"
          >
            <Lightbulb className="h-3.5 w-3.5" strokeWidth={2} />
            もう少しヒント
          </button>
        )}
      </div>
    </div>
  );
}
