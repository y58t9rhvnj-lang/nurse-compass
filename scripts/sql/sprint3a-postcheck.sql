-- Sprint 3A — migration 適用後検証 SQL

-- 1. milestone が各 cycle に 1 件以上
select c.id as cycle_id, c.title, count(m.id) as milestone_count
from public.assessment_cycles c
left join public.assessment_milestones m on m.assessment_cycle_id = c.id
group by c.id, c.title
order by c.created_at;

-- 2. submissions に null milestone がない
select count(*) as orphan_submissions
from public.assessment_submissions
where assessment_milestone_id is null;

-- 3. 既存提出の不変確認（件数・番号）
select
  id,
  assessment_milestone_id,
  submission_number,
  submitted_at,
  timing_status,
  late_review_status
from public.assessment_submissions
order by submission_number;

-- 4. 評価候補（期待: 53fa297b-3894-4156-b3af-7c1350623c13 が残る環境）
select *
from public.assessment_evaluation_candidates;

select *
from public.assessment_evaluation_candidates
where submission_id = '53fa297b-3894-4156-b3af-7c1350623c13';

-- 5. 新 RPC の存在
select p.proname, pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'list_open_assessment_milestones',
    'get_assessment_submit_preview',
    'submit_assessment_submission'
  )
order by p.proname, args;
