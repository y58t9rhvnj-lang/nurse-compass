-- =====================================================================
-- Compass Version 2.2 Sprint 4B
-- 0022_assessment_reviews.sql
-- 教員評価（下書き・確定）・RLS
-- =====================================================================
-- 方針:
--   ・評価は assessment_submission_id に固定（unique）。
--   ・evaluation candidate 切替後も旧提出の評価は残す（付け替えない）。
--   ・学生は SELECT 不可。DELETE ポリシーなし。
--   ・0017〜0021 / submissions / evaluation_candidates VIEW は変更しない。
-- ---------------------------------------------------------------------

create extension if not exists pgcrypto;

create table if not exists public.assessment_reviews (
  id                         uuid primary key default gen_random_uuid(),
  organization_id            uuid not null
    references public.organizations(id),
  assessment_cycle_id        uuid not null
    references public.assessment_cycles(id),
  assessment_milestone_id    uuid not null
    references public.assessment_milestones(id),
  student_user_id            uuid not null
    references auth.users(id),
  assessment_submission_id   uuid not null
    references public.assessment_submissions(id),
  status                     text not null default 'draft',
  rubric_scores              jsonb not null default '{}'::jsonb,
  overall_comment            text not null default '',
  strengths_comment          text not null default '',
  next_steps_comment         text not null default '',
  missing_information_comment text not null default '',
  -- 内部専用メモ。将来の学生返却対象外。
  private_note               text not null default '',
  created_at                 timestamptz not null default now(),
  created_by                 uuid not null references auth.users(id),
  updated_at                 timestamptz not null default now(),
  updated_by                 uuid not null references auth.users(id),
  completed_at               timestamptz null,
  completed_by               uuid null references auth.users(id),
  reopened_at                timestamptz null,
  reopened_by                uuid null references auth.users(id),
  constraint assessment_reviews_status_check check (
    status in ('draft', 'completed')
  ),
  constraint assessment_reviews_submission_unique
    unique (assessment_submission_id)
);

comment on table public.assessment_reviews is
  '教員評価。1 submission = 1 review。Sprint 4B は draft/completed。学生非公開。';
comment on column public.assessment_reviews.assessment_submission_id is
  '評価対象 snapshot の固定参照。candidate 変更後も付け替えない。';
comment on column public.assessment_reviews.private_note is
  '教員内部メモ。将来の学生返却処理に含めない。';
comment on column public.assessment_reviews.completed_at is
  '直近の評価確定時刻。下書き戻しでも null にしない。';
comment on column public.assessment_reviews.reopened_at is
  '下書きへ戻した時刻。';

create index if not exists idx_assessment_reviews_org_milestone
  on public.assessment_reviews (
    organization_id, assessment_milestone_id, student_user_id
  );

create index if not exists idx_assessment_reviews_student
  on public.assessment_reviews (student_user_id, assessment_milestone_id);

create index if not exists idx_assessment_reviews_updated
  on public.assessment_reviews (organization_id, updated_at desc);

drop trigger if exists trg_assessment_reviews_updated_at
  on public.assessment_reviews;
create trigger trg_assessment_reviews_updated_at
  before update on public.assessment_reviews
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.assessment_reviews enable row level security;

drop policy if exists assessment_reviews_select_staff
  on public.assessment_reviews;
create policy assessment_reviews_select_staff
  on public.assessment_reviews
  for select
  to authenticated
  using (
    public.is_staff()
    and organization_id = public.current_organization_id()
  );

drop policy if exists assessment_reviews_insert_staff
  on public.assessment_reviews;
create policy assessment_reviews_insert_staff
  on public.assessment_reviews
  for insert
  to authenticated
  with check (
    public.is_staff()
    and organization_id = public.current_organization_id()
    and created_by = auth.uid()
    and updated_by = auth.uid()
  );

drop policy if exists assessment_reviews_update_staff
  on public.assessment_reviews;
create policy assessment_reviews_update_staff
  on public.assessment_reviews
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

-- DELETE ポリシーは作成しない（学生含む全員拒否）

revoke all on public.assessment_reviews from public;
revoke all on public.assessment_reviews from anon;
grant select, insert, update on public.assessment_reviews to authenticated;
grant all on public.assessment_reviews to service_role;
