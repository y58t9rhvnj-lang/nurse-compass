"use server";

// Compass Version2 β — Phase 3-2
// Stage1 情報カードの読込・作成・更新・論理削除 Server Action（学生専用）。
//
// 方針:
//   ・全 Action で student ロールを明示的に要求する（教員閲覧は Phase 3-5）。
//   ・patientId → case_id はサーバの固定マッピングから解決する。
//   ・patientId / createdBy / createdAt / updatedAt / user_id / organization_id /
//     academic_year はサーバ（またはDB既定）が決定する。created_by は常に 'student'。
//   ・update / release は expectedUpdatedAt を必須とする楽観ロック
//     （id + 所有者 + deleted_at is null + updated_at 一致）。
//   ・競合時は RLS 範囲内で取得した最新の有効カード（無ければ null）を同梱する。
//   ・DB の生エラー・内部情報はクライアントへ返さない。

import { isSupabaseConfigured } from "@/lib/v2/env";
import { getCurrentProfile, type AppProfile } from "@/lib/v2/auth/currentUser";
import { createServerSupabaseClient } from "@/lib/v2/supabase/serverClient";
import { isInformationSourceType } from "@/lib/information/informationCard";
import { caseIdForPatient } from "@/lib/v2/notebook/caseId";
import {
  cardPatchToUpdate,
  newCardToInsert,
  rowToInformationCard,
} from "@/lib/v2/notebook/informationCardMapper";
import {
  getActiveCardById,
  insertCard,
  listActiveCards,
  softDeleteCard,
  updateCardWithTimestamp,
} from "@/lib/v2/notebook/informationCardsRepository";
import {
  classifyDbError,
  type CardListResult,
  type CardMutationResult,
  type CardUpdatePatch,
  type NewCardInput,
} from "@/lib/v2/notebook/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type StudentContext =
  | { ok: true; supabase: SupabaseClient; profile: AppProfile; caseId: string }
  | { ok: false; kind: "not_configured" | "unauthorized" | "validation"; message: string };

// 学生ロール要求 ＋ patientId から case_id 解決までを一括で行う。
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

export async function listCardsAction(
  patientId: string,
): Promise<CardListResult> {
  const ctx = await requireStudentCase(patientId);
  if (!ctx.ok) return { ok: false, kind: ctx.kind, message: ctx.message };

  const { rows, error } = await listActiveCards(ctx.supabase, ctx.profile.id, ctx.caseId);
  if (error) {
    return { ok: false, kind: classifyDbError(error), message: "failed to load cards" };
  }
  return { ok: true, data: rows.map((r) => rowToInformationCard(r, patientId)) };
}

export async function createCardAction(
  input: NewCardInput,
): Promise<CardMutationResult> {
  const ctx = await requireStudentCase(input.patientId);
  if (!ctx.ok) return { ok: false, kind: ctx.kind, message: ctx.message };

  const content = typeof input.content === "string" ? input.content.trim() : "";
  if (content === "") {
    return { ok: false, kind: "validation", message: "content is required" };
  }
  if (!isInformationSourceType(input.sourceType)) {
    return { ok: false, kind: "validation", message: "invalid source type" };
  }
  if (typeof input.sourceLabel !== "string" || input.sourceLabel.trim() === "") {
    return { ok: false, kind: "validation", message: "source label is required" };
  }
  if (input.sortOrder !== undefined && (!Number.isInteger(input.sortOrder) || input.sortOrder < 0)) {
    return { ok: false, kind: "validation", message: "invalid sort order" };
  }

  const values = newCardToInsert(
    { ...input, content },
    {
      userId: ctx.profile.id,
      organizationId: ctx.profile.organizationId,
      academicYear: ctx.profile.academicYear,
      caseId: ctx.caseId,
    },
  );
  const { row, error } = await insertCard(ctx.supabase, values);
  if (error) {
    return { ok: false, kind: classifyDbError(error), message: "failed to create card" };
  }
  if (!row) return { ok: false, kind: "db_error", message: "failed to create card" };
  return { ok: true, data: rowToInformationCard(row, input.patientId) };
}

export async function updateCardAction(input: {
  patientId: string;
  id: string;
  expectedUpdatedAt: string;
  patch: CardUpdatePatch;
}): Promise<CardMutationResult> {
  const ctx = await requireStudentCase(input.patientId);
  if (!ctx.ok) return { ok: false, kind: ctx.kind, message: ctx.message };

  if (typeof input.id !== "string" || input.id === "") {
    return { ok: false, kind: "validation", message: "id is required" };
  }
  if (typeof input.expectedUpdatedAt !== "string" || input.expectedUpdatedAt === "") {
    return { ok: false, kind: "validation", message: "expectedUpdatedAt is required" };
  }
  // content を空へ更新することは許可しない（DB CHECK と二重化）。
  if (input.patch.content !== undefined && input.patch.content.trim() === "") {
    return { ok: false, kind: "validation", message: "content must not be empty" };
  }
  if (
    input.patch.sortOrder !== undefined &&
    (!Number.isInteger(input.patch.sortOrder) || input.patch.sortOrder < 0)
  ) {
    return { ok: false, kind: "validation", message: "invalid sort order" };
  }

  const update = cardPatchToUpdate(input.patch);
  if (Object.keys(update).length === 0) {
    return { ok: false, kind: "validation", message: "no updatable fields" };
  }

  const { row, error } = await updateCardWithTimestamp(ctx.supabase, {
    userId: ctx.profile.id,
    id: input.id,
    expectedUpdatedAt: input.expectedUpdatedAt,
    update,
  });
  if (error) {
    return { ok: false, kind: classifyDbError(error), message: "failed to update card" };
  }
  if (!row) {
    // updated_at 不一致・不在・論理削除済み → 競合。最新の有効カード（無ければ null）を同梱。
    const { row: latest } = await getActiveCardById(ctx.supabase, ctx.profile.id, input.id);
    return {
      ok: false,
      kind: "conflict",
      message: "card was modified elsewhere",
      latest: latest ? rowToInformationCard(latest, input.patientId) : null,
    };
  }
  return { ok: true, data: rowToInformationCard(row, input.patientId) };
}

export async function releaseCardAction(input: {
  patientId: string;
  id: string;
  expectedUpdatedAt: string;
}): Promise<CardMutationResult> {
  const ctx = await requireStudentCase(input.patientId);
  if (!ctx.ok) return { ok: false, kind: ctx.kind, message: ctx.message };

  if (typeof input.id !== "string" || input.id === "") {
    return { ok: false, kind: "validation", message: "id is required" };
  }
  if (typeof input.expectedUpdatedAt !== "string" || input.expectedUpdatedAt === "") {
    return { ok: false, kind: "validation", message: "expectedUpdatedAt is required" };
  }

  const { row, error } = await softDeleteCard(ctx.supabase, {
    userId: ctx.profile.id,
    id: input.id,
    expectedUpdatedAt: input.expectedUpdatedAt,
  });
  if (error) {
    return { ok: false, kind: classifyDbError(error), message: "failed to release card" };
  }
  if (!row) {
    const { row: latest } = await getActiveCardById(ctx.supabase, ctx.profile.id, input.id);
    return {
      ok: false,
      kind: "conflict",
      message: "card was modified elsewhere",
      latest: latest ? rowToInformationCard(latest, input.patientId) : null,
    };
  }
  return { ok: true, data: rowToInformationCard(row, input.patientId) };
}
