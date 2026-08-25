-- =====================================================================
-- Compass Version 2.2 Sprint 5B
-- 0026_assessment_ai_evaluation_staging.sql
-- AI評価結果 staging / request / adoption / warning ack / audit のDB基盤
-- =====================================================================
-- 方針:
--   ・仕様: docs/version2/ai/03〜05_ai_evaluation_*.md
--   ・今回はテーブル・制約・index・RLS・GRANT のみ。RPC / アプリは後続。
--   ・既存 assessment_reviews / 返却フローは変更しない。
--   ・物理削除前提なし（DELETE ポリシーなし）。
--   ・学生向け SELECT ポリシーは作らない。
--   ・authenticated の直接 INSERT/UPDATE/DELETE は付与しない。
--     書込は service_role または後続 SECURITY DEFINER RPC / Server Action。
--
-- DBだけでは完全保証せず、後続 RPC/Action で必須検証する事項:
--   ・request 期限切れ（expires_at / expired）後の新規 staging 取込拒否
--   ・状態遷移の正当性（例: partially_adopted → rejected 禁止）
--   ・completed / 返却中 review への adopt 禁止
--   ・optimistic locking（review.updated_at）
--   ・警告 ack 充足後のみ adopt
--   ・admin の adopt 禁止（アプリ層）
-- ---------------------------------------------------------------------

create extension if not exists pgcrypto;

-- =====================================================================
-- 1. assessment_ai_evaluation_requests
-- =====================================================================

create table if not exists public.assessment_ai_evaluation_requests (
  id                         uuid primary key default gen_random_uuid(),
  organization_id            uuid not null
    references public.organizations(id),
  assessment_submission_id   uuid not null
    references public.assessment_submissions(id),
  assessment_cycle_id        uuid not null
    references public.assessment_cycles(id),
  assessment_milestone_id    uuid not null
    references public.assessment_milestones(id),
  student_user_id            uuid not null
    references auth.users(id),
  evaluation_request_id      uuid not null,
  package_schema_version     integer not null,
  result_schema_version      integer not null,
  compass_policy_version     text not null,
  rubric_version             text not null,
  gold_standard_version      text not null,
  case_version               text not null,
  export_schema_version      integer not null,
  package_hash               text not null,
  anonymous_submission_id    text not null,
  generated_at               timestamptz not null default now(),
  generated_by               uuid not null
    references auth.users(id),
  expires_at                 timestamptz not null,
  status                     text not null default 'generated',
  used_at                    timestamptz null,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),

  constraint assessment_ai_eval_requests_eval_req_unique
    unique (evaluation_request_id),

  -- staging からの複合 FK 用（org / submission / evaluation_request_id 整合）
  constraint assessment_ai_eval_requests_composite_unique
    unique (id, organization_id, assessment_submission_id, evaluation_request_id),

  constraint assessment_ai_eval_requests_status_check
    check (status in ('generated', 'used', 'expired')),

  constraint assessment_ai_eval_requests_schema_versions_positive
    check (
      package_schema_version >= 1
      and result_schema_version >= 1
      and export_schema_version >= 1
    ),

  constraint assessment_ai_eval_requests_text_not_blank
    check (
      btrim(compass_policy_version) <> ''
      and btrim(rubric_version) <> ''
      and btrim(gold_standard_version) <> ''
      and btrim(case_version) <> ''
      and btrim(package_hash) <> ''
      and btrim(anonymous_submission_id) <> ''
    ),

  constraint assessment_ai_eval_requests_expires_after_generated
    check (expires_at >= generated_at),

  constraint assessment_ai_eval_requests_used_consistency
    check (
      (status = 'generated' and used_at is null)
      or (status = 'used' and used_at is not null)
      or (status = 'expired')
    )
);

comment on table public.assessment_ai_evaluation_requests is
  'Sprint 5B: AI評価 package 生成正本。evaluation_request_id と実 submission を結びつける。物理削除しない。';
comment on column public.assessment_ai_evaluation_requests.expires_at is
  'generated_at + 90 days をアプリが設定。期限後の新規取込拒否は RPC/Action で必須検証（DBだけでは完全保証しない）。';
comment on column public.assessment_ai_evaluation_requests.status is
  'generated | used | expired。used 期限切れ後も確認継続可（追加取込不可は expires_at 判定）。';

