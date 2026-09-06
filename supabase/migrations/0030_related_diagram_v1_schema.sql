-- =====================================================================
-- Compass Version 2.2 — Related Diagram V1 Slice 0
-- 0030_related_diagram_v1_schema.sql
-- Related Diagram draft head / Knowledge Library / immutable submissions
-- =====================================================================
-- 正本:
--   docs/version2/24_related_diagram_v1_integrated_spec_frozen.md
--   docs/version2/25_related_diagram_v1_implementation_design.md
--
-- 方針（既存 Compass との整合を優先。25 §12 の正規化案を機械的には採用しない）:
--   ・学生 draft は form2_records / form3_records と同じ所有軸
--     user_id × organization_id × academic_year × case_id で 1 head。
--   ・semantic graph（Card / provenance / Connection / Nursing Problem /
--     support / multi-stage integration / priority）は head の
--     semantic_graph(jsonb) に保持する。
--     DB列 version = 楽観ロック。semantic_graph.semanticSchemaVersion は構造版。
--   ・Form3 JSON へ埋め込まない（第一級 artifact）。
--   ・Knowledge Library は教員管理の別テーブル（学生は published + binding のみ読取）。
--   ・提出は assessment_submissions と同様、append-only の jsonb snapshot テーブル。
--     INSERT は将来 SECURITY DEFINER RPC 経由を想定（本 migration では SELECT のみ GRANT）。
--   ・本ファイルは作成のみ。Supabase / Production への適用は行わない。
--   ・AI evaluation / Coach / Teacher Review テーブルは Slice 0 対象外。
-- ---------------------------------------------------------------------

-- =====================================================================
-- related_diagram_records（draft head）
-- =====================================================================
create table if not exists public.related_diagram_records (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users(id) on delete cascade,
  organization_id         uuid not null references public.organizations(id),
  academic_year           integer not null,
  case_id                 text not null,
  -- 提出期間との任意リンク（Form2/Form3 head と同様、cycle 無しでも draft 可）
  assessment_cycle_id     uuid null references public.assessment_cycles(id),
  status                  text not null default 'draft',
  canvas_schema_version   text not null default '1',
  -- Knowledge binding の解決結果を draft に固定（提出再現性・Form3 更新検知の土台）
  knowledge_group_id      uuid null,
  knowledge_version       text null,
  semantic_graph          jsonb not null,
  version                 integer not null default 1,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint related_diagram_records_case_id_not_blank
    check (btrim(case_id) <> ''),
  constraint related_diagram_records_version_positive
    check (version >= 1),
  constraint related_diagram_records_canvas_schema_not_blank
    check (btrim(canvas_schema_version) <> ''),
  constraint related_diagram_records_status_check
    check (status in ('draft', 'submitted', 'reopened')),
  unique (user_id, organization_id, academic_year, case_id)
);

create index if not exists idx_related_diagram_records_owner
  on public.related_diagram_records (
    user_id, organization_id, academic_year, case_id
  );

create index if not exists idx_related_diagram_records_org_case
  on public.related_diagram_records (organization_id, case_id);

create index if not exists idx_related_diagram_records_cycle
  on public.related_diagram_records (assessment_cycle_id)
  where assessment_cycle_id is not null;

drop trigger if exists trg_related_diagram_records_updated_at
  on public.related_diagram_records;
create trigger trg_related_diagram_records_updated_at
  before update on public.related_diagram_records
  for each row execute function public.set_updated_at();

drop trigger if exists trg_related_diagram_records_immutable
  on public.related_diagram_records;
create trigger trg_related_diagram_records_immutable
  before update on public.related_diagram_records
  for each row execute function public.reject_immutable_columns(
    'user_id', 'organization_id', 'academic_year', 'case_id', 'created_at'
  );

comment on table public.related_diagram_records is
  'Related Diagram V1 draft head。学生×組織×年度×ケースで1件。semantic_graph に Card/Connection/NP/provenance を保持。Form3 payload には埋め込まない。';
comment on column public.related_diagram_records.semantic_graph is
  'RelatedDiagramSemanticGraph（semanticSchemaVersion / cards / cardSources / connections / nursingProblems / supports / integrations）。DB列 version とは別物。';
comment on column public.related_diagram_records.version is
  'レコードバージョン（楽観ロック）。semantic_graph.semanticSchemaVersion と混同しない。';
