"use client";

/**
 * @deprecated Phase 2 Step 1 で Dialog 編集へ移行。
 * 互換のためファイルを残す。編集 UI は Form3InformationDialog。
 *
 * Contract notes (B5):
 * - Patient Source から自動入力しません
 * - sourceLabel / sourceReference は ops 経由でのみ扱い、label 編集で
 *   構造化参照 (isStructured / ref.kind === "fixture") を上書きしない
 * - sourceLabel: trimmed === "" ? null : value
 */

export { default } from "@/components/v2/form3/Form3InformationDialog";
