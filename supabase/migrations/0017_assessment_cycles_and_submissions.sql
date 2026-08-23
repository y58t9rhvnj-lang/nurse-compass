-- =====================================================================
-- Compass Version 2.2 Sprint 2
-- 0017_assessment_cycles_and_submissions.sql
-- 課題提出期間・提出履歴（append-only）・提出 RPC・評価候補 VIEW
-- =====================================================================
-- 方針:
--   ・form2_records / form3_records 等の作業用 head は変更しない。
--   ・提出は assessment_submissions へ追記のみ（UPDATE/DELETE しない）。
--   ・期限内判定: submitted_at < deadline_at → on_time、それ以外 → late
--   ・採番・期限判定・INSERT は RPC 内で原子的に実行する。
--   ・open cycle が 0 / 複数件のときは提出を中止する（推測選択しない）。
--   ・is_evaluation_target は追加しない（評価候補は算出）。
-- ---------------------------------------------------------------------

-- =====================================================================
-- assessment_cycles
-- =====================================================================
create table if not exists public.assessment_cycles (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  case_id         text not null,
  title           text not null,
  opens_at        timestamptz null,
  deadline_at     timestamptz not null,
  closes_at       timestamptz null,
  status          text not null,
  created_by      uuid not null references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint assessment_cycles_case_id_not_blank check (btrim(case_id) <> ''),
  constraint assessment_cycles_title_not_blank check (btrim(title) <> ''),
  constraint assessment_cycles_status_check check (
    status in ('draft', 'open', 'closed', 'archived')
  )
);

create index if not exists idx_assessment_cycles_org_case_status
  on public.assessment_cycles (organization_id, case_id, status);

create index if not exists idx_assessment_cycles_deadline
  on public.assessment_cycles (deadline_at);

drop trigger if exists trg_assessment_cycles_updated_at on public.assessment_cycles;
create trigger trg_assessment_cycles_updated_at
  before update on public.assessment_cycles
  for each row execute function public.set_updated_at();

comment on table public.assessment_cycles is
  '課題・ケースごとの提出期間。deadline_at が期限内／期限後判定の正本。Version 2.2 では提出を止めない。';
comment on column public.assessment_cycles.deadline_at is
  '提出期限。submitted_at < deadline_at のみ on_time。';
comment on column public.assessment_cycles.closes_at is
  '将来の受付停止用（Version 2.2 では原則未使用）。';

-- =====================================================================
-- assessment_submissions（append-only）
-- =====================================================================
create table if not exists public.assessment_submissions (
  id                      uuid primary key default gen_random_uuid(),
  assessment_cycle_id     uuid not null
    references public.assessment_cycles(id),
  organization_id         uuid not null references public.organizations(id),
  student_user_id         uuid not null references auth.users(id),
  case_id                 text not null,
  submission_number       integer not null,
  submitted_at            timestamptz not null default now(),
  timing_status           text not null,
  late_review_status      text null,
  snapshot_schema_version integer not null,
  snapshot                jsonb not null,
  source_versions         jsonb not null,
  is_withdrawn            boolean not null default false,
  late_reviewed_by        uuid null references auth.users(id),
  late_reviewed_at        timestamptz null,
  late_review_note        text null,
  client_request_id       text null,
  created_at              timestamptz not null default now(),
  constraint assessment_submissions_case_id_not_blank check (btrim(case_id) <> ''),
  constraint assessment_submissions_number_positive check (submission_number >= 1),
  constraint assessment_submissions_schema_version_positive
    check (snapshot_schema_version >= 1),
  constraint assessment_submissions_timing_check check (
    timing_status in ('on_time', 'late')
  ),
  constraint assessment_submissions_late_review_check check (
    late_review_status is null
    or late_review_status in ('pending', 'approved', 'rejected')
  ),
  constraint assessment_submissions_timing_late_review_consistency check (
    (timing_status = 'on_time' and late_review_status is null)
    or (timing_status = 'late' and late_review_status is not null)
  ),
  unique (assessment_cycle_id, student_user_id, submission_number)
);

create index if not exists idx_assessment_submissions_student_cycle
  on public.assessment_submissions (
    student_user_id, assessment_cycle_id, submitted_at desc
  );

create index if not exists idx_assessment_submissions_org_cycle
  on public.assessment_submissions (organization_id, assessment_cycle_id);

create unique index if not exists uq_assessment_submissions_client_request
  on public.assessment_submissions (
    assessment_cycle_id, student_user_id, client_request_id
  )
  where client_request_id is not null;

comment on table public.assessment_submissions is
  '課題提出履歴（append-only）。snapshot は不変。物理 DELETE しない。';
comment on column public.assessment_submissions.timing_status is
  'on_time: submitted_at < deadline_at / late: submitted_at >= deadline_at';
comment on column public.assessment_submissions.late_review_status is
  '期限内は null。期限後は pending（初期）/ approved / rejected。承認 UI は後続 Sprint。';

-- =====================================================================
-- 評価候補 VIEW（Sprint 2: 期限内最後の提出のみ）
-- 承認済み期限後の明示指定は後続 Sprint（専用構造）で対応する。
-- =====================================================================
create or replace view public.assessment_evaluation_candidates
with (security_invoker = true)
as
select distinct on (s.assessment_cycle_id, s.student_user_id)
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
  s.assessment_cycle_id,
  s.student_user_id,
  s.submitted_at desc,
  s.submission_number desc;

