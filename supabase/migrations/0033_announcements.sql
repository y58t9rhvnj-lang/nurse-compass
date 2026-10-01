-- =====================================================================
-- Compass Version 2.2
-- 0033_announcements.sql
-- 全体お知らせ（announcements）と学生ごと既読（announcement_reads）
-- =====================================================================
-- 方針:
--   ・同一 organization_id の全学生へ公開する（学年・クラス別配信は持たない）。
--   ・学生は status='published' のみ読める。取り下げ（unpublished）は非表示。
--   ・staff（teacher / admin）は自組織の下書き・公開・取り下げ履歴を管理する。
--   ・既読は学生本人の明示的な「確認した」のみ。端末ストレージは使わない。
--   ・状態遷移は draft → published → unpublished の一方通行。
--     unpublished → published の再公開は禁止。再告知は新規下書きを作る。
--   ・物理 DELETE は付与しない。Form3 / 関連図テーブルは変更しない。
-- ---------------------------------------------------------------------

-- =====================================================================
-- 1. announcements
-- =====================================================================
create table if not exists public.announcements (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  title           text not null,
  body            text not null,
  status          text not null,
  published_at    timestamptz null,
  unpublished_at  timestamptz null,
  created_by      uuid not null references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint announcements_title_not_blank check (btrim(title) <> ''),
  constraint announcements_status_check check (
    status in ('draft', 'published', 'unpublished')
  ),
  constraint announcements_status_timestamps_check check (
    (
      status = 'draft'
      and published_at is null
      and unpublished_at is null
    )
    or (
      status = 'published'
      and published_at is not null
      and unpublished_at is null
    )
    or (
      status = 'unpublished'
      and published_at is not null
      and unpublished_at is not null
    )
  )
);

create index if not exists idx_announcements_org_status_published
  on public.announcements (organization_id, status, published_at desc);

drop trigger if exists trg_announcements_updated_at on public.announcements;
create trigger trg_announcements_updated_at
  before update on public.announcements
  for each row execute function public.set_updated_at();

-- 状態遷移の一方通行。RLS を迂回する service_role 更新でも再公開できない。
create or replace function public.announcements_enforce_status_transition()
returns trigger
language plpgsql
as $$
begin
  if new.organization_id is distinct from old.organization_id then
    raise exception 'announcements.organization_id is immutable';
  end if;
  if new.created_by is distinct from old.created_by then
    raise exception 'announcements.created_by is immutable';
  end if;
  if old.published_at is not null
     and new.published_at is distinct from old.published_at then
    raise exception 'announcements.published_at is immutable after publish';
  end if;
  if old.unpublished_at is not null
     and new.unpublished_at is distinct from old.unpublished_at then
    raise exception 'announcements.unpublished_at is immutable after unpublish';
  end if;
  if old.status = 'unpublished' then
    raise exception 'unpublished announcements cannot change; create a new draft';
  end if;
  if old.status = 'draft' and new.status not in ('draft', 'published') then
    raise exception 'invalid announcement status transition';
  end if;
  if old.status = 'published' and new.status not in ('published', 'unpublished') then
    raise exception 'invalid announcement status transition';
  end if;
  if old.status <> 'draft'
     and (
       new.title is distinct from old.title
       or new.body is distinct from old.body
     ) then
    raise exception 'published or unpublished announcement content is immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_announcements_status_transition on public.announcements;
create trigger trg_announcements_status_transition
  before update on public.announcements
  for each row execute function public.announcements_enforce_status_transition();

revoke all on function public.announcements_enforce_status_transition() from public;
revoke all on function public.announcements_enforce_status_transition() from anon;

comment on table public.announcements is
  '組織全体お知らせ。学生へ見せるのは published のみ。unpublished は管理履歴。';
comment on column public.announcements.status is
  'draft=下書き / published=公開中 / unpublished=取り下げ（学生非表示・再公開不可）。';
comment on column public.announcements.body is
  'プレーンテキスト。HTML は解釈しない。';

-- =====================================================================
-- 2. announcement_reads
-- =====================================================================
create table if not exists public.announcement_reads (
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id),
  read_at         timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

