/**
 * Form3 提出前の未入力チェック（カード正本）。
 * Final 2欄は見ない。
 */

import { getForm3PatternDefinition } from "@/lib/form3/form3PatternDefinitions";
import {
  FORM3_PATTERN_ORDER,
  type Form3PatternKey,
} from "@/lib/form3/form3Types";
import type { Form3DataV2 } from "@/lib/form3/v2/form3V2Types";

export type Form3MissingItem = {
  label: string;
  patternKey?: Form3PatternKey;
  kind: "student" | "information" | "assessment";
};

export type CollectForm3MissingOptions = {
  studentNumber?: string | null;
  studentName?: string | null;
};

export function collectForm3Missing(
  data: Form3DataV2,
  options: CollectForm3MissingOptions = {},
): Form3MissingItem[] {
  const missing: Form3MissingItem[] = [];

  if (!(options.studentNumber ?? "").trim()) {
    missing.push({ kind: "student", label: "学籍番号" });
  }
  if (!(options.studentName ?? "").trim()) {
    missing.push({ kind: "student", label: "学生氏名" });
  }

  for (const key of FORM3_PATTERN_ORDER) {
    const labelJa = getForm3PatternDefinition(key).labelJa;
    const hasInfo = data.informationCards.some(
      (c) =>
        c.status === "active" &&
        c.patternKeys.includes(key) &&
        c.content.trim().length > 0,
    );
    const hasAssess = data.assessmentCards.some(
      (c) =>
        c.status !== "archived" &&
        c.patternKey === key &&
        c.interpretation.trim().length > 0,
    );
    if (!hasInfo) {
      missing.push({
        kind: "information",
        patternKey: key,
        label: `${labelJa}：情報`,
      });
    }
    if (!hasAssess) {
      missing.push({
        kind: "assessment",
        patternKey: key,
        label: `${labelJa}：解釈・分析`,
      });
    }
  }

  return missing;
}
