/**
 * Teacher Insight 照会の純関数部分（server-only 非依存）。
 * Cookie 付き公開取得は access.ts。
 */

import type { Form3PatternKey } from "@/lib/form3/form3Types";
import type { AppProfile } from "@/lib/v2/auth/currentUser";
import type { TeacherInsightDocument } from "./types";
import {
  getPatientATeacherInsightByIdV1,
  getPatientATeacherInsightsV1OrNull,
} from "./patientA/teacherInsightsV1";

export type TeacherInsightsAccessResult =
  | { ok: true; documents: readonly TeacherInsightDocument[] }
  | {
      ok: false;
      kind: "unauthorized" | "not_ready" | "not_found";
      message: string;
    };

export type TeacherInsightAccessResult =
  | { ok: true; document: TeacherInsightDocument }
  | {
      ok: false;
      kind: "unauthorized" | "not_ready" | "not_found";
      message: string;
    };

export function isTeacherOrAdminProfile(
  profile: AppProfile | null | undefined,
): profile is AppProfile {
  return (
    !!profile &&
    profile.isActive &&
    !profile.mustChangePassword &&
    (profile.role === "teacher" || profile.role === "admin")
  );
}

function loadAllOrNotReady(): TeacherInsightsAccessResult {
  const docs = getPatientATeacherInsightsV1OrNull();
  if (!docs) {
    return {
      ok: false,
      kind: "not_ready",
      message: "Teacher Insight library failed to load or validate",
    };
  }
  return { ok: true, documents: docs };
}

/** 全件（現時点は Aさん 7件）。権限チェックは呼び出し側 / access.ts */
export function loadTeacherInsights(): TeacherInsightsAccessResult {
  return loadAllOrNotReady();
}

export function loadTeacherInsightById(id: string): TeacherInsightAccessResult {
  const all = loadAllOrNotReady();
  if (!all.ok) return all;
  const doc = all.documents.find((d) => d.id === id);
  if (!doc) {
    return { ok: false, kind: "not_found", message: `insight not found: ${id}` };
  }
  return { ok: true, document: doc };
}

export function loadPatientATeacherInsights(): TeacherInsightsAccessResult {
  const all = loadAllOrNotReady();
  if (!all.ok) return all;
  return {
    ok: true,
    documents: all.documents.filter(
      (d) => d.patientId === "A" && d.caseId === "SP-001",
    ),
  };
}

export function loadTeacherInsightsForCtp(
  ctpId: string,
): TeacherInsightsAccessResult {
  const all = loadAllOrNotReady();
  if (!all.ok) return all;
  const token = ctpId.trim();
  return {
    ok: true,
    documents: all.documents.filter(
      (d) =>
        d.relatedCtpIds?.includes(token) ||
        d.goldStandardRelationship.relatedCtpIds.includes(token),
    ),
  };
}

export function loadTeacherInsightsForPattern(
  patternKey: Form3PatternKey,
): TeacherInsightsAccessResult {
  const all = loadAllOrNotReady();
  if (!all.ok) return all;
  return {
    ok: true,
    documents: all.documents.filter((d) =>
      d.applicablePatternKeys.includes(patternKey),
    ),
  };
}

/** テスト用: ID 直読み（ゲートなし） */
export function peekPatientATeacherInsightById(
  id: string,
): TeacherInsightDocument | null {
  return getPatientATeacherInsightByIdV1(id);
}
