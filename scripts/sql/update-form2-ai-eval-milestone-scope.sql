-- 管理用: 特定 form2 milestone の submission_scope を 2026.3 方針へ更新（再実行安全）
-- milestone: 6a7d81bd-c7b1-4a51-8ff9-d44c283e0d0d（8月26日提出課題）
-- 他 milestone / form2 デフォルトは変更しない。

begin;

select id, title, milestone_type, submission_scope as scope_before
from public.assessment_milestones
where id = '6a7d81bd-c7b1-4a51-8ff9-d44c283e0d0d';

update public.assessment_milestones
set
  submission_scope = '{
    "includeForm2": true,
    "includeForm3": false,
    "includeInformationCards": false,
    "includeEvidenceLinks": false,
    "includeFieldReflections": true,
    "includePatientUnderstanding": true
  }'::jsonb,
  updated_at = now()
where id = '6a7d81bd-c7b1-4a51-8ff9-d44c283e0d0d'
  and milestone_type = 'form2';

select id, title, milestone_type, submission_scope as scope_after
from public.assessment_milestones
where id = '6a7d81bd-c7b1-4a51-8ff9-d44c283e0d0d';

-- 他 form2 milestone が意図せず変わっていないことの確認用
select id, title, submission_scope
from public.assessment_milestones
where milestone_type = 'form2'
  and id <> '6a7d81bd-c7b1-4a51-8ff9-d44c283e0d0d'
order by title;

commit;
