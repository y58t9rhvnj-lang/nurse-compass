"use client";

// Compass Version2 Sprint1 — Workspace 内 Compass Coach。
//
// 方針:
//   ・V1 の FacingCoachPanel は変更しない。Coach の「問いを返す」ロジック
//     （lib/patientFacingData の getCoachFocus / shouldShowCoachHint /
//     requestCoachConsultation / requestHint）を再利用する。
//   ・Workspace には電子カルテの各タブが存在しないため、FacingCoachPanel が持つ
//     「関連情報（チャート各タブへ遷移するリンク）」は表示しない。
//     遷移できないリンクや、暫定的な Timeline スクロール挙動は設けない。
//   ・Coach は問い（direction / example）のみを返す。アセスメント・正解・
//     Patient Story は書かない（DD: Coach は問いだけ）。

import { Compass, Eye, Lightbulb, MessageCircle, Sparkles } from "lucide-react";
import type { Patient } from "@/lib/wardData";
import {
  type FacingConvoState,
  getCoachFocus,
  requestCoachConsultation,
  requestHint,
  shouldShowCoachHint,
} from "@/lib/patientFacingData";

export default function WorkspaceCoachPanel({
  patient,
  state,
  onChange,
}: {
  patient: Patient;
  state: FacingConvoState;
  onChange: (next: FacingConvoState) => void;
}) {
  const focus = getCoachFocus(patient.id, state);
  const showHint = shouldShowCoachHint(state);
  const consult = () => onChange(requestCoachConsultation(state));
  const moreHint = () => onChange(requestHint(state));

  return (
    <div className="flex flex-col overflow-hidden rounded-3xl border border-[#EBEBF0] bg-white">
      <div className="flex items-center gap-1.5 px-4 pt-2.5 pb-1.5">
        <Sparkles className="h-3.5 w-3.5 text-[#AF52DE]" strokeWidth={2} />
        <span className="text-[12px] font-semibold text-[#6B3FA0]">
          Compass Coach
        </span>
      </div>

      <div className="space-y-2 px-4 pb-3">
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

        <div className="flex items-start gap-1.5 rounded-xl bg-[#F7F9FC] px-3 py-2">
          <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#8E8E93]" strokeWidth={1.75} />
          <p className="text-[11px] leading-relaxed text-[#8E8E93]">
            言葉だけでなく、表情・姿勢・視線にも注目してみましょう。
          </p>
        </div>
      </div>

      <div className="flex items-start gap-1.5 border-t border-[#EBEBF0] bg-[#FBFAFF] px-4 py-2">
        <Compass className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#AF52DE]" strokeWidth={1.75} />
        <p className="text-[10.5px] leading-relaxed text-[#6E6E73]">
          一つの情報だけで結論を出さず、患者さんの言葉・生活歴・カルテをつなげて考えてみましょう。
        </p>
      </div>
    </div>
  );
}
