import "server-only";

import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/v2/env";
import { createServerSupabaseClient } from "@/lib/v2/supabase/serverClient";

// サーバー側の本人確認・認可の中心。
//
// 認可判断では getSession() が返す user を信用せず、getClaims()（JWT を
// ローカル検証）で本人を確認する。role は Cookie ではなく profiles テーブルから
// サーバー側で取得する（クライアント表示制御に依存しない）。

export type AppRole = "student" | "teacher" | "admin";

export type AppProfile = {
  id: string;
  loginId: string;
  displayName: string;
  studentNumber: string | null;
  className: string | null;
  role: AppRole;
  organizationId: string;
  academicYear: number;
  isActive: boolean;
  // 初回パスワード変更が未了か（新規アカウントは true）。強制遷移は D-3B で実装。
  mustChangePassword: boolean;
  // パスワード変更時刻（未変更なら null）。ISO 文字列。
  passwordChangedAt: string | null;
};

// profiles の生（snake_case）行型。must_change_password / password_changed_at は
// 0014 未適用のDBでは欠落しうるため任意（optional）とする。
type ProfileRow = {
  id: string;
  login_id: string;
  display_name: string;
  student_number: string | null;
  class_name: string | null;
  role: string;
  organization_id: string;
  academic_year: number;
  is_active: boolean;
  must_change_password?: boolean | null;
  password_changed_at?: string | null;
};

// 認証済みユーザーの id（JWT の sub）を返す。未認証なら null。
export async function getAuthUserId(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error) return null;
  const sub = data?.claims?.sub;
  return typeof sub === "string" ? sub : null;
}

// 現在ユーザーのプロフィール（role 含む）を profiles から取得する。
export async function getCurrentProfile(): Promise<AppProfile | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createServerSupabaseClient();

  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError) return null;
  const uid = claims?.claims?.sub;
  if (typeof uid !== "string") return null;

  // 基本列は常に存在する。0014 で追加した must_change_password /
  // password_changed_at はマイグレーション未適用のDBでは存在しないため、
  // まず新列込みで取得し、列が無い等で失敗した場合は基本列のみで再取得する
  // （＝既存アカウントの挙動を壊さない前方/後方互換の読み取り）。
  const BASE_COLUMNS =
    "id, login_id, display_name, student_number, class_name, role, organization_id, academic_year, is_active";

  const full = await supabase
    .from("profiles")
    .select(`${BASE_COLUMNS}, must_change_password, password_changed_at`)
    .eq("id", uid)
    .maybeSingle();

  let row: ProfileRow | null = (full.data as ProfileRow | null) ?? null;

  if (full.error) {
    // 新列が未追加のDB等。基本列のみで再取得して従来どおり動作させる。
    const base = await supabase
      .from("profiles")
      .select(BASE_COLUMNS)
      .eq("id", uid)
      .maybeSingle();
    if (base.error) return null;
    row = (base.data as ProfileRow | null) ?? null;
  }

  if (!row) return null;

  return {
    id: row.id,
    loginId: row.login_id,
    displayName: row.display_name,
    studentNumber: row.student_number ?? null,
    className: row.class_name ?? null,
    role: row.role as AppRole,
    organizationId: row.organization_id,
    academicYear: row.academic_year,
    isActive: row.is_active,
    // 列未追加(旧DB)でも安全側: 値が無ければ true（＝未変更扱い）とする。
    mustChangePassword: row.must_change_password ?? true,
    passwordChangedAt: row.password_changed_at ?? null,
  };
}

// 認証・有効のみ要求する（初回パスワード変更フラグでは弾かない）。
// パスワード変更画面（/v2/change-password）専用の入口。通常画面では requireUser を使う。
export async function requireActiveUser(): Promise<AppProfile> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.isActive) redirect("/v2/login");
  return profile;
}

// 認証必須。未認証・無効ユーザーは /v2/login へ。
// 初回パスワード未変更（must_change_password=true）の場合は、通常画面より先に
// /v2/change-password へ強制遷移させる（URL 直接入力での回避もサーバー側で防ぐ）。
export async function requireUser(): Promise<AppProfile> {
  const profile = await requireActiveUser();
  if (profile.mustChangePassword) redirect("/v2/change-password");
  return profile;
}

// 指定 role のみ許可。権限外は /v2 へ（そこで正しい着地点に振り分ける）。
export async function requireRole(...roles: AppRole[]): Promise<AppProfile> {
  const profile = await requireUser();
  if (!roles.includes(profile.role)) redirect("/v2");
  return profile;
}
