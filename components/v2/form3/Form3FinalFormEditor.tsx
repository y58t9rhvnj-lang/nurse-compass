"use client";

import { FORM3_PATTERN_ORDER } from "@/lib/form3/form3Types";
import type { Form3PatternKey } from "@/lib/form3/form3Types";
import { getForm3PatternDefinition } from "@/lib/form3/form3PatternDefinitions";
import type { Form3FinalFormV2, Form3FinalPatternV2 } from "@/lib/form3/v2/form3V2Types";
import { createEmptyForm3FinalPattern } from "@/lib/form3/v2/form3V2Types";
import { form3PatternShortLabel } from "@/components/v2/form3/form3PhaseBLabels";

export type Form3FinalFormEditorProps = {
  finalForm: Form3FinalFormV2;
  onPatchPattern: (
    patternKey: Form3PatternKey,
    patch: Partial<Form3FinalPatternV2>,
  ) => void;
};

/**
 * Final Form Artifact（学校指定 2 欄のみ）。
 * 自動転記・AI・DnD・コピー導線なし。
 */
export default function Form3FinalFormEditor({
  finalForm,
  onPatchPattern,
}: Form3FinalFormEditorProps) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-28 pt-4 sm:px-6">
      <div>
        <h2 className="text-[22px] font-semibold tracking-tight text-[#1D1D1F]">
          Final Form
        </h2>
        <p className="mt-1 text-[15px] leading-relaxed text-[#6E6E73]">
          学校指定様式の Artifact です。Workspace を参照しながら、自分の言葉で書いてください。
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-[#8E8E93]">
          自動転記・AI生成・ドラッグコピーはありません。Information / Assessment
          の本文は入りません。
        </p>
      </div>

      <ul className="mt-8 flex flex-col gap-6">
        {FORM3_PATTERN_ORDER.map((key, index) => {
          const pattern =
            finalForm[key] ?? createEmptyForm3FinalPattern();
          const def = getForm3PatternDefinition(key);
          return (
            <li
              key={key}
              className="rounded-2xl bg-white px-5 py-5 shadow-sm ring-1 ring-[#E5E5EA]"
            >
              <p className="text-[13px] font-medium text-[#6E6E73]">
                Pattern {index + 1} · {form3PatternShortLabel(key)}
              </p>
              <h3 className="mt-1 text-[17px] font-semibold text-[#1D1D1F]">
                {def.labelJa}
              </h3>

              <label className="mt-5 block">
                <span className="text-[13px] font-medium text-[#1D1D1F]">
                  情報（Ｓ・Ｏ）
                </span>
                <textarea
                  className="mt-2 min-h-[120px] w-full resize-y rounded-2xl border-0 bg-[#F2F2F7] px-4 py-3 text-[16px] leading-relaxed text-[#1D1D1F] outline-none focus:ring-1 focus:ring-[#0A6CD6]"
                  placeholder="このパターンについて、情報（S・O）を自分の言葉で書く"
                  value={pattern.informationSO}
                  onChange={(e) =>
                    onPatchPattern(key, { informationSO: e.target.value })
                  }
                />
              </label>

              <label className="mt-5 block">
                <span className="text-[13px] font-medium text-[#1D1D1F]">
                  解釈・分析・援助の必要性
                </span>
                <textarea
                  className="mt-2 min-h-[140px] w-full resize-y rounded-2xl border-0 bg-[#F2F2F7] px-4 py-3 text-[16px] leading-relaxed text-[#1D1D1F] outline-none focus:ring-1 focus:ring-[#0A6CD6]"
                  placeholder="解釈・分析・援助の必要性を自分の言葉で書く"
                  value={pattern.interpretationAnalysisCareNeed}
                  onChange={(e) =>
                    onPatchPattern(key, {
                      interpretationAnalysisCareNeed: e.target.value,
                    })
                  }
                />
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
