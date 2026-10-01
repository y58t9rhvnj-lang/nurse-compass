"use server";

import { getCurrentProfile, type AppProfile } from "@/lib/v2/auth/currentUser";
import {
  canEditAnnouncementContent,
  canManageAnnouncements,
  canMarkAnnouncementRead,
  canReadPublishedAnnouncements,
  publishTimestamps,
  sameOrganization,
  studentCanMarkRead,
  studentCanSeeAnnouncement,
  unpublishTimestamps,
  validateAnnouncementFields,
} from "@/lib/v2/announcements/announcementPolicy";
import {
  getAnnouncementById,
  insertDraftAnnouncement,
  insertOwnAnnouncementRead,
  listAnnouncementsForOrg,
  listOwnAnnouncementReads,
  listPublishedAnnouncementsForOrg,
  updateAnnouncementRow,
} from "@/lib/v2/announcements/announcementRepository";
import type {
  AnnouncementActionFailure,
  AnnouncementRecord,
  StudentAnnouncementItem,
} from "@/lib/v2/announcements/announcementTypes";
import { isSupabaseConfigured } from "@/lib/v2/env";
import { createServerSupabaseClient } from "@/lib/v2/supabase/serverClient";
import type { SupabaseClient } from "@supabase/supabase-js";

type ActorContext =
  | { ok: true; supabase: SupabaseClient; profile: AppProfile }
  | AnnouncementActionFailure;

async function requireActor(): Promise<ActorContext> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      kind: "not_configured",
      message: "認証基盤が未設定です。",
    };
  }
  const profile = await getCurrentProfile();
  if (!profile || !profile.isActive) {
    return {
      ok: false,
      kind: "unauthorized",
      message: "ログインが必要です。",
    };
  }
  const supabase = await createServerSupabaseClient();
  return { ok: true, supabase, profile };
}

function staffDenied(): AnnouncementActionFailure {
  return {
    ok: false,
    kind: "unauthorized",
    message: "教員または管理者としてログインしてください。",
  };
}

function studentDenied(): AnnouncementActionFailure {
  return {
    ok: false,
    kind: "unauthorized",
    message: "学生としてログインしてください。",
  };
}

export async function createAnnouncementDraftAction(input: {
  title: string;
  body: string;
}): Promise<
  { ok: true; announcement: AnnouncementRecord } | AnnouncementActionFailure
> {
  const ctx = await requireActor();
  if (!ctx.ok) return ctx;
  if (!canManageAnnouncements(ctx.profile.role, ctx.profile.isActive)) {
    return staffDenied();
  }
  const fields = validateAnnouncementFields(input.title, input.body);
  if (!fields.ok) return fields;
  const inserted = await insertDraftAnnouncement(ctx.supabase, {
    organizationId: ctx.profile.organizationId,
    title: fields.title,
    body: fields.body,
    createdBy: ctx.profile.id,
  });
  if (inserted.error || !inserted.row) {
    return { ok: false, kind: "db_error", message: "お知らせを作成できませんでした。" };
  }
  return { ok: true, announcement: inserted.row };
}

export async function updateAnnouncementDraftAction(input: {
  id: string;
  title: string;
  body: string;
}): Promise<
  { ok: true; announcement: AnnouncementRecord } | AnnouncementActionFailure
> {
  const ctx = await requireActor();
  if (!ctx.ok) return ctx;
  if (!canManageAnnouncements(ctx.profile.role, ctx.profile.isActive)) {
    return staffDenied();
  }
  const fields = validateAnnouncementFields(input.title, input.body);
  if (!fields.ok) return fields;
  const existing = await getAnnouncementById(ctx.supabase, input.id);
  if (existing.error) {
    return { ok: false, kind: "db_error", message: "お知らせを読み込めませんでした。" };
  }
  if (
    !existing.row ||
    !sameOrganization(ctx.profile.organizationId, existing.row.organizationId)
  ) {
    return { ok: false, kind: "not_found", message: "お知らせが見つかりません。" };
  }
  if (!canEditAnnouncementContent(existing.row.status)) {
    return {
      ok: false,
      kind: "conflict",
      message: "公開中または取り下げ済みのお知らせは編集できません。",
    };
  }
  const updated = await updateAnnouncementRow(ctx.supabase, existing.row.id, {
    title: fields.title,
    body: fields.body,
  });
  if (updated.error || !updated.row) {
    return { ok: false, kind: "db_error", message: "お知らせを更新できませんでした。" };
  }
  return { ok: true, announcement: updated.row };
}

