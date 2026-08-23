-- =====================================================================
-- Sprint 3A — migration 適用前の確認 SQL（人間が SQL Editor で実行）
-- 適用前に結果を控えること。特に評価候補 submission_id。
-- =====================================================================

-- A. 既存提出件数
select count(*) as submission_count from public.assessment_submissions;

-- B. 提出一覧（ID / 番号 / 時刻 / timing）
select
  id,
  assessment_cycle_id,
  student_user_id,
  submission_number,
  submitted_at,
  timing_status,
  late_review_status
from public.assessment_submissions
order by assessment_cycle_id, student_user_id, submission_number;

-- C. 評価候補（適用前バックアップ）
select *
from public.assessment_evaluation_candidates
order by assessment_cycle_id, student_user_id;

-- D. 期待する評価候補 ID（ローカル検証用・環境により異なる場合あり）
-- 53fa297b-3894-4156-b3af-7c1350623c13
select *
from public.assessment_evaluation_candidates
where submission_id = '53fa297b-3894-4156-b3af-7c1350623c13';

-- E. open cycle 一覧
select id, title, case_id, status, deadline_at
from public.assessment_cycles
order by created_at;
