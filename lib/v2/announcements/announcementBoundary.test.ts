/**
 * Announcement RLS / action-boundary contract (source scan + policy).
 * Run: ./node_modules/.bin/jiti lib/v2/announcements/announcementBoundary.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canManageAnnouncements, canMarkAnnouncementRead } from "./announcementPolicy";

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

const migration = src("../../../supabase/migrations/0033_announcements.sql");
const actions = src("../../../app/v2/actions/announcements.ts");

test("migration defines both tables and no physical delete grant", () => {
  assert.ok(migration.includes("create table if not exists public.announcements"));
  assert.ok(
    migration.includes("create table if not exists public.announcement_reads"),
  );
  assert.ok(migration.includes("grant select, insert, update on public.announcements"));
  assert.ok(migration.includes("grant select, insert on public.announcement_reads"));
  assert.equal(migration.includes("grant delete on public.announcements"), false);
  assert.equal(
    migration.includes("grant delete on public.announcement_reads"),
    false,
  );
  assert.equal(migration.includes("grant update on public.announcement_reads"), false);
});

test("student select is published-only; staff keep unpublished history", () => {
  assert.ok(migration.includes("status = 'published'"));
  assert.ok(migration.includes("announcements_select_student"));
  assert.ok(migration.includes("announcements_select_staff"));
  assert.ok(migration.includes("public.is_staff()"));
  assert.ok(migration.includes("organization_id = public.current_organization_id()"));
});

test("insert is staff draft-only and created_by is the actor", () => {
  assert.ok(migration.includes("status = 'draft'"));
  assert.ok(migration.includes("created_by = auth.uid()"));
  assert.ok(migration.includes("announcements_insert_staff"));
  assert.equal(migration.includes("announcements_insert_student"), false);
  assert.equal(migration.includes("announcements_update_student"), false);
});

test("trigger freezes published title/body and identity columns", () => {
  const fn = migration.slice(
    migration.indexOf("announcements_enforce_status_transition()"),
    migration.indexOf("trg_announcements_status_transition"),
  );
  assert.ok(fn.includes("organization_id is immutable"));
  assert.ok(fn.includes("created_by is immutable"));
  assert.ok(fn.includes("published or unpublished announcement content is immutable"));
  assert.ok(fn.includes("new.title is distinct from old.title"));
  assert.ok(fn.includes("new.body is distinct from old.body"));
});

test("DB forbids republish of unpublished rows", () => {
  assert.ok(migration.includes("announcements_enforce_status_transition"));
  assert.ok(
    migration.includes("unpublished announcements cannot change; create a new draft"),
  );
  const draftUpdate = migration.slice(
    migration.indexOf("announcements_update_staff_draft"),
    migration.indexOf("announcements_update_staff_published"),
  );
  const publishedUpdate = migration.slice(
    migration.indexOf("announcements_update_staff_published"),
    migration.indexOf("announcement_reads_select_own"),
  );
  assert.ok(draftUpdate.includes("and status = 'draft'"));
  assert.ok(draftUpdate.includes("status in ('draft', 'published')"));
  assert.equal(draftUpdate.includes("status = 'unpublished'"), false);
  assert.ok(publishedUpdate.includes("and status = 'published'"));
  assert.ok(publishedUpdate.includes("status in ('published', 'unpublished')"));
  assert.equal(publishedUpdate.includes("status = 'unpublished'"), false);
});

test("reads require the student self and a published announcement", () => {
  assert.ok(migration.includes("user_id = auth.uid()"));
  assert.ok(migration.includes("announcement_reads_insert_own"));
  assert.ok(migration.includes("and a.status = 'published'"));
  assert.ok(migration.includes("a.organization_id = organization_id"));
});

test("audit: student write, cross-org, others' reads, unpublished reads are blocked", () => {
  const insertStaff = migration.slice(
    migration.indexOf("announcements_insert_staff"),
    migration.indexOf("announcements_update_staff_draft"),
  );
  assert.ok(insertStaff.includes("public.is_staff()"));
  assert.equal(insertStaff.includes("current_app_role() = 'student'"), false);

  const studentSelect = migration.slice(
    migration.indexOf("announcements_select_student"),
    migration.indexOf("announcements_select_staff"),
  );
  assert.ok(studentSelect.includes("organization_id = public.current_organization_id()"));
  assert.ok(studentSelect.includes("status = 'published'"));

  const readInsert = migration.slice(
    migration.indexOf("announcement_reads_insert_own"),
    migration.indexOf("GRANT"),
  );
  assert.ok(readInsert.includes("user_id = auth.uid()"));
  assert.ok(readInsert.includes("current_app_role() = 'student'"));
  assert.ok(readInsert.includes("a.status = 'published'"));
  assert.ok(readInsert.includes("a.organization_id = public.current_organization_id()"));

  assert.ok(actions.includes("canManageAnnouncements(ctx.profile.role"));
  assert.ok(actions.includes("sameOrganization(ctx.profile.organizationId"));
  assert.ok(actions.includes("userId: ctx.profile.id"));
  assert.ok(actions.includes("studentCanSeeAnnouncement"));
  assert.ok(
    actions.includes("取り下げたお知らせは新しい下書きから作成してください"),
  );
});

test("actions gate staff writes and student confirm separately", () => {
  assert.ok(actions.includes("createAnnouncementDraftAction"));
  assert.ok(actions.includes("updateAnnouncementDraftAction"));
  assert.ok(actions.includes("publishAnnouncementAction"));
  assert.ok(actions.includes("unpublishAnnouncementAction"));
  assert.ok(actions.includes("listStaffAnnouncementsAction"));
  assert.ok(actions.includes("listPublishedAnnouncementsAction"));
  assert.ok(actions.includes("markAnnouncementReadAction"));
  assert.ok(actions.includes("canManageAnnouncements"));
  assert.ok(actions.includes("canMarkAnnouncementRead"));
  assert.ok(actions.includes("canEditAnnouncementContent"));
  assert.ok(actions.includes("studentCanSeeAnnouncement"));
});

test("actions do not touch Form3 or related-diagram save paths", () => {
  assert.equal(actions.includes("form3"), false);
  assert.equal(actions.includes("relatedDiagram"), false);
  assert.equal(actions.includes("saveForm3"), false);
  assert.equal(actions.includes("form3_records"), false);
  assert.equal(actions.includes("related_diagram_records"), false);
});

test("role matrix used by actions stays mutually exclusive", () => {
  assert.equal(canManageAnnouncements("teacher", true), true);
  assert.equal(canMarkAnnouncementRead("teacher", true), false);
  assert.equal(canManageAnnouncements("student", true), false);
  assert.equal(canMarkAnnouncementRead("student", true), true);
});

console.log(`\n${passed} passed`);
