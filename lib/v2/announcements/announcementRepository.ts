import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AnnouncementRecord,
  AnnouncementStatus,
} from "./announcementTypes";

const ANNOUNCEMENT_COLUMNS =
  "id, organization_id, title, body, status, published_at, unpublished_at, created_by, created_at, updated_at";

type PgLikeError = { message?: string; code?: string } | null;

type AnnouncementRow = {
  id: string;
  organization_id: string;
  title: string;
  body: string;
  status: AnnouncementStatus;
  published_at: string | null;
  unpublished_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

function mapAnnouncement(row: AnnouncementRow): AnnouncementRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    title: row.title,
    body: row.body,
    status: row.status,
    publishedAt: row.published_at,
    unpublishedAt: row.unpublished_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function insertDraftAnnouncement(
  supabase: SupabaseClient,
  values: {
    organizationId: string;
    title: string;
    body: string;
    createdBy: string;
  },
): Promise<{ row: AnnouncementRecord | null; error: PgLikeError }> {
  const { data, error } = await supabase
    .from("announcements")
    .insert({
      organization_id: values.organizationId,
      title: values.title,
      body: values.body,
      status: "draft",
      published_at: null,
      unpublished_at: null,
      created_by: values.createdBy,
    })
    .select(ANNOUNCEMENT_COLUMNS)
    .maybeSingle();
  return {
    row: data ? mapAnnouncement(data as AnnouncementRow) : null,
    error: error as PgLikeError,
  };
}

export async function getAnnouncementById(
  supabase: SupabaseClient,
  id: string,
): Promise<{ row: AnnouncementRecord | null; error: PgLikeError }> {
  const { data, error } = await supabase
    .from("announcements")
    .select(ANNOUNCEMENT_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  return {
    row: data ? mapAnnouncement(data as AnnouncementRow) : null,
    error: error as PgLikeError,
  };
}

export async function listAnnouncementsForOrg(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<{ rows: AnnouncementRecord[]; error: PgLikeError }> {
  const { data, error } = await supabase
    .from("announcements")
    .select(ANNOUNCEMENT_COLUMNS)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  return {
    rows: ((data as AnnouncementRow[] | null) ?? []).map(mapAnnouncement),
    error: error as PgLikeError,
  };
}

export async function listPublishedAnnouncementsForOrg(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<{ rows: AnnouncementRecord[]; error: PgLikeError }> {
  const { data, error } = await supabase
    .from("announcements")
    .select(ANNOUNCEMENT_COLUMNS)
    .eq("organization_id", organizationId)
    .eq("status", "published")
    .order("published_at", { ascending: false });
  return {
    rows: ((data as AnnouncementRow[] | null) ?? []).map(mapAnnouncement),
    error: error as PgLikeError,
  };
}

export async function updateAnnouncementRow(
  supabase: SupabaseClient,
  id: string,
  patch: {
    title?: string;
    body?: string;
    status?: AnnouncementStatus;
    publishedAt?: string | null;
    unpublishedAt?: string | null;
  },
): Promise<{ row: AnnouncementRecord | null; error: PgLikeError }> {
  const values: Record<string, unknown> = {};
  if (patch.title !== undefined) values.title = patch.title;
  if (patch.body !== undefined) values.body = patch.body;
  if (patch.status !== undefined) values.status = patch.status;
  if (patch.publishedAt !== undefined) values.published_at = patch.publishedAt;
  if (patch.unpublishedAt !== undefined) {
    values.unpublished_at = patch.unpublishedAt;
  }
  const { data, error } = await supabase
    .from("announcements")
    .update(values)
    .eq("id", id)
    .select(ANNOUNCEMENT_COLUMNS)
    .maybeSingle();
  return {
    row: data ? mapAnnouncement(data as AnnouncementRow) : null,
    error: error as PgLikeError,
  };
}

export async function listOwnAnnouncementReads(
  supabase: SupabaseClient,
  userId: string,
): Promise<{
  rows: { announcementId: string; readAt: string }[];
  error: PgLikeError;
}> {
  const { data, error } = await supabase
    .from("announcement_reads")
    .select("announcement_id, read_at")
    .eq("user_id", userId);
  return {
    rows: ((data as { announcement_id: string; read_at: string }[] | null) ?? []).map(
      (row) => ({
        announcementId: row.announcement_id,
        readAt: row.read_at,
      }),
    ),
    error: error as PgLikeError,
  };
}

export async function insertOwnAnnouncementRead(
  supabase: SupabaseClient,
  values: {
    announcementId: string;
    userId: string;
    organizationId: string;
  },
): Promise<{ readAt: string | null; alreadyRead: boolean; error: PgLikeError }> {
  const { data, error } = await supabase
    .from("announcement_reads")
    .insert({
      announcement_id: values.announcementId,
      user_id: values.userId,
      organization_id: values.organizationId,
    })
    .select("read_at")
    .maybeSingle();

  if (!error && data && typeof (data as { read_at?: string }).read_at === "string") {
    return {
      readAt: (data as { read_at: string }).read_at,
      alreadyRead: false,
      error: null,
    };
  }

  // 既読済み（unique 衝突）は成功として既存 read_at を返す。UPDATE は使わない。
  if (!error || (error as { code?: string }).code === "23505") {
    const existing = await supabase
      .from("announcement_reads")
      .select("read_at")
      .eq("announcement_id", values.announcementId)
      .eq("user_id", values.userId)
      .maybeSingle();
    if (existing.data && typeof existing.data.read_at === "string") {
      return { readAt: existing.data.read_at, alreadyRead: true, error: null };
    }
    return { readAt: null, alreadyRead: true, error: existing.error as PgLikeError };
  }

  return { readAt: null, alreadyRead: false, error: error as PgLikeError };
}