comment on view public.assessment_evaluation_candidates is
  '学生×cycle の評価候補。Sprint 2 は期限内最後の提出。承認済み期限後は後続 Sprint。';

-- =====================================================================
-- 提出プレビュー（期限・open cycle 解決結果）
-- =====================================================================
create or replace function public.get_assessment_submit_preview(
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
  v_open_count integer;
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

  if p_case_id is null or btrim(p_case_id) = '' then
    return jsonb_build_object('ok', false, 'error', 'validation');
  end if;

  select count(*)::integer into v_open_count
  from public.assessment_cycles c
  where c.organization_id = v_org
    and c.case_id = p_case_id
    and c.status = 'open';

  if v_open_count = 0 then
    return jsonb_build_object(
      'ok', false,
      'error', 'no_open_cycle',
      'message', '提出期間が設定されていません'
    );
  end if;

  if v_open_count > 1 then
    return jsonb_build_object(
      'ok', false,
      'error', 'ambiguous_cycle',
      'message', '提出期間の設定に不備があります'
    );
  end if;

  select * into v_cycle
  from public.assessment_cycles c
  where c.organization_id = v_org
    and c.case_id = p_case_id
    and c.status = 'open'
  limit 1;

  return jsonb_build_object(
    'ok', true,
    'assessmentCycleId', v_cycle.id,
    'title', v_cycle.title,
    'deadlineAt', v_cycle.deadline_at,
    'serverNow', v_now,
    'wouldBeLate', (v_now >= v_cycle.deadline_at)
  );
end;
$$;

revoke all on function public.get_assessment_submit_preview(text) from public;
revoke all on function public.get_assessment_submit_preview(text) from anon;
grant execute on function public.get_assessment_submit_preview(text) to authenticated;

-- =====================================================================
-- 提出 RPC（採番・期限判定・INSERT を一つのトランザクションで）
-- =====================================================================
create or replace function public.submit_assessment_submission(
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
  v_open_count integer;
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

  if p_case_id is null or btrim(p_case_id) = '' then
    return jsonb_build_object('ok', false, 'error', 'validation');
  end if;

  if p_snapshot is null or p_source_versions is null then
    return jsonb_build_object('ok', false, 'error', 'validation');
  end if;

  if p_snapshot_schema_version is null or p_snapshot_schema_version < 1 then
    return jsonb_build_object('ok', false, 'error', 'validation');
  end if;

  select count(*)::integer into v_open_count
  from public.assessment_cycles c
  where c.organization_id = v_org
    and c.case_id = p_case_id
    and c.status = 'open';

  if v_open_count = 0 then
    return jsonb_build_object(
      'ok', false,
      'error', 'no_open_cycle',
      'message', '提出期間が設定されていません'
    );
  end if;

  if v_open_count > 1 then
    return jsonb_build_object(
      'ok', false,
      'error', 'ambiguous_cycle',
      'message', '提出期間の設定に不備があります'
    );
  end if;

  select * into v_cycle
  from public.assessment_cycles c
  where c.organization_id = v_org
    and c.case_id = p_case_id
    and c.status = 'open'
  limit 1;

  -- 同一学生×cycle の採番競合を防ぐ
  perform pg_advisory_xact_lock(
    hashtext(v_cycle.id::text || ':' || v_uid::text)
  );

  v_now := now();

  -- idempotency: 同一 client_request_id があれば既存を返す
  if p_client_request_id is not null and btrim(p_client_request_id) <> '' then
    select * into v_existing
    from public.assessment_submissions s
    where s.assessment_cycle_id = v_cycle.id
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
        'deadlineAt', v_cycle.deadline_at
      );
    end if;
  end if;

  if v_now < v_cycle.deadline_at then
    v_timing := 'on_time';
    v_late_review := null;
  else
    v_timing := 'late';
    v_late_review := 'pending';
  end if;

  select coalesce(max(s.submission_number), 0) + 1
    into v_next_number
  from public.assessment_submissions s
  where s.assessment_cycle_id = v_cycle.id
    and s.student_user_id = v_uid;

  -- Auth ユーザーを正とし、snapshot 内の学生参照を上書き
  v_snapshot := p_snapshot
    || jsonb_build_object(
      'schemaVersion', p_snapshot_schema_version,
      'studentRef', v_uid::text,
      'caseId', p_case_id,
      'submittedAt', v_now,
      'assessmentCycle', jsonb_build_object(
        'id', v_cycle.id,
        'title', v_cycle.title,
        'deadlineAt', v_cycle.deadline_at
      )
    );

  insert into public.assessment_submissions (
    assessment_cycle_id,
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
    'deadlineAt', v_cycle.deadline_at
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'duplicate');
end;
$$;

revoke all on function public.submit_assessment_submission(text, jsonb, jsonb, integer, text)
  from public;
revoke all on function public.submit_assessment_submission(text, jsonb, jsonb, integer, text)
  from anon;
grant execute on function public.submit_assessment_submission(text, jsonb, jsonb, integer, text)
  to authenticated;
