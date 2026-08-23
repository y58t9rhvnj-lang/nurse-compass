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
  loadTeacherInsightById,
  loadTeacherInsights,
  loadTeacherInsightsForCtp,
  loadTeacherInsightsForPattern,
  type TeacherInsightAccessResult,
  type TeacherInsightsAccessResult,
} from "./library";

export type { TeacherInsightAccessResult, TeacherInsightsAccessResult };

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
