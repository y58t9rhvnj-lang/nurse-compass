-- =====================================================================
-- Compass Version 2.2 Sprint 3A
-- 0020_assessment_milestones_rls.sql
-- milestones RLS + cycle 書き込みを teacher にも許可（DELETE なし）
-- =====================================================================

alter table public.assessment_milestones enable row level security;

-- ----- milestones SELECT -----
drop policy if exists assessment_milestones_select_student on public.assessment_milestones;
create policy assessment_milestones_select_student
  on public.assessment_milestones
  for select
  to authenticated
  using (
    public.current_app_role() = 'student'
    and organization_id = public.current_organization_id()
    and status in ('open', 'closed')
  );

drop policy if exists assessment_milestones_select_staff on public.assessment_milestones;
create policy assessment_milestones_select_staff
  on public.assessment_milestones
  for select
  to authenticated
  using (
    public.is_staff()
    and organization_id = public.current_organization_id()
  );

-- ----- milestones write（teacher / admin、DELETE なし）-----
drop policy if exists assessment_milestones_insert_staff on public.assessment_milestones;
create policy assessment_milestones_insert_staff
  on public.assessment_milestones
  for insert
  to authenticated
  with check (
    public.is_staff()
    and organization_id = public.current_organization_id()
    and created_by = auth.uid()
  );

drop policy if exists assessment_milestones_update_staff on public.assessment_milestones;
create policy assessment_milestones_update_staff
  on public.assessment_milestones
  for update
  to authenticated
  using (
    public.is_staff()
    and organization_id = public.current_organization_id()
  )
  with check (
    public.is_staff()
    and organization_id = public.current_organization_id()
  );

-- ----- cycles: teacher にも作成・編集を許可（admin ポリシーは残す／置換）-----
drop policy if exists assessment_cycles_insert_admin on public.assessment_cycles;
drop policy if exists assessment_cycles_update_admin on public.assessment_cycles;

drop policy if exists assessment_cycles_insert_staff on public.assessment_cycles;
create policy assessment_cycles_insert_staff
  on public.assessment_cycles
  for insert
  to authenticated
  with check (
    public.is_staff()
    and organization_id = public.current_organization_id()
    and created_by = auth.uid()
  );

drop policy if exists assessment_cycles_update_staff on public.assessment_cycles;
create policy assessment_cycles_update_staff
  on public.assessment_cycles
  for update
  to authenticated
  using (
    public.is_staff()
    and organization_id = public.current_organization_id()
  )
  with check (
    public.is_staff()
    and organization_id = public.current_organization_id()
  );

-- staff が draft cycle も見られるよう、学生ポリシーはそのまま（open/closed）
-- staff SELECT は既存 assessment_cycles_select_staff

grant select, insert, update on public.assessment_milestones to authenticated;
grant all on public.assessment_milestones to service_role;

-- cycles の grant は 0018 で select/insert/update 済み