create index if not exists assessment_ai_eval_requests_org_submission_idx
  on public.assessment_ai_evaluation_requests (
    organization_id, assessment_submission_id, generated_at desc
  );
create index if not exists assessment_ai_eval_requests_submission_idx
  on public.assessment_ai_evaluation_requests (assessment_submission_id);
create index if not exists assessment_ai_eval_requests_org_idx
  on public.assessment_ai_evaluation_requests (organization_id);
create index if not exists assessment_ai_eval_requests_expires_idx
  on public.assessment_ai_evaluation_requests (expires_at);
create index if not exists assessment_ai_eval_requests_status_idx
  on public.assessment_ai_evaluation_requests (status);

drop trigger if exists trg_assessment_ai_eval_requests_updated_at
  on public.assessment_ai_evaluation_requests;
create trigger trg_assessment_ai_eval_requests_updated_at
  before update on public.assessment_ai_evaluation_requests
  for each row execute function public.set_updated_at();

-- =====================================================================
-- 2. assessment_ai_evaluation_staging
-- =====================================================================

create table if not exists public.assessment_ai_evaluation_staging (
  id                         uuid primary key default gen_random_uuid(),
  organization_id            uuid not null
    references public.organizations(id),
  request_id                 uuid not null,
  evaluation_request_id      uuid not null,
  assessment_submission_id   uuid not null
    references public.assessment_submissions(id),
  assessment_cycle_id        uuid not null
    references public.assessment_cycles(id),
  assessment_milestone_id    uuid not null
    references public.assessment_milestones(id),
  student_user_id            uuid not null
    references auth.users(id),

  package_schema_version     integer not null,
  result_schema_version      integer not null,
  compass_policy_version     text not null,
  rubric_version             text not null,
  gold_standard_version      text not null,
  case_version               text not null,
  export_schema_version      integer not null,

  raw_result_json            jsonb not null,
  normalized_result_json     jsonb null,
  result_hash                text not null,

  validation_status          text not null,
  validation_errors          jsonb not null default '[]'::jsonb,
  version_warnings           jsonb not null default '[]'::jsonb,
  pii_warnings               jsonb not null default '[]'::jsonb,

  review_status              text not null,

  source_model               text null,
  source_provider            text null,
  prompt_version             text null,

  imported_at                timestamptz not null default now(),
  imported_by                uuid not null
    references auth.users(id),

  rejected_at                timestamptz null,
  rejected_by                uuid null
    references auth.users(id),
  rejection_reason           text null,

  completed_at               timestamptz null,
  completed_by               uuid null
    references auth.users(id),

  superseded_by              uuid null
    references public.assessment_ai_evaluation_staging(id),

  teacher_draft_overlay_json jsonb null,

  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),

  constraint assessment_ai_eval_staging_eval_req_unique
    unique (evaluation_request_id),

  constraint assessment_ai_eval_staging_org_result_hash_unique
    unique (organization_id, result_hash),

  constraint assessment_ai_eval_staging_request_fk
    foreign key (
      request_id,
      organization_id,
      assessment_submission_id,
      evaluation_request_id
    )
    references public.assessment_ai_evaluation_requests (
      id,
      organization_id,
      assessment_submission_id,
      evaluation_request_id
    ),

  constraint assessment_ai_eval_staging_validation_status_check
    check (validation_status in ('ok', 'warning', 'invalid')),

  constraint assessment_ai_eval_staging_review_status_check
    check (
      review_status in (
        'invalid',
        'needs_review',
        'partially_adopted',
        'adopted',
        'rejected',
        'superseded'
      )
    ),

  constraint assessment_ai_eval_staging_schema_versions_positive
    check (
      package_schema_version >= 1
      and result_schema_version >= 1
      and export_schema_version >= 1
    ),

  constraint assessment_ai_eval_staging_result_hash_not_blank
    check (btrim(result_hash) <> ''),

  constraint assessment_ai_eval_staging_reject_consistency
    check (
      (
        rejected_at is null
        and rejected_by is null
        and (rejection_reason is null or btrim(rejection_reason) = '')
      )
      or (
        rejected_at is not null
        and rejected_by is not null
        and rejection_reason is not null
        and btrim(rejection_reason) <> ''
        and review_status = 'rejected'
      )
    ),

  constraint assessment_ai_eval_staging_completed_consistency
    check (
      (completed_at is null and completed_by is null)
      or (
        completed_at is not null
        and completed_by is not null
        and review_status = 'adopted'
      )
    ),

  constraint assessment_ai_eval_staging_superseded_consistency
    check (
      (superseded_by is null and review_status is distinct from 'superseded')
      or (
        superseded_by is not null
        and review_status = 'superseded'
        and superseded_by is distinct from id
      )
    ),

  constraint assessment_ai_eval_staging_json_arrays
    check (
      jsonb_typeof(validation_errors) = 'array'
      and jsonb_typeof(version_warnings) = 'array'
      and jsonb_typeof(pii_warnings) = 'array'
    )
);

