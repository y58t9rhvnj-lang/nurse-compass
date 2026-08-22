import "server-only";

/**
 * 教員・管理者のみが Gold Standard 本体へアクセスするためのゲート。
 * 学生 Server Action / クライアントからこのモジュールを import しないこと。
 */

import { getCurrentProfile } from "@/lib/v2/auth/currentUser";
import { PATIENT_A_CANONICAL_INFORMATION_CATALOG } from "./patientA/canonicalInformationCatalog";
import {
  buildGoldStandardListItems,
  isTeacherOrAdminProfile,
  loadGoldStandardDetailForPatient,
  loadGoldStandardDocumentForPatient,
  type GoldStandardDetailAccessResult,
  type GoldStandardListItem,
  type GoldStandardAccessResult,
} from "./teacherGate";

export type {
  GoldStandardAccessResult,
  GoldStandardDetailAccessResult,
  GoldStandardListItem,
} from "./teacherGate";

/**
 * 教員/管理者セッションでのみ Gold Standard を返す（redirect しない）。
 */
export async function requireTeacherGoldStandard(
  patientId: string,
): Promise<GoldStandardAccessResult> {
  const profile = await getCurrentProfile();
  if (!isTeacherOrAdminProfile(profile)) {
    return {
      ok: false,
      kind: "unauthorized",
      message: "teacher or admin role required",
    };
  }
  return loadGoldStandardDocumentForPatient(patientId);
}

/**
 * 詳細表示用。Evidence をカタログ解決し、解決不能なら失敗を返す。
 */
export async function requireTeacherGoldStandardDetail(
  patientId: string,
): Promise<GoldStandardDetailAccessResult> {
  const profile = await getCurrentProfile();
  if (!isTeacherOrAdminProfile(profile)) {
    return {
      ok: false,
      kind: "unauthorized",
      message: "teacher or admin role required",
    };
  }
  return loadGoldStandardDetailForPatient(patientId);
}

/** 一覧用メタ（教員ゲート付き）。現時点は A さん 1 件。 */
export async function requireTeacherGoldStandardList(): Promise<
  | { ok: true; items: readonly GoldStandardListItem[] }
  | { ok: false; kind: "unauthorized"; message: string }
> {
  const profile = await getCurrentProfile();
  if (!isTeacherOrAdminProfile(profile)) {
    return {
      ok: false,
      kind: "unauthorized",
      message: "teacher or admin role required",
    };
  }
  return { ok: true, items: buildGoldStandardListItems() };
}

/** カタログのみ（模範思考本文を含まない）。 */
export function getPatientAInformationCatalogForGold() {
  return PATIENT_A_CANONICAL_INFORMATION_CATALOG;
}
