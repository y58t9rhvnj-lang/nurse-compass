"use server";

// Compass Version2 — Sprint D-3F
// 学生管理（氏名編集・利用停止/再開・初期パスワードリセット）の Server Action。
//
// 各 Action は薄いラッパー。共通の認可・入力受け取りのみを担い、
// 実処理（service role + 対象検証 + 監査）は lib/v2/admin/studentAdminOps.ts に集約する。
//
// セキュリティ:
//   ・service role を使う前に getVerifiedAdminProfile() で Admin 本人を確定
//     （認証済み・is_active・!must_change_password・role=admin・organization_id）
//   ・organization_id はサーバー側の検証済み profile からのみ確定（クライアント値は使わない）
//   ・生 DB エラー・パスワードは戻り値へ出さない

import { revalidatePath } from "next/cache";
import { isSupabaseConfigured } from "@/lib/v2/env";
import { getVerifiedAdminProfile } from "@/lib/v2/auth/currentUser";
import {
  updateStudentDisplayName,
  setStudentActive,
  resetStudentPassword,
  type StudentAdminOpErrorCode,
} from "@/lib/v2/admin/studentAdminOps";

export type StudentAdminActionErrorCode =
  | StudentAdminOpErrorCode
  | "unauthorized"
  | "not_configured";

export type StudentAdminActionResult =
  | { ok: true; auditWarning: boolean }
  | { ok: false; code: StudentAdminActionErrorCode; message: string };

// 更新後、詳細ページと一覧ページを再検証して表示へ反映する。
function revalidateStudentViews(studentId: string): void {
  revalidatePath(`/v2/admin/students/${studentId}`);
  revalidatePath("/v2/admin/students");
}

// 認可の共通前処理。Admin 本人を確定して返す（失敗時は結果を返す）。
async function requireActorOrResult(): Promise<
  | { ok: true; actor: NonNullable<Awaited<ReturnType<typeof getVerifiedAdminProfile>>> }
  | { ok: false; result: StudentAdminActionResult }
> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      result: { ok: false, code: "not_configured", message: "認証基盤が未設定です。" },
    };
  }
  const actor = await getVerifiedAdminProfile();
  if (!actor) {
    return {
      ok: false,
      result: { ok: false, code: "unauthorized", message: "権限がありません。" },
    };
  }
  return { ok: true, actor };
}

// 氏名の編集。
export async function updateStudentNameAction(
  studentId: string,
  displayName: string,
): Promise<StudentAdminActionResult> {
  const guard = await requireActorOrResult();
  if (!guard.ok) return guard.result;

  const result = await updateStudentDisplayName({
    actor: guard.actor,
    studentId,
    displayName,
  });
  if (result.ok) revalidateStudentViews(studentId);
  return result;
}

// 利用停止 / 再開。
export async function setStudentActiveAction(
  studentId: string,
  active: boolean,
): Promise<StudentAdminActionResult> {
  const guard = await requireActorOrResult();
  if (!guard.ok) return guard.result;

  const result = await setStudentActive({
    actor: guard.actor,
    studentId,
    active,
  });
  if (result.ok) revalidateStudentViews(studentId);
  return result;
}

// 初期パスワードへリセット（パスワード値は返さない・表示しない）。
export async function resetStudentPasswordAction(
  studentId: string,
): Promise<StudentAdminActionResult> {
  const guard = await requireActorOrResult();
  if (!guard.ok) return guard.result;

  const result = await resetStudentPassword({
    actor: guard.actor,
    studentId,
  });
  if (result.ok) revalidateStudentViews(studentId);
  return result;
}
