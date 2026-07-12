"use client";

import {
  ArrowRight,
  BookOpen,
  Eye,
  HeartPulse,
  Lightbulb,
  LineChart,
  Pill,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import type { ChartTabId } from "@/lib/chartTabs";
import type { ChartFocus } from "@/lib/chartNav";
import type { Patient } from "@/lib/wardData";
import {
  type FacingConvoState,
  type RelatedResource,
  getCoachHint,
  requestHint,
  resourceToNav,
} from "@/lib/patientFacingData";

// Sprint10.8A（修正）: Compass Coach は右ペインの「補助ウィジェット」。
// 右ペインの主役は NoteZone（将来の情報整理ノート）で、Coach はその下にコンパクト表示する。
// 会話ロジック・ヒント段階・関連情報の出現条件は Sprint10.7 のまま（getCoachHint/requestHint/history）。
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
  const hint = getCoachHint(patient.id, state);
  const askForHint = () => onChange(requestHint(state));

  // Sprint10.7 では coach エントリが history に積まれ、チャット内に表示していた。
  // ここでは同じ history から関連情報だけを取り出し、右ペインに表示する（出現条件は不変）。
  const resourceGroups: RelatedResource[][] = state.history.flatMap((e) =>
    e.role === "coach" ? [e.resources] : [],
  );
  const hasResources = resourceGroups.length > 0;

  // 展開＝ヒント段階が進んだ／主ルート完了／関連情報あり。
  // それ以外は「ヒントを見る」だけのコンパクト表示（Sprint10.7 の遅延表示に追従）。
  const expanded = hint.done || state.hintLevel >= 1 || hasResources;

  return (
    <div className="flex flex-col border-t border-[#EBEBF0] bg-white">
      {/* ヘッダー（常時表示・コンパクト） */}
      <div className="flex items-center justify-between px-4 pt-2.5 pb-1.5">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-[#AF52DE]" strokeWidth={2} />
          <span className="text-[12px] font-semibold text-[#6B3FA0]">
            Compass Coach
          </span>
        </div>
        {!expanded && (
          <button
            type="button"
            onClick={askForHint}
            className="flex min-h-[44px] items-center gap-1 rounded-full px-2.5 text-[11.5px] font-semibold text-[#AF52DE] transition hover:text-[#8E3FBE]"
          >
            <Lightbulb className="h-3.5 w-3.5" strokeWidth={2} />
            ヒントを見る
          </button>
        )}
      </div>

      {expanded ? (
        // 展開時のみ内部スクロール（iPad で操作しやすいよう高さを抑える）。
        <div className="max-h-[190px] space-y-2.5 overflow-y-auto px-4 pb-3">
          <CoachHintBlock
            hint={hint}
            hintLevel={state.hintLevel}
            onAskHint={askForHint}
          />
          {resourceGroups.map((resources, i) => (
            <RelatedResourcesPanel
              key={i}
              resources={resources}
              onOpenChart={onOpenChart}
            />
          ))}
          <ReminderLine />
        </div>
      ) : (
        // 通常（コンパクト）状態：短い案内のみ。大きな空カードや長文は出さない。
        <p className="px-4 pb-2.5 text-[11px] leading-relaxed text-[#8E8E93]">
          必要なときにヒントを確認できます。
        </p>
      )}
    </div>
  );
}

// 展開時の Coach 支援本文。hintLevel 1=方向のみ／2=質問例まで。done=主ルート完了。
// 表示ロジックは Sprint10.7 の CoachHintStrip を踏襲（段階・遅延は変更しない）。
function CoachHintBlock({
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

  // hintLevel 0 だが関連情報などで展開されている場合：ヒントを見る導線を残す。
  if (hintLevel === 0) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-[#EBEBF0] bg-white px-3.5 py-2">
        <p className="text-[11.5px] leading-relaxed text-[#8E8E93]">
          困ったときはヒントを確認できます。
        </p>
        <button
          type="button"
          onClick={onAskHint}
          className="flex min-h-[44px] shrink-0 items-center gap-1 rounded-full px-2 text-[11.5px] font-semibold text-[#AF52DE] transition hover:text-[#8E3FBE]"
        >
          <Lightbulb className="h-3.5 w-3.5" strokeWidth={2} />
          ヒントを見る
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-2xl border border-[#E4DAF7] bg-[#F7F2FF] px-3.5 py-2.5">
      <div className="flex items-start gap-2">
        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#AF52DE]" strokeWidth={2} />
        <p className="text-[12.5px] leading-relaxed text-[#4A3A66]">
          {hint.direction}
        </p>
      </div>
      {hintLevel >= 2 && hint.example && (
        <p className="rounded-lg bg-white/70 px-2.5 py-1.5 text-[12px] leading-relaxed text-[#6B3FA0]">
          {hint.example}
        </p>
      )}
      {hintLevel < 2 && (
        <button
          type="button"
          onClick={onAskHint}
          className="flex min-h-[44px] w-full items-center justify-center gap-1 rounded-full bg-white/70 px-3 text-[12px] font-semibold text-[#AF52DE] transition hover:bg-white"
        >
          <Lightbulb className="h-3.5 w-3.5" strokeWidth={2} />
          もう少しヒント
        </button>
      )}
    </div>
  );
}

// 副次的な観察リマインダー（小さく控えめに・展開時のみ）。
function ReminderLine() {
  return (
    <div className="flex items-start gap-1.5 rounded-xl bg-[#F7F9FC] px-3 py-2">
      <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#8E8E93]" strokeWidth={1.75} />
      <p className="text-[11px] leading-relaxed text-[#8E8E93]">
        言葉だけでなく、表情・姿勢・視線にも注目してみましょう。
      </p>
    </div>
  );
}

// 患者発言に関連する情報一覧。学生がどれを見るか選択する（Sprint10.7 から移設）。
function RelatedResourcesPanel({
  resources,
  onOpenChart,
}: {
  resources: RelatedResource[];
  onOpenChart: (tab: ChartTabId, focus?: ChartFocus) => void;
}) {
  return (
    <div className="rounded-2xl border border-[#E4DAF7] bg-gradient-to-b from-[#F7F2FF] to-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <p className="text-[12px] leading-relaxed text-[#4A3A66]">
        患者さんの発言に関連する情報があります。
      </p>
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
