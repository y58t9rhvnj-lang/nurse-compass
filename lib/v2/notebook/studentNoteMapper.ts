// Compass Version2 — Compass Memo Supabase Integration (Phase 1)
// Note（Compassメモ）⇄ student_notes 行 の変換。information_cards のマッパー方針に合わせる。
//
// 方針:
//   ・UI ドメイン型 `Note`（`lib/notes.ts`）は変更しない。createdAt/updatedAt は epoch ms。
//   ・DB（student_notes）の created_at/updated_at は timestamptz（ISO 文字列）。本層で ISO ⇔ epoch(ms) を変換する。
//   ・`id` はクライアント生成の text PK をそのまま維持する（Evidence の source_reference.id 互換のため）。
//     migration 0009 の想定どおり uuid 型にはしない。
//   ・書き込み時、user_id / organization_id / academic_year / case_id / patient_id はサーバが決定し、
//     クライアント値は使わない（case_id は caseIdForPatient で解決した値）。
//   ・楽観ロック（information_cards と同様）に使うため、UI 向け Note とは別に
//     DB の生 updated_at(ISO) を保持する DTO `StudentNoteRecord` を用意する
//     （Note.updatedAt は ms へ丸めるため、そのままでは `.eq('updated_at', ...)` に使えない）。

import type { Note } from "@/lib/notes";
import type { ActionErrorKind } from "./types";

// student_notes の 1 行（select する列）。migration 0009 のスキーマと一致。
export interface StudentNoteRow {
  id: string;
  user_id: string;
  organization_id: string;
  academic_year: number;
  case_id: string;
  patient_id: string;
  content: string;
  created_at: string; // ISO (timestamptz)
  updated_at: string; // ISO (timestamptz)
  deleted_at: string | null;
}

// サーバが INSERT に渡す行。created_at/updated_at/deleted_at は DB 既定（now()/null）に任せる。
// id はクライアント生成値をそのまま含める（text PK）。
export interface StudentNoteInsert {
  id: string;
  user_id: string;
  organization_id: string;
  academic_year: number;
  case_id: string;
  patient_id: string;
  content: string;
}

// 書き込み時にサーバが決定する識別情報。
export interface StudentNoteServerContext {
  userId: string;
  organizationId: string;
  academicYear: number;
  caseId: string;
  patientId: string;
}

// repository / action が返す DTO。UI 向け Note（epoch ms）に加え、
// 楽観ロック用の生 updated_at(ISO, マイクロ秒精度) を保持する。
export interface StudentNoteRecord {
  note: Note;
  updatedAt: string; // DB の生 updated_at(ISO)。次回更新の expectedUpdatedAt に使う。
}

// ===== Result（Server Action 戻り値） =====
// information_cards の CardListResult / CardMutationResult と同一の判別ユニオン。
export type StudentNoteListResult =
  | { ok: true; data: StudentNoteRecord[] }
  | { ok: false; kind: Exclude<ActionErrorKind, "conflict">; message: string };

export type StudentNoteMutationResult =
  | { ok: true; data: StudentNoteRecord }
  | { ok: false; kind: "conflict"; message: string; latest: StudentNoteRecord | null }
  | { ok: false; kind: Exclude<ActionErrorKind, "conflict">; message: string };

// select する列（全カラム）。
export const STUDENT_NOTE_SELECT_COLUMNS =
  "id, user_id, organization_id, academic_year, case_id, patient_id, content, created_at, updated_at, deleted_at";

// ISO(timestamptz) → epoch ms。
function isoToEpochMs(iso: string): number {
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

// DB 行 → UI ドメイン Note。patientId は行の patient_id、text は content、時刻は epoch ms。
export function rowToNote(row: StudentNoteRow): Note {
  return {
    id: row.id,
    patientId: row.patient_id,
    text: row.content,
    createdAt: isoToEpochMs(row.created_at),
    updatedAt: isoToEpochMs(row.updated_at),
  };
}

// DB 行 → DTO（UI 向け Note ＋ 楽観ロック用の生 updated_at(ISO)）。
export function rowToStudentNoteRecord(row: StudentNoteRow): StudentNoteRecord {
  return { note: rowToNote(row), updatedAt: row.updated_at };
}

// 新規作成入力（クライアント）＋サーバコンテキスト → INSERT 行。
// id はクライアント生成値を維持。content は trim（DB CHECK btrim(content)<>'' と二重化）。
export function newStudentNoteToInsert(
  input: { id: string; text: string },
  ctx: StudentNoteServerContext,
): StudentNoteInsert {
  return {
    id: input.id,
    user_id: ctx.userId,
    organization_id: ctx.organizationId,
    academic_year: ctx.academicYear,
    case_id: ctx.caseId,
    patient_id: ctx.patientId,
    content: input.text.trim(),
  };
}

// 学生が更新できるのは content（本文）のみ。updated_at は DB トリガーが更新する。
// identity 系カラムは含めない（DB トリガー reject_immutable_columns でも担保）。
export function noteContentUpdate(text: string): { content: string } {
  return { content: text.trim() };
}
