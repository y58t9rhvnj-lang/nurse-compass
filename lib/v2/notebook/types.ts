// Compass Version2 β — Phase 3-2
// repository / Server Action 層の DTO・入力型・戻り値（Result）・エラー分類。
//
// 方針:
//   ・戻り値は判別可能なユニオン（ok:true/false）。UI へは分類済みの kind のみ返し、
//     DB の生エラー・内部情報（PostgrestError.message 等）は返さない。
//   ・competition（競合）は最新データを型安全に同梱する。
//   ・organization_id / academic_year / user_id / created_by / case_id 等の
//     識別情報はクライアントから受け取らず、サーバが決定する（本ファイルの入力型に含めない）。

import type { Form2Data } from "@/lib/form2/form2Types";
import type {
  InformationCard,
  InformationSourceReference,
  InformationSourceType,
} from "@/lib/information/informationCard";

// ===== エラー分類 =====

export type ActionErrorKind =
  | "unauthorized" // 未認証 / 学生以外 / RLS 拒否
  | "validation" // 入力不正（空・未知ケース・enum 外・必須欠落）
  | "conflict" // 楽観ロック不一致（他端末が先に更新）
  | "duplicate" // 一意制約違反（既存レコード / 同一出所の二重収集）
  | "not_configured" // Supabase 未設定
  | "not_found" // 対象が存在しない
  | "db_error"; // その他のDBエラー（詳細はサーバログのみ）

// ===== 様式2 =====

export interface Form2Snapshot {
  payload: Form2Data;
  version: number; // DB レコードバージョン（楽観ロック）
  updatedAt: string; // ISO 文字列
}

export interface Form2SaveInput {
  patientId: string;
  payload: Form2Data;
  // 初回保存は null、更新は現在の DB version を渡す。
  expectedVersion: number | null;
}

export type Form2LoadResult =
  | { ok: true; data: Form2Snapshot | null }
  | { ok: false; kind: Exclude<ActionErrorKind, "conflict">; message: string };

export type Form2SaveResult =
  | { ok: true; data: Form2Snapshot }
  | { ok: false; kind: "conflict"; message: string; latest: Form2Snapshot | null }
  | {
      ok: false;
      kind: Exclude<ActionErrorKind, "conflict">;
      message: string;
    };

// ===== 情報カード =====

export interface NewCardInput {
  patientId: string;
  content: string;
  sourceType: InformationSourceType;
  sourceLabel: string;
  sourceReference?: InformationSourceReference;
  category?: string;
  note?: string;
  originalText?: string;
  observedAt?: string;
  sortOrder?: number;
}

// 学生が編集できるのは content / category / note / sourceLabel / sortOrder のみ。
// identity・事実性カラムは不変（DBトリガーでも担保）。
export interface CardUpdatePatch {
  content?: string;
  category?: string;
  note?: string;
  sourceLabel?: string;
  sortOrder?: number;
}

export type CardListResult =
  | { ok: true; data: InformationCard[] }
  | { ok: false; kind: Exclude<ActionErrorKind, "conflict">; message: string };

export type CardMutationResult =
  | { ok: true; data: InformationCard }
  | { ok: false; kind: "conflict"; message: string; latest: InformationCard | null }
  | {
      ok: false;
      kind: Exclude<ActionErrorKind, "conflict">;
      message: string;
    };

// ===== エラーマッピング（PostgrestError → 分類） =====
// DB の生メッセージはクライアントへ返さない。code のみで分類する。

export interface PgLikeError {
  code?: string;
  message?: string;
}

// PostgREST/Postgres のエラーコードを内部分類へ変換する。
export function classifyDbError(
  error: PgLikeError | null | undefined,
): Exclude<ActionErrorKind, "conflict"> {
  const code = error?.code;
  switch (code) {
    case "23505": // unique_violation
      return "duplicate";
    case "42501": // insufficient_privilege（RLS 拒否）
      return "unauthorized";
    case "23514": // check_violation
    case "23502": // not_null_violation
    case "22P02": // invalid_text_representation
      return "validation";
    default:
      return "db_error";
  }
}
