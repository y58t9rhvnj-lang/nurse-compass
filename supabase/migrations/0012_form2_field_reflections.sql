-- =====================================================================
-- Compass Version2 — Learning Layer
-- 0012_form2_field_reflections.sql : 「各項目から考えたこと」（様式2 各項目の考察）の保存
-- =====================================================================
-- Patient Understanding Redesign（Sprint D-3A）。
-- 患者理解は「事実を書く場所」ではなく、様式2（整理した事実）を根拠に、学生が自分の言葉で
-- 意味づけ（考察）を積み上げる学習過程とする。その最小単位として、様式2 の各入力項目に
-- 対応した「私が考えたこと（reflection）」を、項目キー（form2_field_key）ごとに保存する。
--
-- 学習フロー:
--   電子カルテ → Compassノート → 様式2（事実整理） → 各項目から考えたこと（本テーブル）
--     → 私が捉えた患者さん（patient_understanding_records の overview_text／最終統合物）
--
-- 方針（既存 form2_evidence_links / patient_understanding_records の設計を踏襲）:
--   ・学生 × 組織 × 年度 × ケース × 項目キー で分離。受け持ちケースのみ（case_id はサーバ解決値）。
--   ・学生 × ケース × 項目キー につき 1 レコード（upsert の onConflict 対象）。
--   ・reflection_text の更新のみ（identity 系は不変トリガーで保護）。空文字を許可（自動保存の途中状態）。
--   ・物理削除は行わない（DELETE 未付与）。クリア時は空文字で上書き。
--   ・form2_field_key は自由入力にせず、様式2 の固定キー集合（0010 の CHECK と同一）に限定する。
--   ・共通関数（set_updated_at / reject_immutable_columns / current_app_role /
--     current_organization_id / current_academic_year / is_staff）は既存 migration のものを再利用する。
-- ---------------------------------------------------------------------

create table if not exists public.form2_field_reflections (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  organization_id  uuid not null references public.organizations(id),
  academic_year    integer not null,
  case_id          text not null,                  -- 受け持ちケース（サーバ解決値）
  patient_id       text not null,                  -- V1 患者ID（例 "A"）
  form2_field_key  text not null,                  -- 様式2 の固定キー（下記 CHECK・0010 と同一集合）
  reflection_text  text not null default '',       -- 「私が考えたこと」本文（空を許可＝自動保存の途中状態）
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint form2_field_reflections_case_id_not_blank check (btrim(case_id) <> ''),
  constraint form2_field_reflections_patient_id_not_blank check (btrim(patient_id) <> ''),
  -- 様式2 の固定フィールドキー（lib/form2/form2FieldKeys.ts / 0010 の許可集合に一致）。
  constraint form2_field_reflections_field_key_valid check (
    form2_field_key in (
      -- basicInformation.*
      'basicInformation.patientName',
      'basicInformation.age',
      'basicInformation.sex',
      'basicInformation.diagnosis',
      'basicInformation.pastHistory',
      'basicInformation.admissionType',
      'basicInformation.chiefComplaint',
      -- history.*
      'history.familyBackground',
      'history.developmentalHistory',
      'history.schoolHistory',
      'history.employmentHistory',
      'history.beforeOnset',
      'history.firstAdmission',
      'history.subsequentCourse',
      'history.currentAdmissionCourse',
      'history.currentCondition',
      'history.currentLife',
      'history.insight',
      'history.medicationRecognition',
      'history.dischargeThoughts',
      -- treatment
      'treatment.policyAndContent'
    )
  ),
  -- 学生 × ケース × 項目 で 1 件（upsert の onConflict 対象）。
  constraint uq_form2_field_reflection_owner unique (user_id, case_id, form2_field_key)
);

-- 学生が自分の（現在年度・組織・受け持ちケース）の考察一覧を引く境界。
create index if not exists idx_form2_field_reflection_owner
  on public.form2_field_reflections (
    user_id, organization_id, academic_year, case_id
  );

