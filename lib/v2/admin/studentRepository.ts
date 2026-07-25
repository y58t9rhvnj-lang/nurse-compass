import "server-only";

// 学生一覧・詳細の取得（server-only, service role）。
//
// ・service role client を使うため RLS はバイパスされる。よって組織境界は
//   コード側で必ず明示フィルタする（organization_id は呼び出し元＝ログイン中の
//   admin profile から確定した値のみを渡す。クライアント入力は使わない）。
// ・対象は role='student' のみ。teacher/admin は学生管理に出さない。

import { createAdminSupabaseClient } from "@/lib/v2/supabase/adminClient";
import type {
  AdminStudentDetail,
  AdminStudentListItem,
  AdminStudentListResult,
} from "./studentTypes";

export const STUDENTS_PAGE_SIZE = 25;
const SEARCH_MAX_LENGTH = 50;

// 検索文字列を PostgREST の or()/ilike で安全に使える形へ正規化する。
//   ・trim し長さ上限を設ける
//   ・or() 構文やクエリを壊す記号を除去（, . ( ) * \ 等）
//   ・LIKE ワイルドカード( % _ )はエスケープ
export function sanitizeSearchTerm(raw: string): string {
  const trimmed = raw.trim().slice(0, SEARCH_MAX_LENGTH);
  const withoutSyntax = trimmed.replace(/[,.()*\\]/g, "");
  return withoutSyntax.replace(/[%_]/g, "\\$&");
}

type ListParams = {
  organizationId: string;
  q: string;
  page: number;
  pageSize?: number;
};

export async function listStudents(
  params: ListParams,
): Promise<AdminStudentListResult> {
  const pageSize = params.pageSize ?? STUDENTS_PAGE_SIZE;
  const page = params.page < 1 ? 1 : params.page;
  const admin = createAdminSupabaseClient();
  const safe = sanitizeSearchTerm(params.q);

  const buildQuery = () => {
    let query = admin
      .from("profiles")
      .select(
        "id, login_id, student_number, display_name, is_active, must_change_password, created_at",
        { count: "exact" },
      )
      .eq("role", "student")
      .eq("organization_id", params.organizationId);
    if (safe.length > 0) {
      query = query.or(
        `login_id.ilike.%${safe}%,display_name.ilike.%${safe}%`,
      );
    }
    return query;
  };

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, count, error } = await buildQuery()
    .order("login_id", { ascending: true })
    .range(from, to);

  if (error) {
    // 生エラーは投げず、空結果で返す（呼び出し元で 0 件表示）。
    return { items: [], total: 0, page, pageSize, q: params.q.trim() };
  }

  const items: AdminStudentListItem[] = (data ?? []).map((r) => ({
    id: r.id as string,
    loginId: r.login_id as string,
    studentNumber: (r.student_number as string | null) ?? null,
    displayName: r.display_name as string,
    isActive: r.is_active as boolean,
    mustChangePassword: (r.must_change_password as boolean | null) ?? false,
    createdAt: r.created_at as string,
  }));

  return {
    items,
    total: count ?? 0,
    page,
    pageSize,
    q: params.q.trim(),
  };
}

// 学生1名の詳細。組織境界・role=student を満たさない場合は null（＝404相当）。
// 「存在しない」と「他組織」をクライアントへ区別して返さない（どちらも null）。
export async function getStudentDetail(params: {
  organizationId: string;
  studentId: string;
}): Promise<AdminStudentDetail | null> {
  const admin = createAdminSupabaseClient();

  const { data, error } = await admin
    .from("profiles")
    .select(
      "id, login_id, student_number, display_name, role, organization_id, is_active, must_change_password, password_changed_at, created_at, updated_at",
    )
    .eq("id", params.studentId)
    .eq("organization_id", params.organizationId)
    .eq("role", "student")
    .maybeSingle();

  if (error || !data) return null;

  // 組織名（表示用）。取得失敗は null 表示で継続。
  let organizationName: string | null = null;
  const { data: org } = await admin
    .from("organizations")
    .select("name")
    .eq("id", data.organization_id as string)
    .maybeSingle();
  if (org) organizationName = (org.name as string) ?? null;

  return {
    id: data.id as string,
    loginId: data.login_id as string,
    studentNumber: (data.student_number as string | null) ?? null,
    displayName: data.display_name as string,
    role: data.role as string,
    organizationId: data.organization_id as string,
    organizationName,
    isActive: data.is_active as boolean,
    mustChangePassword: (data.must_change_password as boolean | null) ?? false,
    passwordChangedAt: (data.password_changed_at as string | null) ?? null,
    createdAt: data.created_at as string,
    updatedAt: (data.updated_at as string | null) ?? null,
  };
}
