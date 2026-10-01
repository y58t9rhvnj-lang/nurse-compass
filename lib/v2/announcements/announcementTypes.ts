export type AnnouncementStatus = "draft" | "published" | "unpublished";

export type AnnouncementRole = "student" | "teacher" | "admin";

export type AnnouncementRecord = {
  id: string;
  organizationId: string;
  title: string;
  body: string;
  status: AnnouncementStatus;
  publishedAt: string | null;
  unpublishedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type StudentAnnouncementItem = {
  id: string;
  title: string;
  body: string;
  publishedAt: string;
  readAt: string | null;
};

export type AnnouncementActionFailure = {
  ok: false;
  kind: string;
  message: string;
};
