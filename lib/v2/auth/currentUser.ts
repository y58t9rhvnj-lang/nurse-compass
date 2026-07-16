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

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, login_id, display_name, student_number, class_name, role, organization_id, academic_year, is_active",
    )
    .eq("id", uid)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    loginId: data.login_id,
    displayName: data.display_name,
    studentNumber: data.student_number ?? null,
    className: data.class_name ?? null,
    role: data.role as AppRole,
    organizationId: data.organization_id,
    academicYear: data.academic_year,
    isActive: data.is_active,
  };
}

// 認証必須。未認証・無効ユーザーは /v2/login へ。
export async function requireUser(): Promise<AppProfile> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.isActive) redirect("/v2/login");
  return profile;
}

// 指定 role のみ許可。権限外は /v2 へ（そこで正しい着地点に振り分ける）。
export async function requireRole(...roles: AppRole[]): Promise<AppProfile> {
  const profile = await requireUser();
  if (!roles.includes(profile.role)) redirect("/v2");
  return profile;
}