comment on column public.related_diagram_records.knowledge_version is
  '割当 Knowledge Group の version 固定。提出 snapshot 再現性の正本候補。';
comment on column public.related_diagram_records.assessment_cycle_id is
  '任意。assessment_cycles への参照。所有軸は case 単位であり cycle 必須ではない。';

-- =====================================================================
-- Knowledge Library（教員管理）
-- =====================================================================
create table if not exists public.related_diagram_knowledge_groups (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  title           text not null,
  topic_key       text not null,
  version         text not null,
  status          text not null default 'draft',
  created_by      uuid not null references auth.users(id),
  reviewed_by     uuid null references auth.users(id),
  published_at    timestamptz null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint related_diagram_knowledge_groups_title_not_blank
    check (btrim(title) <> ''),
  constraint related_diagram_knowledge_groups_topic_not_blank
    check (btrim(topic_key) <> ''),
  constraint related_diagram_knowledge_groups_version_not_blank
    check (btrim(version) <> ''),
  constraint related_diagram_knowledge_groups_status_check
    check (status in ('draft', 'reviewed', 'published', 'retired')),
  unique (organization_id, topic_key, version)
);

create index if not exists idx_rd_knowledge_groups_org_status
  on public.related_diagram_knowledge_groups (organization_id, status);

drop trigger if exists trg_rd_knowledge_groups_updated_at
  on public.related_diagram_knowledge_groups;
create trigger trg_rd_knowledge_groups_updated_at
  before update on public.related_diagram_knowledge_groups
  for each row execute function public.set_updated_at();

comment on table public.related_diagram_knowledge_groups is
  'Related Diagram 病態 Knowledge Group。version 付き。学生 Integration 得点の直接対象外。';

create table if not exists public.related_diagram_knowledge_cards (
  id                  uuid primary key default gen_random_uuid(),
  knowledge_group_id  uuid not null
    references public.related_diagram_knowledge_groups(id) on delete cascade,
  text                text not null,
  x                   numeric not null default 0,
  y                   numeric not null default 0,
  width               numeric not null default 160,
  height              numeric not null default 72,
  z_index             integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint related_diagram_knowledge_cards_text_not_blank
    check (btrim(text) <> '')
);

create index if not exists idx_rd_knowledge_cards_group
  on public.related_diagram_knowledge_cards (knowledge_group_id);

drop trigger if exists trg_rd_knowledge_cards_updated_at
  on public.related_diagram_knowledge_cards;
create trigger trg_rd_knowledge_cards_updated_at
  before update on public.related_diagram_knowledge_cards
  for each row execute function public.set_updated_at();

create table if not exists public.related_diagram_knowledge_connections (
  id                         uuid primary key default gen_random_uuid(),
  knowledge_group_id         uuid not null
    references public.related_diagram_knowledge_groups(id) on delete cascade,
  source_knowledge_card_id   uuid not null
    references public.related_diagram_knowledge_cards(id) on delete cascade,
  target_knowledge_card_id   uuid not null
    references public.related_diagram_knowledge_cards(id) on delete cascade,
  relation_type              text not null default 'current',
  created_at                 timestamptz not null default now(),
  constraint related_diagram_knowledge_connections_relation_check
    check (relation_type in ('current', 'potential', 'treatment')),
  constraint related_diagram_knowledge_connections_no_self
    check (source_knowledge_card_id <> target_knowledge_card_id)
);

create index if not exists idx_rd_knowledge_connections_group
  on public.related_diagram_knowledge_connections (knowledge_group_id);

