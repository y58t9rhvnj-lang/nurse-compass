-- =====================================================================
-- Compass Version 2.2
-- 0034_free_canvas.sql
-- 自由キャンバス（free_canvas_records）
-- =====================================================================
-- 方針:
--   ・患者A関連図（related_diagram_records / SP-001）とは別テーブル。
--   ・case_id / assessment_cycle_id / 提出 status は持たない。
--   ・学生本人のみ読み書き。staff SELECT は付けない（評価対象にしない）。
--   ・物理 DELETE は付与しない。Form3 / 関連図テーブルは変更しない。
-- ---------------------------------------------------------------------

create table if not exists public.free_canvas_records (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id),
  organization_id uuid not null references public.organizations(id),
  academic_year   integer not null,
  title           text not null,
  semantic_graph  jsonb not null,
  route_scene     jsonb null,
  version         integer not null default 1,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint free_canvas_title_not_blank check (btrim(title) <> ''),
  constraint free_canvas_version_positive check (version >= 1)
);

create index if not exists idx_free_canvas_owner_updated
  on public.free_canvas_records (user_id, updated_at desc);

create index if not exists idx_free_canvas_org_year
  on public.free_canvas_records (organization_id, academic_year);

drop trigger if exists trg_free_canvas_updated_at on public.free_canvas_records;
create trigger trg_free_canvas_updated_at
  before update on public.free_canvas_records
  for each row execute function public.set_updated_at();

drop trigger if exists trg_free_canvas_immutable on public.free_canvas_records;
create trigger trg_free_canvas_immutable
  before update on public.free_canvas_records
  for each row execute function public.reject_immutable_columns(
    'user_id', 'organization_id', 'academic_year', 'created_at'
  );

comment on table public.free_canvas_records is
  '学生の自由キャンバス。患者A関連図・提出・AI評価・教員閲覧の対象外。';
comment on column public.free_canvas_records.title is
  '学生が付ける名前。ケースIDではない。';
comment on column public.free_canvas_records.semantic_graph is
  'カードと接続。Form3 / 患者A seed は入れない。';

alter table public.free_canvas_records enable row level security;

drop policy if exists free_canvas_select_own on public.free_canvas_records;
create policy free_canvas_select_own
  on public.free_canvas_records
  for select
  to authenticated
  using (
    user_id = auth.uid()
    and public.current_app_role() = 'student'
    and organization_id = public.current_organization_id()
    and academic_year = public.current_academic_year()
  );

drop policy if exists free_canvas_insert_own on public.free_canvas_records;
create policy free_canvas_insert_own
  on public.free_canvas_records
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.current_app_role() = 'student'
    and organization_id = public.current_organization_id()
    and academic_year = public.current_academic_year()
  );

drop policy if exists free_canvas_update_own on public.free_canvas_records;
create policy free_canvas_update_own
  on public.free_canvas_records
  for update
  to authenticated
  using (
    user_id = auth.uid()
    and public.current_app_role() = 'student'
  )
  with check (
    user_id = auth.uid()
    and public.current_app_role() = 'student'
    and organization_id = public.current_organization_id()
    and academic_year = public.current_academic_year()
  );

revoke all on public.free_canvas_records from public;
revoke all on public.free_canvas_records from anon;
grant select, insert, update on public.free_canvas_records to authenticated;
grant all on public.free_canvas_records to service_role;
