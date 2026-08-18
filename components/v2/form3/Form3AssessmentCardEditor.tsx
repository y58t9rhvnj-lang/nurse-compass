"use client";

import { FORM3_PATTERN_ORDER } from "@/lib/form3/form3Types";
import type { Form3Judgment, Form3PatternKey } from "@/lib/form3/form3Types";
import { FORM3_JUDGMENTS } from "@/lib/form3/form3Types";
import type {
  Form3AssessmentCardV2,
  Form3InformationCardV2,
} from "@/lib/form3/v2/form3V2Types";
import {
  FORM3_CLASSIFICATION_LABELS,
  form3PatternShortLabel,
} from "@/components/v2/form3/form3PhaseBLabels";

export type Form3AssessmentCardEditorProps = {
  card: Form3AssessmentCardV2;
  indexLabel: number;
  /** Evidence 候補（表示用）。選択は ID のみ保存。 */
  informationOptions: Form3InformationCardV2[];
  onChange: (patch: {
    interpretation?: string;
    classification?: Form3Judgment | null;
    evidenceInformationIds?: string[];
    needMoreInformation?: string;
    patternKey?: Form3PatternKey | null;
  }) => void;
  onArchive: () => void;
  onUnarchive: () => void;
};

export default function Form3AssessmentCardEditor({
  card,
  indexLabel,
  informationOptions,
  onChange,
  onArchive,
  onUnarchive,
}: Form3AssessmentCardEditorProps) {
  const archived = card.status === "archived";
  const selected = new Set(card.evidenceInformationIds);

  function toggleEvidence(infoId: string) {
    if (archived) return;
    const next = selected.has(infoId)
      ? card.evidenceInformationIds.filter((id) => id !== infoId)
      : [...card.evidenceInformationIds, infoId];
    onChange({ evidenceInformationIds: next });
  }

  return (
    <article
      className={`rounded-2xl bg-white px-5 py-5 shadow-sm ring-1 ring-[#E5E5EA] ${
        archived ? "opacity-70" : ""
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] font-medium text-[#6E6E73]">
          Assessment {indexLabel}
          {archived ? (
            <span className="ml-2 text-[12px] text-[#8E8E93]">（アーカイブ）</span>
          ) : null}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {archived ? (
            <button
              type="button"
              className="min-h-[44px] rounded-xl px-3 text-[14px] text-[#0A6CD6]"
              onClick={onUnarchive}
            >
              戻す
            </button>
          ) : (
            <button
              type="button"
              className="min-h-[44px] rounded-xl px-3 text-[14px] text-[#C0392B]"
              onClick={onArchive}
            >
              削除
            </button>
          )}
        </div>
      </div>

      <p className="mt-3 text-[13px] leading-relaxed text-[#8E8E93]">
        Assessment は解釈（Interpretation）です。看護問題名や援助計画ではありません。
      </p>

      <label className="mt-5 block">
        <span className="text-[13px] font-medium text-[#1D1D1F]">解釈</span>
        <textarea
          className="mt-2 min-h-[120px] w-full resize-y rounded-2xl border-0 bg-[#F2F2F7] px-4 py-3 text-[16px] leading-relaxed text-[#1D1D1F] outline-none ring-1 ring-transparent focus:ring-[#0A6CD6] disabled:opacity-60"
          placeholder="この根拠から、いまどう意味づけるか"
          value={card.interpretation}
          disabled={archived}
          onChange={(e) => onChange({ interpretation: e.target.value })}
        />
      </label>

      <div className="mt-5">
        <p className="text-[13px] font-medium text-[#1D1D1F]">Classification</p>
        <div className="mt-2 flex flex-col gap-2">
          <button
            type="button"
            disabled={archived}
            className={`min-h-[44px] rounded-2xl px-4 text-left text-[15px] ${
              card.classification === null
                ? "bg-[#1D1D1F] font-semibold text-white"
                : "bg-[#F2F2F7] text-[#1D1D1F]"
            }`}
            onClick={() => onChange({ classification: null })}
          >
            未設定
          </button>
          {FORM3_JUDGMENTS.map((j) => {
            const on = card.classification === j;
            return (
              <button
                key={j}
                type="button"
                disabled={archived}
                className={`min-h-[44px] rounded-2xl px-4 text-left text-[15px] ${
                  on
                    ? "bg-[#1D1D1F] font-semibold text-white"
                    : "bg-[#F2F2F7] text-[#1D1D1F]"
                }`}
                onClick={() => onChange({ classification: j })}
              >
                {FORM3_CLASSIFICATION_LABELS[j]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5">
        <p className="text-[13px] font-medium text-[#1D1D1F]">
          Evidence（Information を複数選択）
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-[#8E8E93]">
          本文はコピーしません。選択した Information の ID だけを根拠として保持します。
        </p>
        <p className="mt-2 text-[13px] text-[#6E6E73]">
          選択中: {card.evidenceInformationIds.length}件
        </p>
        {informationOptions.length === 0 ? (
          <p className="mt-3 rounded-2xl bg-[#F2F2F7] px-4 py-4 text-[14px] text-[#6E6E73]">
            先に Information Card を追加してください。
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {informationOptions.map((info, i) => {
              const checked = selected.has(info.id);
              const infoArchived = info.status === "archived";
              return (
                <li key={info.id}>
                  <label
                    className={`flex min-h-[52px] cursor-pointer items-start gap-3 rounded-2xl px-3 py-3 ${
                      checked ? "bg-[#E8F1FB] ring-1 ring-[#0A6CD6]/40" : "bg-[#F2F2F7]"
                    } ${infoArchived ? "opacity-60" : ""}`}
                  >
                    <input
                      type="checkbox"
                      className="mt-1 h-5 w-5 shrink-0 rounded border-[#C7C7CC]"
                      checked={checked}
                      disabled={archived}
                      onChange={() => toggleEvidence(info.id)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12px] font-medium text-[#8E8E93]">
                        事実 {i + 1}
                        {infoArchived ? " · アーカイブ" : ""}
                        {info.soType ? ` · ${info.soType}` : ""}
                      </span>
                      <span className="mt-1 block whitespace-pre-wrap text-[14px] leading-relaxed text-[#1D1D1F]">
                        {info.content.trim() || "（未入力）"}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <label className="mt-5 block">
        <span className="text-[13px] font-medium text-[#1D1D1F]">
          Need More Information
        </span>
        <textarea
          className="mt-2 min-h-[88px] w-full resize-y rounded-2xl border-0 bg-[#F2F2F7] px-4 py-3 text-[16px] leading-relaxed text-[#1D1D1F] outline-none focus:ring-1 focus:ring-[#0A6CD6] disabled:opacity-60"
          placeholder="まだ足りない情報があれば書く"
          value={card.needMoreInformation}
          disabled={archived}
          onChange={(e) => onChange({ needMoreInformation: e.target.value })}
        />
      </label>

      <div className="mt-5">
        <p className="text-[13px] font-medium text-[#1D1D1F]">
          関連パターン（任意・1つ）
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={archived}
            className={`min-h-[44px] rounded-full px-4 text-[14px] ${
              card.patternKey === null
                ? "bg-[#1D1D1F] text-white"
                : "bg-[#F2F2F7] text-[#1D1D1F]"
            }`}
            onClick={() => onChange({ patternKey: null })}
          >
            未設定
          </button>
          {FORM3_PATTERN_ORDER.map((key) => {
            const on = card.patternKey === key;
            return (
              <button
                key={key}
                type="button"
                disabled={archived}
                className={`min-h-[44px] rounded-full px-4 text-[14px] ${
                  on
                    ? "bg-[#1D1D1F] text-white"
                    : "bg-[#F2F2F7] text-[#1D1D1F]"
                }`}
                onClick={() => onChange({ patternKey: key })}
              >
                {form3PatternShortLabel(key)}
              </button>
            );
          })}
        </div>
      </div>
    </article>
  );
}
