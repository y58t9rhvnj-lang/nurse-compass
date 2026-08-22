import "server-only";

/**
 * 教員・管理者のみが Gold Standard 本体へアクセスするためのゲート。
 * 学生 Server Action / クライアントからこのモジュールを import しないこと。
 */

import { getCurrentProfile } from "@/lib/v2/auth/currentUser";
import { caseIdForPatient } from "@/lib/v2/notebook/caseId";
import { PATIENT_A_CANONICAL_INFORMATION_CATALOG } from "./patientA/canonicalInformationCatalog";
import { getPatientAGoldStandardV1OrNull } from "./patientA/goldStandardV1";
import type { GoldStandardDocument } from "./types";

export type GoldStandardAccessResult =
  | { ok: true; document: GoldStandardDocument }
  | {
      ok: false;
      kind: "unauthorized" | "not_found" | "not_ready";
      message: string;
    };

/**
 * 教員/管理者セッションでのみ Gold Standard を返す（redirect しない）。
 * ソース JSON 未移植時は not_ready。
 */
export async function requireTeacherGoldStandard(
  patientId: string,
): Promise<GoldStandardAccessResult> {
  const profile = await getCurrentProfile();
  if (
    !profile ||
    !profile.isActive ||
    profile.mustChangePassword ||
    (profile.role !== "teacher" && profile.role !== "admin")
  ) {
    return {
      ok: false,
      kind: "unauthorized",
      message: "teacher or admin role required",
    };
  }

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

/** カタログのみ（模範思考本文を含まない）。 */
export function getPatientAInformationCatalogForGold() {
  return PATIENT_A_CANONICAL_INFORMATION_CATALOG;
}
