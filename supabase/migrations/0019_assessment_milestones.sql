-- =====================================================================
-- Compass Version 2.2 Sprint 3A
-- 0019_assessment_milestones.sql
-- assessment_milestones 追加・既存提出の紐付け・RPC/VIEW の milestone 対応
-- =====================================================================
-- ・0017 / 0018 は変更しない。
-- ・assessment_cycles.deadline_at は互換残置。新規提出の正本は milestones.deadline_at。
-- ・既存提出の id / number / timing / snapshot 等は不変のまま milestone へ紐付け。
-- ---------------------------------------------------------------------

-- =====================================================================
-- 0. assessment_cycles 説明（任意）— Sprint 3A 教員明示作成用
-- =====================================================================
alter table public.assessment_cycles
  add column if not exists description text null;

comment on column public.assessment_cycles.description is
  '講義・課題グループの説明（任意）。Sprint 3A で教員が入力。';

-- =====================================================================
-- 1. assessment_milestones
-- =====================================================================
create table if not exists public.assessment_milestones (
  id                   uuid primary key default gen_random_uuid(),
  assessment_cycle_id  uuid not null references public.assessment_cycles(id),
  organization_id      uuid not null references public.organizations(id),
  title                text not null,
  description          text null,
  milestone_type       text not null,
  sequence_number      integer not null,
  opens_at             timestamptz null,
  deadline_at          timestamptz not null,
  closes_at            timestamptz null,
  submission_scope     jsonb not null,
  evaluation_type      text not null,
  status               text not null,
  created_by           uuid not null references auth.users(id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint assessment_milestones_title_not_blank check (btrim(title) <> ''),
  constraint assessment_milestones_sequence_positive check (sequence_number >= 1),
  constraint assessment_milestones_type_check check (
    milestone_type in (
      'form2',
      'form3_progress',
      'form3_complete',
      'final',
      'custom'
    )
  ),
  constraint assessment_milestones_evaluation_check check (
    evaluation_type in ('formative', 'summative')
  ),
  constraint assessment_milestones_status_check check (
    status in ('draft', 'open', 'closed', 'archived')
  ),
  unique (assessment_cycle_id, sequence_number)
);

create index if not exists idx_assessment_milestones_cycle_seq
  on public.assessment_milestones (assessment_cycle_id, sequence_number);

create index if not exists idx_assessment_milestones_org_status
  on public.assessment_milestones (organization_id, status);

drop trigger if exists trg_assessment_milestones_updated_at on public.assessment_milestones;
create trigger trg_assessment_milestones_updated_at
  before update on public.assessment_milestones
  for each row execute function public.set_updated_at();

comment on table public.assessment_milestones is
  '講義内の提出課題・期限（マイルストーン）。期限判定の正本は deadline_at。';
comment on column public.assessment_milestones.submission_scope is
  '提出範囲メタ（表示・警告・将来の評価絞り込み）。Sprint 3A では snapshot は全体保存。';

-- =====================================================================
-- 2. 既存 cycle → 移行用 milestone（1 cycle = 1 milestone）
-- =====================================================================
insert into public.assessment_milestones (
  assessment_cycle_id,
  organization_id,
  title,
  description,
  milestone_type,
  sequence_number,
  opens_at,
  deadline_at,
  closes_at,
  submission_scope,
  evaluation_type,
  status,
  created_by
)
select
  c.id,
  c.organization_id,
  '既存課題提出',
  'Sprint 2 からの移行用マイルストーン',
  'final',
  1,
  c.opens_at,
  c.deadline_at,
  c.closes_at,
  jsonb_build_object(
    'includeForm2', true,
    'includeForm3', true,
    'form3Scope', jsonb_build_object('mode', 'all_patterns'),
    'includeInformationCards', true,
    'includeEvidenceLinks', true,
    'includeFieldReflections', true,
    'includePatientUnderstanding', true
  ),
  'summative',
  case
    when c.status in ('draft', 'open', 'closed', 'archived') then c.status
    else 'open'
  end,
  c.created_by
from public.assessment_cycles c
where not exists (
  select 1
  from public.assessment_milestones m
  where m.assessment_cycle_id = c.id
);

-- =====================================================================
-- 3. submissions に milestone_id 追加・既存行を紐付け
-- =====================================================================
alter table public.assessment_submissions
  add column if not exists assessment_milestone_id uuid null;

update public.assessment_submissions s
set assessment_milestone_id = m.id
from public.assessment_milestones m
where m.assessment_cycle_id = s.assessment_cycle_id
  and m.sequence_number = 1
  and s.assessment_milestone_id is null;

-- 未紐付けが残っていれば失敗させる
do $$
declare
  v_orphans integer;
begin
  select count(*)::integer into v_orphans
  from public.assessment_submissions
  where assessment_milestone_id is null;

  if v_orphans > 0 then
    raise exception
      'assessment_submissions.assessment_milestone_id backfill incomplete: % orphan(s)',
      v_orphans;
  end if;
end $$;

alter table public.assessment_submissions
  alter column assessment_milestone_id set not null;

alter table public.assessment_submissions
  drop constraint if exists assessment_submissions_assessment_milestone_id_fkey;

alter table public.assessment_submissions
  add constraint assessment_submissions_assessment_milestone_id_fkey
  foreign key (assessment_milestone_id)
  references public.assessment_milestones(id);

-- 旧 unique（cycle 単位）を外し、milestone 単位へ
alter table public.assessment_submissions
  drop constraint if exists assessment_submissions_assessment_cycle_id_student_user_id_submission_number_key;

alter table public.assessment_submissions
  add constraint assessment_submissions_milestone_student_number_key
  unique (assessment_milestone_id, student_user_id, submission_number);

drop index if exists uq_assessment_submissions_client_request;
create unique index uq_assessment_submissions_client_request
  on public.assessment_submissions (
    assessment_milestone_id, student_user_id, client_request_id
  )
  where client_request_id is not null;

create index if not exists idx_assessment_submissions_milestone
  on public.assessment_submissions (
    assessment_milestone_id, student_user_id, submitted_at desc
  );

comment on column public.assessment_submissions.assessment_milestone_id is
  '提出先マイルストーン。採番・期限判定の単位。';

-- =====================================================================
-- 4. 評価候補 VIEW（milestone 単位）
-- =====================================================================
drop view if exists public.assessment_evaluation_candidates;

create view public.assessment_evaluation_candidates
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
  and s.timing_status = 'on_time'
order by
  s.assessment_milestone_id,
  s.student_user_id,
  s.submitted_at desc,
  s.submission_number desc;

comment on view public.assessment_evaluation_candidates is
  '学生×milestone の評価候補。Sprint 3A は期限内最後。承認済み期限後は後続 Sprint。';

grant select on public.assessment_evaluation_candidates to authenticated;

-- =====================================================================
-- 5. 旧 RPC を削除し、milestone 版へ置換
-- =====================================================================
drop function if exists public.get_assessment_submit_preview(text);
drop function if exists public.submit_assessment_submission(text, jsonb, jsonb, integer, text);

-- 学生向け: open milestone 一覧（推測なし）
create or replace function public.list_open_assessment_milestones(
  p_case_id text
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

  if p_case_id is null or btrim(p_case_id) = '' then
    return jsonb_build_object('ok', false, 'error', 'validation');
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'milestoneId', x.milestone_id,
        'milestoneTitle', x.milestone_title,
        'description', x.description,
        'milestoneType', x.milestone_type,
        'evaluationType', x.evaluation_type,
        'sequenceNumber', x.sequence_number,
        'opensAt', x.opens_at,
        'deadlineAt', x.deadline_at,
        'submissionScope', x.submission_scope,
        'status', x.status,
        'cycleId', x.cycle_id,
        'cycleTitle', x.cycle_title,
        'caseId', x.case_id
      )
      order by x.cycle_title, x.sequence_number
    ),
    '[]'::jsonb
  )
    into v_items
  from (
    select
      m.id as milestone_id,
      m.title as milestone_title,
      m.description,
      m.milestone_type,
      m.evaluation_type,
      m.sequence_number,
      m.opens_at,
      m.deadline_at,
      m.submission_scope,
      m.status,
      c.id as cycle_id,
      c.title as cycle_title,
      c.case_id
    from public.assessment_milestones m
    join public.assessment_cycles c on c.id = m.assessment_cycle_id
    where m.organization_id = v_org
      and c.organization_id = v_org
      and c.case_id = p_case_id
      and m.status = 'open'
      and (m.opens_at is null or m.opens_at <= now())
  ) x;

  return jsonb_build_object(
    'ok', true,
    'serverNow', now(),
    'items', v_items
  );
