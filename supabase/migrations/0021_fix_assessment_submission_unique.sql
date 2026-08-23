-- =====================================================================
-- Compass Version 2.2 Sprint 3A hotfix
-- 0021_fix_assessment_submission_unique.sql
--
-- 原因:
--   0017 の UNIQUE (assessment_cycle_id, student_user_id, submission_number)
--   の制約制約名は PostgreSQL 識別子上限（63文字）で切り詰められる。
--   0019 の DROP はフルネームを指定していたため一致せず、旧制約が残存した。
--   その結果、同一 cycle 内の別 milestone へ submission_number=1 で提出すると
--   unique_violation → RPC が 'duplicate' を返していた。
--
-- 対応:
--   ・cycle 単位の UNIQUE を定義内容で検出して DROP
--   ・milestone 単位 UNIQUE を確実に再作成
--   ・client_request_id の一意索引を milestone 単位で再作成
-- =====================================================================

do $$
declare
  r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'assessment_submissions'
      and c.contype = 'u'
      and pg_get_constraintdef(c.oid) ~* 'assessment_cycle_id'
      and pg_get_constraintdef(c.oid) ~* 'student_user_id'
      and pg_get_constraintdef(c.oid) ~* 'submission_number'
      and pg_get_constraintdef(c.oid) !~* 'assessment_milestone_id'
  loop
    execute format(
      'alter table public.assessment_submissions drop constraint %I',
      r.conname
    );
    raise notice 'dropped leftover cycle unique: %', r.conname;
  end loop;
end $$;

-- milestone 単位 UNIQUE を確実に持つ
alter table public.assessment_submissions
  drop constraint if exists assessment_submissions_milestone_student_number_key;

alter table public.assessment_submissions
  add constraint assessment_submissions_milestone_student_number_key
  unique (assessment_milestone_id, student_user_id, submission_number);

-- idempotency index も milestone 単位へ（同名で作り直す）
drop index if exists public.uq_assessment_submissions_client_request;

create unique index uq_assessment_submissions_client_request
  on public.assessment_submissions (
    assessment_milestone_id, student_user_id, client_request_id
  )
  where client_request_id is not null;

comment on constraint assessment_submissions_milestone_student_number_key
  on public.assessment_submissions is
  '提出番号は milestone × 学生単位。cycle 単位 UNIQUE は使わない。';
