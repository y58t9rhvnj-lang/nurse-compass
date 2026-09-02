-- =====================================================================
-- Compass Version 2.2
-- 0028_form2_ai_eval_milestone_scope_and_candidates_grant.sql
--
-- 1) 特定 form2 milestone の submission_scope を AI評価方針 2026.3 に恒久更新
--    （他の form2 課題のデフォルトは変更しない）
-- 2) assessment_evaluation_candidates へ service_role の SELECT を付与
--    （security_invoker 維持。アプリ側で organization_id 絞り込みを継続）
--
-- 再実行しても安全（idempotent）。
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. 対象 milestone のみ submission_scope 更新
-- ---------------------------------------------------------------------
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
  and milestone_type = 'form2'
  and (
    submission_scope is distinct from '{
      "includeForm2": true,
      "includeForm3": false,
      "includeInformationCards": false,
      "includeEvidenceLinks": false,
      "includeFieldReflections": true,
      "includePatientUnderstanding": true
    }'::jsonb
  );

-- ---------------------------------------------------------------------
-- 2. candidates VIEW: service_role に SELECT のみ付与
--    authenticated 既存 grant は維持。security_invoker は変更しない。
-- ---------------------------------------------------------------------
grant select on public.assessment_evaluation_candidates to service_role;

comment on view public.assessment_evaluation_candidates is
  '学生×milestone の評価候補。優先: 承認済み期限後最新 → 期限内最新。pending/rejected 除外。service_role は SELECT 可（アプリで organization_id 絞り込み必須）。';
