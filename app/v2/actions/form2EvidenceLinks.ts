"use server";

// Compass Version2 — Learning Layer (Sprint D-2B)
// Evidence–様式2 根拠リンク（form2_evidence_links）の読込・作成・削除 Server Action（学生専用）。
//
// 方針（既存 informationCards / form2 の Action 設計を踏襲）:
//   ・全 Action で student ロールを明示的に要求する（教員閲覧は将来フェーズ）。
//   ・patientId → case_id はサーバの固定マッピングから解決する。
//   ・user_id / organization_id / academic_year / case_id / form2_record_id / created_by は
//     サーバが決定し、クライアント申告値は使わない。
//   ・form2_field_key は固定キー集合（lib/form2/form2FieldKeys）でのみ受理する（自由入力を許さない）。
//   ・evidence_id は「自分の有効な Evidence」であることを確認してから紐づける。
//   ・リンク作成時、様式2 レコードが未作成なら空レコードを用意して form2_record_id を確定する
//     （既存 insertForm2 を再利用。作成した snapshot を返し、クライアントの初回保存競合を避ける）。
//   ・DB の生エラー・内部情報はクライアントへ返さない（分類済み kind のみ）。

import { isSupabaseConfigured } from "@/lib/v2/env";
import { getCurrentProfile, type AppProfile } from "@/lib/v2/auth/currentUser";
import { createServerSupabaseClient } from "@/lib/v2/supabase/serverClient";
import { caseIdForPatient } from "@/lib/v2/notebook/caseId";
import { isForm2FieldKey } from "@/lib/form2/form2FieldKeys";
import { createEmptyForm2 } from "@/lib/form2/form2Types";
import { rowToForm2Snapshot, sanitizeForm2Payload } from "@/lib/v2/notebook/form2Mapper";
import { getForm2, insertForm2 } from "@/lib/v2/notebook/form2Repository";
import { getActiveCardById } from "@/lib/v2/notebook/informationCardsRepository";
import {
  deleteLinkOwned,
  deleteLinksByEvidence,
  insertLink,
  listLinksForCase,
} from "@/lib/v2/notebook/form2EvidenceLinksRepository";
import { rowToForm2EvidenceLink } from "@/lib/v2/notebook/form2EvidenceLinkMapper";
import { classifyDbError } from "@/lib/v2/notebook/types";
import type {
  LinkCreateResult,
  LinkDeleteResult,
  LinkListResult,
} from "@/lib/v2/notebook/form2EvidenceLinkTypes";
import type { SupabaseClient } from "@supabase/supabase-js";

type StudentContext =
  | { ok: true; supabase: SupabaseClient; profile: AppProfile; caseId: string }
  | { ok: false; kind: "not_configured" | "unauthorized" | "validation"; message: string };

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

export async function listForm2EvidenceLinksAction(
  patientId: string,
): Promise<LinkListResult> {
  const ctx = await requireStudentCase(patientId);
  if (!ctx.ok) return { ok: false, kind: ctx.kind, message: ctx.message };

  const { rows, error } = await listLinksForCase(ctx.supabase, ctx.profile.id, ctx.caseId);
  if (error) {
    return { ok: false, kind: classifyDbError(error), message: "failed to load links" };
  }
  return { ok: true, data: rows.map(rowToForm2EvidenceLink) };
}