-- updated_at 自動更新（reflection_text の UPDATE で更新）。共通関数を再利用。
drop trigger if exists trg_form2_field_reflection_updated_at on public.form2_field_reflections;
create trigger trg_form2_field_reflection_updated_at
  before update on public.form2_field_reflections
  for each row execute function public.set_updated_at();

-- 不変カラム保護（identity 系・項目キー）。UPDATE で変更可能なのは reflection_text / updated_at のみ。
drop trigger if exists trg_form2_field_reflection_immutable on public.form2_field_reflections;
create trigger trg_form2_field_reflection_immutable
  before update on public.form2_field_reflections
  for each row execute function public.reject_immutable_columns(
    'id', 'user_id', 'organization_id', 'academic_year',
    'case_id', 'patient_id', 'form2_field_key', 'created_at'
  );

-- =====================================================================
-- RLS
-- =====================================================================
--   student : 自分の行を SELECT / INSERT / UPDATE（学生 × ケース × 項目で 1 件を upsert）。
--   teacher/admin : 自組織の考察を SELECT のみ（学生の記述を書き換えない）。
--   anon     : GRANT せず・ポリシーも authenticated 限定 → 一切不可。
--   service_role : all（RLS 回避）。シード・検証・管理のみ。
--   DELETE   : どのロールにも GRANT しない（物理削除しない。クリアは空文字で上書き）。
-- ---------------------------------------------------------------------
alter table public.form2_field_reflections enable row level security;

drop policy if exists form2_field_reflections_select_own on public.form2_field_reflections;
create policy form2_field_reflections_select_own
  on public.form2_field_reflections
  for select
  to authenticated
  using (
    user_id = auth.uid()
    and public.current_app_role() = 'student'
    and organization_id = public.current_organization_id()
    and academic_year   = public.current_academic_year()
  );

drop policy if exists form2_field_reflections_insert_own on public.form2_field_reflections;
create policy form2_field_reflections_insert_own
  on public.form2_field_reflections
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.current_app_role() = 'student'
    and organization_id = public.current_organization_id()
    and academic_year   = public.current_academic_year()
  );

drop policy if exists form2_field_reflections_update_own on public.form2_field_reflections;
create policy form2_field_reflections_update_own
  on public.form2_field_reflections
  for update
  to authenticated
  using (
    user_id = auth.uid()
    and public.current_app_role() = 'student'
    and organization_id = public.current_organization_id()
    and academic_year   = public.current_academic_year()
  )
  with check (
    user_id = auth.uid()
    and public.current_app_role() = 'student'
    and organization_id = public.current_organization_id()
    and academic_year   = public.current_academic_year()
  );

drop policy if exists form2_field_reflections_select_staff on public.form2_field_reflections;
create policy form2_field_reflections_select_staff
  on public.form2_field_reflections
  for select
  to authenticated
  using (public.is_staff() and organization_id = public.current_organization_id());

-- =====================================================================
-- GRANT（RLS 前提の最小権限。行の絞り込みは RLS が担う）
-- =====================================================================
grant select, insert, update on public.form2_field_reflections to authenticated; -- DELETE は付与しない
grant all on public.form2_field_reflections to service_role;

-- =====================================================================
-- COMMENT
-- =====================================================================
comment on table public.form2_field_reflections is
  '様式2 の各項目に対する「私が考えたこと（考察）」の保存テーブル（Sprint D-3A）。学生 × ケース × 項目キーで 1 件（上書き保存）。事実ではなく学生の意味づけを保持する。最終統合物「私が捉えた患者さん」は patient_understanding_records に別途保存する。教員・管理者は自組織を閲覧のみ。';
comment on column public.form2_field_reflections.form2_field_key is
  '様式2 の固定フィールドキー（section.field のドットパス。lib/form2/form2FieldKeys.ts の許可集合＝0010 と一致）。自由入力にしない。';
comment on column public.form2_field_reflections.reflection_text is
  '当該項目に対する学生の考察本文。自動保存（debounce）の途中状態として空文字を許可する。';
