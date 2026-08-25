-- =====================================================================
-- Compass Version 2.2 Sprint 4C
-- 0024_assessment_review_returns.sql
-- 評価返却・返却取消・学生向け安全 RPC
-- =====================================================================
-- 方針:
--   ・status は draft/completed のまま。returned_* は別管理。
--   ・学生に assessment_reviews の SELECT は付与しない。
--   ・private_note は学生 RPC の戻りに含めない。
-- ---------------------------------------------------------------------

alter table public.assessment_reviews
  add column if not exists returned_at timestamptz null,
  add column if not exists returned_by uuid null references auth.users(id),
  add column if not exists return_revoked_at timestamptz null,
  add column if not exists return_revoked_by uuid null references auth.users(id),
  add column if not exists return_revoke_reason text null;

comment on column public.assessment_reviews.returned_at is
  '学生への返却時刻。null なら未返却（または取消後も監査用に保持し return_revoked_at で判定）。';
comment on column public.assessment_reviews.returned_by is
  '返却した教員。';
comment on column public.assessment_reviews.return_revoked_at is
  '返却取消時刻。学生可視は returned_at IS NOT NULL AND return_revoked_at IS NULL。';
comment on column public.assessment_reviews.return_revoked_by is
  '返却を取り消した教員。';
comment on column public.assessment_reviews.return_revoke_reason is
  '返却取消理由（必須・アプリ側で検証）。';

-- 整合: revoke があるなら returned_at も必須
alter table public.assessment_reviews
  drop constraint if exists assessment_reviews_return_revoke_consistency;
alter table public.assessment_reviews
  add constraint assessment_reviews_return_revoke_consistency check (
    return_revoked_at is null
    or (returned_at is not null and return_revoked_by is not null)
  );

create index if not exists idx_assessment_reviews_returned_student
  on public.assessment_reviews (student_user_id, returned_at desc)
  where returned_at is not null and return_revoked_at is null;

create index if not exists idx_assessment_reviews_milestone_returned
  on public.assessment_reviews (
    organization_id, assessment_milestone_id, student_user_id
  )
  where returned_at is not null;

-- =====================================================================
-- 学生向け: 返却済み一覧（private_note なし）
-- =====================================================================
create or replace function public.list_my_returned_assessment_reviews()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_org uuid;
  v_items jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  select role, organization_id into v_role, v_org
  from public.profiles
  where id = v_uid and is_active = true;

  if v_role is distinct from 'student' or v_org is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'reviewId', x.review_id,
        'cycleTitle', x.cycle_title,
        'milestoneTitle', x.milestone_title,
        'evaluationType', x.evaluation_type,
        'submissionNumber', x.submission_number,
        'returnedAt', x.returned_at
      )
      order by x.returned_at desc
    ),
    '[]'::jsonb
  )
  into v_items
  from (
    select
      r.id as review_id,
      c.title as cycle_title,
      m.title as milestone_title,
      m.evaluation_type,
      s.submission_number,
      r.returned_at
    from public.assessment_reviews r
    join public.assessment_submissions s
      on s.id = r.assessment_submission_id
    join public.assessment_milestones m
      on m.id = r.assessment_milestone_id
    join public.assessment_cycles c
      on c.id = r.assessment_cycle_id
    where r.student_user_id = v_uid
      and r.organization_id = v_org
      and s.student_user_id = v_uid
      and s.organization_id = v_org
      and r.returned_at is not null
      and r.return_revoked_at is null
      and r.status = 'completed'
  ) x;

  return jsonb_build_object('ok', true, 'items', v_items);
end;
$$;

revoke all on function public.list_my_returned_assessment_reviews() from public;
revoke all on function public.list_my_returned_assessment_reviews() from anon;
grant execute on function public.list_my_returned_assessment_reviews() to authenticated;

-- =====================================================================
-- 学生向け: 返却済み詳細（private_note なし）
-- =====================================================================
create or replace function public.get_my_returned_assessment_review(
  p_review_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_org uuid;
  v_row record;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  select role, organization_id into v_role, v_org
  from public.profiles
  where id = v_uid and is_active = true;

  if v_role is distinct from 'student' or v_org is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  if p_review_id is null then
    return jsonb_build_object('ok', false, 'error', 'validation');
  end if;

  select
    r.id as review_id,
    c.title as cycle_title,
    m.title as milestone_title,
    m.evaluation_type,
    s.submission_number,
    r.returned_at,
    r.rubric_scores,
    r.overall_comment,
    r.strengths_comment,
    r.next_steps_comment,
    r.missing_information_comment
  into v_row
  from public.assessment_reviews r
  join public.assessment_submissions s
    on s.id = r.assessment_submission_id
  join public.assessment_milestones m
    on m.id = r.assessment_milestone_id
  join public.assessment_cycles c
    on c.id = r.assessment_cycle_id
  where r.id = p_review_id
    and r.student_user_id = v_uid
    and r.organization_id = v_org
    and s.student_user_id = v_uid
    and s.organization_id = v_org
    and r.returned_at is not null
    and r.return_revoked_at is null
    and r.status = 'completed';

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  return jsonb_build_object(
    'ok', true,
    'review', jsonb_build_object(
      'reviewId', v_row.review_id,
      'cycleTitle', v_row.cycle_title,
      'milestoneTitle', v_row.milestone_title,
      'evaluationType', v_row.evaluation_type,
      'submissionNumber', v_row.submission_number,
      'returnedAt', v_row.returned_at,
      'rubricScores', v_row.rubric_scores,
      'overallComment', v_row.overall_comment,
      'strengthsComment', v_row.strengths_comment,
      'nextStepsComment', v_row.next_steps_comment,
      'missingInformationComment', v_row.missing_information_comment
    )
  );
end;
$$;

revoke all on function public.get_my_returned_assessment_review(uuid) from public;
revoke all on function public.get_my_returned_assessment_review(uuid) from anon;
grant execute on function public.get_my_returned_assessment_review(uuid) to authenticated;

comment on function public.list_my_returned_assessment_reviews() is
  '学生: 自分への返却済み評価一覧。private_note 非含有。';
comment on function public.get_my_returned_assessment_review(uuid) is
  '学生: 自分への返却済み評価詳細。private_note 非含有。';
