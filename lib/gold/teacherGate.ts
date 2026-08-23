/**
 * 教員ゲートの純関数部分（server-only 非依存）。
 * ランタイムの Cookie 取得は access.ts 側。
 */

import { caseIdForPatient } from "@/lib/v2/notebook/caseId";
import type { AppProfile } from "@/lib/v2/auth/currentUser";
import { PATIENT_A_CANONICAL_INFORMATION_CATALOG } from "./patientA/canonicalInformationCatalog";
import { getPatientAGoldStandardV1OrNull } from "./patientA/goldStandardV1";
import {
  resolveGoldEvidenceForDocument,
  type ResolvedGoldCtp,
} from "./resolveEvidence";
import type { GoldStandardDocument } from "./types";

export type GoldStandardAccessResult =
  | { ok: true; document: GoldStandardDocument }
  | {
      ok: false;
      kind: "unauthorized" | "not_found" | "not_ready";
      message: string;
    };

export type GoldStandardDetailAccessResult =
  | {
      ok: true;
      document: GoldStandardDocument;
      resolvedPoints: readonly ResolvedGoldCtp[];
    }
  | {
      ok: false;
      kind:
        | "unauthorized"
        | "not_found"
        | "not_ready"
        | "evidence_unresolved";
      message: string;
      unresolvedIds?: readonly string[];
    };

export type GoldStandardListItem = {
  patientId: string;
  caseId: string;
  schemaVersion: number;
  title: string;
  ctpCount: number;
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

export function loadGoldStandardDocumentForPatient(
  patientId: string,
): GoldStandardAccessResult {
  const caseId = caseIdForPatient(patientId);
  if (!caseId) {
    return { ok: false, kind: "not_found", message: "unknown patient" };
  }

  if (patientId === "A" && caseId === "SP-001") {
    const doc = getPatientAGoldStandardV1OrNull();
    if (!doc) {
      return {
        ok: false,
        kind: "not_ready",
        message: "Patient A Gold Standard v1 failed to load or validate",
      };
    }
    return { ok: true, document: doc };
  }

  return { ok: false, kind: "not_found", message: "no gold standard for case" };
}

export function loadGoldStandardDetailForPatient(
  patientId: string,
): GoldStandardDetailAccessResult {
  const base = loadGoldStandardDocumentForPatient(patientId);
  if (!base.ok) return base;

  const resolved = resolveGoldEvidenceForDocument(
    base.document,
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

  return {
    ok: true,
    document: base.document,
    resolvedPoints: resolved.points,
  };
}

export function buildGoldStandardListItems(): readonly GoldStandardListItem[] {
  const loaded = loadGoldStandardDocumentForPatient("A");
  if (!loaded.ok) return [];
  return [
    {
      patientId: loaded.document.patientId,
      caseId: loaded.document.caseId,
      schemaVersion: loaded.document.schemaVersion,
      title: loaded.document.title ?? "Aさん Gold Standard",
      ctpCount: loaded.document.criticalThinkingPoints.length,
    },
  ];
}
