// 学生 CSV 一括登録で共有する型（クライアント/サーバー双方で参照可）。

// 行の判定/結果ステータス。
//   プレビュー時: registerable / validation_error / duplicate_in_csv / already_registered
//   登録結果時 : 上記に加え registered / auth_create_failed / profile_create_failed / compensation_failed
export type StudentCsvRowStatus =
  | "registerable"
  | "registered"
  | "already_registered"
  | "duplicate_in_csv"
  | "validation_error"
  | "auth_create_failed"
  | "profile_create_failed"
  | "compensation_failed";

export type StudentCsvRow = {
  rowNumber: number; // CSV 上の行番号（1 始まり・ヘッダを含むファイル行）
  loginId: string; // 入力値（trim 済み）
  displayName: string; // 入力値（trim 済み）
  status: StudentCsvRowStatus;
  message?: string; // エラー内容など（任意）
};

// 事前検証（プレビュー）の集計。
export type StudentCsvPreviewCounts = {
  requestedCount: number;
  registerableCount: number;
  duplicateInCsvCount: number;
  alreadyRegisteredCount: number;
  validationErrorCount: number;
};

// 登録結果の集計。
export type StudentCsvImportCounts = {
  requestedCount: number;
  successCount: number;
  skippedCount: number; // already_registered + duplicate_in_csv
  validationErrorCount: number;
  failedCount: number; // auth_create_failed + profile_create_failed + compensation_failed
};

// ファイル全体のエラーコード（行単位ではなく CSV 全体で弾く場合）。
export type StudentCsvFileErrorCode =
  | "unauthorized"
  | "not_configured"
  | "invalid_csv"
  | "missing_header"
  | "too_many_rows";