comment on table public.assessment_ai_evaluation_staging is
  'Sprint 5B: AI評価結果候補。raw は学生非公開。assessment_reviews へ直接書かない。';
comment on column public.assessment_ai_evaluation_staging.raw_result_json is
  '受領原文。学生へ絶対公開しない。本文全文を audit に重複保存しない。';
comment on column public.assessment_ai_evaluation_staging.result_hash is
  'normalized canonical JSON の SHA-256。同一 organization_id + result_hash の重複取込拒否。';
comment on column public.assessment_ai_evaluation_staging.review_status is
  'CHECK で取りうる値のみ制約。遷移（例 partially_adopted→rejected 禁止）は後続 RPC で保証。';

create unique index if not exists assessment_ai_eval_staging_one_active_per_submission
  on public.assessment_ai_evaluation_staging (assessment_submission_id)
  where review_status in ('needs_review', 'partially_adopted');

create index if not exists assessment_ai_eval_staging_org_submission_imported_idx
  on public.assessment_ai_evaluation_staging (
    organization_id, assessment_submission_id, imported_at desc
  );
create index if not exists assessment_ai_eval_staging_submission_idx
  on public.assessment_ai_evaluation_staging (assessment_submission_id);
create index if not exists assessment_ai_eval_staging_org_idx
  on public.assessment_ai_evaluation_staging (organization_id);
create index if not exists assessment_ai_eval_staging_review_status_idx
  on public.assessment_ai_evaluation_staging (organization_id, review_status);
create index if not exists assessment_ai_eval_staging_result_hash_idx
  on public.assessment_ai_evaluation_staging (result_hash);
create index if not exists assessment_ai_eval_staging_imported_at_idx
  on public.assessment_ai_evaluation_staging (imported_at desc);
create index if not exists assessment_ai_eval_staging_request_id_idx
  on public.assessment_ai_evaluation_staging (request_id);

drop trigger if exists trg_assessment_ai_eval_staging_updated_at
  on public.assessment_ai_evaluation_staging;
create trigger trg_assessment_ai_eval_staging_updated_at
  before update on public.assessment_ai_evaluation_staging
  for each row execute function public.set_updated_at();

-- =====================================================================
-- 3. assessment_ai_evaluation_warning_acknowledgements
-- =====================================================================

create table if not exists public.assessment_ai_evaluation_warning_acknowledgements (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null
    references public.organizations(id),
  staging_id             uuid not null
    references public.assessment_ai_evaluation_staging(id),
  warning_family         text not null,
  warning_code           text not null,
  warning_payload_hash   text not null,
  acknowledged_by        uuid not null
    references auth.users(id),
  acknowledged_at        timestamptz not null default now(),
  created_at             timestamptz not null default now(),

  constraint assessment_ai_eval_warning_acks_family_check
    check (warning_family in ('version', 'pii')),

  constraint assessment_ai_eval_warning_acks_code_not_blank
    check (btrim(warning_code) <> ''),

  constraint assessment_ai_eval_warning_acks_payload_hash_not_blank
    check (btrim(warning_payload_hash) <> ''),

  constraint assessment_ai_eval_warning_acks_unique
    unique (staging_id, warning_code, warning_payload_hash)
);

comment on table public.assessment_ai_evaluation_warning_acknowledgements is
  'Sprint 5B: 警告単位の確認記録。一括 boolean は使わない。作成は後続 RPC（teacher）。';

create index if not exists assessment_ai_eval_warning_acks_staging_idx
  on public.assessment_ai_evaluation_warning_acknowledgements (staging_id);
create index if not exists assessment_ai_eval_warning_acks_org_idx
  on public.assessment_ai_evaluation_warning_acknowledgements (organization_id);
create index if not exists assessment_ai_eval_warning_acks_lookup_idx
  on public.assessment_ai_evaluation_warning_acknowledgements (
    staging_id, warning_family, warning_code, warning_payload_hash
  );

