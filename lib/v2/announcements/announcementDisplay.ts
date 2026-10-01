import type {
  AnnouncementRecord,
  AnnouncementStatus,
  StudentAnnouncementItem,
} from "./announcementTypes";

export const ANNOUNCEMENT_AUDIENCE_LABEL = "同じ組織の全学生";

export function announcementStatusLabel(status: AnnouncementStatus): string {
  if (status === "draft") return "下書き";
  if (status === "published") return "公開中";
  return "取り下げ済み";
}

export function unreadStudentAnnouncements(
  items: readonly StudentAnnouncementItem[],
): StudentAnnouncementItem[] {
  return items.filter((item) => item.readAt === null);
}

export function canShowStudentAnnouncementOverlay(input: {
  activeView: string;
  lectureMode: boolean;
}): boolean {
  return input.activeView === "ward" && !input.lectureMode;
}

export function publishConfirmCopy(title: string): {
  title: string;
  audience: string;
  result: string;
  subject: string;
} {
  return {
    title: "このお知らせを公開しますか？",
    audience: ANNOUNCEMENT_AUDIENCE_LABEL,
    result: "公開中になり、未確認の学生の病棟ホームに表示されます。",
    subject: title,
  };
}

export function unpublishConfirmCopy(title: string): {
  title: string;
  audience: string;
  result: string;
  subject: string;
} {
  return {
    title: "このお知らせを取り下げますか？",
    audience: ANNOUNCEMENT_AUDIENCE_LABEL,
    result:
      "学生の一覧と未確認表示から消え、管理側の履歴に残ります。再公開はできません。",
    subject: title,
  };
}

export function groupStaffAnnouncements(rows: readonly AnnouncementRecord[]): {
  drafts: AnnouncementRecord[];
  published: AnnouncementRecord[];
  unpublished: AnnouncementRecord[];
} {
  return {
    drafts: rows.filter((row) => row.status === "draft"),
    published: rows.filter((row) => row.status === "published"),
    unpublished: rows.filter((row) => row.status === "unpublished"),
  };
}
