-- =====================================================================
-- Compass Version 2.2
-- 0029_profiles_exclude_from_assessment.sql
--
-- 本番 AI 評価候補から検証用アカウントを除外するための明示フラグ。
-- ・既存 VIEW assessment_evaluation_candidates は変更しない
--   （教員画面の提出一覧など、検証アカウントを含む利用を維持）
-- ・本番 AI 評価専用 VIEW assessment_ai_evaluation_candidates を追加
-- ・login_id 文字列だけに依存せず、exclude_from_assessment を正とする
-- =====================================================================

alter table public.profiles
  add column if not exists exclude_from_assessment boolean not null default false;

comment on column public.profiles.exclude_from_assessment is
  'true のとき本番 AI 評価候補・Export Package・Import staging 対象から除外。ログイン・受入テストは可能のまま。';

create index if not exists profiles_exclude_from_assessment_idx
  on public.profiles (organization_id, exclude_from_assessment)
  where exclude_from_assessment = true;

-- 属性ベース（安全）: 検証クラス・既知シード・架空学籍番号帯・明示表示名
update public.profiles
set exclude_from_assessment = true
where role = 'student'
  and exclude_from_assessment = false
  and (
    class_name = '検証クラス'
    or login_id in ('student01', 'student02')
    or login_id ~ '^9999999[0-9]+$'
    or display_name ~ '(検証|架空|テストアカウント|動作確認)'
  );

-- 講義環境で特定された検証用学生（活動なし／非コホート検証）
-- ※ 本番 AI 除外の明示マーク。受入テスト用ログインは維持。
update public.profiles
set exclude_from_assessment = true
where role = 'student'
  and exclude_from_assessment = false
  and login_id in ('19810719', '12515054');

-- 本番 AI 評価専用候補（提出済み・実学生・検証除外・学生ごと一意は基底 VIEW が保証）
create or replace view public.assessment_ai_evaluation_candidates
with (security_invoker = true)
as
select
  c.assessment_milestone_id,
  c.assessment_cycle_id,
  c.student_user_id,
  c.organization_id,
  c.case_id,
  c.submission_id,
  c.submission_number,
  c.submitted_at,
  c.timing_status,
  c.late_review_status
from public.assessment_evaluation_candidates c
inner join public.profiles p
  on p.id = c.student_user_id
where p.role = 'student'
  and p.is_active = true
  and p.exclude_from_assessment = false;

comment on view public.assessment_ai_evaluation_candidates is
  '本番 AI 評価用候補。assessment_evaluation_candidates から検証用アカウント（exclude_from_assessment）を除外。';

grant select on public.assessment_ai_evaluation_candidates to authenticated;
grant select on public.assessment_ai_evaluation_candidates to service_role;
