import "server-only";

// Compass Version2 β — Phase 3-2
// information_cards への純粋なDBアクセス層（RLS 準拠の serverClient を引数で受け取る）。
// 認可・検証・エラー分類は呼び出し側（Server Action）が担う。
// 解除は物理DELETEではなく deleted_at による論理削除（UPDATE）。

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CARD_SELECT_COLUMNS,
  type InformationCardInsert,
  type InformationCardRow,
} from "./informationCardMapper";
import type { PgLikeError } from "./types";

interface RowResult {
  row: InformationCardRow | null;
  error: PgLikeError | null;
}

interface ListResult {
  rows: InformationCardRow[];
  error: PgLikeError | null;
}

// 有効カード（deleted_at is null）を並び順で取得する。
export async function listActiveCards(
  supabase: SupabaseClient,
  userId: string,
  caseId: string,
): Promise<ListResult> {
  const { data, error } = await supabase
    .from("information_cards")
    .select(CARD_SELECT_COLUMNS)
    .eq("user_id", userId)
    .eq("case_id", caseId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  return {
    rows: (data as InformationCardRow[] | null) ?? [],
    error: error as PgLikeError | null,
  };
}

// 有効カードを id で1件取得（競合時の最新表示用）。論理削除済み・不在は null。
export async function getActiveCardById(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<RowResult> {
  const { data, error } = await supabase
    .from("information_cards")
    .select(CARD_SELECT_COLUMNS)
    .eq("user_id", userId)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  return { row: (data as InformationCardRow | null) ?? null, error: error as PgLikeError | null };
}

// 新規カードを作成する。同一出所の二重収集は一意制約違反(23505)が返る。
export async function insertCard(
  supabase: SupabaseClient,
  values: InformationCardInsert,
): Promise<RowResult> {
  const { data, error } = await supabase
    .from("information_cards")
    .insert(values)
    .select(CARD_SELECT_COLUMNS)
    .maybeSingle();
  return { row: (data as InformationCardRow | null) ?? null, error: error as PgLikeError | null };
}

// 楽観ロック更新。id + user_id + deleted_at is null + updated_at 一致 の行のみ更新。
// 一致行が無ければ row=null（呼び出し側で conflict と判定）。
export async function updateCardWithTimestamp(
  supabase: SupabaseClient,
  params: {
    userId: string;
    id: string;
    expectedUpdatedAt: string;
    update: Record<string, string | number>;
  },
): Promise<RowResult> {
  const { data, error } = await supabase
    .from("information_cards")
    .update(params.update)
    .eq("user_id", params.userId)
    .eq("id", params.id)
    .is("deleted_at", null)
    .eq("updated_at", params.expectedUpdatedAt)
    .select(CARD_SELECT_COLUMNS)
    .maybeSingle();
  return { row: (data as InformationCardRow | null) ?? null, error: error as PgLikeError | null };
}

// 論理削除（deleted_at = now()）。楽観ロック条件は update と同じ。
export async function softDeleteCard(
  supabase: SupabaseClient,
  params: { userId: string; id: string; expectedUpdatedAt: string },
): Promise<RowResult> {
  const { data, error } = await supabase
    .from("information_cards")
    .update({ deleted_at: new Date().toISOString() })
    .eq("user_id", params.userId)
    .eq("id", params.id)
    .is("deleted_at", null)
    .eq("updated_at", params.expectedUpdatedAt)
    .select(CARD_SELECT_COLUMNS)
    .maybeSingle();
  return { row: (data as InformationCardRow | null) ?? null, error: error as PgLikeError | null };
}
