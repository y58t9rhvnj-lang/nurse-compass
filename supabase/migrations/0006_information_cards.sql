-- =====================================================================
-- Compass Version2 β — Phase 3-1
-- 0006_information_cards.sql : Stage1 情報カード（データ）の保存テーブル
-- =====================================================================
-- 「情報カード」は学生が意味づける前の「データ（事実）」である。
-- 患者理解・解釈済み情報として扱わない（docs/02 §データ→情報→手がかり）。
--
-- 方針:
--   ・学生ごと / 組織ごと / 年度ごと / ケースごとに分離。
--   ・created_by は 'student' を既定とし、学生作成カードでは RLS で 'student' を強制。
--     'system' カードは service role（RLS 回避）でのみ作成可能とする。
--   ・解除は物理削除ではなく deleted_at による論理削除（DELETE は誰にも許可しない）。
--   ・identity 系および事実性カラム（source_type/source_reference/original_text/observed_at）は
--     作成後 UPDATE で変更不可（トリガー）。学生が編集できるのは
--     content / category / note / sort_order / deleted_at / source_label のみ。
--   ・同一出所（会話エントリ/メモ）の二重収集を、組織を含めた一意制約で防ぐ。
-- ---------------------------------------------------------------------

create table if not exists public.information_cards (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  organization_id  uuid not null references public.organizations(id),
  academic_year    integer not null default 2026,
  case_id          text not null,
  content          text not null,                 -- 事実（原文/学生が整えた本文）
  source_type      text not null,                 -- 出所種別（12種・下記 CHECK）
  source_label     text not null,
  source_reference jsonb,                          -- {kind,id?,date?,tab?}
  category         text,
  note             text,
  original_text    text,
  observed_at      timestamptz,
  created_by       text not null default 'student',
  sort_order       integer not null default 0,     -- 明示的な並び順
  deleted_at       timestamptz,                     -- null=有効 / 論理削除は now()
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint information_cards_case_id_not_blank check (btrim(case_id) <> ''),
  constraint information_cards_content_not_blank check (btrim(content) <> ''),
  constraint information_cards_sort_order_nonneg check (sort_order >= 0),
  constraint information_cards_created_by_valid
    check (created_by in ('student', 'system')),
  -- 出所種別 12種（lib/information/informationCard.ts の INFORMATION_SOURCE_TYPES と一致）
  constraint information_cards_source_type_valid check (
    source_type in (
      'patient_conversation',
      'student_observation',
      'clinical_record',
      'nursing_record',
      'flowsheet',
      'prescription',
      'examination',
      'life_history',
      'ot',
      'psw',
      'student_note',
      'pathophysiology_reference'
    )
  )
);

-- 有効カードの高速取得
create index if not exists idx_information_cards_owner
  on public.information_cards (user_id, case_id, academic_year)
  where deleted_at is null;

-- 二重収集防止（有効行のみ・organization_id を含めてデータ境界を明示）
create unique index if not exists uq_information_cards_source
  on public.information_cards (
    user_id,
    organization_id,
    academic_year,
    case_id,
    (source_reference->>'kind'),
    (source_reference->>'id')
  )
  where deleted_at is null and source_reference ? 'id';

-- updated_at 自動更新
drop trigger if exists trg_information_cards_updated_at on public.information_cards;
create trigger trg_information_cards_updated_at
  before update on public.information_cards
  for each row execute function public.set_updated_at();

-- 不変カラム保護（identity ＋ 事実性カラム）。
--   学生が変更可能なのは content / category / note / sort_order / deleted_at / source_label。
--   source_type / source_reference を不変にすることで二重収集防止インデックスも保護する。
drop trigger if exists trg_information_cards_immutable on public.information_cards;
create trigger trg_information_cards_immutable
  before update on public.information_cards
  for each row execute function public.reject_immutable_columns(
    'user_id', 'organization_id', 'academic_year', 'case_id',
    'created_by', 'created_at',
    'source_type', 'source_reference', 'original_text', 'observed_at'
  );
