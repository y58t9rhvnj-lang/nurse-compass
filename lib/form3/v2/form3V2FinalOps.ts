// Form3 Phase B6 — Final Form（Artifact）操作（純関数・永続化なし）
// 自動転記・コピーはしない。学生が手で書いた値だけを更新する。
// Autosave は呼び出し側が markUserEditedV2 する。

import type { Form3PatternKey } from "../form3Types";
import type {
  Form3DataV2,
  Form3FinalFormV2,
  Form3FinalPatternV2,
} from "./form3V2Types";
import { createEmptyForm3FinalForm } from "./form3V2Types";

export type Form3FinalPatternPatch = Partial<{
  informationSO: string;
  interpretationAnalysisCareNeed: string;
}>;

function ensureFinalForm(data: Form3DataV2): Form3FinalFormV2 {
  if (data.finalForm && typeof data.finalForm === "object") {
    return data.finalForm;
  }
  return createEmptyForm3FinalForm();
}

/** 1 Pattern の Artifact 欄を更新（Core Card には触れない） */
export function updateForm3FinalPattern(
  data: Form3DataV2,
  patternKey: Form3PatternKey,
  patch: Form3FinalPatternPatch,
): Form3DataV2 {
  const finalForm = ensureFinalForm(data);
  const current: Form3FinalPatternV2 = finalForm[patternKey] ?? {
    informationSO: "",
    interpretationAnalysisCareNeed: "",
  };
  return {
    ...data,
    finalForm: {
      ...finalForm,
      [patternKey]: {
        informationSO:
          patch.informationSO !== undefined
            ? patch.informationSO
            : current.informationSO,
        interpretationAnalysisCareNeed:
          patch.interpretationAnalysisCareNeed !== undefined
            ? patch.interpretationAnalysisCareNeed
            : current.interpretationAnalysisCareNeed,
      },
    },
  };
}