-- case（+ 任意 cycle）への Knowledge 割当。AI 自動選定はしない。
create table if not exists public.related_diagram_knowledge_bindings (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations(id),
  case_id             text not null,
  assessment_cycle_id uuid null references public.assessment_cycles(id),
  knowledge_group_id  uuid not null
    references public.related_diagram_knowledge_groups(id),
  knowledge_version   text not null,
  created_by          uuid not null references auth.users(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint related_diagram_knowledge_bindings_case_not_blank
    check (btrim(case_id) <> ''),
  constraint related_diagram_knowledge_bindings_version_not_blank
    check (btrim(knowledge_version) <> '')
);

-- cycle 無し: case 単位で1割当。cycle 有り: case×cycle で1割当。
create unique index if not exists uq_rd_knowledge_bindings_case
  on public.related_diagram_knowledge_bindings (organization_id, case_id)
  where assessment_cycle_id is null;

create unique index if not exists uq_rd_knowledge_bindings_case_cycle
  on public.related_diagram_knowledge_bindings (
    organization_id, case_id, assessment_cycle_id
  )
  where assessment_cycle_id is not null;

create index if not exists idx_rd_knowledge_bindings_org_case
  on public.related_diagram_knowledge_bindings (organization_id, case_id);

drop trigger if exists trg_rd_knowledge_bindings_updated_at
  on public.related_diagram_knowledge_bindings;
create trigger trg_rd_knowledge_bindings_updated_at
  before update on public.related_diagram_knowledge_bindings
  for each row execute function public.set_updated_at();

comment on table public.related_diagram_knowledge_bindings is
  '事例（case）への Knowledge Group/version 割当。学生エントリはこれを使う。';

-- FK from draft head to knowledge group（テーブル定義順の都合で後付け）
alter table public.related_diagram_records
  drop constraint if exists related_diagram_records_knowledge_group_fk;
alter table public.related_diagram_records
  add constraint related_diagram_records_knowledge_group_fk
  foreign key (knowledge_group_id)
  references public.related_diagram_knowledge_groups(id);

-- =====================================================================
-- related_diagram_submissions（immutable snapshot・append-only）
-- assessment_submissions の設計を再利用（物理 DELETE / 学生 UPDATE なし）
-- =====================================================================
create table if not exists public.related_diagram_submissions (
  id                        uuid primary key default gen_random_uuid(),
  related_diagram_id        uuid not null
    references public.related_diagram_records(id),
  organization_id           uuid not null references public.organizations(id),
  student_user_id           uuid not null references auth.users(id),
  academic_year             integer not null,
  case_id                   text not null,
  assessment_cycle_id       uuid null references public.assessment_cycles(id),
  submission_number         integer not null,
  submitted_at              timestamptz not null default now(),
  diagram_snapshot          jsonb not null,
  form3_snapshot_ref        text null,
  form3_snapshot            jsonb null,
  knowledge_snapshot        jsonb not null,
  semantic_schema_version   text not null,
  source_versions           jsonb not null default '{}'::jsonb,
  client_request_id         text null,
  created_at                timestamptz not null default now(),
  constraint related_diagram_submissions_case_not_blank
    check (btrim(case_id) <> ''),
  constraint related_diagram_submissions_number_positive
    check (submission_number >= 1),
  constraint related_diagram_submissions_schema_not_blank
    check (btrim(semantic_schema_version) <> ''),
  unique (related_diagram_id, submission_number)
);

create index if not exists idx_rd_submissions_student_diagram
  on public.related_diagram_submissions (
    student_user_id, related_diagram_id, submitted_at desc
  );

create index if not exists idx_rd_submissions_org_case
  on public.related_diagram_submissions (organization_id, case_id);

create unique index if not exists uq_rd_submissions_client_request
  on public.related_diagram_submissions (
    related_diagram_id, student_user_id, client_request_id
  )
  where client_request_id is not null;

comment on table public.related_diagram_submissions is
  'Related Diagram 提出履歴（append-only）。diagram_snapshot は不変。評価再現性の正本。物理 DELETE しない。';
comment on column public.related_diagram_submissions.diagram_snapshot is
  '提出時点の Related Diagram semantic graph + layout + provenance + NP/integration/priority。';
comment on column public.related_diagram_submissions.form3_snapshot_ref is
  '提出時点 Form3 参照（assessment_submissions.id または form3_records version 等）。後続 Slice で固定。';
comment on column public.related_diagram_submissions.knowledge_snapshot is
  '提出時点の Knowledge Group/version 写し。後からの Library 更新で評価根拠を変えない。';

-- =====================================================================
-- RLS — related_diagram_records
-- =====================================================================
alter table public.related_diagram_records enable row level security;

drop policy if exists related_diagram_select_own on public.related_diagram_records;
create policy related_diagram_select_own
  on public.related_diagram_records
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists related_diagram_insert_own on public.related_diagram_records;
create policy related_diagram_insert_own
  on public.related_diagram_records
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.current_app_role() = 'student'
    and organization_id = public.current_organization_id()
    and academic_year = public.current_academic_year()
  );

