import "server-only";

// Compass Version2.1 — Form3 Day 2
// form3_records への純粋な DB アクセス層（RLS 準拠の serverClient を引数で受け取る）。
// 認可・検証・エラー分類は呼び出し側（Server Action）が担う。ここでは投げず {row,error} を返す。

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  FORM3_SELECT_COLUMNS,
  type Form3Row,
} from "./form3Mapper";
import type { PgLikeError } from "./types";

export interface Form3InsertValues {
  user_id: string;
  organization_id: string;
  academic_year: number;
  case_id: string;
  payload: unknown;
}

interface RepoResult {
  row: Form3Row | null;
  error: PgLikeError | null;
}

/** 自分の様式3（user_id + case_id）を1件取得する。 */
export async function getForm3(
  supabase: SupabaseClient,
  userId: string,
  caseId: string,
): Promise<RepoResult> {
  const { data, error } = await supabase
    .from("form3_records")
    .select(FORM3_SELECT_COLUMNS)
    .eq("user_id", userId)
    .eq("case_id", caseId)
    .maybeSingle();
  return {
    row: (data as Form3Row | null) ?? null,
    error: error as PgLikeError | null,
  };
}

/** 初回作成（version=1）。既存がある場合は一意制約違反(23505)が返る。 */
export async function insertForm3(
  supabase: SupabaseClient,
  values: Form3InsertValues,
): Promise<RepoResult> {
  const { data, error } = await supabase
    .from("form3_records")
    .insert({ ...values, version: 1 })
    .select(FORM3_SELECT_COLUMNS)
    .maybeSingle();
  return {
    row: (data as Form3Row | null) ?? null,
    error: error as PgLikeError | null,
  };
}

/**
 * 楽観ロック更新。version = expectedVersion の行のみ payload を更新し version を +1。
 * 一致行が無ければ row=null（呼び出し側で最新取得 → conflict）。
 */
export async function updateForm3WithVersion(
  supabase: SupabaseClient,
  params: {
    userId: string;
    caseId: string;
    expectedVersion: number;
    payload: unknown;
  },
): Promise<RepoResult> {
  const { data, error } = await supabase
    .from("form3_records")
    .update({
      payload: params.payload,
      version: params.expectedVersion + 1,
    })
    .eq("user_id", params.userId)
    .eq("case_id", params.caseId)
    .eq("version", params.expectedVersion)
    .select(FORM3_SELECT_COLUMNS)
    .maybeSingle();
  return {
    row: (data as Form3Row | null) ?? null,
    error: error as PgLikeError | null,
  };
}
