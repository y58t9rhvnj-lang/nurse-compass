"use client";

import { FORM3_PATTERN_ORDER } from "@/lib/form3/form3Types";
import type { Form3PatternKey } from "@/lib/form3/form3Types";
import type {
  Form3InformationCardV2,
  Form3InformationSourceType,
  Form3SoType,
  Form3SourceReference,
} from "@/lib/form3/v2/form3V2Types";
import { FORM3_INFORMATION_SOURCE_TYPES } from "@/lib/form3/v2/form3V2Types";
import {
  FORM3_SOURCE_TYPE_LABELS,
  form3PatternShortLabel,
} from "@/components/v2/form3/form3PhaseBLabels";

export type Form3InformationCardEditorProps = {
  card: Form3InformationCardV2;
  indexLabel: number;
  totalVisible: number;
  onChange: (patch: {
    content?: string;
    soType?: Form3SoType | null;
    sourceType?: Form3InformationSourceType;
    sourceLabel?: string | null;
    sourceReference?: Form3SourceReference | null;
    patternKeys?: Form3PatternKey[];
  }) => void;
  onArchive: () => void;
  onUnarchive: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
};

export default function Form3InformationCardEditor({
  card,
  indexLabel,
  totalVisible,
  onChange,
  onArchive,
  onUnarchive,
  onMoveUp,
  onMoveDown,
}: Form3InformationCardEditorProps) {
  const archived = card.status === "archived";
  const canUp = indexLabel > 1;
  const canDown = indexLabel < totalVisible;

  function togglePattern(key: Form3PatternKey) {
    const has = card.patternKeys.includes(key);
    const next = has
      ? card.patternKeys.filter((k) => k !== key)
      : [...card.patternKeys, key];
    onChange({ patternKeys: next });
  }

  return (
    <article
      className={`rounded-2xl bg-white px-5 py-5 shadow-sm ring-1 ring-[#E5E5EA] ${
        archived ? "opacity-70" : ""
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] font-medium text-[#6E6E73]">
          事実 {indexLabel}
          {archived ? (
            <span className="ml-2 text-[12px] text-[#8E8E93]">（アーカイブ）</span>
          ) : null}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="min-h-[44px] min-w-[44px] rounded-xl px-3 text-[15px] text-[#1D1D1F] disabled:opacity-30"
            disabled={!canUp || archived}
            onClick={onMoveUp}
            aria-label="上へ移動"
          >
            ↑
          </button>
          <button
            type="button"
            className="min-h-[44px] min-w-[44px] rounded-xl px-3 text-[15px] text-[#1D1D1F] disabled:opacity-30"
            disabled={!canDown || archived}
            onClick={onMoveDown}
            aria-label="下へ移動"
          >
            ↓
          </button>
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

      <label className="mt-5 block">
        <span className="text-[13px] font-medium text-[#1D1D1F]">内容</span>
        <textarea
          className="mt-2 min-h-[140px] w-full resize-y rounded-2xl border-0 bg-[#F2F2F7] px-4 py-3 text-[16px] leading-relaxed text-[#1D1D1F] outline-none ring-1 ring-transparent focus:ring-[#0A6CD6] disabled:opacity-60"
          placeholder="患者から得た、ひとつの事実を書く"
          value={card.content}
          disabled={archived}
          onChange={(e) => onChange({ content: e.target.value })}
        />
      </label>

      <div className="mt-5">
        <p className="text-[13px] font-medium text-[#1D1D1F]">S / O</p>
        <div className="mt-2 inline-flex rounded-2xl bg-[#F2F2F7] p-1">
          {(
            [
              { value: null, label: "未設定" },
              { value: "S" as const, label: "S" },
              { value: "O" as const, label: "O" },
            ] as const
          ).map((opt) => {
            const selected = card.soType === opt.value;
            return (
              <button
                key={String(opt.value)}
                type="button"
                disabled={archived}
                className={`min-h-[44px] min-w-[72px] rounded-xl px-4 text-[15px] ${
                  selected
                    ? "bg-white font-semibold text-[#1D1D1F] shadow-sm"
                    : "text-[#6E6E73]"
                }`}
                onClick={() => onChange({ soType: opt.value })}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <label className="mt-5 block">
        <span className="text-[13px] font-medium text-[#1D1D1F]">情報源</span>
        <select
          className="mt-2 min-h-[48px] w-full rounded-2xl border-0 bg-[#F2F2F7] px-4 text-[16px] text-[#1D1D1F] outline-none focus:ring-1 focus:ring-[#0A6CD6] disabled:opacity-60"
          value={card.sourceType}
          disabled={archived}
          onChange={(e) =>
            onChange({
              sourceType: e.target.value as Form3InformationSourceType,
            })
          }
        >
          {FORM3_INFORMATION_SOURCE_TYPES.map((t) => (
            <option key={t} value={t}>
              {FORM3_SOURCE_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </label>

      <label className="mt-5 block">
        <span className="text-[13px] font-medium text-[#1D1D1F]">
          出所メモ（sourceLabel）
        </span>
        <input
          type="text"
          className="mt-2 min-h-[48px] w-full rounded-2xl border-0 bg-[#F2F2F7] px-4 text-[16px] text-[#1D1D1F] outline-none focus:ring-1 focus:ring-[#0A6CD6] disabled:opacity-60"
          placeholder="例: 看護記録 7/4 · 患者との会話"
          value={card.sourceLabel ?? ""}
          disabled={archived}
          onChange={(e) => {
            const value = e.target.value;
            const trimmed = value.trim();
            const ref = card.sourceReference;
            const isStructured =
              ref != null &&
              (ref.kind === "fixture" ||
                ref.kind === "db" ||
                ref.kind === "migration");

            // 構造化参照がある場合は label のみ更新（manual へ上書きしない）
            if (isStructured) {
              onChange({
                sourceLabel: trimmed === "" ? null : value,
              });
              return;
            }

            // 手入力のみ（未設定 / manual）: label に合わせて manual を維持
            onChange({
              sourceLabel: trimmed === "" ? null : value,
              sourceReference:
                trimmed === ""
                  ? null
                  : {
                      kind: "manual",
                      sourceType: card.sourceType,
                      note: trimmed,
                    },
            });
          }}
        />
        <span className="mt-2 block text-[12px] leading-relaxed text-[#8E8E93]">
          Patient Source から自動入力しません。参照しながら手で書いてください。
        </span>
      </label>

      <div className="mt-5">
        <p className="text-[13px] font-medium text-[#1D1D1F]">
          パターン（複数可）
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {FORM3_PATTERN_ORDER.map((key) => {
            const on = card.patternKeys.includes(key);
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
                onClick={() => togglePattern(key)}
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
