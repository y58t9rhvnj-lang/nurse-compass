-- =====================================================================
-- Compass Version2 — Learning Layer
-- 0011_patient_understanding_records.sql : 患者理解（「私が捉えた患者さん」）の保存テーブル・RLS・GRANT
-- =====================================================================
-- Patient Understanding Workspace（Sprint D-2C）の成果物である「私が捉えた患者さん」の文章を保持する。
-- 様式2（情報整理）の後、ゴードン／様式3へ分類する前に、学生が情報を統合して患者さんの全体像を
-- 自分の言葉で表現する段階（「分類する前に理解する」）。
--
-- 方針（既存 student_notes / form2_records の設計を踏襲）:
--   ・学生ごと / 組織ごと / 年度ごと / ケースごと / 患者ごとに分離。
--   ・受け持ち患者のみを対象（case_id はサーバ側で解決した値を保存する）。
--   ・学生 × ケースにつき 1 レコード（現行の患者理解 head）。upsert で更新する。
--   ・overview_text の更新のみ（identity 系は不変トリガーで保護）。物理削除は行わない（DELETE 未付与）。
--   ・将来拡張（履歴 revisions / AI 評価 / 教員コメント）は、この head に対する追記テーブルとして
--     後付けできる構造にしておく（本テーブルは最新の1件のみを持つ）。
--   ・共通関数（set_updated_at / reject_immutable_columns / current_app_role /
--     current_organization_id / current_academic_year / is_staff）は既存 migration のものを再利用する。
-- ---------------------------------------------------------------------

create table if not exists public.patient_understanding_records (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  organization_id  uuid not null references public.organizations(id),
  academic_year    integer not null,               -- profile 由来を明示保存（固定 default は入れない）
  case_id          text not null,                  -- 受け持ちケース（サーバ解決値）
  patient_id       text not null,                  -- V1 患者ID（例 "A"）
  overview_text    text not null default '',       -- 「私が捉えた患者さん」本文（空を許可＝自動保存の途中状態）
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint patient_understanding_case_id_not_blank check (btrim(case_id) <> ''),
  constraint patient_understanding_patient_id_not_blank check (btrim(patient_id) <> ''),
  -- 学生 × ケースで 1 件（upsert の onConflict 対象）。
  constraint uq_patient_understanding_owner unique (user_id, case_id)
);

-- 学生が自分の（現在年度・組織・受け持ちケース）の患者理解を引く境界。
create index if not exists idx_patient_understanding_owner
  on public.patient_understanding_records (
    user_id, organization_id, academic_year, case_id
  );

-- updated_at 自動更新（overview_text の UPDATE で更新される）。共通関数を再利用。
drop trigger if exists trg_patient_understanding_updated_at on public.patient_understanding_records;
create trigger trg_patient_understanding_updated_at
  before update on public.patient_understanding_records
  for each row execute function public.set_updated_at();

-- 不変カラム保護（identity 系）。UPDATE で変更可能なのは overview_text / updated_at のみ。
drop trigger if exists trg_patient_understanding_immutable on public.patient_understanding_records;
create trigger trg_patient_understanding_immutable
  before update on public.patient_understanding_records
  for each row execute function public.reject_immutable_columns(
    'id', 'user_id', 'organization_id', 'academic_year',
    'case_id', 'patient_id', 'created_at'
  );

-- =====================================================================
-- RLS
-- =====================================================================
--   student : 自分の行を SELECT / INSERT / UPDATE（学生 × ケースで 1 件を upsert）。
--             すべてのポリシーで user_id = auth.uid() ＋ role='student' ＋
--             organization_id = current_organization_id() ＋ academic_year = current_academic_year()。
--   teacher/admin : 自組織の患者理解を SELECT のみ（学生の記述を書き換えない）。
--   anon     : GRANT せず・ポリシーも authenticated 限定 → 一切不可。
--   service_role : all（RLS 回避）。シード・検証・管理のみ。
--   DELETE   : どのロールにも GRANT しない（物理削除しない。現行は上書き保存）。
-- ---------------------------------------------------------------------
alter table public.patient_understanding_records enable row level security;

-- SELECT: 自分の行のみ（所有・role・組織・年度境界）。soft-delete は無いため deleted_at 条件は無い。
drop policy if exists patient_understanding_select_own on public.patient_understanding_records;
create policy patient_understanding_select_own
  on public.patient_understanding_records
  for select
  to authenticated
  using (
    user_id = auth.uid()
    and public.current_app_role() = 'student'
    and organization_id = public.current_organization_id()
    and academic_year   = public.current_academic_year()
  );

-- INSERT: 自分の行のみ。
drop policy if exists patient_understanding_insert_own on public.patient_understanding_records;
create policy patient_understanding_insert_own
  on public.patient_understanding_records
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.current_app_role() = 'student'
    and organization_id = public.current_organization_id()
    and academic_year   = public.current_academic_year()
  );

-- UPDATE: 自分の行のみ（overview_text の上書き保存）。
drop policy if exists patient_understanding_update_own on public.patient_understanding_records;
create policy patient_understanding_update_own
  on public.patient_understanding_records
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

-- teacher/admin: 自組織の患者理解を SELECT のみ（読取専用）。
drop policy if exists patient_understanding_select_staff on public.patient_understanding_records;
create policy patient_understanding_select_staff
  on public.patient_understanding_records
  for select
  to authenticated
  using (public.is_staff() and organization_id = public.current_organization_id());

-- =====================================================================
-- GRANT（RLS 前提の最小権限。行の絞り込みは RLS が担う）
-- =====================================================================
grant select, insert, update on public.patient_understanding_records to authenticated; -- DELETE は付与しない
grant all on public.patient_understanding_records to service_role;

-- =====================================================================
-- COMMENT
-- =====================================================================
comment on table public.patient_understanding_records is
  '学生が様式2 の後・様式3（ゴードン）の前に、情報を統合して患者さんの全体像を自分の言葉で表現する「私が捉えた患者さん」の保存テーブル。学生 × ケースで 1 件（上書き保存）。教員・管理者は自組織を閲覧のみ。将来は履歴・AI評価・教員コメントの追記テーブルを後付けできる head として扱う。';
comment on column public.patient_understanding_records.overview_text is
  '「私が捉えた患者さん」の本文。自動保存（debounce）の途中状態として空文字を許可する。';
comment on column public.patient_understanding_records.case_id is
  '受け持ちケースID（サーバ側で解決した値を保存）。';
comment on column public.patient_understanding_records.patient_id is
  'V1 患者ID（例 "A"）。';
