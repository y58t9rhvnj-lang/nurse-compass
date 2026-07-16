-- =====================================================================
-- Compass Version2 β — Phase 2
-- 0002_profiles.sql : ユーザープロフィール
-- =====================================================================
-- id は auth.users.id と一致（1ユーザー=1プロフィール）。
-- 学生本人の実メールは収集しない。ログインは login_id + パスワードのみで、
-- Supabase Auth 内部では login_id から生成した仮想メールを使う（アプリ層で変換）。
-- ---------------------------------------------------------------------

create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  login_id        text not null unique,               -- 正規化済み（英数字とハイフンのみ・小文字）
  display_name    text not null,
  student_number  text,                               -- 学生のみ想定（教員/adminはNULL可）
  class_name      text,
  role            text not null default 'student'
                    check (role in ('student','teacher','admin')),
  organization_id uuid not null references public.organizations(id),
  academic_year   integer not null default 2026,      -- 年度（今回は2026固定）
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists profiles_organization_id_idx on public.profiles (organization_id);
create index if not exists profiles_role_idx            on public.profiles (role);
create index if not exists profiles_academic_year_idx   on public.profiles (academic_year);

-- 注意: 学習の「現在位置」を1つだけ持つ設計（student_stage_progress）は採用しない。
-- 学習は 情報収集 → 情報整理 → 患者理解 → 再び情報収集 と何度も行き来するため、
-- 段階は将来 Journey にイベントとして残す（03_learning_journey.md 参照）。
