-- =====================================================================
-- Compass Version 2.2 Sprint 5A
-- 0025_assessment_ai_export_audit.sql
-- AI連携用匿名化エクスポートの監査ログ
-- =====================================================================
-- 方針:
--   ・admin_audit_logs とは分離（教員の評価データ出力用）。
--   ・authenticated からの直接アクセスは拒否。service_role のみ INSERT。
--   ・監査行には実 ID（milestone 等）を内部追跡用に残してよいが、
--     パスワード・トークン・提出本文・氏名は保存しない。
-- ---------------------------------------------------------------------

create extension if not exists pgcrypto;

create table if not exists public.assessment_ai_export_audit_logs (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id),
  actor_user_id    uuid not null,
  actor_login_id   text,
  actor_role       text not null,
  action           text not null default 'assessment.ai_export',
  milestone_id     uuid,
  format           text not null check (format in ('json', 'jsonl')),
  record_count     integer not null check (record_count >= 0),
  included_artifacts text[] not null default '{}'::text[],
  summary          text not null,
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);

create index if not exists assessment_ai_export_audit_org_created_idx
  on public.assessment_ai_export_audit_logs (organization_id, created_at desc);
create index if not exists assessment_ai_export_audit_actor_idx
  on public.assessment_ai_export_audit_logs (actor_user_id);
create index if not exists assessment_ai_export_audit_milestone_idx
  on public.assessment_ai_export_audit_logs (milestone_id);

alter table public.assessment_ai_export_audit_logs enable row level security;

revoke all on public.assessment_ai_export_audit_logs from public;
revoke all on public.assessment_ai_export_audit_logs from anon;
revoke all on public.assessment_ai_export_audit_logs from authenticated;

grant all on public.assessment_ai_export_audit_logs to service_role;

comment on table public.assessment_ai_export_audit_logs is
  'Sprint 5A: 教員による AI 匿名化エクスポート操作の監査ログ。提出本文・学生氏名は保存しない。';
