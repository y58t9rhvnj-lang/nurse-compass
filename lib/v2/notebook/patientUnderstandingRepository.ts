import "server-only";

// Compass Version2 — Learning Layer (Sprint D-2C)
// patient_understanding_records への純粋なDBアクセス層（RLS 準拠の serverClient を引数で受け取る）。
// 認可・検証・エラー分類は呼び出し側（Server Action）が担う。ここでは投げず {row,error} を返す。

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  PATIENT_UNDERSTANDING_SELECT_COLUMNS,
  type PatientUnderstandingRow,
  type PatientUnderstandingUpsert,
} from "./patientUnderstandingMapper";
import type { PgLikeError } from "./types";

interface RowResult {
  row: PatientUnderstandingRow | null;
  error: PgLikeError | null;
}

// 自分（user_id + case_id）の患者理解 head を取得する（未作成なら row: null）。
export async function getPatientUnderstanding(
  supabase: SupabaseClient,
  userId: string,
  caseId: string,
): Promise<RowResult> {
  const { data, error } = await supabase
    .from("patient_understanding_records")
    .select(PATIENT_UNDERSTANDING_SELECT_COLUMNS)
    .eq("user_id", userId)
    .eq("case_id", caseId)
    .maybeSingle();
  return {
    row: (data as PatientUnderstandingRow | null) ?? null,
    error: error as PgLikeError | null,
  };
}

// 患者理解 head を upsert する（学生 × ケースで 1 件）。
//   ・onConflict は uq_patient_understanding_owner(user_id, case_id)。
//   ・created_at は送らない（UPDATE 経路で不変トリガーに弾かれるのを避ける／DB 既定に任せる）。
//   ・updated_at は set_updated_at トリガーが更新する。
export async function upsertPatientUnderstanding(
  supabase: SupabaseClient,
  values: PatientUnderstandingUpsert,
): Promise<RowResult> {
  const { data, error } = await supabase
    .from("patient_understanding_records")
    .upsert(values, { onConflict: "user_id,case_id" })
    .select(PATIENT_UNDERSTANDING_SELECT_COLUMNS)
    .maybeSingle();
  return {
    row: (data as PatientUnderstandingRow | null) ?? null,
    error: error as PgLikeError | null,
  };
}
