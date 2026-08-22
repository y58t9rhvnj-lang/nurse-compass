/**
 * Gold Standard の Evidence を症例カタログへ解決する純関数。
 * 解決不能 ID があれば ok:false（画面は黙って欠落表示しない）。
 */

import { getForm3PatternDefinition } from "@/lib/form3/form3PatternDefinitions";
import type { Form3PatternKey } from "@/lib/form3/form3Types";
import type {
  GoldCanonicalInformationRef,
  GoldCriticalThinkingPoint,
  GoldStandardDocument,
} from "./types";

export type ResolvedGoldEvidence = {
  id: string;
  soType: "S" | "O";
  patternKey: Form3PatternKey;
  patternLabelJa: string;
  content: string;
};

export type ResolvedGoldCtp = {
  ctp: GoldCriticalThinkingPoint;
  evidence: readonly ResolvedGoldEvidence[];
};

export type ResolveGoldEvidenceResult =
  | { ok: true; points: readonly ResolvedGoldCtp[] }
  | { ok: false; unresolvedIds: readonly string[]; message: string };

export function resolveGoldEvidenceForDocument(
  document: GoldStandardDocument,
  catalog: readonly GoldCanonicalInformationRef[],
): ResolveGoldEvidenceResult {
  const byId = new Map(catalog.map((item) => [item.id, item]));
  const unresolved = new Set<string>();
  const points: ResolvedGoldCtp[] = [];

  for (const ctp of document.criticalThinkingPoints) {
    const evidence: ResolvedGoldEvidence[] = [];
    for (const id of ctp.evidenceInformationIds) {
      const ref = byId.get(id);
      if (!ref) {
        unresolved.add(id);
        continue;
      }
      evidence.push({
        id: ref.id,
        soType: ref.soType,
        patternKey: ref.primaryPatternKey,
        patternLabelJa: getForm3PatternDefinition(ref.primaryPatternKey).labelJa,
        content: ref.content,
      });
    }
    points.push({ ctp, evidence });
  }

  if (unresolved.size > 0) {
    const ids = [...unresolved].sort();
    return {
      ok: false,
      unresolvedIds: ids,
      message: `unresolved evidence Information ids: ${ids.join(", ")}`,
    };
  }

  return { ok: true, points };
}
