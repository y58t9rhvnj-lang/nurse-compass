import "server-only";

// Compass Version2 — Learning Layer (Sprint D-3A)
// form2_field_reflections への純粋なDBアクセス層（RLS 準拠の serverClient を引数で受け取る）。
// 認可・検証・エラー分類は呼び出し側（Server Action）が担う。ここでは投げず {rows/row, error} を返す。

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  FORM2_FIELD_REFLECTION_SELECT_COLUMNS,
  type Form2FieldReflectionRow,
  type Form2FieldReflectionUpsert,
} from "./form2FieldReflectionMapper";
import type { PgLikeError } from "./types";

interface ListResult {
  rows: Form2FieldReflectionRow[];
  error: PgLikeError | null;
}

interface RowResult {
  row: Form2FieldReflectionRow | null;
  error: PgLikeError | null;
}

// 自分（user_id + case_id）の考察一覧を取得する（未作成なら空配列）。
export async function listForm2FieldReflections(
  supabase: SupabaseClient,
  userId: string,
  caseId: string,
): Promise<ListResult> {
  const { data, error } = await supabase
    .from("form2_field_reflections")
    .select(FORM2_FIELD_REFLECTION_SELECT_COLUMNS)
    .eq("user_id", userId)
    .eq("case_id", caseId);
  return {
    rows: (data as Form2FieldReflectionRow[] | null) ?? [],
    error: error as PgLikeError | null,
  };
}

// 考察を upsert する（学生 × ケース × 項目 で 1 件）。
//   ・onConflict は uq_form2_field_reflection_owner(user_id, case_id, form2_field_key)。
//   ・created_at は送らない（UPDATE 経路で不変トリガーに弾かれるのを避ける／DB 既定に任せる）。
//   ・updated_at は set_updated_at トリガーが更新する。
export async function upsertForm2FieldReflection(
  supabase: SupabaseClient,
  values: Form2FieldReflectionUpsert,
): Promise<RowResult> {
  const { data, error } = await supabase
    .from("form2_field_reflections")
    .upsert(values, { onConflict: "user_id,case_id,form2_field_key" })
    .select(FORM2_FIELD_REFLECTION_SELECT_COLUMNS)
    .maybeSingle();
  return {
    row: (data as Form2FieldReflectionRow | null) ?? null,
    error: error as PgLikeError | null,
  };
}