-- =====================================================================
-- 4. assessment_ai_evaluation_adoptions（追記型）
-- =====================================================================

create table if not exists public.assessment_ai_evaluation_adoptions (
  id                           uuid primary key default gen_random_uuid(),
  organization_id              uuid not null
    references public.organizations(id),
  staging_id                   uuid not null
    references public.assessment_ai_evaluation_staging(id),
  assessment_review_id         uuid not null
    references public.assessment_reviews(id),
  adoption_sequence            integer not null,
  adoption_selection_json      jsonb not null,
  review_before_snapshot_json  jsonb not null,
  applied_snapshot_json        jsonb not null,
  review_updated_at_before     timestamptz not null,
  review_updated_at_after      timestamptz not null,
  adopted_at                   timestamptz not null default now(),
  adopted_by                   uuid not null
    references auth.users(id),
  created_at                   timestamptz not null default now(),

  constraint assessment_ai_eval_adoptions_sequence_positive
    check (adoption_sequence >= 1),

  constraint assessment_ai_eval_adoptions_sequence_unique
    unique (staging_id, adoption_sequence),

  constraint assessment_ai_eval_adoptions_selection_object
    check (jsonb_typeof(adoption_selection_json) = 'object'),

  constraint assessment_ai_eval_adoptions_snapshots_object
    check (
      jsonb_typeof(review_before_snapshot_json) = 'object'
      and jsonb_typeof(applied_snapshot_json) = 'object'
    ),

  constraint assessment_ai_eval_adoptions_updated_at_order
    check (review_updated_at_after >= review_updated_at_before)
);

comment on table public.assessment_ai_evaluation_adoptions is
  'Sprint 5B: AI候補→review下書き反映の追記履歴。UPDATE/DELETE しない。作成は後続 RPC（teacher）。adopt 時の completed/returned 制約は RPC で保証。';

create index if not exists assessment_ai_eval_adoptions_staging_seq_idx
  on public.assessment_ai_evaluation_adoptions (staging_id, adoption_sequence);
create index if not exists assessment_ai_eval_adoptions_review_idx
  on public.assessment_ai_evaluation_adoptions (
    organization_id, assessment_review_id, adopted_at desc
  );
create index if not exists assessment_ai_eval_adoptions_org_idx
  on public.assessment_ai_evaluation_adoptions (organization_id);

-- =====================================================================
-- 5. assessment_ai_evaluation_audit_logs
-- =====================================================================

create table if not exists public.assessment_ai_evaluation_audit_logs (
  id                         uuid primary key default gen_random_uuid(),
  organization_id            uuid not null
    references public.organizations(id),
  actor_user_id              uuid not null,
  actor_login_id             text,
  actor_role                 text not null,
  action                     text not null,
  assessment_submission_id   uuid null,
  staging_id                 uuid null,
  request_id                 uuid null,
  evaluation_request_id      uuid null,
  result_hash                text null,
  package_schema_version     integer null,
  result_schema_version      integer null,
  compass_policy_version     text null,
  rubric_version             text null,
  gold_standard_version      text null,
  case_version               text null,
  export_schema_version      integer null,
  selection_summary          jsonb not null default '{}'::jsonb,
  summary                    text not null,
  metadata                   jsonb not null default '{}'::jsonb,
  created_at                 timestamptz not null default now(),

  constraint assessment_ai_eval_audit_action_not_blank
    check (btrim(action) <> ''),

  constraint assessment_ai_eval_audit_summary_not_blank
    check (btrim(summary) <> ''),

  constraint assessment_ai_eval_audit_actor_role_check
    check (actor_role in ('teacher', 'admin', 'system')),

  constraint assessment_ai_eval_audit_selection_object
    check (jsonb_typeof(selection_summary) = 'object'),

  constraint assessment_ai_eval_audit_metadata_object
    check (jsonb_typeof(metadata) = 'object')
);

comment on table public.assessment_ai_evaluation_audit_logs is
  'Sprint 5B: AI評価 import/validation/ack/adopt/reject/supersede 監査。本文全文・提出本文・氏名は保存しない。authenticated 直接 INSERT 不可。';

create index if not exists assessment_ai_eval_audit_org_created_idx
  on public.assessment_ai_evaluation_audit_logs (organization_id, created_at desc);
