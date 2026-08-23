/**
 * Teacher Insight の Evidence を症例カタログへ解決する純関数。
 * 解決不能 ID があれば ok:false（画面は黙って欠落表示しない）。
 */

import { getForm3PatternDefinition } from "@/lib/form3/form3PatternDefinitions";
import type { Form3PatternKey } from "@/lib/form3/form3Types";
import type { GoldCanonicalInformationRef } from "@/lib/gold/types";
import type {
  TeacherInsightDocument,
  TeacherInsightHypothesis,
} from "./types";

export type ResolvedTeacherEvidence = {
  id: string;
  soType: "S" | "O";
  patternKey: Form3PatternKey;
  patternLabelJa: string;
  content: string;
};

export type ResolvedTeacherHypothesis = {
  hypothesis: TeacherInsightHypothesis;
  supportingEvidence: readonly ResolvedTeacherEvidence[];
};

export type ResolvedTeacherInsight = {
  document: TeacherInsightDocument;
  evidence: readonly ResolvedTeacherEvidence[];
  hypotheses: readonly ResolvedTeacherHypothesis[];
};

export type ResolveTeacherInsightsResult =
  | { ok: true; insights: readonly ResolvedTeacherInsight[] }
  | {
      ok: false;
      unresolvedIds: readonly string[];
      message: string;
    };

function resolveId(
  id: string,
  byId: ReadonlyMap<string, GoldCanonicalInformationRef>,
  unresolved: Set<string>,
): ResolvedTeacherEvidence | null {
  const ref = byId.get(id);
  if (!ref) {
    unresolved.add(id);
    return null;
  }
  return {
    id: ref.id,
    soType: ref.soType,
    patternKey: ref.primaryPatternKey,
    patternLabelJa: getForm3PatternDefinition(ref.primaryPatternKey).labelJa,
    content: ref.content,
  };
}

/**
 * 1件以上の Teacher Insight について、
 * evidenceInformationIds と仮説の supportingEvidenceIds をすべて解決する。
 */
export function resolveTeacherInsightsEvidence(
  documents: readonly TeacherInsightDocument[],
  catalog: readonly GoldCanonicalInformationRef[],
): ResolveTeacherInsightsResult {
  const byId = new Map(catalog.map((item) => [item.id, item]));
  const unresolved = new Set<string>();
  const insights: ResolvedTeacherInsight[] = [];

  for (const document of documents) {
    const evidence: ResolvedTeacherEvidence[] = [];
    for (const id of document.evidenceInformationIds) {
      const resolved = resolveId(id, byId, unresolved);
      if (resolved) evidence.push(resolved);
    }

    const hypotheses: ResolvedTeacherHypothesis[] = [];
    for (const hypothesis of document.hypotheses) {
      const supportingEvidence: ResolvedTeacherEvidence[] = [];
      for (const id of hypothesis.supportingEvidenceIds) {
        const resolved = resolveId(id, byId, unresolved);
        if (resolved) supportingEvidence.push(resolved);
      }
      hypotheses.push({ hypothesis, supportingEvidence });
    }

    insights.push({ document, evidence, hypotheses });
  }

  if (unresolved.size > 0) {
    const ids = [...unresolved].sort();
    return {
      ok: false,
      unresolvedIds: ids,
      message: `unresolved teacher insight evidence ids: ${ids.join(", ")}`,
    };
  }

  return { ok: true, insights };
}
