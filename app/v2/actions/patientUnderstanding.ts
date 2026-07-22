"use server";

// Compass Version2 — Learning Layer (Sprint D-2C)
// 患者理解「私が捉えた患者さん」（patient_understanding_records）の取得・保存 Server Action（学生専用）。
//
// 方針（既存 informationCards / form2 / links の Action 設計を踏襲）:
//   ・全 Action で student ロールを明示的に要求する。
//   ・patientId → case_id はサーバの固定マッピングから解決する。
//   ・user_id / organization_id / academic_year / case_id / patient_id はサーバが決定し保存する。
//   ・学生 × ケースで 1 件を upsert（上書き保存）。DB の生エラーはクライアントへ返さない。

import { isSupabaseConfigured } from "@/lib/v2/env";
import { getCurrentProfile, type AppProfile } from "@/lib/v2/auth/currentUser";
import { createServerSupabaseClient } from "@/lib/v2/supabase/serverClient";
import { caseIdForPatient } from "@/lib/v2/notebook/caseId";
import {
  getPatientUnderstanding,
  upsertPatientUnderstanding,
} from "@/lib/v2/notebook/patientUnderstandingRepository";
import { rowToPatientUnderstanding } from "@/lib/v2/notebook/patientUnderstandingMapper";
import { classifyDbError } from "@/lib/v2/notebook/types";
import type {
  PatientUnderstandingLoadResult,
  PatientUnderstandingSaveResult,
} from "@/lib/v2/notebook/patientUnderstandingTypes";
import type { SupabaseClient } from "@supabase/supabase-js";

type StudentContext =
  | { ok: true; supabase: SupabaseClient; profile: AppProfile; caseId: string }
  | {
      ok: false;
      kind: "not_configured" | "unauthorized" | "validation";
      message: string;
    };

async function requireStudentCase(patientId: string): Promise<StudentContext> {
  if (!isSupabaseConfigured()) {
    return { ok: false, kind: "not_configured", message: "backend not configured" };
  }
  const profile = await getCurrentProfile();
  if (!profile || !profile.isActive || profile.role !== "student") {
    return { ok: false, kind: "unauthorized", message: "student login required" };
  }
  const caseId = caseIdForPatient(patientId);
  if (!caseId) return { ok: false, kind: "validation", message: "unknown case" };
  const supabase = await createServerSupabaseClient();
  return { ok: true, supabase, profile, caseId };
}

export async function getPatientUnderstandingAction(
  patientId: string,
): Promise<PatientUnderstandingLoadResult> {
  const ctx = await requireStudentCase(patientId);
  if (!ctx.ok) return { ok: false, kind: ctx.kind, message: ctx.message };

  const { row, error } = await getPatientUnderstanding(
    ctx.supabase,
    ctx.profile.id,
    ctx.caseId,
  );
  if (error) {
    return {
      ok: false,
      kind: classifyDbError(error),
      message: "failed to load patient understanding",
    };
  }
  return { ok: true, data: row ? rowToPatientUnderstanding(row) : null };
}

export async function savePatientUnderstandingAction(input: {
  patientId: string;
  overviewText: string;
}): Promise<PatientUnderstandingSaveResult> {
  const ctx = await requireStudentCase(input.patientId);
  if (!ctx.ok) return { ok: false, kind: ctx.kind, message: ctx.message };

  if (typeof input.overviewText !== "string") {
    return { ok: false, kind: "validation", message: "overviewText is required" };
  }
  // 過大入力を抑制（学生の記述量として十分な上限。DB 破壊・過負荷の予防）。
  const overviewText = input.overviewText.slice(0, 20000);

  const { row, error } = await upsertPatientUnderstanding(ctx.supabase, {
    user_id: ctx.profile.id,
    organization_id: ctx.profile.organizationId,
    academic_year: ctx.profile.academicYear,
    case_id: ctx.caseId,
    patient_id: input.patientId,
    overview_text: overviewText,
  });
  if (error) {
    return {
      ok: false,
      kind: classifyDbError(error),
      message: "failed to save patient understanding",
    };
  }
  if (!row) {
    return { ok: false, kind: "db_error", message: "failed to save patient understanding" };
  }
  return { ok: true, data: rowToPatientUnderstanding(row) };
}
