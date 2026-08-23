/**
 * Form3 印刷／プレビュー用テキスト合成。
 * 正本は Information / Assessment カード。Final 2欄は使わない。
 * Evidence 本文は Assessment へ重複挿入しない。
 */

import type { Form3PatternKey } from "@/lib/form3/form3Types";
import type {
  Form3AssessmentCardV2,
  Form3DataV2,
  Form3InformationCardV2,
} from "@/lib/form3/v2/form3V2Types";

function sortInfo(cards: Form3InformationCardV2[]): Form3InformationCardV2[] {
  return [...cards].sort(
    (a, b) => a.order - b.order || a.id.localeCompare(b.id),
  );
}

function sortAssess(
  cards: Form3AssessmentCardV2[],
): Form3AssessmentCardV2[] {
  return [...cards].sort(
    (a, b) => a.order - b.order || a.id.localeCompare(b.id),
  );
}

/**
 * 印刷・プレビュー左列: 1 Information カード＝1 行。
 * `S：…` / `O：…` / `—：…` を改行のみで結合（読点・空白での連結はしない）。
 * 関連情報・Evidence 本文は含めない。
 */
export function composeForm3InformationPrintText(
  cards: Form3InformationCardV2[],
  patternKey: Form3PatternKey,
): string {
  const lines: string[] = [];
  for (const card of sortInfo(cards)) {
    if (card.status !== "active") continue;
    if (!card.patternKeys.includes(patternKey)) continue;
    // カード内改行は空白に正規化し、カード境界の \n と混同しない
    const body = card.content.trim().replace(/\s*\n+\s*/g, " ").trim();
    if (!body) continue;
    const prefix =
      card.soType === "O" ? "O" : card.soType === "S" ? "S" : "—";
    lines.push(`${prefix}：${body}`);
  }
  return lines.join("\n");
}

/** 印刷・プレビュー右列: Assessment 本文のみ（Evidence 本文は入れない） */
export function composeForm3AssessmentPrintText(
  cards: Form3AssessmentCardV2[],
  patternKey: Form3PatternKey,
): string {
  const parts: string[] = [];
  for (const card of sortAssess(cards)) {
    if (card.status === "archived") continue;
    if (card.patternKey !== patternKey) continue;
    const body = card.interpretation.trim();
    if (!body) continue;
    parts.push(body);
  }
  return parts.join("\n\n");
}

export type Form3PatternPrintTexts = {
  informationSO: string;
  interpretationAnalysisCareNeed: string;
};

export function composeForm3PatternPrintTexts(
  data: Form3DataV2,
  patternKey: Form3PatternKey,
): Form3PatternPrintTexts {
  return {
    informationSO: composeForm3InformationPrintText(
      data.informationCards,
      patternKey,
    ),
    interpretationAnalysisCareNeed: composeForm3AssessmentPrintText(
      data.assessmentCards,
      patternKey,
    ),
  };
}
