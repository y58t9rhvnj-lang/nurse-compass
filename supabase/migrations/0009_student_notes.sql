-- =====================================================================
-- Compass Version2 — Learning Layer
-- 0009_student_notes.sql : Compassメモ（student_notes）の保存テーブル・RLS・GRANT
-- =====================================================================
-- Compassメモは、学生が患者情報を振り返るために自分の言葉で記録する「非公開の個人メモ」。
-- 教員・管理者に共有されるのは、学生が Evidence として選択・整理した情報（information_cards）のみで、
-- Compassメモそのものは教員・管理者の通常画面からは閲覧できない（本テーブルに staff SELECT を作らない）。
--
-- 方針（docs/version2/15_learning_design.md に準拠）:
--   ・学生ごと / 組織ごと / 年度ごと / ケースごと / 患者ごとに分離。
--   ・受け持ち患者のみを対象（case_id はサーバ側で解決した値を保存する）。
--   ・id はクライアント生成（既存 note.id）をそのまま主キーにする。
--     既存 note.id には crypto.randomUUID() 以外のフォールバック形式もあり、
--     Evidence（information_cards）の source_reference.id との完全互換を保つため uuid 型にしない。
--   ・削除は物理削除ではなく deleted_at による論理削除（DELETE は誰にも GRANT しない）。
--   ・identity 系カラム（id/user_id/organization_id/academic_year/case_id/patient_id/created_at）は
--     作成後 UPDATE で変更不可（トリガー）。学生が更新できるのは content / updated_at / deleted_at のみ。
--   ・共通関数（set_updated_at / reject_immutable_columns / current_app_role /
--     current_organization_id / current_academic_year）は既存 migration のものを再利用する
--     （同名関数を再定義しない）。
-- ---------------------------------------------------------------------

create table if not exists public.student_notes (
  id               text not null,                  -- クライアント生成（既存 note.id を維持）
  user_id          uuid not null references auth.users(id) on delete cascade,
  organization_id  uuid not null references public.organizations(id),
  academic_year    integer not null,               -- 固定 default は入れない（profile 由来を明示保存）
  case_id          text not null,                  -- 受け持ちケース（サーバ解決値）
  patient_id       text not null,                  -- V1 患者ID（例 "A"）
  content          text not null,                  -- メモ本文
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz,                     -- null=有効 / 論理削除は now()
  constraint student_notes_pkey primary key (id),
  constraint student_notes_id_not_blank check (btrim(id) <> ''),
  constraint student_notes_case_id_not_blank check (btrim(case_id) <> ''),
  constraint student_notes_patient_id_not_blank check (btrim(patient_id) <> ''),
  constraint student_notes_content_not_blank check (btrim(content) <> '')
);

-- 学生が「現在年度・受け持ちケース・当該患者の未削除メモ」を更新日時降順で取得する主経路。
create index if not exists idx_student_notes_owner
  on public.student_notes (
    user_id,
    organization_id,
    academic_year,
    case_id,
    patient_id,
    updated_at desc
  )
  where deleted_at is null;

-- updated_at 自動更新（content / deleted_at の UPDATE でも更新される）。共通関数を再利用。
drop trigger if exists trg_student_notes_updated_at on public.student_notes;
create trigger trg_student_notes_updated_at
  before update on public.student_notes
  for each row execute function public.set_updated_at();

-- 不変カラム保護（identity 系）。UPDATE で変更可能なのは content / updated_at / deleted_at のみ。
-- 共通関数 reject_immutable_columns（0005/0008）を再利用し、列名を TG_ARGV で渡す。
drop trigger if exists trg_student_notes_immutable on public.student_notes;
create trigger trg_student_notes_immutable
  before update on public.student_notes
  for each row execute function public.reject_immutable_columns(
    'id', 'user_id', 'organization_id', 'academic_year',
    'case_id', 'patient_id', 'created_at'
  );

