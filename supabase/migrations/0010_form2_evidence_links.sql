-- =====================================================================
-- Compass Version2 — Learning Layer
-- 0010_form2_evidence_links.sql : Evidence–様式2 根拠リンク（中間テーブル）・RLS・GRANT
-- =====================================================================
-- 「根拠リンク」は、学生が整理した Evidence（information_cards）を、様式2（form2_records）の
-- どの項目の根拠として使ったかを表す多対多の関係。学生の思考プロセス（事実→患者理解の言語化）を
-- 可視化するための第一級の関係として、独立した中間テーブルで保持する。
--
-- 設計（docs/version2/10_evidence_form2_link_design.md §6 = 方式C・第一候補）:
--   ・Evidence は「事実のみ」を保つ（information_cards に利用先を混ぜない）。
--   ・様式2 payload はクリーンに保つ（自動保存・楽観ロックを侵さない）。
--   ・明確な FK（form2_record_id / evidence_id）で参照整合性・双方向クエリ・教員閲覧を担保。
--   ・様式2 は項目行を持たないため、リンク先は「アプリ定義の固定フィールドキー」で指す
--     （自由入力にしない＝DB CHECK と Server Action の両方で妥当性を担保）。
--
-- 方針:
--   ・学生ごと / 組織ごと / 年度ごと / ケースごとに分離（他テーブルと同じ規約）。
--   ・リンクは「学習事実そのもの」ではなく「関係」のため、学生は自分のリンク行を物理 DELETE 可。
--     （information_cards / student_notes の論理削除とは異なる。これにより PostgREST の
--       `UPDATE … RETURNING` × deleted_at 問題も発生しない＝soft-delete を使わない。）
--   ・リンクは作成・削除のみ（UPDATE 経路を持たない）。updated_at / 不変トリガーは不要。
--   ・identity 系（user_id/organization_id/academic_year/case_id/created_by）はサーバ解決値を保存し、
--     クライアント申告を信用しない（Server Action 側で決定）。
--   ・共通関数（current_app_role / is_staff / current_organization_id / current_academic_year）は
--     既存 migration（0003）のものを再利用する（同名関数を再定義しない）。
-- ---------------------------------------------------------------------

create table if not exists public.form2_evidence_links (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  organization_id  uuid not null references public.organizations(id),
  academic_year    integer not null,
  case_id          text not null,
  form2_record_id  uuid not null references public.form2_records(id) on delete cascade,
  form2_field_key  text not null,              -- 固定キー集合から選択（下記 CHECK）
  evidence_id      uuid not null references public.information_cards(id) on delete cascade,
  created_by       text not null default 'student',
  created_at       timestamptz not null default now(),
  constraint form2_evidence_links_case_id_not_blank check (btrim(case_id) <> ''),
  constraint form2_evidence_links_created_by_valid
    check (created_by in ('student', 'system')),
  -- 様式2 の固定フィールドキー（lib/form2/form2Types.ts の
  --   FORM2_BASIC_KEYS / FORM2_HISTORY_KEYS / 'treatment.policyAndContent' に一致）。
  --   section を prefix したドットパスで一意に指す（自由入力による揺れを許さない）。
  constraint form2_evidence_links_field_key_valid check (
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
  )
);

-- 同一リンク（同じ様式2 レコード・項目・Evidence）の重複防止。
--   二重作成は Server Action 側で 'duplicate' を成功扱いにできる。
create unique index if not exists uq_form2_evidence_link
  on public.form2_evidence_links (form2_record_id, form2_field_key, evidence_id);

-- 項目 → 根拠一覧（様式2 の各項目で「関連する根拠 N件」を引く主経路）。
create index if not exists idx_form2_evidence_link_field
  on public.form2_evidence_links (form2_record_id, form2_field_key);

-- Evidence → 利用先一覧（Evidence 起点で「どこで使ったか」を引く）。
create index if not exists idx_form2_evidence_link_evidence
  on public.form2_evidence_links (evidence_id);