drop policy if exists related_diagram_update_own on public.related_diagram_records;
create policy related_diagram_update_own
  on public.related_diagram_records
  for update
  to authenticated
  using (
    user_id = auth.uid()
    and public.current_app_role() = 'student'
  )
  with check (
    user_id = auth.uid()
    and public.current_app_role() = 'student'
    and organization_id = public.current_organization_id()
    and academic_year = public.current_academic_year()
  );

drop policy if exists related_diagram_select_staff on public.related_diagram_records;
create policy related_diagram_select_staff
  on public.related_diagram_records
  for select
  to authenticated
  using (
    public.is_staff()
    and organization_id = public.current_organization_id()
  );

grant select, insert, update on public.related_diagram_records to authenticated;
grant all on public.related_diagram_records to service_role;

-- =====================================================================
-- RLS — knowledge groups / cards / connections / bindings
-- =====================================================================
alter table public.related_diagram_knowledge_groups enable row level security;
alter table public.related_diagram_knowledge_cards enable row level security;
alter table public.related_diagram_knowledge_connections enable row level security;
alter table public.related_diagram_knowledge_bindings enable row level security;

-- students: published groups in own org
drop policy if exists rd_knowledge_groups_select_student
  on public.related_diagram_knowledge_groups;
create policy rd_knowledge_groups_select_student
  on public.related_diagram_knowledge_groups
  for select
  to authenticated
  using (
    public.current_app_role() = 'student'
    and organization_id = public.current_organization_id()
    and status = 'published'
  );

drop policy if exists rd_knowledge_groups_select_staff
  on public.related_diagram_knowledge_groups;
create policy rd_knowledge_groups_select_staff
  on public.related_diagram_knowledge_groups
  for select
  to authenticated
  using (
    public.is_staff()
    and organization_id = public.current_organization_id()
  );

-- admin write for knowledge groups（自組織）
drop policy if exists rd_knowledge_groups_insert_admin
  on public.related_diagram_knowledge_groups;
create policy rd_knowledge_groups_insert_admin
  on public.related_diagram_knowledge_groups
  for insert
  to authenticated
  with check (
    public.current_app_role() = 'admin'
    and organization_id = public.current_organization_id()
    and created_by = auth.uid()
  );

drop policy if exists rd_knowledge_groups_update_admin
  on public.related_diagram_knowledge_groups;
create policy rd_knowledge_groups_update_admin
  on public.related_diagram_knowledge_groups
  for update
  to authenticated
  using (
    public.current_app_role() = 'admin'
    and organization_id = public.current_organization_id()
  )
  with check (
    public.current_app_role() = 'admin'
    and organization_id = public.current_organization_id()
  );

-- knowledge cards: readable if parent group is readable
drop policy if exists rd_knowledge_cards_select_authenticated
  on public.related_diagram_knowledge_cards;
create policy rd_knowledge_cards_select_authenticated
  on public.related_diagram_knowledge_cards
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.related_diagram_knowledge_groups g
      where g.id = knowledge_group_id
        and g.organization_id = public.current_organization_id()
        and (
          public.is_staff()
          or (
            public.current_app_role() = 'student'
            and g.status = 'published'
          )
        )
    )
  );

drop policy if exists rd_knowledge_cards_write_admin
  on public.related_diagram_knowledge_cards;
create policy rd_knowledge_cards_write_admin
  on public.related_diagram_knowledge_cards
  for all
  to authenticated
  using (
    public.current_app_role() = 'admin'
    and exists (
      select 1
      from public.related_diagram_knowledge_groups g
      where g.id = knowledge_group_id
        and g.organization_id = public.current_organization_id()
    )
  )
  with check (
    public.current_app_role() = 'admin'
    and exists (
      select 1
      from public.related_diagram_knowledge_groups g
      where g.id = knowledge_group_id
        and g.organization_id = public.current_organization_id()
    )
  );

drop policy if exists rd_knowledge_connections_select_authenticated
  on public.related_diagram_knowledge_connections;
create policy rd_knowledge_connections_select_authenticated
  on public.related_diagram_knowledge_connections
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.related_diagram_knowledge_groups g
      where g.id = knowledge_group_id
        and g.organization_id = public.current_organization_id()
        and (
          public.is_staff()
          or (
            public.current_app_role() = 'student'
            and g.status = 'published'
          )
        )
    )
  );

