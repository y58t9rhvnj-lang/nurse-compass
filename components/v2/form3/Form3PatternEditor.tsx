"use client";

import Form3PatternFields from "@/components/v2/form3/Form3PatternFields";
import Form3PatternGuide from "@/components/v2/form3/Form3PatternGuide";
import Form3ReviewToggle from "@/components/v2/form3/Form3ReviewToggle";
import { getForm3PatternDefinition } from "@/lib/form3/form3PatternDefinitions";
import {
  getForm3ThinkingPrompts,
  hasForm3ThinkingPrompts,
} from "@/lib/form3/form3ThinkingPrompts";
import type {
  Form3PatternData,
  Form3PatternKey,
} from "@/lib/form3/form3Types";
import type { Form3ReviewIssue } from "@/lib/form3/form3Validation";
import type { Form3PatternField } from "@/lib/v2/notebook/form3HookLogic";

export type Form3PatternEditorProps = {
  patternKey: Form3PatternKey;
  pattern: Form3PatternData;
  reviewIssues: Form3ReviewIssue[];
  onFieldChange: (
    field: Form3PatternField,
    value: Form3PatternData[Form3PatternField],
  ) => void;
  onMarkReviewed: () => { ok: true } | { ok: false; issues: Form3ReviewIssue[] };
  onUnmarkReviewed: () => void;
};

export default function Form3PatternEditor({
  patternKey,
  pattern,
  reviewIssues,
  onFieldChange,
  onMarkReviewed,
  onUnmarkReviewed,
}: Form3PatternEditorProps) {
  const definition = getForm3PatternDefinition(patternKey);
  const prompts = getForm3ThinkingPrompts(patternKey);

  return (
    <article className="mx-auto w-full max-w-3xl space-y-5 px-4 py-4 sm:px-5 sm:py-5">
      <header className="space-y-2">
        <p className="text-[11px] font-medium tracking-wide text-[#8E8E93]">
          選択中の健康パターン
        </p>
        <h2 className="text-[20px] font-semibold leading-snug text-[#1D1D1F] sm:text-[22px]">
          {definition.labelJa}
        </h2>
      </header>

      {hasForm3ThinkingPrompts(patternKey) ? (
        <section
          aria-label="考えるヒント"
          className="rounded-xl border border-[#E5E5EA] bg-white px-3.5 py-3"
        >
          <h3 className="text-[12px] font-semibold text-[#6E6E73]">
            考えるヒント
          </h3>
          <p className="mt-1 text-[12px] leading-relaxed text-[#8E8E93]">
            答えではありません。患者さんを見る入口として使ってください。
          </p>
          <ol className="mt-2.5 list-decimal space-y-2 pl-5 text-[13.5px] leading-relaxed text-[#3A3A3C]">
            {prompts.map((q) => (
              <li key={q} className="break-words">
                {q}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <Form3PatternGuide definition={definition} />

      <Form3PatternFields
        patternKey={patternKey}
        pattern={pattern}
        reviewIssues={reviewIssues}
        onFieldChange={onFieldChange}
      />

      <Form3ReviewToggle
        isReviewed={pattern.isReviewed}
        issues={reviewIssues}
        onMarkReviewed={onMarkReviewed}
        onUnmarkReviewed={onUnmarkReviewed}
      />
    </article>
  );
}
