/**
 * Free canvas schema / action-boundary contract (source scan + policy).
 * Run: ./node_modules/.bin/jiti lib/v2/freeCanvas/freeCanvasBoundary.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canManageFreeCanvas } from "./freeCanvasPolicy";

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

const migration = src("../../../supabase/migrations/0034_free_canvas.sql");
const deleteMigration = src("../../../supabase/migrations/0035_free_canvas_delete.sql");
const actions = src("../../../app/v2/actions/freeCanvas.ts");
const repo = src("./freeCanvasRepository.ts");
const relatedAction = src("../../../app/v2/actions/relatedDiagramDraft.ts");
const relatedPage = src("../../../app/v2/student/related-diagram/page.tsx");
const relatedRepo = src("../relatedDiagram/relatedDiagramRepository.ts");

test("migration adds a table independent of Patient A related diagram", () => {
  assert.ok(migration.includes("create table if not exists public.free_canvas_records"));
  const create = migration.slice(
    migration.indexOf("create table if not exists public.free_canvas_records"),
    migration.indexOf("create index if not exists idx_free_canvas_owner_updated"),
  );
  assert.ok(create.includes("title           text not null"));
  assert.ok(create.includes("semantic_graph  jsonb not null"));
  assert.equal(create.includes("case_id"), false);
  assert.equal(create.includes("assessment_cycle_id"), false);
  assert.equal(create.includes("knowledge_group_id"), false);
  assert.equal(create.includes("status"), false);
  assert.equal(migration.includes("alter table public.related_diagram_records"), false);
  assert.equal(migration.includes("alter table public.form3_records"), false);
  assert.equal(migration.includes("create table if not exists public.related_diagram"), false);
});

test("student-only RLS; staff have no SELECT; 0034 does not grant DELETE", () => {
  assert.ok(migration.includes("enable row level security"));
  assert.ok(migration.includes("free_canvas_select_own"));
  assert.ok(migration.includes("current_app_role() = 'student'"));
  assert.ok(migration.includes("user_id = auth.uid()"));
  assert.ok(migration.includes("organization_id = public.current_organization_id()"));
  assert.ok(migration.includes("academic_year = public.current_academic_year()"));
  assert.equal(migration.includes("is_staff()"), false);
  assert.equal(migration.includes("free_canvas_select_staff"), false);
  assert.equal(migration.includes("current_app_role() = 'teacher'"), false);
  assert.equal(migration.includes("current_app_role() = 'admin'"), false);
  assert.ok(migration.includes("grant select, insert, update on public.free_canvas_records"));
  assert.equal(migration.includes("grant delete on public.free_canvas_records"), false);
  assert.equal(migration.includes("free_canvas_delete_own"), false);
});

test("0035 grants owner-only DELETE without changing Patient A tables", () => {
  assert.ok(deleteMigration.includes("free_canvas_delete_own"));
  assert.ok(deleteMigration.includes("for delete"));
  assert.ok(deleteMigration.includes("user_id = auth.uid()"));
  assert.ok(deleteMigration.includes("current_app_role() = 'student'"));
  assert.ok(deleteMigration.includes("organization_id = public.current_organization_id()"));
  assert.ok(deleteMigration.includes("academic_year = public.current_academic_year()"));
  assert.ok(deleteMigration.includes("grant delete on public.free_canvas_records to authenticated"));
  assert.equal(deleteMigration.includes("is_staff()"), false);
  assert.equal(deleteMigration.includes("current_app_role() = 'teacher'"), false);
  assert.equal(deleteMigration.includes("current_app_role() = 'admin'"), false);
  assert.equal(deleteMigration.includes("alter table public.related_diagram_records"), false);
  assert.equal(deleteMigration.includes("alter table public.form3_records"), false);
  assert.equal(deleteMigration.includes("related_diagram_submissions"), false);
  assert.equal(deleteMigration.includes("assessment_submissions"), false);
});

test("identity columns stay immutable", () => {
  assert.ok(migration.includes("reject_immutable_columns("));
  assert.ok(migration.includes("'user_id', 'organization_id', 'academic_year', 'created_at'"));
  assert.ok(migration.includes("set_updated_at()"));
});

test("actions are student-owned list/create/get/rename/save/delete", () => {
  assert.ok(actions.includes("export async function listFreeCanvasesAction"));
  assert.ok(actions.includes("export async function createFreeCanvasAction"));
  assert.ok(actions.includes("export async function getFreeCanvasAction"));
  assert.ok(actions.includes("export async function renameFreeCanvasAction"));
  assert.ok(actions.includes("export async function saveFreeCanvasAction"));
  assert.ok(actions.includes("export async function deleteFreeCanvasAction"));
  assert.ok(actions.includes("canManageFreeCanvas(profile.role, profile.isActive)"));
  assert.ok(actions.includes("userId: ctx.profile.id"));
  assert.ok(actions.includes("organizationId: ctx.profile.organizationId"));
  assert.ok(actions.includes("academicYear: ctx.profile.academicYear"));
  assert.ok(actions.includes("kind: \"not_found\""));
  assert.ok(actions.includes("キャンバスが見つかりません。"));
  assert.ok(actions.includes("キャンバスを削除できませんでした。"));
  assert.ok(repo.includes('.from("free_canvas_records")'));
  assert.ok(repo.includes("createEmptySemanticGraph()"));
  assert.ok(repo.includes("export async function deleteOwnFreeCanvas"));
  assert.ok(repo.includes(".delete()"));
  assert.ok(repo.includes('.eq("user_id", values.userId)'));
  assert.ok(repo.includes('.eq("organization_id", values.organizationId)'));
  assert.ok(repo.includes('.eq("academic_year", values.academicYear)'));
  assert.ok(repo.includes('.eq("id", values.id)'));
});

test("free canvas does not connect Form3, Patient A seed, submit, AI, or teacher view", () => {
  for (const file of [actions, repo]) {
    assert.equal(file.includes("getForm3"), false);
    assert.equal(file.includes("caseIdForPatient"), false);
    assert.equal(file.includes("relatedDiagramDraft"), false);
    assert.equal(file.includes("related_diagram_records"), false);
    assert.equal(file.includes("form3_records"), false);
    assert.equal(file.includes("assessment_submissions"), false);
    assert.equal(file.includes("aiEval"), false);
    assert.equal(file.includes("requireRole(\"teacher\")"), false);
    assert.equal(file.includes("SCHIZOPHRENIA"), false);
    assert.equal(file.includes("includeStyleDemo"), false);
  }
});

test("Patient A related-diagram save path stays on its own tables and actions", () => {
  assert.ok(relatedAction.includes("insertRelatedDiagram"));
  assert.ok(relatedAction.includes("updateRelatedDiagramWithVersion"));
  assert.ok(relatedAction.includes('const STUDENT_RELATED_DIAGRAM_PATIENT_ID = "A"'));
  assert.ok(relatedRepo.includes('.from("related_diagram_records")'));
  assert.ok(relatedPage.includes("getForm3"));
  assert.ok(relatedPage.includes("RelatedDiagramStudentEditor"));
  assert.equal(relatedAction.includes("free_canvas_records"), false);
  assert.equal(relatedAction.includes("freeCanvas"), false);
  assert.equal(relatedPage.includes("freeCanvas"), false);
  assert.equal(relatedRepo.includes("free_canvas_records"), false);
});

test("role matrix stays student-only", () => {
  assert.equal(canManageFreeCanvas("student", true), true);
  assert.equal(canManageFreeCanvas("teacher", true), false);
  assert.equal(canManageFreeCanvas("admin", true), false);
});

console.log(`\n${passed} passed`);