create index if not exists idx_announcement_reads_user
  on public.announcement_reads (user_id, read_at desc);

create index if not exists idx_announcement_reads_org
  on public.announcement_reads (organization_id, announcement_id);

comment on table public.announcement_reads is
  'お知らせごと・学生ごとの既読。確認ボタン押下時のみ INSERT。UPDATE/DELETE なし。';

-- =====================================================================
-- 3. RLS — announcements
-- =====================================================================
alter table public.announcements enable row level security;

-- 学生: 自組織の公開中のみ
drop policy if exists announcements_select_student on public.announcements;
create policy announcements_select_student
  on public.announcements
  for select
  to authenticated
  using (
    public.current_app_role() = 'student'
    and organization_id = public.current_organization_id()
    and status = 'published'
  );

-- staff: 自組織の全状態（下書き・公開・取り下げ履歴）
drop policy if exists announcements_select_staff on public.announcements;
create policy announcements_select_staff
  on public.announcements
  for select
  to authenticated
  using (
    public.is_staff()
    and organization_id = public.current_organization_id()
  );

-- staff 作成は下書きのみ。organization_id / created_by のなりすましを防ぐ。
drop policy if exists announcements_insert_staff on public.announcements;
create policy announcements_insert_staff
  on public.announcements
  for insert
  to authenticated
  with check (
    public.is_staff()
    and organization_id = public.current_organization_id()
    and created_by = auth.uid()
    and status = 'draft'
    and published_at is null
    and unpublished_at is null
  );

-- staff 更新は下書きと公開中だけ。取り下げ済み行は UPDATE 対象にしない。
drop policy if exists announcements_update_staff on public.announcements;
drop policy if exists announcements_update_staff_draft on public.announcements;
create policy announcements_update_staff_draft
  on public.announcements
  for update
  to authenticated
  using (
    public.is_staff()
    and organization_id = public.current_organization_id()
    and status = 'draft'
  )
  with check (
    public.is_staff()
    and organization_id = public.current_organization_id()
    and status in ('draft', 'published')
    and unpublished_at is null
  );

drop policy if exists announcements_update_staff_published on public.announcements;
create policy announcements_update_staff_published
  on public.announcements
  for update
  to authenticated
  using (
    public.is_staff()
    and organization_id = public.current_organization_id()
    and status = 'published'
  )
  with check (
    public.is_staff()
    and organization_id = public.current_organization_id()
    and status in ('published', 'unpublished')
  );

-- =====================================================================
-- 4. RLS — announcement_reads
-- =====================================================================
alter table public.announcement_reads enable row level security;

drop policy if exists announcement_reads_select_own on public.announcement_reads;
create policy announcement_reads_select_own
  on public.announcement_reads
  for select
  to authenticated
  using (
    user_id = auth.uid()
    and public.current_app_role() = 'student'
    and organization_id = public.current_organization_id()
  );

drop policy if exists announcement_reads_select_staff on public.announcement_reads;
create policy announcement_reads_select_staff
  on public.announcement_reads
  for select
  to authenticated
  using (
    public.is_staff()
    and organization_id = public.current_organization_id()
  );

-- 学生本人・公開中のお知らせに対する INSERT のみ。
drop policy if exists announcement_reads_insert_own on public.announcement_reads;
create policy announcement_reads_insert_own
  on public.announcement_reads
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.current_app_role() = 'student'
    and organization_id = public.current_organization_id()
    and exists (
      select 1
      from public.announcements a
      where a.id = announcement_id
        and a.organization_id = organization_id
        and a.organization_id = public.current_organization_id()
        and a.status = 'published'
    )
  );

-- =====================================================================
-- 5. GRANT（行の絞り込みは RLS）
-- =====================================================================
revoke all on public.announcements from public;
revoke all on public.announcements from anon;
grant select, insert, update on public.announcements to authenticated;
grant all on public.announcements to service_role;

revoke all on public.announcement_reads from public;
revoke all on public.announcement_reads from anon;
grant select, insert on public.announcement_reads to authenticated;
grant all on public.announcement_reads to service_role;
