/**
 * Student runtime integration boundary for Slice 2B-1.
 *
 * Production student Related Diagram remains read-only.
 * Unsaved editing / persistence is a later gate — not enabled here.
 * Callers that already loaded a Form3 v2 payload can map it to the
 * Related Diagram read model without writing Form3.
 */

import { mapUnknownForm3PayloadToReadModel } from "./form3AssessmentReadModel";
import type { MapForm3ReadModelResult } from "./form3AssessmentReadModel";

/** Production student route must stay read-only in Slice 2B-1. */
export const STUDENT_RELATED_DIAGRAM_UNSAVED_EDITING = false;

export function studentRelatedDiagramForm3ExpansionEnabled(): false {
  return false;
}

export function mapStudentForm3ToRelatedDiagramSources(input: {
  form3RecordId: string;
  sourceVersion: number;
  payload: unknown;
}): MapForm3ReadModelResult {
  return mapUnknownForm3PayloadToReadModel(input);
}
