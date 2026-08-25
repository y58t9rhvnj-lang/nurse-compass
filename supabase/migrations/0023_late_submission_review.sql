-- =====================================================================
-- Compass Version 2.2 Sprint 4C
-- 0023_late_submission_review.sql
-- 期限後提出の承認／却下 RPC + evaluation candidate VIEW 置換
-- =====================================================================
-- 方針:
--   ・0017〜0022 は変更しない。
--   ・late_review_* 列は既存のまま使用（列追加なし）。
--   ・submissions への直接 UPDATE 権限は広げず、SECURITY DEFINER RPC 経由。
-- ---------------------------------------------------------------------

-- =====================================================================
-- 1. assessment_evaluation_candidates（同名置換）
-- 優先: approved late → on_time。pending / rejected / withdrawn 除外。
-- =====================================================================
create or replace view public.assessment_evaluation_candidates
with (security_invoker = true)
as
select distinct on (s.assessment_milestone_id, s.student_user_id)
  s.assessment_milestone_id,
  s.assessment_cycle_id,
  s.student_user_id,
  s.organization_id,
  s.case_id,
  s.id as submission_id,
  s.submission_number,
  s.submitted_at,
  s.timing_status,
  s.late_review_status
from public.assessment_submissions s
where s.is_withdrawn = false
  and (
    (s.timing_status = 'late' and s.late_review_status = 'approved')
    or s.timing_status = 'on_time'
  )
order by
  s.assessment_milestone_id,
  s.student_user_id,
  case
    when s.timing_status = 'late' and s.late_review_status = 'approved' then 0
    when s.timing_status = 'on_time' then 1
    else 2
  end,
  s.submission_number desc,
  s.submitted_at desc,
  s.id desc;

comment on view public.assessment_evaluation_candidates is
  '学生×milestone の評価候補。優先: 承認済み期限後最新 → 期限内最新。pending/rejected 除外。';

grant select on public.assessment_evaluation_candidates to authenticated;

-- =====================================================================
-- 2. 期限後提出 承認／却下（内部共通）
-- =====================================================================
create or replace function public._review_late_assessment_submission(
  p_submission_id uuid,
  p_decision text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_org uuid;
  v_note text;
  v_sub public.assessment_submissions%rowtype;
  v_prev_candidate uuid;
  v_new_candidate uuid;
  v_updated int;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  select role, organization_id into v_role, v_org
  from public.profiles
  where id = v_uid and is_active = true;

  if v_role is null or v_role not in ('teacher', 'admin') or v_org is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  if p_decision is null or p_decision not in ('approved', 'rejected') then
    return jsonb_build_object('ok', false, 'error', 'validation');
  end if;

  if p_submission_id is null then
    return jsonb_build_object('ok', false, 'error', 'validation');
  end if;

  v_note := nullif(btrim(coalesce(p_note, '')), '');
  if v_note is not null and char_length(v_note) > 1000 then
    return jsonb_build_object('ok', false, 'error', 'validation', 'message', 'note_too_long');
  end if;

  select * into v_sub
  from public.assessment_submissions
  where id = p_submission_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if v_sub.organization_id is distinct from v_org then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  if v_sub.is_withdrawn then
    return jsonb_build_object('ok', false, 'error', 'validation');
  end if;

  if v_sub.timing_status is distinct from 'late' then
    return jsonb_build_object('ok', false, 'error', 'validation');
  end if;

  if v_sub.late_review_status is distinct from 'pending' then
    return jsonb_build_object(
      'ok', false,
      'error', 'conflict',
      'message', 'already_reviewed'
    );
  end if;

  -- 承認前の candidate
  select c.submission_id into v_prev_candidate
  from public.assessment_evaluation_candidates c
  where c.assessment_milestone_id = v_sub.assessment_milestone_id
    and c.student_user_id = v_sub.student_user_id
  limit 1;

  update public.assessment_submissions
  set
    late_review_status = p_decision,
    late_reviewed_at = now(),
    late_reviewed_by = v_uid,
    late_review_note = coalesce(v_note, '')
  where id = p_submission_id
    and timing_status = 'late'
    and late_review_status = 'pending';

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    return jsonb_build_object(
      'ok', false,
      'error', 'conflict',
      'message', 'already_reviewed'
    );
  end if;

  select c.submission_id into v_new_candidate
  from public.assessment_evaluation_candidates c
  where c.assessment_milestone_id = v_sub.assessment_milestone_id
    and c.student_user_id = v_sub.student_user_id
  limit 1;

  return jsonb_build_object(
    'ok', true,
    'submissionId', p_submission_id,
    'decision', p_decision,
    'submissionNumber', v_sub.submission_number,
    'previousCandidateSubmissionId', to_jsonb(v_prev_candidate),
    'newCandidateSubmissionId', to_jsonb(v_new_candidate),
    'candidateChanged',
      (v_prev_candidate is distinct from v_new_candidate)
  );
end;
$$;

revoke all on function public._review_late_assessment_submission(uuid, text, text)
  from public;
revoke all on function public._review_late_assessment_submission(uuid, text, text)
  from anon;
-- 内部用。authenticated への直接 EXECUTE は付与しない。

create or replace function public.approve_late_assessment_submission(
  p_submission_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public._review_late_assessment_submission(p_submission_id, 'approved', p_note);
end;
$$;

create or replace function public.reject_late_assessment_submission(
  p_submission_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public._review_late_assessment_submission(p_submission_id, 'rejected', p_note);
end;
$$;

revoke all on function public.approve_late_assessment_submission(uuid, text) from public;
revoke all on function public.approve_late_assessment_submission(uuid, text) from anon;
grant execute on function public.approve_late_assessment_submission(uuid, text) to authenticated;

revoke all on function public.reject_late_assessment_submission(uuid, text) from public;
revoke all on function public.reject_late_assessment_submission(uuid, text) from anon;
grant execute on function public.reject_late_assessment_submission(uuid, text) to authenticated;

comment on function public.approve_late_assessment_submission(uuid, text) is
  '教員: 期限後提出を評価対象として承認。pending のみ。';
comment on function public.reject_late_assessment_submission(uuid, text) is
  '教員: 期限後提出を評価対象外として却下。pending のみ。';