drop policy if exists rd_knowledge_connections_write_admin
  on public.related_diagram_knowledge_connections;
create policy rd_knowledge_connections_write_admin
  on public.related_diagram_knowledge_connections
  for all
  to authenticated
  using (
    public.current_app_role() = 'admin'
    and exists (
      select 1
      from public.related_diagram_knowledge_groups g
      where g.id = knowledge_group_id
        and g.organization_id = public.current_organization_id()
    )
  )
  with check (
    public.current_app_role() = 'admin'
    and exists (
      select 1
      from public.related_diagram_knowledge_groups g
      where g.id = knowledge_group_id
        and g.organization_id = public.current_organization_id()
    )
  );

-- bindings: students read own org; admin write
drop policy if exists rd_knowledge_bindings_select_authenticated
  on public.related_diagram_knowledge_bindings;
create policy rd_knowledge_bindings_select_authenticated
  on public.related_diagram_knowledge_bindings
  for select
  to authenticated
  using (organization_id = public.current_organization_id());

drop policy if exists rd_knowledge_bindings_insert_admin
  on public.related_diagram_knowledge_bindings;
create policy rd_knowledge_bindings_insert_admin
  on public.related_diagram_knowledge_bindings
  for insert
  to authenticated
  with check (
    public.current_app_role() = 'admin'
    and organization_id = public.current_organization_id()
    and created_by = auth.uid()
  );

drop policy if exists rd_knowledge_bindings_update_admin
  on public.related_diagram_knowledge_bindings;
create policy rd_knowledge_bindings_update_admin
  on public.related_diagram_knowledge_bindings
  for update
  to authenticated
  using (
    public.current_app_role() = 'admin'
    and organization_id = public.current_organization_id()
  )
  with check (
    public.current_app_role() = 'admin'
    and organization_id = public.current_organization_id()
  );

drop policy if exists rd_knowledge_bindings_delete_admin
  on public.related_diagram_knowledge_bindings;
create policy rd_knowledge_bindings_delete_admin
  on public.related_diagram_knowledge_bindings
  for delete
  to authenticated
  using (
    public.current_app_role() = 'admin'
    and organization_id = public.current_organization_id()
  );

grant select on public.related_diagram_knowledge_groups to authenticated;
grant insert, update on public.related_diagram_knowledge_groups to authenticated;
grant select on public.related_diagram_knowledge_cards to authenticated;
grant insert, update, delete on public.related_diagram_knowledge_cards to authenticated;
grant select on public.related_diagram_knowledge_connections to authenticated;
grant insert, update, delete on public.related_diagram_knowledge_connections to authenticated;
grant select on public.related_diagram_knowledge_bindings to authenticated;
grant insert, update, delete on public.related_diagram_knowledge_bindings to authenticated;

grant all on public.related_diagram_knowledge_groups to service_role;
grant all on public.related_diagram_knowledge_cards to service_role;
grant all on public.related_diagram_knowledge_connections to service_role;
grant all on public.related_diagram_knowledge_bindings to service_role;

-- =====================================================================
-- RLS — related_diagram_submissions（SELECT のみ。INSERT は将来 RPC）
-- =====================================================================
alter table public.related_diagram_submissions enable row level security;

drop policy if exists related_diagram_submissions_select_own
  on public.related_diagram_submissions;
create policy related_diagram_submissions_select_own
  on public.related_diagram_submissions
  for select
  to authenticated
  using (
    student_user_id = auth.uid()
    and public.current_app_role() = 'student'
  );

drop policy if exists related_diagram_submissions_select_staff
  on public.related_diagram_submissions;
create policy related_diagram_submissions_select_staff
  on public.related_diagram_submissions
  for select
  to authenticated
  using (
    public.is_staff()
    and organization_id = public.current_organization_id()
  );

grant select on public.related_diagram_submissions to authenticated;
grant all on public.related_diagram_submissions to service_role;

-- =====================================================================
-- Minimal Knowledge Group seed（default org・固定 UUID・再実行安全）
-- created_by は profiles が無い環境では入れられないため、
-- service_role 適用時に別途 seed する前提のコメント付き定数は
-- TypeScript（minimalKnowledgeSeed.ts）側を正とする。
-- ここではテーブル構造のみ確定し、行 seed は適用時 runbook で行う。
-- =====================================================================
