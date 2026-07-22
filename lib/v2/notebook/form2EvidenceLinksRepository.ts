import "server-only";

// Compass Version2 — Learning Layer (Sprint D-2B)
// form2_evidence_links への純粋なDBアクセス層（RLS 準拠の serverClient を引数で受け取る）。
// 認可・検証・エラー分類は呼び出し側（Server Action）が担う。ここでは投げず {row(s),error} を返す。
//
// リンクは「関係」のため物理 DELETE を使う（information_cards / student_notes の論理削除とは異なる）。

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  FORM2_EVIDENCE_LINK_SELECT_COLUMNS,
  type Form2EvidenceLinkInsert,
  type Form2EvidenceLinkRow,
} from "./form2EvidenceLinkMapper";
import type { PgLikeError } from "./types";

interface RowResult {
  row: Form2EvidenceLinkRow | null;
  error: PgLikeError | null;
}

interface ListResult {
  rows: Form2EvidenceLinkRow[];
  error: PgLikeError | null;
}

// 自分（user_id + case_id）の根拠リンクを作成順で取得する。
export async function listLinksForCase(
  supabase: SupabaseClient,
  userId: string,
  caseId: string,
): Promise<ListResult> {
  const { data, error } = await supabase
    .from("form2_evidence_links")
    .select(FORM2_EVIDENCE_LINK_SELECT_COLUMNS)
    .eq("user_id", userId)
    .eq("case_id", caseId)
    .order("created_at", { ascending: true });
  return {
    rows: (data as Form2EvidenceLinkRow[] | null) ?? [],
    error: error as PgLikeError | null,
  };
}

// 新規リンクを作成する。同一（form2_record_id, form2_field_key, evidence_id）の
// 二重作成は一意制約違反(23505)が返る（呼び出し側で duplicate を成功扱いにできる）。
export async function insertLink(
  supabase: SupabaseClient,
  values: Form2EvidenceLinkInsert,
): Promise<RowResult> {
  const { data, error } = await supabase
    .from("form2_evidence_links")
    .insert(values)
    .select(FORM2_EVIDENCE_LINK_SELECT_COLUMNS)
    .maybeSingle();
  return {
    row: (data as Form2EvidenceLinkRow | null) ?? null,
    error: error as PgLikeError | null,
  };
}

// 自分の 1 リンクを物理削除する（user_id + id）。
export async function deleteLinkOwned(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<{ error: PgLikeError | null }> {
  const { error } = await supabase
    .from("form2_evidence_links")
    .delete()
    .eq("user_id", userId)
    .eq("id", id);
  return { error: error as PgLikeError | null };
}

// ある Evidence に紐づく自分のリンクをまとめて物理削除する（Evidence 解除時の後始末）。
export async function deleteLinksByEvidence(
  supabase: SupabaseClient,
  userId: string,
  caseId: string,
  evidenceId: string,
): Promise<{ error: PgLikeError | null }> {
  const { error } = await supabase
    .from("form2_evidence_links")
    .delete()
    .eq("user_id", userId)
    .eq("case_id", caseId)
    .eq("evidence_id", evidenceId);
  return { error: error as PgLikeError | null };
}
