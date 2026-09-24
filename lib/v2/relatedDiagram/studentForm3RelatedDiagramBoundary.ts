/**
 * Student runtime integration boundary for Slice 2B-1.
 *
 * Production student Related Diagram remains read-only.
 * Unsaved editing / persistence is a later gate — not enabled here.
 * Callers that already loaded a Form3 v2 payload can map it to the
 * Related Diagram read model without writing Form3.
 */

import {
  emptyForm3ReadModel,
  mapUnknownForm3PayloadToReadModel,
  type MapForm3ReadModelResult,
  type RelatedDiagramForm3ReadModel,
} from "./form3AssessmentReadModel";

/** Production student route must stay read-only in Slice 2B-1. */
export const STUDENT_RELATED_DIAGRAM_UNSAVED_EDITING = false;

export const STUDENT_RELATED_DIAGRAM_FORM3_PATIENT_ID = "A";

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

/** Production drawer source. Missing / invalid payload → empty, never a DEV fixture. */
export function studentForm3ReadModelFromRecord(input: {
  row: { id: string; version: number; payload: unknown } | null;
}): RelatedDiagramForm3ReadModel {
  if (!input.row) {
    return emptyForm3ReadModel({
      form3RecordId: "",
      sourceVersion: 0,
    });
  }
  const mapped = mapStudentForm3ToRelatedDiagramSources({
    form3RecordId: input.row.id,
    sourceVersion: input.row.version,
    payload: input.row.payload,
  });
  if (!mapped.ok) {
    return emptyForm3ReadModel({
      form3RecordId: input.row.id,
      sourceVersion: input.row.version,
    });
  }
  return mapped.model;
}
