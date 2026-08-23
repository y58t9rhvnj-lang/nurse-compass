-- =====================================================================
-- Compass Version 2.2 Sprint 2
-- 0018_assessment_rls.sql
-- assessment_cycles / assessment_submissions の RLS・GRANT
-- =====================================================================
-- 方針:
--   ・学生: 自組織 cycle の SELECT / 自分の submission SELECT のみ
--   ・提出 INSERT は submit_assessment_submission RPC（SECURITY DEFINER）経由
--   ・教員: 自組織の SELECT のみ（承認 UPDATE は後続 Sprint）
--   ・admin: 自組織 cycle の管理（INSERT/UPDATE）。submission 本体の UPDATE/DELETE は不可
-- ---------------------------------------------------------------------

alter table public.assessment_cycles enable row level security;
alter table public.assessment_submissions enable row level security;

-- ----- cycles SELECT -----
drop policy if exists assessment_cycles_select_student on public.assessment_cycles;
create policy assessment_cycles_select_student
  on public.assessment_cycles
  for select
  to authenticated
  using (
    public.current_app_role() = 'student'
    and organization_id = public.current_organization_id()
    and status in ('open', 'closed')
  );

drop policy if exists assessment_cycles_select_staff on public.assessment_cycles;
create policy assessment_cycles_select_staff
  on public.assessment_cycles
  for select
  to authenticated
  using (
    public.is_staff()
    and organization_id = public.current_organization_id()
  );

-- ----- cycles admin write（自組織）-----
drop policy if exists assessment_cycles_insert_admin on public.assessment_cycles;
create policy assessment_cycles_insert_admin
  on public.assessment_cycles
  for insert
  to authenticated
  with check (
    public.current_app_role() = 'admin'
    and organization_id = public.current_organization_id()
    and created_by = auth.uid()
  );

drop policy if exists assessment_cycles_update_admin on public.assessment_cycles;
create policy assessment_cycles_update_admin
  on public.assessment_cycles
  for update
  to authenticated
  using (
    public.current_app_role() = 'admin'
    and organization_id = public.current_organization_id()
  )
  with check (
    public.current_app_role() = 'admin'
    and organization_id = public.current_organization_id()
  );

-- ----- submissions SELECT -----
drop policy if exists assessment_submissions_select_own on public.assessment_submissions;
create policy assessment_submissions_select_own
  on public.assessment_submissions
  for select
  to authenticated
  using (
    student_user_id = auth.uid()
    and public.current_app_role() = 'student'
  );

drop policy if exists assessment_submissions_select_staff on public.assessment_submissions;
create policy assessment_submissions_select_staff
  on public.assessment_submissions
  for select
  to authenticated
  using (
    public.is_staff()
    and organization_id = public.current_organization_id()
  );

-- INSERT/UPDATE/DELETE ポリシーは作らない（RPC 経由の SECURITY DEFINER のみ）

-- ----- GRANTs -----
-- cycles: student/staff は SELECT。admin は INSERT/UPDATE。DELETE なし。
grant select on public.assessment_cycles to authenticated;
grant insert, update on public.assessment_cycles to authenticated;

-- submissions: SELECT のみ。INSERT は RPC。UPDATE/DELETE は付与しない。
grant select on public.assessment_submissions to authenticated;

grant select on public.assessment_evaluation_candidates to authenticated;

grant all on public.assessment_cycles to service_role;
grant all on public.assessment_submissions to service_role;
