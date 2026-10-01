import type { AnnouncementRole, AnnouncementStatus } from "./announcementTypes";

export const ANNOUNCEMENT_TITLE_MAX = 200;
export const ANNOUNCEMENT_BODY_MAX = 10000;

export function isStaffAnnouncementRole(role: AnnouncementRole): boolean {
  return role === "teacher" || role === "admin";
}

export function canManageAnnouncements(
  role: AnnouncementRole,
  isActive: boolean,
): boolean {
  return isActive && isStaffAnnouncementRole(role);
}

export function canReadPublishedAnnouncements(
  role: AnnouncementRole,
  isActive: boolean,
): boolean {
  return isActive && role === "student";
}

export function canMarkAnnouncementRead(
  role: AnnouncementRole,
  isActive: boolean,
): boolean {
  return canReadPublishedAnnouncements(role, isActive);
}

export function sameOrganization(
  actorOrganizationId: string,
  targetOrganizationId: string,
): boolean {
  return (
    actorOrganizationId.length > 0 &&
    actorOrganizationId === targetOrganizationId
  );
}

export function studentCanSeeAnnouncement(status: AnnouncementStatus): boolean {
  return status === "published";
}

export function studentCanMarkRead(status: AnnouncementStatus): boolean {
  return status === "published";
}

export function canEditAnnouncementContent(status: AnnouncementStatus): boolean {
  return status === "draft";
}

export function nextStatusForPublish(
  status: AnnouncementStatus,
): AnnouncementStatus | null {
  return status === "draft" ? "published" : null;
}

export function nextStatusForUnpublish(
  status: AnnouncementStatus,
): AnnouncementStatus | null {
  return status === "published" ? "unpublished" : null;
}

export function validateAnnouncementFields(
  title: string,
  body: string,
):
  | { ok: true; title: string; body: string }
  | { ok: false; kind: "validation"; message: string } {
  const nextTitle = title.trim();
  const nextBody = body.replace(/\r\n/g, "\n");
  if (!nextTitle) {
    return { ok: false, kind: "validation", message: "タイトルを入力してください。" };
  }
  if (nextTitle.length > ANNOUNCEMENT_TITLE_MAX) {
    return {
      ok: false,
      kind: "validation",
      message: `タイトルは${ANNOUNCEMENT_TITLE_MAX}文字以内にしてください。`,
    };
  }
  if (nextBody.trim().length === 0) {
    return { ok: false, kind: "validation", message: "本文を入力してください。" };
  }
  if (nextBody.length > ANNOUNCEMENT_BODY_MAX) {
    return {
      ok: false,
      kind: "validation",
      message: `本文は${ANNOUNCEMENT_BODY_MAX}文字以内にしてください。`,
    };
  }
  return { ok: true, title: nextTitle, body: nextBody };
}

export function publishTimestamps(
  status: AnnouncementStatus,
  nowIso: string,
  publishedAt: string | null,
): { status: "published"; publishedAt: string; unpublishedAt: null } | null {
  if (nextStatusForPublish(status) !== "published" || publishedAt !== null) {
    return null;
  }
  return {
    status: "published",
    publishedAt: nowIso,
    unpublishedAt: null,
  };
}

export function unpublishTimestamps(
  status: AnnouncementStatus,
  nowIso: string,
  publishedAt: string | null,
):
  | { status: "unpublished"; publishedAt: string; unpublishedAt: string }
  | null {
  if (!nextStatusForUnpublish(status) || !publishedAt) return null;
  return {
    status: "unpublished",
    publishedAt,
    unpublishedAt: nowIso,
  };
}
