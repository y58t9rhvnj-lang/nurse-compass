import "server-only";

// 学生 CSV の解析・検証（server-only）。
//
// クライアントのプレビュー結果は信用せず、プレビュー時も登録時もサーバーで全行を
// 解析・検証する（この関数を両方から呼ぶ）。service role で既存 login_id を確認する。

import { parseCsv } from "./csv";
import {
  validateDisplayName,
  validateStudentNumber,
} from "./studentInput";
import { createAdminSupabaseClient } from "@/lib/v2/supabase/adminClient";
import type {
  StudentCsvFileErrorCode,
  StudentCsvPreviewCounts,
  StudentCsvRow,
} from "./studentCsvTypes";

export const CSV_MAX_ROWS = 100;
export const REQUIRED_HEADERS = ["login_id", "display_name"] as const;

export type AnalyzeStudentCsvResult =
  | {
      ok: false;
      code: Extract<
        StudentCsvFileErrorCode,
        "invalid_csv" | "missing_header" | "too_many_rows"
      >;
      message: string;
    }
  | {
      ok: true;
      rows: StudentCsvRow[];
      counts: StudentCsvPreviewCounts;
    };

export async function analyzeStudentCsv(params: {
  text: string;
  organizationId: string;
}): Promise<AnalyzeStudentCsvResult> {
  const records = parseCsv(params.text);
  if (records.length === 0) {
    return {
      ok: false,
      code: "invalid_csv",
      message: "CSV を解析できませんでした。内容をご確認ください。",
    };
  }

  // ヘッダー（前後空白を除去して照合）。
  const header = records[0].fields.map((h) => h.trim());
  const loginIdIdx = header.indexOf("login_id");
  const nameIdx = header.indexOf("display_name");
  if (loginIdIdx === -1 || nameIdx === -1) {
    return {
      ok: false,
      code: "missing_header",
      message:
        "ヘッダー行に login_id と display_name が必要です。",
    };
  }

  const dataRecords = records.slice(1);
  if (dataRecords.length > CSV_MAX_ROWS) {
    return {
      ok: false,
      code: "too_many_rows",
      message: `一度に登録できるのは ${CSV_MAX_ROWS} 件までです。`,
    };
  }

  // 各行の素の値を取り出す。
  type Draft = {
    rowNumber: number;
    loginId: string;
    displayName: string;
  };
  const drafts: Draft[] = dataRecords.map((rec) => ({
    rowNumber: rec.line,
    loginId: (rec.fields[loginIdIdx] ?? "").trim(),
    displayName: (rec.fields[nameIdx] ?? "").trim(),
  }));

  // 形式検証。
  type Judged = Draft & {
    formatOk: boolean;
    message?: string;
  };
  const judged: Judged[] = drafts.map((d) => {
    const numberCheck = validateStudentNumber(d.loginId);
    if (!numberCheck.ok) {
      return { ...d, formatOk: false, message: numberCheck.message };
    }
    const nameCheck = validateDisplayName(d.displayName);
    if (!nameCheck.ok) {
      return { ...d, formatOk: false, message: nameCheck.message };
    }
    return { ...d, formatOk: true };
  });

  // 形式 OK の中で CSV 内重複を検出（login_id 単位）。
  const countByLoginId = new Map<string, number>();
  for (const j of judged) {
    if (j.formatOk) {
      countByLoginId.set(j.loginId, (countByLoginId.get(j.loginId) ?? 0) + 1);
    }
  }

  // 既存 login_id を DB で確認（CSV 内一意かつ形式 OK のもののみ問い合わせ）。
  const candidateLoginIds = Array.from(
    new Set(
      judged
        .filter((j) => j.formatOk && (countByLoginId.get(j.loginId) ?? 0) === 1)
        .map((j) => j.loginId),
    ),
  );

  const existingSet = new Set<string>();
  if (candidateLoginIds.length > 0) {
    const admin = createAdminSupabaseClient();
    const { data } = await admin
      .from("profiles")
      .select("login_id")
      .in("login_id", candidateLoginIds);
    for (const r of data ?? []) existingSet.add(r.login_id as string);
  }

  // 行ごとに最終判定。
  const rows: StudentCsvRow[] = judged.map((j) => {
    if (!j.formatOk) {
      return {
        rowNumber: j.rowNumber,
        loginId: j.loginId,
        displayName: j.displayName,
        status: "validation_error",
        message: j.message,
      };
    }
    if ((countByLoginId.get(j.loginId) ?? 0) > 1) {
      return {
        rowNumber: j.rowNumber,
        loginId: j.loginId,
        displayName: j.displayName,
        status: "duplicate_in_csv",
        message: "CSV 内で学籍番号が重複しています。",
      };
    }
    if (existingSet.has(j.loginId)) {
      return {
        rowNumber: j.rowNumber,
        loginId: j.loginId,
        displayName: j.displayName,
        status: "already_registered",
        message: "すでに登録されています。",
      };
    }
    return {
      rowNumber: j.rowNumber,
      loginId: j.loginId,
      displayName: j.displayName,
      status: "registerable",
    };
  });

  const counts: StudentCsvPreviewCounts = {
    requestedCount: rows.length,
    registerableCount: rows.filter((r) => r.status === "registerable").length,
    duplicateInCsvCount: rows.filter((r) => r.status === "duplicate_in_csv")
      .length,
    alreadyRegisteredCount: rows.filter((r) => r.status === "already_registered")
      .length,
    validationErrorCount: rows.filter((r) => r.status === "validation_error")
      .length,
  };

  return { ok: true, rows, counts };
}
