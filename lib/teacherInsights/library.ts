/**
 * Teacher Insight 照会の純関数部分（server-only 非依存）。
 * Cookie 付き公開取得は access.ts。
 */

import type { Form3PatternKey } from "@/lib/form3/form3Types";
import type { AppProfile } from "@/lib/v2/auth/currentUser";
import { PATIENT_A_CANONICAL_INFORMATION_CATALOG } from "@/lib/gold/patientA/canonicalInformationCatalog";
import type { TeacherInsightDocument } from "./types";
import {
  getPatientATeacherInsightByIdV1,
  getPatientATeacherInsightsV1OrNull,
} from "./patientA/teacherInsightsV1";
import {
  resolveTeacherInsightsEvidence,
  type ResolvedTeacherInsight,
} from "./resolveEvidence";

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

export type TeacherInsightsForCtpResolvedResult =
  | { ok: true; insights: readonly ResolvedTeacherInsight[] }
  | {
      ok: false;
      kind: "unauthorized" | "not_ready" | "not_found" | "evidence_unresolved";
      message: string;
      unresolvedIds?: readonly string[];
    };

export type TeacherInsightsByCtpMapResult =
  | {
      ok: true;
      byCtpId: ReadonlyMap<string, readonly ResolvedTeacherInsight[]>;
    }
  | {
      ok: false;
      kind: "unauthorized" | "not_ready" | "evidence_unresolved";
      message: string;
      unresolvedIds?: readonly string[];
    };

/** CTP 1件分の Insights をカタログ解決する（権限チェックは呼び出し側） */
export function loadResolvedTeacherInsightsForCtp(
  ctpId: string,
): TeacherInsightsForCtpResolvedResult {
  const loaded = loadTeacherInsightsForCtp(ctpId);
  if (!loaded.ok) return loaded;
  const resolved = resolveTeacherInsightsEvidence(
    loaded.documents,
    PATIENT_A_CANONICAL_INFORMATION_CATALOG,
  );
  if (!resolved.ok) {
    return {
      ok: false,
      kind: "evidence_unresolved",
      message: resolved.message,
      unresolvedIds: resolved.unresolvedIds,
    };
  }
  return { ok: true, insights: resolved.insights };
}

/**
 * 複数 CTP について relatedCtpIds に基づく Insights を解決する。
 * 画面側に固定配列を持たせず、データ側の紐付けを正とする。
 */
export function loadResolvedTeacherInsightsByCtpIds(
  ctpIds: readonly string[],
): TeacherInsightsByCtpMapResult {
  const byCtpId = new Map<string, readonly ResolvedTeacherInsight[]>();
  const unresolved = new Set<string>();

  for (const ctpId of ctpIds) {
    const loaded = loadTeacherInsightsForCtp(ctpId);
    if (!loaded.ok) {
      return {
        ok: false,
        kind: loaded.kind === "not_found" ? "not_ready" : loaded.kind,
        message: loaded.message,
      };
    }
    const resolved = resolveTeacherInsightsEvidence(
      loaded.documents,
      PATIENT_A_CANONICAL_INFORMATION_CATALOG,
    );
    if (!resolved.ok) {
      for (const id of resolved.unresolvedIds) unresolved.add(id);
      continue;
    }
    byCtpId.set(ctpId, resolved.insights);
  }

  if (unresolved.size > 0) {
    const ids = [...unresolved].sort();
    return {
      ok: false,
      kind: "evidence_unresolved",
      message: `unresolved teacher insight evidence ids: ${ids.join(", ")}`,
      unresolvedIds: ids,
    };
  }

  return { ok: true, byCtpId };
}
