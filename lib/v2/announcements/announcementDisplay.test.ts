/**
 * Announcement display helpers.
 * Run: ./node_modules/.bin/jiti lib/v2/announcements/announcementDisplay.test.ts
 */

import assert from "node:assert/strict";
import {
  canShowStudentAnnouncementOverlay,
  groupStaffAnnouncements,
  unreadStudentAnnouncements,
} from "./announcementDisplay";
import type {
  AnnouncementRecord,
  StudentAnnouncementItem,
} from "./announcementTypes";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`ok - ${name}`);
  } catch (e) {
    console.error(`FAIL - ${name}`);
    throw e;
  }
}

test("unread keeps unpublished-from-student-view out by using readAt only", () => {
  const items: StudentAnnouncementItem[] = [
    {
      id: "2",
      title: "新しい",
      body: "b",
      publishedAt: "2026-09-28T02:00:00.000Z",
      readAt: null,
    },
    {
      id: "1",
      title: "確認済み",
      body: "a",
      publishedAt: "2026-09-28T01:00:00.000Z",
      readAt: "2026-09-28T03:00:00.000Z",
    },
  ];
  const unread = unreadStudentAnnouncements(items);
  assert.deepEqual(unread.map((i) => i.id), ["2"]);
});

test("overlay only on ward and never in lecture mode", () => {
  assert.equal(
    canShowStudentAnnouncementOverlay({ activeView: "ward", lectureMode: false }),
    true,
  );
  assert.equal(
    canShowStudentAnnouncementOverlay({ activeView: "form3", lectureMode: false }),
    false,
  );
  assert.equal(
    canShowStudentAnnouncementOverlay({
      activeView: "related-diagram",
      lectureMode: false,
    }),
    false,
  );
  assert.equal(
    canShowStudentAnnouncementOverlay({ activeView: "ward", lectureMode: true }),
    false,
  );
});

test("staff grouping keeps unpublished as history", () => {
  const row = (id: string, status: AnnouncementRecord["status"]): AnnouncementRecord => ({
    id,
    organizationId: "org",
    title: id,
    body: "x",
    status,
    publishedAt: status === "draft" ? null : "2026-09-28T00:00:00.000Z",
    unpublishedAt: status === "unpublished" ? "2026-09-28T01:00:00.000Z" : null,
    createdBy: "u",
    createdAt: "2026-09-28T00:00:00.000Z",
    updatedAt: "2026-09-28T00:00:00.000Z",
  });
  const grouped = groupStaffAnnouncements([
    row("d", "draft"),
    row("p", "published"),
    row("u", "unpublished"),
  ]);
  assert.deepEqual(grouped.drafts.map((r) => r.id), ["d"]);
  assert.deepEqual(grouped.published.map((r) => r.id), ["p"]);
  assert.deepEqual(grouped.unpublished.map((r) => r.id), ["u"]);
});

console.log(`\n${passed} passed`);