end;
$$;

revoke all on function public.list_open_assessment_milestones(text) from public;
revoke all on function public.list_open_assessment_milestones(text) from anon;
grant execute on function public.list_open_assessment_milestones(text) to authenticated;

-- preview（milestone 明示）
create or replace function public.get_assessment_submit_preview(
  p_assessment_milestone_id uuid
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
  v_m public.assessment_milestones%rowtype;
  v_cycle public.assessment_cycles%rowtype;
  v_now timestamptz := now();
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

  if p_assessment_milestone_id is null then
    return jsonb_build_object('ok', false, 'error', 'validation');
  end if;

  select * into v_m
  from public.assessment_milestones
  where id = p_assessment_milestone_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found', 'message', '提出課題が見つかりません');
  end if;

  if v_m.organization_id is distinct from v_org then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  select * into v_cycle
  from public.assessment_cycles
  where id = v_m.assessment_cycle_id;

  if not found or v_cycle.organization_id is distinct from v_org then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  if v_m.status is distinct from 'open' then
    return jsonb_build_object(
      'ok', false,
      'error', 'not_open',
      'message', 'この提出課題は現在受付を終了しています。'
    );
  end if;

  if v_m.opens_at is not null and v_now < v_m.opens_at then
    return jsonb_build_object(
      'ok', false,
      'error', 'not_open',
      'message', 'この提出課題はまだ受付開始前です。'
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'assessmentMilestoneId', v_m.id,
    'assessmentCycleId', v_cycle.id,
    'cycleTitle', v_cycle.title,
    'milestoneTitle', v_m.title,
    'milestoneType', v_m.milestone_type,
    'evaluationType', v_m.evaluation_type,
    'submissionScope', v_m.submission_scope,
    'deadlineAt', v_m.deadline_at,
    'serverNow', v_now,
    'wouldBeLate', (v_now >= v_m.deadline_at)
  );
end;
$$;

revoke all on function public.get_assessment_submit_preview(uuid) from public;
revoke all on function public.get_assessment_submit_preview(uuid) from anon;
grant execute on function public.get_assessment_submit_preview(uuid) to authenticated;

-- submit（milestone 明示）
create or replace function public.submit_assessment_submission(
  p_assessment_milestone_id uuid,
  p_case_id text,
  p_snapshot jsonb,
  p_source_versions jsonb,
  p_snapshot_schema_version integer,
  p_client_request_id text default null
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
  v_m public.assessment_milestones%rowtype;
  v_cycle public.assessment_cycles%rowtype;
  v_now timestamptz;
  v_timing text;
  v_late_review text;
  v_next_number integer;
  v_existing public.assessment_submissions%rowtype;
  v_row public.assessment_submissions%rowtype;
  v_snapshot jsonb;
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

  if p_assessment_milestone_id is null
     or p_case_id is null or btrim(p_case_id) = ''
     or p_snapshot is null
     or p_source_versions is null
     or p_snapshot_schema_version is null
     or p_snapshot_schema_version < 1 then
    return jsonb_build_object('ok', false, 'error', 'validation');
  end if;

  select * into v_m
  from public.assessment_milestones
  where id = p_assessment_milestone_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found', 'message', '提出課題が見つかりません');
  end if;

  if v_m.organization_id is distinct from v_org then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  select * into v_cycle
  from public.assessment_cycles
  where id = v_m.assessment_cycle_id;

  if not found
     or v_cycle.organization_id is distinct from v_org
     or v_cycle.case_id is distinct from p_case_id then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  if v_m.status is distinct from 'open' then
    return jsonb_build_object(
      'ok', false,
      'error', 'not_open',
      'message', 'この提出課題は現在受付を終了しています。'
    );
  end if;

  perform pg_advisory_xact_lock(
    hashtext(v_m.id::text || ':' || v_uid::text)
  );

  v_now := now();

  if v_m.opens_at is not null and v_now < v_m.opens_at then
    return jsonb_build_object(
      'ok', false,
      'error', 'not_open',
      'message', 'この提出課題はまだ受付開始前です。'
    );
  end if;

  if p_client_request_id is not null and btrim(p_client_request_id) <> '' then
    select * into v_existing
    from public.assessment_submissions s
    where s.assessment_milestone_id = v_m.id
      and s.student_user_id = v_uid
      and s.client_request_id = p_client_request_id
    limit 1;

    if found then
      return jsonb_build_object(
        'ok', true,
        'idempotent', true,
        'submissionId', v_existing.id,
        'submissionNumber', v_existing.submission_number,
        'submittedAt', v_existing.submitted_at,
        'timingStatus', v_existing.timing_status,
        'lateReviewStatus', to_jsonb(v_existing.late_review_status),
        'assessmentCycleId', v_existing.assessment_cycle_id,
        'assessmentMilestoneId', v_existing.assessment_milestone_id,
        'deadlineAt', v_m.deadline_at
      );
    end if;
  end if;

  if v_now < v_m.deadline_at then
    v_timing := 'on_time';
    v_late_review := null;
  else
    v_timing := 'late';
    v_late_review := 'pending';
  end if;

  select coalesce(max(s.submission_number), 0) + 1
    into v_next_number
  from public.assessment_submissions s
  where s.assessment_milestone_id = v_m.id
    and s.student_user_id = v_uid;

  v_snapshot := p_snapshot
    || jsonb_build_object(
      'schemaVersion', p_snapshot_schema_version,
      'studentRef', v_uid::text,
      'caseId', p_case_id,
      'submittedAt', v_now,
      'assessmentCycle', jsonb_build_object(
        'id', v_cycle.id,
        'title', v_cycle.title,
        'deadlineAt', v_m.deadline_at
      ),
      'assessmentMilestone', jsonb_build_object(
        'id', v_m.id,
        'title', v_m.title,
        'milestoneType', v_m.milestone_type,
        'evaluationType', v_m.evaluation_type,
        'deadlineAt', v_m.deadline_at,
        'submissionScope', v_m.submission_scope
      )
    );

  insert into public.assessment_submissions (
    assessment_cycle_id,
    assessment_milestone_id,
    organization_id,
    student_user_id,
    case_id,
    submission_number,
    submitted_at,
    timing_status,
    late_review_status,
    snapshot_schema_version,
    snapshot,
    source_versions,
    client_request_id
  ) values (
    v_cycle.id,
    v_m.id,
    v_org,
    v_uid,
    p_case_id,
    v_next_number,
    v_now,
    v_timing,
    v_late_review,
    p_snapshot_schema_version,
    v_snapshot,
    p_source_versions,
    nullif(btrim(coalesce(p_client_request_id, '')), '')
  )
  returning * into v_row;

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'submissionId', v_row.id,
    'submissionNumber', v_row.submission_number,
    'submittedAt', v_row.submitted_at,
    'timingStatus', v_row.timing_status,
    'lateReviewStatus', to_jsonb(v_row.late_review_status),
    'assessmentCycleId', v_row.assessment_cycle_id,
    'assessmentMilestoneId', v_row.assessment_milestone_id,
    'deadlineAt', v_m.deadline_at
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'duplicate');
end;
$$;

revoke all on function public.submit_assessment_submission(uuid, text, jsonb, jsonb, integer, text)
  from public;
revoke all on function public.submit_assessment_submission(uuid, text, jsonb, jsonb, integer, text)
  from anon;
grant execute on function public.submit_assessment_submission(uuid, text, jsonb, jsonb, integer, text)
  to authenticated;

comment on column public.assessment_cycles.deadline_at is
  '互換残置。新規提出・判定の正本は assessment_milestones.deadline_at。';
