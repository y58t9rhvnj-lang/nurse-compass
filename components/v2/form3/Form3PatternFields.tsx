"use client";

import { useId } from "react";
import {
  FORM3_JUDGMENT_LABELS,
  FORM3_TEXT_FIELD_META,
} from "@/components/v2/form3/form3UiLabels";
import { form3JudgmentToneClass } from "@/components/v2/form3/form3UiModel";
import {
  FORM3_JUDGMENTS,
  type Form3PatternData,
  type Form3PatternKey,
} from "@/lib/form3/form3Types";
import type { Form3PatternField } from "@/lib/v2/notebook/form3HookLogic";
import type { Form3ReviewIssue } from "@/lib/form3/form3Validation";

export type Form3PatternFieldsProps = {
  patternKey: Form3PatternKey;
  pattern: Form3PatternData;
  reviewIssues: Form3ReviewIssue[];
  onFieldChange: (
    field: Form3PatternField,
    value: Form3PatternData[Form3PatternField],
  ) => void;
};

export default function Form3PatternFields({
  patternKey,
  pattern,
  reviewIssues,
  onFieldChange,
}: Form3PatternFieldsProps) {
  const judgmentGroupId = useId();
  const highlightAdditional =
    pattern.judgment === "insufficient_information";

  const issueNear = (field: "judgment" | "rationale" | "additional") => {
    if (field === "judgment" && reviewIssues.includes("judgment_required")) {
      return "判断を選択してください";
    }
    if (field === "rationale" && reviewIssues.includes("rationale_required")) {
      return "判断の根拠を記入してください";
    }
    if (
      field === "additional" &&
      reviewIssues.includes("additional_information_required")
    ) {
      return "情報不足のときは、追加で必要な情報を記入してください";
    }
    return null;
  };

  const textMetaByField = Object.fromEntries(
    FORM3_TEXT_FIELD_META.map((m) => [m.field, m]),
  ) as Record<(typeof FORM3_TEXT_FIELD_META)[number]["field"], (typeof FORM3_TEXT_FIELD_META)[number]>;

  const related = textMetaByField.relatedInformation;
  const interpretation = textMetaByField.interpretation;
  const cross = textMetaByField.crossPatternRelations;
  const rationale = textMetaByField.judgmentRationale;
  const additional = textMetaByField.additionalInformationNeeded;

  return (
    <div className="space-y-5">
      <TextAreaField
        id={`${patternKey}-relatedInformation`}
        label={related.label}
        hint={related.hint}
        placeholder={related.placeholder}
        value={pattern.relatedInformation}
        onChange={(v) => onFieldChange("relatedInformation", v)}
      />

      <TextAreaField
        id={`${patternKey}-interpretation`}
        label={interpretation.label}
        hint={interpretation.hint}
        placeholder={interpretation.placeholder}
        value={pattern.interpretation}
        onChange={(v) => onFieldChange("interpretation", v)}
      />

      <TextAreaField
        id={`${patternKey}-crossPatternRelations`}
        label={cross.label}
        hint={cross.hint}
        placeholder={cross.placeholder}
        value={pattern.crossPatternRelations}
        onChange={(v) => onFieldChange("crossPatternRelations", v)}
      />

      <fieldset className="space-y-2">
        <legend
          id={judgmentGroupId}
          className="text-[13px] font-semibold text-[#1D1D1F]"
        >
          判断
        </legend>
        <p className="text-[12px] leading-relaxed text-[#6E6E73]">
          いまの理解として、最も近いものを選びます。答えの確定ではなく、考えるための選択です。
        </p>
        <div
          role="radiogroup"
          aria-labelledby={judgmentGroupId}
          className="grid gap-2 sm:grid-cols-1"
        >
          {FORM3_JUDGMENTS.map((judgment) => {
            const selected = pattern.judgment === judgment;
            return (
              <button
                key={judgment}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onFieldChange("judgment", judgment)}
                className={[
                  "flex min-h-[44px] w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-[13px] font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A84FF]",
                  form3JudgmentToneClass(judgment, selected),
                ].join(" ")}
              >
                <span
                  aria-hidden
                  className={[
                    "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px]",
                    selected
                      ? "border-current bg-current/10"
                      : "border-current/40",
                  ].join(" ")}
                >
                  {selected ? "●" : ""}
                </span>
                <span>{FORM3_JUDGMENT_LABELS[judgment]}</span>
              </button>
            );
          })}
        </div>
        {issueNear("judgment") ? (
          <p className="text-[12px] font-medium text-[#C0392B]" role="alert">
            {issueNear("judgment")}
          </p>
        ) : null}
      </fieldset>

      <TextAreaField
        id={`${patternKey}-judgmentRationale`}
        label={rationale.label}
        hint={rationale.hint}
        placeholder={rationale.placeholder}
        value={pattern.judgmentRationale}
        onChange={(v) => onFieldChange("judgmentRationale", v)}
        error={issueNear("rationale")}
      />

      <div
        className={
          highlightAdditional
            ? "rounded-xl border border-[#C7C7CC] bg-[#F2F2F7] p-3"
            : undefined
        }
      >
        {highlightAdditional ? (
          <p className="mb-2 text-[12px] font-medium text-[#48484A]">
            「情報不足で判断できない」を選んだときは、この欄が特に重要です。
          </p>
        ) : null}
        <TextAreaField
          id={`${patternKey}-additionalInformationNeeded`}
          label={additional.label}
          hint={additional.hint}
          placeholder={additional.placeholder}
          value={pattern.additionalInformationNeeded}
          onChange={(v) => onFieldChange("additionalInformationNeeded", v)}
          error={issueNear("additional")}
        />
      </div>
    </div>
  );
}

function TextAreaField({
  id,
  label,
  hint,
  placeholder,
  value,
  onChange,
  error,
}: {
  id: string;
  label: string;
  hint: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
}) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[13px] font-semibold text-[#1D1D1F]">
        {label}
      </label>
      <p id={hintId} className="text-[12px] leading-relaxed text-[#6E6E73]">
        {hint}
      </p>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => {
          // iPad: キーボードで欄が隠れないよう、フォーカス時に中央付近へ寄せる
          window.setTimeout(() => {
            e.target.scrollIntoView({ block: "center", behavior: "smooth" });
          }, 50);
        }}
        placeholder={placeholder}
        rows={4}
        aria-describedby={error ? `${hintId} ${errorId}` : hintId}
        aria-invalid={error ? true : undefined}
        className="min-h-[96px] w-full max-w-full resize-y break-words whitespace-pre-wrap rounded-xl border border-[#D9D9E0] bg-white px-3 py-2.5 text-[14px] leading-relaxed text-[#1D1D1F] placeholder:text-[#AEAEB5] focus:border-[#0A84FF] focus:outline-none focus:ring-2 focus:ring-[#0A84FF]/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A84FF]"
      />
      {error ? (
        <p id={errorId} className="text-[12px] font-medium text-[#C0392B]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
