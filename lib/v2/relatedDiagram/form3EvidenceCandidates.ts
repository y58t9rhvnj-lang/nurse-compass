/**
 * Form3 Assessment evidence candidates for Related Diagram.
 * Candidates are provenance, not Connections.
 * Match by Form3 Information ID only — never by card text.
 */

import {
  form3InformationOriginKey,
  type RelatedDiagramForm3InformationSource,
} from "./form3AssessmentReadModel";
import { originKeyFromCardSource } from "./form3ToUnderstandingCard";
import type {
  RelatedDiagramCardSource,
  RelatedDiagramSemanticGraph,
} from "./types";

export type Form3EvidenceCandidateStatus =
  | "available"
  | "already_present"
  | "missing";

export type Form3EvidenceCandidateRow = {
  informationId: string;
  originKey: string | null;
  informationSource: RelatedDiagramForm3InformationSource | null;
  canvasCardId: string | null;
  status: Form3EvidenceCandidateStatus;
};

export function candidateEvidenceIdsFromSource(
  source: RelatedDiagramCardSource | null | undefined,
): string[] {
  return source?.candidateEvidenceInformationIds
    ? [...source.candidateEvidenceInformationIds]
    : [];
}

export function deriveForm3EvidenceCandidates(input: {
  form3RecordId: string;
  candidateEvidenceInformationIds: readonly string[];
  informations: readonly RelatedDiagramForm3InformationSource[];
  graph: RelatedDiagramSemanticGraph;
}): {
  candidates: Form3EvidenceCandidateRow[];
  available: Form3EvidenceCandidateRow[];
  alreadyPresent: Form3EvidenceCandidateRow[];
  missing: Form3EvidenceCandidateRow[];
} {
  const infoById = new Map(
    input.informations.map((row) => [row.informationId, row]),
  );
  const canvasByOrigin = new Map<string, string>();
  for (const source of input.graph.cardSources) {
    if (source.sourceType !== "form3_information_card") continue;
    const key = originKeyFromCardSource(source);
    if (key) canvasByOrigin.set(key, source.cardId);
  }

  const candidates: Form3EvidenceCandidateRow[] = [];
  for (const informationId of input.candidateEvidenceInformationIds) {
    const informationSource = infoById.get(informationId) ?? null;
    const originKey = informationSource
      ? form3InformationOriginKey({
          form3RecordId: informationSource.form3RecordId,
          informationId,
        })
      : form3InformationOriginKey({
          form3RecordId: input.form3RecordId,
          informationId,
        });
    const canvasCardId = canvasByOrigin.get(originKey) ?? null;
    let status: Form3EvidenceCandidateStatus;
    if (!informationSource) status = "missing";
    else if (canvasCardId) status = "already_present";
    else status = "available";
    candidates.push({
      informationId,
      originKey,
      informationSource,
      canvasCardId,
      status,
    });
  }

  return {
    candidates,
    available: candidates.filter((row) => row.status === "available"),
    alreadyPresent: candidates.filter((row) => row.status === "already_present"),
    missing: candidates.filter((row) => row.status === "missing"),
  };
}
