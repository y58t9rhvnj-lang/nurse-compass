/**
 * Announcement UI contract (source scan).
 * Run: ./node_modules/.bin/jiti lib/v2/announcements/announcementUi.boundary.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

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

function src(rel: string): string {
  return readFileSync(new URL(rel, import.meta.url), "utf8");
}

const nav = src("../../../components/SideNav.tsx");
const overlay = src("../../../components/v2/announcements/StudentAnnouncementOverlay.tsx");
const editor = src("../../../components/v2/announcements/TeacherAnnouncementEditor.tsx");
const plain = src("../../../components/v2/announcements/AnnouncementPlainText.tsx");
const shell = src("../../../components/AppShell.tsx");

test("student left menu has お知らせ", () => {
  const start = nav.indexOf("export const STUDENT_NAV_ITEMS");
  const items = nav.slice(start, nav.indexOf("export default function SideNav"));
  assert.ok(items.includes('label: "お知らせ"'));
  assert.ok(items.includes('view: "announcements"'));
});

test("student confirm records read; defer and close do not", () => {
  assert.ok(overlay.includes("確認した"));
  assert.ok(overlay.includes("後で"));
  assert.ok(overlay.includes('aria-label="閉じる"'));
  assert.ok(overlay.includes("onConfirm"));
  assert.ok(overlay.includes("onDefer"));
  assert.equal(overlay.includes("markAnnouncementReadAction"), false);
});

test("staff unpublished history has no republish control", () => {
  assert.ok(editor.includes("nextStatusForPublish"));
  assert.ok(editor.includes("再公開はできません"));
  assert.equal(editor.includes("再公開する"), false);
});

test("plain text renderer does not interpret HTML", () => {
  assert.ok(plain.includes("data-announcement-plain-text"));
  assert.ok(plain.includes("{text}"));
  assert.equal(plain.includes("dangerouslySetInnerHTML"), false);
});

test("AppShell overlay is ward-only and related-diagram stays a separate route", () => {
  assert.ok(shell.includes("canShowStudentAnnouncementOverlay"));
  assert.ok(shell.includes("markAnnouncementReadAction"));
  assert.ok(shell.includes('activeView === "announcements"'));
  assert.ok(shell.includes('router.push("/v2/student/related-diagram")'));
});

test("announcements workspace load is not wired to refreshAnnouncements", () => {
  const start = shell.indexOf("<StudentAnnouncementsWorkspace");
  assert.ok(start >= 0);
  const chunk = shell.slice(start, start + 280);
  assert.equal(chunk.includes("refreshAnnouncements"), false);
  assert.equal(chunk.includes("onUnreadCountChange"), false);
});

console.log(`\n${passed} passed`);
