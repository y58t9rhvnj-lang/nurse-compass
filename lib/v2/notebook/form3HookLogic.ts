// Compass Version2.1 — Form3 Day 3
// Hook から切り出した純関数（debounce 外の状態機械・更新ルールの検証用）。
// React 非依存。

import {
  checkForm3ReviewRequirements,
  type Form3ReviewIssue,
} from "@/lib/form3/form3Validation";
import {
  createEmptyForm3,
  type Form3Data,
  type Form3PatternData,
  type Form3PatternKey,
} from "@/lib/form3/form3Types";
import type {
  Form3SaveWarning,
  Form3Snapshot,
} from "@/lib/v2/notebook/types";

export type Form3SaveStatus =
  | "idle"
  | "dirty"
  | "saving"
  | "saved"
  | "error"
  | "conflict";

export type Form3PatternField = keyof Form3PatternData;

/**
 * 整理済みパターンを本文・判断系フィールドで編集したら isReviewed を false へ戻す。
 * （Day 3 採択ルール。isReviewed 自体の明示変更では自動解除しない。）
 */
export function shouldClearReviewedOnFieldEdit(
  field: Form3PatternField,
): boolean {
  return field !== "isReviewed";
}

export function applyPatternField(
  data: Form3Data,
  patternKey: Form3PatternKey,
  field: Form3PatternField,
  value: Form3PatternData[Form3PatternField],
): Form3Data {
  const prev = data.patterns[patternKey];
  const nextPattern: Form3PatternData = {
    ...prev,
    [field]: value,
  } as Form3PatternData;

  if (
    prev.isReviewed &&
    shouldClearReviewedOnFieldEdit(field) &&
    field !== "isReviewed"
  ) {
    nextPattern.isReviewed = false;
  }

  return {
    ...data,
    patterns: {
      ...data.patterns,
      [patternKey]: nextPattern,
    },
  };
}

export type MarkReviewedResult =
  | { ok: true; data: Form3Data }
  | { ok: false; issues: Form3ReviewIssue[]; data: Form3Data };

export function markPatternReviewed(
  data: Form3Data,
  patternKey: Form3PatternKey,
): MarkReviewedResult {
  const pattern = data.patterns[patternKey];
  const check = checkForm3ReviewRequirements(pattern);
  if (!check.ok) {
    return { ok: false, issues: check.issues, data };
  }
  if (pattern.isReviewed) {
    return { ok: true, data };
  }
  return {
    ok: true,
    data: applyPatternField(data, patternKey, "isReviewed", true),
  };
}

export function unmarkPatternReviewed(
  data: Form3Data,
  patternKey: Form3PatternKey,
): Form3Data {
  if (!data.patterns[patternKey].isReviewed) return data;
  return applyPatternField(data, patternKey, "isReviewed", false);
}

export function initialForm3Data(
  patientId: string,
  initial: Form3Snapshot | null,
): Form3Data {
  return initial?.payload ?? createEmptyForm3(patientId);
}

/**
 * Phase B2-2A: 読込 hydrate 後の Hook 初期 saveStatus。
 * Migration は dirty にしない → 常に "idle"。
 */
export function initialForm3SaveStatusAfterRead(dirty: boolean): Form3SaveStatus {
  return dirty ? "dirty" : "idle";
}

export type Form3SaveOutcome =
  | {
      kind: "saved";
      snapshot: Form3Snapshot;
      warnings: Form3SaveWarning[];
      resave: boolean;
    }
  | {
      kind: "conflict";
      latest: Form3Snapshot | null;
      warnings: Form3SaveWarning[];
    }
  | {
      kind: "error";
      warnings: Form3SaveWarning[];
    };

/**
 * Server Action / callAction の結果を Hook 状態更新用に正規化する。
 * conflict 時は自動保存を止める（resave しない）。
 */
export function interpretForm3SaveResult(
  res: {
    ok: boolean;
    kind?: string;
    data?: Form3Snapshot;
    latest?: Form3Snapshot | null;
    warnings?: Form3SaveWarning[];
    message?: string;
  },
  dirtyDuringSave: boolean,
): Form3SaveOutcome {
  const warnings = res.warnings ?? [];
  if (res.ok && res.data) {
    return {
      kind: "saved",
      snapshot: res.data,
      warnings,
      resave: dirtyDuringSave,
    };
  }
  if (res.kind === "conflict") {
    return {
      kind: "conflict",
      latest: res.latest ?? null,
      warnings,
    };
  }
  return { kind: "error", warnings };
}

export function resolveConflictWithLatest(
  latest: Form3Snapshot,
): {
  data: Form3Data;
  version: number;
  updatedAt: string;
  status: "saved";
} {
  return {
    data: latest.payload,
    version: latest.version,
    updatedAt: latest.updatedAt,
    status: "saved",
  };
}
