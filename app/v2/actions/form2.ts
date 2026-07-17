"use server";

// Compass Version2 β — Phase 3-2
// 様式2の読込・保存 Server Action（学生専用）。
//
// 方針:
//   ・全 Action で student ロールを明示的に要求する（教員閲覧は Phase 3-5）。
//   ・case_id はサーバの固定マッピングから解決し、クライアント申告値は使わない。
//   ・payload 内 patientId は検証済み patientId で上書きする（sanitizeForm2Payload）。
//   ・organization_id / academic_year / user_id は profile から付与する。
//   ・競合は DB version による楽観ロックで検出し、最新 Snapshot を型安全に返す。
//   ・DB の生エラー・内部情報はクライアントへ返さない（分類済み kind のみ）。

import { isSupabaseConfigured } from "@/lib/v2/env";
import { getCurrentProfile, type AppProfile } from "@/lib/v2/auth/currentUser";
import { createServerSupabaseClient } from "@/lib/v2/supabase/serverClient";
import { caseIdForPatient } from "@/lib/v2/notebook/caseId";
import {
  rowToForm2Snapshot,
  sanitizeForm2Payload,
} from "@/lib/v2/notebook/form2Mapper";
import {
  getForm2,
  insertForm2,
  updateForm2WithVersion,
} from "@/lib/v2/notebook/form2Repository";
import {
  classifyDbError,
  type Form2LoadResult,
  type Form2SaveInput,
  type Form2SaveResult,
} from "@/lib/v2/notebook/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type StudentContext =
  | { ok: true; supabase: SupabaseClient; profile: AppProfile }
  | { ok: false; kind: "not_configured" | "unauthorized"; message: string };

// 学生ロールを明示的に要求する。未設定・未認証・学生以外・無効はここで弾く。
async function requireStudentContext(): Promise<StudentContext> {
  if (!isSupabaseConfigured()) {
    return { ok: false, kind: "not_configured", message: "backend not configured" };
  }
  const profile = await getCurrentProfile();
  if (!profile || !profile.isActive || profile.role !== "student") {
    return { ok: false, kind: "unauthorized", message: "student login required" };
  }
  const supabase = await createServerSupabaseClient();
  return { ok: true, supabase, profile };
}

export async function loadForm2Action(
  patientId: string,
): Promise<Form2LoadResult> {
  const ctx = await requireStudentContext();
  if (!ctx.ok) return { ok: false, kind: ctx.kind, message: ctx.message };

  const caseId = caseIdForPatient(patientId);
  if (!caseId) return { ok: false, kind: "validation", message: "unknown case" };

  const { row, error } = await getForm2(ctx.supabase, ctx.profile.id, caseId);
  if (error) {
    return { ok: false, kind: classifyDbError(error), message: "failed to load form2" };
  }
  return { ok: true, data: row ? rowToForm2Snapshot(row, patientId) : null };
}

export async function saveForm2Action(
  input: Form2SaveInput,
): Promise<Form2SaveResult> {
  const ctx = await requireStudentContext();
  if (!ctx.ok) return { ok: false, kind: ctx.kind, message: ctx.message };

  const { patientId, payload, expectedVersion } = input;
  const caseId = caseIdForPatient(patientId);
  if (!caseId) return { ok: false, kind: "validation", message: "unknown case" };

  if (
    expectedVersion !== null &&
    (!Number.isInteger(expectedVersion) || expectedVersion < 1)
  ) {
    return { ok: false, kind: "validation", message: "invalid version" };
  }

  // payload をサーバ信頼の Form2Data へ正規化し、patientId を検証済み値で上書き。
  const safePayload = sanitizeForm2Payload(payload, patientId);

  // 初回作成
  if (expectedVersion === null) {
    const { row, error } = await insertForm2(ctx.supabase, {
      user_id: ctx.profile.id,
      organization_id: ctx.profile.organizationId,
      academic_year: ctx.profile.academicYear,
      case_id: caseId,
      payload: safePayload,
    });
    if (error) {
      const kind = classifyDbError(error);
      if (kind === "duplicate") {
        // 既に他端末で作成済み → 競合。最新を同梱して返す。
        const { row: latest } = await getForm2(ctx.supabase, ctx.profile.id, caseId);
        return {
          ok: false,
          kind: "conflict",
          message: "record already exists",
          latest: latest ? rowToForm2Snapshot(latest, patientId) : null,
        };
      }
      return { ok: false, kind, message: "failed to save form2" };
    }
    if (!row) return { ok: false, kind: "db_error", message: "failed to save form2" };
    return { ok: true, data: rowToForm2Snapshot(row, patientId) };
  }

  // 楽観ロック更新
  const { row, error } = await updateForm2WithVersion(ctx.supabase, {
    userId: ctx.profile.id,
    caseId,
    expectedVersion,
    payload: safePayload,
  });
  if (error) {
    return { ok: false, kind: classifyDbError(error), message: "failed to save form2" };
  }
  if (!row) {
    // version 不一致（他端末が先に更新）→ 最新を同梱して返す。
    const { row: latest } = await getForm2(ctx.supabase, ctx.profile.id, caseId);
    return {
      ok: false,
      kind: "conflict",
      message: "version conflict",
      latest: latest ? rowToForm2Snapshot(latest, patientId) : null,
    };
  }
  return { ok: true, data: rowToForm2Snapshot(row, patientId) };
}
