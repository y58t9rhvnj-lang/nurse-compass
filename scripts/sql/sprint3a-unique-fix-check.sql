-- Sprint 3A hotfix — 0021 適用後確認
-- 旧 cycle 単位 UNIQUE が消えていること・milestone 単位 UNIQUE があること

select
  c.conname,
  pg_get_constraintdef(c.oid) as def
from pg_constraint c
join pg_class t on t.oid = c.conrelid
join pg_namespace n on n.oid = t.relnamespace
where n.nspname = 'public'
  and t.relname = 'assessment_submissions'
  and c.contype = 'u'
order by c.conname;

select
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'assessment_submissions'
  and indexname = 'uq_assessment_submissions_client_request';
