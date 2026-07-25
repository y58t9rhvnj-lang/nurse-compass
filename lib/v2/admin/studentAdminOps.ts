import "server-only";

// 学生アカウントの管理操作コア（server-only）。
//
// 対象: 氏名編集 / 利用停止・再開 / 初期パスワードリセット。
// 呼び出し側（Server Action）は事前に getVerifiedAdminProfile() で actor を確定して渡すこと
//（この関数自身は認可 redirect を行わない）。
//
// service role client を使うため RLS はバイパスされる。よって:
//   ・組織境界は必ずコード側で明示フィルタ（actor.organizationId のみ）
//   ・対象が role='student' であることをサーバー側で必ず確認
//   ・自分自身（actor.id）は対象にできない
//   ・生 DB エラー・パスワード・内部メール・トークンはログ/戻り値/監査へ出さない

import { createAdminSupabaseClient } from "@/lib/v2/supabase/adminClient";
import { buildInitialPassword } from "@/lib/v2/auth/initialPassword";
import { validateDisplayName } from "@/lib/v2/admin/studentInput";
import { writeAdminAuditLog } from "@/lib/v2/admin/auditLog";
import {
  ADMIN_AUDIT_ACTIONS,
  ADMIN_AUDIT_TARGET_TYPES,
} from "@/lib/v2/admin/auditTypes";
import type { AppProfile } from "@/lib/v2/auth/currentUser";

export type StudentAdminOpErrorCode =
  | "validation"
  | "not_found"
  | "self_forbidden"
  | "auth_update_failed"
  | "profile_update_failed";

export type StudentAdminOpResult =
  | { ok: true; auditWarning: boolean }
  | { ok: false; code: StudentAdminOpErrorCode; message: string };

// 対象学生の最小スナップショット（service role で取得。同一組織・role=student のみ）。
type TargetStudent = {
  id: string;
  loginId: string;
  studentNumber: string | null;
  displayName: string;
  isActive: boolean;
};

// 対象学生を安全に取得する。
//   ・id 一致 かつ organization_id = actor.organizationId かつ role='student'
//   ・満たさない/存在しない場合は null（＝「存在しない」と「他組織」を区別しない）
async function loadTargetStudent(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  actor: AppProfile,
  studentId: string,
): Promise<TargetStudent | null> {
  const { data, error } = await admin
    .from("profiles")
    .select("id, login_id, student_number, display_name, role, organization_id, is_active")
    .eq("id", studentId)
    .eq("organization_id", actor.organizationId)
    .eq("role", "student")
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id as string,
    loginId: data.login_id as string,
    studentNumber: (data.student_number as string | null) ?? null,
    displayName: data.display_name as string,
    isActive: data.is_active as boolean,
  };
}

// 学籍番号(student_number)を監査メタデータ用に導出（無ければ login_id）。
function auditStudentNumber(target: TargetStudent): string {
  return target.studentNumber ?? target.loginId;
}

// ── 1) 氏名の編集 ─────────────────────────────────────────────
export async function updateStudentDisplayName(input: {
  actor: AppProfile;
  studentId: string;
  displayName: string;
}): Promise<StudentAdminOpResult> {
  // 入力検証（既存登録処理と同じ規則: trim・空禁止・最大長）。
  const nameCheck = validateDisplayName(input.displayName);
  if (!nameCheck.ok) {
    return { ok: false, code: "validation", message: nameCheck.message };
  }
  const nextName = nameCheck.value;

  const admin = createAdminSupabaseClient();
  const target = await loadTargetStudent(admin, input.actor, input.studentId);
  if (!target) {
    return {
      ok: false,
      code: "not_found",
      message: "対象の学生が見つかりませんでした。",
    };
  }

  const previousName = target.displayName;

  // 対象を id・組織・role で二重に限定して更新（他学生への誤更新を防ぐ）。
  const { error: updateError } = await admin
    .from("profiles")
    .update({ display_name: nextName })
    .eq("id", target.id)
    .eq("organization_id", input.actor.organizationId)
    .eq("role", "student");

  if (updateError) {
    return {
      ok: false,
      code: "profile_update_failed",
      message: "氏名の保存に失敗しました。もう一度お試しください。",
    };
  }

  // 監査ログ（秘密情報なし。氏名前後・対象user_id・学籍番号のみ）。
  const audit = await writeAdminAuditLog({
    actorUserId: input.actor.id,
    actorLoginId: input.actor.loginId,
    actorRole: "admin",
    organizationId: input.actor.organizationId,
    action: ADMIN_AUDIT_ACTIONS.STUDENT_PROFILE_UPDATED,
    targetType: ADMIN_AUDIT_TARGET_TYPES.USER,
    targetId: target.id,
    targetLoginId: target.loginId,
    summary: "学生の氏名を更新しました",
    metadata: {
      studentNumber: auditStudentNumber(target),
      before: previousName,
      after: nextName,
    },
  });

  return { ok: true, auditWarning: !audit.ok };
}

