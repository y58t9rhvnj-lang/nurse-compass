-- =====================================================================
-- Compass Version 2.2
-- 0035_free_canvas_delete.sql
-- 自由キャンバスの本人削除（0034 は変更しない）
-- =====================================================================
-- 方針:
--   ・0034 で付与しなかった DELETE を、学生本人・同じ組織・対象年度に限定して追加する。
--   ・staff / teacher / admin / anon の DELETE ポリシーは付けない。
--   ・related_diagram_records / form3_records は変更しない。
-- ---------------------------------------------------------------------

drop policy if exists free_canvas_delete_own on public.free_canvas_records;
create policy free_canvas_delete_own
  on public.free_canvas_records
  for delete
  to authenticated
  using (
    user_id = auth.uid()
    and public.current_app_role() = 'student'
    and organization_id = public.current_organization_id()
    and academic_year = public.current_academic_year()
  );

grant delete on public.free_canvas_records to authenticated;