export async function publishAnnouncementAction(input: {
  id: string;
}): Promise<
  { ok: true; announcement: AnnouncementRecord } | AnnouncementActionFailure
> {
  const ctx = await requireActor();
  if (!ctx.ok) return ctx;
  if (!canManageAnnouncements(ctx.profile.role, ctx.profile.isActive)) {
    return staffDenied();
  }
  const existing = await getAnnouncementById(ctx.supabase, input.id);
  if (existing.error) {
    return { ok: false, kind: "db_error", message: "お知らせを読み込めませんでした。" };
  }
  if (
    !existing.row ||
    !sameOrganization(ctx.profile.organizationId, existing.row.organizationId)
  ) {
    return { ok: false, kind: "not_found", message: "お知らせが見つかりません。" };
  }
  const next = publishTimestamps(
    existing.row.status,
    new Date().toISOString(),
    existing.row.publishedAt,
  );
  if (!next) {
    return {
      ok: false,
      kind: "conflict",
      message:
        "下書きだけ公開できます。取り下げたお知らせは新しい下書きから作成してください。",
    };
  }
  const updated = await updateAnnouncementRow(ctx.supabase, existing.row.id, {
    status: next.status,
    publishedAt: next.publishedAt,
    unpublishedAt: next.unpublishedAt,
  });
  if (updated.error || !updated.row) {
    return { ok: false, kind: "db_error", message: "お知らせを公開できませんでした。" };
  }
  return { ok: true, announcement: updated.row };
}

export async function unpublishAnnouncementAction(input: {
  id: string;
}): Promise<
  { ok: true; announcement: AnnouncementRecord } | AnnouncementActionFailure
> {
  const ctx = await requireActor();
  if (!ctx.ok) return ctx;
  if (!canManageAnnouncements(ctx.profile.role, ctx.profile.isActive)) {
    return staffDenied();
  }
  const existing = await getAnnouncementById(ctx.supabase, input.id);
  if (existing.error) {
    return { ok: false, kind: "db_error", message: "お知らせを読み込めませんでした。" };
  }
  if (
    !existing.row ||
    !sameOrganization(ctx.profile.organizationId, existing.row.organizationId)
  ) {
    return { ok: false, kind: "not_found", message: "お知らせが見つかりません。" };
  }
  const next = unpublishTimestamps(
    existing.row.status,
    new Date().toISOString(),
    existing.row.publishedAt,
  );
  if (!next) {
    return {
      ok: false,
      kind: "conflict",
      message: "公開中のお知らせだけ取り下げできます。",
    };
  }
  const updated = await updateAnnouncementRow(ctx.supabase, existing.row.id, {
    status: next.status,
    publishedAt: next.publishedAt,
    unpublishedAt: next.unpublishedAt,
  });
  if (updated.error || !updated.row) {
    return { ok: false, kind: "db_error", message: "お知らせを取り下げできませんでした。" };
  }
  return { ok: true, announcement: updated.row };
}

export async function getStaffAnnouncementAction(input: {
  id: string;
}): Promise<
  { ok: true; announcement: AnnouncementRecord } | AnnouncementActionFailure