// ── 2) 利用停止 / 再開 ───────────────────────────────────────
export async function setStudentActive(input: {
  actor: AppProfile;
  studentId: string;
  active: boolean;
}): Promise<StudentAdminOpResult> {
  // 自分自身（管理者本人）には実行不可。role=student 判定でも弾かれるが明示的に防ぐ。
  if (input.studentId === input.actor.id) {
    return {
      ok: false,
      code: "self_forbidden",
      message: "自分自身のアカウントには実行できません。",
    };
  }

  const admin = createAdminSupabaseClient();
  const target = await loadTargetStudent(admin, input.actor, input.studentId);
  if (!target) {
    return {
      ok: false,
      code: "not_found",
      message: "対象の学生が見つかりませんでした。",
    };
  }

  // is_active のみ更新。Auth ユーザーや学習データ（様式2/Evidence/ノート等）は削除しない。
  const { error: updateError } = await admin
    .from("profiles")
    .update({ is_active: input.active })
    .eq("id", target.id)
    .eq("organization_id", input.actor.organizationId)
    .eq("role", "student");

  if (updateError) {
    return {
      ok: false,
      code: "profile_update_failed",
      message: "利用状態の更新に失敗しました。もう一度お試しください。",
    };
  }

  const audit = await writeAdminAuditLog({
    actorUserId: input.actor.id,
    actorLoginId: input.actor.loginId,
    actorRole: "admin",
    organizationId: input.actor.organizationId,
    action: input.active
      ? ADMIN_AUDIT_ACTIONS.STUDENT_REACTIVATED
      : ADMIN_AUDIT_ACTIONS.STUDENT_DEACTIVATED,
    targetType: ADMIN_AUDIT_TARGET_TYPES.USER,
    targetId: target.id,
    targetLoginId: target.loginId,
    summary: input.active
      ? "学生の利用を再開しました"
      : "学生を利用停止にしました",
    metadata: { studentNumber: auditStudentNumber(target) },
  });

  return { ok: true, auditWarning: !audit.ok };
}

// ── 3) 初期パスワードへリセット ──────────────────────────────
export async function resetStudentPassword(input: {
  actor: AppProfile;
  studentId: string;
}): Promise<StudentAdminOpResult> {
  if (input.studentId === input.actor.id) {
    return {
      ok: false,
      code: "self_forbidden",
      message: "自分自身のアカウントには実行できません。",
    };
  }

  const admin = createAdminSupabaseClient();
  const target = await loadTargetStudent(admin, input.actor, input.studentId);
  if (!target) {
    return {
      ok: false,
      code: "not_found",
      message: "対象の学生が見つかりませんでした。",
    };
  }

  // 初期パスワードは既存の唯一の生成関数を再利用（別実装しない）。
  // 値はメモリ内のみ・DB/監査/ログ/戻り値へは一切出さない。
  const initialPassword = buildInitialPassword(target.loginId);

  // 復旧を最優先し、先に Auth のパスワードを初期値へ戻す。
  const { error: authError } = await admin.auth.admin.updateUserById(target.id, {
    password: initialPassword,
  });
  if (authError) {
    return {
      ok: false,
      code: "auth_update_failed",
      message: "パスワードの初期化に失敗しました。時間をおいて再度お試しください。",
    };
  }

  // 次回ログイン時に必ず変更させる（must_change_password=true / password_changed_at=null）。
  const { error: flagError } = await admin
    .from("profiles")
    .update({ must_change_password: true, password_changed_at: null })
    .eq("id", target.id)
    .eq("organization_id", input.actor.organizationId)
    .eq("role", "student");

  if (flagError) {
    // パスワードは初期化済み。ただし初回変更フラグの保存に失敗（稀）。
    return {
      ok: false,
      code: "profile_update_failed",
      message:
        "パスワードは初期化されましたが、初回変更設定の保存に失敗しました。管理者へ連絡してください。",
    };
  }

  // 監査ログ（パスワード値は絶対に含めない）。
  const audit = await writeAdminAuditLog({
    actorUserId: input.actor.id,
    actorLoginId: input.actor.loginId,
    actorRole: "admin",
    organizationId: input.actor.organizationId,
    action: ADMIN_AUDIT_ACTIONS.STUDENT_PASSWORD_RESET,
    targetType: ADMIN_AUDIT_TARGET_TYPES.USER,
    targetId: target.id,
    targetLoginId: target.loginId,
    summary: "学生のパスワードを初期化しました",
    metadata: {
      studentNumber: auditStudentNumber(target),
      performedBy: input.actor.loginId,
    },
  });

  return { ok: true, auditWarning: !audit.ok };
}