export async function createForm2EvidenceLinkAction(input: {
  patientId: string;
  evidenceId: string;
  fieldKey: string;
}): Promise<LinkCreateResult> {
  const ctx = await requireStudentCase(input.patientId);
  if (!ctx.ok) return { ok: false, kind: ctx.kind, message: ctx.message };

  if (typeof input.evidenceId !== "string" || input.evidenceId === "") {
    return { ok: false, kind: "validation", message: "evidenceId is required" };
  }
  if (typeof input.fieldKey !== "string" || !isForm2FieldKey(input.fieldKey)) {
    return { ok: false, kind: "validation", message: "invalid field key" };
  }

  // 自分の有効な Evidence であることを確認（他人・論理削除済みは弾く）。
  const { row: evidence, error: evErr } = await getActiveCardById(
    ctx.supabase,
    ctx.profile.id,
    input.evidenceId,
  );
  if (evErr) {
    return { ok: false, kind: classifyDbError(evErr), message: "failed to verify evidence" };
  }
  if (!evidence) {
    return { ok: false, kind: "not_found", message: "evidence not found" };
  }

  // form2_record_id を確定する。未作成なら空レコードを用意（既存 insertForm2 を再利用）。
  const { row: existing, error: getErr } = await getForm2(
    ctx.supabase,
    ctx.profile.id,
    ctx.caseId,
  );
  if (getErr) {
    return { ok: false, kind: classifyDbError(getErr), message: "failed to resolve form2" };
  }

  let form2RecordId: string;
  let ensuredSnapshot: ReturnType<typeof rowToForm2Snapshot> | null = null;
  if (existing) {
    form2RecordId = existing.id;
  } else {
    const safePayload = sanitizeForm2Payload(
      createEmptyForm2(input.patientId),
      input.patientId,
    );
    const { row: created, error: insErr } = await insertForm2(ctx.supabase, {
      user_id: ctx.profile.id,
      organization_id: ctx.profile.organizationId,
      academic_year: ctx.profile.academicYear,
      case_id: ctx.caseId,
      payload: safePayload,
    });
    if (insErr) {
      // 競合（別経路で同時作成）の可能性 → 取り直す。
      const { row: retry } = await getForm2(ctx.supabase, ctx.profile.id, ctx.caseId);
      if (!retry) {
        return { ok: false, kind: classifyDbError(insErr), message: "failed to prepare form2" };
      }
      form2RecordId = retry.id;
    } else if (created) {
      form2RecordId = created.id;
      ensuredSnapshot = rowToForm2Snapshot(created, input.patientId);
    } else {
      return { ok: false, kind: "db_error", message: "failed to prepare form2" };
    }
  }

  const { row, error } = await insertLink(ctx.supabase, {
    user_id: ctx.profile.id,
    organization_id: ctx.profile.organizationId,
    academic_year: ctx.profile.academicYear,
    case_id: ctx.caseId,
    form2_record_id: form2RecordId,
    form2_field_key: input.fieldKey,
    evidence_id: input.evidenceId,
    created_by: "student",
  });
  if (error) {
    const kind = classifyDbError(error);
    if (kind === "duplicate") {
      // 同一リンクが既存（別端末・二重送信含む）。整理済みとして成功扱い。
      return { ok: true, data: null, duplicate: true, form2Ensured: ensuredSnapshot };
    }
    return { ok: false, kind, message: "failed to create link" };
  }
  if (!row) return { ok: false, kind: "db_error", message: "failed to create link" };
  return {
    ok: true,
    data: rowToForm2EvidenceLink(row),
    duplicate: false,
    form2Ensured: ensuredSnapshot,
  };
}

export async function deleteForm2EvidenceLinkAction(input: {
  patientId: string;
  id: string;
}): Promise<LinkDeleteResult> {
  const ctx = await requireStudentCase(input.patientId);
  if (!ctx.ok) return { ok: false, kind: ctx.kind, message: ctx.message };

  if (typeof input.id !== "string" || input.id === "") {
    return { ok: false, kind: "validation", message: "id is required" };
  }
  const { error } = await deleteLinkOwned(ctx.supabase, ctx.profile.id, input.id);
  if (error) {
    return { ok: false, kind: classifyDbError(error), message: "failed to delete link" };
  }
  return { ok: true };
}

// Evidence 解除（論理削除）時にそのリンクをまとめて物理削除する後始末用。
export async function deleteForm2EvidenceLinksByEvidenceAction(input: {
  patientId: string;
  evidenceId: string;
}): Promise<LinkDeleteResult> {
  const ctx = await requireStudentCase(input.patientId);
  if (!ctx.ok) return { ok: false, kind: ctx.kind, message: ctx.message };

  if (typeof input.evidenceId !== "string" || input.evidenceId === "") {
    return { ok: false, kind: "validation", message: "evidenceId is required" };
  }
  const { error } = await deleteLinksByEvidence(
    ctx.supabase,
    ctx.profile.id,
    ctx.caseId,
    input.evidenceId,
  );
  if (error) {
    return { ok: false, kind: classifyDbError(error), message: "failed to delete links" };
  }
  return { ok: true };
}