> {
  const ctx = await requireActor();
  if (!ctx.ok) return ctx;
  if (!canManageAnnouncements(ctx.profile.role, ctx.profile.isActive)) {
    return staffDenied();
  }
  const existing = await getAnnouncementById(ctx.supabase, input.id);
  if (existing.error) {
    return { ok: false, kind: "db_error", message: "お知らせを読み込めませんでした。" };
  }
  if (
    !existing.row ||
    !sameOrganization(ctx.profile.organizationId, existing.row.organizationId)
  ) {
    return { ok: false, kind: "not_found", message: "お知らせが見つかりません。" };
  }
  return { ok: true, announcement: existing.row };
}

export async function listStaffAnnouncementsAction(): Promise<
  { ok: true; announcements: AnnouncementRecord[] } | AnnouncementActionFailure
> {
  const ctx = await requireActor();
  if (!ctx.ok) return ctx;
  if (!canManageAnnouncements(ctx.profile.role, ctx.profile.isActive)) {
    return staffDenied();
  }
  const listed = await listAnnouncementsForOrg(
    ctx.supabase,
    ctx.profile.organizationId,
  );
  if (listed.error) {
    return { ok: false, kind: "db_error", message: "お知らせを読み込めませんでした。" };
  }
  return { ok: true, announcements: listed.rows };
}

export async function listPublishedAnnouncementsAction(): Promise<
  { ok: true; items: StudentAnnouncementItem[] } | AnnouncementActionFailure
> {
  const ctx = await requireActor();
  if (!ctx.ok) return ctx;
  if (!canReadPublishedAnnouncements(ctx.profile.role, ctx.profile.isActive)) {
    return studentDenied();
  }
  const [listed, reads] = await Promise.all([
    listPublishedAnnouncementsForOrg(ctx.supabase, ctx.profile.organizationId),
    listOwnAnnouncementReads(ctx.supabase, ctx.profile.id),
  ]);
  if (listed.error || reads.error) {
    return { ok: false, kind: "db_error", message: "お知らせを読み込めませんでした。" };
  }
  const readAtById = new Map(
    reads.rows.map((row) => [row.announcementId, row.readAt]),
  );
  const items: StudentAnnouncementItem[] = listed.rows
    .filter(
      (row) =>
        studentCanSeeAnnouncement(row.status) &&
        sameOrganization(ctx.profile.organizationId, row.organizationId) &&
        row.publishedAt,
    )
    .map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      publishedAt: row.publishedAt as string,
      readAt: readAtById.get(row.id) ?? null,
    }));
  return { ok: true, items };
}

export async function markAnnouncementReadAction(input: {
  id: string;
}): Promise<
  { ok: true; readAt: string; alreadyRead: boolean } | AnnouncementActionFailure
> {
  const ctx = await requireActor();
  if (!ctx.ok) return ctx;
  if (!canMarkAnnouncementRead(ctx.profile.role, ctx.profile.isActive)) {
    return studentDenied();
  }
  const existing = await getAnnouncementById(ctx.supabase, input.id);
  if (existing.error) {
    return { ok: false, kind: "db_error", message: "お知らせを読み込めませんでした。" };
  }
  if (
    !existing.row ||
    !sameOrganization(ctx.profile.organizationId, existing.row.organizationId) ||
    !studentCanSeeAnnouncement(existing.row.status)
  ) {
    return { ok: false, kind: "not_found", message: "お知らせが見つかりません。" };
  }
  if (!studentCanMarkRead(existing.row.status)) {
    return {
      ok: false,
      kind: "conflict",
      message: "公開中のお知らせだけ確認できます。",
    };
  }
  const inserted = await insertOwnAnnouncementRead(ctx.supabase, {
    announcementId: existing.row.id,
    userId: ctx.profile.id,
    organizationId: ctx.profile.organizationId,
  });
  if (inserted.error || !inserted.readAt) {
    return { ok: false, kind: "db_error", message: "確認を記録できませんでした。" };
  }
  return {
    ok: true,
    readAt: inserted.readAt,
    alreadyRead: inserted.alreadyRead,
  };
}
