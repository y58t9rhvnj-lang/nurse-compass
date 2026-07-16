-- =====================================================================
-- Compass Version2 β — Phase 2
-- 0003_functions_and_rls.sql : 共通関数・トリガー・RLS
-- =====================================================================

-- ---------------------------------------------------------------------
-- updated_at 自動更新
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_organizations_updated_at on public.organizations;
create trigger trg_organizations_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 認可用の補助関数（すべて SECURITY DEFINER）
--   ・ログインユーザー(auth.uid())自身を基準に判定する。任意の user_id は渡せない。
--   ・profiles を参照するポリシー内から profiles を再参照しても無限再帰しないよう、
--     定義者権限で RLS を回避して取得する。
-- ---------------------------------------------------------------------
create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role from public.profiles where id = auth.uid()) in ('teacher','admin'),
    false
  )
$$;

-- ログインユーザー自身の organization_id を返す。
create or replace function public.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.profiles where id = auth.uid()
$$;

-- ---------------------------------------------------------------------
-- SECURITY DEFINER 関数の実行権限を明示的に制限
--   ・PUBLIC / anon からの実行を取り消す
--   ・authenticated のみ実行可能
--   ・service role は RLS を回避して管理処理を行うため、これら関数に依存しない
--     （任意 user_id を渡す設計ではなく、常に auth.uid() 基準）
-- ---------------------------------------------------------------------
revoke all on function public.current_app_role() from public;
revoke all on function public.current_app_role() from anon;
grant execute on function public.current_app_role() to authenticated;

revoke all on function public.is_staff() from public;
revoke all on function public.is_staff() from anon;
grant execute on function public.is_staff() to authenticated;

revoke all on function public.current_organization_id() from public;
revoke all on function public.current_organization_id() from anon;
grant execute on function public.current_organization_id() to authenticated;

-- ---------------------------------------------------------------------
-- profiles RLS
--   student : 自分の行のみ SELECT
--   teacher/admin : 「自分と同じ organization_id」の profiles のみ SELECT
--       （β版では admin も teacher と同じ組織内限定。全組織横断は持たせない。
--         将来 system_admin を別権限として追加する。）
--   INSERT/UPDATE/DELETE ポリシーは作らない
--     → 一般ユーザーは profiles を書き換え不可。作成・更新はシード(service role)のみ。
--
-- 【重要】将来、学生が INSERT/UPDATE するデータ系テーブルでは、SELECT だけでなく
--   INSERT・UPDATE の WITH CHECK にも必ず user_id = auth.uid() を課す。02_database.md 参照。
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

drop policy if exists profiles_select_staff on public.profiles;
create policy profiles_select_staff
  on public.profiles
  for select
  to authenticated
  using (
    public.is_staff()
    and organization_id = public.current_organization_id()
  );

-- ---------------------------------------------------------------------
-- organizations RLS
--   認証済みユーザーは「自分が所属する組織」のみ SELECT 可能。
--   作成・更新はシード(service role, RLS回避)のみ。
-- ---------------------------------------------------------------------
drop policy if exists organizations_select_authenticated on public.organizations;
drop policy if exists organizations_select_own on public.organizations;
create policy organizations_select_own
  on public.organizations
  for select
  to authenticated
  using (id = public.current_organization_id());
