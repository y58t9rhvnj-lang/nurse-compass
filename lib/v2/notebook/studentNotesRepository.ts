import "server-only";

// Compass Version2 — Compass Memo Supabase Integration (Phase 1)
// student_notes への純粋な DB アクセス層（RLS 準拠の serverClient を引数で受け取る）。
// 認可・検証・エラー分類は呼び出し側（Server Action）が担う。information_cards repository に合わせる。
//
// 重要:
//   ・有効メモの取得は必ず `.is('deleted_at', null)` を付与する（RLS では deleted_at を絞らない設計＝
//     migration 0009 §12.2。非表示はアプリ側フィルタの責務）。
//   ・更新・論理削除は expectedUpdatedAt による楽観ロック（id + user_id + deleted_at is null + updated_at 一致）。
//   ・revive（deleted_at を null へ戻す）と physical delete は実装しない。

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  STUDENT_NOTE_SELECT_COLUMNS,
  type StudentNoteInsert,
  type StudentNoteRow,
} from "./studentNoteMapper";
import type { PgLikeError } from "./types";

interface RowResult {
  row: StudentNoteRow | null;
  error: PgLikeError | null;
}

interface ListResult {
  rows: StudentNoteRow[];
  error: PgLikeError | null;
}

// 有効メモ（deleted_at is null）を更新日時の新しい順で取得する。
export async function listActiveNotes(
  supabase: SupabaseClient,
  userId: string,
  caseId: string,
): Promise<ListResult> {
  const { data, error } = await supabase
    .from("student_notes")
    .select(STUDENT_NOTE_SELECT_COLUMNS)
    .eq("user_id", userId)
    .eq("case_id", caseId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });
  return {
    rows: (data as StudentNoteRow[] | null) ?? [],
    error: error as PgLikeError | null,
  };
}

// 有効メモを id で 1 件取得（競合時の最新表示用）。論理削除済み・不在は null。
export async function getActiveNoteById(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<RowResult> {
  const { data, error } = await supabase
    .from("student_notes")
    .select(STUDENT_NOTE_SELECT_COLUMNS)
    .eq("user_id", userId)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  return { row: (data as StudentNoteRow | null) ?? null, error: error as PgLikeError | null };
}

// 新規メモを作成する。id 重複は一意制約違反(23505)が返る。
export async function insertNote(
  supabase: SupabaseClient,
  values: StudentNoteInsert,
): Promise<RowResult> {
  const { data, error } = await supabase
    .from("student_notes")
    .insert(values)
    .select(STUDENT_NOTE_SELECT_COLUMNS)
    .maybeSingle();
  return { row: (data as StudentNoteRow | null) ?? null, error: error as PgLikeError | null };
}

// 楽観ロック更新。id + user_id + deleted_at is null + updated_at 一致 の行のみ更新。
// 一致行が無ければ row=null（呼び出し側で conflict と判定）。
export async function updateNoteWithTimestamp(
  supabase: SupabaseClient,
  params: {
    userId: string;
    id: string;
    expectedUpdatedAt: string;
    update: Record<string, string>;
  },
): Promise<RowResult> {
  const { data, error } = await supabase
    .from("student_notes")
    .update(params.update)
    .eq("user_id", params.userId)
    .eq("id", params.id)
    .is("deleted_at", null)
    .eq("updated_at", params.expectedUpdatedAt)
    .select(STUDENT_NOTE_SELECT_COLUMNS)
    .maybeSingle();
  return { row: (data as StudentNoteRow | null) ?? null, error: error as PgLikeError | null };
}

// 論理削除（deleted_at = now()）。楽観ロック条件は update と同じ。
// USING が deleted_at is null に限定されるため、論理削除済み行は対象外＝revive は成立しない。
export async function softDeleteNote(
  supabase: SupabaseClient,
  params: { userId: string; id: string; expectedUpdatedAt: string },
): Promise<RowResult> {
  const { data, error } = await supabase
    .from("student_notes")
    .update({ deleted_at: new Date().toISOString() })
    .eq("user_id", params.userId)
    .eq("id", params.id)
    .is("deleted_at", null)
    .eq("updated_at", params.expectedUpdatedAt)
    .select(STUDENT_NOTE_SELECT_COLUMNS)
    .maybeSingle();
  return { row: (data as StudentNoteRow | null) ?? null, error: error as PgLikeError | null };
}
