-- =====================================================================
-- Compass Version2 β — Phase 3-1
-- 0007_notebook_rls_grants.sql : form2_records / information_cards の RLS・GRANT
-- =====================================================================
-- 判定は SECURITY DEFINER 関数（current_app_role / is_staff /
-- current_organization_id / current_academic_year）で行う。すべて auth.uid() 基準。
--
--   student : 自分の行のみ SELECT / INSERT / UPDATE
--             INSERT/UPDATE の WITH CHECK で
--               user_id = auth.uid()
--               role = 'student'
--               organization_id = current_organization_id()
--               academic_year   = current_academic_year()
--             を強制（org/year の改ざん防止）。
--   teacher/admin : 自組織の学生データを SELECT のみ（書込不可）。
--   未認証(anon)   : GRANT せず・ポリシーも authenticated 限定 → 一切不可。
--   service_role   : all（RLS 回避）。シード・検証・管理・system カード作成のみ。
--   DELETE         : どのロールにも GRANT しない（物理削除不可。解除は論理削除）。
-- ---------------------------------------------------------------------

-- =====================================================================
-- form2_records
-- =====================================================================
alter table public.form2_records enable row level security;

drop policy if exists form2_select_own on public.form2_records;
create policy form2_select_own
  on public.form2_records
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists form2_insert_own on public.form2_records;
create policy form2_insert_own
  on public.form2_records
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.current_app_role() = 'student'
    and organization_id = public.current_organization_id()
    and academic_year   = public.current_academic_year()
  );

drop policy if exists form2_update_own on public.form2_records;
create policy form2_update_own
  on public.form2_records
  for update
  to authenticated
  using (user_id = auth.uid() and public.current_app_role() = 'student')
  with check (
    user_id = auth.uid()
    and public.current_app_role() = 'student'
    and organization_id = public.current_organization_id()
    and academic_year   = public.current_academic_year()
  );

drop policy if exists form2_select_staff on public.form2_records;
create policy form2_select_staff
  on public.form2_records
  for select
  to authenticated
  using (public.is_staff() and organization_id = public.current_organization_id());

grant select, insert, update on public.form2_records to authenticated; -- DELETE は付与しない
grant all on public.form2_records to service_role;

-- =====================================================================
-- information_cards
-- =====================================================================
alter table public.information_cards enable row level security;

drop policy if exists cards_select_own on public.information_cards;
create policy cards_select_own
  on public.information_cards
  for select
  to authenticated
  using (user_id = auth.uid());

-- 学生作成カードは created_by = 'student' を強制（なりすまし防止）。
-- 'system' カードは service_role（RLS 回避）でのみ作成可能。
drop policy if exists cards_insert_own on public.information_cards;
create policy cards_insert_own
  on public.information_cards
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.current_app_role() = 'student'
    and created_by = 'student'
    and organization_id = public.current_organization_id()
    and academic_year   = public.current_academic_year()
  );

-- content / category / note / sort_order / deleted_at / source_label の編集と論理削除。
-- identity・事実性カラムの不変性はトリガー(reject_immutable_columns)で担保する。
drop policy if exists cards_update_own on public.information_cards;
create policy cards_update_own
  on public.information_cards
  for update
  to authenticated
  using (user_id = auth.uid() and public.current_app_role() = 'student')
  with check (
    user_id = auth.uid()
    and public.current_app_role() = 'student'
    and created_by = 'student'
    and organization_id = public.current_organization_id()
    and academic_year   = public.current_academic_year()
  );

drop policy if exists cards_select_staff on public.information_cards;
create policy cards_select_staff
  on public.information_cards
  for select
  to authenticated
  using (public.is_staff() and organization_id = public.current_organization_id());

grant select, insert, update on public.information_cards to authenticated; -- DELETE は付与しない
grant all on public.information_cards to service_role;
