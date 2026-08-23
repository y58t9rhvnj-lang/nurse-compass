/**
 * Teacher Insight の読み込み（純関数・server-only 非依存）。
 * 公開取得は access.ts 経由に限定する。
 */

import {
  catalogIdSetFromList,
  validateTeacherInsightDocument,
  validateTeacherInsightLibrary,
} from "./validation";
import type {
  TeacherInsightDocument,
  TeacherInsightLibraryValidationResult,
  TeacherInsightValidationResult,
} from "./types";

export function parseTeacherInsightDocument(
  raw: unknown,
  catalog: readonly { id: string }[],
  knownCtpIds?: ReadonlySet<string>,
): TeacherInsightValidationResult {
  return validateTeacherInsightDocument(
    raw,
    catalogIdSetFromList(catalog),
    knownCtpIds,
  );
}

export function parseTeacherInsightLibrary(
  documents: readonly unknown[],
  catalog: readonly { id: string }[],
  knownCtpIds?: ReadonlySet<string>,
): TeacherInsightLibraryValidationResult {
  return validateTeacherInsightLibrary(
    documents,
    catalogIdSetFromList(catalog),
    knownCtpIds,
  );
}

export type TeacherInsightQueryResult =
  | { ok: true; documents: readonly TeacherInsightDocument[] }
  | { ok: false; kind: "not_ready"; message: string; issues?: readonly string[] };
