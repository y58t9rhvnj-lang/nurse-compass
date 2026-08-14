"use server";

// Compass Version2.1 — Form3 Day 2
// 様式3の読込・保存 Server Action（学生専用）。
//
// 方針:
//   ・全 Action で student ロールを明示的に要求する。
//   ・case_id はサーバの固定マッピングから解決し、クライアント申告値は使わない。
//   ・payload 内 patientId は検証済み patientId で上書きする（sanitizeForm3Payload）。
//   ・organization_id / academic_year / user_id は profile から付与する。
//   ・不正な isReviewed:true は false へ戻して本文は保存する（warning 同梱）。
//   ・競合は DB version による楽観ロックで検出し、最新 Snapshot を型安全に返す。
//   ・DB の生エラー・内部情報はクライアントへ返さない（分類済み kind のみ）。

import { isSupabaseConfigured } from "@/lib/v2/env";
import { getCurrentProfile, type AppProfile } from "@/lib/v2/auth/currentUser";
import { createServerSupabaseClient } from "@/lib/v2/supabase/serverClient";
import { caseIdForPatient } from "@/lib/v2/notebook/caseId";
import {
  rowToForm3Snapshot,
  sanitizeForm3Payload,
} from "@/lib/v2/notebook/form3Mapper";
import {
  getForm3,
  insertForm3,
  updateForm3WithVersion,
} from "@/lib/v2/notebook/form3Repository";
import {
  classifyDbError,
  toForm3ActionErrorKind,
  type Form3LoadResult,
  type Form3SaveInput,
  type Form3SaveResult,
} from "@/lib/v2/notebook/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type StudentContext =
  | { ok: true; supabase: SupabaseClient; profile: AppProfile }
  | { ok: false; kind: "auth_error"; message: string };

async function requireStudentContext(): Promise<StudentContext> {
  if (!isSupabaseConfigured()) {
    return { ok: false, kind: "auth_error", message: "backend not configured" };
  }
  const profile = await getCurrentProfile();
  if (!profile || !profile.isActive || profile.role !== "student") {
    return { ok: false, kind: "auth_error", message: "student login required" };
  }
  const supabase = await createServerSupabaseClient();
  return { ok: true, supabase, profile };
}

export async function loadForm3Action(
  patientId: string,
): Promise<Form3LoadResult> {
  const ctx = await requireStudentContext();
  if (!ctx.ok) return { ok: false, kind: ctx.kind, message: ctx.message };

  const caseId = caseIdForPatient(patientId);
  if (!caseId) {
    return { ok: false, kind: "validation_error", message: "unknown case" };
  }

  const { row, error } = await getForm3(ctx.supabase, ctx.profile.id, caseId);
  if (error) {
    return {
      ok: false,
      kind: toForm3ActionErrorKind(classifyDbError(error)),
      message: "failed to load form3",
    };
  }
  return { ok: true, data: row ? rowToForm3Snapshot(row, patientId) : null };
}

export async function saveForm3Action(
  input: Form3SaveInput,
): Promise<Form3SaveResult> {
  const ctx = await requireStudentContext();
  if (!ctx.ok) return { ok: false, kind: ctx.kind, message: ctx.message };

  const { patientId, payload, expectedVersion } = input;
  const caseId = caseIdForPatient(patientId);
  if (!caseId) {
    return { ok: false, kind: "validation_error", message: "unknown case" };
  }

  if (
    expectedVersion !== null &&
    (!Number.isInteger(expectedVersion) || expectedVersion < 1)
  ) {
    return { ok: false, kind: "validation_error", message: "invalid version" };
  }

  const { payload: safePayload, warnings } = sanitizeForm3Payload(
    payload,
    patientId,
  );

  // 初回作成
  if (expectedVersion === null) {
    const { row, error } = await insertForm3(ctx.supabase, {
      user_id: ctx.profile.id,
      organization_id: ctx.profile.organizationId,
      academic_year: ctx.profile.academicYear,
      case_id: caseId,
      payload: safePayload,
    });
    if (error) {
      const classified = classifyDbError(error);
      if (classified === "duplicate") {
        const { row: latest } = await getForm3(
          ctx.supabase,
          ctx.profile.id,
          caseId,
        );
        return {
          ok: false,
          kind: "conflict",
          message: "record already exists",
          latest: latest ? rowToForm3Snapshot(latest, patientId) : null,
        };
      }
      return {
        ok: false,
        kind: toForm3ActionErrorKind(classified),
        message: "failed to save form3",
      };
    }
    if (!row) {
      return {
        ok: false,
        kind: "database_error",
        message: "failed to save form3",
      };
    }
    return {
      ok: true,
      kind: "saved",
      data: rowToForm3Snapshot(row, patientId),
      warnings,
    };
  }

  // 楽観ロック更新
  const { row, error } = await updateForm3WithVersion(ctx.supabase, {
    userId: ctx.profile.id,
    caseId,
    expectedVersion,
    payload: safePayload,
  });
  if (error) {
    return {
      ok: false,
      kind: toForm3ActionErrorKind(classifyDbError(error)),
      message: "failed to save form3",
    };
  }
  if (!row) {
    const { row: latest } = await getForm3(ctx.supabase, ctx.profile.id, caseId);
    return {
      ok: false,
      kind: "conflict",
      message: "version conflict",
      latest: latest ? rowToForm3Snapshot(latest, patientId) : null,
    };
  }
  return {
    ok: true,
    kind: "saved",
    data: rowToForm3Snapshot(row, patientId),
    warnings,
  };
}
