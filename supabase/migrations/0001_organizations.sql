-- =====================================================================
-- Compass Version2 β — Phase 2
-- 0001_organizations.sql : 組織（学校）テーブル
-- =====================================================================
-- 将来の複数学校対応のため、organization_id は TEXT ではなく
-- organizations テーブルへの UUID 参照とする。
-- 今回は「default」1件のみを作成する。
-- ---------------------------------------------------------------------

create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,          -- 内部識別子（例: default）
  name       text not null,                 -- 表示名（例: Compass Default Organization）
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 既定組織を1件だけ投入（再実行しても重複しない）。
insert into public.organizations (slug, name)
values ('default', 'Compass Default Organization')
on conflict (slug) do nothing;

-- RLS を有効化する（ポリシー本体は関数定義後に 0003 で作成する）。
-- ポリシー未作成の間は既定拒否となるが、シードは service role（RLS回避）で行う。
alter table public.organizations enable row level security;
