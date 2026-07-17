import "server-only";

// Compass Version2 β — Phase 3-2
// form2_records への純粋なDBアクセス層（RLS 準拠の serverClient を引数で受け取る）。
// 認可・検証・エラー分類は呼び出し側（Server Action）が担う。ここでは投げず {row,error} を返す。

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  FORM2_SELECT_COLUMNS,
  type Form2Row,
} from "./form2Mapper";
import type { PgLikeError } from "./types";

export interface Form2InsertValues {
  user_id: string;
  organization_id: string;
  academic_year: number;
  case_id: string;
  payload: unknown;
}

interface RepoResult {
  row: Form2Row | null;
  error: PgLikeError | null;
}

// 自分の様式2（user_id + case_id で一意）を1件取得する。
export async function getForm2(
  supabase: SupabaseClient,
  userId: string,
  caseId: string,
): Promise<RepoResult> {
  const { data, error } = await supabase
    .from("form2_records")
    .select(FORM2_SELECT_COLUMNS)
    .eq("user_id", userId)
    .eq("case_id", caseId)
    .maybeSingle();
  return { row: (data as Form2Row | null) ?? null, error: error as PgLikeError | null };
}

// 初回作成（version=1）。既存がある場合は一意制約違反(23505)が返る。
export async function insertForm2(
  supabase: SupabaseClient,
  values: Form2InsertValues,
): Promise<RepoResult> {
  const { data, error } = await supabase
    .from("form2_records")
    .insert({ ...values, version: 1 })
    .select(FORM2_SELECT_COLUMNS)
    .maybeSingle();
  return { row: (data as Form2Row | null) ?? null, error: error as PgLikeError | null };
}

// 楽観ロック更新。version = expectedVersion の行のみ payload を更新し version を +1。
// 一致行が無ければ row=null（呼び出し側で conflict と判定）。
export async function updateForm2WithVersion(
  supabase: SupabaseClient,
  params: {
    userId: string;
    caseId: string;
    expectedVersion: number;
    payload: unknown;
  },
): Promise<RepoResult> {
  const { data, error } = await supabase
    .from("form2_records")
    .update({ payload: params.payload, version: params.expectedVersion + 1 })
    .eq("user_id", params.userId)
    .eq("case_id", params.caseId)
    .eq("version", params.expectedVersion)
    .select(FORM2_SELECT_COLUMNS)
    .maybeSingle();
  return { row: (data as Form2Row | null) ?? null, error: error as PgLikeError | null };
}
