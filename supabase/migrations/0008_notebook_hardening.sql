-- =====================================================================
-- Compass Version2 β — Phase 3-1（是正・冪等）
-- 0008_notebook_hardening.sql
--   0005〜0007 の一部（不変カラム保護トリガー / content 等の CHECK /
--   created_by='student' 強制）が環境によって未適用だった場合に補う。
--   すべて冪等: 既に適用済みの新規環境では実質 no-op（DROP/破壊はしない）。
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) 不変カラム保護関数（存在保証）
-- ---------------------------------------------------------------------
create or replace function public.reject_immutable_columns()
returns trigger
language plpgsql
as $$
declare
  col text;
  o jsonb := to_jsonb(OLD);
  n jsonb := to_jsonb(NEW);
begin
  foreach col in array TG_ARGV loop
    if (o -> col) is distinct from (n -> col) then
      raise exception 'column "%" is immutable', col using errcode = '42501';
    end if;
  end loop;
  return NEW;
end;
$$;

-- ---------------------------------------------------------------------
-- 2) 不変カラム保護トリガー（両テーブル・再作成で存在保証）
-- ---------------------------------------------------------------------
drop trigger if exists trg_form2_records_immutable on public.form2_records;
create trigger trg_form2_records_immutable
  before update on public.form2_records
  for each row execute function public.reject_immutable_columns(
    'user_id', 'organization_id', 'academic_year', 'case_id', 'created_at'
  );

drop trigger if exists trg_information_cards_immutable on public.information_cards;
create trigger trg_information_cards_immutable
  before update on public.information_cards
  for each row execute function public.reject_immutable_columns(
    'user_id', 'organization_id', 'academic_year', 'case_id',
    'created_by', 'created_at',
    'source_type', 'source_reference', 'original_text', 'observed_at'
  );

-- ---------------------------------------------------------------------
-- 3) CHECK 制約（欠落時のみ追加・冪等）
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'form2_records_case_id_not_blank') then
    alter table public.form2_records
      add constraint form2_records_case_id_not_blank check (btrim(case_id) <> '');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'form2_records_version_positive') then
    alter table public.form2_records
      add constraint form2_records_version_positive check (version >= 1);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'information_cards_case_id_not_blank') then
    alter table public.information_cards
      add constraint information_cards_case_id_not_blank check (btrim(case_id) <> '');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'information_cards_content_not_blank') then
    alter table public.information_cards
      add constraint information_cards_content_not_blank check (btrim(content) <> '');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'information_cards_sort_order_nonneg') then
    alter table public.information_cards
      add constraint information_cards_sort_order_nonneg check (sort_order >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'information_cards_created_by_valid') then
    alter table public.information_cards
      add constraint information_cards_created_by_valid check (created_by in ('student', 'system'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'information_cards_source_type_valid') then
    alter table public.information_cards
      add constraint information_cards_source_type_valid check (
        source_type in (
          'patient_conversation','student_observation','clinical_record','nursing_record',
          'flowsheet','prescription','examination','life_history','ot','psw',
          'student_note','pathophysiology_reference'
        )
      );
  end if;
end
$$;

-- ---------------------------------------------------------------------
-- 4) information_cards の INSERT/UPDATE ポリシー（created_by='student' 強制）
--    再作成で確実に created_by 制約を含める。
-- ---------------------------------------------------------------------
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
