/**
 * Announcement permission and status-transition contract.
 * Run: ./node_modules/.bin/jiti lib/v2/announcements/announcementPolicy.test.ts
 */

import assert from "node:assert/strict";
import {
  canEditAnnouncementContent,
  canManageAnnouncements,
  canMarkAnnouncementRead,
  canReadPublishedAnnouncements,
  nextStatusForPublish,
  nextStatusForUnpublish,
  publishTimestamps,
  sameOrganization,
  studentCanMarkRead,
  studentCanSeeAnnouncement,
  unpublishTimestamps,
  validateAnnouncementFields,
} from "./announcementPolicy";

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

test("staff can manage; students and inactive cannot", () => {
  assert.equal(canManageAnnouncements("teacher", true), true);
  assert.equal(canManageAnnouncements("admin", true), true);
  assert.equal(canManageAnnouncements("student", true), false);
  assert.equal(canManageAnnouncements("teacher", false), false);
  assert.equal(canManageAnnouncements("admin", false), false);
});

test("only active students can list published or mark read", () => {
  assert.equal(canReadPublishedAnnouncements("student", true), true);
  assert.equal(canMarkAnnouncementRead("student", true), true);
  assert.equal(canReadPublishedAnnouncements("student", false), false);
  assert.equal(canReadPublishedAnnouncements("teacher", true), false);
  assert.equal(canMarkAnnouncementRead("admin", true), false);
});

test("organization boundary is exact match", () => {
  assert.equal(sameOrganization("org-a", "org-a"), true);
  assert.equal(sameOrganization("org-a", "org-b"), false);
  assert.equal(sameOrganization("", ""), false);
});

test("students see and confirm published only", () => {
  assert.equal(studentCanSeeAnnouncement("published"), true);
  assert.equal(studentCanSeeAnnouncement("draft"), false);
  assert.equal(studentCanSeeAnnouncement("unpublished"), false);
  assert.equal(studentCanMarkRead("published"), true);
  assert.equal(studentCanMarkRead("draft"), false);
  assert.equal(studentCanMarkRead("unpublished"), false);
});

test("content edits stay on draft", () => {
  assert.equal(canEditAnnouncementContent("draft"), true);
  assert.equal(canEditAnnouncementContent("published"), false);
  assert.equal(canEditAnnouncementContent("unpublished"), false);
});

test("publish and unpublish are one-way; no republish", () => {
  assert.equal(nextStatusForPublish("draft"), "published");
  assert.equal(nextStatusForPublish("unpublished"), null);
  assert.equal(nextStatusForPublish("published"), null);
  assert.equal(nextStatusForUnpublish("published"), "unpublished");
  assert.equal(nextStatusForUnpublish("draft"), null);
  assert.equal(nextStatusForUnpublish("unpublished"), null);
});

test("publish is draft-only; unpublish records unpublishedAt", () => {
  const first = publishTimestamps("draft", "2026-09-28T00:00:00.000Z", null);
  assert.deepEqual(first, {
    status: "published",
    publishedAt: "2026-09-28T00:00:00.000Z",
    unpublishedAt: null,
  });
  assert.equal(
    publishTimestamps(
      "unpublished",
      "2026-09-29T00:00:00.000Z",
      "2026-09-28T00:00:00.000Z",
    ),
    null,
  );
  assert.equal(
    publishTimestamps("draft", "2026-09-29T00:00:00.000Z", "already"),
    null,
  );
  const withdrawn = unpublishTimestamps(
    "published",
    "2026-09-30T00:00:00.000Z",
    "2026-09-28T00:00:00.000Z",
  );
  assert.deepEqual(withdrawn, {
    status: "unpublished",
    publishedAt: "2026-09-28T00:00:00.000Z",
    unpublishedAt: "2026-09-30T00:00:00.000Z",
  });
  assert.equal(
    unpublishTimestamps("draft", "2026-09-30T00:00:00.000Z", null),
    null,
  );
});

test("plain-text fields reject blank title or body", () => {
  assert.equal(validateAnnouncementFields("  ", "本文").ok, false);
  assert.equal(validateAnnouncementFields("題", "   ").ok, false);
  const ok = validateAnnouncementFields("  オリエンテーション  ", "初日の集合場所\n9時");
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.title, "オリエンテーション");
    assert.equal(ok.body, "初日の集合場所\n9時");
  }
});

console.log(`\n${passed} passed`);
