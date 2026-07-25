"use server";

// Compass Version2 — Sprint D-3E
// 学生 CSV 一括登録の Server Action（admin 専用・2段階: プレビュー → 登録）。
//
// ・認可は毎回 getVerifiedAdminProfile()（role=admin / is_active / !must_change / org）。
// ・クライアントの判定結果は信用せず、プレビュー時も登録時もサーバーで全行を再解析・再検証。
// ・organization_id / role / is_active / must_change_password / 初期パスワードは
//   クライアントから受け取らない。
// ・登録は登録可能行を1件ずつ逐次処理（Auth API を一斉並列実行しない）。
// ・学生作成は共通コア createStudentAccount を使用（単体登録と二重実装しない）。

import { isSupabaseConfigured } from "@/lib/v2/env";
import { getVerifiedAdminProfile } from "@/lib/v2/auth/currentUser";
import { analyzeStudentCsv } from "@/lib/v2/admin/studentCsv";
import { createStudentAccount } from "@/lib/v2/admin/createStudentAccount";
import { writeAdminAuditLog } from "@/lib/v2/admin/auditLog";
import {
  ADMIN_AUDIT_ACTIONS,
  ADMIN_AUDIT_TARGET_TYPES,
} from "@/lib/v2/admin/auditTypes";
import type {
  StudentCsvFileErrorCode,
  StudentCsvImportCounts,
  StudentCsvPreviewCounts,
  StudentCsvRow,
  StudentCsvRowStatus,
} from "@/lib/v2/admin/studentCsvTypes";

export type PreviewStudentCsvResult =
  | { ok: true; rows: StudentCsvRow[]; counts: StudentCsvPreviewCounts }
  | { ok: false; code: StudentCsvFileErrorCode; message: string };

export type ImportStudentCsvResult =
  | {
      ok: true;
      rows: StudentCsvRow[];
      counts: StudentCsvImportCounts;
      auditWarning: boolean;
    }
  | { ok: false; code: StudentCsvFileErrorCode; message: string };

// ---- プレビュー（登録しない） --------------------------------------------
export async function previewStudentCsvAction(
  csvText: string,
): Promise<PreviewStudentCsvResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, code: "not_configured", message: "認証基盤が未設定です。" };
  }
  const actor = await getVerifiedAdminProfile();
  if (!actor) {
    return { ok: false, code: "unauthorized", message: "権限がありません。" };
  }

  const analysis = await analyzeStudentCsv({
    text: csvText,
    organizationId: actor.organizationId,
  });
  if (!analysis.ok) {
    return { ok: false, code: analysis.code, message: analysis.message };
  }
  return { ok: true, rows: analysis.rows, counts: analysis.counts };
}

// ---- 登録（登録可能行を逐次登録） ----------------------------------------
export async function importStudentCsvAction(
  csvText: string,
): Promise<ImportStudentCsvResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, code: "not_configured", message: "認証基盤が未設定です。" };
  }
  const actor = await getVerifiedAdminProfile();
  if (!actor) {
    return { ok: false, code: "unauthorized", message: "権限がありません。" };
  }

  // 登録時もサーバーで全行を再解析・再検証（クライアント判定を信用しない）。
  const analysis = await analyzeStudentCsv({
    text: csvText,
    organizationId: actor.organizationId,
  });
  if (!analysis.ok) {
    return { ok: false, code: analysis.code, message: analysis.message };
  }

  const resultByRow = new Map<number, { status: StudentCsvRowStatus; message?: string }>();
  let perStudentAuditWarning = false;

  // 登録可能行のみ、1件ずつ逐次処理。
  for (const row of analysis.rows) {
    if (row.status !== "registerable") continue;

    const res = await createStudentAccount({
      actor,
      loginId: row.loginId,
      displayName: row.displayName,
      auditSource: "csv_import",
    });

    if (res.ok) {
      resultByRow.set(row.rowNumber, { status: "registered" });
      if (res.auditWarning) perStudentAuditWarning = true;
      continue;
    }

    let status: StudentCsvRowStatus;
    switch (res.code) {
      case "duplicate_login_id":
        status = "already_registered"; // 競合等
        break;
      case "auth_create_failed":
        status = "auth_create_failed";
        break;
      case "profile_create_failed":
        status = "profile_create_failed";
        break;
      case "compensation_failed":
        status = "compensation_failed";
        break;
      default:
        status = "validation_error";
        break;
    }
    resultByRow.set(row.rowNumber, { status, message: res.message });
  }

  // 元の順序を保ったまま、登録可能行の結果を反映。
  const rows: StudentCsvRow[] = analysis.rows.map((r) => {
    const outcome = resultByRow.get(r.rowNumber);
    return outcome ? { ...r, status: outcome.status, message: outcome.message } : r;
  });

  const counts: StudentCsvImportCounts = {
    requestedCount: rows.length,
    successCount: rows.filter((r) => r.status === "registered").length,
    skippedCount: rows.filter(
      (r) => r.status === "already_registered" || r.status === "duplicate_in_csv",
    ).length,
    validationErrorCount: rows.filter((r) => r.status === "validation_error")
      .length,
    failedCount: rows.filter(
      (r) =>
        r.status === "auth_create_failed" ||
        r.status === "profile_create_failed" ||
        r.status === "compensation_failed",
    ).length,
  };

  // 一括処理全体の監査ログ（個人情報・CSV 本文は含めない）。
  const audit = await writeAdminAuditLog({
    actorUserId: actor.id,
    actorLoginId: actor.loginId,
    actorRole: "admin",
    organizationId: actor.organizationId,
    action: ADMIN_AUDIT_ACTIONS.USER_BULK_CREATE,
    targetType: ADMIN_AUDIT_TARGET_TYPES.USER,
    summary: "学生アカウントをCSV一括登録しました",
    metadata: {
      requestedCount: counts.requestedCount,
      successCount: counts.successCount,
      skippedCount: counts.skippedCount,
      validationErrorCount: counts.validationErrorCount,
      failedCount: counts.failedCount,
    },
  });

  return {
    ok: true,
    rows,
    counts,
    // 個別 or 全体の監査ログのいずれかが失敗したら警告（登録はロールバックしない）。
    auditWarning: perStudentAuditWarning || !audit.ok,
  };
}