-- =====================================================================
-- RLS
-- =====================================================================
--   student : 自分の行を SELECT / INSERT / UPDATE（論理削除を含む）。
--             すべてのポリシーで user_id = auth.uid() ＋ role='student' ＋
--             organization_id = current_organization_id() ＋ academic_year = current_academic_year()
--             を課し、org/year の改ざんとなりすましを防ぐ。
--             論理削除済み行の非表示は RLS ではなくアプリ側クエリ（.is('deleted_at', null)）で行う
--             （information_cards / form2_records と同じ既存パターン。理由は SELECT policy 参照）。
--   teacher/admin : ポリシーを作らない（Compassメモは学生の非公開領域）。
--   anon     : GRANT せず・ポリシーも authenticated 限定 → 一切不可。
--   service_role : all（RLS 回避）。シード・検証・管理のみ。
--   DELETE   : どのロールにも GRANT しない（物理削除不可。削除は deleted_at による論理削除）。
-- ---------------------------------------------------------------------
alter table public.student_notes enable row level security;

-- SELECT: 自分の行のみ（所有・role・組織・年度境界）。
--   論理削除の絞り込み（deleted_at is null）は RLS では行わず、アプリ側クエリで
--   .is('deleted_at', null) を明示する（information_cards / form2_records と同じパターン）。
--   理由: PostgREST は変更系を CTE 内の `UPDATE ... RETURNING *` として実行するため、
--   RETURNING された行は SELECT policy を満たす必要がある。SELECT policy に
--   deleted_at is null を含めると、論理削除で deleted_at が非null になった行が
--   RETURNING 時に不可視となり、42501（new row violates RLS）で soft-delete 自体が失敗する。
drop policy if exists student_notes_select_own on public.student_notes;
create policy student_notes_select_own
  on public.student_notes
  for select
  to authenticated
  using (
    user_id = auth.uid()
    and public.current_app_role() = 'student'
    and organization_id = public.current_organization_id()
    and academic_year   = public.current_academic_year()
  );

-- INSERT: 自分の行のみ。作成時は未削除（deleted_at is null）を強制。
drop policy if exists student_notes_insert_own on public.student_notes;
create policy student_notes_insert_own
  on public.student_notes
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.current_app_role() = 'student'
    and organization_id = public.current_organization_id()
    and academic_year   = public.current_academic_year()
    and deleted_at is null
  );

-- UPDATE: 自分の未削除行のみ対象（USING で deleted_at is null）。
--   本文編集と deleted_at = now() による論理削除を許可する。
--   USING が未削除行に限定されるため、論理削除済み行は UPDATE 対象にならず、
--   deleted_at を null へ戻す「復活」操作は通常経路では成立しない（新規関数を追加せず SQL のみで実現）。
drop policy if exists student_notes_update_own on public.student_notes;
create policy student_notes_update_own
  on public.student_notes
  for update
  to authenticated
  using (
    user_id = auth.uid()
    and public.current_app_role() = 'student'
    and organization_id = public.current_organization_id()
    and academic_year   = public.current_academic_year()
    and deleted_at is null
  )
  with check (
    user_id = auth.uid()
    and public.current_app_role() = 'student'
    and organization_id = public.current_organization_id()
    and academic_year   = public.current_academic_year()
  );

-- =====================================================================
-- GRANT（RLS 前提の最小権限。行の絞り込みは RLS が担う）
-- =====================================================================
grant select, insert, update on public.student_notes to authenticated; -- DELETE は付与しない
grant all on public.student_notes to service_role;

-- =====================================================================
-- COMMENT
-- =====================================================================
comment on table public.student_notes is
  '学生が患者情報を振り返るために記録する非公開の Compassメモ。教員・管理者の通常画面からは閲覧不可（共有されるのは学生が Evidence として選択した information_cards のみ）。削除は deleted_at による論理削除。';
comment on column public.student_notes.id is
  'クライアント生成のメモID（既存 note.id を維持）。Evidence の source_reference.id と互換のため uuid 型にしない。';
comment on column public.student_notes.case_id is
  '受け持ちケースID（サーバ側で解決した値を保存）。';
comment on column public.student_notes.patient_id is
  'V1 患者ID（例 "A"）。localStorage 時代の分離単位を保持する。';
comment on column public.student_notes.deleted_at is
  '論理削除時刻。null=有効。物理削除は行わない。';
