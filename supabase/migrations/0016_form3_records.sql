-- =====================================================================
-- Compass Version2.1 — Form3 Day 2
-- 0016_form3_records.sql : 様式3（ゴードン11パターン）の保存テーブル・RLS・GRANT
-- =====================================================================
-- 方針（docs/version2/18_form3_design.md / form2_records と同一所有軸）:
--   ・学生ごと / 組織ごと / 年度ごと / ケースごとに 1 レコード（head）。
--   ・payload(jsonb) に Form3Data を保持する。
--   ・DB列 version = レコードバージョン（楽観ロック）。
--     payload 内の schemaVersion は構造バージョンであり、DB列 version とは別物。
--   ・organization_id / academic_year は profile 由来のみ許可（RLS WITH CHECK）。
--   ・不変カラムは UPDATE で書き換え不可（reject_immutable_columns）。
--   ・共通関数（set_updated_at / reject_immutable_columns / current_app_role /
--     current_organization_id / current_academic_year / is_staff）は既存 migration を再利用。
--   ・本ファイルは作成のみ。Supabase への適用は人間レビュー後に行う。
-- ---------------------------------------------------------------------

create table if not exists public.form3_records (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id),
  academic_year   integer not null,
  case_id         text not null,
  payload         jsonb not null,                 -- Form3Data（schemaVersion 含む）
  version         integer not null default 1,     -- レコードバージョン（楽観ロック）
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint form3_records_case_id_not_blank check (btrim(case_id) <> ''),
  constraint form3_records_version_positive check (version >= 1),
  unique (user_id, organization_id, academic_year, case_id)
);

create index if not exists idx_form3_records_owner
  on public.form3_records (
    user_id, organization_id, academic_year, case_id
  );

-- updated_at 自動更新（監査・表示用。競合判定には version を使う）
drop trigger if exists trg_form3_records_updated_at on public.form3_records;
create trigger trg_form3_records_updated_at
  before update on public.form3_records
  for each row execute function public.set_updated_at();

-- 不変カラム保護（作成後は変更不可）
drop trigger if exists trg_form3_records_immutable on public.form3_records;
create trigger trg_form3_records_immutable
  before update on public.form3_records
  for each row execute function public.reject_immutable_columns(
    'user_id', 'organization_id', 'academic_year', 'case_id', 'created_at'
  );

-- =====================================================================
-- RLS（form2_records と同方針）
-- =====================================================================
--   student : 自分の行のみ SELECT / INSERT / UPDATE
--             INSERT/UPDATE の WITH CHECK で
--               user_id = auth.uid()
--               role = 'student'
--               organization_id = current_organization_id()
--               academic_year   = current_academic_year()
--   teacher/admin : 自組織の学生データを SELECT のみ
--   DELETE         : どのロールにも GRANT しない
-- ---------------------------------------------------------------------
alter table public.form3_records enable row level security;

drop policy if exists form3_select_own on public.form3_records;
create policy form3_select_own
  on public.form3_records
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists form3_insert_own on public.form3_records;
create policy form3_insert_own
  on public.form3_records
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.current_app_role() = 'student'
    and organization_id = public.current_organization_id()
    and academic_year   = public.current_academic_year()
  );

drop policy if exists form3_update_own on public.form3_records;
create policy form3_update_own
  on public.form3_records
  for update
  to authenticated
  using (user_id = auth.uid() and public.current_app_role() = 'student')
  with check (
    user_id = auth.uid()
    and public.current_app_role() = 'student'
    and organization_id = public.current_organization_id()
    and academic_year   = public.current_academic_year()
  );

drop policy if exists form3_select_staff on public.form3_records;
create policy form3_select_staff
  on public.form3_records
  for select
  to authenticated
  using (public.is_staff() and organization_id = public.current_organization_id());

grant select, insert, update on public.form3_records to authenticated; -- DELETE は付与しない
grant all on public.form3_records to service_role;

comment on table public.form3_records is
  '様式3（ゴードンの11の機能的健康パターン）の保存テーブル。学生 × 組織 × 年度 × ケースで 1 件。教員・管理者は自組織を閲覧のみ。物理 DELETE は付与しない。';
comment on column public.form3_records.payload is
  'Form3Data（schemaVersion / patterns）。DB列 version（楽観ロック）とは別物。';
comment on column public.form3_records.version is
  'レコードバージョン（楽観ロック）。payload.schemaVersion と混同しない。';
comment on column public.form3_records.case_id is
  '受け持ちケースID（サーバ側で解決した値を保存）。';
