"use client";

import {
  ArrowRight,
  BookOpen,
  Compass,
  Eye,
  HeartPulse,
  Lightbulb,
  LineChart,
  MessageCircle,
  Pill,
  ScrollText,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import type { ChartTabId } from "@/lib/chartTabs";
import type { ChartFocus } from "@/lib/chartNav";
import type { Patient } from "@/lib/wardData";
import {
  type FacingConvoState,
  type RelatedResource,
  getCoachFocus,
  getDisplayTopicResources,
  getResourceMessage,
  requestCoachConsultation,
  requestHint,
  resourceToNav,
  shouldShowCoachHint,
} from "@/lib/patientFacingData";

// Sprint10.8B: Compass Coach は右ペイン下部の補助ウィジェット。
// 既定は idle（相談ボタンのみ）。ヒントは相談・unknown・停滞・繰り返し時のみ表示。
// 関連情報は現在の意味ある話題の解放済み分だけ表示する。
export default function FacingCoachPanel({
  patient,
  state,
  onChange,
  onOpenChart,
}: {
  patient: Patient;
  state: FacingConvoState;
  onChange: (next: FacingConvoState) => void;
  onOpenChart: (tab: ChartTabId, focus?: ChartFocus) => void;
}) {
  const focus = getCoachFocus(patient.id, state);
  const showHint = shouldShowCoachHint(state);
  const topicResources = getDisplayTopicResources(state);
  const consult = () => onChange(requestCoachConsultation(state));
  const moreHint = () => onChange(requestHint(state));

  return (
    <div className="flex flex-col border-t border-[#EBEBF0] bg-white">
      <div className="flex items-center gap-1.5 px-4 pt-2.5 pb-1.5">
        <Sparkles className="h-3.5 w-3.5 text-[#AF52DE]" strokeWidth={2} />
        <span className="text-[12px] font-semibold text-[#6B3FA0]">
          Compass Coach
        </span>
      </div>

      <div className="max-h-[220px] space-y-2 overflow-y-auto px-4 pb-3">
        {showHint ? (
          <div className="space-y-2 rounded-2xl border border-[#E4DAF7] bg-[#F7F2FF] px-3.5 py-2.5">
            <p className="text-[12.5px] leading-relaxed text-[#4A3A66]">
              {focus.direction}
            </p>
            {state.hintLevel >= 2 && focus.example && (
              <p className="rounded-lg bg-white/70 px-2.5 py-1.5 text-[12px] leading-relaxed text-[#6B3FA0]">
                {focus.example}
              </p>
            )}
            {state.hintLevel === 1 && focus.example && (
              <button
                type="button"
                onClick={moreHint}
                className="flex min-h-[44px] items-center gap-1 text-[11.5px] font-semibold text-[#AF52DE] transition hover:text-[#8E3FBE]"
              >
                <Lightbulb className="h-3.5 w-3.5" strokeWidth={2} />
                もう少しヒント
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[11px] leading-relaxed text-[#8E8E93]">
              必要なときにCompass Coachへ相談できます。
            </p>
            <button
              type="button"
              onClick={consult}
              className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-full border border-[#E4DAF7] bg-[#F7F2FF] px-3 text-[12px] font-semibold text-[#AF52DE] transition hover:bg-[#F0E6FB]"
            >
              <MessageCircle className="h-3.5 w-3.5" strokeWidth={2} />
              Compass Coachに相談する
            </button>
          </div>
        )}

        {topicResources && (
          <RelatedResourcesPanel
            message={getResourceMessage(topicResources.topicId)}
            resources={topicResources.resources}
            onOpenChart={onOpenChart}
          />
        )}

        <div className="flex items-start gap-1.5 rounded-xl bg-[#F7F9FC] px-3 py-2">
          <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#8E8E93]" strokeWidth={1.75} />
          <p className="text-[11px] leading-relaxed text-[#8E8E93]">
            言葉だけでなく、表情・姿勢・視線にも注目してみましょう。
          </p>
        </div>
      </div>

      {/* Task 8: 指導者からの小さな固定メッセージ（常時・控えめ） */}
      <div className="flex items-start gap-1.5 border-t border-[#EBEBF0] bg-[#FBFAFF] px-4 py-2">
        <Compass className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#AF52DE]" strokeWidth={1.75} />
        <p className="text-[10.5px] leading-relaxed text-[#6E6E73]">
          一つの情報だけで結論を出さず、患者さんの言葉・生活歴・カルテをつなげて考えてみましょう。
        </p>
      </div>
    </div>
  );
}

function RelatedResourcesPanel({
  message,
  resources,
  onOpenChart,
}: {
  message: string;
  resources: RelatedResource[];
  onOpenChart: (tab: ChartTabId, focus?: ChartFocus) => void;
}) {
  return (
    <div className="rounded-2xl border border-[#E4DAF7] bg-gradient-to-b from-[#F7F2FF] to-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <p className="text-[12px] leading-relaxed text-[#4A3A66]">{message}</p>
      <p className="mt-0.5 text-[11px] font-medium text-[#8E8E93]">
        関連情報（{resources.length}件）
      </p>
      <ul className="mt-2 space-y-1.5">
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

const RESOURCE_ICON: Record<RelatedResource["type"], typeof Stethoscope> = {
  診療録: Stethoscope,
  看護記録: HeartPulse,
  フローシート: LineChart,
  処方: Pill,
  サマリー: ScrollText,
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
      className="flex min-h-[44px] w-full items-center gap-2.5 rounded-xl border border-[#EBEBF0] bg-white px-2.5 py-2 text-left transition hover:border-[#D1D1FF] hover:bg-[#FAFAFF]"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F2F2F7]">
        <Icon className="h-4 w-4 text-[#0A84FF]" strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10.5px] font-medium text-[#8E8E93]">
          {resource.type}
        </span>
        <span className="block truncate text-[12.5px] font-medium text-[#1D1D1F]">
          {resource.title}
        </span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-[#C7C7CC]" strokeWidth={2} />
    </button>
  );
}
