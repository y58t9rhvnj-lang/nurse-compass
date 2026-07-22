"use server";

// Compass Version2 — Learning Layer (Sprint D-3A)
// 「各項目から考えたこと」（form2_field_reflections）の取得・保存 Server Action（学生専用）。
//
// 方針（既存 patientUnderstanding / form2 / links の Action 設計を踏襲）:
//   ・全 Action で student ロールを明示的に要求する。
//   ・patientId → case_id はサーバの固定マッピングから解決する。
//   ・form2_field_key は様式2 の固定キー集合（form2FieldKeys / 0010・0012 の CHECK）に限定する。
//   ・user_id / organization_id / academic_year / case_id / patient_id はサーバが決定し保存する。
//   ・学生 × ケース × 項目 で 1 件を upsert（上書き保存）。DB の生エラーはクライアントへ返さない。

import { isSupabaseConfigured } from "@/lib/v2/env";
import { getCurrentProfile, type AppProfile } from "@/lib/v2/auth/currentUser";
import { createServerSupabaseClient } from "@/lib/v2/supabase/serverClient";
import { caseIdForPatient } from "@/lib/v2/notebook/caseId";
import { isForm2FieldKey } from "@/lib/form2/form2FieldKeys";
import {
  listForm2FieldReflections,
  upsertForm2FieldReflection,
} from "@/lib/v2/notebook/form2FieldReflectionRepository";
import { rowToForm2FieldReflection } from "@/lib/v2/notebook/form2FieldReflectionMapper";
import { classifyDbError } from "@/lib/v2/notebook/types";
import type {
  Form2FieldReflectionListResult,
  Form2FieldReflectionSaveResult,
} from "@/lib/v2/notebook/form2FieldReflectionTypes";
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

export async function listForm2FieldReflectionsAction(
  patientId: string,
): Promise<Form2FieldReflectionListResult> {
  const ctx = await requireStudentCase(patientId);
  if (!ctx.ok) return { ok: false, kind: ctx.kind, message: ctx.message };

  const { rows, error } = await listForm2FieldReflections(
    ctx.supabase,
    ctx.profile.id,
    ctx.caseId,
  );
  if (error) {
    return {
      ok: false,
      kind: classifyDbError(error),
      message: "failed to load reflections",
    };
  }
  return { ok: true, data: rows.map(rowToForm2FieldReflection) };
}

export async function saveForm2FieldReflectionAction(input: {
  patientId: string;
  fieldKey: string;
  reflectionText: string;
}): Promise<Form2FieldReflectionSaveResult> {
  const ctx = await requireStudentCase(input.patientId);
  if (!ctx.ok) return { ok: false, kind: ctx.kind, message: ctx.message };

  // 項目キーは固定集合のみ許可（自由入力による揺れ・DB CHECK 違反を防ぐ）。
  if (!isForm2FieldKey(input.fieldKey)) {
    return { ok: false, kind: "validation", message: "unknown field key" };
  }
  if (typeof input.reflectionText !== "string") {
    return { ok: false, kind: "validation", message: "reflectionText is required" };
  }
  // 過大入力を抑制（項目単位の考察として十分な上限）。
  const reflectionText = input.reflectionText.slice(0, 8000);

  const { row, error } = await upsertForm2FieldReflection(ctx.supabase, {
    user_id: ctx.profile.id,
    organization_id: ctx.profile.organizationId,
    academic_year: ctx.profile.academicYear,
    case_id: ctx.caseId,
    patient_id: input.patientId,
    form2_field_key: input.fieldKey,
    reflection_text: reflectionText,
  });
  if (error) {
    return {
      ok: false,
      kind: classifyDbError(error),
      message: "failed to save reflection",
    };
  }
  if (!row) {
    return { ok: false, kind: "db_error", message: "failed to save reflection" };
  }
  return { ok: true, data: rowToForm2FieldReflection(row) };
}
