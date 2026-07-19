"use server";

// Compass Version2 — Compass Memo Supabase Integration (Phase 1)
// Compassメモ（student_notes）の読込・作成・更新・論理削除 Server Action（学生専用）。
// information_cards の Server Action 設計に合わせる。
//
// 方針:
//   ・全 Action で student ロールを明示的に要求する（教員・管理者は利用不可）。
//   ・patientId → case_id はサーバの固定表（caseIdForPatient）から解決する。受け持ち以外は拒否。
//   ・id はクライアント生成値をそのまま使う（text PK ／ Evidence source_reference.id 互換）。空文字は不可。
//   ・patient_id / user_id / organization_id / academic_year / case_id / created_at / updated_at /
//     deleted_at はサーバ（またはDB既定）が決定する。クライアント値は使わない。
//   ・update / softDelete は expectedUpdatedAt を必須とする楽観ロック
//     （id + 所有者 + deleted_at is null + updated_at 一致）。
//   ・競合時は RLS 範囲内で取得した最新の有効メモ（無ければ null）を同梱する。
//   ・DB の生エラー・内部情報はクライアントへ返さない（classifyDbError で分類）。
//   ・localStorage 移行は実装しない。

import { isSupabaseConfigured } from "@/lib/v2/env";
import { getCurrentProfile, type AppProfile } from "@/lib/v2/auth/currentUser";
import { createServerSupabaseClient } from "@/lib/v2/supabase/serverClient";
import { caseIdForPatient } from "@/lib/v2/notebook/caseId";
import {
  newStudentNoteToInsert,
  noteContentUpdate,
  rowToStudentNoteRecord,
  type StudentNoteListResult,
  type StudentNoteMutationResult,
} from "@/lib/v2/notebook/studentNoteMapper";
import {
  getActiveNoteById,
  insertNote,
  listActiveNotes,
  softDeleteNote,
  updateNoteWithTimestamp,
} from "@/lib/v2/notebook/studentNotesRepository";
import { classifyDbError } from "@/lib/v2/notebook/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type StudentContext =
  | { ok: true; supabase: SupabaseClient; profile: AppProfile; caseId: string }
  | {
      ok: false;
      kind: "not_configured" | "unauthorized" | "validation";
      message: string;
    };

// 学生ロール要求 ＋ patientId から case_id 解決（受け持ち以外は validation で拒否）。
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

export async function listNotesAction(
  patientId: string,
): Promise<StudentNoteListResult> {
  const ctx = await requireStudentCase(patientId);
  if (!ctx.ok) return { ok: false, kind: ctx.kind, message: ctx.message };

  const { rows, error } = await listActiveNotes(ctx.supabase, ctx.profile.id, ctx.caseId);
  if (error) {
    return { ok: false, kind: classifyDbError(error), message: "failed to load notes" };
  }
  return { ok: true, data: rows.map(rowToStudentNoteRecord) };
}

export async function createNoteAction(input: {
  patientId: string;
  id: string;
  text: string;
}): Promise<StudentNoteMutationResult> {
  const ctx = await requireStudentCase(input.patientId);
  if (!ctx.ok) return { ok: false, kind: ctx.kind, message: ctx.message };

  // id はクライアント生成値（text PK）。空文字は不可（DB CHECK btrim(id)<>'' と二重化）。値は加工しない。
  if (typeof input.id !== "string" || input.id.trim() === "") {
    return { ok: false, kind: "validation", message: "id is required" };
  }
  const text = typeof input.text === "string" ? input.text.trim() : "";
  if (text === "") {
    return { ok: false, kind: "validation", message: "text is required" };
  }

  const values = newStudentNoteToInsert(
    { id: input.id, text },
    {
      userId: ctx.profile.id,
      organizationId: ctx.profile.organizationId,
      academicYear: ctx.profile.academicYear,
      caseId: ctx.caseId,
      patientId: input.patientId,
    },
  );
  const { row, error } = await insertNote(ctx.supabase, values);
  if (error) {
    return { ok: false, kind: classifyDbError(error), message: "failed to create note" };
  }
  if (!row) return { ok: false, kind: "db_error", message: "failed to create note" };
  return { ok: true, data: rowToStudentNoteRecord(row) };
}

export async function updateNoteAction(input: {
  patientId: string;
  id: string;
  expectedUpdatedAt: string;
  text: string;
}): Promise<StudentNoteMutationResult> {
  const ctx = await requireStudentCase(input.patientId);
  if (!ctx.ok) return { ok: false, kind: ctx.kind, message: ctx.message };

  if (typeof input.id !== "string" || input.id.trim() === "") {
    return { ok: false, kind: "validation", message: "id is required" };
  }
  if (typeof input.expectedUpdatedAt !== "string" || input.expectedUpdatedAt === "") {
    return { ok: false, kind: "validation", message: "expectedUpdatedAt is required" };
  }
  const text = typeof input.text === "string" ? input.text.trim() : "";
  if (text === "") {
    return { ok: false, kind: "validation", message: "text must not be empty" };
  }

  const { row, error } = await updateNoteWithTimestamp(ctx.supabase, {
    userId: ctx.profile.id,
    id: input.id,
    expectedUpdatedAt: input.expectedUpdatedAt,
    update: noteContentUpdate(text),
  });
  if (error) {
    return { ok: false, kind: classifyDbError(error), message: "failed to update note" };
  }
  if (!row) {
    // updated_at 不一致・不在・論理削除済み → 競合。最新の有効メモ（無ければ null）を同梱。
    const { row: latest } = await getActiveNoteById(ctx.supabase, ctx.profile.id, input.id);
    return {
      ok: false,
      kind: "conflict",
      message: "note was modified elsewhere",
      latest: latest ? rowToStudentNoteRecord(latest) : null,
    };
  }
  return { ok: true, data: rowToStudentNoteRecord(row) };
}

export async function softDeleteNoteAction(input: {
  patientId: string;
  id: string;
  expectedUpdatedAt: string;
}): Promise<StudentNoteMutationResult> {
  const ctx = await requireStudentCase(input.patientId);
  if (!ctx.ok) return { ok: false, kind: ctx.kind, message: ctx.message };

  if (typeof input.id !== "string" || input.id.trim() === "") {
    return { ok: false, kind: "validation", message: "id is required" };
  }
  if (typeof input.expectedUpdatedAt !== "string" || input.expectedUpdatedAt === "") {
    return { ok: false, kind: "validation", message: "expectedUpdatedAt is required" };
  }

  const { row, error } = await softDeleteNote(ctx.supabase, {
    userId: ctx.profile.id,
    id: input.id,
    expectedUpdatedAt: input.expectedUpdatedAt,
  });
  if (error) {
    return { ok: false, kind: classifyDbError(error), message: "failed to delete note" };
  }
  if (!row) {
    const { row: latest } = await getActiveNoteById(ctx.supabase, ctx.profile.id, input.id);
    return {
      ok: false,
      kind: "conflict",
      message: "note was modified elsewhere",
      latest: latest ? rowToStudentNoteRecord(latest) : null,
    };
  }
  return { ok: true, data: rowToStudentNoteRecord(row) };
}
