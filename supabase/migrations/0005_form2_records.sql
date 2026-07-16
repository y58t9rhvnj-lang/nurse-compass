-- =====================================================================
-- Compass Version2 β — Phase 3-1
-- 0005_form2_records.sql : 様式2の保存テーブル・共通関数・不変カラム保護
-- =====================================================================
-- 方針（docs/version2/05_information_notebook.md の決定に準拠）:
--   ・様式2は「学生ごと / 組織ごと / 年度ごと / ケースごと」に1レコード（head 方式）。
--   ・payload(jsonb) に Form2Data をそのまま保持する。
--   ・DB列 version = レコードバージョン（楽観ロック＝競合判定・更新回数）。
--     payload 内の Form2Data.version は「構造(スキーマ)バージョン」であり、
--     DB列 version とは意味が異なる。両者を同じ意味で二重管理しない。
--   ・organization_id / academic_year は profile から導出した値のみ許可（RLS）。
--   ・不変カラムは UPDATE で書き換え不可（トリガーで拒否）。
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 学生 profile の academic_year を返す（RLS の改ざん防止に使用）。
-- current_app_role() / current_organization_id() と同方針（SECURITY DEFINER）。
-- ---------------------------------------------------------------------
create or replace function public.current_academic_year()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select academic_year from public.profiles where id = auth.uid()
$$;

revoke all on function public.current_academic_year() from public;
revoke all on function public.current_academic_year() from anon;
grant execute on function public.current_academic_year() to authenticated;

-- ---------------------------------------------------------------------
-- 不変カラム保護（汎用）。TG_ARGV に列名を渡し、UPDATE で値が変わったら拒否する。
--   RLS の WITH CHECK は「許可範囲内の別値への変更」を完全には防げないため、
--   本トリガーで identity 系カラムの不変性を保証する。
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
-- form2_records
-- ---------------------------------------------------------------------
create table if not exists public.form2_records (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id),
  academic_year   integer not null default 2026,
  case_id         text not null,
  payload         jsonb not null,                 -- Form2Data（構造version 含む）
  version         integer not null default 1,     -- レコードバージョン（楽観ロック）
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint form2_records_case_id_not_blank check (btrim(case_id) <> ''),
  constraint form2_records_version_positive check (version >= 1),
  unique (user_id, organization_id, academic_year, case_id)
);

-- updated_at 自動更新（監査・表示用。競合判定には version を使う）
drop trigger if exists trg_form2_records_updated_at on public.form2_records;
create trigger trg_form2_records_updated_at
  before update on public.form2_records
  for each row execute function public.set_updated_at();

-- 不変カラム保護（作成後は変更不可）
drop trigger if exists trg_form2_records_immutable on public.form2_records;
create trigger trg_form2_records_immutable
  before update on public.form2_records
  for each row execute function public.reject_immutable_columns(
    'user_id', 'organization_id', 'academic_year', 'case_id', 'created_at'
  );