-- 学生の所有行取得境界（RLS と同じ分離軸）。
create index if not exists idx_form2_evidence_link_owner
  on public.form2_evidence_links (user_id, organization_id, academic_year, case_id);

-- =====================================================================
-- RLS
-- =====================================================================
--   student : 自分の行を SELECT / INSERT / DELETE（UPDATE 経路は持たない）。
--             すべてのポリシーで user_id = auth.uid() ＋ role='student' ＋
--             organization_id = current_organization_id() ＋ academic_year = current_academic_year()
--             を課し、org/year の改ざんとなりすましを防ぐ。
--   teacher/admin : 自組織のリンクを SELECT のみ（書込不可・学生の思考過程を尊重）。
--   anon     : GRANT せず・ポリシーも authenticated 限定 → 一切不可。
--   service_role : all（RLS 回避）。シード・検証・管理のみ。
-- ---------------------------------------------------------------------
alter table public.form2_evidence_links enable row level security;

-- SELECT: 自分の行のみ（所有・role・組織・年度境界）。soft-delete は無いため deleted_at 条件は無い。
drop policy if exists form2_evidence_links_select_own on public.form2_evidence_links;
create policy form2_evidence_links_select_own
  on public.form2_evidence_links
  for select
  to authenticated
  using (
    user_id = auth.uid()
    and public.current_app_role() = 'student'
    and organization_id = public.current_organization_id()
    and academic_year   = public.current_academic_year()
  );

-- INSERT: 自分の行のみ。学生作成リンクは created_by = 'student' を強制（なりすまし防止）。
drop policy if exists form2_evidence_links_insert_own on public.form2_evidence_links;
create policy form2_evidence_links_insert_own
  on public.form2_evidence_links
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.current_app_role() = 'student'
    and created_by = 'student'
    and organization_id = public.current_organization_id()
    and academic_year   = public.current_academic_year()
  );

-- DELETE: 自分の行のみ（リンクは関係のため物理削除可。Evidence 本体・様式2 は消さない）。
drop policy if exists form2_evidence_links_delete_own on public.form2_evidence_links;
create policy form2_evidence_links_delete_own
  on public.form2_evidence_links
  for delete
  to authenticated
  using (
    user_id = auth.uid()
    and public.current_app_role() = 'student'
    and organization_id = public.current_organization_id()
    and academic_year   = public.current_academic_year()
  );

-- teacher/admin: 自組織のリンクを SELECT のみ（読取専用）。
drop policy if exists form2_evidence_links_select_staff on public.form2_evidence_links;
create policy form2_evidence_links_select_staff
  on public.form2_evidence_links
  for select
  to authenticated
  using (public.is_staff() and organization_id = public.current_organization_id());

-- =====================================================================
-- GRANT（RLS 前提の最小権限。行の絞り込みは RLS が担う）
-- =====================================================================
grant select, insert, delete on public.form2_evidence_links to authenticated; -- UPDATE は付与しない
grant all on public.form2_evidence_links to service_role;

-- =====================================================================
-- COMMENT
-- =====================================================================
comment on table public.form2_evidence_links is
  'Evidence（information_cards）を様式2（form2_records）のどの項目の根拠として使ったかを表す中間テーブル（多対多）。Evidence は事実のまま／様式2 payload はクリーンに保ち、関係のみをここで保持する。リンクは学生が物理 DELETE 可。教員・管理者は自組織を閲覧のみ。';
comment on column public.form2_evidence_links.form2_field_key is
  '様式2 の固定フィールドキー（section.field のドットパス。lib/form2/form2Types.ts の許可集合と一致）。自由入力にしない。';
comment on column public.form2_evidence_links.evidence_id is
  'information_cards.id への参照。Evidence は論理削除のため FK cascade は発火しない。Evidence 解除時は Server Action がリンクを物理削除する。';
