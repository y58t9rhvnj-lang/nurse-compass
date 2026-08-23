import "server-only";

/**
 * 教員・管理者のみが Teacher Insight 本文へアクセスするためのゲート。
 * 学生 Server Action / クライアントからこのモジュールを import しないこと。
 * API は新設しない。ページ等の Server Component から呼ぶ。
 */

import type { Form3PatternKey } from "@/lib/form3/form3Types";
import { getCurrentProfile } from "@/lib/v2/auth/currentUser";
import {
  isTeacherOrAdminProfile,
  loadPatientATeacherInsights,
  loadResolvedTeacherInsightsByCtpIds,
  loadResolvedTeacherInsightsForCtp,
  loadTeacherInsightById,
  loadTeacherInsights,
  loadTeacherInsightsForCtp,
  loadTeacherInsightsForPattern,
  type TeacherInsightAccessResult,
  type TeacherInsightsAccessResult,
  type TeacherInsightsByCtpMapResult,
  type TeacherInsightsForCtpResolvedResult,
} from "./library";

export type {
  TeacherInsightAccessResult,
  TeacherInsightsAccessResult,
  TeacherInsightsByCtpMapResult,
  TeacherInsightsForCtpResolvedResult,
};

function unauthorized(): TeacherInsightsAccessResult {
  return {
    ok: false,
    kind: "unauthorized",
    message: "teacher or admin role required",
  };
}

function unauthorizedOne(): TeacherInsightAccessResult {
  return {
    ok: false,
    kind: "unauthorized",
    message: "teacher or admin role required",
  };
}

async function requireTeacher(): Promise<boolean> {
  const profile = await getCurrentProfile();
  return isTeacherOrAdminProfile(profile);
}

/** 全 Teacher Insight（教員ゲート付き） */
export async function getTeacherInsights(): Promise<TeacherInsightsAccessResult> {
  if (!(await requireTeacher())) return unauthorized();
  return loadTeacherInsights();
}

export async function getTeacherInsightById(
  id: string,
): Promise<TeacherInsightAccessResult> {
  if (!(await requireTeacher())) return unauthorizedOne();
  return loadTeacherInsightById(id);
}

export async function getPatientATeacherInsights(): Promise<TeacherInsightsAccessResult> {
  if (!(await requireTeacher())) return unauthorized();
  return loadPatientATeacherInsights();
}

export async function getTeacherInsightsForCtp(
  ctpId: string,
): Promise<TeacherInsightsAccessResult> {
  if (!(await requireTeacher())) return unauthorized();
  return loadTeacherInsightsForCtp(ctpId);
}

export async function getTeacherInsightsForPattern(
  patternKey: Form3PatternKey,
): Promise<TeacherInsightsAccessResult> {
  if (!(await requireTeacher())) return unauthorized();
  return loadTeacherInsightsForPattern(patternKey);
}

/**
 * CTP 向け Teacher Insight を Evidence 解決込みで返す。
 * 解決不能 ID は黙って落とさず evidence_unresolved にする。
 */
export async function getResolvedTeacherInsightsForCtp(
  ctpId: string,
): Promise<TeacherInsightsForCtpResolvedResult> {
  if (!(await requireTeacher())) {
    return {
      ok: false,
      kind: "unauthorized",
      message: "teacher or admin role required",
    };
  }
  return loadResolvedTeacherInsightsForCtp(ctpId);
}

/**
 * Gold Standard 詳細画面用: 複数 CTP の関連 Insights を一括解決。
 * relatedCtpIds はデータ側を正とし、画面に固定配列を置かない。
 */
export async function getResolvedTeacherInsightsByCtpIds(
  ctpIds: readonly string[],
): Promise<TeacherInsightsByCtpMapResult> {
  if (!(await requireTeacher())) {
    return {
      ok: false,
      kind: "unauthorized",
      message: "teacher or admin role required",
    };
  }
  return loadResolvedTeacherInsightsByCtpIds(ctpIds);
}