create index if not exists assessment_ai_eval_audit_actor_idx
  on public.assessment_ai_evaluation_audit_logs (actor_user_id);
create index if not exists assessment_ai_eval_audit_action_idx
  on public.assessment_ai_evaluation_audit_logs (action);
create index if not exists assessment_ai_eval_audit_staging_idx
  on public.assessment_ai_evaluation_audit_logs (staging_id);
create index if not exists assessment_ai_eval_audit_submission_idx
  on public.assessment_ai_evaluation_audit_logs (assessment_submission_id);
create index if not exists assessment_ai_eval_audit_request_idx
  on public.assessment_ai_evaluation_audit_logs (request_id);

-- =====================================================================
-- RLS
-- =====================================================================

alter table public.assessment_ai_evaluation_requests enable row level security;
alter table public.assessment_ai_evaluation_staging enable row level security;
alter table public.assessment_ai_evaluation_warning_acknowledgements
  enable row level security;
alter table public.assessment_ai_evaluation_adoptions enable row level security;
alter table public.assessment_ai_evaluation_audit_logs enable row level security;

drop policy if exists assessment_ai_eval_requests_select_staff
  on public.assessment_ai_evaluation_requests;
create policy assessment_ai_eval_requests_select_staff
  on public.assessment_ai_evaluation_requests
  for select
  to authenticated
  using (
    public.is_staff()
    and organization_id = public.current_organization_id()
  );

drop policy if exists assessment_ai_eval_staging_select_staff
  on public.assessment_ai_evaluation_staging;
create policy assessment_ai_eval_staging_select_staff
  on public.assessment_ai_evaluation_staging
  for select
  to authenticated
  using (
    public.is_staff()
    and organization_id = public.current_organization_id()
  );

drop policy if exists assessment_ai_eval_warning_acks_select_staff
  on public.assessment_ai_evaluation_warning_acknowledgements;
create policy assessment_ai_eval_warning_acks_select_staff
  on public.assessment_ai_evaluation_warning_acknowledgements
  for select
  to authenticated
  using (
    public.is_staff()
    and organization_id = public.current_organization_id()
  );

drop policy if exists assessment_ai_eval_adoptions_select_staff
  on public.assessment_ai_evaluation_adoptions;
create policy assessment_ai_eval_adoptions_select_staff
  on public.assessment_ai_evaluation_adoptions
  for select
  to authenticated
  using (
    public.is_staff()
    and organization_id = public.current_organization_id()
  );

-- audit: authenticated 向けポリシーなし（全拒否）。service_role が RLS バイパスで INSERT。

-- =====================================================================
-- GRANT / REVOKE
-- =====================================================================

revoke all on public.assessment_ai_evaluation_requests from public;
revoke all on public.assessment_ai_evaluation_requests from anon;
revoke all on public.assessment_ai_evaluation_requests from authenticated;
grant select on public.assessment_ai_evaluation_requests to authenticated;
grant all on public.assessment_ai_evaluation_requests to service_role;

revoke all on public.assessment_ai_evaluation_staging from public;
revoke all on public.assessment_ai_evaluation_staging from anon;
revoke all on public.assessment_ai_evaluation_staging from authenticated;
grant select on public.assessment_ai_evaluation_staging to authenticated;
grant all on public.assessment_ai_evaluation_staging to service_role;

revoke all on public.assessment_ai_evaluation_warning_acknowledgements from public;
revoke all on public.assessment_ai_evaluation_warning_acknowledgements from anon;
revoke all on public.assessment_ai_evaluation_warning_acknowledgements from authenticated;
grant select on public.assessment_ai_evaluation_warning_acknowledgements to authenticated;
grant all on public.assessment_ai_evaluation_warning_acknowledgements to service_role;

revoke all on public.assessment_ai_evaluation_adoptions from public;
revoke all on public.assessment_ai_evaluation_adoptions from anon;
revoke all on public.assessment_ai_evaluation_adoptions from authenticated;
grant select on public.assessment_ai_evaluation_adoptions to authenticated;
grant all on public.assessment_ai_evaluation_adoptions to service_role;

revoke all on public.assessment_ai_evaluation_audit_logs from public;
revoke all on public.assessment_ai_evaluation_audit_logs from anon;
revoke all on public.assessment_ai_evaluation_audit_logs from authenticated;
grant all on public.assessment_ai_evaluation_audit_logs to service_role;
